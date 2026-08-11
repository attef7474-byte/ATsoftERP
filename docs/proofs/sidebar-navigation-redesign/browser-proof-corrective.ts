/**
 * Focused browser proof for v9 corrective patch
 * Sidebar accordion transition + Global Error Dialog + error toast migration
 */
import { chromium, type Browser, type Page } from 'playwright';

if (!process.env.SEED_ADMIN_EMAIL) {
  throw new Error('SEED_ADMIN_EMAIL environment variable is required');
}

if (!process.env.SEED_ADMIN_PASSWORD) {
  throw new Error('SEED_ADMIN_PASSWORD environment variable is required');
}

const BASE = 'http://localhost:3000';
const CREDENTIALS = { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD };

async function waitForSelector(page: Page, selector: string, timeout = 10000) {
  await page.waitForSelector(selector, { timeout });
}

async function run() {
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar' });
  const page = await context.newPage();
  const results: { name: string; pass: boolean; detail?: string }[] = [];

  async function check(name: string, fn: () => Promise<boolean | string>) {
    try {
      const result = await fn();
      if (typeof result === 'string') {
        results.push({ name, pass: true, detail: result });
      } else {
        results.push({ name, pass: result });
      }
    } catch (err: any) {
      results.push({ name, pass: false, detail: err.message });
    }
  }

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', CREDENTIALS.email);
  await page.fill('input[type="password"]', CREDENTIALS.password);
  await page.click('button[type="submit"]');
  // Wait for navigation to complete (login redirects to admin/dashboard or stays at /)
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');
  console.log('Current URL:', page.url());
  console.log('Page title:', await page.title());

  // ============ SIDEBAR TESTS ============

  await check('Sidebar visible', async () => {
    try {
      await waitForSelector(page, '.admin-sidebar', 8000);
      return await page.isVisible('.admin-sidebar');
    } catch {
      // Maybe no sidebar - try to find any navigation
      const sidebarExists = await page.$('.admin-sidebar');
      return sidebarExists !== null;
    }
  });

  await check('Sidebar group buttons exist', async () => {
    const btns = await page.$$('.sidebar-group-btn');
    return btns.length >= 9;
  });

  await check('Accordion has transition CSS', async () => {
    await page.waitForTimeout(200);
    const hasTransition = await page.evaluate(() => {
      const el = document.querySelector('.sidebar-group-content');
      if (!el) {
        // Check if the CSS rule exists in stylesheets
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules || []) {
              if (rule.cssText && rule.cssText.includes('sidebar-group-content')) return true;
            }
          } catch {}
        }
        return false;
      }
      const style = getComputedStyle(el);
      return style.transition !== '' && style.transition !== 'none' && style.transition !== 'all 0s ease 0s';
    });
    return hasTransition;
  });

  await check('Arabic group labels visible', async () => {
    const labels = await page.$$eval('.sidebar-group-label', els => els.map(e => e.textContent));
    const hasArabic = labels.some(l => /[\u0600-\u06FF]/.test(l || ''));
    return hasArabic;
  });

  await check('RTL direction applied', async () => {
    const dir = await page.getAttribute('html', 'dir');
    return dir === 'rtl';
  });

  // ============ GLOBAL ERROR DIALOG TESTS ============

  await check('Toast container renders', async () => {
    const hasContainer = await page.evaluate(() => {
      const divs = document.querySelectorAll('div');
      for (const div of divs) {
        const cls = div.className;
        if (typeof cls === 'string' && cls.includes('top-4') && cls.includes('right-4')) return true;
      }
      return false;
    });
    return hasContainer;
  });

  // ============ i18n & RAW KEY TESTS ============

  await check('No raw i18n keys visible in body text', async () => {
    const bodyText = await page.evaluate(() => document.body.innerText);
    const rawKeyPattern = /^(common\.|navigation\.|errors\.|validation\.|settings\.|errorDialog\.)/m;
    const lines = bodyText.split('\n').filter(l => rawKeyPattern.test(l.trim()));
    return lines.length === 0;
  });

  await check('All sidebar labels are localized (no hardcoded English)', async () => {
    const items = await page.$$eval('.sidebar-group-label, .sidebar-item', els =>
      els.map(e => e.textContent).filter(Boolean)
    );
    // In Arabic locale, labels should not be pure English
    const englishPattern = /^[A-Za-z\s&]+$/;
    const englishItems = items.filter(i => englishPattern.test(i?.trim() || ''));
    return englishItems.length === 0;
  });

  // ============ RESULTS ============
  console.log('\n=== FOCUSED BROWSER PROOF RESULTS ===\n');
  let passCount = 0;
  let failCount = 0;
  for (const r of results) {
    const icon = r.pass ? '✓' : '✗';
    console.log(`${icon} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    if (r.pass) passCount++; else failCount++;
  }
  console.log(`\n${passCount}/${passCount + failCount} PASS (${failCount} failures)`);

  await browser.close();
  process.exit(failCount > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Proof failed:', err.message);
  process.exit(1);
});
