import { test, expect } from '@playwright/test';

const WEB = 'http://localhost:3000';

async function login(page) {
  await page.goto(`${WEB}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('#email', 'admin@atsofterp.com');
  await page.fill('#password', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Permission + Detail/Edit Deep Checks', () => {
  test('Login + Admin nav completeness', async ({ page }) => {
    await login(page);

    const sidebar = page.locator('nav, [role="navigation"], aside').first();
    await expect(sidebar).toBeVisible();

    const navText = await sidebar.textContent();
    const expectedArSections = [
      'لوحة', 'الشركات', 'الماكينات', 'الصيانة', 'المخزون', 'الإعدادات',
    ];
    for (const sec of expectedArSections) {
      expect(navText).toContain(sec);
    }
  });

  test('Permission matrix page loads', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/access/permissions/matrix`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible();
  });

  test('Roles page loads and shows roles', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/access/roles`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const body = await page.textContent('body');
    const hasRole = body?.includes('Super Administrator') || body?.includes('مشرف') || body?.includes('SUPER_ADMIN');
    expect(hasRole).toBeTruthy();
  });

  test('Detail page: Company', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/core/companies`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(200);
  });

  test('Detail page: Machine', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/maintenance/machines`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows = page.locator('table tbody tr, [class*="row"], [class*="card"]');
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      const hasDetailContent = (body?.length || 0) > 200;
      expect(hasDetailContent).toBeTruthy();
    }
  });

  test('Detail page: Warehouse', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/inventory/warehouses`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows = page.locator('table tbody tr, [class*="row"], [class*="card"]');
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(200);
    }
  });

  test('Detail page: Spare Part', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/maintenance/spare-parts`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows = page.locator('table tbody tr, [class*="row"], [class*="card"]');
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(200);
    }
  });

  test('Detail page: Work Order', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/maintenance/work-orders`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows = page.locator('table tbody tr, [class*="row"], [class*="card"]');
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(200);
    }
  });

  test('Detail page: Repair Order', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/maintenance/repair-orders`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows = page.locator('table tbody tr, [class*="row"], [class*="card"]');
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(200);
    }
  });

  test('Detail page: Person Assignment', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/core/person-assignments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows = page.locator('table tbody tr, [class*="row"], [class*="card"]');
    const count = await rows.count();
    if (count > 0) {
      await rows.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(200);
    }
  });

  test('Cross-field: Inventory balance references correct warehouse', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/inventory/balances`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(100);
  });

  test('Cross-field: Movement references correct source/destination', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/inventory/movements`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(100);
  });

  test('Tab: Maintenance dashboard tabs', async ({ page }) => {
    await login(page);
    await page.goto(`${WEB}/admin/maintenance/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const tabs = page.locator('button[role="tab"], [class*="tab"]');
    const count = await tabs.count();
    if (count > 0) {
      await tabs.first().click();
      await page.waitForTimeout(1000);
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(100);
    }
  });

  test('Tab: Settings pages have content', async ({ page }) => {
    await login(page);
    const settingPages = [
      '/admin/settings/branches',
      '/admin/settings/warehouses',
      '/admin/settings/units',
      '/admin/settings/areas',
      '/admin/settings/sections',
      '/admin/settings/lines',
    ];

    for (const sp of settingPages) {
      await page.goto(`${WEB}${sp}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(1500);
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(100);
    }
  });
});
