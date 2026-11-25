import { BadRequestException, Injectable } from '@nestjs/common';
import { productImportRowSchema, type ProductImportRow } from '@hisabkhata/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../core/audit.service';
import { AlertsService } from '../core/alerts.service';
import { CounterService } from '../core/counter.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StockService } from './stock.service';
import { dec } from '../../common/utils/decimal';
import type { TenantContext } from '../../common/types';

export interface ImportRowError {
  /** 1-based row number as the user sees it in their sheet (header is row 1). */
  row: number;
  field: string;
  message: string;
}

export interface ImportReport {
  total: number;
  valid: number;
  errors: ImportRowError[];
  newCategories: string[];
  created?: number;
}

/** Spreadsheet cells arrive as strings or numbers: tidy them before validation. */
function clean(raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) continue;
    let s = typeof v === 'number' ? String(v) : String(v).trim();
    if (['purchasePrice', 'sellingPrice', 'taxRate', 'openingStock', 'minStock'].includes(k))
      s = s.replace(/[,\s৳]/g, '').replace(/%$/, '');
    if (s === '') continue;
    out[k] = s;
  }
  return out;
}

@Injectable()
export class ProductImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly counters: CounterService,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionsService,
    private readonly alerts: AlertsService,
  ) {}

  /** Validates every row (types, duplicates in the file and against existing products). */
  private async validate(tenantId: string, rows: Record<string, unknown>[]) {
    const errors: ImportRowError[] = [];
    const parsed: { row: number; data: ProductImportRow }[] = [];
    const seenSku = new Map<string, number>();
    const seenBarcode = new Map<string, number>();
    rows.forEach((raw, i) => {
      const row = i + 2;
      const r = productImportRowSchema.safeParse(clean(raw));
      if (!r.success) {
        for (const issue of r.error.issues)
          errors.push({ row, field: String(issue.path[0] ?? 'row'), message: issue.message });
        return;
      }
      const d = r.data;
      if (d.sku) {
        if (seenSku.has(d.sku))
          errors.push({ row, field: 'sku', message: `Same SKU as row ${seenSku.get(d.sku)}` });
        else seenSku.set(d.sku, row);
      }
      if (d.barcode) {
        if (seenBarcode.has(d.barcode))
          errors.push({
            row,
            field: 'barcode',
            message: `Same barcode as row ${seenBarcode.get(d.barcode)}`,
          });
        else seenBarcode.set(d.barcode, row);
      }
      parsed.push({ row, data: d });
    });

    const [skuTaken, barcodeTaken] = await Promise.all([
      this.prisma.product.findMany({
        where: { tenantId, sku: { in: [...seenSku.keys()] } },
        select: { sku: true },
      }),
      this.prisma.product.findMany({
        where: { tenantId, barcode: { in: [...seenBarcode.keys()] } },
        select: { barcode: true },
      }),
    ]);
    for (const { sku } of skuTaken)
      errors.push({
        row: seenSku.get(sku)!,
        field: 'sku',
        message: 'A product with this SKU already exists',
      });
    for (const { barcode } of barcodeTaken)
      errors.push({
        row: seenBarcode.get(barcode!)!,
        field: 'barcode',
        message: 'A product with this barcode already exists',
      });

    const wanted = [
      ...new Set(parsed.map((p) => p.data.category?.trim()).filter((c): c is string => !!c)),
    ];
    const existing = await this.prisma.category.findMany({
      where: { tenantId, archivedAt: null },
      select: { id: true, name: true },
    });
    const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c.id]));
    const newCategories = wanted.filter((c) => !byName.has(c.toLowerCase()));

    errors.sort((a, b) => a.row - b.row);
    const badRows = new Set(errors.map((e) => e.row));
    return { errors, parsed: parsed.filter((p) => !badRows.has(p.row)), byName, newCategories };
  }

  /**
   * Dry run returns the validation report. A real run imports everything or nothing: if any
   * row has an error, nothing is written and the same report comes back as a 400.
   */
  async import(
    ctx: TenantContext,
    rows: Record<string, unknown>[],
    dryRun: boolean,
  ): Promise<ImportReport> {
    const { errors, parsed, byName, newCategories } = await this.validate(ctx.tenantId, rows);
    const report: ImportReport = {
      total: rows.length,
      valid: parsed.length,
      errors,
      newCategories,
    };
    if (dryRun) return report;
    if (errors.length)
      throw new BadRequestException({
        message: 'Fix the highlighted rows and import again',
        code: 'IMPORT_INVALID',
        ...report,
      });

    await this.subscriptions.assertWithinLimit(ctx.tenantId, 'products', parsed.length);
    await this.prisma.$transaction(
      async (tx) => {
        for (const name of newCategories) {
          const c = await tx.category.create({ data: { tenantId: ctx.tenantId, name } });
          byName.set(name.toLowerCase(), c.id);
        }
        for (const { data: d } of parsed) {
          const sku =
            d.sku ??
            `SKU-${String(await this.counters.next(tx, ctx.tenantId, 'sku')).padStart(5, '0')}`;
          const p = await tx.product.create({
            data: {
              tenantId: ctx.tenantId,
              name: d.name,
              sku,
              barcode: d.barcode ?? null,
              categoryId: d.category ? (byName.get(d.category.trim().toLowerCase()) ?? null) : null,
              unit: d.unit,
              purchasePrice: dec(d.purchasePrice).toFixed(2),
              sellingPrice: dec(d.sellingPrice).toFixed(2),
              taxRate: d.taxRate,
              minStock: d.minStock,
            },
          });
          const opening = dec(d.openingStock ?? 0);
          if (opening.greaterThan(0)) {
            await this.stock.move(tx, {
              tenantId: ctx.tenantId,
              productId: p.id,
              delta: opening,
              type: 'OPENING',
              allowNegative: false,
              unitCost: dec(d.purchasePrice),
              userId: ctx.userId,
              note: 'Opening stock (import)',
            });
          }
        }
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    await this.audit.log({
      action: 'product.imported',
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      entity: 'Product',
      metadata: { count: parsed.length },
    });
    await this.alerts.invalidate(ctx.tenantId);
    return { ...report, created: parsed.length };
  }
}
