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
});
