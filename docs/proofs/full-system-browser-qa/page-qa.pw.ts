import { test as base, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = 'docs/proofs/full-system-browser-qa/screenshots';

type QAFixtures = {
  authedPage: Page;
};

const test = base.extend<QAFixtures>({
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

type PageResult = {
  path: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  loadTime: number;
  errorMessage?: string;
};

async function testPage(page: Page, routePath: string): Promise<PageResult> {
  const startTime = Date.now();
  const result: PageResult = { path: routePath, status: 'PASS', loadTime: 0 };
  try {
    const response = await page.goto(`${BASE}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    result.loadTime = Date.now() - startTime;
    if (response && response.status() >= 400) {
      result.status = 'FAIL';
      result.errorMessage = `HTTP ${response.status()}`;
      return result;
    }
    await page.waitForTimeout(3000);

    // Check for visible 404 error (not in script tags / RSC payload)
    const visibleText = await page.locator('body > div, body > main, body > section, body > p, body > h1, body > h2').allTextContents();
    const combinedVisible = visibleText.join(' ');

    if (combinedVisible.includes('This page could not be found') || combinedVisible.trim() === '404') {
      result.status = 'FAIL';
      result.errorMessage = 'Visible 404 content';
      return result;
    }

    // Check for blank page
    if (combinedVisible.trim().length < 3) {
      result.status = 'WARN';
      result.errorMessage = 'Minimal visible content';
    }

    // Check for error modals or error states
    const errorElements = page.locator('[role="alert"], .error, .toast-error');
    const errorCount = await errorElements.count();
    if (errorCount > 0) {
      const errorText = await errorElements.first().textContent().catch(() => '');
      if (errorText && errorText.length > 0) {
        result.status = 'WARN';
        result.errorMessage = `Error element: ${errorText.substring(0, 100)}`;
      }
    }

  } catch (e: any) {
    result.status = 'FAIL';
    result.loadTime = Date.now() - startTime;
    result.errorMessage = e.message?.substring(0, 200) || 'Unknown error';
  }

  if (result.status === 'FAIL') {
    const slug = routePath.replace(/\//g, '_').replace(/^_+/, '');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${result.status.toLowerCase()}_${slug}.png`, fullPage: false }).catch(() => {});
  }
  return result;
}

const ROUTES = [
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

test.describe('Full System Browser QA', () => {
  for (const route of ROUTES) {
    test(`Page: ${route}`, async ({ authedPage }) => {
      const result = await testPage(authedPage, route);
      const icon = result.status === 'PASS' ? '+' : result.status === 'WARN' ? '!' : 'X';
      console.log(`[${icon}] ${result.path} (${result.loadTime}ms)${result.errorMessage ? ' - ' + result.errorMessage : ''}`);
      expect(result.status, `Page ${route} failed: ${result.errorMessage}`).not.toBe('FAIL');
    });
  }
});
