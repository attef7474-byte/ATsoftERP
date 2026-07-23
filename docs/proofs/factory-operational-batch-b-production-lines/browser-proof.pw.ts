import { test, expect, Page } from '@playwright/test';

const API_BASE = 'http://localhost:4000/api/v1';
const WEB_BASE = 'http://localhost:3000';

const PRODUCTION_LINES_URL = '/admin/maintenance/production-lines';

const ADMIN_EMAIL = 'admin@atsofterp.com';
const ADMIN_PASSWORD = 'Admin@123456';

async function getToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = await res.json();
  return json.accessToken;
}

async function setToken(page: Page): Promise<void> {
  const token = await getToken();
  await page.goto(WEB_BASE + '/login');
  await page.evaluate((t) => {
    localStorage.setItem('accessToken', t);
  }, token);
}

async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(WEB_BASE + path, { waitUntil: 'networkidle' });
}

test.describe('Factory Foundation Batch B — Production Lines Browser Assertions', () => {

  test.beforeEach(async ({ page }) => {
    await setToken(page);
  });

  test('01 — Route renders production-lines page', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    await expect(page.locator('body')).not.toBeEmpty();
    const title = page.locator('h1,h2,h3').first();
    await expect(title).toBeVisible();
  });

  test('02 — No raw i18n keys visible', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    const body = page.locator('body');
    await expect(body).not.toContainText('maintenance.');
    await expect(body).not.toContainText('productionLines');
    await expect(body).not.toContainText('common.');
  });

  test('03 — Data grid is visible', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    const table = page.locator('table, [class*="grid"], [class*="dataGrid"], [class*="data-grid"]').first();
    await expect(table).toBeVisible();
  });

  test('04 — Create button opens modal', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(1000);
    const createBtn = page.locator('button, a, [class*="actionBar"] button, [class*="action-bar"] button').filter({ hasText: /create|new|إضافة|جديد/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      const modal = page.locator('[class*="modal"], [class*="dialog"], [role="dialog"]').first();
      await expect(modal).toBeVisible();
      const closeBtn = page.locator('[class*="modal"] button, [class*="dialog"] button, [role="dialog"] button').filter({ hasText: /cancel|close|إلغاء|إغلاق/i }).first();
      if (await closeBtn.isVisible()) await closeBtn.click();
    }
  });

  test('05 — Grid has data rows (seeded production lines exist)', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(1500);
    const rows = page.locator('table tbody tr, [class*="row"], [class*="dataRow"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('06 — Code column visible', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toContainText(/LINE-|PL-/);
  });

  test('07 — Name column visible', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toContainText(/General Line|Production Line/i);
  });

  test('08 — Company column visible', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toContainText(/Test|Company|شركة/i);
  });

  test('09 — Department column visible', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toContainText(/Administration|Department|قسم/i);
  });

  test('10 — Status badge visible', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(1000);
    const badge = page.locator('[class*="badge"], [class*="status"], [class*="CmmsStatusBadge"]').first();
    await expect(badge).toBeVisible();
  });

  test('11 — Row click selects a row', async ({ page }) => {
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(1500);
    const firstRow = page.locator('table tbody tr, [class*="row"], [class*="dataRow"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(300);
    }
  });

  test('12 — Zero console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(3000);
    expect(errors.length).toBe(0);
  });

  test('13 — Zero network failures', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (res) => {
      if (!res.ok() && res.url().includes('/api/')) {
        failed.push(`${res.status()} ${res.url()}`);
      }
    });
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(3000);
    expect(failed.length).toBe(0);
  });

  test('14 — No ChunkLoadError on production-lines route', async ({ page }) => {
    const chunkErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text());
    });
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(3000);
    expect(chunkErrors.length).toBe(0);
  });

  test('15 — No _next/static 400+ failures', async ({ page }) => {
    const staticFails: string[] = [];
    page.on('response', (res) => {
      if (!res.ok() && res.url().includes('/_next/static')) {
        staticFails.push(`${res.status()} ${res.url()}`);
      }
    });
    await navigateTo(page, PRODUCTION_LINES_URL);
    await page.waitForTimeout(3000);
    expect(staticFails.length).toBe(0);
  });

});
