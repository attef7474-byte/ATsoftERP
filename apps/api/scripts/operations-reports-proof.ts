import { config } from 'dotenv';
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import * as bcrypt from 'bcryptjs';
import { OPERATIONS_REPORT_PERMISSION_KEYS } from '../src/modules/reports/operations-reports.constants';

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });
const API_URL = process.env.PROOF_API_URL || 'http://localhost:4000/api/v1';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required to run this proof script`);
  }
  return value;
}

const PROOF_PASSWORD = requireEnv('PROOF_PASSWORD');

type ProofCase = { name: string; expected: string; actual: string; pass: boolean };
const cases: ProofCase[] = [];
const latency: Record<string, number[]> = { overview: [], drilldown: [], export: [] };
let fixture: { userId: string; roleId: string } | null = null;

function record(name: string, expected: string, actual: string, pass: boolean) {
  cases.push({ name, expected, actual, pass });
}

async function httpJson(method: string, path: string, token?: string, headers: Record<string, string> = {}, body?: unknown) {
  const startedAt = performance.now();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let responseBody: any = null;
  try { responseBody = await response.json(); } catch { responseBody = null; }
  return { status: response.status, body: responseBody, elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100 };
}

function latencySummary(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  return { samples: sorted.length, minMs: sorted[0] ?? 0, p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: sorted.at(-1) ?? 0 };
}

async function login(email: string): Promise<string> {
  const response = await httpJson('POST', '/auth/login', undefined, {}, { email, password: PROOF_PASSWORD });
  if (![200, 201].includes(response.status) || !response.body?.accessToken) throw new Error(`temporary proof login failed: HTTP ${response.status}`);
  return response.body.accessToken;
}

async function main() {
  const health = await httpJson('GET', '/health');
  if (health.status !== 200) throw new Error(`API health failed: HTTP ${health.status}`);

  const company = await prisma.company.findUniqueOrThrow({ where: { code: 'DEFAULT' } });
  const branch = await prisma.branch.findFirstOrThrow({ where: { companyId: company.id, code: 'HQ', deletedAt: null } });
  const headers = { 'x-active-company-id': company.id, 'x-active-branch-id': branch.id };
  const stamp = Date.now();
  const role = await prisma.role.create({ data: { code: `TMP_OPERATIONS_REPORT_PROOF_${stamp}`, name: 'Temporary Operations Report Proof Role', description: 'Removed automatically by operations-reports-proof.ts', status: 'ACTIVE' } });
  const user = await prisma.user.create({ data: { email: `operations-report-proof-${stamp}@atsofterp.local`, passwordHash: await bcrypt.hash(PROOF_PASSWORD, 10), name: 'Temporary Operations Report Proof User', companyId: company.id, branchId: branch.id, status: 'ACTIVE' } });
  fixture = { userId: user.id, roleId: role.id };
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

  const readPermission = await prisma.permission.findUniqueOrThrow({ where: { key: OPERATIONS_REPORT_PERMISSION_KEYS.read } });
  const exportPermission = await prisma.permission.findUniqueOrThrow({ where: { key: OPERATIONS_REPORT_PERMISSION_KEYS.export } });
  const path = '/reports/operations/overview?dateFrom=2026-07-09&dateTo=2026-08-08';
  const drillPath = '/reports/operations/drilldown?dateFrom=2026-07-09&dateTo=2026-08-08&page=1&limit=20';

  let token = await login(user.email);
  let response = await httpJson('GET', path, token, headers);
  record('read denied without permission', '403', String(response.status), response.status === 403);
  response = await httpJson('POST', '/reports/operations/export', token, headers, { dateFrom: '2026-07-09', dateTo: '2026-08-08' });
  record('export denied without permission', '403', String(response.status), response.status === 403);

  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: readPermission.id } });
  token = await login(user.email);
  response = await httpJson('GET', path, token, headers);
  record('read allowed with read permission', '200', String(response.status), response.status === 200 && response.body?.formulaVersion === 'PHASE_2_OPERATIONS_V1');
  const overviewRunCount = response.body?.summary?.runCount;
  response = await httpJson('GET', drillPath, token, headers);
  record('drilldown reconciles to overview', String(overviewRunCount), `${response.status}/${response.body?.meta?.total}`, response.status === 200 && response.body?.meta?.total === overviewRunCount);
  response = await httpJson('POST', '/reports/operations/export', token, headers, { dateFrom: '2026-07-09', dateTo: '2026-08-08' });
  record('read permission does not grant export', '403', String(response.status), response.status === 403);

  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: exportPermission.id } });
  token = await login(user.email);
  response = await httpJson('POST', '/reports/operations/export', token, headers, { dateFrom: '2026-07-09', dateTo: '2026-08-08' });
  latency.export.push(response.elapsedMs);
  record('export allowed with export permission', '201/bounded CSV', `${response.status}/${response.body?.rowCount}`, response.status === 201 && response.body?.rowCount <= response.body?.maxRows && typeof response.body?.csv === 'string');

  // Batch 2E evidence: warm, sequential samples on the real authenticated route.
  // These figures describe this local experimental dataset; they are deliberately
  // reported without inventing a universal production SLA.
  for (let index = 0; index < 10; index += 1) {
    const overviewSample = await httpJson('GET', path, token, headers);
    if (overviewSample.status !== 200) throw new Error(`overview latency sample failed: HTTP ${overviewSample.status}`);
    latency.overview.push(overviewSample.elapsedMs);
    const drilldownSample = await httpJson('GET', drillPath, token, headers);
    if (drilldownSample.status !== 200) throw new Error(`drilldown latency sample failed: HTTP ${drilldownSample.status}`);
    latency.drilldown.push(drilldownSample.elapsedMs);
  }

  response = await httpJson('GET', path, 'invalid-token', headers);
  record('invalid token rejected', '401', String(response.status), response.status === 401);
  response = await httpJson('GET', path, token);
  record('missing active context rejected', '403', String(response.status), response.status === 403);
  response = await httpJson('GET', '/reports/operations/overview?dateFrom=2025-01-01&dateTo=2026-08-08', token, headers);
  record('over-limit window rejected safely', '400', String(response.status), response.status === 400);

  const foreignMachine = await prisma.machine.findFirst({ where: { companyId: { not: company.id }, deletedAt: null }, select: { id: true } });
  if (foreignMachine) {
    response = await httpJson('GET', `${path}&machineId=${encodeURIComponent(foreignMachine.id)}`, token, headers);
    record('foreign-tenant machine cannot leak', '403/404 or zero rows', `${response.status}/${response.body?.summary?.runCount ?? '-'}`, [403, 404].includes(response.status) || (response.status === 200 && response.body?.summary?.runCount === 0));
  }

  const auditCount = await prisma.auditLog.count({ where: { userId: user.id, entity: 'OperationsReportExport', action: 'EXPORT' } });
  record('successful export is audited for the proof user', '1', String(auditCount), auditCount === 1);

  const failed = cases.filter((item) => !item.pass);
  console.log(JSON.stringify({
    cases,
    latencyMs: {
      overview: latencySummary(latency.overview),
      drilldown: latencySummary(latency.drilldown),
      export: latencySummary(latency.export),
      scope: 'local experimental dataset; evidence only, not a production SLA',
    },
  }, null, 2));
  if (failed.length > 0) throw new Error(`${failed.length} operations report runtime proof case(s) failed`);
  console.log('OPERATIONS REPORT RUNTIME PROOF PASSED');
}

async function cleanup() {
  if (!fixture) return;
  await prisma.auditLog.deleteMany({ where: { userId: fixture.userId } });
  await prisma.userOperationalScope.deleteMany({ where: { userId: fixture.userId } });
  await prisma.userRole.deleteMany({ where: { userId: fixture.userId } });
  await prisma.rolePermission.deleteMany({ where: { roleId: fixture.roleId } });
  await prisma.user.deleteMany({ where: { id: fixture.userId } });
  await prisma.role.deleteMany({ where: { id: fixture.roleId } });
  console.log('Operations report proof fixtures cleaned up.');
}

main()
  .catch((error) => { console.error('OPERATIONS REPORT RUNTIME PROOF FAILED:', (error as Error).message); process.exitCode = 1; })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); });
