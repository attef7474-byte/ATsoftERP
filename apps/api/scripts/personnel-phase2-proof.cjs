/* Run after API/Web builds, against a restored clone only. Never prints credentials.
 * PERSONNEL_PROOF_DATABASE must be a distinct ATsoftERP_PERSONNEL_P2_* database.
 * Runs same-origin UI proof on loopback against this clone only.
 * All fixture records and audit history remain in the disposable clone for inspection.
 */
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const database = process.env.PERSONNEL_PROOF_DATABASE;
assert.match(database || '', /^ATsoftERP_PERSONNEL_P2_[A-Za-z0-9_]+$/);
assert.match(process.env.DATABASE_URL || '', /;database=[^;]+/i);
process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/;database=[^;]+/i, `;database=${database}`);
process.env.UPLOAD_ROOT = path.resolve('test-results/personnel-p2-uploads');
fs.mkdirSync(process.env.UPLOAD_ROOT, { recursive: true });
const { NestFactory } = require('@nestjs/core');
const { BadRequestException, ValidationPipe, VersioningType } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/src/app.module');
const { PrismaService } = require('../dist/src/common/prisma/prisma.service');
const { AllExceptionsFilter } = require('../dist/src/common/filters/http-exception.filter');
const { transformValidationErrors } = require('../dist/src/common/validation/validation-error-transformer');
const report = { database, proofScriptSha256: createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'), runId: randomUUID(), startedAt: new Date().toISOString(), status: 'RUNNING', sourceDatabaseWrites: 0, checks: [], fixtureIds: {}, browser: null, proxyTransportErrors: [] };
const pass = (check, detail) => { report.checks.push({ check, status: 'PASS', ...(detail ? { detail } : {}) }); console.log(`PASS ${check}`); };
const output = path.resolve('docs/proofs/personnel-maintenance-integrity-r1');
let app, proxy, web, browser;
const fixtureActors = [];
let elevatedGrant;
let proofClosing = false;
const reportFile = path.join(output, 'phase-2-runtime-browser-proof.json');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');


async function main() {
  app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
  app.setGlobalPrefix('api'); app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true,
    exceptionFactory: errors => new BadRequestException({ messageKey: 'common.validationFailed', errors: transformValidationErrors(errors) }) }));
  await app.listen(0, '127.0.0.1');
  const p = app.get(PrismaService), apiPort = app.getHttpServer().address().port;
  assert.equal((await p.$queryRaw`SELECT DB_NAME() AS name`)[0].name, database);
  const baseline = {};
  for (const authority of ['maintenanceRequest', 'maintenanceWorkOrder', 'maintenanceTask', 'downtimeLog', 'auditLog']) {
    baseline[authority] = []; let cursor;
    for (;;) {
      const rows = await p[authority].findMany({ select: { id: true }, take: 500, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      baseline[authority].push(...rows.map(row => row.id));
      if (rows.length < 500) break; cursor = rows.at(-1).id;
    }
  }
  const inventoryBefore = await p.inventoryMovement.count();
  const suffix = randomUUID().slice(0, 8), ctxs = [], companies = [];
  for (const label of ['A', 'B']) {
    const company = await p.company.create({ data: { code: `QA-P2-${label}-${suffix}`, name: `Phase Two Proof Company ${label}` } });
    const branch = await p.branch.create({ data: { companyId: company.id, code: `QA-P2-${label}-${suffix}`, name: `Phase Two Proof Branch ${label}` } });
    companies.push(company); ctxs.push({ companyId: company.id, branchId: branch.id });
  }
  const [ctx, ctxB] = ctxs;
  const unauthorizedBranch = await p.branch.create({ data: { companyId: ctx.companyId, code: `QA-P2-X-${suffix}`, name: 'Unauthorized Proof Branch' } });
  const phase6Keys = require('../dist/prisma/seed/seed-phase6-governance-permission-keys').PHASE6_GOVERNANCE_PERMISSION_KEYS;
  assert.equal(phase6Keys.length, 61);
  assert.equal(await p.permission.count({ where: { key: { in: [...phase6Keys] }, status: 'ACTIVE' } }), 61);
  pass('Phase 6 canonical governance permissions remain seeded: 61 of 61');
  const keys = ['maintenance-request:create', 'maintenance-request:read', 'maintenance-request:update', 'maintenance-request:start', 'maintenance-request:complete', 'maintenance-request:cancel',
    'maintenance-work-order:create', 'maintenance-work-order:read', 'maintenance-work-order:update', 'maintenance-task:create', 'maintenance-task:read', 'maintenance-task:start', 'maintenance-task:update', 'maintenance-task:complete', 'maintenance-task:downtime.close', 'downtime-log:read', 'downtime-log:update'];
  const permissions = await p.permission.findMany({ where: { key: { in: keys }, status: 'ACTIVE' }, select: { id: true, key: true } });
  assert.equal(permissions.length, keys.length);
  const role = await p.role.create({ data: { code: `QA_P2_${suffix}`, name: 'Phase Two Proof Role', permissions: { create: permissions.map(row => ({ permissionId: row.id })) } } });
  async function actor(label, context, roleId) {
    const user = await p.user.create({ data: { ...context, email: `qa-p2-${label}-${suffix}@example.invalid`, name: `Phase Two ${label} Actor`, passwordHash: randomBytes(32).toString('hex'), ...(roleId ? { roles: { create: [{ roleId }] } } : {}) } });
    fixtureActors.push({ id: user.id, ...context }); return user;
  }
  const user = await actor('Allowed', ctx, role.id), other = await actor('Other', ctxB, role.id), denied = await actor('Denied', ctx);
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const tokenFor = u => jwt.sign({ sub: u.id, email: u.email, authVersion: u.authVersion }, { expiresIn: '30m' });
  const token = tokenFor(user);
  async function request(method, route, body, expected = 200, context = ctx, auth = token) {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1${route}`, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', 'x-active-company-id': context.companyId, 'x-active-branch-id': context.branchId, 'x-locale': 'en' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json(); assert.equal(response.status, expected, `${method} ${route}: ${response.status} ${JSON.stringify(data)}`); return data;
  }
  const requests = [], orders = [], executions = [];
  async function machine(label) { return p.machine.create({ data: { ...ctx, code: `QA-P2-${label}-${suffix}`, name: `Proof Machine ${label}` } }); }
  async function task(sourceType, id) {
    const execution = await request('POST', '/maintenance/tasks', { sourceType, ...(sourceType === 'WORK_ORDER' ? { workOrderId: id } : { requestId: id }), description: 'Inspect and repair the proof equipment' }, 201);
    executions.push(execution.id); return execution;
  }
  // All operational statuses are produced by the real endpoints, never by editing status in SQL.
  for (const state of ['COMPLETED', 'IN_PROGRESS', 'OPEN']) {
    const m = await machine(`REQUEST-${state}`);
    const record = await request('POST', '/maintenance/requests', { machineId: m.id, type: 'CORRECTIVE', machineStopped: true, description: `Inspect request ${state}`, notes: `QA-P2-${suffix}` }, 201);
    requests.push({ ...record, expectedStatus: state });
    if (state !== 'OPEN') {
      const execution = await task('MAINTENANCE_REQUEST', record.id);
      await request('PATCH', `/maintenance/tasks/${execution.id}/start`, { machineStopped: true });
      if (state === 'COMPLETED') await request('PATCH', `/maintenance/tasks/${execution.id}/complete`, { machineReturnedToService: true, workPerformed: 'Inspection and repair complete' });
      else await request('PATCH', `/maintenance/tasks/${execution.id}/leave`, { endReason: 'PAUSE', workPerformed: 'Inspection started', remainingWork: 'Awaiting final check' });
    }
  }
  for (const state of ['COMPLETED', 'IN_PROGRESS', 'PLANNED', 'DRAFT', 'CANCELLED']) {
    const record = await request('POST', '/maintenance-work-orders', { scopeType: 'GENERAL', workLocation: 'Phase Two Proof Bay', description: `Inspect work order ${state}`, notes: `QA-P2-${suffix}` }, 201);
    orders.push({ ...record, expectedStatus: state });
    if (state === 'PLANNED') await request('PATCH', `/maintenance-work-orders/${record.id}/status`, { action: 'plan' });
    else if (state === 'CANCELLED') await request('PATCH', `/maintenance-work-orders/${record.id}/status`, { action: 'cancel', reason: 'Proof terminal state' });
    else if (state !== 'DRAFT') {
      const execution = await task('WORK_ORDER', record.id);
      await request('PATCH', `/maintenance/tasks/${execution.id}/start`, {});
      if (state === 'COMPLETED') await request('PATCH', `/maintenance/tasks/${execution.id}/complete`, { workPerformed: 'Inspection and repair complete' });
      else await request('PATCH', `/maintenance/tasks/${execution.id}/leave`, { endReason: 'PAUSE', workPerformed: 'Inspection started', remainingWork: 'Awaiting final check' });
    }
  }
  const list = await request('GET', '/maintenance/downtime-logs?limit=100');
  assert.equal(list.data.length, 3);
  for (const record of requests) {
    const log = list.data.find(row => row.requestId === record.id); assert(log);
    if (record.expectedStatus === 'OPEN') { assert.equal(log.execution, null); assert.equal(log.request.status, 'OPEN'); assert.equal(log.endTime, null); }
    else { assert.equal(log.execution.status, record.expectedStatus === 'COMPLETED' ? 'DONE' : 'IN_PROGRESS'); assert(log.execution.startedAt); }
    record.downtimeId = log.id;
  }
  pass('Real API request, work order and downtime lifecycle states', { requestStates: requests.map(row => row.expectedStatus), orderStates: orders.map(row => row.expectedStatus) });
  // Prove malformed historic links cannot leak foreign-tenant execution or request evidence.
  const foreignMachine = await p.machine.create({ data: { ...ctxB, code: `QA-P2-FOREIGN-${suffix}`, name: 'Other Company Machine' } });
  const foreignTask = await p.maintenanceTask.create({ data: { ...ctxB, sourceType: 'DIRECT', scopeType: 'MACHINE', machineId: foreignMachine.id, title: 'Foreign task', status: 'IN_PROGRESS', startedAt: new Date() } });
  const foreignRequest = await p.maintenanceRequest.create({ data: { machineId: foreignMachine.id, requestNumber: `QA-P2-FOREIGN-${suffix}`, title: 'Foreign request', type: 'CORRECTIVE' } });
  const broken = await p.downtimeLog.create({ data: { ...ctx, machineId: requests[0].machineId, executionId: foreignTask.id, requestId: foreignRequest.id, reason: 'Historic malformed-link isolation probe', startTime: new Date(Date.now() - 60000), endTime: new Date(), cancelledAt: new Date() } });
  const protectedList = await request('GET', '/maintenance/downtime-logs?limit=100');
  const protectedLog = protectedList.data.find(row => row.id === broken.id);
  assert.equal(protectedLog.execution, null); assert.equal(protectedLog.request, null);
  pass('Foreign linked authorities excluded by explicit SQL relation scope');
  for (const route of ['/maintenance/requests', '/maintenance-work-orders', '/maintenance/downtime-logs']) {
    await request('GET', route, undefined, 403, ctx, tokenFor(denied));
    const foreignList = await request('GET', route, undefined, 200, ctxB, tokenFor(other));
    assert(!foreignList.data.some(row => [...requests, ...orders].some(own => own.id === row.id) || row.machineId === requests[1].machineId));
    await request('GET', route, undefined, 403, ctx, tokenFor(other));
    await request('GET', route, undefined, 403, { ...ctx, branchId: unauthorizedBranch.id });
  }
  for (const [route, id] of [['/maintenance/requests', requests[0].id], ['/maintenance-work-orders', orders[0].id], ['/maintenance/downtime-logs', requests[0].downtimeId]]) {
    await request('GET', `${route}/${id}`, undefined, 404, ctxB, tokenFor(other));
    await request('PATCH', `${route}/${id}`, { notes: 'Forbidden edit probe' }, 404, ctxB, tokenFor(other));
  }
  await request('POST', '/maintenance/requests', { machineId: foreignMachine.id, type: 'CORRECTIVE', description: 'Forbidden reference' }, 404);
  pass('Normal actor permissions, foreign tenant read/edit/reference/list and context spoof denials');
  const superRole = await p.role.findFirstOrThrow({ where: { code: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null } });
  const uiActor = await actor('Browser', ctx); elevatedGrant = { userId: uiActor.id, roleId: superRole.id };
  await p.userRole.create({ data: elevatedGrant });
  report.fixtureIds = { companyId: ctx.companyId, branchId: ctx.branchId, companyBId: ctxB.companyId, requestIds: requests.map(row => row.id), orderIds: orders.map(row => row.id), executionIds: executions };
  await browserProof({ apiPort, token: tokenFor(uiActor), user: uiActor, ctx, requests, orders, p });
  assert.equal(await p.inventoryMovement.count(), inventoryBefore); pass('No inventory movement side effects');
  for (const [authority, ids] of Object.entries(baseline)) {
    let found = 0;
    for (let i = 0; i < ids.length; i += 500) found += await p[authority].count({ where: { id: { in: ids.slice(i, i + 500) } } });
    assert.equal(found, ids.length, `${authority} baseline preserved`);
  }
  pass('All pre-existing requests, orders, executions, downtime and audit records preserved', Object.fromEntries(Object.entries(baseline).map(([key, ids]) => [key, ids.length])));
  assert(await p.auditLog.count({ where: { entityId: { in: executions }, action: 'START', userId: user.id } }) >= 4);
  pass('Actor-aware execution audit persisted');
  // End only this run's open execution work through native endpoints after screenshots.
  for (const id of executions) {
    const execution = await p.maintenanceTask.findFirst({ where: { id, ...ctx } });
    if (execution.status === 'IN_PROGRESS') await request('PATCH', `/maintenance/tasks/${id}/complete`, { workPerformed: 'Proof finished and repair verified', ...(execution.machineId ? { machineReturnedToService: true } : {}) });
  }
  assert.equal(await p.maintenanceExecutionSession.count({ where: { executionId: { in: executions }, endedAt: null } }), 0);
  pass('No open fixture labor sessions after cleanup');
  report.status = 'PASS';
}

async function browserProof({ apiPort, token, user, ctx, requests, orders, p }) {
  const log = fs.openSync(path.resolve('test-results/personnel-p2-next.log'), 'a');
  web = spawn(process.execPath, [require.resolve('next/dist/bin/next', { paths: [path.resolve('apps/web')] }), 'start', '-p', '3321'], { cwd: path.resolve('apps/web'), windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_API_URL: '' } });
  proxy = http.createServer((req, res) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: req.url.startsWith('/api/v1') ? apiPort : 3321, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:3320' } }, remote => { if (!res.destroyed) { res.writeHead(remote.statusCode, remote.headers); remote.pipe(res); } });
    upstream.on('error', error => {
      report.proxyTransportErrors.push({ path: req.url, code: error.code, phase: proofClosing ? 'teardown' : 'proof', headersSent: res.headersSent });
      if (res.destroyed || res.writableEnded) return; if (res.headersSent) { res.destroy(error); return; }
      res.writeHead(502); res.end('Proof upstream unavailable');
    }); req.pipe(upstream);
  });
  await new Promise(resolve => proxy.listen(3320, '127.0.0.1', resolve));
  let ready = false;
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:3321/login')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  assert(ready, 'Isolated built web server ready');
  browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1080 } });
  const errors = [], failedApis = [], networkFailures = [], screenshots = [], observations = [];
  report.browser = { consoleErrors: errors, failedApiResponses: failedApis, networkFailures, screenshots, observations };
  page.on('pageerror', error => errors.push({ message: error.message, javascript: true }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ message: message.text(), location: message.location() }); });
  page.on('response', res => { if (res.status() >= 400 && res.url().includes('/api/v1')) failedApis.push({ path: new URL(res.url()).pathname, status: res.status() }); });
  page.on('requestfailed', req => networkFailures.push({ path: new URL(req.url()).pathname, method: req.method(), error: req.failure()?.errorText }));
  await page.addInitScript(({ token, userId, ctx }) => {
    localStorage.setItem('accessToken', token); localStorage.setItem('atsoft.erp.operational-context.current-user', userId);
    localStorage.setItem(`atsoft.erp.operational-context.user.${encodeURIComponent(userId)}`, JSON.stringify({ version: 1, userId, context: ctx }));
  }, { token, userId: user.id, ctx });
  const toneFor = state => ['DRAFT', 'PLANNED', 'OPEN'].includes(state) ? 'attention' : state === 'IN_PROGRESS' ? 'in-progress' : 'normal';
  const colors = { attention: 'rgb(254, 242, 242)', 'in-progress': 'rgb(255, 247, 237)' };
  async function assertBackground(row, color) {
    // transition-colors is intentional; assert the settled rendered style.
    await page.waitForFunction(({ node, color }) => getComputedStyle(node).backgroundColor === color, { node: await row.elementHandle(), color });
    assert.equal(await row.evaluate(node => getComputedStyle(node).backgroundColor), color);
  }
  async function assertReadable(row) {
    const sample = await row.evaluate(node => ({ background: getComputedStyle(node).backgroundColor, text: getComputedStyle(node.querySelector('td')).color }));
    const luminance = color => color.match(/\d+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const a = luminance(sample.background), b = luminance(sample.text), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert(ratio >= 4.5, `Row text contrast ${ratio}`); return { ...sample, contrastRatio: +ratio.toFixed(2) };
  }
  async function screenshot(name) { const file = `test-results/personnel-p2-${name}.png`; await page.screenshot({ path: path.resolve(file), fullPage: true }); screenshots.push(file); }
  for (const locale of ['en', 'ar']) {
    await page.context().addCookies([{ name: 'atsoft_locale', value: locale, url: 'http://127.0.0.1:3320' }]);
    for (const [domain, records, title] of [['requests', requests, 'Inspect request '], ['work-orders', orders, 'Inspect work order '], ['downtime-logs', requests, 'Inspect request ']]) {
      await page.goto(`http://127.0.0.1:3320/admin/maintenance/${domain}`, { waitUntil: 'domcontentloaded' });
      await page.locator('tbody tr[data-row-tone]').first().waitFor({ timeout: 90000 });
      assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr');
      await page.mouse.move(0, 0);
      for (const record of records) {
        const row = page.locator('tbody tr[data-row-tone]').filter({ hasText: title + record.expectedStatus });
        await row.waitFor(); assert.equal(await row.count(), 1);
        const tone = toneFor(record.expectedStatus); assert.equal(await row.getAttribute('data-row-tone'), tone);
        const color = await row.evaluate(node => getComputedStyle(node).backgroundColor);
        if (colors[tone]) assert.equal(color, colors[tone]); else assert(['rgb(255, 255, 255)', 'rgb(247, 251, 255)'].includes(color));
        observations.push({ locale, domain, state: record.expectedStatus, tone, ...(await assertReadable(row)) });
      }
      await screenshot(`${domain}-${locale}`);
      const activeRecord = records.find(record => toneFor(record.expectedStatus) === 'attention');
      const activeRow = page.locator('tbody tr[data-row-tone]').filter({ hasText: title + activeRecord.expectedStatus });
      await activeRow.hover();
      await assertBackground(activeRow, 'rgb(254, 226, 226)');
      await activeRow.locator('button').last().click();
      const menu = page.locator('[data-actions-menu]'); await menu.waitFor(); assert(await menu.locator('button:enabled').count() > 0);
      // Clicking a row action must not select/open the row underneath it.
      assert.equal(await activeRow.getAttribute('aria-selected'), 'false');
      await page.keyboard.press('Escape'); await menu.waitFor({ state: 'hidden' });
      if (domain === 'requests') {
        await activeRow.locator('td').nth(1).click(); assert.equal(await activeRow.getAttribute('aria-selected'), 'true');
        await activeRow.hover(); await assertBackground(activeRow, 'rgb(239, 246, 255)');
        observations.push({ locale, domain, selected: true, ...(await assertReadable(activeRow)) });
        await screenshot(`selection-${locale}`);
      }
      // Exercise the supported appearance mode with actual computed CSS.
      await page.evaluate(() => document.documentElement.setAttribute('data-theme-mode', 'dark'));
      const inProgress = records.find(record => record.expectedStatus === 'IN_PROGRESS');
      const orangeRow = page.locator('tbody tr[data-row-tone]').filter({ hasText: title + inProgress.expectedStatus });
      await page.mouse.move(0, 0);
      await assertBackground(orangeRow, 'rgb(73, 53, 27)');
      assert.equal(await orangeRow.locator('td').nth(1).evaluate(node => getComputedStyle(node).color), 'rgb(226, 232, 240)');
      assert.equal(await orangeRow.locator('button').last().evaluate(node => getComputedStyle(node).color), 'rgb(203, 213, 225)');
      observations.push({ locale, domain, dark: true, ...(await assertReadable(orangeRow)) });
      await orangeRow.hover(); await assertBackground(orangeRow, 'rgb(96, 69, 36)');
      await page.mouse.move(0, 0); await assertBackground(orangeRow, 'rgb(73, 53, 27)');
      if (domain === 'requests') {
        await assertBackground(activeRow, 'rgb(30, 58, 95)');
        observations.push({ locale, domain, dark: true, selected: true, ...(await assertReadable(activeRow)) });
      }
      await screenshot(`dark-${domain}-${locale}`);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme-mode', 'light'));
      const text = await page.locator('main').innerText();
      assert(!text.includes('The requested text could not be displayed.') && !text.includes('تعذر عرض النص المطلوب.'));
      pass(`Browser ${locale} ${domain}: states, hover, actions, direction and dark mode`);
    }
  }
  // Real UI state change proves refresh recalculates the same persisted row.
  await page.context().addCookies([{ name: 'atsoft_locale', value: 'en', url: 'http://127.0.0.1:3320' }]);
  await page.goto('http://127.0.0.1:3320/admin/maintenance/requests');
  const open = requests.find(row => row.expectedStatus === 'OPEN');
  const row = page.locator('tbody tr[data-row-tone]').filter({ hasText: 'Inspect request OPEN' }); await row.waitFor();
  await row.locator('button').last().click();
  await page.locator('[data-actions-menu]').getByRole('button', { name: /^Start$/i }).click();
  const confirm = page.locator('div.fixed.inset-0.z-50').last();
  const [response] = await Promise.all([page.waitForResponse(res => res.url().endsWith(`/maintenance/requests/${open.id}/start`) && res.request().method() === 'PATCH'), confirm.getByRole('button', { name: /^Confirm$/i }).click()]);
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => [...document.querySelectorAll('tbody tr')].some(row => row.textContent.includes('Inspect request OPEN') && row.getAttribute('data-row-tone') === 'in-progress'));
  assert.equal((await p.maintenanceRequest.findUnique({ where: { id: open.id } })).status, 'IN_PROGRESS');
  assert(await p.auditLog.count({ where: { entityId: open.id, action: 'START', userId: user.id } }) > 0);
  pass('UI action updates same request OPEN to IN_PROGRESS, refreshes orange row and persists actor audit');
  report.browser.knownNonOperationalErrors = errors.filter(entry => entry.message.includes('404') && entry.location?.url === 'http://127.0.0.1:3320/favicon.ico');
  assert.equal(errors.length - report.browser.knownNonOperationalErrors.length, 0);
  assert.equal(failedApis.length, 0);
  assert.equal(networkFailures.filter(row => row.path.startsWith('/api/v1') && (row.error !== 'net::ERR_ABORTED' || ['POST', 'PATCH', 'DELETE'].includes(row.method))).length, 0);
}

main().catch(error => { report.status = 'FAIL'; report.failure = error.message; console.error(error.message); process.exitCode = 1; }).finally(async () => {
  proofClosing = true;
  try {
  if (browser) await browser.close(); if (web) web.kill(); if (proxy) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
  if (app) {
    const p = app.get(PrismaService);
    if (elevatedGrant) {
      await p.userRole.deleteMany({ where: elevatedGrant });
      const remaining = await p.userRole.count({ where: elevatedGrant });
      assert.equal(remaining, 0);
      report.temporarySuperAdminGrantsRemaining = remaining;
    }
    for (const actor of fixtureActors) await p.user.updateMany({ where: actor, data: { status: 'INACTIVE', authVersion: { increment: 1 } } });
    report.fixtureActorsDeactivated = fixtureActors.length;
    await app.close();
  }
  } catch (error) {
    report.status = 'FAIL'; report.cleanupFailure = error.message; process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  }
});
