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

const PAGES = [
  { path: '/admin/production/shifts', keyPrefix: 'production.', code: /PS-/ },
  { path: '/admin/production/shift-templates', keyPrefix: 'production.', code: /PST-/ },
  { path: '/admin/production/shift-calendars', keyPrefix: 'production.', code: /PSC-/ },
  { path: '/admin/production/shift-assignments', keyPrefix: 'production.', code: /PSA-/ },
  { path: '/admin/production/operational-assignments', keyPrefix: 'production.', code: /POA-/ },
];

test.describe('Production Shifts & Assignments Browser Proof', () => {
  for (const pg of PAGES) {
    test(`Page loads clean: ${pg.path}`, async ({ page }) => {
      const errors = []; const failed = []; const chunkErrors = []; const staticFails = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text()); });
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('response', (res) => { if (!res.ok() && res.url().includes('/api/')) failed.push(`${res.url()} => ${res.status()}`); if (!res.ok() && res.url().includes('/_next/static')) staticFails.push(`${res.status()}`); });

      await navigateTo(page, pg.path);
      await page.waitForTimeout(4000);

      await expect(page.locator('body')).not.toBeEmpty();
      await expect(page.locator('h1,h2,h3').first()).toBeVisible();
      await expect(page.locator('body')).not.toContainText(pg.keyPrefix);
      await expect(page.locator('body')).not.toContainText('common.create');
      await expect(page.locator('body')).not.toContainText('common.select');
      await expect(page.locator('table, [class*="grid"], [class*="dataGrid"]').first()).toBeVisible();
      await expect(page.locator('body')).toContainText(pg.code);

      expect(errors.length).toBe(0);
      expect(chunkErrors.length).toBe(0);
      expect(staticFails.length).toBe(0);
    });
  }

  test('Shifts — create through the real UI flow (name -> save -> auto code in grid)', async ({ page }) => {
    const errors = []; const failed = []; const chunkErrors = []; const staticFails = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('response', (res) => { if (!res.ok() && res.url().includes('/api/')) failed.push(`${res.url()} => ${res.status()}`); if (!res.ok() && res.url().includes('/_next/static')) staticFails.push(`${res.status()}`); });

    const name = `Browser Proof Shift ${Date.now()}`;
    await navigateTo(page, '/admin/production/shifts');
    await page.waitForTimeout(3000);

    const createBtn = page.locator('button, a').filter({ hasText: /create|new|إضافة|جديد|إنشاء|انشاء/i }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await page.waitForTimeout(600);

    const modal = page.locator('[class*="modal"], [class*="dialog"], [role="dialog"]').first();
    await expect(modal).toBeVisible();
    await expect(page.locator('body')).toContainText(/auto|تلقائي/i);

    const nameInput = modal.locator('input').nth(1);
    await nameInput.fill(name);
    const saveBtn = modal.locator('button').filter({ hasText: /save|حفظ/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(2500);

    await expect(page.locator('body')).toContainText(name);
    await expect(page.locator('body')).toContainText(/PS-/);

    const login = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
    const token = (await login.json()).accessToken;
    const list = await (await fetch(`${API_BASE}/production/shifts?search=${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const created = list.data?.[0];
    if (created?.id) {
      await fetch(`${API_BASE}/production/shifts/${created.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    }

    expect(errors.length).toBe(0);
    expect(chunkErrors.length).toBe(0);
    expect(staticFails.length).toBe(0);
  });
});
