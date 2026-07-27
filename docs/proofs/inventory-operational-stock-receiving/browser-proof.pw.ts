// Playwright Browser Proof — Operational Stock Receiving
// Run: npx playwright test docs/proofs/inventory-operational-stock-receiving/browser-proof.pw.ts --config=docs/proofs/inventory-operational-stock-receiving/playwright.config.ts

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000/admin/inventory/operational-receipts';

test.describe('Operational Stock Receiving', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
  });

  test('01 - List page renders', async ({ page }) => {
    await expect(page.locator('text=Operational Receipts')).toBeVisible();
  });

  test('02 - New button opens modal', async ({ page }) => {
    await page.click('text=New Receipt');
    await expect(page.locator('text=New Operational Receipt')).toBeVisible();
  });

  test('03 - Create reads Company lookup', async ({ page }) => {
    await page.click('text=New Receipt');
    // Verify F9 lookup components render
    await expect(page.locator('[class*="f9"]').first()).toBeAttached();
  });
});
