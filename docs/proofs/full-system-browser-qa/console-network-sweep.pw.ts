import { test, Page } from '@playwright/test';
import { QA_EMAIL, QA_PASSWORD } from './qa-credentials';

const WEB = 'http://localhost:3000';

interface E { route: string; lang: string; type: string; status?: number; url?: string; msg: string }
const errs: E[] = [];

function listen(p: Page) {
  p.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('ERR_CONNECTION') || t.includes('Failed to load') || t.includes('ResizeObserver') || t.includes('hydrat')) return;
    errs.push({ route: '', lang: '', type: 'console', msg: t });
  });
  p.on('pageerror', e => errs.push({ route: '', lang: '', type: 'pageerror', msg: e.message }));
  p.on('response', r => {
    const s = r.status(), u = r.url();
    if (s >= 400 && u.includes('/api/') && !u.includes('/auth/'))
      errs.push({ route: '', lang: '', type: 'network', status: s, url: u, msg: `${s} ${u.split('?')[0]}` });
  });
}

const ROUTES = [
  '/', '/admin/dashboard',
  '/admin/access/permissions', '/admin/access/permissions/matrix',
  '/admin/access/roles',
  '/admin/audit/audit-log',
  '/admin/barcodes/generate',
  '/admin/core/companies', '/admin/core/departments',
  '/admin/core/job-titles', '/admin/core/organizational-units',
  '/admin/core/person-assignments', '/admin/core/supervisor-assignments',
  '/admin/documents/attachments',
  '/admin/inventory/adjustments', '/admin/inventory/balances',
  '/admin/inventory/counts', '/admin/inventory/governance-audit',
  '/admin/inventory/ledger', '/admin/inventory/locations',
  '/admin/inventory/locks', '/admin/inventory/movements',
  '/admin/inventory/opening-balances', '/admin/inventory/operational-receipts',
  '/admin/inventory/physical-counts', '/admin/inventory/product-categories',
  '/admin/inventory/products', '/admin/inventory/reconciliation',
  '/admin/inventory/reports', '/admin/inventory/stock-adjustments',
  '/admin/inventory/transfers', '/admin/inventory/warehouses',
  '/admin/maintenance/accountability', '/admin/maintenance/bom',
  '/admin/maintenance/calendar', '/admin/maintenance/checklist-items',
  '/admin/maintenance/cost-centers', '/admin/maintenance/dashboard',
  '/admin/maintenance/downtime-logs', '/admin/maintenance/downtime-logs/analysis',
  '/admin/maintenance/downtime-logs/current',
  '/admin/maintenance/machine-categories', '/admin/maintenance/machine-components',
  '/admin/maintenance/machine-documents', '/admin/maintenance/machine-parts',
  '/admin/maintenance/machine-responsibilities', '/admin/maintenance/machines',
  '/admin/maintenance/operation-types', '/admin/maintenance/personnel',
  '/admin/maintenance/planning/overdue', '/admin/maintenance/planning/sla-due',
  '/admin/maintenance/planning/unassigned',
  '/admin/maintenance/preventive/calendar', '/admin/maintenance/preventive/execution-history',
  '/admin/maintenance/preventive/overdue', '/admin/maintenance/preventive/upcoming',
  '/admin/maintenance/production-lines',
  '/admin/maintenance/reliability/mttr', '/admin/maintenance/repair-orders',
  '/admin/maintenance/requests', '/admin/maintenance/schedules',
  '/admin/maintenance/sla', '/admin/maintenance/spare-part-plans',
  '/admin/maintenance/spare-parts', '/admin/maintenance/tasks',
  '/admin/maintenance/tasks/my-tasks', '/admin/maintenance/work-orders',
  '/admin/maintenance/workload',
  '/admin/production/material-documents', '/admin/production/material-requirements',
  '/admin/production/measurement-points', '/admin/production/operational-assignments',
  '/admin/production/production-orders', '/admin/production/production-runs',
  '/admin/production/quality-inspections', '/admin/production/waste-reasons',
  '/admin/production/shift-assignments', '/admin/production/shift-calendars',
  '/admin/reports/attachments',
  '/admin/reports/inventory', '/admin/reports/inventory/adjustments',
  '/admin/reports/inventory/balances', '/admin/reports/inventory/count-variance',
  '/admin/reports/inventory/movements',
  '/admin/reports/maintenance', '/admin/reports/maintenance/costs',
  '/admin/reports/maintenance/downtime', '/admin/reports/maintenance/kpis',
  '/admin/reports/maintenance/requests', '/admin/reports/maintenance/schedules',
  '/admin/reports/overdue-preventive',
  '/admin/reports/upcoming-preventive',
  '/admin/search/entities', '/admin/search/recent',
  '/admin/settings/branches', '/admin/settings/branches/detail',
  '/admin/settings/companies', '/admin/settings/facilities',
  '/admin/settings/units', '/admin/settings/areas',
  '/admin/settings/sections', '/admin/settings/lines',
  '/admin/settings/notification-templates', '/admin/settings/numbering',
  '/admin/settings/production/lines', '/admin/settings/production/shifts',
  '/admin/settings/system-users', '/admin/settings/warehouses',
];

test.describe('Console + Network Sweep', () => {
  test('Arabic mode: all pages', async ({ page }) => {
    test.setTimeout(300000);
    listen(page);
    await page.goto(`${WEB}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('#email', QA_EMAIL);
    await page.fill('#password', QA_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    for (const route of ROUTES) {
      const c0 = errs.length;
      await page.goto(`${WEB}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      for (let i = c0; i < errs.length; i++) { errs[i].route = route; errs[i].lang = 'ar'; }
    }
    console.log(`Arabic sweep done. Errors so far: ${errs.length}`);
  });

  test('English mode: all pages', async ({ page }) => {
    test.setTimeout(300000);
    listen(page);
    await page.context().addCookies([
      { name: 'atsoft_locale', value: 'en', domain: 'localhost', path: '/' },
    ]);
    await page.goto(`${WEB}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('#email', QA_EMAIL);
    await page.fill('#password', QA_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    for (const route of ROUTES) {
      const c0 = errs.length;
      await page.goto(`${WEB}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      for (let i = c0; i < errs.length; i++) { errs[i].route = route; errs[i].lang = 'en'; }
    }
    console.log(`English sweep done. Errors so far: ${errs.length}`);
  });

  test('Report all findings', async ({}) => {
    console.log('\n========== CONSOLE + NETWORK SWEEP REPORT ==========');
    console.log(`Total errors: ${errs.length}`);

    const consoleErrs = errs.filter(e => e.type === 'console');
    const pageErrs = errs.filter(e => e.type === 'pageerror');
    const netErrs = errs.filter(e => e.type === 'network');

    console.log(`\nConsole errors: ${consoleErrs.length}`);
    console.log(`Page errors: ${pageErrs.length}`);
    console.log(`Network errors (4xx/5xx API): ${netErrs.length}`);

    if (consoleErrs.length > 0) {
      console.log('\n--- Console Errors ---');
      const uniq = [...new Set(consoleErrs.map(e => e.msg))];
      for (const m of uniq) {
        const affected = consoleErrs.filter(e => e.msg === m);
        console.log(`  "${m}" (${affected.length}x, routes: ${[...new Set(affected.map(e => `[${e.lang}]${e.route}`))].join(', ')})`);
      }
    }
    if (pageErrs.length > 0) {
      console.log('\n--- Page Errors ---');
      const uniq = [...new Set(pageErrs.map(e => e.msg))];
      for (const m of uniq) {
        const affected = pageErrs.filter(e => e.msg === m);
        console.log(`  "${m}" (${affected.length}x, routes: ${[...new Set(affected.map(e => `[${e.lang}]${e.route}`))].join(', ')})`);
      }
    }
    if (netErrs.length > 0) {
      console.log('\n--- Network Errors ---');
      const uniq = [...new Set(netErrs.map(e => e.msg))];
      for (const m of uniq) {
        const affected = netErrs.filter(e => e.msg === m);
        console.log(`  ${m} (${affected.length}x)`);
      }
    }

    console.log('\n========== END REPORT ==========');
  });
});
