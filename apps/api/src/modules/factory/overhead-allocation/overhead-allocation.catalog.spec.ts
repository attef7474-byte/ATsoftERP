import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const { assertForeignKeys, expectedFks, parentDdlStatements } = require('../../../../../../scripts/overhead-allocation-catalog-proof.cjs');
const root = resolve(__dirname, '../../../../../..');
const schema = readFileSync(join(root, 'apps/api/prisma/schema.prisma'), 'utf8');
const model = schema.match(/model ProductionRunCostSnapshot \{([\s\S]*?)\n\}/)![1];

function catalogRows() {
  return expectedFks.map(([name, child_table, child_column, parent_table, bytes]: any[]) => ({
    name, child_table, child_column, parent_table, parent_column: 'id',
    child_system_type_id: 231, parent_system_type_id: 231,
    child_max_length: bytes, parent_max_length: bytes,
    child_collation: 'Chinese_PRC_CI_AS', parent_collation: 'Chinese_PRC_CI_AS',
    is_disabled: false, is_not_trusted: false, delete_action: 'NO_ACTION', update_action: 'NO_ACTION',
  }));
}

describe('B2 executable catalog verifier regression (live invocation is a separate mandatory gate)', () => {
  it('accepts exactly the complete fourteen-FK metadata contract', () => {
    expect(assertForeignKeys(catalogRows())).toEqual({ fkCount: 14, fkWidthMismatchCount: 0, costSnapshotFkWidthMatch: 'PASS' });
  });
  it.each([
    ['child_max_length', 2000], ['parent_max_length', 2000], ['child_system_type_id', 167],
    ['parent_system_type_id', 167], ['child_collation', 'Latin1_General_100_BIN2'],
    ['parent_collation', 'Latin1_General_100_BIN2'], ['is_disabled', true], ['is_not_trusted', true],
    ['child_table', 'other'], ['child_column', 'other'], ['parent_table', 'other'], ['parent_column', 'other'],
    ['name', 'other'], ['delete_action', 'CASCADE'], ['update_action', 'CASCADE'],
  ])('rejects mismatched snapshot FK %s=%s', (field, value) => {
    const rows = catalogRows();
    const snapshot = rows.find((row: any) => row.name === 'ohol_costSnapshot_fk');
    snapshot[field] = value;
    expect(() => assertForeignKeys(rows)).toThrow();
  });
  it('rejects missing and duplicate relationships', () => {
    expect(() => assertForeignKeys(catalogRows().slice(1))).toThrow();
    const rows = catalogRows(); rows[0] = rows[1];
    expect(() => assertForeignKeys(rows)).toThrow();
  });
  it('does not misclassify the new child FK as parent drift', () => {
    expect(parentDdlStatements('ALTER TABLE [dbo].[operational_overhead_allocation_lines] ADD CONSTRAINT [ohol_costSnapshot_fk] FOREIGN KEY ([costSnapshotId]) REFERENCES [dbo].[production_run_cost_snapshots] ([id]);')).toEqual([]);
  });
  it.each([
    'ALTER TABLE [dbo].[production_run_cost_snapshots] ADD CONSTRAINT [df] DEFAULT GETUTCDATE() FOR [createdAt];',
    'ALTER TABLE [dbo].[production_run_cost_snapshots] ALTER COLUMN [id] NVARCHAR(1000);',
    "EXEC sp_rename N'dbo.production_run_cost_snapshots.old', N'new';",
    'CREATE INDEX [wrong] ON [dbo].[production_run_cost_snapshots] ([id]);',
    'DROP TABLE [dbo].[production_run_cost_snapshots];',
  ])('detects prohibited parent DDL: %s', sql => {
    expect(parentDdlStatements(sql)).toHaveLength(1);
  });
});

describe('Source-only immutable snapshot reconciliation', () => {
  it('preserves cuid and exact widths without a physical costBasis default', () => {
    expect(model).toMatch(/id\s+String\s+@id\(map: "pk_production_run_cost_snapshots"\)\s+@default\(cuid\(\)\)\s+@db.NVarChar\(191\)/);
    expect(model).toMatch(/currencyCode\s+String\s+@db.NVarChar\(10\)/);
    expect(model).toMatch(/costBasis\s+String\s+@db.NVarChar\(100\)\s*\n/);
    expect(schema).toMatch(/costSnapshotId\s+String\s+@db.NVarChar\(191\)/);
  });
  it('preserves named GETUTCDATE defaults, never CURRENT_TIMESTAMP substitutes', () => {
    for (const [field, name] of [['closedAt', 'closed_at'], ['createdAt', 'created_at']]) {
      expect(model).toContain(`@default(dbgenerated("GETUTCDATE()"), map: "df_production_run_cost_snapshots_${name}") @db.DateTime2`);
      expect(model).toMatch(new RegExp(`${field}\\s+DateTime\\s+@default`));
    }
    expect(model).not.toMatch(/@default\(now\(\)\)|CURRENT_TIMESTAMP/);
  });
  it('maps exact PK, unique, FK and ordinary index identities', () => {
    for (const name of ['pk_production_run_cost_snapshots', 'uq_production_run_cost_snapshots_run', 'uq_production_run_cost_snapshots_tenant_run', 'fk_production_run_cost_snapshots_company', 'fk_production_run_cost_snapshots_branch', 'fk_production_run_cost_snapshots_run', 'fk_production_run_cost_snapshots_product', 'ix_production_run_cost_snapshots_tenant', 'ix_production_run_cost_snapshots_run', 'ix_production_run_cost_snapshots_product']) expect(model).toContain(`map: "${name}"`);
    expect(model).toMatch(/productionRunId\s+String\s+@unique\(map: "uq_production_run_cost_snapshots_run"\)/);
    expect(model).toContain('@@unique([companyId, branchId, productionRunId], map: "uq_production_run_cost_snapshots_tenant_run")');
    expect(model).toContain('@@index([productionRunId], map: "ix_production_run_cost_snapshots_run")');
  });
  it('covers every current runtime snapshot writer with the explicit frozen costBasis and no update/delete path', () => {
    const files: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (/\.ts$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name)) files.push(file);
      }
    }
    walk(join(root, 'apps/api/src'));
    const writers = files.filter(file => /productionRunCostSnapshot\s*\.\s*(create|createMany|upsert)\s*\(/.test(readFileSync(file, 'utf8')));
    expect(writers).toEqual([join(root, 'apps/api/src/modules/factory/production-runs/production-runs.service.ts')]);
    const source = readFileSync(writers[0], 'utf8');
    const creates = [...source.matchAll(/productionRunCostSnapshot\.create\(\{\s*data:\s*\{([\s\S]*?)\n\s*\},/g)];
    expect(creates).toHaveLength(1);
    expect(creates[0][1]).toContain("costBasis: 'NET_ACTUAL_MATERIAL_VALUE_ONLY'");
    for (const file of files) expect(readFileSync(file, 'utf8')).not.toMatch(/productionRunCostSnapshot\s*\.\s*(update|updateMany|delete|deleteMany|upsert)\s*\(/);
  });
});
