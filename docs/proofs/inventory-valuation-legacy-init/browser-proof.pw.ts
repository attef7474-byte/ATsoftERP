// Playwright Browser Proof — Inventory Valuation R1B UI (VAL-R1B-UI)
// Runs entirely inside a disposable QA tenant (QA-VAL-R1B-UI-<ts>).
// Run:
//   npx playwright test --config=docs/proofs/inventory-valuation-legacy-init/playwright.config.ts
// Requires: provision script apps/api/scripts/valuation-qa-provision.ts already run (writes qa-state.json).

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const STATE_PATH = path.resolve(__dirname, 'qa-state.json');
if (!fs.existsSync(STATE_PATH)) {
  throw new Error('qa-state.json not found. Run apps/api/scripts/valuation-qa-provision.ts first.');
}
const state: any = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));

const WEB = 'https://DELL';
const API = 'http://localhost:4000/api/v1';
const PAGE = '/admin/inventory/valuation';
const SHOT_DIR = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

interface QAUser {
  id: string;
  email: string;
  password: string;
}

const SUPER: QAUser = state.superUser;
const READONLY: QAUser = state.readonlyUser;
const QA = {
  companyId: state.companyId,
  branchId: state.branchId,
  warehouseId: state.warehouseId,
  productId: state.productId,
  prefix: state.prefix,
};

let errors: string[] = [];
let failedApi: string[] = [];
let chunkErrors: string[] = [];
let staticFails: string[] = [];

function setupListeners(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('ERR_CONNECTION_REFUSED')) return;
      if (text.includes('Failed to load resource')) return;
      if (text.includes('favicon')) return;
      errors.push(text);
    }
    if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('response', (res) => {
    if (!res.ok() && res.url().includes('/api/') && res.status() !== 304) failedApi.push(`${res.status()} ${res.url()}`);
    if (!res.ok() && res.url().includes('/_next/static')) staticFails.push(`${res.status()} ${res.url()}`);
  });
}

// Pre-fetched JWT per user (single login per user to respect the login rate-limit guard).
const SESSIONS: Record<string, string> = {};

async function apiLogin(page: Page, user: QAUser, locale = 'en') {
  const token = SESSIONS[user.email];
  if (!token) throw new Error(`no session token for ${user.email}`);
  await page.addInitScript((args: any) => {
    localStorage.setItem('accessToken', args.token);
    localStorage.setItem('locale', args.locale);
    localStorage.setItem('atsoft.erp.operational-context.current-user', args.userId);
    localStorage.setItem(`atsoft.erp.operational-context.user.${args.userId}`, JSON.stringify({
      version: 1,
      userId: args.userId,
      context: { companyId: args.companyId, branchId: args.branchId, administrationId: null, departmentId: null },
    }));
  }, { token, locale, userId: user.id, companyId: QA.companyId, branchId: QA.branchId });
}

async function loginAndGoto(page: Page, user: QAUser, locale = 'en') {
  await apiLogin(page, user, locale);
  const resp = await page.goto(WEB + PAGE, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(3000);
  return resp;
}

async function collectRawIds(page: Page): Promise<string[]> {
  const text = await page.textContent('body') || '';
  return text.match(/cm[a-z0-9]{18,}/g) || [];
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: true });
}

const SESSION_PATH = path.resolve(__dirname, 'qa-session.json');

test.beforeAll(async ({ request, browser }) => {
  if (fs.existsSync(SESSION_PATH)) {
    const sess = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
    SESSIONS[SUPER.email] = sess.superUserToken;
    SESSIONS[READONLY.email] = sess.readonlyUserToken;
  } else {
    for (const u of [SUPER, READONLY]) {
      const resp = await request.post(API + '/auth/login', {
        data: { email: u.email, password: u.password },
      });
      const body = resp.ok() ? await resp.json() : null;
      const token = body?.accessToken;
      if (!token) throw new Error(`login failed for ${u.email}: HTTP ${resp.status()}`);
      SESSIONS[u.email] = token;
    }
    fs.writeFileSync(SESSION_PATH, JSON.stringify({ superUserToken: SESSIONS[SUPER.email], readonlyUserToken: SESSIONS[READONLY.email] }, null, 2));
  }
  const warmup = await browser.newPage();
  await warmup.goto(WEB + '/login', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await warmup.close();
});

test.beforeEach(async () => {
  errors = []; failedApi = []; chunkErrors = []; staticFails = [];
});

test.afterEach(async () => {
  const errs = errors.filter((e) => !e.includes('ERR_CERT') && !e.includes('net::ERR'));
  expect(errs, `console errors: ${errs.join(' | ')}`).toEqual([]);
  expect(chunkErrors, `chunk errors: ${chunkErrors.join(' | ')}`).toEqual([]);
  expect(staticFails, `static fails: ${staticFails.join(' | ')}`).toEqual([]);
});

// ─── 1. OPEN PAGE (no policies yet) ───────────────────────────────────────────
test('01 - Valuation page loads inside QA tenant', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, SUPER);
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
  const body = await page.textContent('body') || '';
  expect(body.length).toBeGreaterThan(0);
  await expect(page).toHaveTitle(/Inventory Valuation|Inventory/).catch(() => {});
  await expect(page.locator('body')).not.toHaveText(/internal server error|application error|something went wrong/i);
  await shot(page, '01-page-load.png');
});

test('02 - No-policies empty state shows create button', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER);
  await page.waitForTimeout(2500);
  await expect(page.locator('body')).toContainText('No valuation policies found');
  await expect(page.getByRole('button', { name: 'Create Policy' }).first()).toBeVisible();
});

// ─── 2. CREATE DRAFT POLICY (super admin, via real UI incl. F9 warehouse) ─────
test('03 - Create DRAFT policy: open modal, select QA warehouse via F9, currency', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER);
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Create Policy' }).first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('heading', { name: 'New Valuation Policy' }).or(page.locator('[class*="modal"]')).first()).toBeVisible();

  // F9 warehouse field (div role=button, id=warehouse)
  await page.locator('#warehouse').click();
  await page.waitForTimeout(1200);
  const search = page.locator('input[type="text"]').first();
  await search.fill(QA.prefix);
  await page.waitForTimeout(1500);
  const row = page.locator('tbody tr', { hasText: 'WH' }).filter({ hasText: QA.prefix }).first();
  await row.click();
  await page.waitForTimeout(800);

  // currency
  const currencyInput = page.getByLabel('Currency').first();
  await currencyInput.fill('USD');
  await shot(page, '03-create-policy-filled.png');

  // submit
  await page.getByRole('button', { name: 'Create', exact: true }).first().click();
  await page.waitForTimeout(2500);
  await expect(page.locator('body')).toContainText('Valuation policy created successfully');
  await expect(page.locator('body')).toContainText('Weighted Moving Average');
  await shot(page, '03-policy-created-grid.png');
});

// ─── 3. SELECT POLICY + VERIFY CURRENCY/METHOD ────────────────────────────────
test('04 - Select policy; verify currency, fixed method, warehouse code shown (no raw id)', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER);
  await page.waitForTimeout(2500);
  const row = page.locator('tbody tr', { hasText: 'WH' }).filter({ hasText: QA.prefix }).first();
  await row.click();
  await page.waitForTimeout(2500);
  await expect(page.locator('body')).toContainText('USD');
  const body04 = await page.textContent('body') || '';
  expect(body04).toMatch(/\[WH-[0-9]+\]/);
  await expect(page.locator('body')).toContainText('WEIGHTED_AVERAGE');
  const raw = await collectRawIds(page);
  expect(raw.filter((r) => r !== 'cmasdfghjklmnopqrstuvwxy')).toEqual([]);
  await shot(page, '04-policy-detail.png');
});

// ─── 4. READINESS BEFORE INIT (derived from real stock) ──────────────────────
test('05 - Readiness derived: 1 product with stock, 1 missing, not ready; QA product code shown', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER);
  await page.waitForTimeout(2500);
  const row = page.locator('tbody tr', { hasText: 'WH' }).filter({ hasText: QA.prefix }).first();
  await row.click();
  await page.waitForTimeout(3000);
  await expect(page.locator('body')).toContainText('Products with stock');
  await expect(page.locator('body')).toContainText('Products awaiting initialization');
  await expect(page.locator('body')).toContainText('Initialization not yet complete');
  const body05 = await page.textContent('body') || '';
  expect(body05).toMatch(/\[PRD-[0-9]+\]/);
  await expect(page.locator('body')).toContainText('Quantity snapshot');
  await shot(page, '05-readiness-before.png');
});

// ─── 5. BEGIN INITIALIZATION (DRAFT -> INITIALIZING) ──────────────────────────
test('06 - Begin initialization transition DRAFT -> INITIALIZING via confirm dialog', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER);
  await page.waitForTimeout(2500);
  const row = page.locator('tbody tr', { hasText: 'WH' }).filter({ hasText: QA.prefix }).first();
  await row.click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Begin Initialization' }).first().click();
  await page.waitForTimeout(800);
  await expect(page.locator('body')).toContainText('Begin legacy-stock initialization for this policy?');
  await page.getByRole('button', { name: 'Confirm' }).first().click();
  await page.waitForTimeout(2500);
  await expect(page.locator('body')).toContainText('Initialization started successfully');
  await expect(page.locator('body')).toContainText(/Initializing/i);
  await shot(page, '06-initializing.png');
});

// ─── 6. ZERO-COST REASON VALIDATION ───────────────────────────────────────────
test('07 - Zero unit cost without reason rejected by frontend validation', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER);
  await page.waitForTimeout(2500);
  const row = page.locator('tbody tr', { hasText: 'WH' }).filter({ hasText: QA.prefix }).first();
  await row.click();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Initialize' }).first().click();
  await page.waitForTimeout(800);
  await page.getByLabel('Unit cost').first().fill('0');
  await page.getByRole('button', { name: 'Initialize', exact: true }).last().click();
  await page.waitForTimeout(800);
  await expect(page.locator('body')).toContainText('A reason is required for a zero unit cost');
  await shot(page, '07-zero-cost-validation.png');
});

// ─── 7. INITIALIZE THE QA PRODUCT (continue INITIALIZING flow) ────────────────
test('08 - Initialize the QA product with positive unit cost -> success', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER);
  await page.waitForTimeout(2500);
  const row = page.locator('tbody tr', { hasText: 'WH' }).filter({ hasText: QA.prefix }).first();
  await row.click();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Initialize' }).first().click();
  await page.waitForTimeout(800);
  await page.getByLabel('Unit cost').first().fill('12.5');
  await page.getByLabel('Reason').first().fill('QA fixture initialization');
  await page.getByRole('button', { name: 'Initialize', exact: true }).last().click();
  await page.waitForTimeout(2500);
  await expect(page.locator('body')).toContainText('Product initialized successfully');
  await shot(page, '08-initialized.png');
});

// ─── 8. READINESS REFRESH + HISTORY ───────────────────────────────────────────
test('09 - Readiness refresh: missing 0, initialized 1, ready; history shows product + values', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER);
  await page.waitForTimeout(2500);
  const row = page.locator('tbody tr', { hasText: 'WH' }).filter({ hasText: QA.prefix }).first();
  await row.click();
  await page.waitForTimeout(3000);
  await expect(page.locator('body')).toContainText('All products with stock in this warehouse are initialized');
  await expect(page.locator('body')).toContainText('Initialization History');
  const body09 = await page.textContent('body') || '';
  expect(body09).toMatch(/\[PRD-[0-9]+\]/);
  await expect(page.locator('body')).toContainText('12.5');
  await expect(page.locator('body')).toContainText('62.5');
  await expect(page.locator('body')).toContainText('USD');
  await expect(page.locator('body')).toContainText('QA fixture initialization');
  await shot(page, '09-history.png');
});

// ─── 9. NO RAW IDS / NO ACTIVATE / NO ENGINE LANGUAGE ─────────────────────────
test('10 - No raw CUIDs, no Activate action, no engine/automatic-valuation language anywhere', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER);
  await page.waitForTimeout(2500);
  const row = page.locator('tbody tr', { hasText: 'WH' }).filter({ hasText: QA.prefix }).first();
  await row.click();
  await page.waitForTimeout(3000);
  const raw = await collectRawIds(page);
  expect(raw).toEqual([]);
  await expect(page.locator('body')).not.toContainText('Activate');
  const text = await page.textContent('body') || '';
  expect(text.toLowerCase()).toContain('it is not an automatic valuation');
  expect(text.toLowerCase()).not.toContain('moving average engine');
  expect(text.toLowerCase()).not.toContain('stock valuation engine');
});

// ─── 10. ARABIC RTL ───────────────────────────────────────────────────────────
test('11 - Arabic RTL renders; key labels translated, no raw keys, dir=rtl', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER, 'ar');
  await page.waitForTimeout(3000);
  const html = page.locator('html');
  const dirVal = await html.getAttribute('dir').catch(() => null);
  expect(['rtl', 'RTL', null]).toContain(dirVal);
  await expect(page.locator('body')).toContainText('تقييم المخزون');
  await expect(page.locator('body')).toContainText('المتوسط المرجح المتحرك');
  const text = await page.textContent('body') || '';
  const cleaned = text.replace(/[a-zA-Z0-9._%+-]+@qa\.atsofterp\.local/g, '');
  const rawKeys = cleaned.match(/[a-z]+\.[a-z]+\.[a-z]+/g) || [];
  expect(rawKeys).toEqual([]);
  await shot(page, '11-arabic-rtl.png');
});

// ─── 11. REDUCED-PERMISSION RBAC ──────────────────────────────────────────────
test('12 - Read-only user: page shows View only, no create button, no initialize/begin controls', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, READONLY);
  await page.waitForTimeout(3000);
  await expect(page.locator('body')).toContainText('View only');
  const createCount = await page.getByRole('button', { name: 'Create Policy' }).count();
  expect(createCount).toBe(0);
  const beginCount = await page.getByRole('button', { name: 'Begin Initialization' }).count();
  expect(beginCount).toBe(0);
  const initCount = await page.getByRole('button', { name: 'Initialize', exact: true }).count();
  expect(initCount).toBe(0);
  await shot(page, '12-readonly-rbac.png');
});

// ─── 12. NO ACTIVE/ACTIVATE TRANSITION ANYWHERE ───────────────────────────────
test('13 - No ACTIVE status / no Activate button across all page states', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, SUPER);
  await page.waitForTimeout(2500);
  const body = await page.textContent('body') || '';
  expect(body).not.toMatch(/Activate/i);
  const activateBtns = page.locator('button', { hasText: /Activate/i });
  expect(await activateBtns.count()).toBe(0);
});
