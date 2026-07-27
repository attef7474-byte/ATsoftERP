import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: ['*.pw.ts', '*.spec.ts', '*.test.ts'],
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
});
