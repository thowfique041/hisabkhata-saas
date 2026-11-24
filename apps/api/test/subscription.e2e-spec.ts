import type { INestApplication } from '@nestjs/common';
import { Client, createApp, createProduct, login, makeSuperAdmin, prisma, registerOwner, unique } from './utils';

describe('Subscriptions and plan limits', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('enforces product and employee limits on the Free plan', async () => {
    const o = await registerOwner(app);
    const change = await o.client.post('/subscription/change', { planCode: 'FREE', interval: 'MONTHLY', provider: 'manual' });
    expect(change.body.status).toBe('ACTIVATED');
    expect((await o.client.get('/auth/session')).body.plan.code).toBe('FREE');

    const free = await prisma(app).subscriptionPlan.findUniqueOrThrow({ where: { code: 'FREE' } });
    for (let i = 0; i < free.maxProducts; i++) {
      await prisma(app).product.create({ data: { tenantId: o.tenantId, name: `Bulk ${i}`, sku: `BULK-${i}`, purchasePrice: 1, sellingPrice: 2 } });
    }
    const over = await o.client.post('/products', { name: 'One too many', purchasePrice: '1', sellingPrice: '2' });
    expect(over.status).toBe(403);
    expect(over.body.code).toBe('PLAN_LIMIT');

    const roles = (await o.client.get('/roles')).body;
    const invite = await o.client.post('/employees', { name: 'Extra', email: `${unique()}@t.local`, roleId: roles[2].id });
    expect(invite.status).toBe(403);
    expect(invite.body.code).toBe('PLAN_LIMIT');
  });

  it('restricts advanced reports to plans that include them', async () => {
    const o = await registerOwner(app);
    expect((await o.client.get('/reports/profit-loss')).status).toBe(200); // Basic trial includes it
    await o.client.post('/subscription/change', { planCode: 'FREE', interval: 'MONTHLY', provider: 'manual' });
    const gated = await o.client.get('/reports/profit-loss');
    expect(gated.status).toBe(403);
    expect(gated.body.code).toBe('PLAN_FEATURE');
    expect((await o.client.get('/reports/sales')).status).toBe(200);
  });

  it('refuses a downgrade that the current usage does not fit', async () => {
    const o = await registerOwner(app);
    for (let i = 0; i < 51; i++) {
      await prisma(app).product.create({ data: { tenantId: o.tenantId, name: `P ${i}`, sku: `P-${i}`, purchasePrice: 1, sellingPrice: 2 } });
    }
    const res = await o.client.post('/subscription/change', { planCode: 'FREE', interval: 'MONTHLY', provider: 'manual' });
    expect(res.status).toBe(409);
  });

  it('never activates a paid plan before the payment is confirmed', async () => {
    const o = await registerOwner(app);
    const res = await o.client.post('/subscription/change', { planCode: 'PREMIUM', interval: 'MONTHLY', provider: 'manual' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING_PAYMENT');
    expect(res.body.instructions).toContain('1,499.00');
    expect((await o.client.get('/auth/session')).body.plan.code).toBe('BASIC');

    // Tenant owners cannot confirm their own payment.
    expect((await o.client.post(`/admin/billing-payments/${res.body.paymentId}/confirm`, {})).status).toBe(403);

    const admin = await makeSuperAdmin(app);
    const adminClient = await login(app, admin.email, admin.password);
    const ok = await adminClient.post(`/admin/billing-payments/${res.body.paymentId}/confirm`, { reference: 'BANK-REF-77' });
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('SUCCEEDED');
    // Confirming twice is harmless (idempotent).
    expect((await adminClient.post(`/admin/billing-payments/${res.body.paymentId}/confirm`, {})).status).toBe(201);
    const session = (await o.client.get('/auth/session')).body;
    expect(session.plan.code).toBe('PREMIUM');
    expect(session.plan.status).toBe('ACTIVE');
    const subs = await prisma(app).subscription.count({ where: { tenantId: o.tenantId, status: 'ACTIVE' } });
    expect(subs).toBe(1);
  });

  it('rejects webhooks from unconfigured or unauthenticated providers', async () => {
    const res = await new Client(app).agent.post('/api/billing/webhooks/sslcommerz').type('form').send({ tran_id: 'x', val_id: 'y', status: 'VALID' });
    expect(res.status).toBe(400);
  });

  it('expires lapsed subscriptions to the Free plan and notifies the owner', async () => {
    const o = await registerOwner(app);
    await prisma(app).subscription.updateMany({ where: { tenantId: o.tenantId }, data: { endsAt: new Date(Date.now() - 1000) } });
    const { SubscriptionsService } = await import('../src/modules/subscriptions/subscriptions.service');
    await app.get(SubscriptionsService).runExpiryCheck();
    const session = (await o.client.get('/auth/session')).body;
    expect(session.plan.code).toBe('FREE');
    const notes = (await o.client.get('/notifications')).body;
    expect(notes.items[0].title).toMatch(/expired/);
    await app.get(SubscriptionsService).runExpiryCheck();
    const { MailService } = await import('../src/modules/mail/mail.service');
    expect(app.get(MailService).outbox.filter((m) => m.to === o.email && m.template === 'subscription-expiring')).toHaveLength(1);
  });

  it('sends the low-stock digest once per day', async () => {
    const o = await registerOwner(app);
    await createProduct(o.client, { openingStock: '1', minStock: '5' });
    const { LowStockJob } = await import('../src/modules/inventory/low-stock.job');
    await app.get(LowStockJob).run(o.tenantId);
    await app.get(LowStockJob).run(o.tenantId);
    const { MailService } = await import('../src/modules/mail/mail.service');
    expect(app.get(MailService).outbox.filter((m) => m.to === o.email && m.template === 'low-stock')).toHaveLength(1);
  });
});
