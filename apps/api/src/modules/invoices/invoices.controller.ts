import { BadRequestException, Controller, Get, Injectable, NotFoundException, OnModuleInit, Param, Post, Res } from '@nestjs/common';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { formatMoney, listQuerySchema, PERMISSIONS, isoDate } from '@hisabkhata/shared';
import { RequirePermissions, Tenant, ZBody, ZQuery } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../core/audit.service';
import { pageArgs, paginated } from '../../common/utils/pagination';
import { randomToken } from '../../common/utils/crypto';
import { InvoicePdfService } from './invoice-pdf.service';
import type { Prisma } from '../../generated/prisma/client';

const emailSchema = z.object({ to: z.string().trim().toLowerCase().email().optional() });
const invoiceListQuery = listQuerySchema.extend({ from: isoDate.optional(), to: isoDate.optional() });

/** Background job: render the PDF and email it. Runs on the "documents" queue. */
@Injectable()
export class InvoiceEmailJob implements OnModuleInit {
  constructor(
    private readonly jobs: JobsService,
    private readonly pdf: InvoicePdfService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.jobs.register('invoice.email', (d: { tenantId: string; saleId: string; to: string; requestId: string }) => this.run(d));
  }

  async run(d: { tenantId: string; saleId: string; to: string; requestId: string }) {
    const sale = await this.prisma.sale.findFirst({ where: { id: d.saleId, tenantId: d.tenantId }, include: { tenant: true, customer: true } });
    if (!sale) return;
    const { buffer, filename } = await this.pdf.render(d.tenantId, d.saleId);
    await this.mail.deliver({
      template: 'invoice',
      to: d.to,
      tenantId: d.tenantId,
      dedupeKey: `invoice:${d.saleId}:${d.requestId}`,
      data: {
        invoiceNo: sale.invoiceNo,
        businessName: sale.tenant.name,
        customerName: sale.customer?.name,
        total: formatMoney(sale.total.toString(), sale.tenant.currency),
        due: formatMoney(sale.dueAmount.toString(), sale.tenant.currency),
      },
      attachments: [{ filename, contentBase64: buffer.toString('base64'), contentType: 'application/pdf' }],
    });
    await this.prisma.invoice.updateMany({ where: { saleId: d.saleId, tenantId: d.tenantId }, data: { emailedTo: d.to, emailedAt: new Date() } });
  }
}

@ApiTags('Invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: InvoicePdfService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVOICE_VIEW)
  async list(@Tenant() t: TenantContext, @ZQuery(invoiceListQuery) q: any) {
    const db = this.prisma.scoped(t.tenantId);
    const where: Prisma.InvoiceWhereInput = {
      ...(q.from || q.to ? { issuedAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      ...(q.search
        ? { OR: [{ invoiceNo: { contains: q.search, mode: 'insensitive' } }, { sale: { customer: { name: { contains: q.search, mode: 'insensitive' } } } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          sale: {
            select: { id: true, total: true, paidAmount: true, dueAmount: true, status: true, paymentStatus: true, refundedAmount: true, customer: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { issuedAt: 'desc' },
        ...pageArgs(q),
      }),
      db.invoice.count({ where }),
    ]);
    return paginated(items, total, q);
  }

  @Get(':saleId/pdf')
  @ApiProduces('application/pdf')
  @RequirePermissions(PERMISSIONS.INVOICE_VIEW)
  async download(@Tenant() t: TenantContext, @Param('saleId') saleId: string, @Res() res: Response) {
    const { buffer, filename } = await this.pdf.render(t.tenantId, saleId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }

  @Post(':saleId/email')
  @RequirePermissions(PERMISSIONS.INVOICE_SEND)
  async email(@Tenant() t: TenantContext, @Param('saleId') saleId: string, @ZBody(emailSchema) body: { to?: string }) {
    const sale = await this.prisma.sale.findFirst({ where: { id: saleId, tenantId: t.tenantId }, include: { customer: true } });
    if (!sale) throw new NotFoundException('Invoice not found');
    const to = body.to ?? sale.customer?.email;
    if (!to) throw new BadRequestException('This customer has no email address. Enter one to send the invoice.');
    await this.jobs.add('documents', 'invoice.email', { tenantId: t.tenantId, saleId, to, requestId: randomToken(8) });
    await this.audit.log({ action: 'invoice.emailed', tenantId: t.tenantId, userId: t.userId, entity: 'Sale', entityId: saleId, metadata: { to } });
    return { ok: true, queued: true, to };
  }
}
