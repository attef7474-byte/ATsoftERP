import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:4000/api/v1';
const WEB_BASE = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@atsofterp.com';
const ADMIN_PASSWORD = 'Admin@123456';

async function navigateTo(page, path) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const { accessToken } = await res.json();
  await page.addInitScript((t) => { localStorage.setItem('accessToken', t); }, accessToken);
  await page.goto(WEB_BASE + path, { waitUntil: 'load', timeout: 120000 });
}

test.describe('Factory Maintenance Browser Proof', () => {

  test('Machine Categories — all assertions', async ({ page }) => {
    const errors = []; const failed = []; const chunkErrors = []; const staticFails = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('response', (res) => { if (!res.ok() && res.url().includes('/api/')) failed.push(`${res.status()}`); if (!res.ok() && res.url().includes('/_next/static')) staticFails.push(`${res.status()}`); });

    await navigateTo(page, '/admin/maintenance/machine-categories');
    await page.waitForTimeout(3000);

    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('h1,h2,h3').first()).toBeVisible();
    // No raw i18n keys
    await expect(page.locator('body')).not.toContainText('machineCategories.');
    await expect(page.locator('body')).not.toContainText('common.add');
    await expect(page.locator('body')).not.toContainText('common.select');
    // Grid visible
    await expect(page.locator('table, [class*="grid"], [class*="dataGrid"]').first()).toBeVisible();
    // MCAT- code present
    await expect(page.locator('body')).toContainText(/MCAT-/);
    // Create dialog opens and shows auto-code message
    const createBtn = page.locator('button, a').filter({ hasText: /create|new|إضافة|جديد/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      const modal = page.locator('[class*="modal"], [class*="dialog"], [role="dialog"]').first();
      await expect(modal).toBeVisible();
      await expect(page.locator('body')).toContainText(/auto|تلقائي/i);
    }
    // Zero errors
    expect(errors.length).toBe(0);
    expect(chunkErrors.length).toBe(0);
    expect(staticFails.length).toBe(0);
  });

  test('Spare Parts — all assertions', async ({ page }) => {
    const errors = []; const failed = []; const chunkErrors = []; const staticFails = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('response', (res) => { if (!res.ok() && res.url().includes('/api/')) failed.push(`${res.status()}`); if (!res.ok() && res.url().includes('/_next/static')) staticFails.push(`${res.status()}`); });

    await navigateTo(page, '/admin/maintenance/spare-parts');
    await page.waitForTimeout(3000);

    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('h1,h2,h3').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('spareParts.');
    await expect(page.locator('body')).not.toContainText('common.add');
    await expect(page.locator('body')).not.toContainText('common.select');
    await expect(page.locator('table, [class*="grid"], [class*="dataGrid"]').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/SP-/);
    const createBtn = page.locator('button, a').filter({ hasText: /create|new|إضافة|جديد/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('[class*="modal"], [class*="dialog"], [role="dialog"]').first()).toBeVisible();
      await expect(page.locator('body')).toContainText(/auto|تلقائي/i);
    }
    expect(errors.length).toBe(0);
    expect(chunkErrors.length).toBe(0);
    expect(staticFails.length).toBe(0);
  });

  test('Maintenance Personnel — all assertions', async ({ page }) => {
    const errors = []; const failed = []; const chunkErrors = []; const staticFails = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('response', (res) => { if (!res.ok() && res.url().includes('/api/')) failed.push(`${res.status()}`); if (!res.ok() && res.url().includes('/_next/static')) staticFails.push(`${res.status()}`); });

    await navigateTo(page, '/admin/maintenance/personnel');
    await page.waitForTimeout(3000);

    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('h1,h2,h3').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('maintenancePersonnel.');
    await expect(page.locator('body')).not.toContainText('common.add');
    await expect(page.locator('body')).not.toContainText('common.select');
    await expect(page.locator('table, [class*="grid"], [class*="dataGrid"]').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/MP-/);
    await expect(page.locator('body')).toContainText(/user|account|مستخدم/i);
    await expect(page.locator('body')).toContainText(/linked|unlinked|مرتبط|غير/i);
    const createBtn = page.locator('button, a').filter({ hasText: /create|new|إضافة|جديد/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('[class*="modal"], [class*="dialog"], [role="dialog"]').first()).toBeVisible();
      await expect(page.locator('body')).toContainText(/auto|تلقائي/i);
    }
    expect(errors.length).toBe(0);
    expect(chunkErrors.length).toBe(0);
    expect(staticFails.length).toBe(0);
  });
});
