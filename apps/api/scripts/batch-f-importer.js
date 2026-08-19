/**
 * Batch F — Controlled Joubah Production Import (msnodesqlv8 version)
 *
 * Uses raw msnodesqlv8 with Windows Integrated Authentication.
 * Single SERIALIZABLE transaction. Parameterized queries only.
 *
 * Modes:
 *   node scripts/batch-f-importer.js --dry-run
 *   node scripts/batch-f-importer.js --execute
 */

const cuid = require('cuid');
const fs = require('fs');
const path = require('path');
const msnodesqlv8 = require('msnodesqlv8');

// ─── Configuration ──────────────────────────────────────────────────
const CONN_STR = 'Driver={ODBC Driver 17 for SQL Server};Server=localhost,50079;Database=ATsoftERP_DB;Trusted_Connection=yes;';
const CUTOVER = new Date('2026-08-19T00:00:00.000Z');
const MODE = process.argv.includes('--execute') ? 'execute' : 'dry-run';

// ─── Paths ───────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '../../..');
const BATCH_E_DIR = path.join(ROOT, 'docs/data-prep/batch-e');
const BATCH_F_DIR = path.join(ROOT, 'docs/data-prep/batch-f');
const MANIFEST_PATH = path.join(BATCH_E_DIR, 'batch-e-import-manifest.json');
const PERSONS_PATH = path.join(BATCH_E_DIR, 'persons.json');
const ASSIGNMENTS_PATH = path.join(BATCH_E_DIR, 'assignments.json');
const MAINT_PATH = path.join(BATCH_E_DIR, 'maintenance_personnel.json');
const MACHINE_RESP_PATH = path.join(BATCH_E_DIR, 'machine_responsibilities.json');
const JOB_TITLES_PATH = path.join(BATCH_E_DIR, 'job_titles.json');
const CORE_SHEETS_PATH = path.join(BATCH_E_DIR, 'core_sheets_data.json');
const RESOLUTION_MAP_PATH = path.join(BATCH_F_DIR, 'null-resolution-map.json');
const LEDGER_PATH = path.join(BATCH_F_DIR, 'batch-f-import-ledger.json');

// ─── Load data ───────────────────────────────────────────────────────
function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf-8')); }

const manifest = loadJson(MANIFEST_PATH);
const personsData = loadJson(PERSONS_PATH);
const assignmentsData = loadJson(ASSIGNMENTS_PATH);
const maintData = loadJson(MAINT_PATH);
const machineRespData = loadJson(MACHINE_RESP_PATH);
const jobTitlesData = loadJson(JOB_TITLES_PATH);
const coreSheets = loadJson(CORE_SHEETS_PATH);
const resolutionMap = loadJson(RESOLUTION_MAP_PATH);

// ─── Lookup maps ─────────────────────────────────────────────────────
const personsByCode = new Map(personsData.map(p => [p.code, p]));
const jobTitlesByCode = new Map(jobTitlesData.map(jt => [jt.code, jt]));
const maintByCode = new Map(maintData.map(m => [m.maintenance_person_code, m]));
const machineRespByCode = new Map(machineRespData.map(r => [r.code, r]));

const branchSheet = coreSheets['04_الفروع'];
const branchByCode = new Map((branchSheet.rows || []).map(r => [r.code, r]));
const adminSheet = coreSheets['05_الإدارات'];
const adminByCode = new Map((adminSheet.rows || []).map(r => [r.code, r]));
const deptSheet = coreSheets['06_الأقسام'];
const deptByCode = new Map((deptSheet.rows || []).map(r => [r.code, r]));

const D05_LINKS = { MNT_0009: 'EMP-0009', MNT_0104: 'EMP-0104', MNT_0105: 'EMP-0105' };

// ─── D06 link overrides (operational_person_code from manifest decisions) ──
const D06_LINKS = { MNT_0002: 'EMP-0002', MNT_0008: 'EMP-0008', MNT_0102: 'EMP-0102', MNT_0103: 'EMP-0103', MNT_0202: 'EMP-0202' };

// ─── State ───────────────────────────────────────────────────────────
const ledger = [];
const errors = [];

function log(msg) { console.log(`[${MODE.toUpperCase()}] ${msg}`); }
function logError(msg) { console.error(`[ERROR] ${msg}`); errors.push(msg); }

// ─── msnodesqlv8 helpers ─────────────────────────────────────────────
function openConn() {
  return new Promise((resolve, reject) => {
    msnodesqlv8.open(CONN_STR, (err, conn) => {
      if (err) reject(err); else resolve(conn);
    });
  });
}

function closeConn(conn) {
  return new Promise((resolve, reject) => {
    conn.close((err) => { if (err) reject(err); else resolve(); });
  });
}

function beginTx(conn) {
  return new Promise((resolve, reject) => {
    conn.beginTransaction((err) => { if (err) reject(err); else resolve(); });
  });
}

function commitTx(conn) {
  return new Promise((resolve, reject) => {
    conn.commit((err) => { if (err) reject(err); else resolve(); });
  });
}

function rollbackTx(conn) {
  return new Promise((resolve, reject) => {
    conn.rollback((err) => { if (err) reject(err); else resolve(); });
  });
}

function queryParam(conn, sql, params) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let meta = null;
    let done = false;
    const req = params ? conn.query(sql, params) : conn.query(sql);
    req.on('meta', (m) => { meta = m; });
    req.on('row', (idx) => { rows.push([]); });
    req.on('column', (colIdx, val) => { rows[rows.length - 1].push(val); });
    req.on('done', () => { done = true; resolve({ rows, meta }); });
    req.on('error', (err) => { if (!done) reject(err); });
  });
}

// ─── ID Generation ───────────────────────────────────────────────────
const PLANNED_IDS = {};
const USED_IDS = new Set();

function generateId(entityType, businessKey) {
  const key = `${entityType}:${businessKey}`;
  if (PLANNED_IDS[key]) return PLANNED_IDS[key];
  let id;
  do { id = cuid(); } while (USED_IDS.has(id));
  USED_IDS.add(id);
  PLANNED_IDS[key] = id;
  return id;
}

function resolveExistingId(conn, table, codeCol, codeValue, deletedCol) {
  const where = deletedCol ? `AND ${deletedCol} IS NULL` : '';
  return queryParam(conn, `SELECT id FROM ${table} WHERE ${codeCol} = ? ${where}`, [codeValue])
    .then(r => r.rows.length > 0 ? r.rows[0][0] : null);
}

// ─── Snapshot ────────────────────────────────────────────────────────
async function snapshot(conn, label) {
  const tables = [
    'companies', 'branches', 'administrations', 'departments', 'job_titles',
    'operational_people', 'maintenance_personnel',
    'operational_person_assignments', 'machine_responsibility_assignments',
  ];
  const counts = {};
  for (const t of tables) {
    const r = await queryParam(conn, `SELECT COUNT(*) AS cnt FROM ${t}`);
    counts[t] = Number(r.rows[0][0]);
  }
  log(`Snapshot [${label}]: ${JSON.stringify(counts)}`);
  return counts;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  log('=== Batch F Importer (msnodesqlv8) ===');
  log(`Mode: ${MODE}`);
  log(`Manifest: ${manifest.entities ? 'entities format' : 'summary format'}`);

  const conn = await openConn();
  let pre = {};

  try {
    // Pre-import snapshot (read-only, outside transaction)
    pre = await snapshot(conn, 'pre-import');

    // ── Generate all 286 IDs upfront ───────────────────────────────
    log('\n--- Generating 286 CUID v1 IDs ---');
    const entityCounts = {
      Branch: 3, Administration: 40, Department: 152, JobTitle: 29,
      OperationalPerson: 23, OperationalPersonAssignment: 23,
      MaintenancePersonnel: 8, MachineResponsibilityAssignment: 8,
    };
    let idCount = 0;
    for (const [entity, count] of Object.entries(entityCounts)) {
      const records = manifest.entities[entity]?.records || [];
      const createRecords = records.filter(r => r.action === 'CREATE');
      for (const rec of createRecords) {
        generateId(entity, rec.businessKey);
        idCount++;
      }
    }
    log(`Generated ${idCount} planned IDs`);
    if (idCount !== 286) { logError(`ID count mismatch: expected 286, got ${idCount}`); return; }

    // Collision check against existing DB
    log('\n--- Collision check against existing DB ---');
    const existingIdTables = [
      'branches', 'administrations', 'departments', 'job_titles',
      'operational_people', 'maintenance_personnel',
      'operational_person_assignments', 'machine_responsibility_assignments',
    ];
    let collisions = 0;
    for (const t of existingIdTables) {
      const r = await queryParam(conn, `SELECT id FROM ${t}`);
      for (const row of r.rows) {
        if (USED_IDS.has(row[0])) {
          logError(`COLLISION: ${t} already has id ${row[0]}`);
          collisions++;
        }
      }
    }
    if (collisions > 0) { logError(`${collisions} collisions found. Cannot proceed.`); return; }
    log(`Collision check: 0 collisions PASS`);

    // ── Begin transaction ──────────────────────────────────────────
    if (MODE === 'execute') {
      await queryParam(conn, 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      await beginTx(conn);
      log('\n=== SERIALIZABLE TRANSACTION BEGIN ===');
    }

    // ── Phase 0: Company (REUSE) ───────────────────────────────────
    log('\n--- Phase 0: Company (REUSE) ---');
    const compRec = manifest.entities.Company.records.find(r => r.action === 'REUSE_EXISTING');
    let companyId;
    if (MODE === 'execute') {
      const r = await queryParam(conn, 'SELECT id FROM companies WHERE code = ? AND deletedAt IS NULL', [compRec.existingDbCode]);
      if (r.rows.length === 0) { logError('Company COM-000001 not found'); return; }
      companyId = r.rows[0][0];
    } else {
      companyId = 'dry-company-' + compRec.existingDbCode;
    }
    ledger.push({ entityType: 'Company', businessKey: compRec.businessKey, action: 'REUSE_EXISTING', dbCode: compRec.existingDbCode, dbId: companyId, status: MODE === 'execute' ? 'reused' : 'dry-run' });
    log(`  Company REUSE: ${compRec.businessKey} -> ${compRec.existingDbCode} (${companyId})`);

    // ── Phase 1: Branches (3 CREATE + 1 REUSE) ────────────────────
    log('\n--- Phase 1: Branches ---');
    const branchMap = new Map();
    for (const br of manifest.entities.Branch.records) {
      if (br.action === 'REUSE_EXISTING') {
        let brId;
        if (MODE === 'execute') {
          const r = await queryParam(conn, 'SELECT id FROM branches WHERE companyId = ? AND code = ? AND deletedAt IS NULL', [companyId, br.existingDbCode]);
          if (r.rows.length === 0) { logError(`Branch REUSE ${br.existingDbCode} not found`); continue; }
          brId = r.rows[0][0];
        } else {
          brId = 'dry-branch-' + br.existingDbCode;
        }
        branchMap.set(br.businessKey, brId);
        ledger.push({ entityType: 'Branch', businessKey: br.businessKey, action: 'REUSE_EXISTING', dbCode: br.existingDbCode, dbId: brId, status: MODE === 'execute' ? 'reused' : 'dry-run' });
        log(`  Branch REUSE: ${br.businessKey} -> ${br.existingDbCode}`);
      } else if (br.action === 'CREATE') {
        const src = branchByCode.get(br.businessKey);
        const name = src?.name || br.businessKey;
        const address = src?.address || null;
        const phone = src?.phone || null;
        const brId = generateId('Branch', br.businessKey);

        if (MODE === 'execute') {
          const now = new Date();
          await queryParam(conn,
            'INSERT INTO branches (id, companyId, code, name, address, phone, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [brId, companyId, br.businessKey, name, address, phone, 'ACTIVE', now, now]
          );
        }
        branchMap.set(br.businessKey, brId);
        ledger.push({ entityType: 'Branch', businessKey: br.businessKey, action: 'CREATE', dbId: brId, dbCode: br.businessKey, status: MODE === 'execute' ? 'created' : 'dry-run' });
        log(`  Branch CREATE: ${br.businessKey} -> ${name} (${brId})`);
      }
    }

    // ── Phase 2: Administrations (40 CREATE) ───────────────────────
    log('\n--- Phase 2: Administrations ---');
    const adminMap = new Map();
    for (const a of manifest.entities.Administration.records) {
      if (a.action !== 'CREATE') continue;
      const src = adminByCode.get(a.businessKey);
      const brId = branchMap.get(a.branchCode);
      if (!brId) { logError(`Admin ${a.businessKey}: branch ${a.branchCode} not resolved`); continue; }

      const name = src?.name || a.businessKey;
      const description = src?.description || null;
      const admId = generateId('Administration', a.businessKey);

      if (MODE === 'execute') {
        const now = new Date();
        await queryParam(conn,
          'INSERT INTO administrations (id, branchId, code, name, description, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [admId, brId, a.businessKey, name, description, 'ACTIVE', now, now]
        );
      }
      adminMap.set(a.businessKey, admId);
      ledger.push({ entityType: 'Administration', businessKey: a.businessKey, action: 'CREATE', dbId: admId, dbCode: a.businessKey, status: MODE === 'execute' ? 'created' : 'dry-run' });
    }
    log(`  Created: ${adminMap.size}`);

    // ── Phase 3: Departments (152 CREATE, parent-first) ────────────
    log('\n--- Phase 3: Departments ---');
    const deptMap = new Map();

    // Build parent-child relationships
    const deptRecords = manifest.entities.Department.records.filter(r => r.action === 'CREATE');
    // Separate into parentless and with-parent
    const parentless = deptRecords.filter(d => !d.parentCode);
    const withParent = deptRecords.filter(d => d.parentCode);

    async function createDept(d) {
      const src = deptByCode.get(d.businessKey);
      const brId = branchMap.get(d.branchCode);
      const admId = d.administrationCode ? adminMap.get(d.administrationCode) : undefined;
      const parentId = d.parentCode ? deptMap.get(d.parentCode) : undefined;

      if (!brId) { logError(`Dept ${d.businessKey}: branch ${d.branchCode} not resolved`); return; }

      const name = src?.name || d.businessKey;
      const classification = d.classification || 'OPERATIONAL';
      const deptId = generateId('Department', d.businessKey);

      if (MODE === 'execute') {
        const now = new Date();
        await queryParam(conn,
          'INSERT INTO departments (id, companyId, branchId, administrationId, parentId, code, name, classification, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [deptId, companyId, brId, admId || null, parentId || null, d.businessKey, name, classification, 'ACTIVE', now, now]
        );
      }
      deptMap.set(d.businessKey, deptId);
      ledger.push({ entityType: 'Department', businessKey: d.businessKey, action: 'CREATE', dbId: deptId, dbCode: d.businessKey, status: MODE === 'execute' ? 'created' : 'dry-run' });
    }

    // Create parentless first
    for (const d of parentless) await createDept(d);
    // Then children (may need multiple passes for deep hierarchies)
    let remaining = withParent.length;
    let maxPasses = 10;
    while (remaining > 0 && maxPasses > 0) {
      let createdThisPass = 0;
      for (const d of withParent) {
        if (deptMap.has(d.businessKey)) continue;
        if (deptMap.has(d.parentCode)) {
          await createDept(d);
          createdThisPass++;
        }
      }
      if (createdThisPass === 0) {
        // Remaining have unresolvable parents
        for (const d of withParent) {
          if (!deptMap.has(d.businessKey)) {
            logError(`Dept ${d.businessKey}: parent ${d.parentCode} unresolvable`);
          }
        }
        break;
      }
      remaining -= createdThisPass;
      maxPasses--;
    }
    log(`  Created: ${deptMap.size}`);

    // ── Phase 4: Job Titles (29 CREATE) ────────────────────────────
    log('\n--- Phase 4: Job Titles ---');
    const jtMap = new Map();
    for (const j of manifest.entities.JobTitle.records) {
      if (j.action !== 'CREATE') continue;
      const src = jobTitlesByCode.get(j.businessKey);
      const name = src?.name || j.businessKey;
      const nameAr = src?.name_ar || src?.name || null;
      const nameEn = src?.name_en || null;
      const category = src?.category || 'OPERATIONAL';
      const description = src?.description || null;
      const jtId = generateId('JobTitle', j.businessKey);

      if (MODE === 'execute') {
        const now = new Date();
        await queryParam(conn,
          'INSERT INTO job_titles (id, companyId, code, name, nameAr, nameEn, category, description, isActive, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [jtId, companyId, j.businessKey, name, nameAr, nameEn, category, description, true, 'ACTIVE', now, now]
        );
      }
      jtMap.set(j.businessKey, jtId);
      ledger.push({ entityType: 'JobTitle', businessKey: j.businessKey, action: 'CREATE', dbId: jtId, dbCode: j.businessKey, status: MODE === 'execute' ? 'created' : 'dry-run' });
    }
    log(`  Created: ${jtMap.size}`);

    // ── Phase 5: Operational Persons (23 CREATE) ───────────────────
    log('\n--- Phase 5: Operational Persons ---');
    const personMap = new Map();
    for (const p of manifest.entities.OperationalPerson.records) {
      if (p.action !== 'CREATE') continue;
      const src = personsByCode.get(p.businessKey);
      const name = src?.name || p.businessKey;
      const category = src?.category || 'OPERATIONAL';
      const isActive = src?.is_active !== false;
      const phone = src?.phone || null;
      const email = src?.email || null;
      const notes = src?.notes || null;
      const opId = generateId('OperationalPerson', p.businessKey);

      if (MODE === 'execute') {
        const now = new Date();
        await queryParam(conn,
          'INSERT INTO operational_people (id, code, name, category, isActive, phone, email, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [opId, p.businessKey, name, category, isActive, phone, email, notes, now, now]
        );
      }
      personMap.set(p.businessKey, opId);
      ledger.push({ entityType: 'OperationalPerson', businessKey: p.businessKey, action: 'CREATE', dbId: opId, dbCode: p.businessKey, status: MODE === 'execute' ? 'created' : 'dry-run' });
    }
    log(`  Created: ${personMap.size}`);

    // ── Phase 6: Operational Person Assignments (23 CREATE) ─────────
    log('\n--- Phase 6: Operational Person Assignments ---');
    const assignMap = new Map();
    for (const a of manifest.entities.OperationalPersonAssignment.records) {
      if (a.action !== 'CREATE') continue;
      const personCode = a.businessKey;
      const personId = personMap.get(personCode);
      if (!personId) { logError(`Assign ${personCode}: person not resolved`); continue; }

      // Resolve department via null-resolution-map
      let deptCode = a.departmentCode;
      if (!deptCode) deptCode = resolutionMap.departmentResolution[personCode];
      const deptId = deptCode ? deptMap.get(deptCode) : undefined;
      if (!deptId) { logError(`Assign ${personCode}: dept ${deptCode} not resolved`); continue; }

      const admId = a.administrationCode ? adminMap.get(a.administrationCode) : undefined;
      const brId = a.branchCode ? branchMap.get(a.branchCode) : undefined;
      const jtId = a.jobTitleCode ? jtMap.get(a.jobTitleCode) : undefined;
      const effectiveFrom = a.effectiveFrom ? new Date(a.effectiveFrom) : CUTOVER;
      const assignmentType = a.assignmentType || 'PRIMARY';
      const assignId = generateId('OperationalPersonAssignment', personCode);

      if (MODE === 'execute') {
        const now = new Date();
        await queryParam(conn,
          'INSERT INTO operational_person_assignments (id, companyId, branchId, administrationId, departmentId, jobTitleId, personnelId, assignmentType, effectiveFrom, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [assignId, companyId, brId || null, admId || null, deptId, jtId || null, personId, assignmentType, effectiveFrom, 'ACTIVE', now, now]
        );
      }
      assignMap.set(personCode, assignId);
      ledger.push({ entityType: 'OperationalPersonAssignment', businessKey: a.businessKey, action: 'CREATE', dbId: assignId, resolvedFields: { personCode, deptCode, effectiveFrom: effectiveFrom.toISOString() }, status: MODE === 'execute' ? 'created' : 'dry-run' });
    }
    log(`  Created: ${assignMap.size}`);

    // ── Phase 7: Maintenance Personnel (EXACTLY 8 CREATE) ──────────
    log('\n--- Phase 7: Maintenance Personnel ---');
    const maintMap = new Map();
    const maintCreateRecords = manifest.entities.MaintenancePersonnel.records.filter(r => r.action === 'CREATE');
    if (maintCreateRecords.length !== 8) { logError(`MaintenancePersonnel CREATE count: expected 8, got ${maintCreateRecords.length}`); return; }

    for (const m of maintCreateRecords) {
      const src = maintByCode.get(m.businessKey);
      // Resolve operational person: D05 override > manifest personLinked > data file
      let opCode = D05_LINKS[m.businessKey] || m.personLinked || src?.operational_person_code;
      if (!opCode) { logError(`Maint ${m.businessKey}: no operational person code`); continue; }
      const opId = personMap.get(opCode);
      if (!opId) { logError(`Maint ${m.businessKey}: person ${opCode} not resolved`); continue; }

      const role = src?.job_title_reference || 'General';
      const specialty = null;
      const mntId = generateId('MaintenancePersonnel', m.businessKey);

      if (MODE === 'execute') {
        const now = new Date();
        await queryParam(conn,
          'INSERT INTO maintenance_personnel (id, operationalPersonId, role, specialty, isActive, daily_capacity_minutes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [mntId, opId, role, specialty, true, 480, now, now]
        );
      }
      maintMap.set(m.businessKey, mntId);
      // Also map by opCode for MachineResp resolution
      maintMap.set(opCode, mntId);
      ledger.push({ entityType: 'MaintenancePersonnel', businessKey: m.businessKey, action: 'CREATE', dbId: mntId, resolvedFields: { opCode }, status: MODE === 'execute' ? 'created' : 'dry-run' });
      log(`  Maint CREATE: ${m.businessKey} -> op=${opCode} (${mntId})`);
    }
    log(`  Created: ${maintMap.size}`);

    // ── Phase 8: Machine Responsibility Assignments (20 CREATE) ────
    log('\n--- Phase 8: Machine Responsibility Assignments ---');
    let respCount = 0;
    for (const r of manifest.entities.MachineResponsibilityAssignment.records) {
      if (r.action !== 'CREATE') continue;
      const src = machineRespByCode.get(r.businessKey);

      // Determine target employee
      const brNum = (r.branchCode || '').replace('BR_', '') || '01';
      let targetEmpCode;
      if (r.businessKey.includes('MNT_MANAGER')) {
        targetEmpCode = { '01': 'EMP-0002', '02': 'EMP-0202', '03': 'EMP-0301', '04': 'EMP-0401' }[brNum];
      } else if (r.businessKey.includes('STORE')) {
        targetEmpCode = { '01': 'EMP-0010', '02': 'EMP-0202', '03': 'EMP-0301', '04': 'EMP-0401' }[brNum];
      } else if (r.businessKey.includes('CH_MNT')) {
        targetEmpCode = { '01': 'EMP-0102', '02': 'EMP-0201', '03': 'EMP-0301', '04': 'EMP-0401' }[brNum];
      } else if (r.businessKey.includes('PF_MNT')) {
        targetEmpCode = { '01': 'EMP-0103', '02': 'EMP-0202', '03': 'EMP-0301', '04': 'EMP-0401' }[brNum];
      } else if (r.businessKey.includes('LATHE')) {
        targetEmpCode = { '01': 'EMP-0009', '02': 'EMP-0202', '03': 'EMP-0301', '04': 'EMP-0401' }[brNum];
      }

      if (!targetEmpCode) { logError(`MachineResp ${r.businessKey}: target employee not resolved`); continue; }

      // Find maintenance personnel for this employee
      let maintId = maintMap.get(targetEmpCode);
      if (!maintId) {
        logError(`MachineResp ${r.businessKey}: NO MaintenancePersonnel for ${targetEmpCode}. Manifest authorize 8 only. SKIPPING.`);
        continue;
      }

      // Resolve scope
      let scopeType = r.scopeType || src?.scope_type;
      if (!scopeType) {
        const sr = resolutionMap.scopeResolution[r.businessKey];
        if (sr) scopeType = sr.scopeType;
      }

      let deptIdForScope = null;
      if (scopeType === 'DEPARTMENT') {
        let deptCode = src?.department_code;
        if (!deptCode) {
          const sr = resolutionMap.scopeResolution[r.businessKey];
          if (sr?.departmentCode) deptCode = sr.departmentCode;
        }
        if (deptCode) {
          deptIdForScope = deptMap.get(deptCode);
          if (!deptIdForScope) { logError(`MachineResp ${r.businessKey}: dept ${deptCode} not resolved for DEPARTMENT scope`); continue; }
        }
      }

      const startDate = r.startDate ? new Date(r.startDate) : CUTOVER;
      const respRole = src?.responsibility_role || 'General';
      const isPrimary = src?.is_primary === true || src?.is_primary === 'true';
      const respId = generateId('MachineResponsibilityAssignment', r.businessKey);

      if (MODE === 'execute') {
        const now = new Date();
        await queryParam(conn,
          'INSERT INTO machine_responsibility_assignments (id, scopeType, departmentId, maintenancePersonnelId, responsibilityRole, isPrimary, startDate, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [respId, scopeType || 'MACHINE', deptIdForScope, maintId, respRole, isPrimary, startDate, 'ACTIVE', now, now]
        );
      }
      respCount++;
      ledger.push({ entityType: 'MachineResponsibilityAssignment', businessKey: r.businessKey, action: 'CREATE', dbId: respId, resolvedFields: { targetEmpCode, scopeType, deptIdForScope }, status: MODE === 'execute' ? 'created' : 'dry-run' });
      log(`  Resp CREATE: ${r.businessKey} -> emp=${targetEmpCode}, scope=${scopeType} (${respId})`);
    }
    log(`  Created: ${respCount}`);
    if (respCount !== 8) { logError(`MachineResp count: expected 8, got ${respCount}`); }

    // ── Post-import snapshot ────────────────────────────────────────
    if (MODE === 'execute') {
      const post = await snapshot(conn, 'post-import');
      log('\n--- Delta ---');
      for (const t of Object.keys(pre)) {
        const d = post[t] - pre[t];
        if (d !== 0) log(`  ${t}: ${pre[t]} -> ${post[t]} (+${d})`);
      }
    }

    // ── Commit ──────────────────────────────────────────────────────
    if (MODE === 'execute') {
      await commitTx(conn);
      log('\n=== TRANSACTION COMMITTED ===');
    }

  } catch (e) {
    logError('FATAL: ' + e.message);
    if (MODE === 'execute') {
      try { await rollbackTx(conn); log('=== TRANSACTION ROLLED BACK ==='); } catch (rb) { logError('Rollback failed: ' + rb.message); }
    }
  } finally {
    // ── Write ledger ──────────────────────────────────────────────
    const ledgerData = {
      mode: MODE,
      manifestVersion: manifest.manifest_version,
      importTimestamp: new Date().toISOString(),
      driver: 'msnodesqlv8',
      auth: 'Windows Integrated',
      odbcDriver: 'ODBC Driver 17 for SQL Server',
      cutoverDate: CUTOVER.toISOString(),
      summary: {
        total: ledger.length,
        created: ledger.filter(e => e.status === 'created').length,
        reused: ledger.filter(e => e.status === 'reused').length,
        dryRun: ledger.filter(e => e.status === 'dry-run').length,
        failed: ledger.filter(e => e.status === 'failed').length,
      },
      plannedIds: PLANNED_IDS,
      errors,
      entries: ledger,
    };
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledgerData, null, 2), 'utf-8');
    log(`\nLedger: ${LEDGER_PATH}`);

    // ── Summary ────────────────────────────────────────────────────
    log('\n=== SUMMARY ===');
    log(`  Created: ${ledgerData.summary.created}`);
    log(`  Reused:  ${ledgerData.summary.reused}`);
    log(`  Dry-run: ${ledgerData.summary.dryRun}`);
    log(`  Failed:  ${ledgerData.summary.failed}`);
    if (errors.length > 0) {
      log('  ERRORS:');
      errors.forEach(e => log(`    ${e}`));
    }

    await closeConn(conn);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
