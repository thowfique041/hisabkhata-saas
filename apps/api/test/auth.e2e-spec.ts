import type { INestApplication } from '@nestjs/common';
import { Client, createApp, login, mail, prisma, registerOwner, unique } from './utils';

describe('Authentication', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('registers a user, creates their business and starts a session', async () => {
    const owner = await registerOwner(app, { businessName: 'Karim Electronics' });
    const session = await owner.client.get('/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.user.email).toBe(owner.email);
    expect(session.body.user.isSuperAdmin).toBe(false);
    expect(session.body.activeTenant.name).toBe('Karim Electronics');
    expect(session.body.activeTenant.role).toBe('Owner');
    expect(session.body.permissions).toContain('product.manage');
    expect(session.body.plan.code).toBe('BASIC');
    expect(session.body.plan.status).toBe('TRIALING');

    const user = await prisma(app).user.findUniqueOrThrow({ where: { email: owner.email } });
    expect(user.passwordHash).not.toContain('Passw0rd');
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    const sent = mail(app)
      .filter((m) => m.to === owner.email)
      .map((m) => m.template);
    expect(sent).toEqual(expect.arrayContaining(['verify-email', 'welcome']));
  });

  it('rejects duplicate emails and invalid input', async () => {
    const owner = await registerOwner(app);
    const c = new Client(app);
    const dup = await c.post('/auth/register', {
      name: 'X Y',
      email: owner.email,
      password: 'Another123',
      businessName: 'Dup',
    });
    expect(dup.status).toBe(409);
    const weak = await c.post('/auth/register', {
      name: 'X Y',
      email: `${unique()}@t.local`,
      password: 'short',
      businessName: 'Dup',
    });
    expect(weak.status).toBe(400);
    expect(weak.body.details.some((d: any) => d.path === 'password')).toBe(true);
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    const owner = await registerOwner(app);
    const ok = await login(app, owner.email, owner.password);
    expect((await ok.get('/auth/session')).status).toBe(200);

    const bad = await new Client(app).post('/auth/login', {
      email: owner.email,
      password: 'WrongPass1',
    });
    expect(bad.status).toBe(401);
    expect(bad.body.message).toBe('Invalid email or password');
    const unknown = await new Client(app).post('/auth/login', {
      email: 'nobody@nowhere.local',
      password: 'WrongPass1',
    });
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(bad.body.message);
  });

  it('locks the account after repeated failures', async () => {
    const owner = await registerOwner(app);
    for (let i = 0; i < 5; i++)
      await new Client(app).post('/auth/login', { email: owner.email, password: 'WrongPass1' });
    const locked = await new Client(app).post('/auth/login', {
      email: owner.email,
      password: owner.password,
    });
    expect(locked.status).toBe(401);
    expect(locked.body.message).toMatch(/Too many failed attempts/);
  });

  it('requires authentication for private endpoints', async () => {
    const c = new Client(app);
    expect((await c.get('/auth/session')).status).toBe(401);
    expect((await c.get('/products')).status).toBe(401);
    expect((await c.get('/dashboard')).status).toBe(401);
  });

  it('rejects cookie-authenticated writes without a CSRF token', async () => {
    const owner = await registerOwner(app);
    const res = await owner.client.agent.post('/api/categories').send({ name: 'No CSRF' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Invalid CSRF token');
  });

  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const owner = await registerOwner(app);
    const original = owner.client.cookies.hk_rt;
    expect(original).toBeTruthy();

    const first = await owner.client.post('/auth/refresh');
    expect(first.status).toBe(200);
    expect(owner.client.cookies.hk_rt).not.toBe(original);
    const tokens = await prisma(app).refreshToken.findMany({
      where: { userId: owner.userId },
      orderBy: { createdAt: 'asc' },
    });
    expect(tokens).toHaveLength(2);
    expect(tokens[0].revokedAt).not.toBeNull();
    expect(tokens[0].replacedById).toBe(tokens[1].id);
    expect(tokens.every((t) => t.tokenHash !== original)).toBe(true);

    // An attacker replays the stolen, already-rotated token after the concurrency grace window.
    await prisma(app).refreshToken.update({
      where: { id: tokens[0].id },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    const replay = await new Client(app).agent
      .post('/api/auth/refresh')
      .set('Cookie', [`hk_rt=${encodeURIComponent(original)}`, `hk_csrf=x`])
      .set('X-CSRF-Token', 'x');
    expect(replay.status).toBe(401);
    // The whole family is now revoked, so the legitimate session is forced to sign in again.
    expect(
      await prisma(app).refreshToken.count({ where: { userId: owner.userId, revokedAt: null } }),
    ).toBe(0);
    expect((await owner.client.post('/auth/refresh')).status).toBe(401);
  });

  it('keeps the session when two tabs refresh with the same token at once', async () => {
    const owner = await registerOwner(app);
    const token = owner.client.cookies.hk_rt;
    const send = () =>
      new Client(app).agent
        .post('/api/auth/refresh')
        .set('Cookie', [`hk_rt=${encodeURIComponent(token)}`, `hk_csrf=x`])
        .set('X-CSRF-Token', 'x');
    const [a, b] = await Promise.all([send(), send()]);
    expect([a.status, b.status]).toEqual([200, 200]);
    // A moment later the same (now rotated) token still works once more, e.g. a slow second tab.
    expect((await send()).status).toBe(200);
    // Nothing was revoked as theft: the session lives on.
    expect(
      await prisma(app).refreshToken.count({ where: { userId: owner.userId, revokedAt: null } }),
    ).toBeGreaterThan(0);
  });

  it('does not revive a session after logout', async () => {
    const owner = await registerOwner(app);
    const token = owner.client.cookies.hk_rt;
    expect((await owner.client.post('/auth/logout')).status).toBe(200);
    const replay = await new Client(app).agent
      .post('/api/auth/refresh')
      .set('Cookie', [`hk_rt=${encodeURIComponent(token)}`, `hk_csrf=x`])
      .set('X-CSRF-Token', 'x');
    expect(replay.status).toBe(401);
  });

  it('logs out and clears the session', async () => {
    const owner = await registerOwner(app);
    expect((await owner.client.post('/auth/logout')).status).toBe(200);
    expect((await owner.client.get('/auth/session')).status).toBe(401);
    expect((await owner.client.post('/auth/refresh')).status).toBe(401);
  });

  it('verifies email with the emailed token', async () => {
    const owner = await registerOwner(app);
    const msg = mail(app).find((m) => m.to === owner.email && m.template === 'verify-email')!;
    const token = new URL(msg.data.link).searchParams.get('token')!;
    expect((await new Client(app).post('/auth/verify-email', { token })).status).toBe(200);
    expect((await new Client(app).post('/auth/verify-email', { token })).status).toBe(400);
    const session = await owner.client.get('/auth/session');
    expect(session.body.user.emailVerified).toBe(true);
  });

  it('resets a forgotten password and revokes existing sessions', async () => {
    const owner = await registerOwner(app);
    const res = await new Client(app).post('/auth/forgot-password', { email: owner.email });
    expect(res.status).toBe(200);
    // Same response for unknown addresses: no account enumeration.
    const unknown = await new Client(app).post('/auth/forgot-password', {
      email: 'ghost@nowhere.local',
    });
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(res.body);

    const msg = mail(app).find((m) => m.to === owner.email && m.template === 'password-reset')!;
    const token = new URL(msg.data.link).searchParams.get('token')!;
    const reset = await new Client(app).post('/auth/reset-password', {
      token,
      password: 'BrandNew123',
    });
    expect(reset.status).toBe(200);
    expect(
      (await new Client(app).post('/auth/reset-password', { token, password: 'Again12345' }))
        .status,
    ).toBe(400);

    expect((await owner.client.post('/auth/refresh')).status).toBe(401);
    expect(
      (await new Client(app).post('/auth/login', { email: owner.email, password: owner.password }))
        .status,
    ).toBe(401);
    await login(app, owner.email, 'BrandNew123');
  });

  it('issues bearer tokens for API clients', async () => {
    const owner = await registerOwner(app);
    const res = await new Client(app).post('/auth/token', {
      email: owner.email,
      password: owner.password,
    });
    expect(res.status).toBe(200);
    const products = await new Client(app).agent
      .get('/api/products')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(products.status).toBe(200);
    const tampered = await new Client(app).agent
      .get('/api/products')
      .set('Authorization', `Bearer ${res.body.accessToken}x`);
    expect(tampered.status).toBe(401);
  });

  it('never exposes password hashes or tokens in responses', async () => {
    const owner = await registerOwner(app);
    const bodies = [
      await owner.client.get('/auth/session'),
      await owner.client.get('/profile'),
      await owner.client.get('/employees'),
    ].map((r) => JSON.stringify(r.body));
    for (const b of bodies) {
      expect(b).not.toMatch(/passwordHash|tokenHash|\$argon2/);
    }
  });
});
