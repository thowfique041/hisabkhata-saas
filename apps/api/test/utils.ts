import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/modules/mail/mail.service';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  configureApp(app);
  await app.init();
  return app;
}

let counter = 0;
export const unique = (prefix = 'u') => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * A browser-like client: keeps cookies between requests and echoes the CSRF cookie in the
 * X-CSRF-Token header, exactly like the web app does.
 */
export class Client {
  readonly agent: ReturnType<typeof request.agent>;
  csrf = '';
  readonly cookies: Record<string, string> = {};
  constructor(readonly app: INestApplication) {
    this.agent = request.agent(app.getHttpServer());
  }

  private capture(res: request.Response) {
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    for (const raw of cookies) {
      const [pair] = raw.split(';');
      const i = pair.indexOf('=');
      this.cookies[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
    }
    if (this.cookies.hk_csrf) this.csrf = this.cookies.hk_csrf;
    return res;
  }

  get(url: string) {
    return this.agent.get(`/api${url}`).then((r) => this.capture(r));
  }
  post(url: string, body?: object) {
    return this.agent.post(`/api${url}`).set('X-CSRF-Token', this.csrf).send(body ?? {}).then((r) => this.capture(r));
  }
  put(url: string, body?: object) {
    return this.agent.put(`/api${url}`).set('X-CSRF-Token', this.csrf).send(body ?? {}).then((r) => this.capture(r));
  }
  patch(url: string, body?: object) {
    return this.agent.patch(`/api${url}`).set('X-CSRF-Token', this.csrf).send(body ?? {}).then((r) => this.capture(r));
  }
  delete(url: string) {
    return this.agent.delete(`/api${url}`).set('X-CSRF-Token', this.csrf).then((r) => this.capture(r));
  }
}

export interface Owner {
  client: Client;
  email: string;
  password: string;
  tenantId: string;
  userId: string;
}

export async function registerOwner(app: INestApplication, opts: { businessName?: string } = {}): Promise<Owner> {
  const client = new Client(app);
  const email = `${unique('owner')}@test.local`;
  const password = 'Passw0rd123';
  const res = await client.post('/auth/register', {
    name: 'Test Owner',
    email,
    password,
    businessName: opts.businessName ?? `Shop ${unique()}`,
    businessType: 'RETAIL',
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const session = await client.get('/auth/session');
  return { client, email, password, tenantId: session.body.activeTenant.id, userId: session.body.user.id };
}

export async function login(app: INestApplication, email: string, password: string) {
  const client = new Client(app);
  const res = await client.post('/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return client;
}

export async function createProduct(client: Client, over: Record<string, unknown> = {}) {
  const res = await client.post('/products', {
    name: `Product ${unique()}`,
    purchasePrice: '80.00',
    sellingPrice: '100.00',
    openingStock: '10',
    minStock: '2',
    ...over,
  });
  if (res.status !== 201) throw new Error(`product failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export function mail(app: INestApplication) {
  return app.get(MailService).outbox;
}

export function prisma(app: INestApplication) {
  return app.get(PrismaService);
}

export async function makeSuperAdmin(app: INestApplication) {
  const owner = await registerOwner(app);
  await prisma(app).user.update({ where: { id: owner.userId }, data: { isSuperAdmin: true } });
  return owner;
}
