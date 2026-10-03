// R4O TASK 1 + TASK 2 + TASK 3 evidence probe. STRICTLY READ-ONLY.
//
// Gathers authoritative evidence for:
//   Task 1 - every unbound MachinePart, with audit/ownership provenance.
//   Task 2 - every MachineComponent, with deletion and dependency evidence.
//   Task 3 - every SparePart, with audit and test-provenance evidence.
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

const rootEnv = path.resolve(__dirname, '../../../.env');
for (const line of fs.readFileSync(rootEnv, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}

const prisma = new PrismaClient({ adapter: new PrismaMssql(process.env.DATABASE_URL!) });
const Q = (s: string) => prisma.$queryRawUnsafe<any[]>(s);

async function main() {
  const out: Record<string, any> = {};

  // ---------------------------------------------------------------- counts
  out.counts = {
    machines_total: Number((await Q(`SELECT COUNT(*) n FROM machines`))[0].n),
    machines_active: Number((await Q(`SELECT COUNT(*) n FROM machines WHERE deletedAt IS NULL AND status='ACTIVE'`))[0].n),
    machines_soft_deleted: Number((await Q(`SELECT COUNT(*) n FROM machines WHERE deletedAt IS NOT NULL`))[0].n),
    machine_parts_total: Number((await Q(`SELECT COUNT(*) n FROM machine_parts`))[0].n),
    machine_parts_bound: Number((await Q(`SELECT COUNT(*) n FROM machine_parts WHERE machineId IS NOT NULL`))[0].n),
    machine_parts_unbound: Number((await Q(`SELECT COUNT(*) n FROM machine_parts WHERE machineId IS NULL`))[0].n),
    machine_components_total: Number((await Q(`SELECT COUNT(*) n FROM machine_components`))[0].n),
    machine_components_live: Number((await Q(`SELECT COUNT(*) n FROM machine_components WHERE deletedAt IS NULL`))[0].n),
    machine_components_soft_deleted: Number((await Q(`SELECT COUNT(*) n FROM machine_components WHERE deletedAt IS NOT NULL`))[0].n),
    spare_parts_total: Number((await Q(`SELECT COUNT(*) n FROM spare_parts`))[0].n),
    spare_parts_live: Number((await Q(`SELECT COUNT(*) n FROM spare_parts WHERE deletedAt IS NULL`))[0].n),
    audit_logs: Number((await Q(`SELECT COUNT(*) n FROM audit_logs`))[0].n),
  };

  // ------------------------------------------------- TASK 1: unbound evidence
  // Group unbound MachineParts by their full identity fingerprint so the
  // register stays readable, but keep an exact per-record listing too.
  out.task1_unbound_groups = await Q(`
    SELECT LOWER(LTRIM(RTRIM(name))) AS nm,
           COUNT(*) AS rows,
           MIN(code) AS first_code, MAX(code) AS last_code,
           COUNT(DISTINCT LOWER(LTRIM(RTRIM(unit)))) AS units,
           MIN(createdAt) AS earliest_created, MAX(createdAt) AS latest_created,
           MIN(quantity) AS min_qty, MAX(quantity) AS max_qty,
           SUM(CASE WHEN productId IS NOT NULL THEN 1 ELSE 0 END) AS with_product,
           SUM(CASE WHEN partNumber IS NOT NULL THEN 1 ELSE 0 END) AS with_partnumber
    FROM machine_parts WHERE machineId IS NULL
    GROUP BY LOWER(LTRIM(RTRIM(name)))
    ORDER BY rows DESC, nm`);

  out.task1_unbound_exact = await Q(`
    SELECT id, code, name, machineId, productId, partNumber, quantity, minStock, unit, createdAt, updatedAt
    FROM machine_parts WHERE machineId IS NULL ORDER BY code`);

  // Any audit trail touching unbound MachinePart ids (by entityId).
  out.task1_unbound_audit_coverage = await Q(`
    SELECT COUNT(*) AS audit_rows_for_unbound
    FROM audit_logs a
    WHERE EXISTS (SELECT 1 FROM machine_parts mp WHERE mp.machineId IS NULL AND a.entityId = mp.id)`);

  out.task1_audit_entities = await Q(`
    SELECT entity, action, COUNT(*) AS n
    FROM audit_logs
    WHERE entity LIKE '%MachinePart%' OR entity LIKE '%SparePart%' OR entity LIKE '%MachineComponent%'
    GROUP BY entity, action ORDER BY entity, action`);

  // Company/branch context available in supported records, to test whether a
  // machine-free MachinePart can ever inherit ownership today.
  out.task1_machine_ownership_columns = await Q(`
    SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (TABLE_NAME='machine_parts' AND COLUMN_NAME IN ('companyId','branchId'))
       OR (TABLE_NAME='machine_components' AND COLUMN_NAME IN ('companyId','branchId'))
    ORDER BY TABLE_NAME`);

  out.task1_bound_machine_company_distribution = await Q(`
    SELECT TOP 20 ISNULL(m.companyId,'(null)') AS companyId, COUNT(*) AS bound_parts
    FROM machine_parts mp JOIN machines m ON m.id = mp.machineId
    GROUP BY m.companyId ORDER BY bound_parts DESC`);

  // ------------------------------------------------- TASK 2: component evidence
  out.task2_components = await Q(`
    SELECT c.id, c.code, c.name, c.componentType, c.machineId, c.parentComponentId,
           m.code AS machine_code, m.name AS machine_name,
           m.deletedAt AS machine_deleted, m.companyId AS machine_company,
           m.productionLineId AS machine_production_line,
           c.deletedAt, c.status, c.createdAt, c.updatedAt, c.criticality, c.locationInMachine
    FROM machine_components c
    LEFT JOIN machines m ON m.id = c.machineId
    ORDER BY c.code`);

  out.task2_component_dependencies = await Q(`
    SELECT c.id, c.code, c.name,
      (SELECT COUNT(*) FROM component_spare_parts x WHERE x.componentId=c.id) AS component_spare_parts,
      (SELECT COUNT(*) FROM machine_installed_parts x WHERE x.machine_component_id=c.id) AS installed_parts,
      (SELECT COUNT(*) FROM maintenance_requests x WHERE x.machineComponentId=c.id) AS maintenance_requests,
      (SELECT COUNT(*) FROM maintenance_work_orders x WHERE x.machineComponentId=c.id) AS work_orders,
      (SELECT COUNT(*) FROM maintenance_boms x WHERE x.componentId=c.id) AS boms,
      (SELECT COUNT(*) FROM spare_part_replacement_histories x WHERE x.machine_component_id=c.id) AS replacement_history,
      (SELECT COUNT(*) FROM spare_part_repair_orders x WHERE x.machine_component_id=c.id) AS repair_orders,
      (SELECT COUNT(*) FROM maintenance_part_accountability x WHERE x.machineComponentId=c.id) AS part_accountability,
      (SELECT COUNT(*) FROM production_measurement_points x WHERE x.machineComponentId=c.id) AS measurement_points,
      (SELECT COUNT(*) FROM maintenance_request_required_parts x WHERE x.machineComponentId=c.id) AS required_parts
    FROM machine_components c ORDER BY c.code`);

  out.task2_component_children = await Q(`
    SELECT parent.id AS parent_id, parent.code AS parent_code, COUNT(child.id) AS children
    FROM machine_components parent LEFT JOIN machine_components child ON child.parentComponentId = parent.id
    GROUP BY parent.id, parent.code ORDER BY parent.code`);

  out.task2_component_audit = await Q(`
    SELECT a.entityId, a.entity, a.action, a.createdAt, a.userId, LEFT(ISNULL(a.details,''),300) AS details
    FROM audit_logs a
    WHERE a.entityId IN (SELECT id FROM machine_components)
    ORDER BY a.entityId, a.createdAt`);

  // ------------------------------------------------- TASK 3: spare part evidence
  out.task3_spare_parts = await Q(`
    SELECT id, code, name, description, category, specification, unit, manufacturer, model,
           partNumber, barcode, technicalClassification, usageType, nature, importance,
           isCritical, status, productId, createdAt, updatedAt, deletedAt
    FROM spare_parts ORDER BY code`);

  out.task3_spare_part_dependencies = await Q(`
    SELECT sp.id, sp.code, sp.name,
      (SELECT COUNT(*) FROM machine_spare_parts x WHERE x.sparePartId=sp.id) AS machine_links,
      (SELECT COUNT(*) FROM component_spare_parts x WHERE x.sparePartId=sp.id) AS component_links,
      (SELECT COUNT(*) FROM machine_parts x WHERE x.sparePartId=sp.id) AS canonical_machine_parts,
      (SELECT COUNT(*) FROM machine_installed_parts x WHERE x.spare_part_id=sp.id) AS installed_parts,
      (SELECT COUNT(*) FROM maintenance_work_order_parts x WHERE x.sparePartId=sp.id) AS work_order_parts,
      (SELECT COUNT(*) FROM maintenance_request_required_parts x WHERE x.sparePartId=sp.id) AS required_parts,
      (SELECT COUNT(*) FROM spare_part_condition_balances x WHERE x.sparePartId=sp.id) AS condition_balances,
      (SELECT COUNT(*) FROM spare_part_condition_movements x WHERE x.sparePartId=sp.id) AS condition_movements,
      (SELECT COUNT(*) FROM spare_part_replacement_histories x WHERE x.old_spare_part_id=sp.id OR x.new_spare_part_id=sp.id) AS replacement_history,
      (SELECT COUNT(*) FROM maintenance_bom_items x WHERE x.sparePartId=sp.id) AS bom_items,
      (SELECT COUNT(*) FROM preventive_spare_part_plan_items x WHERE x.sparePartId=sp.id) AS plan_items,
      (SELECT COUNT(*) FROM spare_part_condition_movements x WHERE x.productId=sp.productId AND sp.productId IS NOT NULL) AS condition_movements_via_product,
      (SELECT COUNT(*) FROM maintenance_work_order_parts x WHERE x.productId=sp.productId AND sp.productId IS NOT NULL) AS work_order_parts_via_product,
      (SELECT COUNT(*) FROM maintenance_bom_items x WHERE x.sparePartId=sp.id) AS bom_items
    FROM spare_parts sp ORDER BY sp.code`);

  out.task3_spare_part_audit = await Q(`
    SELECT a.entityId, sp.code, a.action, a.createdAt, a.userId, LEFT(ISNULL(a.details,''),300) AS details
    FROM audit_logs a JOIN spare_parts sp ON sp.id = a.entityId
    ORDER BY sp.code, a.createdAt`);

  // Test-provenance: which rows were created by the automated QA harness user?
  out.task3_creator_user_distribution = await Q(`
    SELECT u.id, u.name, u.email, u.status, u.companyId, u.branchId,
      (SELECT COUNT(*) FROM audit_logs a WHERE a.userId = u.id) AS audit_rows
    FROM users u WHERE EXISTS (SELECT 1 FROM audit_logs a WHERE a.userId = u.id AND a.entity='SparePart')
    ORDER BY audit_rows DESC`);

  out.task3_spare_part_audit_grouped = await Q(`
    SELECT a.userId, u.name AS user_name, u.email, a.action, COUNT(*) AS n,
           MIN(a.createdAt) AS first_at, MAX(a.createdAt) AS last_at,
           MIN(a.ip) AS sample_ip, MIN(LEFT(ISNULL(a.userAgent,''),60)) AS sample_agent
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.userId
    WHERE a.entity = 'SparePart'
    GROUP BY a.userId, u.name, u.email, a.action
    ORDER BY n DESC`);

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());