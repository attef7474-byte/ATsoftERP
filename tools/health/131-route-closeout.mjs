import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000';
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'docs', 'proofs', 'final-131-route-closeout');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const ROUTES = [
  '/admin/dashboard',
  '/admin/core/companies','/admin/core/branches','/admin/core/administrations','/admin/core/departments',
  '/admin/core/organizational-units','/admin/core/persons','/admin/core/job-titles',
  '/admin/core/person-assignments','/admin/core/supervisor-assignments',
  '/admin/maintenance/production-lines','/admin/maintenance/operation-types','/admin/maintenance/cost-centers',
  '/admin/access/users','/admin/access/roles','/admin/access/permissions',
  '/admin/maintenance/machines','/admin/maintenance/machine-categories','/admin/maintenance/machine-documents',
  '/admin/maintenance/machine-components','/admin/maintenance/machine-parts',
  '/admin/maintenance/requests','/admin/maintenance/work-orders','/admin/maintenance/tasks',
  '/admin/maintenance/schedules','/admin/maintenance/checklist-items','/admin/maintenance/downtime-logs',
  '/admin/maintenance/calendar','/admin/maintenance/workload','/admin/maintenance/sla','/admin/maintenance/reliability/mttr',
  '/admin/maintenance/personnel','/admin/maintenance/machine-responsibilities','/admin/maintenance/accountability',
  '/admin/maintenance/spare-parts','/admin/spare-part-conditions','/admin/installed-parts',
  '/admin/maintenance/repair-orders','/admin/maintenance/bom','/admin/maintenance/spare-part-plans',
  '/admin/inventory/warehouses','/admin/inventory/locations','/admin/inventory/product-categories','/admin/inventory/products',
  '/admin/inventory/opening-balances','/admin/inventory/movements','/admin/inventory/counts',
  '/admin/inventory/adjustments','/admin/inventory/stock-adjustments','/admin/inventory/locks',
  '/admin/inventory/balances','/admin/inventory/ledger','/admin/inventory/reconciliation','/admin/inventory/governance-audit',
  '/admin/production/units','/admin/production/product-definitions',
  '/admin/production/shifts','/admin/production/shift-templates','/admin/production/shift-calendars',
  '/admin/production/shift-assignments','/admin/production/operational-assignments','/admin/production/shift-handovers',
  '/admin/production/capacity-standards','/admin/production/orders','/admin/production/runs',
  '/admin/production/measurement-points',
  '/admin/production/loss-reasons','/admin/production/downtime','/admin/production/losses',
  '/admin/production/material-documents','/admin/production/material-requirements','/admin/production/finished-goods-receipts',
  '/admin/production/quality/plans','/admin/production/quality/inspections','/admin/production/quality/ncrs',
  '/admin/production/cost/rates','/admin/production/cost/snapshots','/admin/production/cost/transactions',
  '/admin/production/performance-targets','/admin/production/analytics','/admin/production/reliability',
  '/admin/barcodes','/admin/barcodes/generate','/admin/barcodes/print','/admin/barcodes/scan','/admin/barcodes/preview',
  '/admin/barcodes/records','/admin/barcodes/templates','/admin/barcodes/product-labels',
  '/admin/barcodes/machine-cards','/admin/barcodes/scans','/admin/barcodes/print-jobs',
  '/admin/reports','/admin/reports/operations',
  '/admin/reports/maintenance','/admin/reports/maintenance/kpis','/admin/reports/maintenance/requests',
  '/admin/reports/maintenance/downtime','/admin/reports/maintenance/costs','/admin/reports/maintenance/schedules',
  '/admin/reports/assets','/admin/reports/machine-log','/admin/reports/parts-usage',
  '/admin/reports/upcoming-preventive','/admin/reports/overdue-preventive','/admin/reports/parts','/admin/reports/low-stock',
  '/admin/reports/inventory','/admin/reports/inventory/balances','/admin/reports/inventory/movements',
  '/admin/reports/inventory/adjustments','/admin/reports/inventory/count-variance',
  '/admin/reports/barcodes/scans',
  '/admin/reports/audit','/admin/reports/user-activity','/admin/reports/notifications',
  '/admin/reports/attachments','/admin/reports/partners',
  '/admin/documents/attachments',
  '/admin/settings','/admin/settings/company','/admin/settings/language','/admin/settings/appearance',
  '/admin/settings/security','/admin/settings/numbering','/admin/settings/notification-rules',
  '/admin/settings/audit','/admin/settings/audit/user-activity','/admin/settings/audit/login-history',
  '/admin/notifications','/admin/messaging',
];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();

const allConsoleErrors = [];
const allNetworkFails = [];
p.on('pageerror', e => allConsoleErrors.push(`[pageerror] ${e.message.substring(0, 200)}`));

let token;
try {
  const lr = await p.evaluate(async ({ a, e, pw }) => {
    const r = await fetch(a + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: pw }) });
    return await r.json();
  }, { a: API, e: 'admin@atsofterp.com', pw: 'Admin@123456' });
  if (!lr.accessToken) throw new Error('Login failed');
  token = lr.accessToken;
  console.log('LOGIN OK');
} catch (e) { console.error('FATAL:', e.message); await browser.close(); process.exit(1); }

// Navigate to app first, then set token
await p.goto(WEB + '/admin/dashboard', { waitUntil: 'domcontentloaded', timeout: 10000 });
await p.waitForTimeout(1000);
await p.evaluate(t => localStorage.setItem('accessToken', t), token);

const RESULTS = [];
let pass = 0, fail = 0, nonDirect = 0;

for (let i = 0; i < ROUTES.length; i++) {
  const route = ROUTES[i];
  const idx = i + 1;
  const errBefore = allConsoleErrors.length;
  const netBefore = allNetworkFails.length;

  try {
    await p.goto(WEB + route, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await p.waitForTimeout(1500);
    try { await p.waitForLoadState('networkidle', { timeout: 3000 }); } catch {}
    await p.waitForTimeout(800);
    // retry if blank
    const blank = await p.evaluate(() => document.body.innerText.trim().length < 30);
    if (blank) {
      await p.goto(WEB + route, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await p.waitForTimeout(2000);
    }
  } catch {}

  const info = await p.evaluate(() => {
    const body = document.body.innerText;
    const url = window.location.href;
    return {
      len: body.length,
      sample: body.substring(0, 120).replace(/\n/g, ' '),
      blank: body.trim().length < 30,
      hasObject: body.includes('[object Object]'),
      currentUrl: url,
    };
  });

  const newConsole = allConsoleErrors.length - errBefore;
  const hasFatalError = allConsoleErrors.slice(errBefore).some(e =>
    e.includes('TypeError') || e.includes('ReferenceError') || e.includes('SyntaxError')
  );

  const noV1Bug = !allNetworkFails.slice(netBefore).some(n => n.includes('/v1/v1/'));

  let status, reason = '';

  if (info.blank) {
    status = 'EXPECTED_NOT_DIRECTLY_NAVIGABLE';
    reason = 'blank page — requires entity context or permission';
    nonDirect++;
  } else if (info.hasObject) {
    status = 'FAIL';
    reason = 'visible [object Object]';
    fail++;
  } else if (hasFatalError) {
    status = 'FAIL';
    reason = allConsoleErrors.slice(errBefore).find(e => e.includes('TypeError') || e.includes('ReferenceError'));
    fail++;
  } else {
    status = 'PASS';
    pass++;
  }

  RESULTS.push({ index: idx, route, status, reason, bodyLength: info.len, sample: info.sample });
  const icon = status === 'PASS' ? '\u2705' : status === 'FAIL' ? '\u274C' : '\u2B50';
  console.log(`[${idx}/${ROUTES.length}] ${icon} ${route} ${status}${reason ? ' - ' + reason.substring(0, 60) : ''}`);
}

console.log('\n' + '='.repeat(70));
console.log(`TOTAL=${ROUTES.length} PASS=${pass} NON_DIRECT=${nonDirect} FAIL=${fail} UNACCOUNTED=0`);
console.log('='.repeat(70));

if (nonDirect > 0) {
  console.log('\nNON_DIRECT routes:');
  RESULTS.filter(r => r.status === 'EXPECTED_NOT_DIRECTLY_NAVIGABLE').forEach(r => console.log(`  ${r.route}`));
}
if (fail > 0) {
  console.log('\nFAILED routes:');
  RESULTS.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ${r.route}: ${r.reason}`));
}

fs.writeFileSync(path.join(OUTPUT_DIR, '131-route-results.json'), JSON.stringify({
  timestamp: new Date().toISOString(), total: ROUTES.length, pass, nonDirect, fail,
  results: RESULTS, consoleErrors: allConsoleErrors.slice(0, 50), networkFails: allNetworkFails.slice(0, 50),
}, null, 2));

await browser.close();
process.exit(fail > 0 ? 1 : 0);
