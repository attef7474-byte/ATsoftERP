import { chromium } from 'playwright';

const WEB_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:4000/api/v1';
const EMAIL = 'admin@atsofterp.com';
const PASSWORD = 'Admin@123456';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en' });
  const page = await context.newPage();

  // Track console errors and failed requests
  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });

  page.on('requestfailed', request => {
    failedRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText || 'unknown',
      method: request.method(),
    });
  });

  page.on('requestfinished', request => {
    // We'll also track responses that are 400+ for _next/static
  });

  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/_next/static') && status >= 400) {
      failedRequests.push({
        url,
        failure: `HTTP ${status}`,
        method: 'GET',
      });
    }
  });

  async function navigateAndCheck(label, path) {
    console.log(`\n[${label}] ${path}`);
    const fullUrl = `${WEB_URL}${path}`;

    // Clear previous
    const prevErrors = consoleErrors.length;
    const prevFails = failedRequests.length;

    // Hard reload: disable cache and reload
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => {
      consoleErrors.push({ text: `Navigation failed: ${e.message}`, location: '' });
    });

    // Wait a bit for any async errors
    await sleep(2000);

    const newErrors = consoleErrors.slice(prevErrors);
    const newFails = failedRequests.slice(prevFails);

    const chunkErrors = newErrors.filter(e =>
      e.text.includes('ChunkLoadError') ||
      e.text.includes('chunk') ||
      e.text.includes('Loading chunk')
    );

    const nextStaticFails = newFails.filter(f =>
      f.url.includes('/_next/static')
    );

    const otherFails = newFails.filter(f =>
      !f.url.includes('/_next/static')
    );

    let ok = true;
    if (chunkErrors.length > 0) {
      console.log(`  FAIL: ChunkLoadError - ${chunkErrors.map(e => e.text).join(', ')}`);
      ok = false;
    }
    if (nextStaticFails.length > 0) {
      console.log(`  FAIL: Next static failures - ${nextStaticFails.map(f => `${f.url} (${f.failure})`).join(', ')}`);
      ok = false;
    }
    if (ok) {
      console.log(`  OK: page loads, no chunk errors, no failed static assets`);
    }
    if (otherFails.length > 0) {
      console.log(`  INFO: Other failed requests (not next/static): ${otherFails.map(f => f.url).join(', ')}`);
    }

    // Check for any HTTP 400+ on _next/static via response listener
    return ok;
  }

  try {
    // Login via API first using global fetch
    console.log('Logging in via API...');
    const loginResp = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const loginData = await loginResp.json();
    if (loginResp.status !== 201 || !loginData.accessToken) {
      console.log(`FAIL: API login returned ${loginResp.status}`);
      await browser.close();
      process.exit(1);
    }
    console.log('  OK: API login');

    // Store cookies for web
    const cookies = await context.cookies();
    // Navigate to web root to set session
    await page.goto(WEB_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await sleep(1000);

    const routes = [
      { label: 'Login Page', path: '/login' },
      { label: 'Dashboard', path: '/admin/dashboard' },
      { label: 'Alerts', path: '/admin/alerts' },
      { label: 'Barcode Scans', path: '/admin/barcodes/scans' },
      { label: 'Settings', path: '/admin/settings' },
      { label: 'Notification Rules', path: '/admin/settings/notification-rules' },
      { label: 'Adjustments', path: '/admin/inventory/adjustments' },
      { label: 'Locations', path: '/admin/inventory/locations' },
      { label: 'Product Categories', path: '/admin/inventory/product-categories' },
      { label: 'Counts', path: '/admin/inventory/counts' },
      { label: 'Machines', path: '/admin/maintenance/machines' },
      { label: 'Machine Categories', path: '/admin/maintenance/machine-categories' },
      { label: 'Machine Documents', path: '/admin/maintenance/machine-documents' },
      { label: 'Machine Parts', path: '/admin/maintenance/machine-parts' },
      { label: 'Schedules', path: '/admin/maintenance/schedules' },
      { label: 'Tasks', path: '/admin/maintenance/tasks' },
      { label: 'Requests', path: '/admin/maintenance/requests' },
      { label: 'Checklist Items', path: '/admin/maintenance/checklist-items' },
      { label: 'Downtime Logs', path: '/admin/maintenance/downtime-logs' },
    ];

    let pass = 0;
    let fail = 0;
    for (const r of routes) {
      const ok = await navigateAndCheck(r.label, r.path);
      if (ok) pass++;
      else fail++;
    }

    console.log(`\n=== RESULTS: ${pass} PASS, ${fail} FAIL ===`);

    // Final summary of all console errors
    if (consoleErrors.length > 0) {
      console.log(`\nAll console errors (${consoleErrors.length}):`);
      for (const e of consoleErrors) {
        console.log(`  - ${e.text}${e.location ? ` (${e.location.url}:${e.location.lineNumber})` : ''}`);
      }
    }

    if (failedRequests.length > 0) {
      console.log(`\nAll failed requests (${failedRequests.length}):`);
      for (const f of failedRequests) {
        console.log(`  - ${f.method} ${f.url} => ${f.failure}`);
      }
    }

    await browser.close();

    if (fail > 0 || consoleErrors.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.log(`FATAL: ${err.message}`);
    await browser.close();
    process.exit(1);
  }
}

main();
