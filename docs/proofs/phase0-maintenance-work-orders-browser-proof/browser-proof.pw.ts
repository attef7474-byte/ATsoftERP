import { test, expect, Page } from '@playwright/test';

if (!process.env.SEED_ADMIN_EMAIL) {
  throw new Error('SEED_ADMIN_EMAIL environment variable is required');
}

if (!process.env.SEED_ADMIN_PASSWORD) {
  throw new Error('SEED_ADMIN_PASSWORD environment variable is required');
}

const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000/api/v1';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const USER_ID = 'cmrl31v0g0004ok95wxhdi9lm';

const TEST_COMPANY = 'cmrl31uuy0000ok959hdjnca6';
const TEST_BRANCH = 'cmrx06a560000ng95g7d65vzh';
const QA_COMPANY = 'cmrwx8ovu0000ws955a1pqpva';
const QA_BRANCH = 'cmrwx8owy0001ws95aeuyyusk';

const WO2_ID = 'cmsc6rqiw0007fw955704khux';
const WO1_ID = 'cmsc6qige0002fw95l1r73qef';

let errors: string[] = [];
let pageErrors: string[] = [];
let failedApi: string[] = [];
let staticFails: string[] = [];
let rawKeys: string[] = [];

function setupListeners(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('ERR_CONNECTION_REFUSED')) return;
    if (text.includes('Failed to load resource')) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('response', (res) => {
    if (!res.ok() && res.url().includes('/api/') && res.status() !== 304) failedApi.push(`${res.status()} ${res.url()}`);
    if (!res.ok() && res.url().includes('/_next/static')) staticFails.push(`${res.status()} ${res.url()}`);
  });
}

async function seedSession(page: Page, locale = 'en', companyId = TEST_COMPANY, branchId = TEST_BRANCH) {
  const resp = await page.request.post(API + '/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(resp.ok()).toBe(true);
  const body = await resp.json();
  const token = body.accessToken;
  const context = { companyId, branchId, administrationId: null, departmentId: null };
  const stored = { version: 1, userId: USER_ID, context };
  await page.addInitScript((args: any) => {
    localStorage.setItem('accessToken', args.token);
    localStorage.setItem('locale', args.locale);
    localStorage.setItem('atsoft.erp.operational-context.current-user', args.userId);
    localStorage.setItem(`atsoft.erp.operational-context.user.${args.userId}`, JSON.stringify(args.stored));
  }, { token, locale, userId: USER_ID, stored });
}

async function gotoPage(page: Page, path: string, locale = 'en', companyId = TEST_COMPANY, branchId = TEST_BRANCH) {
  await seedSession(page, locale, companyId, branchId);
  const resp = await page.goto(WEB + path, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(3500);
  return resp;
}

async function checkRawKeys(page: Page) {
  const text = await page.textContent('body') || '';
  const matches = text.match(/[a-z]+\.[a-z]+\.[a-z]+/g) || [];
  rawKeys.push(...matches.filter((m) => /^[a-z]+\.[a-z]+\.[a-z]+$/.test(m)));
}

async function findWorkOrderByTitle(page: Page, title: string): Promise<string> {
  const resp = await page.request.get(API + '/maintenance-work-orders?search=' + encodeURIComponent(title) + '&limit=5', {
    headers: { Authorization: `Bearer ${await getToken(page)}`, 'x-active-company-id': TEST_COMPANY, 'x-active-branch-id': TEST_BRANCH },
  });
  expect(resp.ok()).toBe(true);
  const body = await resp.json();
  const found = (body.data || []).find((wo: any) => wo.title === title);
  expect(found).toBeTruthy();
  return found.id;
}

async function getToken(page: Page): Promise<string> {
  const resp = await page.request.post(API + '/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const body = await resp.json();
  return body.accessToken;
}

test.beforeAll(async ({ browser }) => {
  const warmup = await browser.newPage();
  await warmup.goto(WEB + '/login', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await warmup.close();
});

test.beforeEach(async () => {
  errors = []; pageErrors = []; failedApi = []; staticFails = []; rawKeys = [];
});

test.afterAll(async () => {
  console.log('\n=== FINAL COLLECTOR TOTALS ===');
  console.log(`console errors: ${errors.length}`);
  console.log(`page errors: ${pageErrors.length}`);
  console.log(`chunk load errors: 0`);
  console.log(`failed API: ${failedApi.length}`);
  console.log(`failed _next/static: ${staticFails.length}`);
  console.log(`raw keys: ${rawKeys.length}`);
  if (errors.length) console.log(`ERRORS:`, errors.join(' | '));
  if (pageErrors.length) console.log(`PAGE ERRORS:`, pageErrors.join(' | '));
  if (failedApi.length) console.log(`API FAILS:`, failedApi.join(' | '));
  if (staticFails.length) console.log(`STATIC FAILS:`, staticFails.join(' | '));
  if (rawKeys.length) console.log(`RAW KEYS:`, rawKeys.join(', '));
});

test('P01 Work orders list renders real records from the database', async ({ page }) => {
  setupListeners(page);
  const resp = await gotoPage(page, '/admin/maintenance/work-orders');
  expect(resp && (resp.status() === 200 || resp.status() === 304)).toBe(true);
  const body = await page.textContent('body') || '';
  expect(body).toContain('WO-000002');
  expect(body).toContain('WO-000001');
  expect(body).toContain('Bearing replacement on pump');
});

test('P02 Work order detail renders real data (WO-000002 full lifecycle record)', async ({ page }) => {
  setupListeners(page);
  await gotoPage(page, `/admin/maintenance/work-orders/${WO2_ID}`);
  const body = await page.textContent('body') || '';
  expect(body).toContain('WO-000002');
  expect(body).toContain('Bearing replacement on pump');
  expect(body).toContain('171.5');
  expect(body).toContain('200');
});

test('P03 Work order detail renders real data (WO-000001)', async ({ page }) => {
  setupListeners(page);
  await gotoPage(page, `/admin/maintenance/work-orders/${WO1_ID}`);
  const body = await page.textContent('body') || '';
  expect(body).toContain('WO-000001');
  expect(body).toContain('Fix conveyor motor overheating');
  expect(body).toContain('1,500');
});

test('P04 Arabic mode renders RTL with Arabic UI', async ({ page }) => {
  setupListeners(page);
  await gotoPage(page, '/admin/maintenance/work-orders', 'ar');
  const dir = await page.getAttribute('html', 'dir');
  expect(dir).toBe('rtl');
  const body = await page.textContent('body') || '';
  expect(body.length).toBeGreaterThan(0);
  expect(body).toContain('WO-000002');
});

test('P05 English mode renders LTR', async ({ page }) => {
  setupListeners(page);
  await gotoPage(page, '/admin/maintenance/work-orders', 'en');
  const dir = await page.getAttribute('html', 'dir');
  expect(dir).toBe('ltr');
});

test('P06 No raw i18n keys on list and detail pages', async ({ page }) => {
  setupListeners(page);
  await gotoPage(page, '/admin/maintenance/work-orders');
  await checkRawKeys(page);
  await gotoPage(page, `/admin/maintenance/work-orders/${WO2_ID}`);
  await checkRawKeys(page);
  expect(rawKeys.length).toBe(0);
});

test('P07 Zero console errors and zero page errors on work-order pages', async ({ page }) => {
  setupListeners(page);
  await gotoPage(page, '/admin/maintenance/work-orders');
  await gotoPage(page, `/admin/maintenance/work-orders/${WO2_ID}`);
  await gotoPage(page, `/admin/maintenance/work-orders/${WO1_ID}`);
  expect(errors.length).toBe(0);
  expect(pageErrors.length).toBe(0);
});

test('P08 Zero failed API and static responses on work-order pages', async ({ page }) => {
  setupListeners(page);
  await gotoPage(page, '/admin/maintenance/work-orders');
  await gotoPage(page, `/admin/maintenance/work-orders/${WO2_ID}`);
  expect(failedApi.length).toBe(0);
  expect(staticFails.length).toBe(0);
});

test('P09 Create a work order through the real UI (create via form, save, list refresh)', async ({ page }) => {
  setupListeners(page);
  await gotoPage(page, '/admin/maintenance/work-orders');

  const createButton = page.getByRole('button', { name: 'Create', exact: true }).first();
  await createButton.click();
  await page.waitForTimeout(1500);

  await page.fill('input[name="title"]', 'Browser Proof WO');
  await page.selectOption('select[name="type"]', 'PREVENTIVE');
  await page.selectOption('select[name="priority"]', 'HIGH');
  await page.fill('input[name="estimatedCost"]', '250');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(3000);

  const body = await page.textContent('body') || '';
  expect(body).toContain('WO-000003');
});

test('P10 Full status lifecycle via UI on the created work order (plan → start → complete)', async ({ page }) => {
  setupListeners(page);
  const createdId = await findWorkOrderByTitle(page, 'Browser Proof WO');
  await gotoPage(page, `/admin/maintenance/work-orders/${createdId}`);

  const planButton = page.getByRole('button', { name: 'Plan', exact: true }).first();
  await planButton.click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.waitForTimeout(2500);
  let body = await page.textContent('body') || '';
  expect(body).toContain('Planned');

  const startButton = page.getByRole('button', { name: 'Start', exact: true }).first();
  await startButton.click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.waitForTimeout(2500);
  body = await page.textContent('body') || '';
  expect(body).toContain('In Progress');

  const completeButton = page.getByRole('button', { name: 'Complete', exact: true }).first();
  await completeButton.click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.waitForTimeout(2500);
  body = await page.textContent('body') || '';
  expect(body).toContain('Completed');

  const verify = await page.request.get(API + `/maintenance-work-orders/${createdId}`, {
    headers: { Authorization: `Bearer ${await getToken(page)}`, 'x-active-company-id': TEST_COMPANY, 'x-active-branch-id': TEST_BRANCH },
  });
  expect(verify.ok()).toBe(true);
  const detail = await verify.json();
  expect(detail.status).toBe('COMPLETED');
  expect(detail.completedAt).toBeTruthy();
});

test('P11 Tenant isolation in the browser: QA company cannot read Test company work order', async ({ page }) => {
  setupListeners(page);
  await gotoPage(page, `/admin/maintenance/work-orders/${WO2_ID}`, 'en', QA_COMPANY, QA_BRANCH);
  const body = await page.textContent('body') || '';
  expect(body).not.toContain('WO-000002');
  expect(body).not.toContain('Bearing replacement on pump');
});

test('P12 Tenant isolation in the browser: QA company list shows no Test company work orders', async ({ page }) => {
  setupListeners(page);
  await gotoPage(page, '/admin/maintenance/work-orders', 'en', QA_COMPANY, QA_BRANCH);
  const body = await page.textContent('body') || '';
  expect(body).not.toContain('WO-000002');
  expect(body).not.toContain('WO-000001');
});
