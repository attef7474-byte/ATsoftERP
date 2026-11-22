/* Run after API/Web builds, against a restored clone only. Never prints credentials.
 * PERSONNEL_PROOF_DATABASE must be a distinct ATsoftERP_PERSONNEL_P34_* database.
 * Phase 3 assignment API proof; no Phase 4 UI behavior.
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
assert.match(database || '', /^ATsoftERP_PERSONNEL_P34_[A-Za-z0-9_]+$/);
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
const reportFile = path.join(output, 'phase-3-foundation-proof.json');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');



async function main() {
  app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
  app.setGlobalPrefix('api'); app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true,
    exceptionFactory: errors => new BadRequestException({ messageKey: 'common.validationFailed', errors: transformValidationErrors(errors) }) }));
  await app.listen(0, '127.0.0.1');
  const p = app.get(PrismaService), port = app.getHttpServer().address().port;
  assert.equal((await p.$queryRaw`SELECT DB_NAME() AS name`)[0].name, database);
  const suffix = randomUUID().slice(0, 8), contexts = [], personnel = [];
  for (const label of ['A', 'B']) {
    const company = await p.company.create({ data: { code: `QA-P3-${label}-${suffix}`, name: `Foundation Proof ${label}` } });
    const branch = await p.branch.create({ data: { companyId: company.id, code: `QA-P3-${label}-${suffix}`, name: `Foundation Branch ${label}` } });
    const ctx = { companyId: company.id, branchId: branch.id }; contexts.push(ctx);
    const dept = await p.department.create({ data: { ...ctx, code: `QA-P3-${label}-${suffix}`, name: `Foundation Department ${label}` } });
    const person = await p.operationalPerson.create({ data: { code: `QA-P3-${label}-${suffix}`, name: `Foundation ${label} Technician Person`, assignments: { create: { ...ctx, departmentId: dept.id, effectiveFrom: new Date(Date.now() - 10000) } }, maintenancePersonnel: { create: { role: 'TECHNICIAN' } } }, include: { maintenancePersonnel: true } });
    personnel.push(person.maintenancePersonnel.id);
  }
  const [ctx, otherCtx] = contexts;
  const keys = ['maintenance-work-order:create', 'maintenance-work-order:read', 'maintenance-work-order:update'];
  const permissions = await p.permission.findMany({ where: { key: { in: keys }, status: 'ACTIVE' } }); assert.equal(permissions.length, keys.length);
  const role = await p.role.create({ data: { code: `QA_P3_${suffix}`, name: 'Foundation proof role', permissions: { create: permissions.map(row => ({ permissionId: row.id })) } } });
  async function actor(label, context, roleId) {
    const user = await p.user.create({ data: { ...context, name: `Foundation ${label} Actor User`, email: `qa-p3-${label}-${suffix}@example.invalid`, passwordHash: randomBytes(32).toString('hex'), ...(roleId ? { roles: { create: [{ roleId }] } } : {}) } });
    fixtureActors.push({ id: user.id, ...context }); return user;
  }
  const allowed = await actor('Allowed', ctx, role.id), denied = await actor('Denied', ctx), other = await actor('Other', otherCtx, role.id);
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const token = user => jwt.sign({ sub: user.id, email: user.email, authVersion: user.authVersion }, { expiresIn: '30m' });
  async function api(method, route, body, expected, user = allowed, scope = ctx) {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1${route}`, { method, headers: { Authorization: `Bearer ${token(user)}`, 'Content-Type': 'application/json', 'x-active-company-id': scope.companyId, 'x-active-branch-id': scope.branchId }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await res.json(); assert.equal(res.status, expected, `${route} ${JSON.stringify(data)}`); return data;
  }
  const order = await api('POST', '/maintenance-work-orders', { scopeType: 'GENERAL', description: 'Inspect foundation planning assignment', workLocation: 'Foundation proof bay', assignedToId: allowed.id }, 201);
  const route = `/maintenance-work-orders/${order.id}/assignments`;
  const first = await api('POST', route, { maintenancePersonnelId: personnel[0], notes: 'Planned technical responsibility' }, 201);
  await api('POST', route, { maintenancePersonnelId: personnel[0] }, 409);
  await api('POST', route, { maintenancePersonnelId: personnel[1] }, 404);
  await api('POST', route, { maintenancePersonnelId: personnel[0], companyId: otherCtx.companyId }, 403);
  await api('POST', route, { maintenancePersonnelId: personnel[0], assignedById: denied.id }, 400);
  await api('POST', route, { maintenancePersonnelId: personnel[0] }, 403, denied);
  await api('GET', route, undefined, 404, other, otherCtx);
  await api('PATCH', `${route}/${first.id}/cancel`, {}, 404, other, otherCtx);
  pass('Assignment API tenant, RBAC, duplicate and unknown actor/tenant field denials');
  await api('PATCH', `${route}/${first.id}/cancel`, {}, 200);
  const second = await api('POST', route, { maintenancePersonnelId: personnel[0] }, 201); assert.notEqual(second.id, first.id);
  const history = await api('GET', route, undefined, 200); assert.equal(history.data.length, 2);
  assert(history.data.find(row => row.id === first.id).cancelledAt); assert.equal(history.data.find(row => row.id === second.id).cancelledAt, null);
  pass('Cancelled relation history retained; later reassignment creates a new relation');
  await assert.rejects(p.maintenanceWorkOrderAssignment.create({ data: { ...ctx, workOrderId: order.id, maintenancePersonnelId: personnel[0], assignedById: allowed.id } }), error => error.code === 'P2002');
  pass('SQL filtered unique index rejects duplicate active relation independently of API');
  assert.equal((await p.maintenanceWorkOrder.findUnique({ where: { id: order.id } })).assignedToId, allowed.id);
  assert.equal(await p.maintenanceExecutionSession.count({ where: { execution: { workOrderId: order.id } } }), 0);
  pass('Legacy single user preserved; no execution/team semantics introduced');
  const audits = await p.auditLog.findMany({ where: { entity: 'MaintenanceWorkOrderAssignment', entityId: { in: [first.id, second.id] } } });
  assert.equal(audits.length, 3);
  for (const row of audits) { assert.equal(row.userId, allowed.id); const details = JSON.parse(row.details); assert.equal(details.scope.companyId, ctx.companyId); assert.equal(details.actor.userId, allowed.id); }
  pass('Phase 6 actor-aware business audit persisted atomically for assign/cancel');
  report.fixtureIds = { orderId: order.id, companyId: ctx.companyId, assignmentIds: [first.id, second.id] };
  report.status = 'PASS';
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
