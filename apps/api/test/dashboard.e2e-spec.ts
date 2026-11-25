import type { INestApplication } from '@nestjs/common';
import { createApp, createProduct, prisma, registerOwner, type Owner } from './utils';

describe('Dashboard comparisons', () => {
  let app: INestApplication;
  let a: Owner;
  let b: Owner;
  beforeAll(async () => {
    app = await createApp();
    a = await registerOwner(app, { businessName: 'Dash A' });
    b = await registerOwner(app, { businessName: 'Dash B' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('reports yesterday up to the same time, kept apart per business', async () => {
    const p = await createProduct(a.client, { sellingPrice: '100.00', openingStock: '20' });
    const sell = async () =>
      (
        await a.client.post('/sales', {
          items: [{ productId: p.id, quantity: '1' }],
          payments: [{ method: 'CASH', amount: '100' }],
        })
      ).body;
    await sell();
    const old = await sell();
    const late = await sell();
    // One sale exactly a day ago (counts for "yesterday so far"), one later yesterday than now (does not).
    await prisma(app).sale.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 86_400_000 - 60_000) },
    });
    await prisma(app).sale.update({
      where: { id: late.id },
      data: { createdAt: new Date(Date.now() - 86_400_000 + 3_600_000) },
    });

    const res = await a.client.get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.kpis.salesToday).toBeDefined();
    const { comparisons } = res.body;
    expect(comparisons).toMatchObject({ ordersYesterday: expect.any(Number) });
    // The late one is still in the future relative to "this time yesterday".
    const inside = new Date(Date.now() - 86_400_000 - 60_000);
    const startOfDhakaToday = new Date(
      `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())}T00:00:00+06:00`,
    );
    const expected = inside >= new Date(startOfDhakaToday.getTime() - 86_400_000) ? 1 : 0;
    expect(comparisons.ordersYesterday).toBe(expected);

    const other = (await b.client.get('/dashboard')).body.comparisons;
    expect(other).toMatchObject({ ordersYesterday: 0, ordersLastMonth: 0, salesYesterday: '0.00' });
  });
});
