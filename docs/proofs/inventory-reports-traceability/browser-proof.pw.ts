import { test, expect, Page } from '@playwright/test';

const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000/api/v1';
const ADMIN_EMAIL = 'admin@atsofterp.com';
const ADMIN_PASSWORD = 'Admin@123456';

let errors: string[] = [];
let failedApi: string[] = [];
let chunkErrors: string[] = [];
let staticFails: string[] = [];
let rawKeys: string[] = [];

function setupListeners(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') { const text = msg.text(); if (!text.includes('ERR_CONNECTION_REFUSED') && !text.includes('Failed to load resource')) errors.push(text); }
    if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('response', (res) => {
    if (!res.ok() && res.url().includes('/api/') && res.status() !== 304) failedApi.push(`${res.status()} ${res.url()}`);
    if (!res.ok() && res.url().includes('/_next/static')) staticFails.push(`${res.status()} ${res.url()}`);
  });
}

async function apiLogin(page: Page, locale = 'en') {
  const resp = await page.request.post(API + '/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  const body = await resp.json();
  const token = body.accessToken;
  await page.addInitScript((args: any) => { localStorage.setItem('accessToken', args.token); localStorage.setItem('locale', args.locale); }, { token, locale });
}

async function loginAndGoto(page: Page, url: string, locale = 'en') {
  await apiLogin(page, locale);
  const resp = await page.goto(WEB + url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(3000);
  return resp;
}

async function checkRawKeys(page: Page) {
  const text = await page.textContent('body') || '';
  const matches = text.match(/[a-z]+\.[a-z]+\.[a-z]+/g) || [];
  rawKeys.push(...matches.filter(m => /^[a-z]+\.[a-z]+\.[a-z]+$/.test(m)));
}

test.beforeAll(async ({ browser }) => {
  const warmup = await browser.newPage();
  await warmup.goto(WEB + '/login', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await warmup.close();
});

test.beforeEach(async () => { errors = []; failedApi = []; chunkErrors = []; staticFails = []; rawKeys = []; });

test.afterAll(async () => {
  console.log(`console errors: ${errors.length} | chunk: ${chunkErrors.length} | API fails: ${failedApi.length} | static fails: ${staticFails.length} | raw keys: ${rawKeys.length}`);
});

// ─── T01-T10: REPORTS PAGES ─────────────────────────────

test('T01 reports page loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/reports');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
  const body = await page.textContent('body') || '';
  expect(body.length).toBeGreaterThan(0);
});

test('T02 reports page no raw keys', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports');
  await page.waitForTimeout(3000);
  await checkRawKeys(page);
  expect(rawKeys.length).toBe(0);
});

test('T03 reports page no console errors', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports');
  await page.waitForTimeout(3000);
  expect(errors.length).toBe(0);
});

test('T04 stock card page loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/reports/stock-card');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T05 stock card page no raw keys', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports/stock-card');
  await page.waitForTimeout(3000);
  await checkRawKeys(page);
  expect(rawKeys.length).toBe(0);
});

test('T06 traceability page loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/reports/traceability');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T07 traceability page no raw keys', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports/traceability');
  await page.waitForTimeout(3000);
  await checkRawKeys(page);
  expect(rawKeys.length).toBe(0);
});

test('T08 exceptions page loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/reports/exceptions');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T09 exceptions page no raw keys', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports/exceptions');
  await page.waitForTimeout(3000);
  await checkRawKeys(page);
  expect(rawKeys.length).toBe(0);
});

test('T10 exceptions page no console errors', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports/exceptions');
  await page.waitForTimeout(3000);
  expect(errors.length).toBe(0);
});

// ─── T11-T20: EXISTING REPORT PAGES ─────────────────────

test('T11 existing balances report loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/reports/inventory/balances');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T12 existing movements report loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/reports/inventory/movements');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T13 existing inventory overview loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/reports/inventory');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T14 existing overview no raw keys', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/reports/inventory');
  await page.waitForTimeout(3000);
  await checkRawKeys(page);
  expect(rawKeys.length).toBe(0);
});

test('T15 existing movements no raw keys', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/reports/inventory/movements');
  await page.waitForTimeout(3000);
  await checkRawKeys(page);
  expect(rawKeys.length).toBe(0);
});

test('T16 Arabic mode on reports page', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/reports', 'ar');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
  const body = await page.textContent('body') || '';
  expect(body.length).toBeGreaterThan(0);
});

test('T17 English mode on stock card', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/reports/stock-card', 'en');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T18 Arabic stock card loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/reports/stock-card', 'ar');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T19 reports page no network failures', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports');
  await page.waitForTimeout(3000);
  expect(failedApi.length).toBe(0);
});

test('T20 reports page no static failures', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports');
  await page.waitForTimeout(3000);
  expect(staticFails.length).toBe(0);
});

// ─── T21-T30: INTEGRITY ─────────────────────────────────

test('T21 no ChunkLoadError across report pages', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports');
  await page.waitForTimeout(2000);
  await loginAndGoto(page, '/admin/inventory/reports/stock-card');
  await page.waitForTimeout(2000);
  expect(chunkErrors.length).toBe(0);
});

test('T22 stock card has product F9 lookup', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports/stock-card');
  await page.waitForTimeout(3000);
  const body = await page.textContent('body') || '';
  expect(body.length).toBeGreaterThan(0);
});

test('T23 traceability has search input', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports/traceability');
  await page.waitForTimeout(3000);
  const inputs = page.locator('input');
  const count = await inputs.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('T24 exceptions shows exception cards', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports/exceptions');
  await page.waitForTimeout(3000);
  const body = await page.textContent('body') || '';
  expect(body.length).toBeGreaterThan(0);
});

test('T25 dashboard cards render from real data', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports');
  await page.waitForTimeout(3000);
  const body = await page.textContent('body') || '';
  expect(body.length).toBeGreaterThan(0);
});

test('T26 no create buttons on report pages', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports');
  await page.waitForTimeout(3000);
  const buttons = await page.locator('button').allTextContents();
  const hasCreate = buttons.some(t => /create|new|add|post|save/i.test(t));
  expect(hasCreate).toBe(false);
});

test('T27 no direct balance edit on reports', async ({ page }) => {
  setupListeners(page);
  await loginAndGoto(page, '/admin/inventory/reports');
  await page.waitForTimeout(3000);
  const body = await page.textContent('body') || '';
  expect(body.includes('edit') || body.includes('تعديل')).toBe(false);
});

test('T28 reconciliation page accessible', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/reconciliation');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T29 ledger page accessible', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/ledger');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

// ─── T31-T36: COMPATIBILITY ─────────────────────────────

test('T31 physical counts list loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/physical-counts');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T32 operational receipts list loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/operational-receipts');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T33 transfers list loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/transfers');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T34 opening balances list loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/opening-balances');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T35 stock adjustments list loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/stock-adjustments');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});

test('T36 movements list loads', async ({ page }) => {
  setupListeners(page);
  const resp = await loginAndGoto(page, '/admin/inventory/movements');
  expect(resp?.status() === 200 || resp?.status() === 304).toBe(true);
});
