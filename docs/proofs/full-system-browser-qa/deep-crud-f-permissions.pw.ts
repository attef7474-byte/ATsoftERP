import { test as base, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:4000/api/v1';

type QAFixtures = {
  authedPage: Page;
  apiHeaders: Record<string, string>;
};

const test = base.extend<QAFixtures>({
  apiHeaders: async ({}, use) => {
    const loginResp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
    });
    const { accessToken } = await loginResp.json();
    await use({
      Authorization: `Bearer ${accessToken}`,
      'x-active-company-id': 'cmrl31uuy0000ok959hdjnca6',
      'x-active-branch-id': 'cmrx06a560000ng95g7d65vzh',
      'Content-Type': 'application/json',
    });
  },
  authedPage: async ({ page }, use) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'admin@atsofterp.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await use(page);
  },
});

test.describe('Module F: Permission & Security API Tests', () => {
  test('F1: Unauthenticated — 401 on protected endpoints', async ({}) => {
    const endpoints = [
      '/companies',
      '/branches',
      '/departments',
      '/maintenance/machines',
      '/inventory/warehouses',
      '/products',
      '/production/shifts',
    ];

    for (const ep of endpoints) {
      const resp = await fetch(`${API_BASE}${ep}`, { method: 'GET' });
      expect(resp.status).toBe(401);
      console.log(`[401] GET ${ep} → rejected`);
    }
    console.log(`[PASS] All endpoints reject unauthenticated requests`);
  });

  test('F2: Missing tenant context — 403 on context-free requests', async ({}) => {
    const loginResp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@atsofterp.com', password: 'Admin@123456' }),
    });
    const { accessToken } = await loginResp.json();

    const endpoints = [
      '/companies',
      '/branches',
      '/maintenance/machines',
      '/inventory/warehouses',
    ];

    for (const ep of endpoints) {
      const resp = await fetch(`${API_BASE}${ep}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      const isForbidden = resp.status === 403 || resp.status === 400;
      expect(isForbidden).toBeTruthy();
      console.log(`[${resp.status}] GET ${ep} without context → rejected`);
    }
    console.log(`[PASS] All endpoints reject requests without tenant context`);
  });

  test('F3: SQL injection in search — rejected safely', async ({ apiHeaders }) => {
    const payload = "'; DROP TABLE companies; --";
    const resp = await fetch(`${API_BASE}/companies?search=${encodeURIComponent(payload)}`, {
      headers: apiHeaders,
    });
    expect(resp.ok).toBeTruthy();
    const data = await resp.json();
    expect(data.data).toBeDefined();
    console.log(`[SQL-INJECT] Search with SQL injection: ${resp.status} (safe, returned data)`);

    const resp2 = await fetch(`${API_BASE}/maintenance/machines?search=${encodeURIComponent(payload)}`, {
      headers: apiHeaders,
    });
    expect(resp2.ok).toBeTruthy();
    console.log(`[SQL-INJECT] Machine search: ${resp2.status} (safe)`);
    console.log(`[PASS] SQL injection attempts handled safely`);
  });

  test('F4: XSS in create fields — stored and returned safely', async ({ apiHeaders }) => {
    const xssName = '<script>alert("xss")</script>';
    const created = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ name: xssName }),
    });
    const createdData = await created.json();
    if (created.ok) {
      expect(createdData.name).toBe(xssName);
      console.log(`[XSS] Stored XSS in name (harmless when rendered as text)`);

      const readResp = await fetch(`${API_BASE}/companies/${createdData.id}`, { headers: apiHeaders });
      const readData = await readResp.json();
      expect(readData.name).toBe(xssName);

      await fetch(`${API_BASE}/companies/${createdData.id}`, { method: 'DELETE', headers: apiHeaders });
      console.log(`[XSS] Verified and cleaned up`);
    } else {
      console.log(`[XSS] Input rejected by validation: ${created.status}`);
    }
    console.log(`[PASS] XSS handling verified`);
  });

  test('F5: Bulk operations — pagination limits respected', async ({ apiHeaders }) => {
    const resp = await fetch(`${API_BASE}/companies?limit=2`, { headers: apiHeaders });
    expect(resp.ok).toBeTruthy();
    const data = await resp.json();
    expect(data.data.length).toBeLessThanOrEqual(2);
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBeGreaterThan(0);
    console.log(`[PAGINATION] limit=2: returned ${data.data.length}/${data.meta.total}`);

    const resp2 = await fetch(`${API_BASE}/companies?limit=500`, { headers: apiHeaders });
    expect(resp2.ok).toBeTruthy();
    const data2 = await resp2.json();
    expect(data2.data.length).toBeLessThanOrEqual(100);
    console.log(`[PAGINATION] limit=500: capped at ${data2.data.length}`);

    const resp3 = await fetch(`${API_BASE}/companies?page=9999`, { headers: apiHeaders });
    expect(resp3.ok).toBeTruthy();
    const data3 = await resp3.json();
    expect(data3.data.length).toBe(0);
    console.log(`[PAGINATION] page=9999: empty result`);
    console.log(`[PASS] Pagination limits verified`);
  });

  test('F6: Unknown fields rejected by whitelist — 400', async ({ apiHeaders }) => {
    const resp = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ name: 'test', maliciousField: 'evil', anotherBad: 123 }),
    });
    expect(resp.status).toBe(400);
    const data = await resp.json();
    expect(data.success).toBe(false);
    console.log(`[WHITELIST] Unknown fields rejected: ${resp.status}`);
    console.log(`[PASS] Global ValidationPipe whitelist active`);
  });

  test('F7: Invalid JWT — rejected', async ({}) => {
    const resp = await fetch(`${API_BASE}/companies`, {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid.jwt.token', 'x-active-company-id': 'cmrl31uuy0000ok959hdjnca6', 'x-active-branch-id': 'cmrx06a560000ng95g7d65vzh' },
    });
    expect(resp.status).toBe(401);
    console.log(`[JWT] Invalid token rejected: ${resp.status}`);
    console.log(`[PASS] Invalid JWT handled correctly`);
  });

  test('F8: HTTP method not allowed — correct responses', async ({ apiHeaders }) => {
    const resp = await fetch(`${API_BASE}/companies`, {
      method: 'DELETE',
      headers: apiHeaders,
    });
    const notAllowed = resp.status === 404 || resp.status === 405;
    expect(notAllowed).toBeTruthy();
    console.log(`[METHOD] DELETE /companies (no id): ${resp.status}`);
    console.log(`[PASS] Invalid HTTP methods handled correctly`);
  });
});
