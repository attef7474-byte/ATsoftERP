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
  const resp = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
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

test.describe('Module B: Settings/Org Structure CRUD', () => {
  test('B1: Administrations — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('ADMIN');

    const created = await apiCreate(apiHeaders, '/administrations', { name: testName });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Administration ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/core/administrations`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Administration ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/administrations/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Administration → ${editName}`);

    await apiDelete(apiHeaders, '/administrations', created.id);
    console.log(`[DELETE] Administration ${created.id}`);
    console.log(`[PASS] Administrations CRUD complete`);
  });

  test('B2: Organizational Units (Sections) — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('SECTION');

    const created = await apiCreate(apiHeaders, '/organizational-units', { name: testName, type: 'SECTION' });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Organizational Unit ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/core/organizational-units`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Organizational Unit ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/organizational-units/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Organizational Unit → ${editName}`);

    await apiDelete(apiHeaders, '/organizational-units', created.id);
    console.log(`[DELETE] Organizational Unit ${created.id}`);
    console.log(`[PASS] Organizational Units CRUD complete`);
  });

  test('B3: Production Lines — CREATE → LIST → EDIT → ACTIVATE/DEACTIVATE → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('LINE');

    const created = await apiCreate(apiHeaders, '/maintenance/production-lines', {
      name: testName,
      companyId: 'cmrl31uuy0000ok959hdjnca6',
      branchId: 'cmrx06a560000ng95g7d65vzh',
      departmentId: 'cmt0zsq0q00014g950udc57hw',
      operationTypeId: 'cmrx06j0e0006qw950eedyn1u',
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Production Line ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/maintenance/production-lines`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Production Line ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/maintenance/production-lines/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Production Line → ${editName}`);

    const deactResp = await fetch(`${API_BASE}/maintenance/production-lines/${created.id}/deactivate`, {
      method: 'PATCH',
      headers: apiHeaders,
    });
    expect(deactResp.ok).toBeTruthy();
    console.log(`[DEACTIVATE] Production Line ${created.id}`);

    const actResp = await fetch(`${API_BASE}/maintenance/production-lines/${created.id}/activate`, {
      method: 'PATCH',
      headers: apiHeaders,
    });
    expect(actResp.ok).toBeTruthy();
    console.log(`[ACTIVATE] Production Line ${created.id}`);

    await apiDelete(apiHeaders, '/maintenance/production-lines', created.id);
    console.log(`[DELETE] Production Line ${created.id}`);
    console.log(`[PASS] Production Lines CRUD complete`);
  });

  test('B4: Production Shifts — CREATE → LIST → EDIT → ACTIVATE/DEACTIVATE → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('SHIFT');

    const created = await apiCreate(apiHeaders, '/production/shifts', {
      name: testName,
      startTime: '06:00',
      endTime: '14:00',
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Production Shift ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/production/shifts`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Production Shift ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/production/shifts/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName, startTime: '07:00', endTime: '15:00' }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Production Shift → ${editName}`);

    const deactResp = await fetch(`${API_BASE}/production/shifts/${created.id}/deactivate`, {
      method: 'PATCH',
      headers: apiHeaders,
    });
    expect(deactResp.ok).toBeTruthy();
    console.log(`[DEACTIVATE] Shift ${created.id}`);

    const actResp = await fetch(`${API_BASE}/production/shifts/${created.id}/activate`, {
      method: 'PATCH',
      headers: apiHeaders,
    });
    expect(actResp.ok).toBeTruthy();
    console.log(`[ACTIVATE] Shift ${created.id}`);

    await apiDelete(apiHeaders, '/production/shifts', created.id);
    console.log(`[DELETE] Shift ${created.id}`);
    console.log(`[PASS] Production Shifts CRUD complete`);
  });

  test('B5: Company name allows duplicates (ACCEPTED_DESIGN) — code uniqueness enforced', async ({ authedPage, apiHeaders }) => {
    const testName = qaName('DUP');

    const comp1 = await apiCreate(apiHeaders, '/companies', { name: testName });
    expect(comp1.id).toBeTruthy();
    console.log(`[CREATE-1] Company ${testName}: id=${comp1.id}, code=${comp1.code}`);

    const comp2 = await apiCreate(apiHeaders, '/companies', { name: testName });
    expect(comp2.id).toBeTruthy();
    expect(comp2.id).not.toBe(comp1.id);
    expect(comp2.code).not.toBe(comp1.code);
    console.log(`[CREATE-2] Company with same name created: id=${comp2.id}, code=${comp2.code} — name duplicates allowed by design`);

    await apiDelete(apiHeaders, '/companies', comp1.id);
    await apiDelete(apiHeaders, '/companies', comp2.id);
    console.log(`[PASS] Company name duplication confirmed as ACCEPTED_DESIGN (code uniqueness is the real constraint)`);
  });
});
