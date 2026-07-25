import { test, expect, Page } from '@playwright/test';

const API_BASE = 'http://localhost:4000/api/v1';
const WEB_BASE = 'http://localhost:3000';

async function loginAndSetup(page: Page, lang: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
  });
  const json = await res.json();
  await page.addInitScript(({ token, locale }: { token: string; locale: string }) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('locale', locale);
  }, { token: json.accessToken, locale: lang });
}

async function getToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
  });
  const json = await res.json();
  return json.accessToken;
}

test.describe('Batch H — Frontend Route Coverage', () => {

  // === REQUIRED LIST PAGES RETURN 200 AND RENDER ===

  test('Personnel page returns 200 and renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Personnel') || body.includes('personnel')).toBeTruthy();
  });

  test('Machine Responsibilities page returns 200 and renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Responsibilit') || body.includes('Machine')).toBeTruthy();
  });

  test('Accountability Dashboard page returns 200 and renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Accountability') || body.includes('KPI') || body.includes('Performance')).toBeTruthy();
  });

  // === REQUIRED TABS / SECTIONS ON EXISTING PAGES ===

  test('Machine detail shows responsibilities tab', async ({ page }) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/maintenance/machines?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const firstId = json?.data?.[0]?.id || json?.[0]?.id;
    if (!firstId) { test.skip(); return; }
    await loginAndSetup(page, 'en');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/machines/${firstId}`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('responsibilities') || body.includes('machineResponsibilities') || body.includes('Responsibilit')).toBeTruthy();
  });

  test('Request detail shows assignments tab', async ({ page }) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/maintenance/requests?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const firstId = json?.data?.[0]?.id || json?.[0]?.id;
    if (!firstId) { test.skip(); return; }
    await loginAndSetup(page, 'en');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/requests/${firstId}`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('requestAssignments') || body.includes('assignments') || body.includes('Assign')).toBeTruthy();
  });

  test('Request detail shows part accountability tab', async ({ page }) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/maintenance/requests?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const firstId = json?.data?.[0]?.id || json?.[0]?.id;
    if (!firstId) { test.skip(); return; }
    await loginAndSetup(page, 'en');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/requests/${firstId}`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('partAccountability') || body.includes('partAccountabilit') || body.includes('Part')).toBeTruthy();
  });

  // === ARABIC LOCALE VERSIONS ===

  test('Personnel page Arabic renders', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('العاملين') || body.includes('صيانة')).toBeTruthy();
  });

  test('Machine Responsibilities page Arabic renders', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('المسؤوليات') || body.includes('مسؤولية')).toBeTruthy();
  });

  test('Accountability page Arabic renders', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('المساءلة') || body.includes('الأداء') || body.includes('مؤشرات')).toBeTruthy();
  });

  // === SIDEBAR / NAVIGATION ===

  test('Sidebar nav link personnel returns 200', async ({ page }) => {
    await loginAndSetup(page, 'en');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    expect(resp?.status()).toBe(200);
  });

  test('Sidebar nav link machine-responsibilities returns 200', async ({ page }) => {
    await loginAndSetup(page, 'en');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    expect(resp?.status()).toBe(200);
  });

  test('Sidebar nav link accountability returns 200', async ({ page }) => {
    await loginAndSetup(page, 'en');
    const resp = await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    expect(resp?.status()).toBe(200);
  });

  // === REQUIRED GLOBAL CHECKS ===

  test('No raw i18n keys visible (maintenance: prefix)', async ({ page }) => {
    const urls = [
      `${WEB_BASE}/admin/maintenance/personnel`,
      `${WEB_BASE}/admin/maintenance/machine-responsibilities`,
      `${WEB_BASE}/admin/maintenance/accountability`,
    ];
    for (const url of urls) {
      await loginAndSetup(page, 'en');
      await page.goto(url);
      await page.waitForTimeout(3000);
      const body = await page.textContent('body') || '';
      const rawKeyMatch = body.match(/maintenance:[a-zA-Z]/);
      expect(rawKeyMatch).toBeNull();
    }
  });

  test('No console errors on Batch H pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForTimeout(3000);
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    expect(consoleErrors.length).toBe(0);
  });

  test('No unexpected network failures (400/404/500)', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (res) => {
      const status = res.status();
      if (status >= 400 && status !== 304) failures.push(`${status} ${res.url()}`);
    });
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForTimeout(3000);
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    expect(failures.length).toBe(0);
  });

  test('No ChunkLoadError on Batch H pages', async ({ page }) => {
    const chunkErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text());
    });
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(4000);
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForTimeout(4000);
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(4000);
    expect(chunkErrors.length).toBe(0);
  });

  test('No _next/static failures', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (res) => {
      if (!res.ok() && res.url().includes('_next/static')) failures.push(`${res.status()} ${res.url()}`);
    });
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForTimeout(3000);
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    expect(failures.length).toBe(0);
  });

  // === LTR / RTL DIRECTION ===

  test('LTR direction in English', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).not.toBe('rtl');
  });

  test('RTL direction in Arabic', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');
  });

  // === STOCK / FINANCE / HR NEGATIVE ===

  test('No HR appraisal wording', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('HR Appraisal') || body.includes('hr appraisal') || body.includes('Evaluation')).toBeFalsy();
  });

  test('No stock wording except no-stock notice', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    const hasStockWords = body.includes('inventory') || body.includes('stock') || body.includes('warehouse') || body.includes('Store');
    if (hasStockWords) {
      expect(body.includes('No Stock') || body.includes('no stock') || body.includes('stock movement')).toBeTruthy();
    }
  });

  test('No finance wording except no-finance notice', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    const hasFinanceWords = body.includes('finance') || body.includes('Finance') || body.includes('budget') || body.includes('cost') || body.includes('expense');
    if (hasFinanceWords) {
      expect(body.includes('No Finance') || body.includes('no finance') || body.includes('Not Applicable')).toBeTruthy();
    }
  });

  // === DATAGRID RENDERS ===

  test('Personnel datagrid renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  test('Machine responsibilities datagrid renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  test('Accountability dashboard datagrid/card renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"], [class*="card"], [class*="stat"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });
});
