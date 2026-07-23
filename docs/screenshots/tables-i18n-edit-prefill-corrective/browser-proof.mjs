import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS = __dirname;
const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000';
const EMAIL = 'admin@atsofterp.com';
const PASS = 'Admin@123456';

const R = { pass: 0, fail: 0, na: 0 };
function ok(m) { R.pass++; console.log(`  OK: ${m}`); }
function nok(m, e) { R.fail++; console.log(`  FAIL: ${m} - ${e || ''}`); }
function na(m, r) { R.na++; console.log(`  N/A: ${m} - ${r}`); }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();

async function ss(name) { try { await p.screenshot({ path: path.join(SS, name.replace(/[^a-z0-9.-]/gi, '_') + '.png'), fullPage: true }); } catch {} }

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
    await p.waitForTimeout(2000);
    for (let i = 0; i < 8; i++) {
      const ok = await p.evaluate(() => document.body.innerText.length > 20);
      if (ok) break;
      await p.waitForTimeout(1000);
    }
  } catch (e) { console.log(`  Nav error: ${e.message}`); }
}

let token;

async function checkI18n(name, route) {
  console.log(`\n[${name}] ${route}`);
  await go(route);
  const info = await p.evaluate(() => {
    const text = document.body.innerText;
    const i18nPattern = /[a-z]+\.[a-z]+\.[a-z0-9_-]+/gi;
    const matches = text.match(i18nPattern) || [];
    const text50 = text.substring(0, 100);
    const hasRawKeys = matches.length > 0;
    const hasUndefined = text.includes('undefined') || text.includes('null');
    return { len: text.length, text50, rawKeys: matches.slice(0, 10), hasRawKeys, hasUndefined };
  });
  if (info.len > 30) ok(`${name}: page loads (${info.len}c)`);
  else { nok(`${name}: page blank`); await ss('blank_' + name.replace(/[^a-z0-9]/gi, '_')); return; }
  if (!info.hasRawKeys) ok(`${name}: no raw i18n keys`);
  else nok(`${name}: raw i18n keys`, info.rawKeys.join(', '));
  if (!info.hasUndefined) ok(`${name}: no undefined/null`);
  else nok(`${name}: undefined/null`, info.text50);
  await ss(name.replace(/[^a-z0-9]/gi, '_'));
}

try {
  const lr = await p.evaluate(async ({ a, e, p: pw }) => {
    const r = await fetch(a + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: pw }) });
    return await r.json();
  }, { a: API, e: EMAIL, p: PASS });
  if (!lr.accessToken) throw new Error('Login failed: ' + JSON.stringify(lr));
  token = lr.accessToken;
  ok('API login');

  // ===== ENGLISH =====
  console.log('\n=== ENGLISH ===');
  await checkI18n('Alerts EN', '/admin/alerts');
  await checkI18n('Barcode Scans EN', '/admin/barcodes/scans');
  await checkI18n('Notification Rules EN', '/admin/settings/notification-rules');
  await checkI18n('Adjustments EN', '/admin/inventory/adjustments');
  await checkI18n('Locations EN', '/admin/inventory/locations');
  await checkI18n('Product Categories EN', '/admin/inventory/product-categories');
  await checkI18n('Counts EN', '/admin/inventory/counts');
  await checkI18n('Machines EN', '/admin/maintenance/machines');
  await checkI18n('Machine Categories EN', '/admin/maintenance/machine-categories');
  await checkI18n('Machine Documents EN', '/admin/maintenance/machine-documents');
  await checkI18n('Machine Parts EN', '/admin/maintenance/machine-parts');
  await checkI18n('Schedules EN', '/admin/maintenance/schedules');
  await checkI18n('Tasks EN', '/admin/maintenance/tasks');
  await checkI18n('Requests EN', '/admin/maintenance/requests');
  await checkI18n('Checklist Items EN', '/admin/maintenance/checklist-items');
  await checkI18n('Downtime Logs EN', '/admin/maintenance/downtime-logs');

  // ===== SWITCH TO ARABIC =====
  console.log('\n[Switch to Arabic]');
  await go('/admin/settings/language');
  await p.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      const t = b.textContent.trim();
      if (t === 'العربية' || t === 'Arabic') { b.click(); return; }
    }
  });
  await p.waitForTimeout(3000);
  await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(1000);

  // Re-login token for Arabic
  await p.evaluate(t => localStorage.setItem('accessToken', t), token);
  await p.waitForTimeout(500);

  console.log('\n=== ARABIC ===');
  await checkI18n('Alerts AR', '/admin/alerts');
  await checkI18n('Barcode Scans AR', '/admin/barcodes/scans');
  await checkI18n('Notification Rules AR', '/admin/settings/notification-rules');
  await checkI18n('Adjustments AR', '/admin/inventory/adjustments');
  await checkI18n('Locations AR', '/admin/inventory/locations');
  await checkI18n('Product Categories AR', '/admin/inventory/product-categories');
  await checkI18n('Counts AR', '/admin/inventory/counts');
  await checkI18n('Machines AR', '/admin/maintenance/machines');
  await checkI18n('Machine Categories AR', '/admin/maintenance/machine-categories');
  await checkI18n('Machine Documents AR', '/admin/maintenance/machine-documents');
  await checkI18n('Machine Parts AR', '/admin/maintenance/machine-parts');

  console.log(`\n=== RESULTS: ${R.pass} PASS, ${R.fail} FAIL, ${R.na} N/A ===`);
} catch (e) {
  console.error(`FATAL: ${e.message}`);
  nok('Script', e.message);
} finally {
  await browser.close();
  const summary = { status: R.fail === 0 ? 'PASS' : 'FAIL', pass: R.pass, fail: R.fail, na: R.na };
  fs.writeFileSync(path.join(SS, 'browser-proof-results.json'), JSON.stringify(summary, null, 2));
  process.exit(R.fail > 0 ? 1 : 0);
}
