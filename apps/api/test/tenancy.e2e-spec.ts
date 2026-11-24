import type { INestApplication } from '@nestjs/common';
import { createApp, createProduct, prisma, registerOwner, type Owner } from './utils';
import { tenantScope, CrossTenantWriteError } from '../src/prisma/tenant-scope.extension';

/**
 * Cross-tenant isolation. Tenant B tries every way we can think of to read or modify Tenant A's
 * data. Each attempt must fail without revealing whether the record exists.
 */
describe('Multi-tenant isolation', () => {
  let app: INestApplication;
  let a: Owner;
  let b: Owner;
  let productA: any;
  let customerA: any;
  let saleA: any;

  beforeAll(async () => {
    app = await createApp();
    a = await registerOwner(app, { businessName: 'Tenant A Store' });
    b = await registerOwner(app, { businessName: 'Tenant B Store' });
    productA = await createProduct(a.client, { name: 'A-only product', sku: 'A-ONLY-1', barcode: '111222333' });
    customerA = (await a.client.post('/customers', { name: 'A Customer', phone: '01711000000', email: 'a.customer@test.local' })).body;
    saleA = (
      await a.client.post('/sales', {
        customerId: customerA.id,
        items: [{ productId: productA.id, quantity: '1' }],
        payments: [{ method: 'CASH', amount: '50' }],
      })
    ).body;
    expect(saleA.invoiceNo).toBeTruthy();
  });
  afterAll(async () => {
    await app.close();
  });

  it('isolates tenants that share SKU and barcode values', async () => {
    const same = await b.client.post('/products', { name: 'B product', sku: 'A-ONLY-1', barcode: '111222333', purchasePrice: '1', sellingPrice: '2' });
    expect(same.status).toBe(201);
  });

  it('does not list another tenant’s records', async () => {
    const products = await b.client.get('/products?search=A-only');
    expect(products.body.items.find((p: any) => p.id === productA.id)).toBeUndefined();
    const customers = await b.client.get('/customers');
    expect(customers.body.items.find((c: any) => c.id === customerA.id)).toBeUndefined();
    const sales = await b.client.get('/sales');
    expect(sales.body.items).toHaveLength(0);
    const invoices = await b.client.get('/invoices');
    expect(invoices.body.items).toHaveLength(0);
    const movements = await b.client.get(`/inventory/movements?productId=${productA.id}`);
    expect(movements.body.items).toHaveLength(0);
  });

  it('returns 404 for direct reads by id', async () => {
    expect((await b.client.get(`/products/${productA.id}`)).status).toBe(404);
    expect((await b.client.get(`/customers/${customerA.id}`)).status).toBe(404);
    expect((await b.client.get(`/customers/${customerA.id}/statement`)).status).toBe(404);
    expect((await b.client.get(`/sales/${saleA.id}`)).status).toBe(404);
    expect((await b.client.get(`/products/lookup?code=111222333`)).body.id).not.toBe(productA.id);
  });

  it('refuses to download another tenant’s invoice PDF', async () => {
    const own = await a.client.get(`/invoices/${saleA.id}/pdf`);
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toBe('application/pdf');
    const other = await b.client.get(`/invoices/${saleA.id}/pdf`);
    expect(other.status).toBe(404);
    const email = await b.client.post(`/invoices/${saleA.id}/email`, { to: 'x@test.local' });
    expect(email.status).toBe(404);
  });

  it('prevents updates, deletes and stock changes on another tenant’s product', async () => {
    expect((await b.client.patch(`/products/${productA.id}`, { name: 'hijacked' })).status).toBe(404);
    expect((await b.client.delete(`/products/${productA.id}`)).body.updated ?? 0).toBe(0);
    const adj = await b.client.post('/inventory/adjustments', { productId: productA.id, direction: 'OUT', quantity: '1', reason: 'LOST' });
    expect(adj.status).toBe(404);
    const bulk = await b.client.post('/products/bulk', { ids: [productA.id], action: 'archive' });
    expect(bulk.body.updated).toBe(0);
    const fresh = await prisma(app).product.findUniqueOrThrow({ where: { id: productA.id } });
    expect(fresh.name).toBe('A-only product');
    expect(fresh.archivedAt).toBeNull();
    expect(fresh.stock.toString()).toBe('9');
  });

  it('cannot sell, buy or invoice using another tenant’s products or parties', async () => {
    const sale = await b.client.post('/sales', { items: [{ productId: productA.id, quantity: '1' }], payments: [{ method: 'CASH', amount: '100' }] });
    expect(sale.status).toBe(400);
    const credit = await b.client.post('/sales', {
      customerId: customerA.id,
      items: [{ productId: (await createProduct(b.client)).id, quantity: '1' }],
      payments: [],
    });
    expect(credit.status).toBe(400);
    const pay = await b.client.post(`/sales/${saleA.id}/payments`, { method: 'CASH', amount: '10' });
    expect(pay.status).toBe(404);
    const refund = await b.client.post(`/sales/${saleA.id}/refunds`, { items: [{ saleItemId: saleA.items[0].id, quantity: '1' }] });
    expect(refund.status).toBe(404);
    const cancel = await b.client.post(`/sales/${saleA.id}/cancel`, {});
    expect(cancel.status).toBe(404);
  });

  it('cannot switch into a business the user does not belong to', async () => {
    const res = await b.client.post('/auth/switch-tenant', { tenantId: a.tenantId });
    expect(res.status).toBe(403);
  });

  it('ignores tenantId supplied in request bodies', async () => {
    const res = await b.client.post('/categories', { name: 'Injected', tenantId: a.tenantId });
    expect(res.status).toBe(201);
    const row = await prisma(app).category.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.tenantId).toBe(b.tenantId);
  });

  it('blocks cross-tenant file access', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a0f90000000049454e44ae426082', 'hex');
    const up = await a.client.agent.post('/api/files?kind=PRODUCT_IMAGE').set('X-CSRF-Token', a.client.csrf).attach('file', png, 'p.png');
    expect(up.status).toBe(201);
    expect((await a.client.get(`/files/${up.body.id}/content`)).status).toBe(200);
    expect((await b.client.get(`/files/${up.body.id}/content`)).status).toBe(403);
    // B cannot attach A's image to its own product either.
    const steal = await b.client.post('/products', { name: 'Steal', purchasePrice: '1', sellingPrice: '1', imageId: up.body.id });
    expect(steal.status).toBe(400);
  });

  it('rejects disguised uploads', async () => {
    const fake = Buffer.from('<script>alert(1)</script>');
    const up = await a.client.agent.post('/api/files?kind=PRODUCT_IMAGE').set('X-CSRF-Token', a.client.csrf).attach('file', fake, { filename: 'x.png', contentType: 'image/png' });
    expect(up.status).toBe(400);
  });

  it('keeps dashboards and reports separate', async () => {
    const dashA = await a.client.get('/dashboard');
    const dashB = await b.client.get('/dashboard');
    expect(dashA.body.kpis.totalCustomers).toBe(1);
    expect(dashB.body.kpis.totalCustomers).toBe(0);
    expect(dashB.body.recentSales).toHaveLength(0);
    const inv = await b.client.get('/reports/inventory');
    expect(inv.body.rows.find((r: any) => r.name === 'A-only product')).toBeUndefined();
  });

  describe('tenant-scope Prisma extension (defence in depth)', () => {
    it('constrains reads and stamps writes with the scoped tenant', async () => {
      const db = prisma(app).$extends(tenantScope(b.tenantId));
      expect(await db.product.findFirst({ where: { id: productA.id } })).toBeNull();
      expect(await db.product.count({ where: { id: productA.id } })).toBe(0);
      const res = await db.product.updateMany({ where: { id: productA.id }, data: { name: 'x' } });
      expect(res.count).toBe(0);
      await expect(db.category.create({ data: { tenantId: a.tenantId, name: 'Smuggled' } })).rejects.toBeInstanceOf(CrossTenantWriteError);
    });
  });
});
