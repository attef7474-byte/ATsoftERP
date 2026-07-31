import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import * as bcrypt from "bcryptjs";
import {
  PERMISSION_MIGRATIONS,
  syncPermissionKeys,
} from "../prisma/seed/permission-sync";
import { CMMS_EXTRA_PERMISSIONS } from "../prisma/seed/seed-cmms-permission-keys";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const API_URL = process.env.PROOF_API_URL || "http://localhost:4000/api/v1";
const SUPER_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@atsofterp.com";
const SUPER_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";
const PROOF_ROLE_CODE = "TMP_AUTH_PROOF_ROLE";
const PROOF_PASSWORD = "ProofPass@2026!";

const CANONICAL_KEYS = [
  "installed-parts:read",
  "maintenance-request:activity.view",
  "maintenance-request:attachments.view",
  "maintenance-request:print",
];

interface CaseResult {
  name: string;
  method: string;
  endpoint: string;
  expected: string;
  actual: string;
  pass: boolean;
  responseBody?: unknown;
}

const results: CaseResult[] = [];
let fixtures: {
  roleId: string;
  userId: string;
  email: string;
  createdObsoletePermissionIds: string[];
  fallbackSuperAdminUserId?: string;
} | null = null;

function record(name: string, method: string, endpoint: string, expected: string, actual: string, pass: boolean, responseBody?: unknown): void {
  const entry: CaseResult = { name, method, endpoint, expected, actual, pass };
  if (responseBody !== undefined) entry.responseBody = responseBody;
  results.push(entry);
}

async function httpJson(
  method: string,
  path: string,
  token: string | null,
  headers: Record<string, string> = {},
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let responseBody: unknown = null;
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
  const { status, body } = await httpJson("POST", "/auth/login", null, {}, {
    email,
    password,
  });
  if (status !== 201 && status !== 200) {
    throw new Error(
      `login failed for ${email}: HTTP ${status} ${JSON.stringify(body)}`,
    );
  }
  const token = (body as { accessToken?: string }).accessToken;
  if (!token) throw new Error(`login returned no accessToken for ${email}`);
  return token;
}

async function main(): Promise<void> {
  await waitForApi();

  const company = await prisma.company.findUniqueOrThrow({ where: { code: "DEFAULT" } });
  const branch = await prisma.branch.findFirstOrThrow({
    where: { companyId: company.id, code: "HQ" },
  });
  const contextHeaders = {
    "x-active-company-id": company.id,
    "x-active-branch-id": branch.id,
  };

  let superAdminToken: string;
  let fallbackSuperAdminUserId: string | undefined;
  try {
    superAdminToken = await login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
  } catch (error) {
    console.log(`SUPER_ADMIN default login unavailable (${(error as Error).message}); creating temporary SUPER_ADMIN user.`);
    const superRole = await prisma.role.findUniqueOrThrow({
      where: { code: "SUPER_ADMIN" },
    });
    const passwordHash = await bcrypt.hash(PROOF_PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `auth-proof-super-${Date.now()}@atsofterp.local`,
        passwordHash,
        name: "Auth Proof Super Admin (temporary)",
        companyId: company.id,
        branchId: branch.id,
        status: "ACTIVE",
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: superRole.id } });
    fallbackSuperAdminUserId = user.id;
    superAdminToken = await login(user.email, PROOF_PASSWORD);
  }

  const role = await prisma.role.create({
    data: {
      code: PROOF_ROLE_CODE,
      name: "Temporary Authorization Proof Role",
      description: "Created by auth-permission-proof.ts; removed after the proof run",
      isSystem: false,
      status: "ACTIVE",
    },
  });
  const passwordHash = await bcrypt.hash(PROOF_PASSWORD, 10);
  const proofUser = await prisma.user.create({
    data: {
      email: `auth-proof-${Date.now()}@atsofterp.local`,
      passwordHash,
      name: "Auth Proof User (temporary)",
      companyId: company.id,
      branchId: branch.id,
      status: "ACTIVE",
    },
  });
  await prisma.userRole.create({ data: { userId: proofUser.id, roleId: role.id } });

  const createdObsoletePermissionIds: string[] = [];
  for (const migration of PERMISSION_MIGRATIONS) {
    let obsolete = await prisma.permission.findUnique({
      where: { key: migration.oldKey },
    });
    if (!obsolete) {
      obsolete = await prisma.permission.create({
        data: {
          key: migration.oldKey,
          module: "maintenance-request",
          action: migration.oldKey.split(":")[1] ?? migration.oldKey,
          status: "ACTIVE",
        },
      });
      createdObsoletePermissionIds.push(obsolete.id);
    }
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: obsolete.id },
    });
  }

  fixtures = {
    roleId: role.id,
    userId: proofUser.id,
    email: proofUser.email,
    createdObsoletePermissionIds,
    fallbackSuperAdminUserId,
  };

  const proofToken = await login(proofUser.email, PROOF_PASSWORD);
  const nonexistentRequestId = "000000000000000000000000";

  let response = await httpJson("GET", "/installed-parts", superAdminToken, contextHeaders);
  record("SUPER_ADMIN can read installed parts", "GET", "/installed-parts", "200", String(response.status), response.status === 200);

  response = await httpJson("GET", "/installed-parts", proofToken, contextHeaders);
  record("user without permissions is denied", "GET", "/installed-parts", "403", String(response.status), response.status === 403, response.status === 403 ? response.body : undefined);

  response = await httpJson("GET", `/maintenance/requests/${nonexistentRequestId}/activity`, proofToken, contextHeaders);
  record("obsolete key grants nothing (activity)", "GET", `/maintenance/requests/${nonexistentRequestId}/activity`, "403", String(response.status), response.status === 403, response.status === 403 ? response.body : undefined);

  const unrelatedPermission = await prisma.permission.findUnique({
    where: { key: "numbering:generate" },
  });
  if (!unrelatedPermission) {
    throw new Error("numbering:generate permission missing; cannot run unrelated-permission case");
  }
  await prisma.rolePermission.create({
    data: { roleId: role.id, permissionId: unrelatedPermission.id },
  });

  response = await httpJson("GET", "/installed-parts", proofToken, contextHeaders);
  record("unrelated permission does not grant access", "GET", "/installed-parts", "403", String(response.status), response.status === 403);

  await prisma.rolePermission.deleteMany({
    where: { roleId: role.id, permissionId: unrelatedPermission.id },
  });

  console.log("Running syncPermissionKeys against the real database...");
  const syncResult = await syncPermissionKeys(prisma, CMMS_EXTRA_PERMISSIONS);

  const obsoleteStillPresent: string[] = [];
  for (const migration of PERMISSION_MIGRATIONS) {
    const leftover = await prisma.permission.findUnique({ where: { key: migration.oldKey } });
    if (leftover) obsoleteStillPresent.push(migration.oldKey);
  }
  record("obsolete keys are removed by the sync", "db", "permissions", "none", obsoleteStillPresent.length > 0 ? obsoleteStillPresent.join(",") : "none", obsoleteStillPresent.length === 0);

  const canonicalPresent: string[] = [];
  for (const key of CANONICAL_KEYS) {
    const permission = await prisma.permission.findUnique({ where: { key } });
    if (!permission) continue;
    const link = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    });
    if (link) canonicalPresent.push(key);
  }
  record(
    "migrated obsolete links were re-pointed to canonical keys",
    "db",
    "role_permissions",
    "3 keys linked (activity.view, attachments.view, print)",
    `${canonicalPresent.length} keys linked`,
    canonicalPresent.length === 3,
  );

  const installedPartsPermission = await prisma.permission.findUnique({
    where: { key: "installed-parts:read" },
  });
  if (!installedPartsPermission) {
    throw new Error("installed-parts:read missing after sync");
  }
  await prisma.rolePermission.create({
    data: { roleId: role.id, permissionId: installedPartsPermission.id },
  });

  response = await httpJson("GET", "/installed-parts", proofToken, contextHeaders);
  record("user with canonical key can read installed parts", "GET", "/installed-parts", "200", String(response.status), response.status === 200);

  const existingRequest = await prisma.maintenanceRequest.findFirst({
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  const requestId = existingRequest?.id ?? nonexistentRequestId;

  for (const endpoint of ["activity", "attachments", "print"]) {
    const path = `/maintenance/requests/${requestId}/${endpoint}`;
    response = await httpJson("GET", path, proofToken, contextHeaders);
    const pass = response.status === 200 || response.status === 404;
    record(`user with canonical key can open request ${endpoint}`, "GET", path, "200/404", String(response.status), pass);
  }

  for (const endpoint of ["activity", "attachments", "print"]) {
    const path = `/maintenance/requests/${requestId}/${endpoint}`;
    response = await httpJson("GET", path, superAdminToken, contextHeaders);
    const pass = response.status === 200 || response.status === 404;
    record(`SUPER_ADMIN can open request ${endpoint}`, "GET", path, "200/404", String(response.status), pass);
  }

  const secondSync = await syncPermissionKeys(prisma, CMMS_EXTRA_PERMISSIONS);
  record(
    "second sync run is a no-op (idempotency)",
    "db",
    "syncPermissionKeys",
    "added=0 migrated=0",
    `added=${secondSync.added} migrated=${secondSync.migrated}`,
    secondSync.added === 0 && secondSync.migrated === 0,
  );

  const failed = results.filter((entry) => !entry.pass);
  console.log(JSON.stringify({ syncResult, cases: results }, null, 2));
  if (failed.length > 0) {
    console.error(`AUTH PROOF FAILED: ${failed.length} case(s) did not pass.`);
    process.exitCode = 1;
  } else {
    console.log("AUTH PROOF PASSED: all authorization cases verified against the real database.");
  }
}

async function cleanup(): Promise<void> {
  if (!fixtures) return;
  const { roleId, userId, createdObsoletePermissionIds, fallbackSuperAdminUserId } = fixtures;
  try {
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    console.error("Cleanup failed for proof user:", (error as Error).message);
  }
  try {
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.role.delete({ where: { id: roleId } });
  } catch (error) {
    console.error("Cleanup failed for proof role:", (error as Error).message);
  }
  for (const permissionId of createdObsoletePermissionIds) {
    try {
      const stillExists = await prisma.permission.findUnique({ where: { id: permissionId } });
      if (stillExists) await prisma.permission.delete({ where: { id: permissionId } });
    } catch (error) {
      console.error(`Cleanup failed for simulated obsolete permission ${permissionId}:`, (error as Error).message);
    }
  }
  if (fallbackSuperAdminUserId) {
    try {
      await prisma.userRole.deleteMany({ where: { userId: fallbackSuperAdminUserId } });
      await prisma.user.delete({ where: { id: fallbackSuperAdminUserId } });
    } catch (error) {
      console.error("Cleanup failed for fallback SUPER_ADMIN user:", (error as Error).message);
    }
  }
  console.log("Fixture cleanup completed.");
}

main()
  .catch((error) => {
    console.error("AUTH PROOF FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
