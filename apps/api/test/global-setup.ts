import { execSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';

/** Recreates the test database schema, applies migrations and seeds reference data (no demo data). */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/hisabkhata_test?schema=public';
  if (!/localhost|127\.0\.0\.1|@postgres:/.test(url)) throw new Error('Refusing to reset a non-local test database');
  const client = new Client({ connectionString: url.split('?')[0] });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await client.end();

  const cwd = path.resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url, SEED_DEMO_DATA: 'false', NODE_ENV: 'test', JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing', QUEUES_ENABLED: 'false' };
  execSync('node --no-warnings scripts/prisma-wasm.mjs deploy', { cwd, env, stdio: 'pipe' });
  execSync('npx ts-node --transpile-only prisma/seed.ts', { cwd, env, stdio: 'pipe' });
}
