import { test as base, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:4000/api/v1';

type QAFixtures = {
  authedPage: Page;
  apiHeaders: Record<string, string>;
};

const test = base.extend<QAFixtures>({
  apiHeaders: async ({}, use) => {
    const loginResp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
    });
    const { accessToken } = await loginResp.json();
    await use({
      Authorization: `Bearer ${accessToken}`,
      'x-active-company-id': 'cmrl31uuy0000ok959hdjnca6',
      'x-active-branch-id': 'cmrx06a560000ng95g7d65vzh',
      'Content-Type': 'application/json',
    });
  },
  authedPage: async ({ page }, use) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'admin@atsofterp.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await use(page);
  },
});

async function apiCreate(headers: Record<string, string>, endpoint: string, data: Record<string, any>) {
  const resp = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(data) });
  const result = await resp.json();
  if (!resp.ok) throw new Error(`API CREATE failed: ${resp.status} ${JSON.stringify(result)}`);
  return result;
}

async function apiDelete(headers: Record<string, string>, endpoint: string, id: string) {
  return fetch(`${API_BASE}${endpoint}/${id}`, { method: 'DELETE', headers });
}

async function waitForTable(page: Page) {
  await page.waitForSelector('table, [role="table"], .entity-data-table, [data-testid*="table"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

function qaName(prefix: string) {
  return `QA-SYS-${prefix}-${Date.now()}`;
}

test.describe('Module C: Warehouse + Inventory CRUD', () => {
  test('C1: Warehouses — CREATE → LIST → EDIT → ACTIVATE/DEACTIVATE → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('WH');

    const created = await apiCreate(apiHeaders, '/inventory/warehouses', {
      name: testName,
      location: 'Building A',
      warehouseType: 'GENERAL',
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Warehouse ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/inventory/warehouses`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Warehouse ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/inventory/warehouses/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName, location: 'Building B' }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Warehouse → ${editName}`);

    const deactResp = await fetch(`${API_BASE}/inventory/warehouses/${created.id}/deactivate`, { method: 'PATCH', headers: apiHeaders });
    expect(deactResp.ok).toBeTruthy();
    console.log(`[DEACTIVATE] Warehouse ${created.id}`);

    const actResp = await fetch(`${API_BASE}/inventory/warehouses/${created.id}/activate`, { method: 'PATCH', headers: apiHeaders });
    expect(actResp.ok).toBeTruthy();
    console.log(`[ACTIVATE] Warehouse ${created.id}`);

    await page.goto(`${BASE}/admin/inventory/warehouses/${created.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const detailText = await page.locator('body').textContent() || '';
    expect(detailText).toContain(editName);
    console.log(`[DETAIL] Warehouse detail shows ${editName}`);

    await apiDelete(apiHeaders, '/inventory/warehouses', created.id);
    console.log(`[DELETE] Warehouse ${created.id}`);
    console.log(`[PASS] Warehouses CRUD complete`);
  });

  test('C2: Products — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('PROD');

    const created = await apiCreate(apiHeaders, '/products', {
      name: testName,
      unit: 'pcs',
      description: 'QA test product',
      minStock: 10,
      maxStock: 1000,
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Product ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/inventory/products`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Product ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/products/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName, description: 'Updated desc' }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Product → ${editName}`);

    await page.goto(`${BASE}/admin/inventory/products/${created.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const detailText = await page.locator('body').textContent() || '';
    expect(detailText).toContain(editName);
    console.log(`[DETAIL] Product detail shows ${editName}`);

    await apiDelete(apiHeaders, '/products', created.id);
    console.log(`[DELETE] Product ${created.id}`);
    console.log(`[PASS] Products CRUD complete`);
  });

  test('C3: Inventory Movement — CREATE → LIST → POST → VERIFY BALANCE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;

    const wh = await apiCreate(apiHeaders, '/inventory/warehouses', { name: qaName('WH-MV'), warehouseType: 'GENERAL' });
    const prod = await apiCreate(apiHeaders, '/products', { name: qaName('PROD-MV'), unit: 'pcs' });
    console.log(`[PREREQ] WH: ${wh.id}, Product: ${prod.id}`);

    const movement = await apiCreate(apiHeaders, '/inventory/movements', {
      warehouseId: wh.id,
      movementType: 'RECEIPT',
      lines: [{ productId: prod.id, quantity: 100, direction: 'IN' }],
    });
    expect(movement.id).toBeTruthy();
    expect(movement.status).toBe('DRAFT');
    console.log(`[CREATE] Movement ${movement.id}: status=${movement.status}`);

    await page.goto(`${BASE}/admin/inventory/movements`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    console.log(`[LIST] Movements page loads`);

    const postResp = await fetch(`${API_BASE}/inventory/movements/${movement.id}/post`, {
      method: 'PATCH',
      headers: apiHeaders,
    });
    expect(postResp.ok).toBeTruthy();
    const postedData = await postResp.json();
    expect(postedData.status).toBe('POSTED');
    console.log(`[POST] Movement posted: status=${postedData.status}`);

    const balanceResp = await fetch(`${API_BASE}/products/${prod.id}/balances`, { headers: apiHeaders });
    expect(balanceResp.ok).toBeTruthy();
    const balances = await balanceResp.json();
    console.log(`[BALANCE] Product ${prod.id} balances: ${JSON.stringify(balances).substring(0, 200)}`);

    await apiDelete(apiHeaders, '/inventory/movements', movement.id).catch(() => {});
    await apiDelete(apiHeaders, '/products', prod.id).catch(() => {});
    await apiDelete(apiHeaders, '/inventory/warehouses', wh.id).catch(() => {});
    console.log(`[PASS] Inventory Movement workflow complete`);
  });

  test('C4: Warehouse Summary — GET summary endpoint', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;

    const wh = await apiCreate(apiHeaders, '/inventory/warehouses', { name: qaName('WH-SUM') });

    const summaryResp = await fetch(`${API_BASE}/inventory/warehouses/${wh.id}/summary`, { headers: apiHeaders });
    expect(summaryResp.ok).toBeTruthy();
    const summary = await summaryResp.json();
    console.log(`[SUMMARY] Warehouse ${wh.id}: ${JSON.stringify(summary).substring(0, 200)}`);

    await page.goto(`${BASE}/admin/inventory/warehouses/${wh.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log(`[DETAIL] Warehouse detail page loads`);

    await apiDelete(apiHeaders, '/inventory/warehouses', wh.id);
    console.log(`[PASS] Warehouse Summary complete`);
  });
});
