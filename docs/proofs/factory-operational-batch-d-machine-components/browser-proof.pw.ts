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

test.describe('Batch D — Machine Components', () => {
  test('Arabic: list page shows component labels', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-components`);
    await page.waitForURL('**/admin/maintenance/machine-components');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('مكونات الماكينة')).toBeTruthy();
    expect(body.includes('نوع المكون')).toBeTruthy();
    expect(body.includes('الأهمية')).toBeTruthy();
  });

  test('Arabic: new page shows form fields', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-components/new`);
    await page.waitForURL('**/new');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('نوع المكون')).toBeTruthy();
    expect(body.includes('الأهمية')).toBeTruthy();
    expect(body.includes('الموقع في الماكينة')).toBeTruthy();
    expect(body.includes('المكون الرئيسي')).toBeTruthy();
  });

  test('English: list page shows component labels', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-components`);
    await page.waitForURL('**/admin/maintenance/machine-components');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Machine Components')).toBeTruthy();
    expect(body.includes('Component Type')).toBeTruthy();
    expect(body.includes('Criticality')).toBeTruthy();
  });

  test('English: new page shows form fields', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-components/new`);
    await page.waitForURL('**/new');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Component Type')).toBeTruthy();
    expect(body.includes('Criticality')).toBeTruthy();
    expect(body.includes('Location in Machine')).toBeTruthy();
    expect(body.includes('Parent Component')).toBeTruthy();
  });

  test('AdminDataGrid renders with data or empty state', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-components`);
    await page.waitForURL('**/admin/maintenance/machine-components');
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await page.waitForTimeout(2000);
    expect(consoleErrors.length).toBe(0);
  });

  test('No network failures', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (res) => {
      if (!res.ok() && res.status() !== 304) failures.push(`${res.status()} ${res.url()}`);
    });
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-components`);
    await page.waitForURL('**/admin/maintenance/machine-components');
    await page.waitForTimeout(3000);
    expect(failures.length).toBe(0);
  });

  test('Detail page loads for first component', async ({ page }) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/maintenance/machine-components?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = await res.json();
    const firstId = list?.data?.[0]?.id || list?.[0]?.id;
    if (!firstId) { test.skip(); return; }
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-components/${firstId}`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Component') || body.includes('مكون') || body.includes('MECHANICAL') || body.includes('ELECTRICAL')).toBeTruthy();
  });

  test('Edit page loads', async ({ page }) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/maintenance/machine-components?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = await res.json();
    const firstId = list?.data?.[0]?.id || list?.[0]?.id;
    if (!firstId) { test.skip(); return; }
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-components/${firstId}/edit`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Component Type') || body.includes('نوع المكون')).toBeTruthy();
  });

  test('No raw i18n keys visible', async ({ page }) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/maintenance/machine-components?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = await res.json();
    const firstId = list?.data?.[0]?.id || list?.[0]?.id;
    const urls = firstId
      ? [`${WEB_BASE}/admin/maintenance/machine-components`, `${WEB_BASE}/admin/maintenance/machine-components/new`, `${WEB_BASE}/admin/maintenance/machine-components/${firstId}`]
      : [`${WEB_BASE}/admin/maintenance/machine-components`, `${WEB_BASE}/admin/maintenance/machine-components/new`];
    for (const url of urls) {
      await page.goto(url);
      await page.waitForTimeout(3000);
      const body = await page.textContent('body') || '';
      const rawKeyMatch = body.match(/maintenance:[a-zA-Z]/);
      expect(rawKeyMatch).toBeNull();
    }
  });

  test('LTR direction preserved in English', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-components`);
    await page.waitForTimeout(3000);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).not.toBe('rtl');
  });

  test('No ChunkLoadError in console', async ({ page }) => {
    const chunkErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text());
    });
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-components`);
    await page.waitForTimeout(4000);
    expect(chunkErrors.length).toBe(0);
  });
});
