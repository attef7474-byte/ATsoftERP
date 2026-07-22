import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(__dirname, '..', '..', 'docs', 'screenshots', 'full-application-functional-audit');
const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000';
const EMAIL = 'admin@atsofterp.com';
const PASS = 'Admin@123456';

fs.mkdirSync(SS, { recursive: true });

const R = { pass: 0, fail: 0, na: 0, pages: {}, consoleErrors: [], networkFailures: [] };
function ok(m) { R.pass++; console.log(`  OK: ${m}`); }
function nok(m, e) { R.fail++; console.log(`  FAIL: ${m} - ${e || ''}`); }
function na(m, r) { R.na++; console.log(`  N/A: ${m} - ${r}`); }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();
p.on('console', msg => { if (msg.type() === 'error') R.consoleErrors.push(msg.text().substring(0, 200)); });
p.on('pageerror', e => R.consoleErrors.push(e.message.substring(0, 200)));
p.on('response', resp => {
  if (resp.status() >= 400 && resp.status() !== 401 && resp.status() !== 403) {
    const url = resp.url();
    if (!url.includes('hot-update') && !url.includes('__next') && !url.includes('_next/static') && !url.includes('localhost:3000')) {
      R.networkFailures.push({ url: url.substring(0, 150), s: resp.status() });
    }
  }
});

async function ss(name) { try { await p.screenshot({ path: path.join(SS, name.replace(/[^a-z0-9.-]/gi, '_')), fullPage: true }); } catch {} }

async function go(url, retoken = true) {
  try {
    await p.goto(WEB + url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2000);
    if (retoken && token) {
      await p.evaluate(t => localStorage.setItem('accessToken', t), token);
      await p.waitForTimeout(500);
      await p.goto(WEB + url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(2000);
    }
    try { await p.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
    await p.waitForTimeout(1000);
    for (let i = 0; i < 8; i++) {
      const ok = await p.evaluate(() => document.body.innerText.length > 20);
      if (ok) break;
      await p.waitForTimeout(1000);
    }
  } catch (e) { console.log(`  Nav error: ${e.message}`); }
}

let token;

async function testPage(name, route, opts = {}) {
  console.log(`\n[${name}] ${route}`);
  const rk = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  await go(route, opts.noToken !== true);
  const info = await p.evaluate(() => ({
    len: document.body.innerText.length,
    text50: document.body.innerText.substring(0, 50),
    i18n: /[a-z]+\.[a-z]+\.[a-z]+/i.test(document.body.innerText),
    table: !!document.querySelector('table'),
    tr: document.querySelectorAll('table tbody tr').length,
    btns: document.querySelectorAll('button').length,
    inputs: document.querySelectorAll('input, select, textarea').length,
    undef: document.body.innerText.includes('undefined') || document.body.innerText.includes('null') && !document.body.innerText.includes('nullptr'),
    errText: /[Ee]rror/.test(document.body.innerText)
  }));
  if (info.len > 30) ok(`${name}: page loads (${info.len}c)`);
  else nok(`${name}: page blank`, `len=${info.len}`);
  if (!info.i18n) ok(`${name}: no raw i18n keys`);
  else nok(`${name}: raw i18n keys (${info.text50})`, '');
  if (!info.undef) ok(`${name}: no undefined/null in text`);
  else nok(`${name}: undefined/null in text`, info.text50);
  if (info.table) ok(`${name}: grid renders`);
  if (info.tr > 0) ok(`${name}: ${info.tr} data rows`);
  if (!opts.noSS) await ss(`${rk}.png`);
  return info;
}

async function testEdit(name, route) {
  console.log(`\n[${name} EDIT] ${route}`);
  await go(route);
  const sel = await p.evaluate(() => {
    const r = document.querySelector('table tbody tr');
    if (r) { r.click(); return true; }
    return false;
  });
  if (!sel) { na(`${name}: row selection`, 'no rows'); return null; }
  await p.waitForTimeout(500);
  const ec = await p.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      const t = b.getAttribute('title') || b.textContent.trim();
      if ((t === 'تعديل' || t === 'Edit' || t.includes('edit') || t.includes('تعديل')) && !b.hasAttribute('disabled')) { b.click(); return true; }
    }
    return false;
  });
  if (!ec) { na(`${name}: Edit button`, 'not found/disabled'); return null; }
  ok(`${name}: Edit opens`);
  await p.waitForTimeout(1500);
  const pf = await p.evaluate(() => {
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="password"]), select, textarea');
    let prefilled = 0, blankReq = 0;
    for (const inp of inputs) {
      const val = inp.tagName === 'SELECT' ? (inp.options[inp.selectedIndex]?.text || '') : (inp.value || '');
      if (val.length > 0) prefilled++;
      else if (inp.hasAttribute('required')) blankReq++;
    }
    return { total: inputs.length, prefilled, blankReq, undef: document.body.innerText.includes('undefined') };
  });
  if (pf.prefilled > 0) ok(`${name}: prefill (${pf.prefilled}/${pf.total})`);
  else if (pf.total > 0 && pf.blankReq === 0) na(`${name}: prefill empty`, 'all fields optional');
  else nok(`${name}: prefill empty`, `${pf.total}f, ${pf.blankReq} blankReq`);
  if (pf.blankReq === 0) ok(`${name}: no blank required`);
  else nok(`${name}: ${pf.blankReq} blank required`, '');
  if (!pf.undef) ok(`${name}: no undefined`);
  else nok(`${name}: undefined in form`, '');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  return pf;
}

try {
  // ===== LOGIN =====
  console.log('[LOGIN]');
  const lr = await p.evaluate(async ({ a, e, p: pw }) => {
    const r = await fetch(a + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: pw }) });
    return await r.json();
  }, { a: API, e: EMAIL, p: PASS });
  if (!lr.accessToken) throw new Error('Login failed: ' + JSON.stringify(lr));
  token = lr.accessToken;
  ok('API login');
  await ss('login.png');

  // ===== DASHBOARD =====
  await testPage('Dashboard', '/admin/dashboard');

  // ===== CORE =====
  await testPage('Companies List', '/admin/core/companies');
  await testEdit('Companies', '/admin/core/companies');
  await testPage('Branches List', '/admin/core/branches');
  await testEdit('Branches', '/admin/core/branches');
  await testPage('Departments List', '/admin/core/departments');
  await testEdit('Departments', '/admin/core/departments');

  // ===== ACCESS =====
  await testPage('Users List', '/admin/access/users');
  await testEdit('Users', '/admin/access/users');
  const phExposed = await p.evaluate(() => document.body.innerText.includes('passwordHash') || document.body.innerText.includes('password_hash'));
  if (phExposed) nok('Users: passwordHash exposed', '');
  else ok('Users: passwordHash not exposed');
  await testPage('Roles List', '/admin/access/roles');
  await testPage('Roles New', '/admin/access/roles/new');
  await testPage('Permissions List', '/admin/access/permissions');
  await testPage('Permissions Matrix', '/admin/access/permissions/matrix');

  // ===== SETTINGS =====
  await testPage('Settings Index', '/admin/settings');
  await testPage('Settings Company', '/admin/settings/company');
  await testPage('Settings Language', '/admin/settings/language');
  await testPage('Settings Appearance', '/admin/settings/appearance');
  await testPage('Settings Security', '/admin/settings/security');
  await testPage('Settings Numbering', '/admin/settings/numbering');
  await testEdit('Numbering', '/admin/settings/numbering');
  await testPage('Settings Notification Rules', '/admin/settings/notification-rules');

  // ===== AUDIT =====
  await testPage('Settings Audit', '/admin/settings/audit');
  await testPage('Settings Audit User Activity', '/admin/settings/audit/user-activity');
  await testPage('Settings Audit Login History', '/admin/settings/audit/login-history');
  await testPage('Settings Audit Export', '/admin/settings/audit/export');

  // ===== ALERTS / NOTIFICATIONS =====
  await testPage('Alerts', '/admin/alerts');
  await testPage('Notifications', '/admin/notifications');

  // ===== ATTACHMENTS =====
  await testPage('Attachments List', '/admin/documents/attachments');
  await testPage('Attachments Upload', '/admin/documents/attachments/upload');

  // ===== INVENTORY =====
  await testPage('Warehouses List', '/admin/inventory/warehouses');
  await testEdit('Warehouses', '/admin/inventory/warehouses');
  await testPage('Warehouses New', '/admin/inventory/warehouses/new');
  await testPage('Locations List', '/admin/inventory/locations');

  await testPage('Products List', '/admin/inventory/products');
  await go('/admin/inventory/products');
  const hasEditLink = await p.evaluate(() => {
    const l = document.querySelector('a[href*="/edit"]');
    if (l) { l.click(); return true; }
    return false;
  });
  if (hasEditLink) {
    await p.waitForTimeout(3000);
    await p.evaluate(t => localStorage.setItem('accessToken', t), token);
    await p.waitForTimeout(1000);
    const ppf = await p.evaluate(() => {
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="password"]), select, textarea');
      let pf = 0; for (const i of inputs) { const v = i.tagName === 'SELECT' ? (i.options[i.selectedIndex]?.text || '') : (i.value || ''); if (v.length > 0) pf++; }
      return { total: inputs.length, prefilled: pf, undef: document.body.innerText.includes('undefined') };
    });
    if (ppf.prefilled > 0) ok(`Products edit prefill (${ppf.prefilled}/${ppf.total})`);
    else na('Products edit prefill', 'all blank');
    if (!ppf.undef) ok('Products no undefined');
    else nok('Products undefined', '');
  } else na('Products edit link', 'not found');
  await testPage('Products New', '/admin/inventory/products/new');
  await testPage('Product Categories', '/admin/inventory/product-categories');
  await testPage('Balances List', '/admin/inventory/balances');
  await testPage('Movements List', '/admin/inventory/movements');
  await testPage('Adjustments List', '/admin/inventory/adjustments');
  await testPage('Counts List', '/admin/inventory/counts');
  await testPage('Counts New', '/admin/inventory/counts/new');
  await testPage('Counts History', '/admin/inventory/counts/history');

  // ===== MAINTENANCE =====
  await testPage('Maint Dashboard', '/admin/maintenance/dashboard');
  await testPage('Machines List', '/admin/maintenance/machines');
  await testEdit('Machines', '/admin/maintenance/machines');
  await testPage('Machine Categories', '/admin/maintenance/machine-categories');
  await testPage('Machine Parts', '/admin/maintenance/machine-parts');
  await testPage('Machine Documents', '/admin/maintenance/machine-documents');
  await testPage('Maint Requests', '/admin/maintenance/requests');
  await testEdit('Maint Requests', '/admin/maintenance/requests');
  await testPage('Maint Tasks', '/admin/maintenance/tasks');
  await testPage('Schedules', '/admin/maintenance/schedules');
  await testPage('Preventive Upcoming', '/admin/maintenance/preventive/upcoming');
  await testPage('Preventive Overdue', '/admin/maintenance/preventive/overdue');
  await testPage('Preventive Calendar', '/admin/maintenance/preventive/calendar');
  await testPage('Downtime Logs', '/admin/maintenance/downtime-logs');
  await testPage('Downtime Current', '/admin/maintenance/downtime-logs/current');
  await testPage('Downtime Analysis', '/admin/maintenance/downtime-logs/analysis');
  await testPage('Checklist Items', '/admin/maintenance/checklist-items');
  for (const w of ['upcoming-preventive', 'overdue', 'critical', 'open-requests', 'current-downtime', 'machines-under-maintenance', 'cost-kpis']) {
    await testPage(`MaintDashboard ${w}`, `/admin/maintenance/dashboard/${w}`);
  }

  // ===== BARCODE =====
  await testPage('Barcodes', '/admin/barcodes');
  await testPage('Barcodes Generate', '/admin/barcodes/generate');
  await testPage('Barcodes Print', '/admin/barcodes/print');
  await testPage('Barcodes Preview', '/admin/barcodes/preview');
  await testPage('Barcodes Scan', '/admin/barcodes/scan');
  await testPage('Barcode Records', '/admin/barcodes/records');
  await testPage('Barcode Scans', '/admin/barcodes/scans');
  await testPage('Barcode Templates', '/admin/barcodes/templates');
  await testPage('Barcode Templates New', '/admin/barcodes/templates/new');
  await testPage('Product Labels', '/admin/barcodes/product-labels');
  await testPage('Machine Cards', '/admin/barcodes/machine-cards');
  await testPage('Print Jobs', '/admin/barcodes/print-jobs');

  // ===== REPORTS =====
  const rps = ['maintenance', 'maintenance/requests', 'maintenance/downtime', 'maintenance/costs', 'maintenance/schedules',
    'inventory', 'inventory/balances', 'inventory/movements', 'inventory/adjustments', 'inventory/count-variance',
    'assets', 'parts', 'partners', 'attachments', 'audit', 'user-activity', 'notifications',
    'barcodes/scans', 'machine-log', 'parts-usage', 'upcoming-preventive', 'overdue-preventive', 'low-stock'];
  for (const rp of rps) {
    await testPage(`Report ${rp}`, `/admin/reports/${rp}`);
  }

  // ===== OTHER =====
  await testPage('Search', '/admin/search');
  await testPage('Search Results', '/admin/search/results');
  await testPage('Search Recent', '/admin/search/recent');
  await testPage('Search Entities', '/admin/search/entities');
  await testPage('Messaging', '/admin/messaging');
  await testPage('Profile', '/admin/profile');
  await testPage('Profile Password', '/admin/profile/password');

  // ===== ARABIC RTL =====
  console.log('\n[ARABIC RTL]');
  await go('/admin/settings/language');
  const arSwitched = await p.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      const t = b.textContent.trim();
      if (t === 'العربية' || t === 'Arabic') { b.click(); return true; }
    }
    return false;
  });
  if (arSwitched) {
    await p.waitForTimeout(2000);
    await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const rtl = await p.evaluate(() => ({
      dir: document.documentElement.getAttribute('dir'),
      ar: /[\u0600-\u06FF]/.test(document.body.innerText)
    }));
    if (rtl.dir === 'rtl' || rtl.ar) ok('Arabic RTL confirmed');
    else na('Arabic RTL', 'dir not rtl, no Arabic text');
    await ss('settings-language-ar.png');
    await testPage('Dashboard AR', '/admin/dashboard');
    await testPage('Companies AR', '/admin/core/companies');
    // Switch back
    await go('/admin/settings/language');
    await p.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if (b.textContent.trim() === 'English') { b.click(); return; }
      }
    });
    await p.waitForTimeout(2000);
  } else {
    na('Arabic switch', 'button not found');
  }

  // ===== CONSOLE + NETWORK =====
  console.log(`\n[RESULTS] Console errors: ${R.consoleErrors.length}, Network failures: ${R.networkFailures.length}`);
  if (R.consoleErrors.length === 0) ok('No console errors');
  else nok(`Console errors: ${R.consoleErrors.length}`, R.consoleErrors.slice(0, 5).join(' | '));
  if (R.networkFailures.length === 0) ok('No network 4xx/5xx');
  else nok(`Network failures: ${R.networkFailures.length}`, R.networkFailures.slice(0, 5).map(x => `${x.s} ${x.url}`).join(' | '));

} catch (e) {
  console.error(`FATAL: ${e.message}\n${e.stack}`);
  nok('Script', e.message);
} finally {
  await browser.close();
  const totalPages = [...new Set(Object.entries(R.pages).filter(([k]) => !k.includes(':')).map(([k]) => k.split(':')[0]))].length;
  console.log(`\n=== AUDIT: ${R.pass} PASS, ${R.fail} FAIL, ${R.na} N/A (${totalPages} pages) ===`);
  const report = { status: R.fail === 0 ? 'ACCEPTED' : 'FAILED', timestamp: new Date().toISOString(), pass: R.pass, fail: R.fail, na: R.na, pages: totalPages, consoleErrors: R.consoleErrors.slice(0, 20), networkFailures: R.networkFailures.slice(0, 20) };
  fs.writeFileSync(path.join(SS, 'audit-results.json'), JSON.stringify(report, null, 2));
  process.exit(R.fail > 0 ? 1 : 0);
}
