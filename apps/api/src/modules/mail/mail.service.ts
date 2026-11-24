import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { render, TemplateName } from './templates';

export interface MailJob {
  template: TemplateName;
  to: string;
  data: Record<string, any>;
  /** Stable key: the same logical email is never sent twice, even if the job is retried. */
  dedupeKey: string;
  tenantId?: string | null;
  attachments?: { filename: string; contentBase64: string; contentType: string }[];
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter;
  /** In test runs, sent messages are kept here for assertions. */
  readonly outbox: { to: string; subject: string; template: string; data: Record<string, any> }[] = [];

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {
    const host = config.get('SMTP_HOST');
    this.transport = host
      ? nodemailer.createTransport({
          host,
          port: config.get('SMTP_PORT'),
          secure: config.get('SMTP_SECURE'),
          auth: config.get('SMTP_USER') ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') } : undefined,
        })
      : nodemailer.createTransport({ jsonTransport: true });
  }

  onModuleInit() {
    this.jobs.register('mail.send', (job: MailJob) => this.deliver(job));
  }

  async enqueue(job: MailJob): Promise<void> {
    try {
      await this.jobs.add('mail', 'mail.send', job, { jobId: job.dedupeKey.replace(/:/g, '_') });
    } catch (err) {
      // Email is never allowed to fail the request that triggered it.
      this.logger.error({ err, template: job.template }, 'Failed to enqueue email');
    }
  }

  /** Idempotent: an EmailLog row with status SENT short-circuits retries. */
  async deliver(job: MailJob): Promise<void> {
    const { subject, html, text } = render(job.template, { appUrl: this.config.get('APP_URL'), ...job.data });
    const log = await this.prisma.emailLog.upsert({
      where: { dedupeKey: job.dedupeKey },
      create: { dedupeKey: job.dedupeKey, to: job.to, template: job.template, subject, tenantId: job.tenantId ?? null },
      update: {},
    });
    if (log.status === 'SENT') return;

    try {
      await this.transport.sendMail({
        from: this.config.get('MAIL_FROM'),
        to: job.to,
        subject,
        html,
        text,
        attachments: job.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.contentBase64, 'base64'),
          contentType: a.contentType,
        })),
      });
      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, error: null },
      });
      if (this.config.isTest) this.outbox.push({ to: job.to, subject, template: job.template, data: job.data });
    } catch (err) {
      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', attempts: { increment: 1 }, error: String((err as Error).message).slice(0, 500) },
      });
      throw err;
    }
  }
}
