import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Job, JobsOptions, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AppConfig } from '../../config/app-config.service';

export const QUEUES = ['mail', 'documents', 'maintenance'] as const;
export type QueueName = (typeof QUEUES)[number];
type Handler = (data: any, job?: Job) => Promise<unknown>;

const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
  removeOnFail: { count: 5000 },
};

/**
 * Thin layer over BullMQ. Modules register named handlers; jobs are processed by a worker per queue.
 * When QUEUES_ENABLED=false (tests, Redis-less local runs) jobs run inline so behaviour stays identical.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<string, Handler>();
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers: Worker[] = [];
  private connection?: IORedis;
  readonly enabled: boolean;

  constructor(private readonly config: AppConfig) {
    this.enabled = config.get('QUEUES_ENABLED');
    if (this.enabled) {
      this.connection = new IORedis(config.get('REDIS_URL'), {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      this.connection.on('error', (err) => this.logger.error({ err }, 'Redis connection error'));
      for (const q of QUEUES) {
        this.queues.set(
          q,
          new Queue(q, { connection: this.connection, defaultJobOptions: DEFAULT_JOB_OPTS }),
        );
      }
    }
  }

  register(name: string, handler: Handler): void {
    this.handlers.set(name, handler);
  }

  async add(queue: QueueName, name: string, data: unknown, opts: JobsOptions = {}): Promise<void> {
    if (!this.enabled) {
      await this.run(name, data);
      return;
    }
    await this.queues.get(queue)!.add(name, data, opts);
  }

  private async run(name: string, data: unknown, job?: Job) {
    const handler = this.handlers.get(name);
    if (!handler) throw new Error(`No handler registered for job "${name}"`);
    return handler(data, job);
  }

  async onApplicationBootstrap() {
    if (!this.enabled || !this.connection) return;
    for (const q of QUEUES) {
      const worker = new Worker(q, (job) => this.run(job.name, job.data, job), {
        connection: this.connection.duplicate({ maxRetriesPerRequest: null }),
        concurrency: q === 'mail' ? 5 : 2,
        // Fewer idle round-trips: matters on per-command Redis plans such as Upstash's free tier.
        drainDelay: 30,
        stalledInterval: 300_000,
      });
      worker.on('failed', (job, err) =>
        this.logger.warn(
          { queue: q, job: job?.name, id: job?.id, attempts: job?.attemptsMade, err: err.message },
          'Job failed',
        ),
      );
      this.workers.push(worker);
    }
    const maintenance = this.queues.get('maintenance')!;
    await maintenance.upsertJobScheduler(
      'subscription-expiry',
      { pattern: '0 20 * * *' },
      { name: 'subscription.expiry-check' },
    );
    await maintenance.upsertJobScheduler(
      'low-stock-digest',
      { pattern: '0 3 * * *' },
      { name: 'inventory.low-stock-digest' },
    );
    this.logger.log('Background workers started');
  }

  async onModuleDestroy() {
    await Promise.allSettled(this.workers.map((w) => w.close()));
    await Promise.allSettled([...this.queues.values()].map((q) => q.close()));
    await this.connection?.quit().catch(() => undefined);
  }

  /** Used by the super-admin job monitor. */
  async stats() {
    if (!this.enabled) return { enabled: false, queues: [] };
    const queues = await Promise.all(
      [...this.queues.entries()].map(async ([name, q]) => ({
        name,
        counts: await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
        failed: (await q.getFailed(0, 19)).map((j) => ({
          id: j.id,
          name: j.name,
          failedReason: j.failedReason,
          attemptsMade: j.attemptsMade,
          timestamp: j.timestamp,
        })),
      })),
    );
    return { enabled: true, queues };
  }

  async retry(queue: QueueName, jobId: string) {
    const q = this.queues.get(queue);
    const job = q ? await q.getJob(jobId) : undefined;
    if (!job) return { ok: false };
    await job.retry();
    return { ok: true };
  }

  async ping(): Promise<boolean> {
    if (!this.connection) return true;
    try {
      return (await this.connection.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
