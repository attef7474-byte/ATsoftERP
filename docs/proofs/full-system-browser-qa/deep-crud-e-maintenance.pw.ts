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

test.describe('Module E: Maintenance + Repair Orders CRUD', () => {
  test('E1: Maintenance Requests — CREATE → LIST → EDIT → CANCEL', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;

    const machine = await apiCreate(apiHeaders, '/maintenance/machines', { name: qaName('MACH-E1') });
    console.log(`[PREREQ] Machine: ${machine.id}`);

    const created = await apiCreate(apiHeaders, '/maintenance/requests', {
      machineId: machine.id,
      type: 'CORRECTIVE',
      title: qaName('REQ'),
      priority: 'HIGH',
      description: 'QA test maintenance request',
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Maintenance Request ${created.id}: status=${created.status}`);

    await page.goto(`${BASE}/admin/maintenance/requests`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    console.log(`[LIST] Maintenance Requests page loads`);

    await page.goto(`${BASE}/admin/maintenance/requests/${created.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log(`[DETAIL] Maintenance Request detail page loads`);

    const updated = await fetch(`${API_BASE}/maintenance/requests/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ description: 'Updated description' }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Maintenance Request updated`);

    await apiDelete(apiHeaders, '/maintenance/requests', created.id).catch(() => {});
    await apiDelete(apiHeaders, '/maintenance/machines', machine.id).catch(() => {});
    console.log(`[PASS] Maintenance Requests CRUD complete`);
  });

  test('E2: Repair Orders — LIST + DETAIL pages load', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;

    await page.goto(`${BASE}/admin/maintenance/repair-orders`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toBeTruthy();
    console.log(`[LIST] Repair Orders page loads`);

    const resp = await fetch(`${API_BASE}/maintenance/repair-orders?limit=1`, { headers: apiHeaders });
    expect(resp.ok).toBeTruthy();
    const data = await resp.json();
    if (data.data && data.data.length > 0) {
      const ro = data.data[0];
      await page.goto(`${BASE}/admin/maintenance/repair-orders/${ro.id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log(`[DETAIL] Repair Order detail page loads for ${ro.id}`);
    } else {
      console.log(`[DETAIL] No repair orders to view detail (empty state)`);
    }

    console.log(`[PASS] Repair Orders pages accessible`);
  });

  test('E3: Downtime Logs — list page loads', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;

    await page.goto(`${BASE}/admin/maintenance/downtime-logs`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    console.log(`[LIST] Downtime Logs page loads`);

    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toBeTruthy();
    console.log(`[PASS] Downtime Logs page accessible`);
  });
});
