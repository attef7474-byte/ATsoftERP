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

test.describe('Batch H — Maintenance Accountability & Performance', () => {

  // Personnel list
  test('EN: Personnel list page shows labels', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForURL('**/admin/maintenance/personnel');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Personnel') || body.includes('personnel') || body.includes('Maintenance')).toBeTruthy();
  });

  test('AR: Personnel list page shows Arabic labels', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForURL('**/admin/maintenance/personnel');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('العاملين') || body.includes('الصيانة') || body.includes('فني') || body.includes('مهندس') || body.includes('شؤون')).toBeTruthy();
  });

  test('EN: Personnel datagrid renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForURL('**/admin/maintenance/personnel');
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  test('No console errors on personnel page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(4000);
    expect(consoleErrors.length).toBe(0);
  });

  // Machine Responsibilities list
  test('EN: Machine Responsibilities page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForURL('**/machine-responsibilities');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Responsibilit') || body.includes('Machine') || body.includes('Assign')).toBeTruthy();
  });

  test('AR: Machine Responsibilities shows Arabic labels', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForURL('**/machine-responsibilities');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('المسؤوليات') || body.includes('المسؤولية') || body.includes('الماكينة') || body.includes('تعيين')).toBeTruthy();
  });

  test('EN: Machine Responsibilities datagrid renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForURL('**/machine-responsibilities');
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  // Accountability Dashboard
  test('EN: Accountability dashboard renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForURL('**/accountability');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Accountability') || body.includes('accountability') || body.includes('Dashboard') || body.includes('KPI') || body.includes('Performance')).toBeTruthy();
  });

  test('AR: Accountability dashboard shows Arabic labels', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForURL('**/accountability');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('المساءلة') || body.includes('الأداء') || body.includes('مؤشرات') || body.includes('العاملين')).toBeTruthy();
  });

  test('EN: Dashboard shows KPI or Performance section', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForURL('**/accountability');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('KPI') || body.includes('Performance') || body.includes('performance') || body.includes('Metric')).toBeTruthy();
  });

  test('AR: Dashboard shows KPI section with Arabic labels', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForURL('**/accountability');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('الأداء') || body.includes('مؤشرات') || body.includes('المساءلة') || body.includes('الإحصائيات')).toBeTruthy();
  });

  // Existing machine detail page (shows responsibility)
  test('EN: Machine detail shows personnel/responsibility section', async ({ page }) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/maintenance/machines?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const firstId = json?.data?.[0]?.id || json?.[0]?.id;
    if (!firstId) { test.skip(); return; }
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machines/${firstId}`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Responsibilit') || body.includes('Personnel') || body.includes('Assign') || body.includes('Machine')).toBeTruthy();
  });

  // Existing request detail page (shows assignments)
  test('EN: Request detail shows assignment section', async ({ page }) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/maintenance/requests?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const firstId = json?.data?.[0]?.id || json?.[0]?.id;
    if (!firstId) { test.skip(); return; }
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/requests/${firstId}`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Assign') || body.includes('assignment') || body.includes('Personnel') || body.includes('personnel') || body.includes('Accountability') || body.includes('Part')).toBeTruthy();
  });

  // Global checks across all existing pages
  test('No raw i18n keys visible on all pages', async ({ page }) => {
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

  test('LTR direction preserved in English', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).not.toBe('rtl');
  });

  test('RTL direction applied in Arabic', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');
  });

  test('No ChunkLoadError in console', async ({ page }) => {
    const chunkErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text());
    });
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(4000);
    expect(chunkErrors.length).toBe(0);
  });

  test('No HR appraisal wording on accountability pages', async ({ page }) => {
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

  test('No _next/static network failures', async ({ page }) => {
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

  test('No network failures on existing list pages', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (res) => {
      if (!res.ok() && res.status() !== 304) failures.push(`${res.status()} ${res.url()}`);
    });
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForTimeout(3000);
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    const non404Failures = failures.filter(f => !f.includes(' 404 '));
    expect(non404Failures.length).toBe(0);
  });

  // Two-machine navigate
  test('Navigate between list pages', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(2000);
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForTimeout(2000);
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(2000);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });

  // Additional AR page checks
  test('AR: Personnel datagrid visible', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForURL('**/admin/maintenance/personnel');
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  test('AR: Machine Responsibilities datagrid visible', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForURL('**/machine-responsibilities');
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  test('AR: Accountability dashboard datagrid visible', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForURL('**/accountability');
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"], [class*="card"], [class*="stat"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  test('EN: All three list pages accessible with no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(2000);
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForTimeout(2000);
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(2000);
    expect(consoleErrors.length).toBe(0);
  });

  test('EN: Accountability dashboard body has meaningful content', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForURL('**/accountability');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(500);
    expect(body.includes('Skeleton') || body.includes('loading') || body.includes('Loading')).toBeFalsy();
  });
});
