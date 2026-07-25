import { test, expect, Page } from '@playwright/test';

const API_BASE = 'http://localhost:4000/api/v1';
const WEB_BASE = 'http://localhost:3000';

const ADMIN_EMAIL = 'admin@atsofterp.com';
const ADMIN_PASSWORD = 'Admin@123456';

const REPORT_PAGES: { key: string; path: string }[] = [
  { key: 'Overview', path: '/admin/reports/maintenance' },
  { key: 'Requests', path: '/admin/reports/maintenance/requests' },
  { key: 'Downtime', path: '/admin/reports/maintenance/downtime' },
  { key: 'Costs', path: '/admin/reports/maintenance/costs' },
  { key: 'Schedules', path: '/admin/reports/maintenance/schedules' },
  { key: 'PartsUsage', path: '/admin/reports/parts-usage' },
];

async function getToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = await res.json();
  return json.accessToken;
}

async function setToken(page: Page): Promise<void> {
  const token = await getToken();
  await page.goto(WEB_BASE + '/login');
  await page.evaluate((t) => {
    localStorage.setItem('accessToken', t);
  }, token);
}

async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(WEB_BASE + path, { waitUntil: 'networkidle' });
}

test.describe('Batch G — Reports & Dashboards Browser Assertions', () => {

  test.beforeEach(async ({ page }) => {
    await setToken(page);
  });

  for (const { key, path } of REPORT_PAGES) {
    test(`${key} — Route renders page (not empty)`, async ({ page }) => {
      await navigateTo(page, path);
      await expect(page.locator('body')).not.toBeEmpty();
    });

    test(`${key} — No raw i18n keys visible`, async ({ page }) => {
      await navigateTo(page, path);
      const body = page.locator('body');
      await expect(body).not.toContainText(/^(maintenance\.|common\.|reports\.|f9\.)/);
    });

    test(`${key} — Filter F9 trigger fields present`, async ({ page }) => {
      await navigateTo(page, path);
      await page.waitForTimeout(2000);
      const filterArea = page.locator('div.flex-wrap.gap-4.items-end').first();
      await expect(filterArea).toBeVisible();
      const f9Triggers = filterArea.locator('div[role="button"]');
      const count = await f9Triggers.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test(`${key} — Zero console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(err.message));
      await navigateTo(page, path);
      await page.waitForTimeout(3000);
      expect(errors.length).toBe(0);
    });

    test(`${key} — Zero network failures`, async ({ page }) => {
      const failed: string[] = [];
      page.on('response', (res) => {
        if (!res.ok() && res.url().includes('/api/')) {
          failed.push(`${res.status()} ${res.url()}`);
        }
      });
      await navigateTo(page, path);
      await page.waitForTimeout(3000);
      expect(failed.length).toBe(0);
    });

    test(`${key} — No ChunkLoadError`, async ({ page }) => {
      const chunkErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('ChunkLoadError')) chunkErrors.push(msg.text());
      });
      await navigateTo(page, path);
      await page.waitForTimeout(3000);
      expect(chunkErrors.length).toBe(0);
    });

    test(`${key} — No _next/static 400+ failures`, async ({ page }) => {
      const staticFails: string[] = [];
      page.on('response', (res) => {
        if (!res.ok() && res.url().includes('/_next/static')) {
          staticFails.push(`${res.status()} ${res.url()}`);
        }
      });
      await navigateTo(page, path);
      await page.waitForTimeout(3000);
      expect(staticFails.length).toBe(0);
    });
  }
});
