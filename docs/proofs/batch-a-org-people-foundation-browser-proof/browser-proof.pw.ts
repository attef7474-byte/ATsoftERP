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

let errors: string[] = [];
let pageErrors: string[] = [];
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
}

async function seedSession(page: Page, locale = 'en') {
  const resp = await page.request.post(API + '/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(resp.ok()).toBe(true);
  const body = await resp.json();
  const token = body.accessToken;
  const context = { companyId: TEST_COMPANY, branchId: TEST_BRANCH, administrationId: null, departmentId: null };
  const stored = { version: 1, userId: USER_ID, context };
  await page.addInitScript((args: any) => {
    localStorage.setItem('accessToken', args.token);
    localStorage.setItem('locale', args.locale);
    localStorage.setItem('atsoft.erp.operational-context.current-user', args.userId);
    localStorage.setItem(`atsoft.erp.operational-context.user.${args.userId}`, JSON.stringify(args.stored));
  }, { token, locale, userId: USER_ID, stored });
}

async function gotoPage(page: Page, path: string, locale = 'en') {
  await seedSession(page, locale);
  const resp = await page.goto(WEB + path, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(3500);
  return resp;
}

async function checkRawKeys(page: Page) {
  const text = await page.textContent('body') || '';
  const matches = text.match(/[a-z]+\.[a-z]+\.[a-z]+/g) || [];
  rawKeys.push(...matches.filter((m) => /^[a-z]+\.[a-z]+\.[a-z]+$/.test(m)));
}

function resetTracking() {
  errors = [];
  pageErrors = [];
  rawKeys = [];
}

test.describe('Batch A — Job Titles', () => {
  test('Job Titles list page loads in English', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/job-titles', 'en');
    await checkRawKeys(page);
    const heading = await page.textContent('h1');
    expect(heading).toContain('Job Titles');
    expect(pageErrors).toHaveLength(0);
  });

  test('Job Titles list page loads in Arabic RTL', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/job-titles', 'ar');
    await checkRawKeys(page);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');
    const heading = await page.textContent('h1');
    expect(heading).toContain('المسميات');
    expect(pageErrors).toHaveLength(0);
  });
});

test.describe('Batch A — Person Assignments', () => {
  test('Person Assignments list page loads in English', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/person-assignments', 'en');
    await checkRawKeys(page);
    const heading = await page.textContent('h1');
    expect(heading).toContain('Person Assignment');
    expect(pageErrors).toHaveLength(0);
  });

  test('Person Assignments list page loads in Arabic RTL', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/person-assignments', 'ar');
    await checkRawKeys(page);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');
    const heading = await page.textContent('h1');
    expect(heading).toContain('تعيينات');
    expect(pageErrors).toHaveLength(0);
  });
});

test.describe('Batch A — Supervisor Assignments', () => {
  test('Supervisor Assignments list page loads in English', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/supervisor-assignments', 'en');
    await checkRawKeys(page);
    const heading = await page.textContent('h1');
    expect(heading).toContain('Supervisor Assignment');
    expect(pageErrors).toHaveLength(0);
  });

  test('Supervisor Assignments list page loads in Arabic RTL', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/supervisor-assignments', 'ar');
    await checkRawKeys(page);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');
    const heading = await page.textContent('h1');
    expect(heading).toContain('تعيينات المشرفين');
    expect(pageErrors).toHaveLength(0);
  });
});

test.describe('Batch A — Persons List', () => {
  test('Persons list page loads in English', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/persons', 'en');
    await checkRawKeys(page);
    const heading = await page.textContent('h1');
    expect(heading).toContain('Persons');
    expect(pageErrors).toHaveLength(0);
  });

  test('Persons list page loads in Arabic RTL', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/persons', 'ar');
    await checkRawKeys(page);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');
    expect(pageErrors).toHaveLength(0);
  });
});

test.describe('Batch A — Department Classification', () => {
  test('Departments page loads with classification column in English', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/departments', 'en');
    await checkRawKeys(page);
    const heading = await page.textContent('h1');
    expect(heading).toContain('Department');
    const text = await page.textContent('body') || '';
    expect(text).toContain('Classification');
    expect(pageErrors).toHaveLength(0);
  });

  test('Departments page loads with classification in Arabic RTL', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/departments', 'ar');
    await checkRawKeys(page);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');
    const text = await page.textContent('body') || '';
    expect(text).toContain('التصنيف');
    expect(pageErrors).toHaveLength(0);
  });
});

test.describe('Batch A — No Raw Translation Keys', () => {
  test('Job Titles has no raw translation keys in English', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/job-titles', 'en');
    await checkRawKeys(page);
    expect(rawKeys).toHaveLength(0);
  });

  test('Person Assignments has no raw translation keys in English', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/person-assignments', 'en');
    await checkRawKeys(page);
    expect(rawKeys).toHaveLength(0);
  });

  test('Supervisor Assignments has no raw translation keys in English', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/supervisor-assignments', 'en');
    await checkRawKeys(page);
    expect(rawKeys).toHaveLength(0);
  });

  test('Persons has no raw translation keys in English', async ({ page }) => {
    resetTracking();
    await gotoPage(page, '/admin/core/persons', 'en');
    await checkRawKeys(page);
    expect(rawKeys).toHaveLength(0);
  });
});
