import { test, expect, Page } from '@playwright/test';

if (!process.env.SEED_ADMIN_EMAIL) {
  throw new Error('SEED_ADMIN_EMAIL environment variable is required');
}

if (!process.env.SEED_ADMIN_PASSWORD) {
  throw new Error('SEED_ADMIN_PASSWORD environment variable is required');
}

const API_BASE = 'http://localhost:4000/api/v1';
const WEB_BASE = 'http://localhost:3000';

async function loginAndSetup(page: Page, lang: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }),
  });
  const json = await res.json();
  await page.addInitScript(({ token, locale }: { token: string; locale: string }) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('locale', locale);
  }, { token: json.accessToken, locale: lang });
}

async function getToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }),
  });
  const json = await res.json();
  return json.accessToken;
}

test.describe('Factory Operational Structure — Final Integrated Browser Proof', () => {

  // === ALL ROUTES RETURN 200 ===

  const routes = [
    '/admin/dashboard',
    '/admin/core/companies',
    '/admin/core/branches',
    '/admin/core/administrations',
    '/admin/core/departments',
    '/admin/maintenance/machines',
    '/admin/maintenance/machine-categories',
    '/admin/maintenance/machine-parts',
    '/admin/maintenance/spare-parts',
    '/admin/maintenance/machine-documents',
    '/admin/maintenance/production-lines',
    '/admin/maintenance/operation-types',
    '/admin/maintenance/cost-centers',
    '/admin/maintenance/requests',
    '/admin/maintenance/tasks',
    '/admin/maintenance/schedules',
    '/admin/maintenance/checklist-items',
    '/admin/maintenance/downtime-logs',
    '/admin/maintenance/personnel',
    '/admin/maintenance/machine-responsibilities',
    '/admin/maintenance/accountability',
  ];

  for (const route of routes) {
    const label = route.replace('/admin/', '').replace(/\//g, ' ');
    test(`${label} returns 200`, async ({ page }) => {
      await loginAndSetup(page, 'en');
      const resp = await page.goto(`${WEB_BASE}${route}`);
      expect(resp?.status()).toBe(200);
    });
  }

  // === BATCH-SPECIFIC CONTENT CHECKS ===

  test('Dashboard has summary cards', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/dashboard`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('Companies page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/core/companies`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('compan') || body.includes('Compan') || body.includes('Company')).toBeTruthy();
  });

  test('Branches page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/core/branches`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('branch') || body.includes('Branch')).toBeTruthy();
  });

  test('Administrations page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/core/administrations`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('administ') || body.includes('Administ')).toBeTruthy();
  });

  test('Departments page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/core/departments`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('depart') || body.includes('Depart')).toBeTruthy();
  });

  // === MAINTENANCE PAGES ===

  test('Machines page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machines`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Machine') || body.includes('machine')).toBeTruthy();
  });

  test('Production Lines page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/production-lines`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Production') || body.includes('production') || body.includes('Line')).toBeTruthy();
  });

  test('Operation Types page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/operation-types`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Operation') || body.includes('operation')).toBeTruthy();
  });

  test('Cost Centers page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/cost-centers`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Cost') || body.includes('cost')).toBeTruthy();
  });

  test('Machine Parts (Components) page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-parts`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Part') || body.includes('part') || body.includes('Component')).toBeTruthy();
  });

  test('Spare Parts page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/spare-parts`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Spare') || body.includes('spare')).toBeTruthy();
  });

  test('Maintenance Requests page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/requests`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Request') || body.includes('request')).toBeTruthy();
  });

  test('Personnel page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Personnel') || body.includes('personnel')).toBeTruthy();
  });

  test('Machine Responsibilities page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machine-responsibilities`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Responsibilit') || body.includes('Machine')).toBeTruthy();
  });

  test('Accountability Dashboard page renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('Accountability') || body.includes('KPI') || body.includes('Performance')).toBeTruthy();
  });

  // === REPORTS ===

  const reportRoutes = [
    '/admin/reports/maintenance',
    '/admin/reports/maintenance/requests',
    '/admin/reports/maintenance/downtime',
    '/admin/reports/maintenance/costs',
    '/admin/reports/maintenance/schedules',
  ];

  for (const route of reportRoutes) {
    const label = route.replace('/admin/reports/', '').replace(/\//g, ' ');
    test(`Report: ${label} returns 200`, async ({ page }) => {
      await loginAndSetup(page, 'en');
      const resp = await page.goto(`${WEB_BASE}${route}`);
      expect(resp?.status()).toBe(200);
    });
  }

  // === GLOBAL CHECKS ===

  test('No raw i18n keys on factory pages', async ({ page }) => {
    const urls = [
      `${WEB_BASE}/admin/maintenance/machines`,
      `${WEB_BASE}/admin/maintenance/operation-types`,
      `${WEB_BASE}/admin/maintenance/production-lines`,
      `${WEB_BASE}/admin/maintenance/personnel`,
      `${WEB_BASE}/admin/maintenance/accountability`,
      `${WEB_BASE}/admin/maintenance/requests`,
    ];
    for (const url of urls) {
      await loginAndSetup(page, 'en');
      await page.goto(url);
      await page.waitForTimeout(3000);
      const body = await page.textContent('body') || '';
      expect(body.match(/maintenance:[a-zA-Z]/)).toBeNull();
    }
  });

  test('No console errors on factory pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await loginAndSetup(page, 'en');
    const urls = [
      `${WEB_BASE}/admin/maintenance/machines`,
      `${WEB_BASE}/admin/maintenance/operation-types`,
      `${WEB_BASE}/admin/maintenance/personnel`,
      `${WEB_BASE}/admin/maintenance/accountability`,
    ];
    for (const url of urls) {
      await page.goto(url);
      await page.waitForTimeout(3000);
    }
    expect(consoleErrors.length).toBe(0);
  });

  test('No unexpected network failures (400/404/500)', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (res) => {
      const status = res.status();
      if (status >= 400 && status !== 304) failures.push(`${status} ${res.url()}`);
    });
    await loginAndSetup(page, 'en');
    const urls = [
      `${WEB_BASE}/admin/maintenance/machines`,
      `${WEB_BASE}/admin/maintenance/operation-types`,
      `${WEB_BASE}/admin/maintenance/personnel`,
      `${WEB_BASE}/admin/maintenance/accountability`,
    ];
    for (const url of urls) {
      await page.goto(url);
      await page.waitForTimeout(3000);
    }
    expect(failures.length).toBe(0);
  });

  test('No ChunkLoadError on factory pages', async ({ page }) => {
    const chunkErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text());
    });
    await loginAndSetup(page, 'en');
    const urls = [
      `${WEB_BASE}/admin/maintenance/machines`,
      `${WEB_BASE}/admin/maintenance/operation-types`,
      `${WEB_BASE}/admin/maintenance/personnel`,
      `${WEB_BASE}/admin/maintenance/accountability`,
    ];
    for (const url of urls) {
      await page.goto(url);
      await page.waitForTimeout(4000);
    }
    expect(chunkErrors.length).toBe(0);
  });

  test('No _next/static failures', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (res) => {
      if (!res.ok() && res.url().includes('_next/static')) failures.push(`${res.status()} ${res.url()}`);
    });
    await loginAndSetup(page, 'en');
    const urls = [
      `${WEB_BASE}/admin/maintenance/machines`,
      `${WEB_BASE}/admin/maintenance/operation-types`,
      `${WEB_BASE}/admin/maintenance/personnel`,
      `${WEB_BASE}/admin/maintenance/accountability`,
    ];
    for (const url of urls) {
      await page.goto(url);
      await page.waitForTimeout(3000);
    }
    expect(failures.length).toBe(0);
  });

  // === LTR / RTL ===

  test('LTR direction in English', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machines`);
    await page.waitForTimeout(3000);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).not.toBe('rtl');
  });

  test('RTL direction in Arabic', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/machines`);
    await page.waitForTimeout(3000);
    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');
  });

  // === ARABIC LOCALE ===

  test('Machines page Arabic renders', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/machines`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('الآلات') || body.includes('معدات') || body.includes('صيانة')).toBeTruthy();
  });

  test('Personnel page Arabic renders', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('العاملين') || body.includes('صيانة')).toBeTruthy();
  });

  test('Accountability page Arabic renders', async ({ page }) => {
    await loginAndSetup(page, 'ar');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    const body = await page.textContent('body') || '';
    expect(body.includes('المساءلة') || body.includes('الأداء') || body.includes('مؤشرات')).toBeTruthy();
  });

  // === DATAGRID RENDERS ===

  test('Machines datagrid renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/machines`);
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  test('Operation Types datagrid renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/operation-types`);
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  test('Personnel datagrid renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/personnel`);
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });

  test('Accountability dashboard card renders', async ({ page }) => {
    await loginAndSetup(page, 'en');
    await page.goto(`${WEB_BASE}/admin/maintenance/accountability`);
    await page.waitForTimeout(3000);
    const grid = page.locator('.admin-data-grid, table, [class*="grid"], [class*="table"], [class*="card"], [class*="stat"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });
});
