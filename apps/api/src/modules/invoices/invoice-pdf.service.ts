import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { formatMoney, formatQty, PAYMENT_METHOD_LABELS } from '@hisabkhata/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { dec } from '../../common/utils/decimal';
import { COLORS, createDoc, docToBuffer, FONTS, mixedText, moneyText } from './pdf-kit.helpers';

function fmtDate(d: Date, tz: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Renders the invoice for a sale. The tenantId filter guarantees no cross-tenant rendering. */
  async render(tenantId: string, saleId: string): Promise<{ buffer: Buffer; filename: string }> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        items: true,
        customer: true,
        tenant: true,
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!sale) throw new NotFoundException('Invoice not found');
    const t = sale.tenant;
    const cur = t.currency;
    const m = (v: { toString(): string }) => formatMoney(v.toString(), cur);

    const doc = await createDoc({ title: `Invoice ${sale.invoiceNo}`, author: t.name });
    const left = 40;
    const right = doc.page.width - 40;
    const width = right - left;

    // ---- header
    let headerTextX = left;
    const logo = t.logoUrl
      ? await this.storage.readForTenant(tenantId, t.logoUrl).catch(() => null)
      : null;
    if (logo) {
      try {
        doc.image(logo, left, 40, { fit: [48, 48] });
        headerTextX = left + 60;
      } catch (err) {
        this.logger.warn({ err }, 'Logo could not be embedded');
      }
    }
    mixedText(doc, t.name, headerTextX, 42, {
      size: 15,
      bold: true,
      color: COLORS.navy,
      width: 280,
    });
    const infoLines = [t.address, t.phone, t.email, t.taxId ? `BIN/VAT: ${t.taxId}` : null].filter(
      Boolean,
    ) as string[];
    let y = 62;
    for (const line of infoLines) {
      mixedText(doc, line, headerTextX, y, { size: 8.5, color: COLORS.muted, width: 280 });
      y += 12;
    }

    doc
      .font(FONTS.bold)
      .fontSize(20)
      .fillColor(COLORS.navy)
      .text('INVOICE', right - 200, 40, { width: 200, align: 'right' });
    const meta: [string, string][] = [
      ['Invoice no.', sale.invoiceNo],
      ['Date', fmtDate(sale.createdAt, t.timezone)],
      ['Status', sale.status === 'COMPLETED' ? sale.paymentStatus : sale.status.replace('_', ' ')],
    ];
    let my = 68;
    for (const [k, v] of meta) {
      doc
        .font(FONTS.regular)
        .fontSize(8.5)
        .fillColor(COLORS.muted)
        .text(k, right - 200, my, { width: 90 });
      const color =
        k === 'Status'
          ? v === 'PAID'
            ? COLORS.emerald
            : v === 'DUE'
              ? COLORS.red
              : COLORS.amber
          : COLORS.ink;
      doc
        .font(FONTS.semibold)
        .fontSize(8.5)
        .fillColor(color)
        .text(v, right - 110, my, { width: 110, align: 'right' });
      my += 13;
    }

    y = Math.max(y, my) + 18;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.8).strokeColor(COLORS.line).stroke();
    y += 14;

    // ---- bill to
    doc.font(FONTS.semibold).fontSize(8).fillColor(COLORS.muted).text('BILL TO', left, y);
    y += 13;
    const c = sale.customer;
    mixedText(doc, c?.name ?? 'Walk-in customer', left, y, { size: 10, bold: true, width: 300 });
    y += 14;
    for (const line of [c?.phone, c?.email, c?.address].filter(Boolean) as string[]) {
      mixedText(doc, line, left, y, { size: 8.5, color: COLORS.muted, width: 300 });
      y += 12;
    }
    y += 14;

    // ---- items table
    const cols = {
      no: left,
      item: left + 24,
      qty: left + 240,
      price: left + 300,
      disc: left + 375,
      amount: right,
    };
    const header = (yy: number) => {
      doc.rect(left, yy, width, 20).fill(COLORS.soft);
      doc.font(FONTS.semibold).fontSize(8).fillColor(COLORS.muted);
      doc.text('#', cols.no + 6, yy + 6);
      doc.text('ITEM', cols.item, yy + 6);
      doc.text('QTY', cols.qty, yy + 6, { width: 60, align: 'right' });
      doc.text('UNIT PRICE', cols.price, yy + 6, { width: 75, align: 'right' });
      doc.text('DISCOUNT', cols.disc, yy + 6, { width: 60, align: 'right' });
      doc.text('AMOUNT', cols.disc + 60, yy + 6, { width: right - cols.disc - 64, align: 'right' });
      return yy + 26;
    };
    y = header(y);

    sale.items.forEach((it, i) => {
      if (y > doc.page.height - 200) {
        doc.addPage();
        y = header(40);
      }
      doc
        .font(FONTS.regular)
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(String(i + 1), cols.no + 6, y);
      mixedText(doc, it.productName, cols.item, y, { size: 9, width: 200 });
      doc
        .font(FONTS.regular)
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(it.sku, cols.item, y + 12, { width: 200 });
      doc
        .font(FONTS.regular)
        .fontSize(9)
        .fillColor(COLORS.ink)
        .text(`${formatQty(it.quantity.toString())} ${it.unit}`, cols.qty, y, {
          width: 60,
          align: 'right',
        });
      moneyText(doc, m(it.unitPrice), cur, cols.price + 75, y);
      if (dec(it.discount).greaterThan(0))
        moneyText(doc, m(it.discount), cur, cols.disc + 60, y, { color: COLORS.muted });
      else
        doc
          .font(FONTS.regular)
          .fillColor(COLORS.muted)
          .text('-', cols.disc, y, { width: 60, align: 'right' });
      moneyText(doc, m(it.lineTotal), cur, right - 4, y, { bold: true });
      if (dec(it.refundedQty).greaterThan(0)) {
        doc
          .font(FONTS.regular)
          .fontSize(7.5)
          .fillColor(COLORS.red)
          .text(`Returned: ${formatQty(it.refundedQty.toString())}`, cols.qty - 30, y + 12, {
            width: 90,
            align: 'right',
          });
      }
      y += 26;
      doc
        .moveTo(left, y - 6)
        .lineTo(right, y - 6)
        .lineWidth(0.5)
        .strokeColor(COLORS.line)
        .stroke();
    });

    // ---- totals
    y += 6;
    const tx = right - 220;
    const row = (
      label: string,
      value: string,
      opts: { bold?: boolean; color?: string; size?: number } = {},
    ) => {
      doc
        .font(opts.bold ? FONTS.semibold : FONTS.regular)
        .fontSize(opts.size ?? 9)
        .fillColor(COLORS.muted)
        .text(label, tx, y, { width: 120 });
      moneyText(doc, value, cur, right - 4, y, {
        bold: opts.bold,
        color: opts.color,
        size: opts.size,
      });
      y += (opts.size ?? 9) + 8;
    };
    row('Subtotal', m(sale.subtotal));
    if (dec(sale.discount).greaterThan(0)) row('Discount', `-${m(sale.discount)}`);
    if (dec(sale.tax).greaterThan(0)) row(`Tax (${dec(sale.taxRate).toString()}%)`, m(sale.tax));
    doc
      .moveTo(tx, y - 2)
      .lineTo(right, y - 2)
      .lineWidth(0.8)
      .strokeColor(COLORS.line)
      .stroke();
    y += 4;
    row('Total', m(sale.total), { bold: true, size: 11, color: COLORS.navy });
    if (dec(sale.refundedAmount).greaterThan(0))
      row('Returned', `-${m(sale.refundedAmount)}`, { color: COLORS.red });
    row('Paid', m(sale.paidAmount), { color: COLORS.emerald });
    row('Amount due', m(sale.dueAmount), {
      bold: true,
      color: dec(sale.dueAmount).greaterThan(0) ? COLORS.red : COLORS.ink,
    });

    // ---- payments
    const incoming = sale.payments.filter((p) => p.direction === 'IN');
    if (incoming.length) {
      y += 6;
      doc.font(FONTS.semibold).fontSize(8).fillColor(COLORS.muted).text('PAYMENTS', left, y);
      y += 13;
      for (const p of incoming) {
        doc
          .font(FONTS.regular)
          .fontSize(8.5)
          .fillColor(COLORS.ink)
          .text(
            `${fmtDate(p.createdAt, t.timezone)}  ·  ${PAYMENT_METHOD_LABELS[p.method]}${p.reference ? `  ·  ${p.reference}` : ''}`,
            left,
            y,
            { width: 260 },
          );
        moneyText(doc, m(p.amount), cur, left + 330, y, { size: 8.5 });
        y += 13;
      }
    }

    // ---- footer on every page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const fy = doc.page.height - 60;
      doc.moveTo(left, fy).lineTo(right, fy).lineWidth(0.5).strokeColor(COLORS.line).stroke();
      if (t.invoiceFooter)
        mixedText(doc, t.invoiceFooter, left, fy + 8, {
          size: 8,
          color: COLORS.muted,
          width: width - 120,
        });
      doc
        .font(FONTS.regular)
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(
          `Page ${i - range.start + 1} of ${range.count}  ·  Generated with HisabKhata`,
          right - 200,
          fy + 8,
          { width: 200, align: 'right', lineBreak: false },
        );
    }

    const buffer = await docToBuffer(doc);
    return { buffer, filename: `${sale.invoiceNo}.pdf` };
  }
}
