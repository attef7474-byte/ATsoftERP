import * as fs from 'fs';
import * as path from 'path';
import {
  COST_TYPES,
  COST_TRANSACTION_SOURCE_TYPES,
  COST_TRANSACTION_UNITS,
  COST_CALCULATION_SCOPE_TYPES,
  OPERATIONAL_LEDGER_SOURCE_TYPES,
  OPERATIONAL_LEDGER_EVENT_TYPES,
} from './production-cost.constants';

/**
 * Source-to-DB contract regression guard (Production Cost Database Contract Repair R1).
 *
 * The original defect escaped unit/API coverage because the Prisma service tests mock
 * the database: a DOWNTIME costType/sourceType and a BRANCH calculation scope were
 * valid in the backend source (`COST_TYPES`, `COST_TRANSACTION_SOURCE_TYPES`,
 * `COST_CALCULATION_SCOPE_TYPES`) but the SQL Server CHECK constraints rejected them.
 *
 * THIS FILE is the guard that makes that class of drift fail the build. It verifies
 * that the authoritative source constants (the SINGLE canonical contract) are exactly
 * reflected in the CHECK constraints of the repair migration that is applied to the
 * live database. If a developer adds a value to any production-cost constant without
 * synchronizing the database CHECK contract, this suite fails.
 *
 * It intentionally reads/parses the applied migration SQL (the machine the database
 * actually runs) rather than duplicating a second runtime authority that could drift.
 */

const REPAIR_MIGRATION_DIR = path.resolve(
  __dirname,
  '../../../../prisma/migrations/20260831130000_repair_production_cost_check_constraints',
);
const REPAIR_MIGRATION_FILE = path.join(REPAIR_MIGRATION_DIR, 'migration.sql');
const LABOR_MIGRATION_DIR = path.resolve(
  __dirname,
  '../../../../prisma/migrations/20260903120000_cost_r2b_maintenance_labor_ledger',
);
const LABOR_MIGRATION_FILE = path.join(LABOR_MIGRATION_DIR, 'migration.sql');
const EXTERNAL_SERVICE_MIGRATION_DIR = path.resolve(
  __dirname,
  '../../../../prisma/migrations/20260904120000_cost_r2c_external_service_ledger',
);
const EXTERNAL_SERVICE_MIGRATION_FILE = path.join(EXTERNAL_SERVICE_MIGRATION_DIR, 'migration.sql');

interface CheckContract {
  constraintName: string;
  column: string;
  values: string[];
}

function normalize(v: string): string {
  return v.replace(/^N?'?/i, '').replace(/'$/, '').trim();
}

/** Extracts { constraintName, column, values } for every hard-coded IN-list CHECK in the SQL. */
function parseCheckConstraints(sql: string): CheckContract[] {
  const contracts: CheckContract[] = [];
  const re = /ADD\s+CONSTRAINT\s+\[([^\]]+)\]\s+CHECK\s*\(\s*\[([^\]]+)\]\s+IN\s*\(\s*([^)]*)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const constraintName = m[1];
    const column = m[2];
    const body = m[3];
    const values = (body.match(/'[^']*'/g) ?? []).map(normalize);
    contracts.push({ constraintName, column, values });
  }
  return contracts;
}

/** Guards that every CHECK is added WITH CHECK (i.e. enabled + trusted, never WITH NOCHECK). */
function isAddedWithCheck(sql: string, constraintName: string): boolean {
  const addLine = sql.split('\n').find((l) => l.includes(`ADD CONSTRAINT [${constraintName}]`));
  return !!addLine && /WITH\s+CHECK/i.test(addLine);
}

const expectSameSet = (actual: string[], canonical: readonly string[], label: string) => {
  const a = [...actual].sort();
  const c = [...canonical].sort();
  expect({ label, actual: a }).toEqual({ label, actual: c });
};

describe('ProductionCost source-to-database CHECK contract guard', () => {
  let migrationSql: string;
  let laborMigrationSql: string;
  let externalServiceMigrationSql: string;

  beforeAll(() => {
    expect(fs.existsSync(REPAIR_MIGRATION_FILE)).toBe(true);
    expect(fs.existsSync(LABOR_MIGRATION_FILE)).toBe(true);
    expect(fs.existsSync(EXTERNAL_SERVICE_MIGRATION_FILE)).toBe(true);
    migrationSql = fs.readFileSync(REPAIR_MIGRATION_FILE, 'utf8');
    laborMigrationSql = fs.readFileSync(LABOR_MIGRATION_FILE, 'utf8');
    externalServiceMigrationSql = fs.readFileSync(EXTERNAL_SERVICE_MIGRATION_FILE, 'utf8');
  });

  it('references the expected single repair migration', () => {
    expect(path.basename(REPAIR_MIGRATION_DIR)).toBe('20260831130000_repair_production_cost_check_constraints');
  });

  it('contains no manual Prisma migration-history SQL (history must use Prisma resolve)', () => {
    expect(/INSERT\s+INTO\s+_prisma_migrations/i.test(migrationSql)).toBe(false);
  });

  it('declares exactly the five expected CHECK constraints, all WITH CHECK', () => {
    const contracts = parseCheckConstraints(migrationSql);
    const names = contracts.map((c) => c.constraintName).sort();
    expect(names).toEqual(
      [
        'operational_cost_rates_cost_type_ck',
        'operational_standard_cost_snapshots_cost_type_ck',
        'operational_cost_transactions_event_type_ck',
        'operational_cost_transactions_source_type_ck',
        'operational_cost_calculations_scope_type_ck',
      ].sort(),
    );
    for (const name of names) {
      expect(isAddedWithCheck(migrationSql, name)).toBe(true);
    }
  });

  it('rate costType CHECK matches the canonical COST_TYPES (incl. DOWNTIME)', () => {
    const c = parseCheckConstraints(migrationSql).find((x) => x.constraintName === 'operational_cost_rates_cost_type_ck')!;
    expect(c.column).toBe('costType');
    expectSameSet(c.values, COST_TYPES, 'rate costType');
  });

  it('snapshot costType CHECK matches the canonical COST_TYPES (incl. DOWNTIME)', () => {
    const c = parseCheckConstraints(migrationSql).find((x) => x.constraintName === 'operational_standard_cost_snapshots_cost_type_ck')!;
    expect(c.column).toBe('costType');
    expectSameSet(c.values, COST_TYPES, 'snapshot costType');
  });

  it('transaction eventType CHECK matches the canonical COST_TYPES (incl. DOWNTIME)', () => {
    const c = parseCheckConstraints(migrationSql).find((x) => x.constraintName === 'operational_cost_transactions_event_type_ck')!;
    expect(c.column).toBe('eventType');
    expectSameSet(c.values, COST_TYPES, 'transaction eventType');
  });

  it('transaction sourceType CHECK matches the complete operational ledger vocabulary', () => {
    const c = parseCheckConstraints(laborMigrationSql).find((x) => x.constraintName === 'operational_cost_transactions_source_type_ck')!;
    expect(c.column).toBe('sourceType');
    expectSameSet(c.values, OPERATIONAL_LEDGER_SOURCE_TYPES, 'transaction sourceType');
  });

  it('COST-R2B ledger unit CHECK matches the ledger-only unit contract', () => {
    const c = parseCheckConstraints(laborMigrationSql).find((x) => x.constraintName === 'operational_cost_transactions_unit_ck')!;
    expect(c.column).toBe('unit');
    expectSameSet(c.values, COST_TRANSACTION_UNITS, 'transaction unit');
  });

  it('COST-R2B migration is one trusted constraint-only extension with no NOCHECK', () => {
    expect(laborMigrationSql).not.toMatch(/WITH\s+NOCHECK/i);
    expect(laborMigrationSql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
    for (const name of [
      'operational_cost_transactions_source_type_ck',
      'operational_cost_transactions_unit_ck',
      'operational_cost_transactions_rate_ck',
      'operational_cost_transactions_quantity_sign_ck',
    ]) {
      expect(laborMigrationSql).toMatch(new RegExp(`WITH\\s+CHECK\\s+ADD\\s+CONSTRAINT\\s+\\[${name}\\]`, 'i'));
      expect(laborMigrationSql).toMatch(new RegExp(`CHECK\\s+CONSTRAINT\\s+\\[${name}\\]`, 'i'));
    }
  });

  it('COST-R2C-B eventType CHECK matches the complete ledger event vocabulary', () => {
    const c = parseCheckConstraints(externalServiceMigrationSql)
      .find((x) => x.constraintName === 'operational_cost_transactions_event_type_ck')!;
    expect(c.column).toBe('eventType');
    expectSameSet(c.values, OPERATIONAL_LEDGER_EVENT_TYPES, 'transaction eventType');
  });

  it('COST-R2C-B is a trusted constraint-only migration with no data or history writes', () => {
    expect(externalServiceMigrationSql).not.toMatch(/WITH\s+NOCHECK/i);
    expect(externalServiceMigrationSql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
    expect(externalServiceMigrationSql).not.toMatch(/_prisma_migrations/i);
    for (const name of [
      'operational_cost_transactions_event_type_ck',
      'operational_cost_transactions_rate_ck',
      'operational_cost_transactions_quantity_sign_ck',
      'operational_cost_transactions_external_service_shape_ck',
    ]) {
      expect(externalServiceMigrationSql).toMatch(new RegExp(`WITH\\s+CHECK\\s+ADD\\s+CONSTRAINT\\s+\\[${name}\\]`, 'i'));
      expect(externalServiceMigrationSql).toMatch(new RegExp(`CHECK\\s+CONSTRAINT\\s+\\[${name}\\]`, 'i'));
    }
  });

  it('COST-R2C-B narrowly requires the source, amount unit and zero quantity/rate shape', () => {
    const shape = externalServiceMigrationSql.match(
      /ADD CONSTRAINT \[operational_cost_transactions_external_service_shape_ck\] CHECK\s*\(([\s\S]*?)\);/i,
    )?.[1] ?? '';
    expect(shape).toContain("[eventType] <> N'EXTERNAL_SERVICE'");
    expect(shape).toContain("[sourceType] = N'MAINTENANCE_WORK_ORDER_COST_ENTRY'");
    expect(shape).toContain("[costNature] = N'MANUAL_ASSERTED_ACTUAL'");
    expect(shape).toContain("[costPurpose] = N'MAINTENANCE'");
    expect(shape).toContain("[unit] = N'AMOUNT'");
    expect(shape).toContain('[quantity] = (0)');
    expect(shape).toContain('[rate] = (0)');
  });

  it('calculation scopeType CHECK matches the canonical COST_CALCULATION_SCOPE_TYPES (incl. BRANCH)', () => {
    const c = parseCheckConstraints(migrationSql).find((x) => x.constraintName === 'operational_cost_calculations_scope_type_ck')!;
    expect(c.column).toBe('scopeType');
    expectSameSet(c.values, COST_CALCULATION_SCOPE_TYPES, 'calculation scopeType');
  });
});

// Section 18 — DOWNTIME / standard cost-type source validity (source authority).
describe('ProductionCost canonical source value contract', () => {
  it('A. DOWNTIME is a valid cost type', () => expect(COST_TYPES).toContain('DOWNTIME'));
  it('B. DOWNTIME is a valid source type', () => expect(COST_TRANSACTION_SOURCE_TYPES).toContain('DOWNTIME'));
  it('C. DOWNTIME is a valid transaction event type (DOWNTIME is a cost type)', () => expect(COST_TYPES).toContain('DOWNTIME'));
  it('D. DOWNTIME is a valid transaction sourceType', () => expect(COST_TRANSACTION_SOURCE_TYPES).toContain('DOWNTIME'));
  it('E. DOWNTIME reversal remains valid (REVERSAL is a source type)', () => expect(COST_TRANSACTION_SOURCE_TYPES).toContain('REVERSAL'));
  it('F. MATERIAL remains valid', () => expect(COST_TYPES).toContain('MATERIAL'));
  it('G. LABOR remains valid', () => expect(COST_TYPES).toContain('LABOR'));
  it('H. MACHINE remains valid', () => expect(COST_TYPES).toContain('MACHINE'));
  it('I. OVERHEAD remains valid', () => expect(COST_TYPES).toContain('OVERHEAD'));
  it('J. invalid random cost type remains rejected by the canonical set', () => {
    expect(COST_TYPES).not.toContain('BOGUS_COST_TYPE');
  });
  it('K. invalid random transaction source type remains rejected by the canonical set', () => {
    expect(COST_TRANSACTION_SOURCE_TYPES).not.toContain('BOGUS_SOURCE_TYPE');
  });
  it('all legacy and canonical documented source types are present in the ledger vocabulary', () => {
    expect(OPERATIONAL_LEDGER_SOURCE_TYPES).toEqual(expect.arrayContaining([
      'PRODUCTION_ORDER', 'PRODUCTION_RUN', 'OUTPUT_EVENT', 'FG_RECEIPT',
      'MATERIAL_DOCUMENT', 'QUALITY_DISPOSITION', 'DOWNTIME', 'REVERSAL', 'MANUAL',
      'INVENTORY_MOVEMENT_LINE', 'DOWNTIME_EVENT', 'MAINTENANCE_WORK_ORDER_COST_ENTRY',
    ]));
  });

  it('adapter-only canonical sources cannot be submitted through the generic posting DTO', () => {
    expect(COST_TRANSACTION_SOURCE_TYPES).not.toContain('INVENTORY_MOVEMENT_LINE');
    expect(COST_TRANSACTION_SOURCE_TYPES).not.toContain('DOWNTIME_EVENT');
    expect(COST_TRANSACTION_SOURCE_TYPES).not.toContain('MAINTENANCE_WORK_ORDER_COST_ENTRY');
  });
});

// Section 19 — BRANCH / ORDER / RUN calculation scope validity (source authority).
describe('ProductionCost calculation scope source contract', () => {
  it('A. BRANCH is a supported calculation scope', () => expect(COST_CALCULATION_SCOPE_TYPES).toContain('BRANCH'));
  it('B. ORDER remains a supported calculation scope', () => expect(COST_CALCULATION_SCOPE_TYPES).toContain('ORDER'));
  it('C. RUN remains a supported calculation scope', () => expect(COST_CALCULATION_SCOPE_TYPES).toContain('RUN'));
  it('D. invalid scope is rejected by the canonical set', () => {
    expect(COST_CALCULATION_SCOPE_TYPES).not.toContain('BOGUS_SCOPE');
  });
});
