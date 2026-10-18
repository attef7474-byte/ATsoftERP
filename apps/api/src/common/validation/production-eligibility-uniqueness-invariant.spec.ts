import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..', '..');
const migrationsRoot = join(repoRoot, 'prisma', 'migrations');
const schemaPath = join(repoRoot, 'prisma', 'schema.prisma');
const servicePath = join(
  repoRoot,
  'src',
  'modules',
  'factory',
  'production-master-data',
  'production-product-definitions.service.ts',
);

const DATED_MIGRATION = /^\d{14}_/;
const CORRECTIVE_MIGRATION = /fix_production_eligibility_uniqueness/;

const DEFECTIVE_CONSTRAINTS = [
  'production_eligibilities_productionProductId_resourceType_machineId_key',
  'production_eligibilities_productionProductId_resourceType_productionLineId_key',
];

const FILTERED_INDEXES = [
  {
    name: 'production_eligibilities_productionProductId_machineId_unique',
    columns: '([productionProductId], [machineId])',
    where: 'WHERE [machineId] IS NOT NULL',
  },
  {
    name: 'production_eligibilities_productionProductId_productionLineId_unique',
    columns: '([productionProductId], [productionLineId])',
    where: 'WHERE [productionLineId] IS NOT NULL',
  },
];

function listDatedMigrations(): { name: string; sql: string }[] {
  const out: { name: string; sql: string }[] = [];
  for (const entry of readdirSync(migrationsRoot)) {
    if (!DATED_MIGRATION.test(entry)) continue;
    const migrationSql = join(migrationsRoot, entry, 'migration.sql');
    try {
      statSync(migrationSql);
    } catch {
      continue;
    }
    out.push({ name: entry, sql: readFileSync(migrationSql, 'utf8') });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * SQL Server treats NULLs as equal in unique constraints, so the historical
 * unfiltered UNIQUE (productionProductId, resourceType, machineId) and
 * UNIQUE (productionProductId, resourceType, productionLineId) constraints
 * allowed at most one MACHINE and one LINE eligibility per product. The
 * corrected logical invariants are filtered unique indexes without resourceType
 * (machineId set <=> MACHINE, productionLineId set <=> LINE, enforced by the
 * service guard; both-populated = 0 and neither-populated = 0 are verified data
 * invariants). Prisma cannot express filtered indexes, so these tests are the
 * schema-proof that (a) the defective @@unique declarations stay removed from
 * schema.prisma, (b) the corrective migration drops exactly the two defective
 * constraints and creates exactly the two filtered unique indexes, and (c) the
 * application guard (P2002 -> 409) exists on both single and batch paths.
 */
describe('production eligibility uniqueness invariant (DB_GUARD + APP_GUARD)', () => {
  const schema = readFileSync(schemaPath, 'utf8');
  const service = readFileSync(servicePath, 'utf8');
  const migrations = listDatedMigrations();

  function eligibilityModelBlock(): string {
    const start = schema.indexOf('model ProductionEligibility {');
    expect(start).toBeGreaterThanOrEqual(0);
    const end = schema.indexOf('\n}', start);
    return schema.slice(start, end);
  }

  function correctiveMigration(): { name: string; sql: string } {
    const matches = migrations.filter((m) => CORRECTIVE_MIGRATION.test(m.name));
    expect(matches.map((m) => m.name)).toEqual(['20261018120000_fix_production_eligibility_uniqueness']);
    return matches[0];
  }

  it('schema.prisma declares no @@unique on ProductionEligibility (defective keys stay removed)', () => {
    expect(eligibilityModelBlock()).not.toMatch(/@@unique\(/);
    expect(eligibilityModelBlock()).toContain('@@map("production_eligibilities")');
  });

  it('no dated migration re-creates the defective unfiltered unique constraints', () => {
    const violations = migrations
      .filter((m) => m.sql.includes('ADD CONSTRAINT [production_eligibilities_productionProductId_resourceType_'))
      .map((m) => m.name);
    expect(violations).toEqual([]);
  });

  it('corrective migration drops exactly the two defective constraints', () => {
    const { sql } = correctiveMigration();
    for (const constraint of DEFECTIVE_CONSTRAINTS) {
      expect(sql).toContain(`DROP CONSTRAINT [${constraint}]`);
    }
    const dropCount = (sql.match(/DROP CONSTRAINT/g) || []).length;
    expect(dropCount).toBe(DEFECTIVE_CONSTRAINTS.length);
  });

  it('corrective migration creates the two filtered unique indexes (no resourceType column)', () => {
    const { sql } = correctiveMigration();
    for (const index of FILTERED_INDEXES) {
      const pattern = new RegExp(
        `CREATE UNIQUE NONCLUSTERED INDEX \\[${index.name}\\]\\s+ON \\[dbo\\]\\.\\[production_eligibilities\\] ${index.columns.replace(/[[\]()]/g, '\\$&')}\\s+${index.where.replace(/[[\]()]/g, '\\$&').replace(/\s+/g, '\\s+')}`,
        'i',
      );
      expect(sql).toMatch(pattern);
    }
    expect(sql).not.toMatch(/\[productionProductId\],\s*\[resourceType\]/i);
  });

  it('corrective migration sorts after the table-creating migration and has no GO', () => {
    const { name, sql } = correctiveMigration();
    const creatorIdx = migrations.findIndex((m) => m.name.includes('20260803120000_add_production_master_data'));
    const correctiveIdx = migrations.findIndex((m) => m.name === name);
    expect(creatorIdx).toBeGreaterThanOrEqual(0);
    expect(correctiveIdx).toBeGreaterThan(creatorIdx);
    expect(/(^|\r?\n)\s*GO\s*(\r?\n|$)/i.test(sql)).toBe(false);
  });

  it('corrective migration runs guarded inside a transaction (BEGIN TRY/TRAN, THROW)', () => {
    const { sql } = correctiveMigration();
    expect(sql).toMatch(/BEGIN TRY/i);
    expect(sql).toMatch(/BEGIN TRAN/i);
    expect(sql).toMatch(/ROLLBACK TRAN/i);
    expect(sql).toMatch(/THROW;/i);
    expect(sql).toMatch(/IF EXISTS/i);
    expect(sql).toMatch(/IF NOT EXISTS/i);
  });

  it('application guard maps P2002 to 409 on both single and batch eligibility paths', () => {
    const p2002Guards = service.match(/error\.code === 'P2002'/g) || [];
    expect(p2002Guards.length).toBeGreaterThanOrEqual(2);
    const conflictThrows = service.match(/new ConflictException\(\{\s*messageKey: 'production\.eligibilityExists'/g) || [];
    expect(conflictThrows.length).toBeGreaterThanOrEqual(2);
  });
});
