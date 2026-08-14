import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..', '..');
const migrationsRoot = join(repoRoot, 'prisma', 'migrations');
const schemaPath = join(repoRoot, 'prisma', 'schema.prisma');

const DATED_MIGRATION = /^\d{14}_/;

interface DatedMigration {
  name: string;
  sql: string;
}

function listDatedMigrations(): DatedMigration[] {
  const out: DatedMigration[] = [];
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
 * Every table declared in schema.prisma (via @@map) must be created by a dated
 * migration. Historically 11 tables (machine_installed_parts, replacement
 * history, repair orders/actions, maintenance BOM versioning, preventive
 * spare-part planning, and spare-part condition balance/movement) were created
 * only by loose root-level .sql scripts that `prisma migrate deploy` never
 * executes, which broke fresh installs at 20260801120000. The compatibility
 * baseline 20260731000000 must keep those tables inside the dated chain.
 */
describe('migration chain integrity', () => {
  const schema = readFileSync(schemaPath, 'utf8');
  const mappedTables = [...schema.matchAll(/@@map\("([^"]+)"\)/g)]
    .map((m) => m[1])
    .sort();

  const migrations = listDatedMigrations();

  it('schema declares @@map tables', () => {
    expect(mappedTables.length).toBeGreaterThan(0);
    expect(new Set(mappedTables).size).toEqual(mappedTables.length);
  });

  it('dated migrations exist', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('every schema table is created by a dated migration (no loose-script reliance)', () => {
    const createdByDated = new Set<string>();
    for (const migration of migrations) {
      for (const match of migration.sql.matchAll(
        /CREATE\s+TABLE\s+(?:\[[^\]]+\]\.)?\[?([A-Za-z0-9_]+)\]?\s*(?:\(|$)/gi,
      )) {
        createdByDated.add(match[1]);
      }
    }

    const missing = mappedTables.filter((table) => !createdByDated.has(table));
    expect(missing).toEqual([]);
  });

  it('baseline migration restores the 11 historically loose tables in the dated chain', () => {
    const baseline = migrations.find((m) => m.name.includes('20260731000000'));
    expect(baseline).toBeDefined();

    const historicallyLoose = [
      'machine_installed_parts',
      'spare_part_replacement_histories',
      'spare_part_repair_orders',
      'spare_part_repair_actions',
      'maintenance_boms',
      'maintenance_bom_versions',
      'maintenance_bom_items',
      'preventive_spare_part_plans',
      'preventive_spare_part_plan_items',
      'spare_part_condition_balances',
      'spare_part_condition_movements',
    ];

    const missingFromBaseline = historicallyLoose.filter(
      (table) => !new RegExp(`CREATE\\s+TABLE\\s+(?:\\[[^\\]]+\\]\\.)?\\[?${table}\\]?`, 'i').test(baseline!.sql),
    );
    expect(missingFromBaseline).toEqual([]);
  });

  it('baseline migration sorts before the former blocker 20260801120000', () => {
    const names = migrations.map((m) => m.name);
    const baselineIdx = names.findIndex((n) => n.includes('20260731000000'));
    const blockerIdx = names.findIndex((n) => n.includes('20260801120000'));
    expect(baselineIdx).toBeGreaterThanOrEqual(0);
    expect(blockerIdx).toBeGreaterThan(baselineIdx);
  });

  it('dated migrations contain no GO batch separators (Prisma sends one batch)', () => {
    const violations = migrations
      .filter((m) => /(^|\r?\n)\s*GO\s*(\r?\n|$)/i.test(m.sql))
      .map((m) => m.name);
    expect(violations).toEqual([]);
  });

  it('baseline migration is idempotent (IF NOT EXISTS guards every table)', () => {
    const baseline = migrations.find((m) => m.name.includes('20260731000000'));
    expect(baseline).toBeDefined();
    const createCount = (baseline!.sql.match(/CREATE\s+TABLE/gi) || []).length;
    const guardCount = (baseline!.sql.match(/IF\s+NOT\s+EXISTS/gi) || []).length;
    expect(createCount).toBe(11);
    expect(guardCount).toBe(11);
  });
});
