import { test, expect } from '@playwright/test';

const API_ORIGIN = 'http://localhost:4000/api/v1';
const WEB_BASE = 'http://localhost:3000';
const REWRITE_TO = 'http://localhost:4010/api/v1';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD environment variables are required');
}

let cachedToken: string | null = null;
async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${REWRITE_TO}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = await res.json() as { accessToken?: string };
  if (!json.accessToken) throw new Error(`login failed status=${res.status}`);
  cachedToken = json.accessToken;
  return cachedToken;
}

async function navigateTo(page, path, lang: 'ar' | 'en') {
  const accessToken = await getToken();
  await page.addInitScript(({ token, locale }) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('locale', locale);
  }, { token: accessToken, locale: lang });
  await page.route('**localhost:4000/api/v1/**', (route) => {
    const url = route.request().url().replace(API_ORIGIN, REWRITE_TO);
    route.continue({ url });
  });
  await page.goto(WEB_BASE + path, { waitUntil: 'load', timeout: 120000 });
}

function attachErrorWatchers(page) {
  const errors = []; const failed = []; const chunkErrors = []; const staticFails = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('response', (res) => { if (!res.ok() && res.url().includes('/api/')) failed.push(`${res.url()} => ${res.status()}`); if (!res.ok() && res.url().includes('/_next/static')) staticFails.push(`${res.status()}`); });
  return { errors, failed, chunkErrors, staticFails };
}

const PAGES = [
  '/admin/production/orders',
  '/admin/production/capacity-standards',
  '/admin/production/runs',
  '/admin/production/measurement-points',
  '/admin/production/downtime',
  '/admin/production/loss-reasons',
  '/admin/production/losses',
  '/admin/production/material-documents',
  '/admin/production/material-requirements',
  '/admin/production/finished-goods-receipts',
  '/admin/production/performance-targets',
  '/admin/production/quality/plans',
  '/admin/production/quality/inspections',
  '/admin/production/quality/ncrs',
  '/admin/production/analytics',
];

test.describe('P1 Closeout Production Browser Proof (clone web -> clone API 4010)', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (const path of PAGES) {
      test(`Page renders clean ${lang} ${path}`, async ({ page }) => {
        const w = attachErrorWatchers(page);
        await navigateTo(page, path, lang);
        await page.waitForTimeout(4000);

        await expect(page.locator('body')).not.toBeEmpty();
        await expect(page.locator('h1,h2,h3').first()).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

        const bodyText = await page.locator('body').innerText();
        expect(bodyText).not.toContain('common.create');
        expect(bodyText).not.toContain('production.orders.title');

        expect(w.errors.length).toBe(0);
        expect(w.chunkErrors.length).toBe(0);
        expect(w.staticFails.length).toBe(0);
      });
    }
  }

  test('Loss reasons — create through real UI flow -> grid persists', async ({ page }) => {
    const w = attachErrorWatchers(page);
    const code = `PLR-BR-${Date.now()}`;
    const name = `Browser Proof Reason ${Date.now()}`;
    await navigateTo(page, '/admin/production/loss-reasons', 'ar');
    await page.waitForTimeout(3000);

    const createBtn = page.locator('.admin-actionbar .admin-action-btn').first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await page.waitForTimeout(800);

    const modal = page.locator('[class*="modal"], [class*="dialog"], [role="dialog"]').first();
    await expect(modal).toBeVisible();

    const inputs = modal.locator('input');
    await inputs.nth(0).fill(code);
    await inputs.nth(2).fill(name);
    await inputs.nth(3).fill(name);

    const saveBtn = modal.locator('button').filter({ hasText: /save|حفظ/i }).first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toContainText(code);

    expect(w.errors.length).toBe(0);
    expect(w.chunkErrors.length).toBe(0);
  });

  test('Capacity standard — create dialog renders with real lookups (EN -> LTR)', async ({ page }) => {
    const w = attachErrorWatchers(page);
    await navigateTo(page, '/admin/production/capacity-standards', 'en');
    await page.waitForTimeout(3000);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    const createBtn = page.locator('.admin-main button').filter({ hasText: /create|new|إضافة|جديد|إنشاء|انشاء/i }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await page.waitForTimeout(800);

    const modal = page.locator('[class*="modal"], [class*="dialog"], [role="dialog"]').first();
    await expect(modal).toBeVisible();
    await expect(page.locator('body')).toContainText(/capacity|سعة|production line|خط إنتاج|product|منتج/i);

    expect(w.errors.length).toBe(0);
    expect(w.chunkErrors.length).toBe(0);
  });
});