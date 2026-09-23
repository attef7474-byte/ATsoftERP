import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: 'browser-proof.pw.ts',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },
  timeout: 240000,
  retries: 0,
  workers: 1,
});