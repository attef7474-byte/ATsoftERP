/* Run after API/Web builds, against a restored clone only. Never prints credentials.
 * PERSONNEL_PROOF_DATABASE must be a distinct ATsoftERP_PERSONNEL_P1_* database.
 * Optional PERSONNEL_PROOF_BROWSER=1 runs the same-origin UI proof on loopback.
 * All fixture records and audit history remain in the disposable clone for inspection.
 */
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const database = process.env.PERSONNEL_PROOF_DATABASE;
assert.match(database || '', /^ATsoftERP_PERSONNEL_P1_[A-Za-z0-9_]+$/);
assert.match(process.env.DATABASE_URL || '', /;database=[^;]+/i);
process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/;database=[^;]+/i, `;database=${database}`);
process.env.UPLOAD_ROOT = path.resolve('test-results/personnel-uploads');
fs.mkdirSync(process.env.UPLOAD_ROOT, { recursive: true });
const { NestFactory } = require('@nestjs/core');
const { BadRequestException, ValidationPipe, VersioningType } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/src/app.module');
const { PrismaService } = require('../dist/src/common/prisma/prisma.service');
const { AllExceptionsFilter } = require('../dist/src/common/filters/http-exception.filter');
const { transformValidationErrors } = require('../dist/src/common/validation/validation-error-transformer');
const { currentAssignmentWindow } = require('../dist/src/common/operational-context/current-assignment-window');
const report = { database, sourceDatabaseWrites: 0, checks: [], fixtureIds: {}, browser: null };
const pass = (check, detail) => { report.checks.push({ check, status: 'PASS', ...(detail ? { detail } : {}) }); console.log(`PASS ${check}`); };
const output = path.resolve('docs/proofs/personnel-maintenance-integrity-r1');
let app, proxy, web, browser;
const fixtureActors = [];
let elevatedGrant;

async function main() {
  app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
  app.setGlobalPrefix('api'); app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true,
    exceptionFactory: errors => new BadRequestException({ messageKey: 'common.validationFailed', errors: transformValidationErrors(errors) }) }));
  await app.listen(0, '127.0.0.1');
  const apiPort = app.getHttpServer().address().port;
  const base = `http://127.0.0.1:${apiPort}/api/v1`;
  const p = app.get(PrismaService);
  assert.equal((await p.$queryRaw`SELECT DB_NAME() AS name`)[0].name, database);
  const baseline = {};
  for (const authority of ['user', 'operationalPerson', 'operationalPersonAssignment', 'auditLog']) {
    baseline[authority] = [];
    let cursor;
    for (;;) {
      const rows = await p[authority].findMany({ select: { id: true }, take: 500, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      baseline[authority].push(...rows);
      if (rows.length < 500) break;
      cursor = rows[rows.length - 1].id;
    }
  }
  const inventoryBefore = await p.inventoryMovement.count();
  const suffix = randomUUID().slice(0, 8);
  const company = await p.company.create({ data: { code: `QA-P1-${suffix}`, name: 'Personnel Phase One Proof' } });
  const companyB = await p.company.create({ data: { code: `QA-P1-B-${suffix}`, name: 'Personnel Other Company Proof' } });
  const branch = await p.branch.create({ data: { companyId: company.id, code: `QA-P1-${suffix}`, name: 'Personnel Proof Branch' } });
  const branchB = await p.branch.create({ data: { companyId: companyB.id, code: `QA-P1-B-${suffix}`, name: 'Other Company Proof Branch' } });
  const unauthorizedBranch = await p.branch.create({ data: { companyId: company.id, code: `QA-P1-X-${suffix}`, name: 'Unauthorized Proof Branch' } });
  const departments = [];
  for (const letter of ['A', 'B', 'C']) departments.push(await p.department.create({ data: { companyId: company.id, branchId: branch.id, code: `QA-P1-${letter}-${suffix}`, name: `Proof Department ${letter}` } }));
  const departmentB = await p.department.create({ data: { companyId: companyB.id, branchId: branchB.id, code: `QA-P1-B-${suffix}`, name: 'Other Company Department' } });
  const keys = ['operational-person:create', 'operational-person:read', 'operational-person:update', 'person-assignment:create', 'person-assignment:read', 'person-assignment:transfer', 'user:create', 'user:read', 'user:update', 'maintenance-personnel:create', 'maintenance-personnel:read', 'maintenance-personnel:update'];
  const permissions = await p.permission.findMany({ where: { key: { in: keys }, status: 'ACTIVE' }, select: { id: true, key: true } });
  assert.equal(permissions.length, keys.length, 'existing seeded permission keys');
  const role = await p.role.create({ data: { code: `QA_P1_${suffix}`, name: 'Personnel proof role', permissions: { create: permissions.map(x => ({ permissionId: x.id })) } } });
  async function actor(label, companyId, branchId, roleId) {
    const created = await p.user.create({ data: { email: `qa-p1-${label}-${suffix}@example.invalid`, name: `Phase One ${label} Actor`, companyId, branchId, passwordHash: randomBytes(32).toString('hex'), ...(roleId ? { roles: { create: [{ roleId }] } } : {}) } });
    fixtureActors.push({ id: created.id, companyId, branchId });
    return created;
  }
  const user = await actor('Allowed', company.id, branch.id, role.id);
  const other = await actor('Other', companyB.id, branchB.id, role.id);
  const denied = await actor('Denied', company.id, branch.id);
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const tokenFor = u => jwt.sign({ sub: u.id, email: u.email, authVersion: u.authVersion }, { expiresIn: '30m' });
  const token = tokenFor(user);
  const ctx = { companyId: company.id, branchId: branch.id };
  const ctxB = { companyId: companyB.id, branchId: branchB.id };
  report.fixtureIds = { companyId: company.id, companyBId: companyB.id, actorId: user.id, branchId: branch.id, departmentIds: departments.map(x => x.id) };
  async function request(method, route, body, expected, context = ctx, auth = token, locale = 'en') {
    const res = await fetch(base + route, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', 'x-active-company-id': context.companyId, 'x-active-branch-id': context.branchId, 'x-locale': locale }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const data = await res.json();
    assert.equal(res.status, expected, `${method} ${route}: ${res.status} ${JSON.stringify(data)}`);
    return data;
  }
  const body = { code: `QA-P1-PERSON-${suffix}`, name: `Person ${suffix} Full Name`, phone: '771749776', placement: { departmentId: departments[0].id, effectiveFrom: new Date(Date.now() - 4 * 86400000).toISOString() }, maintenance: { role: 'TECHNICIAN', specialty: 'Proof' } };
  let invalid = await request('POST', '/person-registrations', { ...body, name: 'One Two Three' }, 400);
  assert(invalid.errors.some(x => x.code === 'validation.personFullName')); pass('API three-word name rejected');
  for (const phone of ['77174977', '7717497760', '771 749776', 'abc749776']) {
    invalid = await request('POST', '/person-registrations', { ...body, phone }, 400);
    assert(invalid.errors.some(x => x.code === 'validation.yemenPhone'));
  }
  pass('API malformed phones rejected');
  await request('POST', '/person-registrations', { ...body, unexpected: true }, 400); pass('Unknown fields rejected');
  const person = await request('POST', '/person-registrations', { ...body, name: `  Person\t${suffix} Full   Name  ` }, 201);
  assert.equal(person.name, body.name); assert.equal(person.phone, '+967771749776'); report.fixtureIds.personId = person.id;
  pass('Four-word name saved and whitespace/phone normalized');
  const edit = await request('PATCH', `/person-registrations/${person.id}`, { name: body.name, phone: '00967771749776' }, 200);
  assert.equal(edit.id, person.id); assert.equal(edit.phone, '+967771749776'); pass('Own name and phone edit preserves identity');
  await request('POST', '/person-registrations', { ...body, code: `QA-P1-DUP-${suffix}`, name: `Other ${suffix} Full Name`, phone: '+967771749776' }, 409);
  await request('POST', '/person-registrations', { ...body, code: `QA-P1-DUP2-${suffix}`, name: ` Person  ${suffix}\tFull Name `, phone: '711255777' }, 409);
  pass('Normalized duplicate name and phone rejected');
  const collision = await request('POST', '/person-registrations', { code: `QA-P1-COLLISION-${suffix}`, name: `Collision ${suffix} Full Name`, phone: '734053717', placement: { departmentId: departments[0].id } }, 201);
  await request('PATCH', `/person-registrations/${person.id}`, { phone: '734053717' }, 409);
  await request('PATCH', `/person-registrations/${person.id}`, { name: collision.name }, 409);
  pass('Edit collisions with another person rejected');
  const userBody = { email: `qa-p1-login-${suffix}@example.invalid`, password: randomBytes(24).toString('base64') + 'Aa1!', name: body.name, phone: body.phone };
  const login = await request('POST', '/users', userBody, 201);
  fixtureActors.push({ id: login.id, companyId: company.id, branchId: branch.id });
  assert.equal(login.phone, '+967771749776'); assert.equal(login.passwordHash, undefined);
  await request('PATCH', `/users/${login.id}`, { name: body.name, phone: '00967771749776' }, 200);
  await request('POST', '/users', { ...userBody, email: `qa-p1-dup-${suffix}@example.invalid`, name: `Different ${suffix} User Name`, phone: '+967771749776' }, 409);
  await request('POST', '/users', { ...userBody, email: `qa-p1-dup-name-${suffix}@example.invalid`, name: ` Person  ${suffix} Full Name `, phone: '734053717' }, 409);
  pass('User authority validates duplicates independently from OperationalPerson and permits own edit');
  const employeeBody = { code: `QA-P1-EMPLOYEE-${suffix}`, name: `Employee ${suffix} Full Name`, phone: '700600124', departmentId: departments[0].id };
  const employee = await request('POST', '/employees', employeeBody, 201);
  assert.equal(employee.phone, '+967700600124');
  await request('PATCH', `/employees/${employee.id}`, { name: employeeBody.name, phone: '00967700600124' }, 200);
  await request('POST', '/person-registrations', { code: `QA-P1-CROSS-${suffix}`, name: `Cross ${suffix} Full Name`, phone: employeeBody.phone, placement: { departmentId: departments[0].id } }, 409);
  pass('Employee writes share canonical person duplicate policy');
  const maintenance = await request('POST', '/maintenance/personnel', { name: `Maintenance ${suffix} Full Name`, phone: '700600125', departmentId: departments[0].id, role: 'TECHNICIAN' }, 201);
  assert.equal(maintenance.phone, '+967700600125');
  const anchor = await p.operationalPersonAssignment.count({ where: { personnelId: maintenance.operationalPersonId, companyId: company.id, branchId: branch.id } });
  assert.equal(anchor, 1);
  await request('PATCH', `/maintenance/personnel/${maintenance.id}`, { phone: '00967700600125' }, 200);
  await request('PATCH', `/maintenance/personnel/${maintenance.id}`, { phone: '771749776' }, 409);
  pass('Legacy maintenance create is tenant-anchored and cannot bypass shared duplicate protection');

  await request('GET', `/person-registrations/${person.id}`, undefined, 404, ctxB, tokenFor(other));
  await request('PATCH', `/person-registrations/${person.id}`, { name: 'Other Company Person Name' }, 404, ctxB, tokenFor(other));
  await request('POST', '/person-registrations', { ...body, code: `QA-P1-X-${suffix}` }, 400, ctxB, tokenFor(other));
  const leaked = await request('GET', `/person-registrations?search=${suffix}`, undefined, 200, ctxB, tokenFor(other));
  assert.equal(leaked.meta.total, 0); pass('Company B read/edit/reference/search denial');
  await request('GET', '/person-assignments', undefined, 403, ctx, tokenFor(denied));
  await request('GET', '/person-assignments', undefined, 403, { ...ctx, branchId: unauthorizedBranch.id });
  pass('Permission and unauthorized branch denial');
  const sameOther = await request('POST', '/person-registrations', { code: `QA-P1-OTHER-${suffix}`, name: body.name, phone: body.phone, placement: { departmentId: departmentB.id } }, 201, ctxB, tokenFor(other));
  assert(sameOther.id !== person.id); pass('Separate companies keep separate identities');
  let current = (await request('GET', `/person-assignments?personnelId=${person.id}`, undefined, 200)).data[0];
  for (const [index, target] of [departments[1], departments[2], departments[0]].entries()) {
    const transfer = { departmentId: target.id, effectiveFrom: new Date(Date.now() - (3 - index) * 86400000).toISOString(), relationshipResolutions: [] };
    await request('POST', `/person-assignments/${current.id}/transfer/preview`, { departmentId: transfer.departmentId, effectiveFrom: transfer.effectiveFrom }, 201);
    await request('POST', `/person-assignments/${current.id}/transfer`, transfer, 201);
    const list = await request('GET', `/person-assignments?personnelId=${person.id}&search=${suffix}&limit=1&page=1`, undefined, 200);
    assert.equal(list.meta.total, 1); assert.equal(list.data.length, 1);
    current = list.data[0]; assert.equal(current.departmentId, target.id); assert.equal(current.effectiveTo, null);
    const atBoundary = await p.operationalPersonAssignment.findMany({ where: { companyId: company.id, branchId: branch.id, personnelId: person.id, ...currentAssignmentWindow(new Date(transfer.effectiveFrom)) }, select: { id: true } });
    assert.deepEqual(atBoundary.map(x => x.id), [current.id]);
    const secondPage = await request('GET', `/person-assignments?personnelId=${person.id}&limit=1&page=2`, undefined, 200);
    assert.equal(secondPage.meta.total, 1); assert.equal(secondPage.data.length, 0);
    const history = await request('GET', `/person-assignments/person/${person.id}`, undefined, 200);
    assert.equal(history.length, index + 2);
    assert.equal(history.filter(x => x.effectiveTo === null).length, 1);
  }
  pass('A to B to C to A transfers preserve one current row, history and next transfer eligibility');
  const audits = await p.auditLog.count({ where: { userId: user.id, entity: 'OperationalPersonAssignment', action: { in: ['TRANSFER_ASSIGNMENT_CLOSE', 'TRANSFER_ASSIGNMENT_CREATE'] } } });
  assert.equal(audits, 6); pass('Database audit events persisted');
  const raceBody = { code: `QA-P1-RACE-A-${suffix}`, name: `Race ${suffix} Full Name`, phone: '711255777', placement: { departmentId: departments[0].id } };
  const race = await Promise.all([fetch(base + '/person-registrations', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-active-company-id': company.id, 'x-active-branch-id': branch.id }, body: JSON.stringify(raceBody) }), fetch(base + '/person-registrations', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-active-company-id': company.id, 'x-active-branch-id': branch.id }, body: JSON.stringify({ ...raceBody, code: `QA-P1-RACE-B-${suffix}` }) })]);
  assert.deepEqual(race.map(x => x.status).sort(), [201, 409]); pass('Concurrent identity submission creates one person');
  const raceCount = await p.operationalPerson.count({ where: { name: raceBody.name } }); assert.equal(raceCount, 1);
  for (const route of ['/employees', '/users', '/maintenance/personnel']) {
    const payload = route === '/users' ? { email: `bypass-${suffix}@example.invalid`, password: randomBytes(24).toString('base64') + 'Aa1!', name: 'One Two Three' } : route === '/employees' ? { code: `BYPASS-${suffix}`, name: 'One Two Three', departmentId: departments[0].id } : { name: 'One Two Three', role: 'TECHNICIAN', departmentId: departments[0].id };
    await request('POST', route, payload, 400);
  }
  pass('Legacy identity APIs cannot bypass full-name validation');
  const mpId = person.maintenanceCapability.id;
  await request('GET', `/maintenance/personnel/${mpId}`, undefined, 404, ctxB, tokenFor(other));
  await request('PATCH', `/maintenance/personnel/${mpId}`, { phone: '734053717' }, 404, ctxB, tokenFor(other));
  pass('Maintenance personnel tenant read/write denial');
  await request('POST', '/person-assignments', { personnelId: person.id, departmentId: departmentB.id, effectiveFrom: new Date().toISOString() }, 400, ctxB, tokenFor(other));
  pass('Cross-company person reference rejected by assignment API');
  report.rowPreservation = {};
  for (const [authority, rows] of Object.entries(baseline)) {
    let preserved = 0;
    for (let offset = 0; offset < rows.length; offset += 500) preserved += await p[authority].count({ where: { id: { in: rows.slice(offset, offset + 500).map(x => x.id) } } });
    assert.equal(preserved, rows.length);
    report.rowPreservation[authority] = { before: rows.length, preserved, lost: 0 };
  }
  const inventoryAfter = await p.inventoryMovement.count();
  assert.equal(inventoryAfter, inventoryBefore);
  report.inventoryMovementCounts = { before: inventoryBefore, after: inventoryAfter };
  pass('Existing identity, assignment and audit rows preserved; inventory unchanged');

  if (process.env.PERSONNEL_PROOF_BROWSER === '1') {
    const superRole = await p.role.findFirst({ where: { code: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null } });
    assert(superRole, 'existing supervisor role for UI administration');
    const browserUser = await actor('Browser', company.id, branch.id, superRole.id);
    elevatedGrant = { userId: browserUser.id, roleId: superRole.id };
    report.browserActor = 'Disposable SUPER_ADMIN fixture; allow/deny and tenant API proof above uses normal scoped actors';
    await browserProof({ apiPort, token: tokenFor(browserUser), user: browserUser, ctx, person, departments, suffix, request, p });
  }
  report.status = 'PASS';
}

async function browserProof({ apiPort, token, user, ctx, person, suffix, request, p }) {
  // Built UI and an isolated API share one loopback proxy origin. Production services are untouched.
  const log = fs.openSync(path.resolve('test-results/personnel-proof-next.log'), 'a');
  web = spawn(process.execPath, [require.resolve('next/dist/bin/next', { paths: [path.resolve('apps/web')] }), 'start', '-p', '3321'], { cwd: path.resolve('apps/web'), windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_API_URL: '' } });
  proxy = http.createServer((req, res) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: req.url.startsWith('/api/v1') ? apiPort : 3321, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:3320' } }, remote => { res.writeHead(remote.statusCode, remote.headers); remote.pipe(res); });
    upstream.on('error', () => { res.writeHead(502); res.end('Proof upstream unavailable'); }); req.pipe(upstream);
  });
  await new Promise(resolve => proxy.listen(3320, '127.0.0.1', resolve));
  for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:3321/login'); if (r.ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  const { chromium } = require('playwright');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const browserErrors = [], failures = [], assetFailures = [];
  report.browser = { consoleErrors: browserErrors, failedApiResponses: failures, assetFailures };
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push({ message: message.text(), location: message.location() }); });
  page.on('response', res => { if (res.status() >= 400) (res.url().includes('/api/v1') ? failures : assetFailures).push({ status: res.status(), path: new URL(res.url()).pathname }); });
  await page.addInitScript(({ token, userId, ctx }) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('atsoft.erp.operational-context.current-user', userId);
    localStorage.setItem(`atsoft.erp.operational-context.user.${encodeURIComponent(userId)}`, JSON.stringify({ version: 1, userId, context: ctx }));
  }, { token, userId: user.id, ctx });
  for (const locale of ['en', 'ar']) {
    await page.context().addCookies([{ name: 'atsoft_locale', value: locale, url: 'http://127.0.0.1:3320' }]);
    await page.goto('http://127.0.0.1:3320/admin/core/persons');
    console.log(`Checking ${locale} form: errors=${browserErrors.length} failedAPI=${failures.length}`);
    await page.locator('button').filter({ hasText: locale === 'en' ? /Create|Register Person|New/i : /إنشاء|تسجيل شخص|جديد/ }).first().waitFor({ timeout: 90000 });
    const expectedDir = locale === 'en' ? 'ltr' : 'rtl';
    assert.equal(await page.locator('html').getAttribute('dir'), expectedDir);
    // The primary action is permission-gated and opens the real registration modal.
    await page.locator('button').filter({ hasText: locale === 'en' ? /Create|Register Person|New/i : /إنشاء|تسجيل شخص|جديد/ }).first().click();
    const phone = page.locator('input[name="phone"]'); await phone.waitFor();
    assert.equal(await page.locator('[data-phone-prefix]').textContent(), '+967');
    assert.equal(await phone.getAttribute('maxlength'), '9');
    await page.locator('input[name="name"]').fill(locale === 'en' ? 'One Two Three' : 'علي حسن عبدالله');
    await phone.fill('77174977');
    const modal = phone.locator('xpath=ancestor::*[@role="dialog"]');
    assert.equal(await modal.getByText(locale === 'en' ? 'Specialty' : 'التخصص', { exact: true }).count(), 1);
    assert.equal(await modal.getByText(locale === 'en' ? 'Enable role' : 'تمكين الدور', { exact: true }).count(), 1);
    const save = modal.getByRole('button', { name: locale === 'en' ? /^Save$/i : /^حفظ$/ });
    await page.screenshot({ path: path.resolve(`test-results/personnel-p1-before-save-${locale}.png`), fullPage: true });
    await save.click();
    assert.equal(await page.locator('input[name="name"]').getAttribute('aria-invalid'), 'true');
    assert.equal(await phone.getAttribute('aria-invalid'), 'true');
    const formText = await modal.innerText();
    assert(!formText.includes('The requested text could not be displayed.'));
    assert(!formText.includes('تعذر عرض النص المطلوب.'));
    await page.screenshot({ path: path.resolve(`test-results/personnel-p1-${locale}.png`), fullPage: true });
    pass(`Browser ${locale} ${expectedDir} phone prefix and name/phone validation`);
    if (locale === 'en') {
      const browserName = `Browser ${suffix} Person Name`;
      await page.locator('input[name="code"]').fill(`QA-P1-BROWSER-${suffix}`);
      await page.locator('input[name="name"]').fill(browserName);
      await phone.fill('700600123');
      await modal.locator('#departmentId').click();
      const lookup = page.locator('div.fixed.inset-0.z-50').last();
      await lookup.getByText('Proof Department A', { exact: true }).click();
      const [createdResponse] = await Promise.all([
        page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/person-registrations' && r.request().method() === 'POST'), save.click(),
      ]);
      assert.equal(createdResponse.status(), 201);
      const created = await createdResponse.json();
      await phone.waitFor({ state: 'hidden' });
      const stored = await p.operationalPerson.findUnique({ where: { id: created.id } });
      assert.equal(stored.name, browserName); assert.equal(stored.phone, '+967700600123');
      assert.equal(await p.auditLog.count({ where: { entityId: created.id, action: 'CREATE' } }), 1);
      pass('Browser create traverses UI API permissions database and audit');
      await page.locator('tr').filter({ hasText: browserName }).click();
      await page.getByRole('button', { name: /^Edit$/i }).first().click();
      await phone.waitFor(); assert.equal(await phone.inputValue(), '700600123');
      await page.locator('input[name="name"]').fill(browserName + 'Updated');
      const [updatedResponse] = await Promise.all([
        page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/person-registrations/${created.id}` && r.request().method() === 'PATCH'),
        page.getByRole('dialog').getByRole('button', { name: /^Save$/i }).click(),
      ]);
      assert.equal(updatedResponse.status(), 200);
      assert.equal((await updatedResponse.json()).id, created.id);
      await phone.waitFor({ state: 'hidden' });
      pass('Browser edit loads canonical phone and updates the same identity');
    }
  }
  console.log('Checking assignment table in browser');
  await page.goto('http://127.0.0.1:3320/admin/core/person-assignments', { waitUntil: 'domcontentloaded' });
  const row = page.locator('tr').filter({ hasText: person.name }); await row.waitFor();
  assert.equal(await row.count(), 1);
  assert.equal(await row.getByRole('button', { name: /نقل الشخص|Transfer Person/i }).count(), 1);
  pass('Browser current table has one row and transfer action after repeated transfers');
  await page.goto(`http://127.0.0.1:3320/admin/core/persons/${person.id}`, { waitUntil: 'domcontentloaded' });
  await page.locator('tbody tr').first().waitFor();
  assert.equal(await page.locator('tbody tr').count(), 4);
  pass('Browser person history still displays all four placement rows');
  report.browser = { consoleErrors: browserErrors, failedApiResponses: failures, assetFailures, screenshots: ['test-results/personnel-p1-en.png', 'test-results/personnel-p1-ar.png'] };
  // The existing app has no favicon.ico. Keep that known non-operational console
  // error in the evidence; any other console/JavaScript error still fails proof.
  const unexpectedErrors = browserErrors.filter(entry => !(typeof entry === 'object' && entry.message.includes('404') && entry.location?.url === 'http://127.0.0.1:3320/favicon.ico'));
  report.browser.knownNonOperationalErrors = browserErrors.filter(entry => !unexpectedErrors.includes(entry));
  assert.equal(unexpectedErrors.length, 0);
  assert.equal(failures.length, 0);
}

main().catch(error => { report.status = 'FAIL'; report.failure = error.message; console.error(error.message); process.exitCode = 1; }).finally(async () => {
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
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, process.env.PERSONNEL_PROOF_BROWSER === '1' ? 'runtime-browser-proof.json' : 'runtime-api-proof.json'), JSON.stringify(report, null, 2) + '\n');
});
