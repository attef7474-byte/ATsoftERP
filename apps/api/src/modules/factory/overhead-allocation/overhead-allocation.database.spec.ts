import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { COST_PURPOSE_VALUES } from '../../../common/cost-purpose/cost-purpose.constants';
import { seedOverheadAllocationPermissions } from '../../../../prisma/seed/seed-overhead-allocation-permissions';

const prismaDir = resolve(__dirname, '../../../../prisma');
const sql = readFileSync(resolve(prismaDir, 'migrations/20260915010000_cost_r2d_b2_allocation_engine/migration.sql'), 'utf8').replace(/--[^\n]*/g, '');
const tables = [...sql.matchAll(/CREATE TABLE \[dbo\]\.\[([^\]]+)\] \(([\s\S]*?)\n\);/g)];
const columns = new Map(tables.map(([, name, body]) => [name, new Map([...body.matchAll(/^\s+\[([^\]]+)\]\s+(NVARCHAR\(\d+\)|DATETIME2\(7\)|DECIMAL\(\d+,4\)|INT)\s+(NOT NULL|NULL)/gm)].map(([, field, type]) => [field, type]))]));
const width = (type: string | undefined) => type?.startsWith('NVARCHAR') ? Number(type.match(/\d+/)![0]) * 2 : type === 'DATETIME2(7)' ? 8 : type === 'INT' ? 4 : Infinity;

describe('B2 additive SQL contract (physical catalog proof is separate)', () => {
  it('creates exactly three B2 tables and fifty columns', () => {
    expect(tables.map(row => row[1])).toEqual(['operational_overhead_period_allocations', 'operational_overhead_allocation_lines', 'operational_overhead_allocation_sources']);
    expect([...columns.values()].reduce((sum, values) => sum + values.size, 0)).toBe(50);
  });
  it('every clustered PK and every nonclustered key is fully accounted and safe', () => {
    let keys = 0;
    for (const [, table, body] of tables) {
      for (const [, fields] of body.matchAll(/PRIMARY KEY CLUSTERED \(([^)]+)\)/g)) {
        const bytes = [...fields.matchAll(/\[([^\]]+)\]/g)].reduce((sum, field) => sum + width(columns.get(table)?.get(field[1])), 0);
        expect(bytes).toBe(400); expect(bytes).toBeLessThanOrEqual(900); keys++;
      }
    }
    const actual: Record<string, number> = {};
    for (const [, name, table, fields] of sql.matchAll(/CREATE (?:UNIQUE )?NONCLUSTERED INDEX \[([^\]]+)\] ON \[dbo\]\.\[([^\]]+)\] \(([^)]+)\)/g)) {
      actual[name] = [...fields.matchAll(/\[([^\]]+)\]/g)].reduce((sum, field) => sum + width(columns.get(table)?.get(field[1])), 0);
      expect(actual[name]).toBeLessThanOrEqual(1700); keys++;
    }
    expect(actual).toEqual({ ohoa_period_uq: 400, ohoa_request_uq: 1200, ohoa_scope_ix: 828, ohol_target_purpose_uq: 860, ohos_allocation_ix: 800 });
    expect(keys).toBe(8);
  });
  it('all fourteen FKs preserve exact bounded or legacy parent widths and NoAction', () => {
    // Explicit individually verified historical/catalog authorities, not a generic external-parent width assumption.
    const parents: Record<string, string> = {
      companies: 'NVARCHAR(1000)', branches: 'NVARCHAR(1000)', cost_centers: 'NVARCHAR(1000)', production_runs: 'NVARCHAR(1000)',
      production_run_cost_snapshots: 'NVARCHAR(191)', operational_overhead_periods: 'NVARCHAR(200)', operational_overhead_entries: 'NVARCHAR(200)',
    };
    const snapshotMigration = readFileSync(resolve(prismaDir, 'migrations/20260902000001_production_run_cost_snapshot/migration.sql'), 'utf8');
    expect(snapshotMigration).toMatch(/\[id\]\s+NVARCHAR\(191\)\s+NOT NULL/);
    let count = 0;
    for (const [, table, body] of tables) {
      for (const [, field, parent, parentField] of body.matchAll(/FOREIGN KEY \(\[([^\]]+)\]\) REFERENCES \[dbo\]\.\[([^\]]+)\] \(\[([^\]]+)\]\) ON DELETE NO ACTION ON UPDATE NO ACTION/g)) {
        const expected = columns.get(parent)?.get(parentField) ?? parents[parent];
        expect(expected).toBeDefined();
        expect(columns.get(table)?.get(field)).toBe(expected); count++;
      }
    }
    expect(count).toBe(14);
  });
  it('all eighteen required CHECKs are added WITH CHECK and explicitly enabled', () => {
    const checks = [...sql.matchAll(/WITH CHECK ADD CONSTRAINT \[([^\]]+)\] CHECK/g)];
    expect(checks).toHaveLength(18);
    checks.forEach(([, name]) => expect(sql).toContain(`CHECK CONSTRAINT [${name}]`));
    expect(sql).not.toMatch(/NOCHECK|DISABLE/i);
  });
  it('all eight exact mirrors reject overflow, differing lengths and differing binary identity', () => {
    let mirrors = 0;
    for (const [, , body] of tables) {
      for (const [, field] of body.matchAll(/\[([^\]]+Key)\] NVARCHAR\(200\)/g)) {
        const source = field.replace(/Key$/, 'Id');
        expect(sql).toContain(`DATALENGTH([${source}]) <= 400`);
        expect(sql).toContain(`DATALENGTH([${field}]) = DATALENGTH([${source}])`);
        expect(sql).toContain(`[${field}] COLLATE Latin1_General_100_BIN2 = [${source}] COLLATE Latin1_General_100_BIN2`);
        mirrors++;
      }
    }
    expect(mirrors).toBe(8);
  });
  it('pins sign, driver, currency, lifecycle, metadata and canonical purpose rules', () => {
    expect(sql).toContain('[allocatedAmount] > 0 AND [poolAmount] > 0');
    expect(sql).toContain('[driverQuantity] > 0 AND [totalDriver] >= [driverQuantity]');
    expect(sql).toContain("[driverType] = 'FINAL_GOOD_OUTPUT_QUANTITY'");
    expect(sql).toContain("[status] IN ('DRAFT','FINAL')");
    expect(sql).toContain("[status]='FINAL' AND [finalizedAt] IS NOT NULL AND [finalizedById] IS NOT NULL");
    expect(sql).toContain('DATALENGTH([currencyCode]) = 6');
    const values = sql.match(/ohol_purpose_ck\] CHECK \(\[costPurpose\] IN \(([^)]+)\)/)![1].replace(/'/g, '').split(',');
    expect(values.sort()).toEqual([...COST_PURPOSE_VALUES].sort());
  });
  it('has exact period, request, target-purpose and source uniqueness without hash identity', () => {
    expect(sql).toContain('[ohoa_period_uq] ON [dbo].[operational_overhead_period_allocations] ([periodId])');
    expect(sql).toContain('([companyKey], [branchKey], [clientRequestId])');
    expect(sql).toContain('([allocationId], [productionRunKey], [costPurpose])');
    expect(sql).toContain('[ohos_pk] PRIMARY KEY CLUSTERED ([sourceEntryId])');
    expect(sql).not.toMatch(/HASHBYTES|CHECKSUM/i);
  });
  it('is transactional, additive and contains no B1/history DML or B3 objects', () => {
    expect(sql).toMatch(/SET XACT_ABORT ON;[\s\S]*BEGIN TRY[\s\S]*BEGIN TRANSACTION/);
    expect(sql).toMatch(/ROLLBACK TRANSACTION;\s+THROW;/);
    expect(sql).not.toMatch(/INSERT INTO|DELETE FROM|TRUNCATE|DROP TABLE|_prisma_migrations|operational_cost_transactions|\bMERGE\b/i);
    for (const [, table] of sql.matchAll(/ALTER TABLE \[dbo\]\.\[([^\]]+)\]/g)) expect(columns.has(table)).toBe(true);
    expect(tables[2][2]).not.toMatch(/amount|costPurpose|status/);
  });
  it.each([
    ['20260904125100_mig_prov_r1_key_safety_hardening_a_add_bounded_mirror_columns', '65AF411D606810CD696811C4F917A87AAEA1EF9F3E1406465EB68877BC4E0B68'],
    ['20260904125200_mig_prov_r1_key_safety_hardening_b_apply_bounded_mirror_keys', '2EDE9D7A7BDEE19134CE210D6A9B7D943AFE2E70EBBA78430A66DC2DA7E53F81'],
    ['20260904130000_cost_r2d_b1_overhead_source_period_foundation', 'D4CE041F2C9D967950A9E0F0656E133EE7DBFAC5E3D56AD0E10794403FE66A0E'],
  ])('preserves previously applied migration %s byte-for-byte', (name, hash) => {
    expect(createHash('sha256').update(readFileSync(resolve(prismaDir, 'migrations', name, 'migration.sql'))).digest('hex').toUpperCase()).toBe(hash);
  });
});

describe('B2 narrow idempotent permission seed', () => {
  it.each([null, { id: 'existing-super-admin' }])('only upserts five definitions and existing-role links: %j', async role => {
    const tx = { role: { findFirst: jest.fn().mockResolvedValue(role) }, permission: { upsert: jest.fn().mockImplementation(args => ({ id: args.where.key })) }, rolePermission: { upsert: jest.fn() } };
    const db = { $transaction: jest.fn(work => work(tx)) };
    for (let attempt = 0; attempt < 2; attempt++) expect(await seedOverheadAllocationPermissions(db as any)).toEqual({ permissionCount: 5, existingSuperAdminAssigned: !!role });
    expect(tx.permission.upsert).toHaveBeenCalledTimes(10);
    expect(tx.rolePermission.upsert).toHaveBeenCalledTimes(role ? 10 : 0);
    for (const [args] of tx.permission.upsert.mock.calls) expect(args.where.key).toMatch(/^production-cost-overhead-allocation:(read|create|update|calculate|finalize)$/);
  });
});
