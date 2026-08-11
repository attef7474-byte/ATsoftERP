import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const API_URL = process.env.PROOF_API_URL || "http://localhost:4000/api/v1";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required to run this proof script`);
  }
  return value;
}

const SUPER_ADMIN_EMAIL = requireEnv("SEED_ADMIN_EMAIL");
const SUPER_ADMIN_PASSWORD = requireEnv("SEED_ADMIN_PASSWORD");
const PROOF_ROLE_PREFIX = "TMP_PRODUCTION_PROOF_ROLE";
const PROOF_PASSWORD = requireEnv("PROOF_PASSWORD");

interface CaseResult {
  name: string;
  method: string;
  endpoint: string;
  expected: string;
  actual: string;
  pass: boolean;
}

const results: CaseResult[] = [];
const fixtureIds: string[] = [];
let fallbackSuperAdminUserId: string | undefined;

function record(name: string, method: string, endpoint: string, expected: string, actual: string, pass: boolean): void {
  results.push({ name, method, endpoint, expected, actual, pass });
}

async function httpJson(
  method: string,
  path: string,
  token: string | null,
  headers: Record<string, string> = {},
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let responseBody: any = null;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }
  return { status: response.status, body: responseBody };
}

async function waitForApi(): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`API not reachable at ${API_URL} after 90s`);
}

async function login(email: string, password: string): Promise<string> {
  const { status, body } = await httpJson("POST", "/auth/login", null, {}, { email, password });
  if (status !== 201 && status !== 200) {
    throw new Error(`login failed for ${email}: HTTP ${status} ${JSON.stringify(body)}`);
  }
  const token = body?.accessToken;
  if (!token) throw new Error(`login returned no accessToken for ${email}`);
  return token;
}

async function main(): Promise<void> {
  await waitForApi();

  const company = await prisma.company.findUniqueOrThrow({ where: { code: "DEFAULT" } });
  const branch = await prisma.branch.findFirstOrThrow({ where: { companyId: company.id, code: "HQ" } });
  const ctxA = {
    "x-active-company-id": company.id,
    "x-active-branch-id": branch.id,
  };

  let token: string;
  try {
    token = await login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
  } catch (error) {
    console.log(`SUPER_ADMIN default login unavailable (${(error as Error).message}); creating temporary SUPER_ADMIN user.`);
    const superRole = await prisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } });
    const passwordHash = await bcrypt.hash(PROOF_PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `prod-proof-super-${Date.now()}@atsofterp.local`,
        passwordHash,
        name: "Production Proof Super Admin (temporary)",
        companyId: company.id,
        branchId: branch.id,
        status: "ACTIVE",
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: superRole.id } });
    fallbackSuperAdminUserId = user.id;
    token = await login(user.email, PROOF_PASSWORD);
  }

  const companyB = await prisma.company.create({
    data: { code: `TMPC2-${Date.now()}`, name: "Proof Company B (temporary)", status: "ACTIVE" },
  });
  const branchB = await prisma.branch.create({
    data: { code: `TMPBR2-${Date.now()}`, name: "Proof Branch B (temporary)", companyId: companyB.id, status: "ACTIVE" },
  });
  fixtureIds.push(companyB.id, branchB.id);
  const ctxB = {
    "x-active-company-id": companyB.id,
    "x-active-branch-id": branchB.id,
  };

  // ---------- Production units ----------
  const unitCode = `PCE-${Date.now()}`;
  let res = await httpJson("POST", "/production/units", token, ctxA, { code: unitCode, name: "Piece", abbreviation: "pcs", decimals: 2 });
  record("create production unit", "POST", "/production/units", "2xx", String(res.status), res.status >= 200 && res.status < 300);
  const unitId = res.body?.id ?? null;
  if (!unitId) throw new Error("unit create returned no id");

  res = await httpJson("POST", "/production/units", token, ctxA, { code: unitCode, name: "Duplicate" });
  record("duplicate unit code rejected in tenant", "POST", "/production/units", "400", String(res.status), res.status === 400);

  res = await httpJson("GET", `/production/units/${unitId}`, token, ctxA);
  record("read unit in own tenant", "GET", `/production/units/${unitId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("PATCH", `/production/units/${unitId}`, token, ctxA, { abbreviation: "pcs.", description: "Proof unit" });
  record("update unit in own tenant", "PATCH", `/production/units/${unitId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("GET", `/production/units/${unitId}`, token, ctxB);
  record("unit not readable from another company (404)", "GET", `/production/units/${unitId}`, "404", String(res.status), res.status === 404);

  res = await httpJson("PATCH", `/production/units/${unitId}`, token, ctxB, { name: "Hijack" });
  record("unit not updatable from another company (404)", "PATCH", `/production/units/${unitId}`, "404", String(res.status), res.status === 404);

  res = await httpJson("DELETE", `/production/units/${unitId}`, token, ctxB);
  record("unit not deletable from another company (404)", "DELETE", `/production/units/${unitId}`, "404", String(res.status), res.status === 404);

  // ---------- Product definition ----------
  const product = await prisma.product.findFirst({ where: { status: "ACTIVE" } });
  if (!product) throw new Error("no active product available for proof");

  res = await httpJson("POST", "/production/product-definitions", token, ctxA, { productId: product.id });
  record("create product definition with auto code", "POST", "/production/product-definitions", "2xx", String(res.status), res.status >= 200 && res.status < 300);
  const definitionId = res.body?.id ?? null;
  if (!definitionId) throw new Error("definition create returned no id");
  record("definition code auto-generated with PP- prefix", "POST", "/production/product-definitions", "PP-", String(res.body?.code ?? ""), typeof res.body?.code === "string" && res.body.code.startsWith("PP-"));
  record("definition name defaults from product", "POST", "/production/product-definitions", product.name, String(res.body?.name ?? ""), res.body?.name === product.name);

  res = await httpJson("PATCH", `/production/product-definitions/${definitionId}`, token, ctxA, { description: "Proof definition" });
  record("update definition in own tenant", "PATCH", `/production/product-definitions/${definitionId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("GET", `/production/product-definitions/${definitionId}`, token, ctxA);
  record("read definition with children arrays", "GET", `/production/product-definitions/${definitionId}`, "200+children", `${res.status}`, res.status === 200 && Array.isArray(res.body?.specifications) && Array.isArray(res.body?.versions) && Array.isArray(res.body?.packagings) && Array.isArray(res.body?.eligibilities));

  res = await httpJson("GET", `/production/product-definitions/${definitionId}`, token, ctxB);
  record("definition not readable from another company (404)", "GET", `/production/product-definitions/${definitionId}`, "404", String(res.status), res.status === 404);

  res = await httpJson("POST", "/production/product-definitions", token, ctxB, { productId: product.id, defaultUnitId: unitId });
  record("cross-company default unit reference rejected", "POST", "/production/product-definitions", "400", String(res.status), res.status === 400);

  // ---------- Children ----------
  res = await httpJson("POST", `/production/product-definitions/${definitionId}/specifications`, token, ctxA, { attributeName: "Weight", attributeValue: "500g", dataType: "TEXT", isRequired: true, sortOrder: 1 });
  record("add specification", "POST", `/production/product-definitions/${definitionId}/specifications`, "2xx", String(res.status), res.status >= 200 && res.status < 300);
  const specId = res.body?.id ?? null;

  res = await httpJson("POST", `/production/product-definitions/${definitionId}/versions`, token, ctxA, { versionLabel: "V1", isCurrent: true });
  record("add version v1 (current)", "POST", `/production/product-definitions/${definitionId}/versions`, "2xx", String(res.status), res.status >= 200 && res.status < 300);
  const version1Id = res.body?.id ?? null;
  const version1Number = res.body?.versionNumber;

  res = await httpJson("POST", `/production/product-definitions/${definitionId}/versions`, token, ctxA, { versionLabel: "V2" });
  record("add version v2 with auto-increment number", "POST", `/production/product-definitions/${definitionId}/versions`, `auto ${(version1Number ?? 0) + 1}`, `#${res.body?.versionNumber}`, res.body?.versionNumber === (version1Number ?? 0) + 1);
  const version2Id = res.body?.id ?? null;

  res = await httpJson("PATCH", `/production/product-definitions/${definitionId}/versions/${version2Id}/set-current`, token, ctxA, {});
  record("set version v2 as current", "PATCH", `/production/product-definitions/${definitionId}/versions/${version2Id}/set-current`, "200", String(res.status), res.status === 200);

  res = await httpJson("DELETE", `/production/product-definitions/${definitionId}/versions/${version1Id}`, token, ctxA, {});
  record("delete non-current version", "DELETE", `/production/product-definitions/${definitionId}/versions/${version1Id}`, "200", String(res.status), res.status === 200);

  res = await httpJson("DELETE", `/production/product-definitions/${definitionId}/versions/${version2Id}`, token, ctxA, {});
  record("current version delete blocked (409)", "DELETE", `/production/product-definitions/${definitionId}/versions/${version2Id}`, "409", String(res.status), res.status === 409);

  res = await httpJson("POST", `/production/product-definitions/${definitionId}/packagings`, token, ctxA, { packagingType: "CARTON", packQuantity: 24, isDefault: true });
  record("add packaging (default)", "POST", `/production/product-definitions/${definitionId}/packagings`, "2xx", String(res.status), res.status >= 200 && res.status < 300);
  const packagingId = res.body?.id ?? null;

  res = await httpJson("POST", `/production/product-definitions/${definitionId}/packagings`, token, ctxA, { packagingType: "BOX", packQuantity: 0 });
  record("packQuantity <= 0 rejected", "POST", `/production/product-definitions/${definitionId}/packagings`, "400", String(res.status), res.status === 400);

  res = await httpJson("DELETE", `/production/product-definitions/${definitionId}/packagings/${packagingId}`, token, ctxA, {});
  record("delete packaging", "DELETE", `/production/product-definitions/${definitionId}/packagings/${packagingId}`, "200", String(res.status), res.status === 200);

  const machineA = await prisma.machine.create({
    data: { code: `TMPMAC-${Date.now()}`, name: "Proof Machine A (temporary)", companyId: company.id, branchId: branch.id, status: "ACTIVE" },
  });
  const machineB = await prisma.machine.create({
    data: { code: `TMPMAC-${Date.now()}`, name: "Proof Machine B (temporary)", companyId: companyB.id, branchId: branchB.id, status: "ACTIVE" },
  });
  fixtureIds.push(machineA.id, machineB.id);

  let lineA: any = await prisma.productionLine.findFirst({ where: { companyId: company.id, branchId: branch.id, deletedAt: null } });
  if (!lineA) {
    const department = await prisma.department.findFirst({ where: { companyId: company.id } });
    const operationType = await prisma.operationType.findFirst();
    if (department && operationType) {
      lineA = await prisma.productionLine.create({
        data: {
          code: `TMPLN-${Date.now()}`,
          name: "Proof Line A (temporary)",
          companyId: company.id,
          branchId: branch.id,
          departmentId: department.id,
          operationTypeId: operationType.id,
          status: "ACTIVE",
        },
      });
      fixtureIds.push(lineA.id);
    }
  }

  res = await httpJson("POST", `/production/product-definitions/${definitionId}/eligibilities`, token, ctxA, { resourceType: "MACHINE", machineId: machineA.id, priority: 1, isDefault: true });
  record("add MACHINE eligibility (own company)", "POST", `/production/product-definitions/${definitionId}/eligibilities`, "2xx", String(res.status), res.status >= 200 && res.status < 300);

  res = await httpJson("POST", `/production/product-definitions/${definitionId}/eligibilities`, token, ctxA, { resourceType: "MACHINE", machineId: machineB.id });
  record("cross-company machine eligibility rejected", "POST", `/production/product-definitions/${definitionId}/eligibilities`, "400", String(res.status), res.status === 400);

  res = await httpJson("POST", `/production/product-definitions/${definitionId}/eligibilities`, token, ctxA, { resourceType: "MACHINE", machineId: machineA.id, productionLineId: "l-x" });
  record("conflicting resource ids rejected", "POST", `/production/product-definitions/${definitionId}/eligibilities`, "400", String(res.status), res.status === 400);

  if (lineA) {
    res = await httpJson("POST", `/production/product-definitions/${definitionId}/eligibilities`, token, ctxA, { resourceType: "LINE", productionLineId: lineA.id, priority: 2 });
    record("add LINE eligibility (own company)", "POST", `/production/product-definitions/${definitionId}/eligibilities`, "2xx", String(res.status), res.status >= 200 && res.status < 300);
  } else {
    record("add LINE eligibility (own company)", "POST", `/production/product-definitions/${definitionId}/eligibilities`, "2xx", "SKIPPED (no production line/department fixture)", false);
  }

  // ---------- Permission denial ----------
  const role = await prisma.role.create({
    data: { code: `${PROOF_ROLE_PREFIX}_${Date.now()}`, name: "Temporary Production Proof Role", description: "Removed after the proof run", isSystem: false, status: "ACTIVE" },
  });
  const proofPasswordHash = await bcrypt.hash(PROOF_PASSWORD, 10);
  const proofUser = await prisma.user.create({
    data: { email: `prod-proof-${Date.now()}@atsofterp.local`, passwordHash: proofPasswordHash, name: "Production Proof User (temporary)", companyId: company.id, branchId: branch.id, status: "ACTIVE" },
  });
  await prisma.userRole.create({ data: { userId: proofUser.id, roleId: role.id } });
  const proofToken = await login(proofUser.email, PROOF_PASSWORD);

  res = await httpJson("GET", "/production/units", proofToken, ctxA);
  record("user without production permissions denied (403)", "GET", "/production/units", "403", String(res.status), res.status === 403);

  res = await httpJson("GET", "/production/product-definitions", proofToken, ctxA);
  record("user without production permissions denied on definitions (403)", "GET", "/production/product-definitions", "403", String(res.status), res.status === 403);

  res = await httpJson("GET", "/production/units", token, ctxA);
  record("super admin can list units", "GET", "/production/units", "200", String(res.status), res.status === 200);

  // ---------- Cleanup ----------
  res = await httpJson("DELETE", `/production/product-definitions/${definitionId}`, token, ctxA, {});
  record("soft delete definition", "DELETE", `/production/product-definitions/${definitionId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("DELETE", `/production/units/${unitId}`, token, ctxA, {});
  record("soft delete unit", "DELETE", `/production/units/${unitId}`, "200", String(res.status), res.status === 200);

  const auditUnits = await prisma.auditLog.count({ where: { entity: "ProductionUnit" } });
  const auditDefinitions = await prisma.auditLog.count({ where: { entity: "ProductionProductDefinition" } });
  const auditChildren = await prisma.auditLog.count({ where: { entity: { in: ["ProductionSpecification", "ProductionVersion", "ProductionPackaging", "ProductionEligibility"] } } });
  record("audit trail recorded for units", "DB", "auditLog", ">0", String(auditUnits), auditUnits > 0);
  record("audit trail recorded for definitions", "DB", "auditLog", ">0", String(auditDefinitions), auditDefinitions > 0);
  record("audit trail recorded for children", "DB", "auditLog", ">0", String(auditChildren), auditChildren > 0);

  if (specId) await prisma.auditLog.deleteMany({ where: { entityId: specId } });
  const leftoverUsers = await prisma.user.findMany({ where: { email: { startsWith: "prod-proof-" } }, select: { id: true } });
  if (leftoverUsers.length > 0) {
    await prisma.userRole.deleteMany({ where: { userId: { in: leftoverUsers.map((u) => u.id) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: leftoverUsers.map((u) => u.id) } } }).catch(() => undefined);
  }
  await prisma.userRole.deleteMany({ where: { userId: proofUser.id } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: proofUser.id } }).catch(() => undefined);
  await prisma.role.deleteMany({ where: { code: { startsWith: PROOF_ROLE_PREFIX } } }).catch(() => undefined);
  if (fallbackSuperAdminUserId) { await prisma.userRole.deleteMany({ where: { userId: fallbackSuperAdminUserId } }).catch(() => undefined); await prisma.user.delete({ where: { id: fallbackSuperAdminUserId } }).catch(() => undefined); }
  await prisma.company.delete({ where: { id: companyB.id } }).catch(() => undefined);
  await prisma.branch.deleteMany({ where: { companyId: companyB.id } }).catch(() => undefined);
  for (const id of fixtureIds) {
    if (id === companyB.id) continue;
    await prisma.productionLine.deleteMany({ where: { id } }).catch(() => undefined);
    await prisma.machine.deleteMany({ where: { id } }).catch(() => undefined);
  }

  const passed = results.filter((r) => r.pass).length;
  const skipped = results.filter((r) => !r.pass && r.expected === "SKIPPED").length;
  const failed = results.length - passed - skipped;

  console.log("\n=== Production Master Data Runtime Proof ===");
  for (const r of results) {
    console.log(`  [${r.pass ? "PASS" : r.expected === "SKIPPED" ? "SKIP" : "FAIL"}] ${r.name} (${r.method} ${r.endpoint} => ${r.actual}, expected ${r.expected})`);
  }
  console.log(`\nTotal: ${results.length}, Passed: ${passed}, Skipped: ${skipped}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error("Production master data proof failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
