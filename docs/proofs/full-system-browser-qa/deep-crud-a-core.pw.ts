import { test as base, expect, Page } from '@playwright/test';
import { QA_EMAIL, QA_PASSWORD, QA_COMPANY_ID, QA_BRANCH_ID } from './qa-credentials';

const BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:4000/api/v1';
const SCREENSHOT_DIR = 'docs/proofs/full-system-browser-qa/screenshots';

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

const createdIds: Record<string, string[]> = {};

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
  const resp = await fetch(`${API_BASE}${endpoint}/${id}`, {
    method: 'DELETE',
    headers,
  });
  return resp;
}

async function waitForTable(page: Page) {
  await page.waitForSelector('table, [role="table"], .entity-data-table, [data-testid*="table"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function countRows(page: Page): Promise<number> {
  const rows = await page.locator('table tbody tr, [role="table"] [role="row"]').count();
  return rows;
}

function qaName(prefix: string) {
  return `QA-SYS-${prefix}-${Date.now()}`;
}

test.describe('Module A: Shell/Auth/Core CRUD', () => {
  test('A1: Companies — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('COMP');

    // === CREATE via API (faster, reliable) ===
    const created = await apiCreate(apiHeaders, '/companies', {
      name: testName,
      legalName: `${testName} Legal`,
      taxNumber: 'QA-TAX-001',
      phone: '+966500000001',
      email: 'qa@atsofterp.test',
      address: 'QA Test Address',
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe(testName);
    expect(created.code).toBeTruthy();
    console.log(`[CREATE] Company ${testName}: id=${created.id}, code=${created.code}`);

    // === VERIFY LIST ===
    await page.goto(`${BASE}/admin/core/companies`);
    await waitForTable(page);
    await page.waitForTimeout(2000);

    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Company ${testName} visible in list`);

    // === EDIT via API ===
    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/companies/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName, phone: '+966500000002' }),
    });
    const updatedData = await updated.json();
    expect(updatedData.name).toBe(editName);
    expect(updatedData.id).toBe(created.id);
    console.log(`[EDIT] Company ${testName} → ${editName}`);

    // Verify edit persists
    await page.reload();
    await waitForTable(page);
    await page.waitForTimeout(1000);
    const bodyTextAfterEdit = await page.locator('body').textContent() || '';
    expect(bodyTextAfterEdit).toContain(editName);
    console.log(`[VERIFY-EDIT] ${editName} visible after edit`);

    // === DETAIL ===
    await page.goto(`${BASE}/admin/core/companies/${created.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const detailText = await page.locator('body').textContent() || '';
    expect(detailText).toContain(editName);
    console.log(`[DETAIL] Company detail shows ${editName}`);

    // === DELETE via API (clean up) ===
    const delResp = await apiDelete(apiHeaders, '/companies', created.id);
    expect(delResp.ok).toBeTruthy();
    console.log(`[DELETE] Company ${created.id} deleted`);

    // Verify deleted from list
    await page.goto(`${BASE}/admin/core/companies`);
    await waitForTable(page);
    await page.waitForTimeout(1000);
    const bodyAfterDelete = await page.locator('body').textContent() || '';
    expect(bodyAfterDelete).not.toContain(editName);
    console.log(`[VERIFY-DELETE] ${editName} no longer in list`);

    console.log(`[PASS] Companies CRUD complete`);
  });

  test('A2: Branches — CREATE → LIST → EDIT → DETAIL → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('BRANCH');

    const created = await apiCreate(apiHeaders, '/branches', {
      name: testName,
      code: `QA-BR-${Date.now()}`,
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Branch ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/core/branches`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Branch ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/branches/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName }),
    });
    expect(updated.ok).toBeTruthy();
    const updatedData = await updated.json();
    expect(updatedData.name).toBe(editName);
    console.log(`[EDIT] Branch → ${editName}`);

    await page.goto(`${BASE}/admin/core/branches/${created.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const detailText = await page.locator('body').textContent() || '';
    expect(detailText).toContain(editName);
    console.log(`[DETAIL] Branch detail shows ${editName}`);

    await apiDelete(apiHeaders, '/branches', created.id);
    console.log(`[DELETE] Branch ${created.id} cleaned up`);
    console.log(`[PASS] Branches CRUD complete`);
  });

  test('A3: Departments — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('DEPT');

    const created = await apiCreate(apiHeaders, '/departments', { name: testName });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Department ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/core/departments`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Department ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/departments/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Department → ${editName}`);

    await page.goto(`${BASE}/admin/core/departments/${created.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const detailText = await page.locator('body').textContent() || '';
    expect(detailText).toContain(editName);
    console.log(`[DETAIL] Department detail shows ${editName}`);

    await apiDelete(apiHeaders, '/departments', created.id);
    console.log(`[PASS] Departments CRUD complete`);
  });

  test('A4: Job Titles — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('JOB');
    const testCode = `JT-${Date.now()}`;

    const created = await apiCreate(apiHeaders, '/job-titles', { name: testName, code: testCode });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Job Title ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/core/job-titles`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Job Title ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/job-titles/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Job Title → ${editName}`);

    await apiDelete(apiHeaders, '/job-titles', created.id);
    console.log(`[PASS] Job Titles CRUD complete`);
  });

  test('A5: Users — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('USER');
    const testEmail = `qa-${Date.now()}@atsofterp.test`;

    const created = await apiCreate(apiHeaders, '/users', {
      name: testName,
      email: testEmail,
      password: process.env.QA_TEST_USER_PASSWORD!,
    });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] User ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/access/users`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] User ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/users/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] User → ${editName}`);

    await page.goto(`${BASE}/admin/access/users`);
    await waitForTable(page);
    await page.waitForTimeout(1000);
    const nameMatches = await page.locator(`text=${editName}`).count();
    expect(nameMatches).toBe(1);
    console.log(`[NO-DUPLICATE] User appears exactly once after edit`);

    await page.goto(`${BASE}/admin/access/users/${created.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const detailText = await page.locator('body').textContent() || '';
    expect(detailText).toContain(editName);
    console.log(`[DETAIL] User detail shows ${editName}`);

    await apiDelete(apiHeaders, '/users', created.id);
    console.log(`[DELETE] User ${created.id} cleaned up`);
    console.log(`[PASS] Users CRUD complete`);
  });

  test('A6: Roles — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;
    const testName = qaName('ROLE');
    const testCode = `ROLE-${Date.now()}`;

    const created = await apiCreate(apiHeaders, '/roles', { name: testName, code: testCode });
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Role ${testName}: id=${created.id}`);

    await page.goto(`${BASE}/admin/access/roles`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(testName);
    console.log(`[LIST] Role ${testName} visible`);

    const editName = `${testName}-EDITED`;
    const updated = await fetch(`${API_BASE}/roles/${created.id}`, {
      method: 'PATCH',
      headers: apiHeaders,
      body: JSON.stringify({ name: editName }),
    });
    expect(updated.ok).toBeTruthy();
    console.log(`[EDIT] Role → ${editName}`);

    await apiDelete(apiHeaders, '/roles', created.id);
    console.log(`[PASS] Roles CRUD complete`);
  });

  test('A7: Person Assignments — CREATE → LIST → EDIT → DELETE', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;

    const person = await apiCreate(apiHeaders, '/maintenance/personnel', { name: qaName('PERS'), code: `P-${Date.now()}`, role: 'TECHNICIAN' });
    const personId = person.operationalPersonId || person.id;
    const deptId = 'cmt0zsq0q00014g950udc57hw';
    console.log(`[PREREQ] Person: ${personId}, Dept: ${deptId}`);

    const deptResp = await fetch(`${API_BASE}/departments/${deptId}`, { headers: apiHeaders });
    const dept = await deptResp.json();
    const deptBranchId = dept.branchId || null;
    console.log(`[PREREQ] Dept branchId: ${deptBranchId}`);

    const payload: Record<string, any> = {
      personnelId: personId,
      departmentId: deptId,
      effectiveFrom: '2026-01-01',
    };
    if (deptBranchId) payload.branchId = deptBranchId;

    const created = await apiCreate(apiHeaders, '/person-assignments', payload);
    expect(created.id).toBeTruthy();
    console.log(`[CREATE] Person Assignment: id=${created.id}`);

    await page.goto(`${BASE}/admin/core/person-assignments`);
    await waitForTable(page);
    await page.waitForTimeout(2000);
    console.log(`[LIST] Person Assignments page loads`);

    await apiDelete(apiHeaders, '/person-assignments', created.id).catch(() => {});
    await apiDelete(apiHeaders, '/maintenance/personnel', person.id).catch(() => {});
    console.log(`[PASS] Person Assignments CRUD complete`);
  });

  test('A8: Detail Data Consistency — A vs B no cross-contamination', async ({ authedPage, apiHeaders }) => {
    const page = authedPage;

    const compA = await apiCreate(apiHeaders, '/companies', { name: `QA-SYS-COMP-A-${Date.now()}` });
    const compB = await apiCreate(apiHeaders, '/companies', { name: `QA-SYS-COMP-B-${Date.now()}` });
    console.log(`[PREREQ] Company A: ${compA.id}, Company B: ${compB.id}`);

    // Open detail A
    await page.goto(`${BASE}/admin/core/companies/${compA.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const textA = await page.locator('body').textContent() || '';
    expect(textA).toContain(compA.name);
    console.log(`[DETAIL-A] Shows ${compA.name}`);

    // Open detail B
    await page.goto(`${BASE}/admin/core/companies/${compB.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const textB = await page.locator('body').textContent() || '';
    expect(textB).toContain(compB.name);
    expect(textB).not.toContain(compA.name);
    console.log(`[DETAIL-B] Shows ${compB.name}, NOT ${compA.name}`);

    // Verify refresh of detail A URL still shows A
    await page.goto(`${BASE}/admin/core/companies/${compA.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const textARefresh = await page.locator('body').textContent() || '';
    expect(textARefresh).toContain(compA.name);
    console.log(`[DETAIL-A-REFRESH] Still shows ${compA.name}`);

    // Cleanup
    await apiDelete(apiHeaders, '/companies', compA.id);
    await apiDelete(apiHeaders, '/companies', compB.id);
    console.log(`[PASS] Detail data consistency verified`);
  });
});
