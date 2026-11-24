import type { INestApplication } from '@nestjs/common';
import { Client, createApp, createProduct, login, mail, makeSuperAdmin, prisma, registerOwner, unique, type Owner } from './utils';

async function addMember(app: INestApplication, owner: Owner, roleKey: string) {
  const roles = (await owner.client.get('/roles')).body as any[];
  const role = roles.find((r) => r.systemKey === roleKey)!;
  const email = `${unique(roleKey.toLowerCase())}@test.local`;
  const res = await owner.client.post('/employees', { name: `${roleKey} Person`, email, roleId: role.id });
  expect(res.status).toBe(201);
  const invite = mail(app).find((m) => m.to === email && m.template === 'invite')!;
  const token = new URL(invite.data.link).searchParams.get('token')!;
  expect((await new Client(app).post('/auth/reset-password', { token, password: 'Member1234' })).status).toBe(200);
  return { client: await login(app, email, 'Member1234'), email, roleId: role.id };
}

describe('Roles and permissions', () => {
  let app: INestApplication;
  let owner: Owner;
  beforeAll(async () => {
    app = await createApp();
    owner = await registerOwner(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('creates the four built-in roles for every new business', async () => {
    const roles = (await owner.client.get('/roles')).body.map((r: any) => r.systemKey).sort();
    expect(roles).toEqual(['CASHIER', 'MANAGER', 'OWNER', 'STAFF']);
  });

  it('lets a cashier sell but not manage inventory, reports or staff', async () => {
    const product = await createProduct(owner.client);
    const cashier = await addMember(app, owner, 'CASHIER');
    const session = (await cashier.client.get('/auth/session')).body;
    expect(session.activeTenant.id).toBe(owner.tenantId);
    expect(session.permissions).toContain('sale.create');
    expect(session.permissions).not.toContain('product.manage');

    const sale = await cashier.client.post('/sales', { items: [{ productId: product.id, quantity: '1' }], payments: [{ method: 'CASH', amount: '100' }] });
    expect(sale.status).toBe(201);
    expect((await cashier.client.post('/products', { name: 'Nope', purchasePrice: '1', sellingPrice: '2' })).status).toBe(403);
    expect((await cashier.client.post('/inventory/adjustments', { productId: product.id, direction: 'IN', quantity: '1', reason: 'FOUND' })).status).toBe(403);
    expect((await cashier.client.get('/reports/sales')).status).toBe(403);
    expect((await cashier.client.get('/employees')).status).toBe(403);
    expect((await cashier.client.post(`/sales/${sale.body.id}/cancel`, {})).status).toBe(403);
    // Price overrides need product.manage.
    const override = await cashier.client.post('/sales', { items: [{ productId: product.id, quantity: '1', unitPrice: '1.00' }], payments: [{ method: 'CASH', amount: '1' }] });
    expect(override.status).toBe(403);
  });

  it('staff can only view products and stock', async () => {
    const staff = await addMember(app, owner, 'STAFF');
    expect((await staff.client.get('/products')).status).toBe(200);
    expect((await staff.client.get('/sales')).status).toBe(403);
    expect((await staff.client.get('/customers')).status).toBe(403);
  });

  it('prevents privilege escalation by managers', async () => {
    const manager = await addMember(app, owner, 'MANAGER');
    const roles = (await owner.client.get('/roles')).body as any[];
    const ownerRole = roles.find((r) => r.systemKey === 'OWNER');
    // Managers do not hold employee.manage by default, so they cannot invite anyone.
    expect((await manager.client.post('/employees', { name: 'Xavier', email: `${unique()}@t.local`, roleId: ownerRole.id })).status).toBe(403);
    // Even with employee.manage, a non-owner cannot grant the Owner role or permissions they lack.
    const managerRole = roles.find((r) => r.systemKey === 'MANAGER');
    await owner.client.put(`/roles/${managerRole.id}`, { name: 'Manager', permissions: [...managerRole.permissions, 'employee.manage'] });
    expect((await manager.client.post('/employees', { name: 'Xavier', email: `${unique()}@t.local`, roleId: ownerRole.id })).status).toBe(403);
    const custom = await manager.client.post('/roles', { name: 'Sneaky', permissions: ['subscription.manage'] });
    expect(custom.status).toBe(403);
  });

  it('removes access immediately when a member is disabled', async () => {
    const cashier = await addMember(app, owner, 'CASHIER');
    const members = (await owner.client.get('/employees')).body as any[];
    const m = members.find((x) => x.user.email === cashier.email);
    expect((await owner.client.patch(`/employees/${m.id}`, { status: 'DISABLED' })).status).toBe(200);
    expect((await cashier.client.get('/products')).status).toBe(403);
    expect((await cashier.client.post('/auth/refresh')).status).toBe(401);
  });

  it('keeps at least one owner', async () => {
    const members = (await owner.client.get('/employees')).body as any[];
    const self = members.find((x) => x.user.email === owner.email);
    expect((await owner.client.patch(`/employees/${self.id}`, { status: 'DISABLED' })).status).toBe(400);
  });

  it('supports custom roles with granular permissions', async () => {
    const role = await owner.client.post('/roles', { name: 'Stock keeper', permissions: ['product.view', 'stock.view', 'stock.adjust'] });
    expect(role.status).toBe(201);
    const email = `${unique('keeper')}@test.local`;
    await owner.client.post('/employees', { name: 'Keeper', email, roleId: role.body.id });
    const invite = mail(app).find((x) => x.to === email)!;
    await new Client(app).post('/auth/reset-password', { token: new URL(invite.data.link).searchParams.get('token'), password: 'Keeper1234' });
    const keeper = await login(app, email, 'Keeper1234');
    const product = await createProduct(owner.client);
    expect((await keeper.post('/inventory/adjustments', { productId: product.id, direction: 'IN', quantity: '2', reason: 'FOUND' })).status).toBe(201);
    expect((await keeper.post('/sales', { items: [{ productId: product.id, quantity: '1' }], payments: [] })).status).toBe(403);
  });
});

describe('Platform super admin', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('denies platform APIs to tenant owners', async () => {
    const owner = await registerOwner(app);
    for (const url of ['/admin/overview', '/admin/tenants', '/admin/users', '/admin/plans', '/admin/audit-logs', '/admin/jobs']) {
      expect((await owner.client.get(url)).status).toBe(403);
    }
    expect((await owner.client.patch(`/admin/tenants/${owner.tenantId}/status`, { status: 'ACTIVE' })).status).toBe(403);
  });

  it('re-checks the database, not just the token claim', async () => {
    const admin = await makeSuperAdmin(app);
    const fresh = await login(app, admin.email, admin.password);
    expect((await fresh.get('/admin/overview')).status).toBe(200);
    await prisma(app).user.update({ where: { id: admin.userId }, data: { isSuperAdmin: false } });
    expect((await fresh.get('/admin/overview')).status).toBe(403);
  });

  it('can suspend a tenant, which blocks its users', async () => {
    const admin = await makeSuperAdmin(app);
    const adminClient = await login(app, admin.email, admin.password);
    const owner = await registerOwner(app);
    expect((await owner.client.get('/products')).status).toBe(200);

    const list = await adminClient.get(`/admin/tenants?search=${encodeURIComponent((await owner.client.get('/auth/session')).body.activeTenant.slug)}`);
    expect(list.body.items[0].id).toBe(owner.tenantId);
    expect((await adminClient.patch(`/admin/tenants/${owner.tenantId}/status`, { status: 'SUSPENDED', reason: 'Test' })).status).toBe(200);
    const blocked = await owner.client.get('/products');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('TENANT_SUSPENDED');

    await adminClient.patch(`/admin/tenants/${owner.tenantId}/status`, { status: 'ACTIVE' });
    expect((await owner.client.get('/products')).status).toBe(200);
    const audit = await adminClient.get('/admin/audit-logs?search=admin.tenant');
    expect(audit.body.items.length).toBeGreaterThanOrEqual(2);
  });
});
