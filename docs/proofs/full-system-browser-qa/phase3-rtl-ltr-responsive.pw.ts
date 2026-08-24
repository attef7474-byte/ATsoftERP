import { test as base, expect, Page, BrowserContext } from '@playwright/test';

const BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:4000/api/v1';
const SCREENSHOT_DIR = 'docs/proofs/full-system-browser-qa/screenshots';

const COMPANY_ID = 'cmrl31uuy0000ok959hdjnca6';
const BRANCH_ID = 'cmrx06a560000ng95g7d65vzh';

type QAFixtures = {
  arabicPage: Page;
  englishPage: Page;
};

const ALL_ROUTES = [
  '/admin/dashboard',
  '/admin/core/companies',
  '/admin/core/branches',
  '/admin/core/administrations',
  '/admin/core/departments',
  '/admin/core/organizational-units',
  '/admin/core/persons',
  '/admin/core/job-titles',
  '/admin/core/person-assignments',
  '/admin/core/supervisor-assignments',
  '/admin/maintenance/production-lines',
  '/admin/maintenance/operation-types',
  '/admin/maintenance/cost-centers',
  '/admin/access/users',
  '/admin/access/roles',
  '/admin/access/permissions',
  '/admin/maintenance/machines',
  '/admin/maintenance/machine-categories',
  '/admin/maintenance/machine-documents',
  '/admin/maintenance/machine-components',
  '/admin/maintenance/machine-parts',
  '/admin/maintenance/requests',
  '/admin/maintenance/work-orders',
  '/admin/maintenance/tasks',
  '/admin/maintenance/schedules',
  '/admin/maintenance/checklist-items',
  '/admin/maintenance/downtime-logs',
  '/admin/maintenance/calendar',
  '/admin/maintenance/workload',
  '/admin/maintenance/sla',
  '/admin/maintenance/reliability/mttr',
  '/admin/maintenance/personnel',
  '/admin/maintenance/machine-responsibilities',
  '/admin/maintenance/accountability',
  '/admin/maintenance/spare-parts',
  '/admin/spare-part-conditions',
  '/admin/installed-parts',
  '/admin/maintenance/repair-orders',
  '/admin/maintenance/bom',
  '/admin/maintenance/spare-part-plans',
  '/admin/inventory/warehouses',
  '/admin/inventory/locations',
  '/admin/inventory/product-categories',
  '/admin/inventory/products',
  '/admin/inventory/opening-balances',
  '/admin/inventory/movements',
  '/admin/inventory/counts',
  '/admin/inventory/adjustments',
  '/admin/inventory/stock-adjustments',
  '/admin/inventory/locks',
  '/admin/inventory/balances',
  '/admin/inventory/ledger',
  '/admin/inventory/reconciliation',
  '/admin/inventory/governance-audit',
  '/admin/production/units',
  '/admin/production/product-definitions',
  '/admin/production/shifts',
  '/admin/production/shift-templates',
  '/admin/production/shift-calendars',
  '/admin/production/shift-assignments',
  '/admin/production/operational-assignments',
  '/admin/production/shift-handovers',
  '/admin/production/capacity-standards',
  '/admin/production/orders',
  '/admin/production/runs',
  '/admin/production/measurement-points',
  '/admin/production/loss-reasons',
  '/admin/production/downtime',
  '/admin/production/losses',
  '/admin/production/material-documents',
  '/admin/production/material-requirements',
  '/admin/production/finished-goods-receipts',
  '/admin/production/quality/plans',
  '/admin/production/quality/inspections',
  '/admin/production/quality/ncrs',
  '/admin/production/cost/rates',
  '/admin/production/cost/snapshots',
  '/admin/production/cost/transactions',
  '/admin/production/performance-targets',
  '/admin/production/analytics',
  '/admin/production/reliability',
  '/admin/barcodes',
  '/admin/barcodes/generate',
  '/admin/barcodes/print',
  '/admin/barcodes/scan',
  '/admin/barcodes/preview',
  '/admin/barcodes/records',
  '/admin/barcodes/templates',
  '/admin/barcodes/product-labels',
  '/admin/barcodes/machine-cards',
  '/admin/barcodes/scans',
  '/admin/barcodes/print-jobs',
  '/admin/reports',
  '/admin/reports/operations',
  '/admin/reports/maintenance',
  '/admin/reports/maintenance/kpis',
  '/admin/reports/maintenance/requests',
  '/admin/reports/maintenance/downtime',
  '/admin/reports/maintenance/costs',
  '/admin/reports/maintenance/schedules',
  '/admin/reports/assets',
  '/admin/reports/machine-log',
  '/admin/reports/parts-usage',
  '/admin/reports/upcoming-preventive',
  '/admin/reports/overdue-preventive',
  '/admin/reports/parts',
  '/admin/reports/low-stock',
  '/admin/reports/inventory',
  '/admin/reports/inventory/balances',
  '/admin/reports/inventory/movements',
  '/admin/reports/inventory/adjustments',
  '/admin/reports/inventory/count-variance',
  '/admin/reports/barcodes/scans',
  '/admin/reports/audit',
  '/admin/reports/user-activity',
  '/admin/reports/notifications',
  '/admin/reports/attachments',
  '/admin/reports/partners',
  '/admin/documents/attachments',
  '/admin/settings',
  '/admin/settings/company',
  '/admin/settings/language',
  '/admin/settings/appearance',
  '/admin/settings/security',
  '/admin/settings/numbering',
  '/admin/settings/notification-rules',
  '/admin/settings/audit',
  '/admin/settings/audit/user-activity',
  '/admin/settings/audit/login-history',
  '/admin/notifications',
  '/admin/messaging',
];

const RESPONSIVE_ROUTES = [
  '/admin/dashboard',
  '/admin/core/companies',
  '/admin/maintenance/machines',
  '/admin/maintenance/requests',
  '/admin/inventory/warehouses',
  '/admin/production/shifts',
  '/admin/reports',
  '/admin/settings',
  '/admin/access/users',
  '/admin/inventory/movements',
];

const ENGLISH_SAMPLE_ROUTES = [
  '/admin/dashboard',
  '/admin/core/companies',
  '/admin/core/departments',
  '/admin/maintenance/machines',
  '/admin/maintenance/requests',
  '/admin/inventory/warehouses',
  '/admin/inventory/products',
  '/admin/production/shifts',
  '/admin/access/users',
  '/admin/access/roles',
  '/admin/settings',
  '/admin/reports',
  '/admin/maintenance/spare-parts',
  '/admin/barcodes',
];

async function loginWithLocale(page: Page, locale: 'ar' | 'en') {
  const context = page.context();
  await context.addCookies([
    { name: 'atsoft_locale', value: locale, domain: 'localhost', path: '/' },
  ]);
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'admin@atsofterp.com');
  await page.fill('input[type="password"], input[name="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/**', { timeout: 20000 });
  await page.waitForLoadState('networkidle');
}

function isArabic(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

function containsLatinFragments(text: string): string[] {
  const fragments: string[] = [];
  const words = text.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[0-9]/g, '').replace(/[^\w]/g, '');
    if (clean.length >= 3 && /^[a-zA-Z]+$/.test(clean) && !['API', 'URL', 'HTML', 'CSS', 'SQL', 'JWT', 'FAQ'].includes(clean)) {
      const lower = clean.toLowerCase();
      const knownTech = ['dashboard', 'search', 'filter', 'sort', 'page', 'loading', 'error', 'save', 'cancel', 'delete', 'edit', 'create', 'add', 'close', 'open', 'yes', 'no', 'ok', 'submit', 'reset', 'export', 'import', 'print', 'refresh', 'total', 'none'];
      if (!knownTech.includes(lower)) {
        fragments.push(clean);
      }
    }
  }
  return fragments;
}

const test = base.extend<QAFixtures>({
  arabicPage: async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'admin@atsofterp.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    const lang = await page.getAttribute('html', 'lang');
    if (lang !== 'ar') {
      await context.addCookies([
        { name: 'atsoft_locale', value: 'ar', domain: 'localhost', path: '/' },
      ]);
      await page.reload();
      await page.waitForLoadState('networkidle');
    }
    await use(page);
    await context.close();
  },
  englishPage: async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'admin@atsofterp.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    await context.addCookies([
      { name: 'atsoft_locale', value: 'en', domain: 'localhost', path: '/' },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await use(page);
    await context.close();
  },
});

test.describe('Phase 3: Arabic RTL Full Sweep', () => {
  test('Login page renders Arabic RTL', async ({ arabicPage }) => {
    const page = arabicPage;
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    const lang = await page.getAttribute('html', 'lang');
    const dir = await page.getAttribute('html', 'dir');
    expect(lang).toBe('ar');
    expect(dir).toBe('rtl');
    console.log(`[PASS] Login page: lang=${lang} dir=${dir}`);
  });

  for (const route of ALL_ROUTES) {
    test(`AR-RTL: ${route}`, async ({ arabicPage }) => {
      const page = arabicPage;
      const consoleErrors: string[] = [];
      const networkErrors: { url: string; status: number }[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('response', resp => {
        if (resp.status() >= 400 && !resp.url().includes('favicon') && !resp.url().includes('_next/static')) {
          networkErrors.push({ url: resp.url(), status: resp.status() });
        }
      });

      const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      expect(resp?.status(), `HTTP ${resp?.status()} on ${route}`).toBeLessThan(400);
      await page.waitForTimeout(3000);

      const htmlLang = await page.getAttribute('html', 'lang');
      const htmlDir = await page.getAttribute('html', 'dir');
      expect(htmlLang, `html lang should be ar on ${route}`).toBe('ar');
      expect(htmlDir, `html dir should be rtl on ${route}`).toBe('rtl');

      const sidebar = page.locator('aside, nav, [class*="sidebar"], [class*="Sidebar"]').first();
      if (await sidebar.isVisible().catch(() => false)) {
        const sidebarBox = await sidebar.boundingBox();
        if (sidebarBox) {
          const pageWidth = 1280;
          const sidebarRight = sidebarBox.x + sidebarBox.width;
          expect(sidebarRight, `Sidebar should be on right side (RTL) on ${route}`).toBeGreaterThanOrEqual(pageWidth - 10);
          console.log(`[RTL-SIDEBAR] ${route}: sidebar at x=${sidebarBox.x} right=${sidebarRight}`);
        }
      }

      const tables = page.locator('table');
      const tableCount = await tables.count();
      if (tableCount > 0) {
        const firstRow = tables.first().locator('thead th, thead td').first();
        if (await firstRow.isVisible().catch(() => false)) {
          const rowBox = await firstRow.boundingBox();
          if (rowBox) {
            console.log(`[RTL-TABLE] ${route}: first header at x=${rowBox.x}`);
          }
        }
      }

      const forms = page.locator('form, [role="form"]');
      const formCount = await forms.count();
      if (formCount > 0) {
        const firstInput = forms.first().locator('input, select, textarea').first();
        if (await firstInput.isVisible().catch(() => false)) {
          const inputBox = await firstInput.boundingBox();
          if (inputBox) {
            console.log(`[RTL-FORM] ${route}: first input at x=${inputBox.x}`);
          }
        }
      }

      const bodyText = await page.locator('body').textContent() || '';
      if (bodyText.length > 10) {
        const latinFragments = containsLatinFragments(bodyText);
        if (latinFragments.length > 0) {
          console.log(`[ARABIC-LATIN] ${route}: Latin fragments: ${latinFragments.slice(0, 5).join(', ')}`);
        }
        const hasArabic = isArabic(bodyText);
        console.log(`[ARABIC-CHECK] ${route}: hasArabic=${hasArabic} textLength=${bodyText.length}`);
      }

      if (consoleErrors.length > 0) {
        const appErrors = consoleErrors.filter(e =>
          !e.includes('favicon') &&
          !e.includes('404') &&
          !e.includes('DevTools') &&
          !e.includes('React DevTools')
        );
        if (appErrors.length > 0) {
          console.log(`[CONSOLE-ERROR] ${route}: ${appErrors[0].substring(0, 150)}`);
        }
      }

      const criticalNetworkErrors = networkErrors.filter(e =>
        !e.url.includes('favicon') &&
        !e.url.includes('_next/static') &&
        e.status >= 500
      );
      if (criticalNetworkErrors.length > 0) {
        console.log(`[NETWORK-ERROR] ${route}: ${criticalNetworkErrors[0].status} ${criticalNetworkErrors[0].url.substring(0, 100)}`);
      }
    });
  }
});

test.describe('Phase 3: Responsive Arabic (375x812)', () => {
  for (const route of RESPONSIVE_ROUTES) {
    test(`RESPONSIVE-AR: ${route}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const page = await context.newPage();

      await page.goto(`${BASE}/login`);
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'admin@atsofterp.com');
      await page.fill('input[type="password"], input[name="password"]', 'Admin@123456');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/admin/**', { timeout: 20000 });
      await page.waitForLoadState('networkidle');

      const lang = await page.getAttribute('html', 'lang');
      if (lang !== 'ar') {
        await context.addCookies([
          { name: 'atsoft_locale', value: 'ar', domain: 'localhost', path: '/' },
        ]);
        await page.reload();
        await page.waitForLoadState('networkidle');
      }

      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3000);

      const currentLang = await page.getAttribute('html', 'lang');
      const dir = await page.getAttribute('html', 'dir');
      expect(currentLang).toBe('ar');
      expect(dir).toBe('rtl');

      const bodyBox = await page.locator('body').boundingBox();
      if (bodyBox) {
        expect(bodyBox.width, `Body should not overflow on ${route}`).toBeLessThanOrEqual(375 + 50);
      }

      const offscreen = await page.evaluate(() => {
        const els = document.querySelectorAll('button, a, input, [role="button"]');
        let offscreenCount = 0;
        els.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right < -50 || rect.left > window.innerWidth + 50) {
            offscreenCount++;
          }
        });
        return offscreenCount;
      });
      console.log(`[RESPONSIVE] ${route}: offscreen controls=${offscreen}`);

      await context.close();
    });
  }
});

test.describe('Phase 3: English LTR Regression', () => {
  test('Login page renders English LTR', async ({ englishPage }) => {
    const page = englishPage;
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    const lang = await page.getAttribute('html', 'lang');
    const dir = await page.getAttribute('html', 'dir');
    expect(lang).toBe('en');
    expect(dir).toBe('ltr');
    console.log(`[PASS] Login EN: lang=${lang} dir=${dir}`);
  });

  for (const route of ENGLISH_SAMPLE_ROUTES) {
    test(`EN-LTR: ${route}`, async ({ englishPage }) => {
      const page = englishPage;
      const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      expect(resp?.status(), `HTTP ${resp?.status()} on ${route}`).toBeLessThan(400);
      await page.waitForTimeout(3000);

      const htmlLang = await page.getAttribute('html', 'lang');
      const htmlDir = await page.getAttribute('html', 'dir');
      expect(htmlLang, `html lang should be en on ${route}`).toBe('en');
      expect(htmlDir, `html dir should be ltr on ${route}`).toBe('ltr');

      const sidebar = page.locator('aside, nav, [class*="sidebar"], [class*="Sidebar"]').first();
      if (await sidebar.isVisible().catch(() => false)) {
        const sidebarBox = await sidebar.boundingBox();
        if (sidebarBox) {
          expect(sidebarBox.x, `Sidebar should be on left side (LTR) on ${route}`).toBeLessThanOrEqual(10);
          console.log(`[LTR-SIDEBAR] ${route}: sidebar at x=${sidebarBox.x}`);
        }
      }

      const bodyText = await page.locator('body').textContent() || '';
      if (bodyText.length > 10) {
        const hasArabic = isArabic(bodyText);
        if (hasArabic) {
          const arabicMatch = bodyText.match(/[\u0600-\u06FF]+/g);
          console.log(`[HARDCODED-ARABIC] ${route}: Arabic text found: ${arabicMatch?.slice(0, 3).join(', ')}`);
        } else {
          console.log(`[EN-CLEAN] ${route}: No Arabic text detected`);
        }
      }
    });
  }
});

test.describe('Phase 3: Language Switch Verification', () => {
  test('Switch Arabic → English preserves page', async ({ arabicPage }) => {
    const page = arabicPage;
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(await page.getAttribute('html', 'lang')).toBe('ar');
    expect(await page.getAttribute('html', 'dir')).toBe('rtl');

    await page.context().addCookies([
      { name: 'atsoft_locale', value: 'en', domain: 'localhost', path: '/' },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(await page.getAttribute('html', 'lang')).toBe('en');
    expect(await page.getAttribute('html', 'dir')).toBe('ltr');
    console.log('[PASS] Language switch AR→EN works');
  });

  test('Switch English → Arabic preserves page', async ({ englishPage }) => {
    const page = englishPage;
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(await page.getAttribute('html', 'lang')).toBe('en');
    expect(await page.getAttribute('html', 'dir')).toBe('ltr');

    await page.context().addCookies([
      { name: 'atsoft_locale', value: 'ar', domain: 'localhost', path: '/' },
    ]);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(await page.getAttribute('html', 'lang')).toBe('ar');
    expect(await page.getAttribute('html', 'dir')).toBe('rtl');
    console.log('[PASS] Language switch EN→AR works');
  });
});
