/** @type {import('jest').Config} */
const base = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }] },
  // See test/shims/pdfkit.js
  moduleNameMapper: { '^pdfkit$': '<rootDir>/test/shims/pdfkit.js' },
  testEnvironment: 'node',
};
module.exports = {
  projects: [
    { ...base, displayName: 'unit', rootDir: __dirname, testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'e2e',
      rootDir: __dirname,
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
      setupFiles: ['<rootDir>/test/setup-env.ts'],
      testTimeout: 60000,
    },
  ],
};
