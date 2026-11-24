import type { INestApplication } from '@nestjs/common';
import { createApp, createProduct, prisma, registerOwner, type Owner } from './utils';

async function stockOf(app: INestApplication, id: string) {
  return (await prisma(app).product.findUniqueOrThrow({ where: { id } })).stock.toString();
}

async function ledgerMatches(app: INestApplication, id: string) {
  const p = await prisma(app).product.findUniqueOrThrow({ where: { id } });
  const agg = await prisma(app).stockMovement.aggregate({ where: { productId: id }, _sum: { quantity: true } });
  return p.stock.equals(agg._sum.quantity ?? 0);
}

describe('Inventory, purchases, sales and invoices', () => {
  let app: INestApplication;
  let o: Owner;
  beforeAll(async () => {
    app = await createApp();
    o = await registerOwner(app);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('products', () => {
    it('creates, reads, updates, archives and restores a product', async () => {
      const cat = (await o.client.post('/categories', { name: 'Beverages' })).body;
      const created = await o.client.post('/products', {
        name: 'Ispahani Tea 400g',
        purchasePrice: '210',
        sellingPrice: '240.50',
        categoryId: cat.id,
        openingStock: '12',
        minStock: '5',
        barcode: '8941100500110',
      });
      expect(created.status).toBe(201);
      expect(created.body.sku).toMatch(/^SKU-\d{5}$/);
      expect(created.body.sellingPrice).toBe('240.5');
      expect(created.body.stock).toBe('12');
      expect(created.body.stockMovements[0].type).toBe('OPENING');

      const id = created.body.id;
      expect((await o.client.patch(`/products/${id}`, { sellingPrice: '250' })).body.sellingPrice).toBe('250');
      expect((await o.client.get('/products/lookup?code=8941100500110')).body.id).toBe(id);
      expect((await o.client.get(`/products?search=ispahani`)).body.total).toBe(1);

      expect((await o.client.delete(`/products/${id}`)).body.updated).toBe(1);
      expect((await o.client.get(`/products?search=ispahani`)).body.total).toBe(0);
      expect((await o.client.get(`/products?search=ispahani&archived=true`)).body.total).toBe(1);
      expect((await o.client.post(`/products/${id}/restore`)).body.updated).toBe(1);
    });

    it('rejects duplicate SKUs, bad prices and float-style money', async () => {
      await createProduct(o.client, { sku: 'DUP-1' });
      expect((await o.client.post('/products', { name: 'X', sku: 'dup-1', purchasePrice: '1', sellingPrice: '1' })).status).toBe(409);
      expect((await o.client.post('/products', { name: 'X', purchasePrice: '-5', sellingPrice: '1' })).status).toBe(400);
      expect((await o.client.post('/products', { name: 'X', purchasePrice: '1.005', sellingPrice: '1' })).status).toBe(400);
    });

    it('filters low and out of stock', async () => {
      const low = await createProduct(o.client, { openingStock: '2', minStock: '5' });
      const out = await createProduct(o.client, { openingStock: '0', minStock: '1' });
      const lows = (await o.client.get('/products?stock=low&pageSize=100')).body.items.map((p: any) => p.id);
      const outs = (await o.client.get('/products?stock=out&pageSize=100')).body.items.map((p: any) => p.id);
      expect(lows).toContain(low.id);
      expect(lows).not.toContain(out.id);
      expect(outs).toContain(out.id);
    });
  });

  describe('stock adjustments', () => {
    it('records every change and prevents negative stock', async () => {
      const p = await createProduct(o.client, { openingStock: '5' });
      expect((await o.client.post('/inventory/adjustments', { productId: p.id, direction: 'IN', quantity: '3', reason: 'FOUND' })).body.stock).toBe('8');
      expect((await o.client.post('/inventory/adjustments', { productId: p.id, direction: 'OUT', quantity: '2.5', reason: 'DAMAGE' })).body.stock).toBe('5.5');
      const neg = await o.client.post('/inventory/adjustments', { productId: p.id, direction: 'OUT', quantity: '10', reason: 'LOST' });
      expect(neg.status).toBe(409);
      expect(neg.body.code).toBe('INSUFFICIENT_STOCK');
      expect(await stockOf(app, p.id)).toBe('5.5');
      const moves = (await o.client.get(`/inventory/movements?productId=${p.id}`)).body.items;
      expect(moves.map((m: any) => m.type)).toEqual(['ADJUSTMENT_OUT', 'ADJUSTMENT_IN', 'OPENING']);
      expect(moves[0].balanceAfter).toBe('5.5');
      expect(await ledgerMatches(app, p.id)).toBe(true);
    });

    it('allows negative stock only when the business enables it', async () => {
      const p = await createProduct(o.client, { openingStock: '1' });
      const settings = (await o.client.get('/tenant/settings')).body;
      expect((await o.client.put('/tenant/settings', { ...settings, allowNegativeStock: true })).status).toBe(200);
      expect((await o.client.post('/inventory/adjustments', { productId: p.id, direction: 'OUT', quantity: '3', reason: 'RECOUNT' })).status).toBe(201);
      expect(await stockOf(app, p.id)).toBe('-2');
      await o.client.put('/tenant/settings', { ...settings, allowNegativeStock: false });
    });
  });

  describe('purchases', () => {
    it('increases stock and tracks supplier dues', async () => {
      const supplier = (await o.client.post('/suppliers', { name: 'Meghna Traders', phone: '01712000111' })).body;
      const p1 = await createProduct(o.client, { openingStock: '0', purchasePrice: '100' });
      const p2 = await createProduct(o.client, { openingStock: '0' });
      const res = await o.client.post('/purchases', {
        supplierId: supplier.id,
        items: [
          { productId: p1.id, quantity: '10', unitCost: '95.50' },
          { productId: p2.id, quantity: '4', unitCost: '20' },
        ],
        discount: '5',
        shippingCost: '50',
        payments: [{ method: 'CASH', amount: '500' }],
      });
      expect(res.status).toBe(201);
      expect(res.body.purchaseNo).toMatch(/^PO-\d{7}$/);
      expect(res.body.subtotal).toBe('1035');
      expect(res.body.total).toBe('1080');
      expect(res.body.dueAmount).toBe('580');
      expect(res.body.paymentStatus).toBe('PARTIAL');
      expect(await stockOf(app, p1.id)).toBe('10');
      expect((await prisma(app).product.findUniqueOrThrow({ where: { id: p1.id } })).purchasePrice.toString()).toBe('95.5');

      const sup = (await o.client.get(`/suppliers/${supplier.id}`)).body;
      expect(sup.stats.payable).toBe('580.00');
      expect((await o.client.post(`/suppliers/${supplier.id}/payments`, { method: 'BANK', amount: '600' })).status).toBe(400);
      expect((await o.client.post(`/suppliers/${supplier.id}/payments`, { method: 'BANK', amount: '580' })).body.payableAfter).toBe('0.00');
    });

    it('reverses stock on cancellation, and refuses if goods were already sold', async () => {
      const supplier = (await o.client.post('/suppliers', { name: 'City Group' })).body;
      const p = await createProduct(o.client, { openingStock: '0' });
      const po = (await o.client.post('/purchases', { supplierId: supplier.id, items: [{ productId: p.id, quantity: '5', unitCost: '10' }], payments: [] })).body;
      expect(await stockOf(app, p.id)).toBe('5');
      const sold = (await o.client.post('/sales', { items: [{ productId: p.id, quantity: '4' }], payments: [{ method: 'CASH', amount: '400' }] })).body;
      expect((await o.client.post(`/purchases/${po.id}/cancel`, { reason: 'Wrong items' })).status).toBe(409);
      await o.client.post(`/sales/${sold.id}/cancel`, {});
      const cancelled = await o.client.post(`/purchases/${po.id}/cancel`, { reason: 'Wrong items' });
      expect(cancelled.status).toBe(201);
      expect(cancelled.body.status).toBe('CANCELLED');
      expect(await stockOf(app, p.id)).toBe('0');
      expect((await o.client.post(`/purchases/${po.id}/cancel`, {})).status).toBe(409);
      expect(await ledgerMatches(app, p.id)).toBe(true);
    });
  });

  describe('POS sales', () => {
    it('creates the sale, items, stock movements, payment and invoice in one transaction', async () => {
      const p = await createProduct(o.client, { openingStock: '10', sellingPrice: '120' });
      const customer = (await o.client.post('/customers', { name: 'Nusrat Jahan', phone: '01819876543' })).body;
      expect(customer.phone).toBe('+8801819876543');
      const res = await o.client.post('/sales', {
        customerId: customer.id,
        items: [{ productId: p.id, quantity: '3', discount: '10' }],
        discount: '20',
        taxRate: '5',
        payments: [{ method: 'BKASH', amount: '200', reference: 'TX123' }],
      });
      expect(res.status).toBe(201);
      const s = res.body;
      // 3 x 120 = 360, -10 line = 350, -20 order = 330, +5% = 16.50 => 346.50
      expect(s.subtotal).toBe('350');
      expect(s.tax).toBe('16.5');
      expect(s.total).toBe('346.5');
      expect(s.paidAmount).toBe('200');
      expect(s.dueAmount).toBe('146.5');
      expect(s.paymentStatus).toBe('PARTIAL');
      expect(s.invoice.invoiceNo).toBe(s.invoiceNo);
      expect(s.items[0].unitCost).toBe('80');
      expect(await stockOf(app, p.id)).toBe('7');
      const moves = await prisma(app).stockMovement.findMany({ where: { referenceId: s.id } });
      expect(moves).toHaveLength(1);
      expect(moves[0].quantity.toString()).toBe('-3');

      const pay = await o.client.post(`/sales/${s.id}/payments`, { method: 'CASH', amount: '146.50' });
      expect(pay.body.paymentStatus).toBe('PAID');
      expect(pay.body.payments).toHaveLength(2);
    });

    it('returns change for cash over-payment and rejects non-cash over-payment', async () => {
      const p = await createProduct(o.client, { sellingPrice: '45' });
      const cash = await o.client.post('/sales', { items: [{ productId: p.id, quantity: '1' }], payments: [{ method: 'CASH', amount: '100' }] });
      expect(cash.body.change).toBe('55.00');
      expect(cash.body.paidAmount).toBe('45');
      const card = await o.client.post('/sales', { items: [{ productId: p.id, quantity: '1' }], payments: [{ method: 'CARD', amount: '100' }] });
      expect(card.status).toBe(400);
    });

    it('requires a customer for credit sales and rejects insufficient stock atomically', async () => {
      const p = await createProduct(o.client, { openingStock: '2' });
      const other = await createProduct(o.client, { openingStock: '50' });
      expect((await o.client.post('/sales', { items: [{ productId: p.id, quantity: '1' }], payments: [] })).status).toBe(400);
      const before = await prisma(app).sale.count({ where: { tenantId: o.tenantId } });
      const res = await o.client.post('/sales', {
        items: [
          { productId: other.id, quantity: '5' },
          { productId: p.id, quantity: '3' },
        ],
        payments: [{ method: 'CASH', amount: '10000' }],
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
      // Nothing from the failed sale persisted, not even the other line's stock decrement.
      expect(await stockOf(app, other.id)).toBe('50');
      expect(await prisma(app).sale.count({ where: { tenantId: o.tenantId } })).toBe(before);
    });

    it('never oversells under concurrent checkouts', async () => {
      const p = await createProduct(o.client, { openingStock: '3', sellingPrice: '10' });
      const attempts = await Promise.all(
        Array.from({ length: 8 }, () => o.client.post('/sales', { items: [{ productId: p.id, quantity: '1' }], payments: [{ method: 'CASH', amount: '10' }] })),
      );
      const ok = attempts.filter((r) => r.status === 201);
      expect(ok).toHaveLength(3);
      expect(attempts.filter((r) => r.status === 409)).toHaveLength(5);
      expect(await stockOf(app, p.id)).toBe('0');
      expect(new Set(ok.map((r) => r.body.invoiceNo)).size).toBe(3);
      expect(await ledgerMatches(app, p.id)).toBe(true);
    });

    it('is idempotent for retried checkouts', async () => {
      const p = await createProduct(o.client, { openingStock: '5' });
      const body = { items: [{ productId: p.id, quantity: '1' }], payments: [{ method: 'CASH', amount: '100' }], idempotencyKey: 'pos-retry-0001' };
      const [r1, r2] = await Promise.all([o.client.post('/sales', body), o.client.post('/sales', body)]);
      expect([r1.status, r2.status].sort()).toEqual([201, 201]);
      expect(r1.body.id).toBe(r2.body.id);
      expect(await stockOf(app, p.id)).toBe('4');
    });

    it('numbers invoices sequentially per tenant', async () => {
      const p = await createProduct(o.client, { openingStock: '5' });
      const nums: string[] = [];
      for (let i = 0; i < 3; i++) nums.push((await o.client.post('/sales', { items: [{ productId: p.id, quantity: '1' }], payments: [{ method: 'CASH', amount: '100' }] })).body.invoiceNo);
      const seq = nums.map((n) => Number(n.slice(-5)));
      expect(seq[1]).toBe(seq[0] + 1);
      expect(seq[2]).toBe(seq[1] + 1);
      const other = await registerOwner(app);
      const op = await createProduct(other.client);
      const first = (await other.client.post('/sales', { items: [{ productId: op.id, quantity: '1' }], payments: [{ method: 'CASH', amount: '100' }] })).body.invoiceNo;
      expect(first.endsWith('00001')).toBe(true);
    });

    it('handles partial refunds against dues, then full refund, restocking each time', async () => {
      const p = await createProduct(o.client, { openingStock: '10', sellingPrice: '100' });
      const c = (await o.client.post('/customers', { name: 'Refund Customer' })).body;
      const sale = (await o.client.post('/sales', { customerId: c.id, items: [{ productId: p.id, quantity: '4' }], payments: [{ method: 'CASH', amount: '300' }] })).body;
      expect(sale.dueAmount).toBe('100');
      const r1 = await o.client.post(`/sales/${sale.id}/refunds`, { items: [{ saleItemId: sale.items[0].id, quantity: '2' }], method: 'CASH' });
      expect(r1.status).toBe(201);
      expect(r1.body.refundValue).toBe('200.00');
      expect(r1.body.cashBack).toBe('100.00'); // 100 cleared the due, 100 paid back
      expect(r1.body.status).toBe('PARTIALLY_REFUNDED');
      expect(r1.body.dueAmount).toBe('0');
      expect(await stockOf(app, p.id)).toBe('8');
      expect((await o.client.post(`/sales/${sale.id}/refunds`, { items: [{ saleItemId: sale.items[0].id, quantity: '3' }] })).status).toBe(400);
      const r2 = await o.client.post(`/sales/${sale.id}/refunds`, { items: [{ saleItemId: sale.items[0].id, quantity: '2' }] });
      expect(r2.body.status).toBe('REFUNDED');
      expect(r2.body.refundedAmount).toBe('400');
      expect(r2.body.paidAmount).toBe('0');
      expect(await stockOf(app, p.id)).toBe('10');
      expect((await o.client.post(`/sales/${sale.id}/cancel`, {})).status).toBe(400);
    });

    it('cancels a sale, restocks and refunds what was paid', async () => {
      const p = await createProduct(o.client, { openingStock: '5' });
      const sale = (await o.client.post('/sales', { items: [{ productId: p.id, quantity: '2' }], payments: [{ method: 'CASH', amount: '200' }] })).body;
      const res = await o.client.post(`/sales/${sale.id}/cancel`, { reason: 'Customer changed mind' });
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.payments.find((x: any) => x.direction === 'OUT').amount).toBe('200');
      expect(await stockOf(app, p.id)).toBe('5');
      expect((await o.client.post(`/sales/${sale.id}/cancel`, {})).status).toBe(409);
    });
  });

  describe('customers', () => {
    it('allocates a due payment to the oldest invoices first and builds a statement', async () => {
      const p = await createProduct(o.client, { openingStock: '20', sellingPrice: '100' });
      const c = (await o.client.post('/customers', { name: 'Kamrul Islam', phone: '+447700900123' })).body;
      expect(c.phone).toBe('+447700900123');
      const s1 = (await o.client.post('/sales', { customerId: c.id, items: [{ productId: p.id, quantity: '2' }], payments: [] })).body;
      const s2 = (await o.client.post('/sales', { customerId: c.id, items: [{ productId: p.id, quantity: '3' }], payments: [{ method: 'CASH', amount: '100' }] })).body;
      expect((await o.client.get(`/customers/${c.id}`)).body.stats.outstanding).toBe('400.00');
      const pay = await o.client.post(`/customers/${c.id}/payments`, { method: 'NAGAD', amount: '250' });
      expect(pay.body.applied.map((a: any) => [a.saleId, a.amount])).toEqual([
        [s1.id, '200.00'],
        [s2.id, '50.00'],
      ]);
      const st = (await o.client.get(`/customers/${c.id}/statement`)).body;
      expect(st.closing).toBe('150.00');
      const csv = await o.client.get(`/customers/${c.id}/statement?format=csv`);
      expect(csv.headers['content-type']).toMatch(/text\/csv/);
      expect(csv.text).toContain('Invoice');
    });

    it('validates Bangladesh and international phone numbers', async () => {
      expect((await o.client.post('/customers', { name: 'Bad', phone: '0171' })).status).toBe(400);
      expect((await o.client.post('/customers', { name: 'Bad', phone: '01212345678' })).status).toBe(400);
      expect((await o.client.post('/customers', { name: 'Ok', phone: '8801912345678' })).body.phone).toBe('+8801912345678');
    });
  });

  describe('invoices', () => {
    it('renders a PDF and queues an email with the PDF attached', async () => {
      const p = await createProduct(o.client, { name: 'চাল (Rice) 1 kg', openingStock: '5' });
      const c = (await o.client.post('/customers', { name: 'Shirin Akter', email: 'shirin@test.local' })).body;
      const sale = (await o.client.post('/sales', { customerId: c.id, items: [{ productId: p.id, quantity: '1' }], payments: [{ method: 'CASH', amount: '100' }] })).body;
      const pdf = await o.client.agent.get(`/api/invoices/${sale.id}/pdf`).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (d: Buffer) => chunks.push(d));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(pdf.status).toBe(200);
      expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

      const email = await o.client.post(`/invoices/${sale.id}/email`, {});
      expect(email.body.to).toBe('shirin@test.local');
      const { MailService } = await import('../src/modules/mail/mail.service');
      const sent = app.get(MailService).outbox.find((m) => m.template === 'invoice' && m.to === 'shirin@test.local');
      expect(sent?.data.invoiceNo).toBe(sale.invoiceNo);
      const inv = await prisma(app).invoice.findUniqueOrThrow({ where: { saleId: sale.id } });
      expect(inv.emailedTo).toBe('shirin@test.local');
    });
  });

  describe('expenses, reports and dashboard', () => {
    it('computes revenue, gross profit, expenses and net profit consistently', async () => {
      const fresh = await registerOwner(app);
      const p = await createProduct(fresh.client, { openingStock: '10', purchasePrice: '60', sellingPrice: '100' });
      await fresh.client.post('/sales', { items: [{ productId: p.id, quantity: '5' }], taxRate: '10', payments: [{ method: 'CASH', amount: '550' }] });
      const cat = (await fresh.client.get('/expense-categories')).body.find((c: any) => c.name === 'Rent');
      expect((await fresh.client.post('/expenses', { categoryId: cat.id, amount: '50', expenseDate: new Date().toISOString(), description: 'Rent' })).status).toBe(201);
      expect((await fresh.client.post('/expenses', { categoryId: cat.id, amount: '0', expenseDate: new Date().toISOString() })).status).toBe(400);

      const pl = (await fresh.client.get('/reports/profit-loss')).body;
      const v = Object.fromEntries(pl.summary.map((s: any) => [s.label, s.value]));
      expect(v['Net revenue']).toBe('500.00');
      expect(v['Gross profit']).toBe('200.00');
      expect(v['Expenses']).toBe('50.00');
      expect(v['Net profit']).toBe('150.00');

      const dash = (await fresh.client.get('/dashboard')).body;
      expect(dash.kpis.salesToday).toBe('550.00');
      expect(dash.kpis.revenueThisMonth).toBe('500.00');
      expect(dash.kpis.netProfitThisMonth).toBe('150.00');
      expect(dash.salesChart).toHaveLength(30);
      expect(dash.revenueChart).toHaveLength(12);
      expect(dash.topProducts[0].productId).toBe(p.id);

      const csv = await fresh.client.get('/reports/sales?format=csv');
      expect(csv.text.split('\r\n')[0]).toContain('Gross sales');
    });
  });
});
