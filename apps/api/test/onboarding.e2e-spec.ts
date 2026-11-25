import type { INestApplication } from '@nestjs/common';
import { addMember, createApp, createProduct, prisma, registerOwner, type Owner } from './utils';

describe('Demo data', () => {
  let app: INestApplication;
  let a: Owner;
  let b: Owner;
  beforeAll(async () => {
    app = await createApp();
    a = await registerOwner(app, { businessName: 'Demo Shop A' });
    b = await registerOwner(app, { businessName: 'Demo Shop B' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('loads a realistic sample shop for the owner and refuses a second load', async () => {
    const res = await a.client.post('/demo');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ loaded: true, products: 30, customers: 8 });
    expect(res.body.sales).toBeGreaterThan(150);

    const dash = (await a.client.get('/dashboard')).body;
    expect(Number(dash.kpis.pendingPayments)).toBeGreaterThan(0);
    expect(Number(dash.kpis.salesThisMonth)).toBeGreaterThan(0);
    const products = (await a.client.get('/products?pageSize=50')).body;
    expect(products.total).toBe(30);
    // Stock never goes negative and matches the movement ledger.
    for (const p of products.items) expect(Number(p.stock)).toBeGreaterThanOrEqual(0);
    const rice = products.items.find((p: any) => p.sku === 'DEMO-001');
    const last = await prisma(app).stockMovement.findFirst({
      where: { productId: rice.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(Number(last!.balanceAfter)).toBe(Number(rice.stock));

    expect((await a.client.post('/demo')).status).toBe(409);
  });

  it('does not consume the real invoice counter', async () => {
    const product = await createProduct(a.client);
    const sale = await a.client.post('/sales', {
      items: [{ productId: product.id, quantity: '1' }],
      payments: [{ method: 'CASH', amount: '100' }],
    });
    expect(sale.status).toBe(201);
    expect(sale.body.invoiceNo).toMatch(/-\d{2}00001$/);
  });

  it('is owner only', async () => {
    const manager = await addMember(app, a, 'MANAGER');
    expect((await manager.client.post('/demo')).status).toBe(403);
    expect((await manager.client.delete('/demo')).status).toBe(403);
  });

  it('stays inside its own business', async () => {
    expect((await b.client.get('/demo')).body.loaded).toBe(false);
    expect((await b.client.get('/products')).body.total).toBe(0);
    // Removing in B must not touch A's demo rows.
    expect((await b.client.delete('/demo')).status).toBe(200);
    expect((await a.client.get('/demo')).body.loaded).toBe(true);
    const demoIdsFromA = (await a.client.get('/products?pageSize=5')).body.items.map(
      (p: any) => p.id,
    );
    for (const id of demoIdsFromA) expect((await b.client.get(`/products/${id}`)).status).toBe(404);
  });

  it('removes only demo rows and keeps demo records that real sales now use', async () => {
    const realProduct = await createProduct(a.client, { name: 'Real product' });
    const demoProduct = (await a.client.get('/products?search=DEMO-002')).body.items[0];
    const realSale = await a.client.post('/sales', {
      items: [{ productId: demoProduct.id, quantity: '1' }],
      payments: [{ method: 'CASH', amount: '1000' }],
    });
    expect(realSale.status).toBe(201);

    const res = await a.client.delete('/demo');
    expect(res.status).toBe(200);
    expect(res.body.removed.products).toBe(29);
    expect(res.body.kept.products).toBe(1);
    expect(res.body.removed.sales).toBeGreaterThan(150);

    expect((await a.client.get('/demo')).body.loaded).toBe(false);
    expect((await a.client.get(`/products/${realProduct.id}`)).status).toBe(200);
    expect((await a.client.get(`/products/${demoProduct.id}`)).status).toBe(200);
    expect((await a.client.get(`/sales/${realSale.body.id}`)).status).toBe(200);
    const left = await prisma(app).sale.count({ where: { tenantId: a.tenantId, isDemo: true } });
    expect(left).toBe(0);
    // Nothing demo-tagged is left behind, so the owner can load the demo again.
    expect((await a.client.post('/demo')).status).toBe(201);
  });
});

describe('Product import', () => {
  let app: INestApplication;
  let a: Owner;
  let b: Owner;
  beforeAll(async () => {
    app = await createApp();
    a = await registerOwner(app);
    b = await registerOwner(app);
    await createProduct(a.client, { sku: 'TAKEN-1', name: 'Existing' });
  });
  afterAll(async () => {
    await app.close();
  });

  const rows = [
    {
      name: 'Miniket Rice 25 kg',
      sku: 'RICE-25',
      barcode: '8941000000011',
      category: 'Rice',
      unit: 'bag',
      purchasePrice: '1,720',
      sellingPrice: '1850',
      taxRate: '0',
      openingStock: '12',
      minStock: '3',
    },
    {
      name: 'চানাচুর ৩০০ গ্রাম',
      category: 'Snacks',
      purchasePrice: 68,
      sellingPrice: 80,
      openingStock: 40,
    },
  ];

  it('reports per-row errors on a dry run without writing anything', async () => {
    const res = await a.client.post('/products/import', {
      dryRun: true,
      rows: [
        ...rows,
        { name: '', sellingPrice: 'abc' },
        { name: 'Dup', sku: 'TAKEN-1', purchasePrice: 1, sellingPrice: 2 },
        { name: 'Same sku', sku: 'RICE-25', purchasePrice: 1, sellingPrice: 2 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.valid).toBe(2);
    expect(res.body.newCategories.sort()).toEqual(['Rice', 'Snacks']);
    const fields = res.body.errors.map((e: any) => `${e.row}:${e.field}`);
    expect(fields).toEqual(expect.arrayContaining(['4:name', '4:sellingPrice', '5:sku', '6:sku']));
    expect((await a.client.get('/products')).body.total).toBe(1);
  });

  it('refuses a real import while any row is invalid', async () => {
    const res = await a.client.post('/products/import', {
      dryRun: false,
      rows: [...rows, { name: 'Bad', purchasePrice: 'x', sellingPrice: 1 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBe(1);
    expect((await a.client.get('/products')).body.total).toBe(1);
  });

  it('imports products, opening stock and missing categories', async () => {
    const res = await a.client.post('/products/import', { dryRun: false, rows });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    const list = (await a.client.get('/products?pageSize=10&sort=name&order=asc')).body.items;
    const rice = list.find((p: any) => p.sku === 'RICE-25');
    expect(rice.unit).toBe('bag');
    expect([Number(rice.purchasePrice), Number(rice.sellingPrice)]).toEqual([1720, 1850]);
    expect(Number(rice.stock)).toBe(12);
    const chanachur = list.find((p: any) => p.name === 'চানাচুর ৩০০ গ্রাম');
    expect(chanachur.sku).toMatch(/^SKU-/);
    const cats = (await a.client.get('/categories')).body.map((c: any) => c.name).sort();
    expect(cats).toEqual(expect.arrayContaining(['Rice', 'Snacks']));
    // The other business sees none of it, and its own SKU space is independent.
    expect((await b.client.get('/products')).body.total).toBe(0);
    expect(
      (await b.client.post('/products/import', { dryRun: true, rows: [rows[0]] })).body.errors,
    ).toEqual([]);
  });

  it('requires product.manage', async () => {
    const cashier = await addMember(app, a, 'CASHIER');
    expect((await cashier.client.post('/products/import', { dryRun: true, rows })).status).toBe(
      403,
    );
  });
});
