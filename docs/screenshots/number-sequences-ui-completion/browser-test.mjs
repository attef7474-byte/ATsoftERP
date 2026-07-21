import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:4000/api/v1';
const DIR = 'C:\\Users\\attef\\PycharmProjects\\Trae\\ATsofterp\\docs\\screenshots\\number-sequences-ui-completion';

async function apiToken() {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
  });
  return (await resp.json()).accessToken;
}

async function run() {
  const token = await apiToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addCookies([{ name: 'accessToken', value: token, domain: 'localhost', path: '/' }]);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() });
  });
  page.on('pageerror', err => errors.push({ type: 'page', text: err.message }));
  page.on('response', resp => {
    if (resp.status() >= 400) errors.push({ type: 'network', url: resp.url(), status: resp.status() });
  });

  console.log('=== TESTING NUMBER SEQUENCES PAGE ===');
  
  // Test Arabic UI
  console.log('\n--- Arabic UI ---');
  await page.goto(`${BASE}/admin/settings/numbering`, { waitUntil: 'networkidle0' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}\\numbering-table-arabic.png`, fullPage: true });

  // Check table headers
  const headers = await page.locator('th').allTextContents();
  console.log('Headers:', headers);

  // Test edit modal
  console.log('\n--- Testing Edit Modal ---');
  const editBtn = await page.locator('button:has-text("تعديل"), button:has-text("Edit")').first();
  if (await editBtn.count() > 0) {
    await editBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${DIR}\\numbering-edit-row.png`, fullPage: true });
    
    // Check modal fields
    const modalFields = await page.locator('input, select').allTextContents();
    console.log('Modal fields found');
    
    // Test preview
    const previewBtn = await page.locator('button:has-text("معاينة"), button:has-text("Preview")').first();
    if (await previewBtn.count() > 0) {
      await previewBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Close modal
    await page.locator('button:has-text("إلغاء"), button:has-text("Cancel")').first().click();
    await page.waitForTimeout(500);
  }

  // Test English UI
  console.log('\n--- English UI ---');
  // Change language to English via API or UI
  await page.goto(`${BASE}/admin/settings/language`, { waitUntil: 'networkidle0' });
  await page.waitForTimeout(2000);
  const langSelect = await page.locator('select[name="defaultLocale"], select[name="locale"]').first();
  if (await langSelect.count() > 0) {
    await langSelect.selectOption('en');
    await page.locator('button:has-text("حفظ"), button:has-text("Save")').first().click();
    await page.waitForTimeout(2000);
  }

  await page.goto(`${BASE}/admin/settings/numbering`, { waitUntil: 'networkidle0' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}\\numbering-table-english.png`, fullPage: true });

  const enHeaders = await page.locator('th').allTextContents();
  console.log('EN Headers:', enHeaders);

  // Test edit in English
  const enEditBtn = await page.locator('button:has-text("Edit")').first();
  if (await enEditBtn.count() > 0) {
    await enEditBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${DIR}\\numbering-edit-row.png`, fullPage: true });
    await page.locator('button:has-text("Cancel")').first().click();
    await page.waitForTimeout(500);
  }

  // Test preview
  console.log('\n--- Testing Preview ---');
  await page.goto(`${BASE}/admin/settings/numbering`, { waitUntil: 'networkidle0' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DIR}\\numbering-preview.png`, fullPage: true });

  // Final clean screenshot
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'networkidle0' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DIR}\\browser-console-clean.png`, fullPage: true });

  console.log('\n=== RESULTS ===');
  console.log(`Total errors: ${errors.length}`);
  for (const e of errors) {
    console.log(`  ${e.type}: ${e.text || e.url + ' ' + e.status}`);
  }

  fs.writeFileSync(`${DIR}\\test-results.json`, JSON.stringify({ errors }, null, 2));
  
  await browser.close();
  console.log('\nDone.');
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });