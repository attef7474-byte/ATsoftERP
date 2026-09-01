import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: 'browser-proof.pw.ts',
  use: {
    headless: true,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
    ignoreHTTPSErrors: true,
  },
  timeout: 240000,
  retries: 0,
  workers: 1,
});
