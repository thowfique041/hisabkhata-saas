// Loaded before every e2e test file.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/hisabkhata_test?schema=public';
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.QUEUES_ENABLED = 'false';
process.env.SMTP_HOST = '';
process.env.STORAGE_DRIVER = 'local';
process.env.JWT_ACCESS_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';
process.env.APP_URL = 'http://localhost:3000';
process.env.API_URL = 'http://localhost:4000';
process.env.SSLCOMMERZ_STORE_ID = '';
process.env.SSLCOMMERZ_STORE_PASSWORD = '';
