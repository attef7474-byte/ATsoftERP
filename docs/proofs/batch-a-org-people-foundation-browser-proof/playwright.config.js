const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testMatch: 'browser-proof.pw.ts',
  use: {
    headless: true,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
  timeout: 240000,
  retries: 0,
  workers: 1,
});
