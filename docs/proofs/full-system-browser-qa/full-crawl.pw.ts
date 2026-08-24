import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const WEB = 'http://localhost:3000';
const OUT = path.resolve(__dirname, 'screenshots');

interface E { route: string; lang: string; type: string; status?: number; url?: string; msg: string }
let errs: E[] = [];

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

const R = [
  '/',
  '/admin/dashboard',
  '/admin/access/permissions',
  '/admin/access/permissions/matrix',
  '/admin/access/roles',
  '/admin/access/users',
  '/admin/alerts',
  '/admin/barcodes',
  '/admin/barcodes/generate',
  '/admin/barcodes/machine-cards',
  '/admin/barcodes/print-jobs',
  '/admin/barcodes/product-labels',
  '/admin/barcodes/records',
  '/admin/barcodes/scan',
  '/admin/barcodes/scans',
  '/admin/barcodes/templates',
  '/admin/core/administrations',
  '/admin/core/branches',
  '/admin/core/companies',
  '/admin/core/departments',
  '/admin/core/job-titles',
  '/admin/core/organizational-units',
  '/admin/core/person-assignments',
  '/admin/core/persons',
  '/admin/core/supervisor-assignments',
  '/admin/documents/attachments',
  '/admin/installed-parts',
  '/admin/inventory/adjustments',
  '/admin/inventory/balances',
  '/admin/inventory/counts',
  '/admin/inventory/governance-audit',
  '/admin/inventory/ledger',
  '/admin/inventory/locations',
  '/admin/inventory/locks',
  '/admin/inventory/movements',
  '/admin/inventory/opening-balances',
  '/admin/inventory/operational-receipts',
  '/admin/inventory/physical-counts',
  '/admin/inventory/product-categories',
  '/admin/inventory/products',
  '/admin/inventory/reconciliation',
  '/admin/inventory/reports',
  '/admin/inventory/stock-adjustments',
  '/admin/inventory/transfers',
  '/admin/inventory/warehouses',
  '/admin/maintenance/accountability',
  '/admin/maintenance/bom',
  '/admin/maintenance/calendar',
  '/admin/maintenance/checklist-items',
  '/admin/maintenance/cost-centers',
  '/admin/maintenance/dashboard',
  '/admin/maintenance/downtime-logs',
  '/admin/maintenance/downtime-logs/analysis',
  '/admin/maintenance/downtime-logs/current',
  '/admin/maintenance/machine-categories',
  '/admin/maintenance/machine-components',
  '/admin/maintenance/machine-documents',
  '/admin/maintenance/machine-parts',
  '/admin/maintenance/machine-responsibilities',
  '/admin/maintenance/machines',
  '/admin/maintenance/operation-types',
  '/admin/maintenance/personnel',
  '/admin/maintenance/planning/overdue',
  '/admin/maintenance/planning/sla-due',
  '/admin/maintenance/planning/unassigned',
  '/admin/maintenance/preventive/calendar',
  '/admin/maintenance/preventive/execution-history',
  '/admin/maintenance/preventive/overdue',
  '/admin/maintenance/preventive/upcoming',
  '/admin/maintenance/production-lines',
  '/admin/maintenance/reliability/mttr',
  '/admin/maintenance/repair-orders',
  '/admin/maintenance/requests',
  '/admin/maintenance/schedules',
  '/admin/maintenance/sla',
  '/admin/maintenance/spare-part-plans',
  '/admin/maintenance/spare-parts',
  '/admin/maintenance/tasks',
  '/admin/maintenance/tasks/my-tasks',
  '/admin/maintenance/work-orders',
  '/admin/maintenance/workload',
  '/admin/messaging',
  '/admin/notifications',
  '/admin/production/analytics',
  '/admin/production/capacity-standards',
  '/admin/production/cost/rates',
  '/admin/production/cost/snapshots',
  '/admin/production/cost/transactions',
  '/admin/production/downtime',
  '/admin/production/finished-goods-receipts',
  '/admin/production/loss-reasons',
  '/admin/production/losses',
  '/admin/production/material-documents',
  '/admin/production/material-requirements',
  '/admin/production/measurement-points',
  '/admin/production/operational-assignments',
  '/admin/production/orders',
  '/admin/production/performance-targets',
  '/admin/production/product-definitions',
  '/admin/production/quality/inspections',
  '/admin/production/quality/ncrs',
  '/admin/production/quality/plans',
  '/admin/production/reliability',
  '/admin/production/runs',
  '/admin/production/shift-assignments',
  '/admin/production/shift-calendars',
  '/admin/production/shift-handovers',
  '/admin/production/shift-templates',
  '/admin/production/shifts',
  '/admin/production/units',
  '/admin/profile',
  '/admin/reports',
  '/admin/reports/assets',
  '/admin/reports/attachments',
  '/admin/reports/audit',
  '/admin/reports/barcodes/scans',
  '/admin/reports/inventory',
  '/admin/reports/inventory/adjustments',
  '/admin/reports/inventory/balances',
  '/admin/reports/inventory/count-variance',
  '/admin/reports/inventory/movements',
  '/admin/reports/low-stock',
  '/admin/reports/machine-log',
  '/admin/reports/maintenance',
  '/admin/reports/maintenance/costs',
  '/admin/reports/maintenance/downtime',
  '/admin/reports/maintenance/kpis',
  '/admin/reports/maintenance/requests',
  '/admin/reports/maintenance/schedules',
  '/admin/reports/notifications',
  '/admin/reports/operations',
  '/admin/reports/overdue-preventive',
  '/admin/reports/parts',
  '/admin/reports/parts-usage',
  '/admin/reports/partners',
  '/admin/reports/upcoming-preventive',
  '/admin/reports/user-activity',
  '/admin/search',
  '/admin/search/entities',
  '/admin/search/recent',
  '/admin/search/results',
  '/admin/settings',
  '/admin/settings/appearance',
  '/admin/settings/audit',
  '/admin/settings/audit/login-history',
  '/admin/settings/audit/user-activity',
  '/admin/settings/company',
  '/admin/settings/language',
  '/admin/settings/notification-rules',
  '/admin/settings/numbering',
  '/admin/settings/security',
  '/admin/spare-part-conditions',
];

test.describe('Full System Crawl', () => {
  test.setTimeout(1800000);
  test('AR+EN crawl all list pages', async ({ page }) => {
    listen(page);
    // Login
    await page.goto(WEB + '/login', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.locator('input[type="email"], input[name="email"], input[placeholder*="email"], input[placeholder*="البريد"]').fill(process.env.QA_ADMIN_EMAIL || '');
    await page.locator('input[type="password"]').fill(process.env.QA_ADMIN_PASSWORD || '');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log('LOGIN OK');

    for (const lang of ['ar', 'en']) {
      for (const route of R) {
        const c0 = errs.length;
        try {
          await page.goto(`${WEB}${route}?lang=${lang}`, { waitUntil: 'load', timeout: 8000 });
          await page.waitForTimeout(400);
        } catch {}
        for (let i = c0; i < errs.length; i++) { errs[i].route = route; errs[i].lang = lang; }
        const n = errs.length - c0;
        if (n > 0) console.log(`ERR [${lang}] ${route} +${n}`);
      }
    }

    // Dedupe by msg for summary
    const uniq = [...new Set(errs.map(e => e.msg))];
    console.log(`\n=== TOTAL: ${errs.length} errors, ${uniq.length} unique ===`);
    uniq.forEach(m => console.log(`  ${m}`));

    // Per-route summary
    const byRoute = new Map<string, E[]>();
    errs.forEach(e => { const k = `${e.route} [${e.lang}]`; if (!byRoute.has(k)) byRoute.set(k, []); byRoute.get(k)!.push(e); });
    console.log(`\n=== AFFECTED ROUTES: ${byRoute.size} ===`);
    for (const [k, v] of byRoute) console.log(`  ${k}: ${v.length} errors`);

    fs.writeFileSync(path.join(OUT, 'full-crawl-errors.json'), JSON.stringify(errs, null, 2));
  });
});
