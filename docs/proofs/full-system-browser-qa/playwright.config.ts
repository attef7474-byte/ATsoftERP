import { defineConfig } from '@playwright/test';
export default defineConfig({
  testMatch: '*.pw.ts',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    viewport: { width: 1280, height: 720 },
  },
  timeout: 90000,
  retries: 0,
  workers: 1,
});
