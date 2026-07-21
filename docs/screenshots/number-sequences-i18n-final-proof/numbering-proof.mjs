import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:4000/api/v1';
const EMAIL = 'admin@atsofterp.com';
const PASSWORD = 'Admin@123456';

async function getToken() {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await resp.json();
  return data.accessToken;
}

async function setupPage(page, token, locale) {
  // Set localStorage before navigating
  await page.goto(BASE);
  await page.waitForTimeout(1000);
  await page.evaluate(({ token, locale }) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('locale', locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, { token, locale });
}

async function waitForTableLoad(page) {
  // Wait for data table or table-like structure to appear
  try {
    await page.waitForSelector('table, [class*="table"], [class*="DataTable"], [class*="data-table"], [role="grid"]', { timeout: 8000 });
  } catch (e) {
    // Fallback: just wait
  }
  await page.waitForTimeout(2000);
  // Scroll down to trigger lazy content
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  // Scroll back up
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function checkArabic(page, token) {
  console.log('\n=== ARABIC UI ===');
  await setupPage(page, token, 'ar');
  await page.goto(`${BASE}/admin/settings/numbering`);
  await page.waitForLoadState('networkidle');
  await waitForTableLoad(page);

  const bodyText = await page.locator('body').innerText();
  const rawKeys = (bodyText.match(/settings\.\w+/g) || []).length;

  // Log key areas
  console.log(`  URL: ${page.url()}`);

  // Find table section
  const lines = bodyText.split('\n');
  const tableSection = lines.filter(l =>
    l.includes('الكود') || l.includes('الاسم') || l.includes('البادئة') ||
    l.includes('شركة') || l.includes('مستودع') || l.includes('فرع') ||
    l.includes('مفعل') || l.includes('عام') || l.includes('تحديث')
  );
  console.log(`  Arabic content lines found:`);
  tableSection.slice(0, 15).forEach(l => console.log(`    "${l.substring(0, 120)}"`));

  // Check for specific patterns
  const checks = {
    // Column headers - the page uses separate keys
    pageTitle: bodyText.includes('تسلسل الأرقام'),
    // Check for data rows content (operation names in Arabic)
    operationCompany: bodyText.includes('شركة') && !bodyText.includes('Company'),
    // Status values
    statusActive: bodyText.includes('مفعل'),
    // Scope values
    scopeGlobal: bodyText.includes('عام'),
    // Reset policy
    resetNever: bodyText.includes('أبداً'),
    // Buttons
    refreshButton: bodyText.includes('تحديث'),
    // English text that should NOT appear
    noACTIVE: !bodyText.includes('ACTIVE'),
    noGLOBAL: !bodyText.includes('GLOBAL'),
    noCompanyEn: !bodyText.match(/(?<![شر])Company(?![كة])/),
    noBranchEn: !bodyText.match(/(?<![ف])Branch(?![ع])/),
    noAttachmentEn: !bodyText.includes('Attachment'),
    noBarcodePrintJob: !bodyText.includes('Barcode Print Job'),
    noRawKeys: rawKeys === 0,
  };

  console.log(`\n  Arabic checks:`);
  for (const [key, val] of Object.entries(checks)) {
    console.log(`    ${key}: ${val ? 'PASS' : 'FAIL'}`);
  }
  console.log(`  Raw keys: ${rawKeys}`);

  await page.screenshot({ path: 'numbering-arabic-localized-final.png', fullPage: true });
  console.log('  Screenshot saved: numbering-arabic-localized-final.png');

  return { checks, rawKeys, bodyText };
}

async function checkEnglish(page, token) {
  console.log('\n=== ENGLISH UI ===');
  await setupPage(page, token, 'en');
  await page.goto(`${BASE}/admin/settings/numbering`);
  await page.waitForLoadState('networkidle');
  await waitForTableLoad(page);

  const bodyText = await page.locator('body').innerText();
  const rawKeys = (bodyText.match(/settings\.\w+/g) || []).length;

  console.log(`  URL: ${page.url()}`);

  const lines = bodyText.split('\n');
  const tableSection = lines.filter(l =>
    l.includes('Code') || l.includes('Name') || l.includes('Operation') ||
    l.includes('Prefix') || l.includes('Company') || l.includes('Warehouse') ||
    l.includes('Active') || l.includes('Global') || l.includes('Refresh')
  );
  console.log(`  English content lines found:`);
  tableSection.slice(0, 15).forEach(l => console.log(`    "${l.substring(0, 120)}"`));

  const checks = {
    pageTitle: bodyText.includes('Number Sequences'),
    columnCode: bodyText.includes('Code'),
    columnOperation: bodyText.includes('Operation Name'),
    columnPrefix: bodyText.includes('Prefix'),
    operationCompany: bodyText.includes('Company'),
    operationWarehouse: bodyText.includes('Warehouse'),
    statusActive: bodyText.includes('Active'),
    scopeGlobal: bodyText.includes('Global'),
    resetNever: bodyText.includes('Never'),
    refreshButton: bodyText.includes('Refresh'),
    searchButton: bodyText.includes('Search'),
    noRawKeys: rawKeys === 0,
  };

  console.log(`\n  English checks:`);
  for (const [key, val] of Object.entries(checks)) {
    console.log(`    ${key}: ${val ? 'PASS' : 'FAIL'}`);
  }
  console.log(`  Raw keys: ${rawKeys}`);

  await page.screenshot({ path: 'numbering-english-localized-final.png', fullPage: true });
  console.log('  Screenshot saved: numbering-english-localized-final.png');

  return { checks, rawKeys, bodyText };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const arErrors = [];
  const enErrors = [];
  const badStatuses = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (page.url().includes('/admin/settings/numbering')) {
        if (arErrors.length + enErrors.length < 20) {
          if (!arErrors.includes(text) && !enErrors.includes(text)) {
            arErrors.push(`[${new Date().toISOString()}] ${text}`);
          }
        }
      }
    }
  });

  page.on('pageerror', err => {
    const msg = `PAGE ERROR: ${err.message}`;
    arErrors.push(msg);
  });

  page.on('response', resp => {
    const status = resp.status();
    if (status >= 400) {
      const url = resp.url();
      if (!url.includes('chrome-extension')) {
        badStatuses.push(`${status} ${url}`);
      }
    }
  });

  const token = await getToken();
  if (!token) {
    console.error('Failed to get auth token');
    process.exit(1);
  }
  console.log(`Token obtained: ${token.substring(0, 20)}...`);

  // Test Arabic
  const arResult = await checkArabic(page, token);
  const arAllPass = Object.values(arResult.checks).every(v => v === true);

  // Test English
  const enResult = await checkEnglish(page, token);
  const enAllPass = Object.values(enResult.checks).every(v => v === true);

  // Summary
  console.log('\n========== FINAL SUMMARY ==========');
  console.log(`\nArabic UI: ${arAllPass ? 'ALL PASS' : 'SOME FAILED'}`);
  for (const [key, val] of Object.entries(arResult.checks)) {
    console.log(`  ${key}: ${val ? 'PASS' : 'FAIL'}`);
  }

  console.log(`\nEnglish UI: ${enAllPass ? 'ALL PASS' : 'SOME FAILED'}`);
  for (const [key, val] of Object.entries(enResult.checks)) {
    console.log(`  ${key}: ${val ? 'PASS' : 'FAIL'}`);
  }

  console.log(`\nConsole errors:`);
  const allErrors = [...new Set([...arErrors, ...enErrors])];
  allErrors.forEach(e => console.log(`  ${e}`));
  if (allErrors.length === 0) console.log('  None');

  console.log(`\nHTTP errors (non-chunk):`);
  const nonChunk = badStatuses.filter(s => !s.includes('_next/static'));
  const chunkErrors = badStatuses.filter(s => s.includes('_next/static'));
  nonChunk.forEach(s => console.log(`  ${s}`));
  if (nonChunk.length === 0) console.log('  None');
  console.log(`  JS chunk errors: ${chunkErrors.length}`);

  await browser.close();

  // Save detailed results
  const results = {
    arabic: {
      checks: arResult.checks,
      rawKeys: arResult.rawKeys,
      allPass: arAllPass,
      errors: arErrors,
    },
    english: {
      checks: enResult.checks,
      rawKeys: enResult.rawKeys,
      allPass: enAllPass,
      errors: enErrors,
    },
    httpErrors: badStatuses,
  };
  writeFileSync('numbering-proof-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to numbering-proof-results.json');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
