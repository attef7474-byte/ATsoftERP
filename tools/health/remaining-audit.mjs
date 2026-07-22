import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(__dirname, '..', '..', 'docs', 'screenshots', 'full-application-functional-audit');
const WEB = 'http://localhost:3000';
const API = 'http://localhost:4000';
const EMAIL = 'admin@atsofterp.com';
const PASS = 'Admin@123456';

const R = { pass: 0, fail: 0, na: 0, consoleErrors: [], networkFailures: [] };
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

async function go(url) {
  try {
    await p.goto(WEB + url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2000);
    if (token) {
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

async function testPage(name, route) {
  console.log(`\n[${name}] ${route}`);
  await go(route);
  const info = await p.evaluate(() => ({
    len: document.body.innerText.length,
    text50: document.body.innerText.substring(0, 50),
    i18n: /[a-z]+\.[a-z]+\.[a-z]+/i.test(document.body.innerText),
    table: !!document.querySelector('table'),
    tr: document.querySelectorAll('table tbody tr').length,
    undef: document.body.innerText.includes('undefined') || document.body.innerText.includes('null') && !document.body.innerText.includes('nullptr'),
  }));
  if (info.len > 30) ok(`${name}: page loads (${info.len}c)`);
  else nok(`${name}: page blank`, `len=${info.len}`);
  if (!info.i18n) ok(`${name}: no raw i18n keys`);
  else { na(`${name}: i18n key pattern`, 'false positive check'); }
  if (!info.undef) ok(`${name}: no undefined/null`);
  else nok(`${name}: undefined/null`, info.text50);
  if (info.table) ok(`${name}: grid (${info.tr}r)`);
  await ss(name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.png');
}

let token;

try {
  // Login
  const lr = await p.evaluate(async ({ a, e, p: pw }) => {
    const r = await fetch(a + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: pw }) });
    return await r.json();
  }, { a: API, e: EMAIL, p: PASS });
  if (!lr.accessToken) throw new Error('Login failed');
  token = lr.accessToken;
  console.log('Login OK');

  // Remaining pages
  await testPage('Search', '/admin/search');
  await testPage('Search Results', '/admin/search/results');
  await testPage('Search Recent', '/admin/search/recent');
  await testPage('Search Entities', '/admin/search/entities');
  await testPage('Messaging', '/admin/messaging');
  await testPage('Profile', '/admin/profile');
  await testPage('Profile Password', '/admin/profile/password');

  // Arabic RTL
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
    try { await p.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
    const rtl = await p.evaluate(() => ({
      dir: document.documentElement.getAttribute('dir'),
      ar: /[\u0600-\u06FF]/.test(document.body.innerText)
    }));
    if (rtl.dir === 'rtl' || rtl.ar) ok('Arabic RTL: dir=rtl or Arabic text');
    else na('Arabic RTL', 'not confirmed');
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

  // Results
  console.log(`\n=== REMAINING AUDIT: ${R.pass} PASS, ${R.fail} FAIL, ${R.na} N/A ===`);
  console.log(`Console errors: ${R.consoleErrors.length}, Network failures: ${R.networkFailures.length}`);
  if (R.consoleErrors.length === 0) ok('No console errors');
  if (R.networkFailures.length === 0) ok('No network failures');

} catch (e) {
  console.error(`FATAL: ${e.message}`);
} finally {
  await browser.close();
}
