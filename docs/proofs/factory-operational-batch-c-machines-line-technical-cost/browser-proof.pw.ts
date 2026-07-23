import { test, expect, Page } from '@playwright/test';

const API_BASE = 'http://localhost:4000/api/v1';
const WEB_BASE = 'http://localhost:3000';

async function loginAndSetup(page: Page, lang: string) {
  // Login via API
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
  });
  const json = await res.json();

  // Set localStorage via initScript before ANY page JS runs
  await page.addInitScript(({ token, locale }: { token: string; locale: string }) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('locale', locale);
  }, { token: json.accessToken, locale: lang });
}

test.describe('Batch C — Machines Production Line / Technical / Cost', () => {
  test('Arabic: list page shows new column labels', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/machines`);
    await page.waitForURL('**/admin/maintenance/machines');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('خط الإنتاج')).toBeTruthy();
    expect(body.includes('نوع العملية')).toBeTruthy();
    expect(body.includes('القسم الفني')).toBeTruthy();
    expect(body.includes('مركز التكلفة الافتراضي')).toBeTruthy();
    const rawKeys = body.match(/\b(maintenance|core|common|actions|details|complexForms|validation)\.[a-zA-Z]+\b/g);
    expect(rawKeys).toBeNull();
  });

  test('Arabic: detail page shows new fields', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    // Get machine ID from API
    const tokenRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
    });
    const { accessToken } = await tokenRes.json();
    const listRes = await fetch(`${API_BASE}/maintenance/machines?limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const listJson = await listRes.json();
    if (listJson.data && listJson.data.length > 0) {
      await page.goto(`${WEB_BASE}/admin/maintenance/machines/${listJson.data[0].id}`);
      await page.waitForURL('**/admin/maintenance/machines/**');
      await page.waitForTimeout(3000);
      const body = await page.textContent('body') || '';
      expect(body.includes('خط الإنتاج')).toBeTruthy();
      expect(body.includes('نوع العملية')).toBeTruthy();
      expect(body.includes('الإدارة الفنية')).toBeTruthy();
      expect(body.includes('القسم الفني')).toBeTruthy();
      expect(body.includes('مركز التكلفة الافتراضي')).toBeTruthy();
    }
  });

  test('Arabic: edit page shows new selectors', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    const tokenRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
    });
    const { accessToken } = await tokenRes.json();
    const listRes = await fetch(`${API_BASE}/maintenance/machines?limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const listJson = await listRes.json();
    if (listJson.data && listJson.data.length > 0) {
      await page.goto(`${WEB_BASE}/admin/maintenance/machines/${listJson.data[0].id}/edit`);
      await page.waitForURL('**/edit');
      await page.waitForTimeout(3000);
      const body = await page.textContent('body') || '';
      expect(body.includes('خط الإنتاج')).toBeTruthy();
      expect(body.includes('نوع العملية')).toBeTruthy();
      expect(body.includes('الإدارة الفنية')).toBeTruthy();
      expect(body.includes('القسم الفني')).toBeTruthy();
      expect(body.includes('مركز التكلفة الافتراضي')).toBeTruthy();
    }
  });

  test('English: list page shows new column labels', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machines`);
    await page.waitForURL('**/admin/maintenance/machines');
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Production Line')).toBeTruthy();
    expect(body.includes('Operation Type')).toBeTruthy();
    expect(body.includes('Technical Department')).toBeTruthy();
    expect(body.includes('Default Cost Center')).toBeTruthy();
    const rawKeys = body.match(/\b(maintenance|core|common|actions|details|complexForms|validation)\.[a-zA-Z]+\b/g);
    expect(rawKeys).toBeNull();
  });

  test('English: detail page shows new fields', async ({ page }) => {
    await loginAndSetup(page, 'en');
    const tokenRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
    });
    const { accessToken } = await tokenRes.json();
    const listRes = await fetch(`${API_BASE}/maintenance/machines?limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const listJson = await listRes.json();
    if (listJson.data && listJson.data.length > 0) {
      await page.goto(`${WEB_BASE}/admin/maintenance/machines/${listJson.data[0].id}`);
      await page.waitForURL('**/admin/maintenance/machines/**');
      await page.waitForTimeout(3000);
      const body = await page.textContent('body') || '';
      expect(body.includes('Production Line')).toBeTruthy();
      expect(body.includes('Operation Type')).toBeTruthy();
      expect(body.includes('Technical Administration')).toBeTruthy();
      expect(body.includes('Technical Department')).toBeTruthy();
      expect(body.includes('Default Cost Center')).toBeTruthy();
    }
  });

  test('English: edit page shows new selectors', async ({ page }) => {
    await loginAndSetup(page, 'en');
    const tokenRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
    });
    const { accessToken } = await tokenRes.json();
    const listRes = await fetch(`${API_BASE}/maintenance/machines?limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const listJson = await listRes.json();
    if (listJson.data && listJson.data.length > 0) {
      await page.goto(`${WEB_BASE}/admin/maintenance/machines/${listJson.data[0].id}/edit`);
      await page.waitForURL('**/edit');
      await page.waitForTimeout(3000);
      const body = await page.textContent('body') || '';
      expect(body.includes('Production Line')).toBeTruthy();
      expect(body.includes('Operation Type')).toBeTruthy();
      expect(body.includes('Technical Administration')).toBeTruthy();
      expect(body.includes('Technical Department')).toBeTruthy();
      expect(body.includes('Default Cost Center')).toBeTruthy();
    }
  });
});
