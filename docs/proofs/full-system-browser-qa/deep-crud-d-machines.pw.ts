import { test as base, expect, Page } from '@playwright/test';
import { QA_EMAIL, QA_PASSWORD, QA_COMPANY_ID, QA_BRANCH_ID } from './qa-credentials';

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
      body: JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD }),
    });
    const { accessToken } = await loginResp.json();
    await use({
      Authorization: `Bearer ${accessToken}`,
      'x-active-company-id': QA_COMPANY_ID,
      'x-active-branch-id': QA_BRANCH_ID,
      'Content-Type': 'application/json',
    });
  },
  authedPage: async ({ page }, use) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', QA_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', QA_PASSWORD);
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

test.describe('Module D: Machines + Components + Spare Parts CRUD', () => {
  test('D1: Machines — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('MACH');

    const created = await apiCreate(apiHeaders, '/maintenance/machines', {
      name: testName,
      model: 'Test Model X1',
      serialNumber: 'SN-QA-001',
      manufacturer: 'Test Manufacturer',
      location: 'Building A, Line 1',
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Machine ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/maintenance/machines`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Machine ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/maintenance/machines/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName, location: 'Building B, Line 2' }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Machine → ${editName}`);

    await page.goto(`${BASE}/admin/maintenance/machines/${created.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const detailText = await page.locator('body').textContent() || '';
    expect(detailText).toContain(editName);
    console.log(`[DETAIL] Machine detail shows ${editName}`);

    await apiDelete(apiHeaders, '/maintenance/machines', created.id);
    console.log(`[DELETE] Machine ${created.id}`);
    console.log(`[PASS] Machines CRUD complete`);
  });

  test('D2: Machine Components — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('COMP');

    const machine = await apiCreate(apiHeaders, '/maintenance/machines', { name: qaName('MACH-C') });
    console.log(`[PREREQ] Machine: ${machine.id}`);

    const created = await apiCreate(apiHeaders, '/maintenance/machine-components', {
      machineId: machine.id,
      code: `MC-${Date.now()}`,
      name: testName,
      componentType: 'MECHANICAL',
      criticality: 'HIGH',
      locationInMachine: 'Left side',
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Component ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/maintenance/machine-components`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Component ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/maintenance/machine-components/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName, criticality: 'CRITICAL' }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Component → ${editName}`);

    await apiDelete(apiHeaders, '/maintenance/machine-components', created.id);
    await apiDelete(apiHeaders, '/maintenance/machines', machine.id);
    console.log(`[DELETE] Component + Machine cleaned up`);
    console.log(`[PASS] Machine Components CRUD complete`);
  });

  test('D3: Spare Parts — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('SPARE');

    const created = await apiCreate(apiHeaders, '/maintenance/spare-parts', {
      name: testName,
      unit: 'pcs',
      category: 'BEARING',
      manufacturer: 'SKF',
      isCritical: true,
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Spare Part ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/maintenance/spare-parts`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Spare Part ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/maintenance/spare-parts/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Spare Part → ${editName}`);

    await apiDelete(apiHeaders, '/maintenance/spare-parts', created.id);
    console.log(`[DELETE] Spare Part ${created.id}`);
    console.log(`[PASS] Spare Parts CRUD complete`);
  });

  test('D4: Machine Parts — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('MPART');

    const created = await apiCreate(apiHeaders, '/maintenance/machine-parts', {
      name: testName,
      unit: 'pcs',
      quantity: 5,
      minStock: 1,
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Machine Part ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/maintenance/machine-parts`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Machine Part ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/maintenance/machine-parts/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Machine Part → ${editName}`);

    await apiDelete(apiHeaders, '/maintenance/machine-parts', created.id);
    console.log(`[DELETE] Machine Part ${created.id}`);
    console.log(`[PASS] Machine Parts CRUD complete`);
  });

  test('D5: Machine Card — GET machine card detail endpoint', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;

    const machine = await apiCreate(apiHeaders, '/maintenance/machines', {
      name: qaName('MACH-CARD'),
      model: 'Model Card Test',
    });

    const cardResp = await fetch(`${API_BASE}/maintenance/machines/${machine.id}/card`, { headers: apiHeaders });
    expect(cardResp.ok).toBeTruthy();
    const card = await cardResp.json();
    expect(card.id).toBe(machine.id);
    console.log(`[CARD] Machine ${machine.id}: name=${card.name}, model=${card.model}`);

    await page.goto(`${BASE}/admin/maintenance/machines/${machine.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const detailText = await page.locator('body').textContent() || '';
    expect(detailText).toContain(card.name);
    console.log(`[DETAIL] Machine detail shows ${card.name}`);

    await apiDelete(apiHeaders, '/maintenance/machines', machine.id);
    console.log(`[PASS] Machine Card complete`);
  });
});
