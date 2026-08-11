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
const PROOF_ROLE_PREFIX = "TMP_SHIFTS_PROOF_ROLE";
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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
        email: `shifts-proof-super-${Date.now()}@atsofterp.local`,
        passwordHash,
        name: "Shifts Proof Super Admin (temporary)",
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

  const person = await prisma.operationalPerson.create({
    data: { code: `TMPPER-${Date.now()}`, name: "Proof Person A (temporary)", category: "MAINTENANCE", isActive: true },
  });
  fixtureIds.push(person.id);

  // ---------- Shifts ----------
  const shiftName = `Proof Shift ${Date.now()}`;
  let res = await httpJson("POST", "/production/shifts", token, ctxA, { name: shiftName, startTime: "06:00", endTime: "14:00", breakMinutes: 30 });
  record("create shift with auto code", "POST", "/production/shifts", "2xx+PS-", `${res.status} ${res.body?.code ?? ""}`, res.status >= 200 && res.status < 300 && typeof res.body?.code === "string" && res.body.code.startsWith("PS-"));
  const shiftId = res.body?.id ?? null;
  if (!shiftId) throw new Error("shift create returned no id");
  record("shift duration auto-computed", "POST", "/production/shifts", "480", String(res.body?.durationMinutes), res.body?.durationMinutes === 480);

  res = await httpJson("POST", "/production/shifts", token, ctxA, { name: "Bad Time", startTime: "25:00", endTime: "14:00" });
  record("invalid time format rejected", "POST", "/production/shifts", "400", String(res.status), res.status === 400);

  res = await httpJson("POST", "/production/shifts", token, ctxA, { name: "Bad Break", startTime: "06:00", endTime: "08:00", breakMinutes: 200 });
  record("break >= duration rejected", "POST", "/production/shifts", "400", String(res.status), res.status === 400);

  res = await httpJson("POST", "/production/shifts", token, ctxA, { name: "Dup", startTime: "06:00", endTime: "14:00", code: res.body && false ? res.body.code : undefined });
  res = await httpJson("GET", `/production/shifts/${shiftId}`, token, ctxA);
  record("read shift in own tenant", "GET", `/production/shifts/${shiftId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("PATCH", `/production/shifts/${shiftId}`, token, ctxA, { breakMinutes: 45 });
  record("update shift in own tenant", "PATCH", `/production/shifts/${shiftId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("GET", `/production/shifts/${shiftId}`, token, ctxB);
  record("shift not readable from another company (404)", "GET", `/production/shifts/${shiftId}`, "404", String(res.status), res.status === 404);

  res = await httpJson("PATCH", `/production/shifts/${shiftId}`, token, ctxB, { name: "Hijack" });
  record("shift not updatable from another company (404)", "PATCH", `/production/shifts/${shiftId}`, "404", String(res.status), res.status === 404);

  // ---------- Shift templates ----------
  res = await httpJson("POST", "/production/shift-templates", token, ctxA, { name: `Proof Template ${Date.now()}`, days: [{ dayOfWeek: 0, shiftId, isWorkDay: true }] });
  record("create template with auto code", "POST", "/production/shift-templates", "2xx+PST-", `${res.status} ${res.body?.code ?? ""}`, res.status >= 200 && res.status < 300 && typeof res.body?.code === "string" && res.body.code.startsWith("PST-"));
  const templateId = res.body?.id ?? null;
  if (!templateId) throw new Error("template create returned no id");

  res = await httpJson("POST", "/production/shift-templates", token, ctxA, { name: "Dup Day", days: [{ dayOfWeek: 1, shiftId }, { dayOfWeek: 1, shiftId }] });
  record("duplicate dayOfWeek rejected", "POST", "/production/shift-templates", "400", String(res.status), res.status === 400);

  res = await httpJson("POST", "/production/shift-templates", token, ctxA, { name: "No Days", days: [] });
  record("empty days rejected", "POST", "/production/shift-templates", "400", String(res.status), res.status === 400);

  res = await httpJson("POST", "/production/shift-templates", token, ctxB, { name: "Cross", days: [{ dayOfWeek: 0, shiftId }] });
  record("cross-company shift reference in template rejected", "POST", "/production/shift-templates", "400", String(res.status), res.status === 400);

  res = await httpJson("PATCH", `/production/shift-templates/${templateId}`, token, ctxA, { description: "Proof template" });
  record("update template in own tenant", "PATCH", `/production/shift-templates/${templateId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("GET", `/production/shift-templates/${templateId}`, token, ctxA);
  record("template includes days with shift", "GET", `/production/shift-templates/${templateId}`, "days+shift", `${res.status}`, res.status === 200 && Array.isArray(res.body?.days) && res.body.days.length === 1 && res.body.days[0].shift?.id === shiftId);

  // ---------- Shift calendars ----------
  res = await httpJson("POST", "/production/shift-calendars", token, ctxA, { name: `Proof Calendar ${Date.now()}`, templateId, effectiveFrom: isoDate(new Date()), effectiveTo: isoDate(new Date(Date.now() + 30 * 86400000)) });
  record("create calendar with auto code", "POST", "/production/shift-calendars", "2xx+PSC-", `${res.status} ${res.body?.code ?? ""}`, res.status >= 200 && res.status < 300 && typeof res.body?.code === "string" && res.body.code.startsWith("PSC-"));
  const calendarId = res.body?.id ?? null;
  if (!calendarId) throw new Error("calendar create returned no id");

  const entryDate = isoDate(new Date(Date.now() + 2 * 86400000));
  res = await httpJson("POST", `/production/shift-calendars/${calendarId}/entries`, token, ctxA, { date: entryDate, shiftId, isWorkDay: true });
  record("add date override entry", "POST", `/production/shift-calendars/${calendarId}/entries`, "2xx", String(res.status), res.status >= 200 && res.status < 300);

  res = await httpJson("POST", `/production/shift-calendars/${calendarId}/entries`, token, ctxA, { date: entryDate, shiftId });
  record("duplicate entry date rejected", "POST", `/production/shift-calendars/${calendarId}/entries`, "400", String(res.status), res.status === 400);

  res = await httpJson("GET", `/production/shift-calendars/${calendarId}/resolve?date=${entryDate}`, token, ctxA);
  record("resolve date via entry override", "GET", `/production/shift-calendars/${calendarId}/resolve`, "ENTRY", String(res.body?.source), res.status === 200 && res.body?.source === "ENTRY");

  res = await httpJson("GET", `/production/shift-calendars/${calendarId}/resolve?date=${isoDate(new Date())}`, token, ctxA);
  record("resolve date via template day", "GET", `/production/shift-calendars/${calendarId}/resolve`, "TEMPLATE", String(res.body?.source), res.status === 200 && res.body?.source === "TEMPLATE");

  res = await httpJson("GET", `/production/shift-calendars/${calendarId}/resolve?date=${isoDate(new Date(Date.now() + 200 * 86400000))}`, token, ctxA);
  record("resolve date outside effective range rejected", "GET", `/production/shift-calendars/${calendarId}/resolve`, "400", String(res.status), res.status === 400);

  res = await httpJson("PATCH", `/production/shift-calendars/${calendarId}`, token, ctxA, { description: "Proof calendar" });
  record("update calendar in own tenant", "PATCH", `/production/shift-calendars/${calendarId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("GET", `/production/shift-calendars/${calendarId}`, token, ctxB);
  record("calendar not readable from another company (404)", "GET", `/production/shift-calendars/${calendarId}`, "404", String(res.status), res.status === 404);

  // ---------- Shift assignments ----------
  res = await httpJson("POST", "/production/shift-assignments", token, ctxA, { shiftId, calendarId, operationalPersonId: person.id, effectiveFrom: isoDate(new Date()), effectiveTo: isoDate(new Date(Date.now() + 30 * 86400000)), isPrimary: true });
  record("create shift assignment with auto code", "POST", "/production/shift-assignments", "2xx+PSA-", `${res.status} ${res.body?.code ?? ""}`, res.status >= 200 && res.status < 300 && typeof res.body?.code === "string" && res.body.code.startsWith("PSA-"));
  const assignmentId = res.body?.id ?? null;
  if (!assignmentId) throw new Error("assignment create returned no id");

  res = await httpJson("POST", "/production/shift-assignments", token, ctxA, { shiftId, operationalPersonId: person.id, effectiveFrom: isoDate(new Date()), effectiveTo: isoDate(new Date(Date.now() + 10 * 86400000)) });
  record("overlapping shift assignment for same person rejected", "POST", "/production/shift-assignments", "400", String(res.status), res.status === 400);

  res = await httpJson("POST", "/production/shift-assignments", token, ctxB, { shiftId, operationalPersonId: person.id, effectiveFrom: isoDate(new Date()) });
  record("cross-company shift reference in assignment rejected", "POST", "/production/shift-assignments", "400", String(res.status), res.status === 400);

  res = await httpJson("GET", `/production/shift-assignments/current/${person.id}?on=${isoDate(new Date())}`, token, ctxA);
  record("current shift assignment resolved for person", "GET", `/production/shift-assignments/current/${person.id}`, "1+", `${res.status} count=${res.body?.count}`, res.status === 200 && res.body?.count >= 1 && res.body?.data?.[0]?.id === assignmentId);

  res = await httpJson("PATCH", `/production/shift-assignments/${assignmentId}`, token, ctxA, { notes: "Proof note" });
  record("update shift assignment in own tenant", "PATCH", `/production/shift-assignments/${assignmentId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("GET", `/production/shift-assignments/${assignmentId}`, token, ctxB);
  record("shift assignment not readable from another company (404)", "GET", `/production/shift-assignments/${assignmentId}`, "404", String(res.status), res.status === 404);

  res = await httpJson("PATCH", `/production/shift-assignments/${assignmentId}`, token, ctxB, { notes: "Hijack" });
  record("shift assignment not updatable from another company (404)", "PATCH", `/production/shift-assignments/${assignmentId}`, "404", String(res.status), res.status === 404);

  // ---------- Operational assignments ----------
  const machineA = await prisma.machine.create({
    data: { code: `TMPMAC-${Date.now()}`, name: "Proof Machine A (temporary)", companyId: company.id, branchId: branch.id, status: "ACTIVE" },
  });
  const machineB = await prisma.machine.create({
    data: { code: `TMPMAC-${Date.now()}`, name: "Proof Machine B (temporary)", companyId: companyB.id, branchId: branchB.id, status: "ACTIVE" },
  });
  fixtureIds.push(machineA.id, machineB.id);

  res = await httpJson("POST", "/production/operational-assignments", token, ctxA, { resourceType: "MACHINE", machineId: machineA.id, shiftId, capacityPerShift: 100, effectiveFrom: isoDate(new Date()) });
  record("create operational assignment with auto code", "POST", "/production/operational-assignments", "2xx+POA-", `${res.status} ${res.body?.code ?? ""}`, res.status >= 200 && res.status < 300 && typeof res.body?.code === "string" && res.body.code.startsWith("POA-"));
  const operationalId = res.body?.id ?? null;
  if (!operationalId) throw new Error("operational assignment create returned no id");

  res = await httpJson("POST", "/production/operational-assignments", token, ctxA, { resourceType: "MACHINE", machineId: machineA.id, effectiveFrom: isoDate(new Date()) });
  record("overlapping operational assignment for same machine rejected", "POST", "/production/operational-assignments", "400", String(res.status), res.status === 400);

  res = await httpJson("POST", "/production/operational-assignments", token, ctxA, { resourceType: "MACHINE", machineId: machineB.id, effectiveFrom: isoDate(new Date()) });
  record("cross-company machine operational assignment rejected", "POST", "/production/operational-assignments", "400", String(res.status), res.status === 400);

  res = await httpJson("POST", "/production/operational-assignments", token, ctxA, { resourceType: "LINE", machineId: machineA.id, effectiveFrom: isoDate(new Date()) });
  record("conflicting resource ids (LINE + machine) rejected", "POST", "/production/operational-assignments", "400", String(res.status), res.status === 400);

  res = await httpJson("POST", "/production/operational-assignments", token, ctxA, { resourceType: "MACHINE", machineId: machineA.id, productionLineId: "l-x", effectiveFrom: isoDate(new Date()) });
  record("conflicting resource ids (machine + line) rejected", "POST", "/production/operational-assignments", "400", String(res.status), res.status === 400);

  res = await httpJson("PATCH", `/production/operational-assignments/${operationalId}`, token, ctxA, { capacityPerShift: 150 });
  record("update operational assignment in own tenant", "PATCH", `/production/operational-assignments/${operationalId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("GET", `/production/operational-assignments/${operationalId}`, token, ctxB);
  record("operational assignment not readable from another company (404)", "GET", `/production/operational-assignments/${operationalId}`, "404", String(res.status), res.status === 404);

  // ---------- Operational people (read-only lookup) ----------
  res = await httpJson("GET", "/production/operational-people", token, ctxA);
  record("operational people list endpoint reachable", "GET", "/production/operational-people", "200", String(res.status), res.status === 200 && Array.isArray(res.body?.data));

  res = await httpJson("GET", `/production/operational-people/${person.id}`, token, ctxA);
  record("operational person readable by id", "GET", `/production/operational-people/${person.id}`, "200", String(res.status), res.status === 200 && res.body?.id === person.id);

  // ---------- Permission denial ----------
  const role = await prisma.role.create({
    data: { code: `${PROOF_ROLE_PREFIX}_${Date.now()}`, name: "Temporary Shifts Proof Role", description: "Removed after the proof run", isSystem: false, status: "ACTIVE" },
  });
  const proofPasswordHash = await bcrypt.hash(PROOF_PASSWORD, 10);
  const proofUser = await prisma.user.create({
    data: { email: `shifts-proof-${Date.now()}@atsofterp.local`, passwordHash: proofPasswordHash, name: "Shifts Proof User (temporary)", companyId: company.id, branchId: branch.id, status: "ACTIVE" },
  });
  await prisma.userRole.create({ data: { userId: proofUser.id, roleId: role.id } });
  const proofToken = await login(proofUser.email, PROOF_PASSWORD);

  res = await httpJson("GET", "/production/shifts", proofToken, ctxA);
  record("user without shift permissions denied (403)", "GET", "/production/shifts", "403", String(res.status), res.status === 403);

  res = await httpJson("GET", "/production/shift-calendars", proofToken, ctxA);
  record("user without calendar permissions denied (403)", "GET", "/production/shift-calendars", "403", String(res.status), res.status === 403);

  res = await httpJson("GET", "/production/shift-assignments", token, ctxA);
  record("super admin can list shift assignments", "GET", "/production/shift-assignments", "200", String(res.status), res.status === 200);

  // ---------- Status transitions ----------
  res = await httpJson("PATCH", `/production/shifts/${shiftId}/deactivate`, token, ctxA, {});
  record("deactivate shift", "PATCH", `/production/shifts/${shiftId}/deactivate`, "200", String(res.status), res.status === 200);

  res = await httpJson("PATCH", `/production/shifts/${shiftId}/activate`, token, ctxA, {});
  record("reactivate shift", "PATCH", `/production/shifts/${shiftId}/activate`, "200", String(res.status), res.status === 200);

  // ---------- Soft delete protection ----------
  res = await httpJson("DELETE", `/production/shifts/${shiftId}`, token, ctxA, {});
  record("delete shift referenced by template rejected (409)", "DELETE", `/production/shifts/${shiftId}`, "409", String(res.status), res.status === 409);

  res = await httpJson("DELETE", `/production/shift-templates/${templateId}`, token, ctxA, {});
  record("delete template referenced by calendar rejected (409)", "DELETE", `/production/shift-templates/${templateId}`, "409", String(res.status), res.status === 409);

  res = await httpJson("DELETE", `/production/shift-calendars/${calendarId}`, token, ctxA, {});
  record("delete calendar referenced by assignment rejected (409)", "DELETE", `/production/shift-calendars/${calendarId}`, "409", String(res.status), res.status === 409);

  // ---------- Cleanup ----------
  res = await httpJson("DELETE", `/production/shift-assignments/${assignmentId}`, token, ctxA, {});
  record("soft delete shift assignment", "DELETE", `/production/shift-assignments/${assignmentId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("DELETE", `/production/operational-assignments/${operationalId}`, token, ctxA, {});
  record("soft delete operational assignment", "DELETE", `/production/operational-assignments/${operationalId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("DELETE", `/production/shift-calendars/${calendarId}`, token, ctxA, {});
  record("soft delete calendar after assignment removal", "DELETE", `/production/shift-calendars/${calendarId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("DELETE", `/production/shift-templates/${templateId}`, token, ctxA, {});
  record("soft delete template after calendar removal", "DELETE", `/production/shift-templates/${templateId}`, "200", String(res.status), res.status === 200);

  res = await httpJson("DELETE", `/production/shifts/${shiftId}`, token, ctxA, {});
  record("soft delete shift after references removed", "DELETE", `/production/shifts/${shiftId}`, "200", String(res.status), res.status === 200);

  const auditShifts = await prisma.auditLog.count({ where: { entity: "ProductionShift" } });
  const auditTemplates = await prisma.auditLog.count({ where: { entity: "ProductionShiftTemplate" } });
  const auditCalendars = await prisma.auditLog.count({ where: { entity: { in: ["ProductionShiftCalendar", "ProductionShiftCalendarEntry"] } } });
  const auditAssignments = await prisma.auditLog.count({ where: { entity: { in: ["ProductionShiftAssignment", "ProductionOperationalAssignment"] } } });
  record("audit trail recorded for shifts", "DB", "auditLog", ">0", String(auditShifts), auditShifts > 0);
  record("audit trail recorded for templates", "DB", "auditLog", ">0", String(auditTemplates), auditTemplates > 0);
  record("audit trail recorded for calendars/entries", "DB", "auditLog", ">0", String(auditCalendars), auditCalendars > 0);
  record("audit trail recorded for assignments", "DB", "auditLog", ">0", String(auditAssignments), auditAssignments > 0);

  const leftoverUsers = await prisma.user.findMany({ where: { email: { startsWith: "shifts-proof-" } }, select: { id: true } });
  if (leftoverUsers.length > 0) {
    await prisma.userRole.deleteMany({ where: { userId: { in: leftoverUsers.map((u) => u.id) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: leftoverUsers.map((u) => u.id) } } }).catch(() => undefined);
  }
  await prisma.userRole.deleteMany({ where: { userId: proofUser.id } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: proofUser.id } }).catch(() => undefined);
  await prisma.role.deleteMany({ where: { code: { startsWith: PROOF_ROLE_PREFIX } } }).catch(() => undefined);
  if (fallbackSuperAdminUserId) { await prisma.userRole.deleteMany({ where: { userId: fallbackSuperAdminUserId } }).catch(() => undefined); await prisma.user.delete({ where: { id: fallbackSuperAdminUserId } }).catch(() => undefined); }
  await prisma.operationalPerson.deleteMany({ where: { id: person.id } }).catch(() => undefined);
  await prisma.branch.deleteMany({ where: { companyId: companyB.id } }).catch(() => undefined);
  await prisma.company.delete({ where: { id: companyB.id } }).catch(() => undefined);
  for (const id of fixtureIds) {
    if (id === companyB.id || id === person.id) continue;
    await prisma.machine.deleteMany({ where: { id } }).catch(() => undefined);
  }

  const passed = results.filter((r) => r.pass).length;
  const skipped = results.filter((r) => !r.pass && r.expected === "SKIPPED").length;
  const failed = results.length - passed - skipped;

  console.log("\n=== Production Shifts & Assignments Runtime Proof ===");
  for (const r of results) {
    console.log(`  [${r.pass ? "PASS" : r.expected === "SKIPPED" ? "SKIP" : "FAIL"}] ${r.name} (${r.method} ${r.endpoint} => ${r.actual}, expected ${r.expected})`);
  }
  console.log(`\nTotal: ${results.length}, Passed: ${passed}, Skipped: ${skipped}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error("Production shifts proof failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());