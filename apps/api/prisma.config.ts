import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Migrations use the direct (non-pooled) URL. On Neon, DATABASE_URL is the pooled endpoint.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '',
  },
});
