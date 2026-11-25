import type { INestApplication } from '@nestjs/common';
import { addMember, createApp, createProduct, prisma, registerOwner, type Owner } from './utils';

const DAY = 86_400_000;

describe('Live alerts in notifications', () => {
  let app: INestApplication;
  let a: Owner;
  let b: Owner;

  /** Forces the next read to re-derive alerts instead of waiting for the 10 minute throttle. */
  const unthrottle = (o: Owner) =>
    prisma(app).tenant.update({ where: { id: o.tenantId }, data: { alertsCheckedAt: null } });

  beforeAll(async () => {
    app = await createApp();
    a = await registerOwner(app, { businessName: 'Alerts A' });
    b = await registerOwner(app, { businessName: 'Alerts B' });

    // A: one product low on stock, one sold out, an old customer due, a supplier due.
    await createProduct(a.client, { name: 'Low Rice', openingStock: '1', minStock: '5' });
    const gone = await createProduct(a.client, {
      name: 'Gone Oil',
      openingStock: '1',
      minStock: '0',
    });
    const customer = (
      await a.client.post('/customers', { name: 'Late Payer', phone: '01711000001' })
    ).body;
    const sale = await a.client.post('/sales', {
      customerId: customer.id,
      items: [{ productId: gone.id, quantity: '1' }],
      payments: [],
    });
    expect(sale.status).toBe(201);
    await prisma(app).sale.update({
      where: { id: sale.body.id },
      data: { createdAt: new Date(Date.now() - 40 * DAY) },
    });
    const supplier = (await a.client.post('/suppliers', { name: 'Owed Supplier' })).body;
    const restock = await createProduct(a.client, { name: 'Restock Me', openingStock: '50' });
    const po = await a.client.post('/purchases', {
      supplierId: supplier.id,
      items: [{ productId: restock.id, quantity: '2', unitCost: '50' }],
      payments: [],
    });
    expect(po.status).toBe(201);
    await unthrottle(a);
  });
  afterAll(async () => {
    await app.close();
  });

  it('derives low stock, out of stock, overdue customer and supplier dues', async () => {
    const res = await a.client.get('/notifications');
    expect(res.status).toBe(200);
    const types = res.body.items.map((n: any) => n.type);
    expect(types).toEqual(
      expect.arrayContaining(['low-stock', 'out-of-stock', 'customer-dues', 'supplier-dues']),
    );
    const low = res.body.items.find((n: any) => n.type === 'low-stock');
    expect(low.link).toBe('/products?stock=low');
    expect(low.data).toMatchObject({ count: 1, names: ['Low Rice'] });
    const dues = res.body.items.find((n: any) => n.type === 'customer-dues');
    expect(dues.link).toBe('/customers?dues=overdue');
    expect(Number(dues.data.amount)).toBeGreaterThan(0);
    expect(res.body.unread).toBeGreaterThanOrEqual(4);
  });

  it('does not duplicate an alert in the same period and keeps it read', async () => {
    const first = (await a.client.get('/notifications')).body.items.find(
      (n: any) => n.type === 'low-stock',
    );
    expect((await a.client.post(`/notifications/${first.id}/read`)).status).toBe(201);
    await unthrottle(a);
    const again = (await a.client.get('/notifications')).body.items.filter(
      (n: any) => n.type === 'low-stock',
    );
    expect(again).toHaveLength(1);
    expect(again[0].id).toBe(first.id);
    expect(again[0].readAt).not.toBeNull();
  });

  it('warns about a trial ending soon', async () => {
    const sub = await prisma(app).subscription.findFirst({
      where: { tenantId: a.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    await prisma(app).subscription.update({
      where: { id: sub!.id },
      data: {
        status: 'TRIALING',
        trialEndsAt: new Date(Date.now() + 2.5 * DAY),
        endsAt: new Date(Date.now() + 2.5 * DAY),
      },
    });
    await unthrottle(a);
    const trial = (await a.client.get('/notifications')).body.items.find(
      (n: any) => n.type === 'trial-ending',
    );
    expect(trial).toBeDefined();
    expect(trial.data.days).toBe(3);
    expect(trial.link).toBe('/subscription');
  });

  it('hides alerts a role is not allowed to see', async () => {
    const cashier = await addMember(app, a, 'CASHIER');
    const types = (await cashier.client.get('/notifications')).body.items.map((n: any) => n.type);
    expect(types).toContain('low-stock');
    expect(types).toContain('customer-dues');
    expect(types).not.toContain('supplier-dues');
    expect(types).not.toContain('trial-ending');
    const staff = await addMember(app, a, 'STAFF');
    const staffTypes = (await staff.client.get('/notifications')).body.items.map(
      (n: any) => n.type,
    );
    expect(staffTypes).not.toContain('customer-dues');
  });

  it('keeps alerts inside their own business', async () => {
    const res = await b.client.get('/notifications');
    expect(res.status).toBe(200);
    for (const n of res.body.items)
      expect(['low-stock', 'out-of-stock', 'customer-dues', 'supplier-dues']).not.toContain(n.type);
    // B cannot mark A's alert as read.
    const aLow = await prisma(app).notification.findFirst({
      where: { tenantId: a.tenantId, type: 'out-of-stock' },
    });
    await b.client.post(`/notifications/${aLow!.id}/read`);
    const after = await prisma(app).notification.findUnique({ where: { id: aLow!.id } });
    expect(after!.readAt).toBeNull();
  });

  it('filters customers and suppliers by dues', async () => {
    const overdue = (await a.client.get('/customers?dues=overdue')).body;
    expect(overdue.items.map((c: any) => c.name)).toEqual(['Late Payer']);
    const owing = (await a.client.get('/suppliers?dues=owing')).body;
    expect(owing.items.map((s: any) => s.name)).toEqual(['Owed Supplier']);
    expect((await b.client.get('/customers?dues=overdue')).body.total).toBe(0);
  });

  it('re-derives right after demo data loads and clears stale alerts when it is removed', async () => {
    const c = await registerOwner(app, { businessName: 'Alerts C' });
    expect((await c.client.get('/notifications')).body.items).toHaveLength(0);
    expect((await c.client.post('/demo')).status).toBe(201);
    const after = (await c.client.get('/notifications')).body.items.map((n: any) => n.type);
    expect(after.length).toBeGreaterThan(0);
    expect((await c.client.delete('/demo')).status).toBe(200);
    const cleared = (await c.client.get('/notifications')).body.items.filter(
      (n: any) => n.type === 'customer-dues',
    );
    expect(cleared).toHaveLength(0);
  });
});
