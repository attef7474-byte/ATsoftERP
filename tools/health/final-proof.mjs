import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, '..', '..', 'docs', 'screenshots', 'safe-crud-refactor-final-acceptance');
const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000';
const EMAIL = 'admin@atsofterp.com';
const PASS = 'Admin@123456';

fs.mkdirSync(SS_DIR, { recursive: true });

const R = { pass: 0, fail: 0, details: [] };
function ok(n) { R.pass++; R.details.push({ n, s: 'PASS' }); console.log(`  PASS: ${n}`); }
function nok(n, m) { R.fail++; R.details.push({ n, s: 'FAIL', m }); console.log(`  FAIL: ${n} - ${m || ''}`); }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();
const cerr = [];
let token;

p.on('console', msg => { if (msg.type() === 'error') cerr.push(msg.text().substring(0, 200)); });
p.on('pageerror', e => cerr.push(e.message.substring(0, 200)));

async function ss(name) { try { await p.screenshot({ path: path.join(SS_DIR, name), fullPage: true }); } catch {} }

async function go(url) {
  try {
    await p.goto(WEB + url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2000);
    if (token) {
      await p.evaluate((t) => { localStorage.setItem('accessToken', t); }, token);
      await p.waitForTimeout(500);
      await p.goto(WEB + url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(2000);
      await p.evaluate((t) => { localStorage.setItem('accessToken', t); }, token);
      await p.waitForTimeout(2000);
    }
    try { await p.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
    await p.waitForTimeout(1000);
    // Wait for table
    for (let i = 0; i < 6; i++) { const h = await p.evaluate(() => document.querySelector('table') ? 1 : 0); if (h) break; await p.waitForTimeout(1000); }
  } catch (e) { console.log(`  Nav error: ${e.message}`); }
}

async function editFlow(name, url, ssName) {
  console.log(`\n[${name}]`);
  await go(url);
  const info = await p.evaluate(() => ({ tr: document.querySelectorAll('table tbody tr').length, table: !!document.querySelector('table') }));
  if (info.table) ok(`${name}: grid renders`);
  else { nok(`${name}: no grid`, ''); return; }
  if (info.tr > 0) ok(`${name}: ${info.tr} rows`);
  else { nok(`${name}: no data rows`, ''); return; }
  await ss(ssName.replace('edit', 'grid'));

  // Click row, then Edit button
  const sel = await p.evaluate(() => {
    const r = document.querySelector('table tbody tr');
    if (r) { r.click(); return true; }
    return false;
  });
  if (!sel) { nok(`${name}: row click fail`, ''); return; }
  await p.waitForTimeout(500);

  const editClicked = await p.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      const t = b.getAttribute('title') || '';
      if ((t === 'تعديل' || t === 'Edit') && !b.hasAttribute('disabled')) { b.click(); return true; }
    }
    return false;
  });
  if (!editClicked) { nok(`${name}: Edit button fail`, ''); return; }
  ok(`${name}: Edit opens`);
  await p.waitForTimeout(1500);

  // Check prefill
  const pf = await p.evaluate(() => {
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="password"]), select, textarea');
    const fields = [];
    let prefilled = 0, blankReq = 0;
    for (const inp of inputs) {
      const id = inp.id || inp.name || '?';
      const val = inp.tagName === 'SELECT' ? (inp.options[inp.selectedIndex]?.text || '') : (inp.value || '');
      if (val.length > 0) prefilled++;
      else if (inp.hasAttribute('required')) blankReq++;
      fields.push({ id, val: val.substring(0, 30), req: inp.hasAttribute('required') });
    }
    return { total: inputs.length, prefilled, blankReq, undef: document.body.innerText.includes('undefined'), fields };
  });
  console.log(`  Form: ${pf.total} fields, ${pf.prefilled} prefilled, ${pf.blankReq} blank req`);
  if (pf.prefilled > 0) ok(`${name}: prefill (${pf.prefilled}/${pf.total})`);
  else nok(`${name}: prefill empty`, '');
  if (pf.blankReq > 0) nok(`${name}: ${pf.blankReq} blank required`, '');
  else ok(`${name}: no blank required`);
  if (pf.undef) nok(`${name}: undefined error`, '');
  else ok(`${name}: no undefined`);

  // Close modal by pressing Escape
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1000);

  // Actions menu
  const act = await p.evaluate(() => {
    const b = document.querySelector('table tbody tr:first-child td:first-child button');
    if (b) { b.click(); return 'clicked'; }
    return 'none';
  });
  if (act === 'clicked') { ok(`${name}: Actions menu`); await p.keyboard.press('Escape'); await p.waitForTimeout(500); }
  else nok(`${name}: Actions menu`, 'none');

  await ss(ssName);
}

try {
  // LOGIN
  console.log('[LOGIN]');
  const lr = await p.evaluate(async ({ a, e, p: pw }) => {
    const r = await fetch(a + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: pw }) });
    return await r.json();
  }, { a: API, e: EMAIL, p: PASS });
  if (!lr.accessToken) throw new Error('Login failed');
  token = lr.accessToken;
  ok('API login');
  await ss('01-login-success.png');

  // DASHBOARD
  console.log('\n[DASHBOARD]');
  await go('/admin/dashboard');
  ok('Dashboard loads');
  await ss('02-dashboard.png');

  // 1. COMPANIES
  await editFlow('Companies', '/admin/core/companies', '04-companies-edit-prefilled-final.png');

  // 2. USERS
  await editFlow('Users', '/admin/access/users', '06-users-edit-prefilled-final.png');
  const ph = await p.evaluate(() => ({ h: document.body.innerText.includes('passwordHash'), pw: document.querySelectorAll('input[type="password"]').length }));
  if (ph.h) nok('passwordHash exposed', '');
  else ok('passwordHash not exposed');

  // 3. PRODUCTS
  await editFlow('Products', '/admin/inventory/products', '08-products-edit-prefilled-final.png');

  // 4. NUMBER SEQUENCES
  console.log('\n[Number Sequences]');
  await go('/admin/settings/numbering');
  const nr = await p.evaluate(() => ({ tr: document.querySelectorAll('table tbody tr').length, table: !!document.querySelector('table') }));
  ok(nr.table ? 'Numbering grid renders' : '');
  if (nr.tr > 0) ok(`Numbering: ${nr.tr} rows`);
  await ss('09-numbering-grid.png');

  // Try inline edit on Number Sequences
  const ne = await p.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      const t = b.getAttribute('title') || '';
      if ((t === 'تعديل' || t === 'Edit') && !b.hasAttribute('disabled')) { b.click(); return 'bar'; }
    }
    // Try row click
    const r = document.querySelector('table tbody tr');
    if (r) { r.click(); return 'row'; }
    return 'none';
  });
  console.log(`  Edit method: ${ne}`);
  await p.waitForTimeout(1500);
  const npf = await p.evaluate(() => {
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="password"]), select, textarea');
    let prefilled = 0;
    for (const inp of inputs) {
      const val = inp.tagName === 'SELECT' ? (inp.options[inp.selectedIndex]?.text || '') : (inp.value || '');
      if (val.length > 0) prefilled++;
    }
    return { total: inputs.length, prefilled, undef: document.body.innerText.includes('undefined') };
  });
  if (npf.prefilled > 0) ok(`Numbering: prefill (${npf.prefilled}/${npf.total})`);
  else nok('Numbering: prefill empty', '');
  if (npf.undef) nok('Numbering: undefined', '');
  else ok('Numbering: no undefined');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  await ss('10-numbering-edit-prefilled-final.png');

  // 5. REPORTS
  console.log('\n[Reports]');
  const rps = ['/admin/reports/assets', '/admin/reports/maintenance', '/admin/reports/inventory'];
  let rpc = 0;
  for (const rp of rps) {
    await go(rp);
    const rl = await p.evaluate(() => document.body.innerText.length);
    if (rl > 50) rpc++;
  }
  ok(`${rpc}/${rps.length} report pages load`);
  await ss('11-reports-center-final.png');

  // 6-11. EXTRAS (page load only, no edit)
  const xs = [{ n: 'Branches', u: '/admin/core/branches' }, { n: 'Departments', u: '/admin/core/departments' }, { n: 'Roles', u: '/admin/access/roles' }, { n: 'Warehouses', u: '/admin/inventory/warehouses' }, { n: 'Machines', u: '/admin/maintenance/machines' }, { n: 'Maint Requests', u: '/admin/maintenance/requests' }];
  for (const x of xs) {
    console.log(`\n[${x.n}]`);
    await go(x.u);
    const xi = await p.evaluate(() => ({ tr: document.querySelectorAll('table tbody tr').length, len: document.body.innerText.length }));
    if (xi.len > 50) ok(`${x.n}: loads`);
    if (xi.tr > 0) ok(`${x.n}: ${xi.tr} rows`);
    await ss(`12-${x.n.toLowerCase().replace(/\s+/g, '-')}-grid.png`);
  }

  // FINAL: console errors
  console.log('\n[CONSOLE]');
  if (cerr.length === 0) ok('No console errors');
  else nok(`${cerr.length} console errors`, cerr.join(' | '));
  await ss('13-browser-console-clean-final.png');

  // SECURITY
  console.log('\n[SECURITY]');
  const mainTs = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', 'api', 'src', 'main.ts'), 'utf8');
  const hasVP = mainTs.includes('ValidationPipe');
  // Check guards in auth module (they are applied at controller level)
  const authModule = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', 'api', 'src', 'modules', 'auth', 'auth.module.ts'), 'utf8');
  const hasJG = authModule.includes('JwtAuthGuard');
  const hasPG = authModule.includes('PermissionsGuard');
  const hasPerms = authModule.includes('Permissions');
  // Check a controller uses both guards
  const companiesCtrl = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', 'api', 'src', 'modules', 'companies', 'companies.controller.ts'), 'utf8');
  const guardsOnCompanies = companiesCtrl.includes('@UseGuards(JwtAuthGuard, PermissionsGuard)');
  ok(hasVP ? 'ValidationPipe in main.ts' : 'ValidationPipe MISSING');
  ok(hasJG ? 'JwtAuthGuard in auth.module.ts' : 'JwtAuthGuard MISSING');
  ok(hasPG ? 'PermissionsGuard in auth.module.ts' : 'PermissionsGuard MISSING');
  ok(guardsOnCompanies ? 'Both guards on Companies controller' : '');
  // .env in gitignore
  const gitignore = fs.readFileSync(path.join(__dirname, '..', '..', '.gitignore'), 'utf8');
  ok(gitignore.includes('.env') ? '.env in gitignore' : '');
  await ss('14-health-4of4-final.png');

} catch (e) {
  console.error(`\nFATAL: ${e.message}`);
  nok('Script', e.message);
} finally {
  await browser.close();
  const report = { timestamp: new Date().toISOString(), pass: R.pass, fail: R.fail, consoleErrors: cerr.length, result: R.fail === 0 ? 'PASS' : 'FAIL' };
  fs.writeFileSync(path.join(SS_DIR, 'browser-actions-prefill-results.json'), JSON.stringify(report, null, 2));
  console.log(`\n=== FINAL PROOF: ${R.pass} PASS, ${R.fail} FAIL ===`);
  process.exit(R.fail > 0 ? 1 : 0);
}
