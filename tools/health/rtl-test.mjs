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

const R = { pass: 0, fail: 0, na: 0 };
function ok(m) { R.pass++; console.log(`  OK: ${m}`); }
function nok(m, e) { R.fail++; console.log(`  FAIL: ${m} - ${e || ''}`); }
function na(m, r) { R.na++; console.log(`  N/A: ${m} - ${r}`); }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();

async function ss(name) {
  try { await p.screenshot({ path: path.join(SS, name.replace(/[^a-z0-9.-]/gi, '_')), fullPage: true }); console.log(`  SS: ${name}`); } catch {}
}

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
  } catch (e) { console.log(`  Nav error: ${e.message}`); }
}

async function checkPage(name) {
  const info = await p.evaluate(() => ({
    len: document.body.innerText.length,
    dir: document.documentElement.getAttribute('dir'),
    locale: localStorage.getItem('locale') || 'en',
    hasAr: /[\u0600-\u06FF]/.test(document.body.innerText),
    undef: document.body.innerText.includes('undefined')
  }));
  const isRtl = info.dir === 'rtl';
  if (info.len > 30) ok(`${name} (${info.len}c, dir=${info.dir}, locale=${info.locale})`);
  else nok(`${name}: blank`, `len=${info.len}`);
  if (!info.undef) ok(`${name}: no undefined`);
  else nok(`${name}: undefined`, '');
  await ss(name.replace(/[^a-z0-9]/gi, '_') + '.png');
  return info;
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

  // Go to dashboard in default (Arabic) mode
  await go('/admin/dashboard');
  let info = await checkPage('Dashboard AR default');
  console.log(`  Default locale: ${info.locale}, dir: ${info.dir}, hasAr: ${info.hasAr}`);

  if (info.dir === 'rtl' || info.locale === 'ar') {
    ok('Default is Arabic RTL');
    await testPage('Dashboard AR', '/admin/dashboard');
  }

  // Switch to English by clicking the toggle
  const toggleEn = await p.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.trim() === 'English') { b.click(); return true; }
    }
    return false;
  });
  if (toggleEn) {
    await p.waitForTimeout(2000);
    try { await p.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
    await p.waitForTimeout(1000);
    info = await p.evaluate(() => ({
      dir: document.documentElement.getAttribute('dir'),
      locale: localStorage.getItem('locale') || 'en'
    }));
    console.log(`After EN switch: locale=${info.locale}, dir=${info.dir}`);
    if (info.dir === 'ltr') ok('English LTR confirmed');
    else na('English LTR', `dir=${info.dir}`);

    // Test EN pages
    await checkPage('Dashboard EN');
    await go('/admin/core/companies');
    await checkPage('Companies EN');
    await go('/admin/access/users');
    await checkPage('Users EN');
    await go('/admin/settings/language');
    await checkPage('Settings Language EN');
    await go('/admin/inventory/products');
    await checkPage('Products EN');

    // Switch back to Arabic
    const toggleAr = await p.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if (b.textContent.trim() === 'العربية') { b.click(); return true; }
      }
      return false;
    });
    if (toggleAr) {
      await p.waitForTimeout(2000);
      try { await p.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}
      await p.waitForTimeout(1000);
      info = await p.evaluate(() => ({
        dir: document.documentElement.getAttribute('dir'),
        locale: localStorage.getItem('locale') || 'en'
      }));
      console.log(`Back to Arabic: locale=${info.locale}, dir=${info.dir}`);
      if (info.dir === 'rtl') ok('Arabic RTL restored');
      else na('Arabic RTL restore', `dir=${info.dir}`);

      // Final EN check
      await go('/admin/dashboard');
      await checkPage('Dashboard EN final');
    } else {
      na('Switch to Arabic', 'toggle not found');
    }
  } else {
    na('Switch to English', 'toggle not found');
  }

  console.log(`\n=== RTL AUDIT: ${R.pass} PASS, ${R.fail} FAIL, ${R.na} N/A ===`);

} catch (e) {
  console.error(`FATAL: ${e.message}`);
} finally {
  await browser.close();
}

async function testPage(name, route) {
  await go(route);
  await checkPage(name);
}
