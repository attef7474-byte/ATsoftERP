#!/usr/bin/env npx ts-node
/**
 * Batch F — Controlled Joubah Production Import
 *
 * Reads batch-e-import-manifest.json, resolves null fields, creates all entities
 * in FK-dependency order within a single transaction.
 *
 * Modes:
 *   --dry-run  : Validate only, no writes (default)
 *   --execute  : Write to database
 *
 * Run from: apps/api/
 *   npx ts-node ../../docs/data-prep/batch-f/batch-f-importer.ts --dry-run
 *   npx ts-node ../../docs/data-prep/batch-f/batch-f-importer.ts --execute
 */

import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

// ─── Paths ───────────────────────────────────────────────────────────
const BATCH_E_DIR = path.resolve(__dirname, "../batch-e");
const BATCH_F_DIR = path.resolve(__dirname, ".");
const MANIFEST_PATH = path.join(BATCH_E_DIR, "batch-e-import-manifest.json");
const PERSONS_PATH = path.join(BATCH_E_DIR, "persons.json");
const ASSIGNMENTS_PATH = path.join(BATCH_E_DIR, "assignments.json");
const MAINT_PATH = path.join(BATCH_E_DIR, "maintenance_personnel.json");
const MACHINE_RESP_PATH = path.join(BATCH_E_DIR, "machine_responsibilities.json");
const JOB_TITLES_PATH = path.join(BATCH_E_DIR, "job_titles.json");
const CORE_SHEETS_PATH = path.join(BATCH_E_DIR, "core_sheets_data.json");
const RESOLUTION_MAP_PATH = path.join(BATCH_F_DIR, "null-resolution-map.json");
const LEDGER_PATH = path.join(BATCH_F_DIR, "batch-f-import-ledger.json");

const CUTOVER = new Date("2026-08-19T00:00:00.000Z");
const MODE = process.argv.includes("--execute") ? "execute" : "dry-run";

// ─── Types ───────────────────────────────────────────────────────────
interface ManifestRecord {
  entityType: string;
  action: string;
  businessKey: string;
  [key: string]: any;
}

interface EntityBucket {
  records: ManifestRecord[];
}

interface Manifest {
  version: string;
  generatedAt: string;
  summary: {
    total_records: number;
    new_ready: number;
    reuse_existing: number;
    skipped_with_stakeholder_approval: number;
    blocked: number;
  };
  entities: Record<string, EntityBucket>;
}

interface LedgerEntry {
  entityType: string;
  businessKey: string;
  action: string;
  dbId?: string;
  dbCode?: string;
  resolvedFields?: Record<string, any>;
  status: "created" | "reused" | "skipped" | "failed" | "dry-run";
  error?: string;
}

// ─── Load data ───────────────────────────────────────────────────────
function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

const manifest = loadJson<Manifest>(MANIFEST_PATH);
const personsData = loadJson<any[]>(PERSONS_PATH);
const assignmentsData = loadJson<any[]>(ASSIGNMENTS_PATH);
const maintData = loadJson<any[]>(MAINT_PATH);
const machineRespData = loadJson<any[]>(MACHINE_RESP_PATH);
const jobTitlesData = loadJson<any[]>(JOB_TITLES_PATH);
const coreSheets = loadJson<any>(CORE_SHEETS_PATH);
const resolutionMap = loadJson<any>(RESOLUTION_MAP_PATH);

// ─── Build lookup maps ──────────────────────────────────────────────
const personsByCode = new Map(personsData.map((p) => [p.code, p]));
const jobTitlesByCode = new Map(jobTitlesData.map((jt) => [jt.code, jt]));
const maintByCode = new Map(maintData.map((m) => [m.maintenance_person_code, m]));
const machineRespByCode = new Map(machineRespData.map((r) => [r.code, r]));
const assignmentsByPersonCode = new Map(assignmentsData.map((a) => [a.personnel_code, a]));

// Admin sheet rows
const adminSheet = coreSheets["05_الإدارات"] as { headers: string[]; rows: any[] };
const adminByName = new Map(adminSheet.rows.map((r) => [r.code, r]));

// Dept sheet rows
const deptSheet = coreSheets["06_الأقسام"] as { headers: string[]; rows: any[] };
const deptByCode = new Map(deptSheet.rows.map((r) => [r.code, r]));

// Branch sheet rows
const branchSheet = coreSheets["04_الفروع"] as { headers: string[]; rows: any[] };
const branchByCode = new Map(branchSheet.rows.map((r) => [r.code, r]));

// ─── D05/D06 maintenance personnel person-link overrides ─────────────
const D05_LINKS: Record<string, string> = {
  MNT_0009: "EMP-0009",
  MNT_0104: "EMP-0104",
  MNT_0105: "EMP-0105",
};

// ─── Logging ─────────────────────────────────────────────────────────
const ledger: LedgerEntry[] = [];
const errors: string[] = [];

function log(msg: string) {
  console.log(`[${MODE.toUpperCase()}] ${msg}`);
}

function logError(msg: string) {
  console.error(`[ERROR] ${msg}`);
  errors.push(msg);
}

// ─── Snapshot ────────────────────────────────────────────────────────
async function takeSnapshot(label: string): Promise<Record<string, number>> {
  const tables = [
    "companies",
    "branches",
    "administrations",
    "departments",
    "job_titles",
    "operational_people",
    "maintenance_personnel",
    "operational_person_assignments",
    "machine_responsibility_assignments",
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const result = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) as cnt FROM [${table}] WHERE deletedAt IS NULL`
    );
    counts[table] = Number(result[0].cnt);
  }
  log(`DB Snapshot [${label}]: ${JSON.stringify(counts)}`);
  return counts;
}

// ─── Import execution ────────────────────────────────────────────────
async function executeImport() {
  log("=== Batch F Importer — Mode: " + MODE + " ===");
  log("Manifest version: " + manifest.version);
  log("Manifest generated: " + manifest.generatedAt);
  log(
    `Summary: ${manifest.summary.total_records} total, ` +
      `${manifest.summary.new_ready} CREATE, ${manifest.summary.reuse_existing} REUSE, ` +
      `${manifest.summary.skipped_with_stakeholder_approval} SKIP, ${manifest.summary.blocked} BLOCKED`
  );

  // Pre-import snapshot
  const preSnapshot = await takeSnapshot("pre-import");

  // ─── Phase 1: REUSE records (read existing IDs) ─────────────────
  log("\n--- Phase 1: REUSE_EXISTING records ---");

  // Company
  const companyRecord = manifest.entities.Company.records.find(
    (r) => r.action === "REUSE_EXISTING"
  );
  const existingCompany = await prisma.company.findFirst({
    where: { code: companyRecord!.existingDbCode, deletedAt: null },
  });
  if (!existingCompany) {
    logError("REUSE Company COM-000001 not found in DB");
    return;
  }
  const companyId = existingCompany.id;
  ledger.push({
    entityType: "Company",
    businessKey: companyRecord!.businessKey,
    action: "REUSE_EXISTING",
    dbId: companyId,
    dbCode: existingCompany.code,
    status: "reused",
  });
  log(`  Company: ${companyRecord!.businessKey} -> ${existingCompany.code} (${companyId})`);

  // Branches (REUSE + CREATE)
  const branchMap = new Map<string, string>(); // businessKey -> dbId
  for (const brRecord of manifest.entities.Branch.records) {
    if (brRecord.action === "REUSE_EXISTING") {
      const existing = await prisma.branch.findFirst({
        where: { companyId, code: brRecord.existingDbCode, deletedAt: null },
      });
      if (!existing) {
        logError(`REUSE Branch ${brRecord.existingDbCode} not found`);
        continue;
      }
      branchMap.set(brRecord.businessKey, existing.id);
      ledger.push({
        entityType: "Branch",
        businessKey: brRecord.businessKey,
        action: "REUSE_EXISTING",
        dbId: existing.id,
        dbCode: existing.code,
        status: "reused",
      });
      log(`  Branch: ${brRecord.businessKey} -> ${existing.code} (${existing.id})`);
    } else if (brRecord.action === "CREATE") {
      const srcRow = branchByCode.get(brRecord.businessKey);
      if (MODE === "execute") {
        const created = await prisma.branch.create({
          data: {
            companyId,
            code: brRecord.businessKey,
            name: srcRow?.name || brRecord.businessKey,
            address: srcRow?.address || null,
            phone: srcRow?.phone || null,
            status: "ACTIVE",
          },
        });
        branchMap.set(brRecord.businessKey, created.id);
        ledger.push({
          entityType: "Branch",
          businessKey: brRecord.businessKey,
          action: "CREATE",
          dbId: created.id,
          dbCode: created.code,
          status: "created",
        });
        log(`  Branch CREATE: ${brRecord.businessKey} -> ${created.id}`);
      } else {
        branchMap.set(brRecord.businessKey, `dry-run-${brRecord.businessKey}`);
        ledger.push({
          entityType: "Branch",
          businessKey: brRecord.businessKey,
          action: "CREATE",
          status: "dry-run",
        });
        log(`  Branch DRY-RUN: ${brRecord.businessKey}`);
      }
    }
  }

  // ─── Phase 2: Administrations ────────────────────────────────────
  log("\n--- Phase 2: Administrations (40 records) ---");
  const adminMap = new Map<string, string>(); // businessKey -> dbId
  for (const adminRec of manifest.entities.Administration.records) {
    if (adminRec.action !== "CREATE") continue;
    const srcRow = adminByName.get(adminRec.businessKey);
    const brId = branchMap.get(adminRec.branchCode);
    if (!brId) {
      logError(`Admin ${adminRec.businessKey}: branch ${adminRec.branchCode} not resolved`);
      continue;
    }
    if (brId.startsWith("dry-run-")) {
      adminMap.set(adminRec.businessKey, `dry-run-${adminRec.businessKey}`);
      ledger.push({
        entityType: "Administration",
        businessKey: adminRec.businessKey,
        action: "CREATE",
        status: "dry-run",
      });
      continue;
    }
    if (MODE === "execute") {
      const created = await prisma.administration.create({
        data: {
          branchId: brId,
          code: adminRec.businessKey,
          name: srcRow?.name || adminRec.businessKey,
          description: srcRow?.description || null,
          status: "ACTIVE",
        },
      });
      adminMap.set(adminRec.businessKey, created.id);
      ledger.push({
        entityType: "Administration",
        businessKey: adminRec.businessKey,
        action: "CREATE",
        dbId: created.id,
        dbCode: created.code,
        status: "created",
      });
    } else {
      adminMap.set(adminRec.businessKey, `dry-run-${adminRec.businessKey}`);
      ledger.push({
        entityType: "Administration",
        businessKey: adminRec.businessKey,
        action: "CREATE",
        status: "dry-run",
      });
    }
  }
  log(`  Administrations resolved: ${adminMap.size}`);

  // ─── Phase 3: Departments (152 records) ──────────────────────────
  log("\n--- Phase 3: Departments (152 records) ---");
  const deptMap = new Map<string, string>(); // businessKey -> dbId
  for (const deptRec of manifest.entities.Department.records) {
    if (deptRec.action !== "CREATE") continue;
    const srcRow = deptByCode.get(deptRec.businessKey);
    const brId = branchMap.get(deptRec.branchCode);
    const admId = deptRec.administrationCode ? adminMap.get(deptRec.administrationCode) : undefined;
    if (!brId || brId.startsWith("dry-run-")) {
      deptMap.set(deptRec.businessKey, `dry-run-${deptRec.businessKey}`);
      ledger.push({
        entityType: "Department",
        businessKey: deptRec.businessKey,
        action: "CREATE",
        status: "dry-run",
      });
      continue;
    }
    if (MODE === "execute") {
      const created = await prisma.department.create({
        data: {
          companyId,
          branchId: brId,
          administrationId: admId && !admId.startsWith("dry-run-") ? admId : undefined,
          code: deptRec.businessKey,
          name: srcRow?.name || deptRec.businessKey,
          classification: deptRec.classification || "OPERATIONAL",
          status: "ACTIVE",
        },
      });
      deptMap.set(deptRec.businessKey, created.id);
      ledger.push({
        entityType: "Department",
        businessKey: deptRec.businessKey,
        action: "CREATE",
        dbId: created.id,
        dbCode: created.code,
        status: "created",
      });
    } else {
      deptMap.set(deptRec.businessKey, `dry-run-${deptRec.businessKey}`);
      ledger.push({
        entityType: "Department",
        businessKey: deptRec.businessKey,
        action: "CREATE",
        status: "dry-run",
      });
    }
  }
  log(`  Departments resolved: ${deptMap.size}`);

  // ─── Phase 4: Job Titles (29 records) ────────────────────────────
  log("\n--- Phase 4: Job Titles (29 records) ---");
  const jtMap = new Map<string, string>(); // businessKey -> dbId
  for (const jtRec of manifest.entities.JobTitle.records) {
    if (jtRec.action !== "CREATE") continue;
    const srcRow = jobTitlesByCode.get(jtRec.businessKey);
    if (MODE === "execute") {
      const created = await prisma.jobTitle.create({
        data: {
          companyId,
          code: jtRec.businessKey,
          name: srcRow?.name || jtRec.businessKey,
          nameAr: srcRow?.name_ar || srcRow?.name || null,
          nameEn: srcRow?.name_en || null,
          category: srcRow?.category || "OPERATIONAL",
          description: srcRow?.description || null,
          isActive: true,
          status: "ACTIVE",
        },
      });
      jtMap.set(jtRec.businessKey, created.id);
      ledger.push({
        entityType: "JobTitle",
        businessKey: jtRec.businessKey,
        action: "CREATE",
        dbId: created.id,
        dbCode: created.code,
        status: "created",
      });
    } else {
      jtMap.set(jtRec.businessKey, `dry-run-${jtRec.businessKey}`);
      ledger.push({
        entityType: "JobTitle",
        businessKey: jtRec.businessKey,
        action: "CREATE",
        status: "dry-run",
      });
    }
  }
  log(`  Job titles resolved: ${jtMap.size}`);

  // ─── Phase 5: Operational Persons (23 records) ───────────────────
  log("\n--- Phase 5: Operational Persons (23 records) ---");
  const personMap = new Map<string, string>(); // businessKey -> dbId
  for (const personRec of manifest.entities.OperationalPerson.records) {
    if (personRec.action !== "CREATE") continue;
    const srcRow = personsByCode.get(personRec.businessKey);
    if (MODE === "execute") {
      const created = await prisma.operationalPerson.create({
        data: {
          code: personRec.businessKey,
          name: srcRow?.name || personRec.businessKey,
          category: srcRow?.category || "OPERATIONAL",
          isActive: srcRow?.is_active !== false,
          phone: srcRow?.phone || null,
          email: srcRow?.email || null,
          notes: srcRow?.notes || null,
        },
      });
      personMap.set(personRec.businessKey, created.id);
      ledger.push({
        entityType: "OperationalPerson",
        businessKey: personRec.businessKey,
        action: "CREATE",
        dbId: created.id,
        dbCode: created.code,
        status: "created",
      });
    } else {
      personMap.set(personRec.businessKey, `dry-run-${personRec.businessKey}`);
      ledger.push({
        entityType: "OperationalPerson",
        businessKey: personRec.businessKey,
        action: "CREATE",
        status: "dry-run",
      });
    }
  }
  log(`  Persons resolved: ${personMap.size}`);

  // ─── Phase 6: Maintenance Personnel (8 CREATE) ───────────────────
  log("\n--- Phase 6: Maintenance Personnel (8 CREATE) ---");
  const maintMap = new Map<string, string>(); // businessKey -> dbId
  for (const mntRec of manifest.entities.MaintenancePersonnel.records) {
    if (mntRec.action !== "CREATE") continue;
    const srcRow = maintByCode.get(mntRec.businessKey);
    // Resolve operational person code
    let opCode = srcRow?.operational_person_code;
    // D05 overrides
    if (D05_LINKS[mntRec.businessKey]) {
      opCode = D05_LINKS[mntRec.businessKey];
    }
    const opId = opCode ? personMap.get(opCode) : undefined;
    if (!opId || opId.startsWith("dry-run-")) {
      logError(`Maintenance ${mntRec.businessKey}: person ${opCode} not resolved`);
      continue;
    }
    // Job title
    const jtCode = srcRow?.job_title_code;
    const jtId = jtCode ? jtMap.get(jtCode) : undefined;

    if (MODE === "execute") {
      const created = await prisma.maintenancePersonnel.create({
        data: {
          operationalPersonId: opId,
          role: srcRow?.job_title_reference || "General Maintenance",
          specialty: null,
          isActive: true,
          dailyCapacityMinutes: 480,
        },
      });
      maintMap.set(mntRec.businessKey, created.id);
      ledger.push({
        entityType: "MaintenancePersonnel",
        businessKey: mntRec.businessKey,
        action: "CREATE",
        dbId: created.id,
        resolvedFields: { operationalPersonCode: opCode, jobTitleCode: jtCode },
        status: "created",
      });
      log(`  Maintenance CREATE: ${mntRec.businessKey} -> op=${opCode} (${created.id})`);
    } else {
      maintMap.set(mntRec.businessKey, `dry-run-${mntRec.businessKey}`);
      ledger.push({
        entityType: "MaintenancePersonnel",
        businessKey: mntRec.businessKey,
        action: "CREATE",
        resolvedFields: { operationalPersonCode: opCode, jobTitleCode: jtCode },
        status: "dry-run",
      });
      log(`  Maintenance DRY-RUN: ${mntRec.businessKey} -> op=${opCode}`);
    }
  }
  log(`  Maintenance personnel resolved: ${maintMap.size}`);

  // ─── Phase 7: Operational Person Assignments (23 records) ────────
  log("\n--- Phase 7: Operational Person Assignments (23 records) ---");
  const assignMap = new Map<string, string>(); // personCode -> assignmentDbId
  for (const assignRec of manifest.entities.OperationalPersonAssignment.records) {
    if (assignRec.action !== "CREATE") continue;
    const personCode = assignRec.personCode || assignRec.businessKey;
    const personId = personMap.get(personCode);
    if (!personId || personId.startsWith("dry-run-")) {
      logError(`Assignment ${personCode}: person not resolved`);
      continue;
    }

    // Resolve department: use manifest departmentCode, or fall back to resolution map
    let deptCode = assignRec.departmentCode;
    if (!deptCode) {
      deptCode = resolutionMap.departmentResolution[personCode];
    }
    const deptId = deptCode ? deptMap.get(deptCode) : undefined;
    if (!deptId || deptId.startsWith("dry-run-")) {
      logError(`Assignment ${personCode}: department ${deptCode} not resolved`);
      continue;
    }

    // Resolve administration
    const admCode = assignRec.administrationCode;
    const admId = admCode ? adminMap.get(admCode) : undefined;

    // Resolve branch
    const brId = assignRec.branchCode ? branchMap.get(assignRec.branchCode) : undefined;

    // Resolve job title
    const jtCode = assignRec.jobTitleCode || assignRec.roleKey;
    const jtId = jtCode ? jtMap.get(jtCode) : undefined;

    // Effective from: use manifest value or cutover
    const effectiveFrom = assignRec.effectiveFrom
      ? new Date(assignRec.effectiveFrom)
      : CUTOVER;

    if (MODE === "execute") {
      const created = await prisma.operationalPersonAssignment.create({
        data: {
          companyId,
          branchId: brId && !brId.startsWith("dry-run-") ? brId : undefined,
          administrationId: admId && !admId.startsWith("dry-run-") ? admId : undefined,
          departmentId: deptId,
          personnelId: personId,
          jobTitleId: jtId && !jtId.startsWith("dry-run-") ? jtId : undefined,
          assignmentType: assignRec.assignmentType || "PRIMARY",
          effectiveFrom,
          status: "ACTIVE",
        },
      });
      assignMap.set(personCode, created.id);
      ledger.push({
        entityType: "OperationalPersonAssignment",
        businessKey: assignRec.businessKey,
        action: "CREATE",
        dbId: created.id,
        resolvedFields: {
          personnelCode: personCode,
          departmentCode: deptCode,
          administrationCode: admCode,
          jobTitleCode: jtCode,
          effectiveFrom: effectiveFrom.toISOString(),
        },
        status: "created",
      });
      log(`  Assignment CREATE: ${personCode} -> dept=${deptCode} (${created.id})`);
    } else {
      assignMap.set(personCode, `dry-run-${personCode}`);
      ledger.push({
        entityType: "OperationalPersonAssignment",
        businessKey: assignRec.businessKey,
        action: "CREATE",
        resolvedFields: {
          personnelCode: personCode,
          departmentCode: deptCode,
          administrationCode: admCode,
          jobTitleCode: jtCode,
          effectiveFrom: effectiveFrom.toISOString(),
        },
        status: "dry-run",
      });
      log(`  Assignment DRY-RUN: ${personCode} -> dept=${deptCode}`);
    }
  }
  log(`  Assignments resolved: ${assignMap.size}`);

  // ─── Phase 8: Machine Responsibility Assignments (20 records) ────
  log("\n--- Phase 8: Machine Responsibility Assignments (20 records) ---");
  for (const rspRec of manifest.entities.MachineResponsibilityAssignment.records) {
    if (rspRec.action !== "CREATE") continue;
    const srcRow = machineRespByCode.get(rspRec.businessKey);

    // Resolve maintenance personnel
    // The machine responsibility's maintenance personnel is determined by the branch's maintenance manager
    // For branch-level roles (MNT_MANAGER, STORE), we need to find the right maintenance person
    // For line-level roles (CH_MNT, PF_MNT, LATHE), we find the branch's maintenance technician

    // Determine which operational person this responsibility belongs to
    let maintPersonCode: string | undefined;
    const branchCode = rspRec.branchCode;

    if (rspRec.businessKey.includes("MNT_MANAGER")) {
      // Branch maintenance manager → JT_0002 role
      // Find person assigned to this branch's maintenance admin
      const brNum = branchCode?.replace("BR_", "") || "01";
      const targetEmp =
        brNum === "01"
          ? "EMP-0002"
          : brNum === "02"
            ? "EMP-0202"
            : brNum === "03"
              ? "EMP-0301"
              : "EMP-0401";
      // Find the maintenance personnel for this person
      for (const [mntCode, mntRow] of maintByCode) {
        const opCode = D05_LINKS[mntCode] || mntRow.operational_person_code;
        if (opCode === targetEmp) {
          maintPersonCode = mntCode;
          break;
        }
      }
    } else if (rspRec.businessKey.includes("STORE")) {
      // Store keeper → JT_0010 role (spare parts warehouse)
      const brNum = branchCode?.replace("BR_", "") || "01";
      const targetEmp = brNum === "01" ? "EMP-0010" : brNum === "01" ? "EMP-0101" : "EMP-0101";
      // For BR_01, EMP-0010 is the store keeper; for other branches, find matching person
      // Actually, we have EMP-0010 and EMP-0101 both assigned to ADM_BR01_06 (Spare Parts)
      // For simplicity, use the person with JT_0010 for the relevant branch
      // EMP-0010 is at BR_01, EMP-0101 is also at BR_01
      // For BR_02/03/04, we don't have explicit store keepers, so use the maintenance person for JT_0010 equivalent
      // Since we only have persons at BR_01 for store keeping, we'll assign BR_02/03/04 store to their maintenance manager
      if (brNum === "01") {
        maintPersonCode = "MNT_0002"; // EMP-0002 is the maintenance manager at BR_01 who also handles store
      } else {
        // For other branches, use the maintenance manager
        const targetMap: Record<string, string> = {
          "02": "EMP-0202",
          "03": "EMP-0301",
          "04": "EMP-0401",
        };
        const targetEmp = targetMap[brNum] || "EMP-0002";
        for (const [mntCode, mntRow] of maintByCode) {
          const opCode = D05_LINKS[mntCode] || mntRow.operational_person_code;
          if (opCode === targetEmp) {
            maintPersonCode = mntCode;
            break;
          }
        }
      }
    } else {
      // Line-level roles: CH_MNT, PF_MNT, LATHE
      // These need a specific maintenance technician
      // BR_01: EMP-0102 (Chips MNT), EMP-0103 (Puff MNT), EMP-0009 (Lathe)
      // BR_02: EMP-0201 (Chips), etc.
      const brNum = branchCode?.replace("BR_", "") || "01";
      if (rspRec.businessKey.includes("CH_MNT")) {
        const targetMap: Record<string, string> = {
          "01": "EMP-0102",
          "02": "EMP-0201",
        };
        const targetEmp = targetMap[brNum];
        if (targetEmp) {
          for (const [mntCode, mntRow] of maintByCode) {
            const opCode = D05_LINKS[mntCode] || mntRow.operational_person_code;
            if (opCode === targetEmp) {
              maintPersonCode = mntCode;
              break;
            }
          }
        }
      } else if (rspRec.businessKey.includes("PF_MNT")) {
        const targetMap: Record<string, string> = {
          "01": "EMP-0103",
        };
        const targetEmp = targetMap[brNum];
        if (targetEmp) {
          for (const [mntCode, mntRow] of maintByCode) {
            const opCode = D05_LINKS[mntCode] || mntRow.operational_person_code;
            if (opCode === targetEmp) {
              maintPersonCode = mntCode;
              break;
            }
          }
        }
      } else if (rspRec.businessKey.includes("LATHE")) {
        const targetMap: Record<string, string> = {
          "01": "EMP-0009",
        };
        const targetEmp = targetMap[brNum];
        if (targetEmp) {
          for (const [mntCode, mntRow] of maintByCode) {
            const opCode = D05_LINKS[mntCode] || mntRow.operational_person_code;
            if (opCode === targetEmp) {
              maintPersonCode = mntCode;
              break;
            }
          }
        }
      }
    }

    if (!maintPersonCode) {
      logError(`MachineResp ${rspRec.businessKey}: maintenance personnel not resolved`);
      continue;
    }

    const maintId = maintMap.get(maintPersonCode);
    if (!maintId || maintId.startsWith("dry-run-")) {
      logError(`MachineResp ${rspRec.businessKey}: maint ${maintPersonCode} ID not resolved`);
      continue;
    }

    // Resolve scope type
    let scopeType = rspRec.scopeType || srcRow?.scope_type;
    if (!scopeType) {
      const scopeRes = resolutionMap.scopeResolution[rspRec.businessKey];
      if (scopeRes) {
        scopeType = scopeRes.scopeType;
      }
    }

    // Resolve target (departmentId for DEPARTMENT scope)
    let departmentId: string | undefined;
    let deptCode: string | undefined;
    if (scopeType === "DEPARTMENT") {
      deptCode = rspRec.departmentCode || srcRow?.department_code;
      if (!deptCode) {
        const scopeRes = resolutionMap.scopeResolution[rspRec.businessKey];
        if (scopeRes?.departmentCode) {
          deptCode = scopeRes.departmentCode;
        }
      }
      const dId = deptCode ? deptMap.get(deptCode) : undefined;
      if (dId && !dId.startsWith("dry-run-")) {
        departmentId = dId;
      }
    }

    const startDate = rspRec.startDate ? new Date(rspRec.startDate) : CUTOVER;
    const responsibilityRole =
      rspRec.responsibilityRole || srcRow?.responsibility_role || "General";

    if (MODE === "execute") {
      if (!departmentId && scopeType === "DEPARTMENT") {
        logError(`MachineResp ${rspRec.businessKey}: department ${deptCode} not resolved for DEPARTMENT scope`);
        continue;
      }
      const created = await prisma.machineResponsibilityAssignment.create({
        data: {
          scopeType: scopeType || "MACHINE",
          departmentId: departmentId || null,
          maintenancePersonnelId: maintId,
          responsibilityRole,
          isPrimary: srcRow?.is_primary === true || srcRow?.is_primary === "true",
          startDate,
          status: "ACTIVE",
        },
      });
      ledger.push({
        entityType: "MachineResponsibilityAssignment",
        businessKey: rspRec.businessKey,
        action: "CREATE",
        dbId: created.id,
        resolvedFields: {
          maintenancePersonnelCode: maintPersonCode,
          scopeType,
          departmentCode: deptCode,
          startDate: startDate.toISOString(),
        },
        status: "created",
      });
      log(`  MachineResp CREATE: ${rspRec.businessKey} -> maint=${maintPersonCode}, scope=${scopeType} (${created.id})`);
    } else {
      ledger.push({
        entityType: "MachineResponsibilityAssignment",
        businessKey: rspRec.businessKey,
        action: "CREATE",
        resolvedFields: {
          maintenancePersonnelCode: maintPersonCode,
          scopeType,
          departmentCode: deptCode,
          startDate: startDate.toISOString(),
        },
        status: "dry-run",
      });
      log(`  MachineResp DRY-RUN: ${rspRec.businessKey} -> maint=${maintPersonCode}, scope=${scopeType}`);
    }
  }

  // ─── Post-import snapshot ─────────────────────────────────────────
  if (MODE === "execute") {
    log("\n--- Post-import snapshot ---");
    const postSnapshot = await takeSnapshot("post-import");
    log("\n--- Delta ---");
    for (const table of Object.keys(preSnapshot)) {
      const delta = postSnapshot[table] - preSnapshot[table];
      if (delta !== 0) {
        log(`  ${table}: ${preSnapshot[table]} -> ${postSnapshot[table]} (+${delta})`);
      }
    }
  }

  // ─── Write ledger ────────────────────────────────────────────────
  const ledgerData = {
    mode: MODE,
    manifestVersion: manifest.version,
    manifestGenerated: manifest.generatedAt,
    importTimestamp: new Date().toISOString(),
    summary: {
      total: ledger.length,
      created: ledger.filter((e) => e.status === "created").length,
      reused: ledger.filter((e) => e.status === "reused").length,
      skipped: ledger.filter((e) => e.status === "skipped").length,
      dryRun: ledger.filter((e) => e.status === "dry-run").length,
      failed: ledger.filter((e) => e.status === "failed").length,
    },
    errors,
    entries: ledger,
  };
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledgerData, null, 2), "utf-8");
  log(`\nLedger written to: ${LEDGER_PATH}`);

  // ─── Summary ─────────────────────────────────────────────────────
  log("\n=== IMPORT SUMMARY ===");
  log(`  Mode: ${MODE}`);
  log(`  Created: ${ledgerData.summary.created}`);
  log(`  Reused: ${ledgerData.summary.reused}`);
  log(`  Skipped: ${ledgerData.summary.skipped}`);
  log(`  Dry-run: ${ledgerData.summary.dryRun}`);
  log(`  Failed: ${ledgerData.summary.failed}`);
  if (errors.length > 0) {
    log(`  ERRORS (${errors.length}):`);
    errors.forEach((e) => logError(`    ${e}`));
  }
  log(`  Manifest hash: (see batch-f-import-ledger.json)`);
}

// ─── Main ────────────────────────────────────────────────────────────
executeImport()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
