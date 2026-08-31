import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import {
  INVENTORY_VALUATION_METHODS,
  INVENTORY_VALUATION_METHOD_DEFAULT,
  INVENTORY_VALUATION_POLICY_STATUSES,
  INVENTORY_VALUATION_POLICY_STATUS_DEFAULT,
} from './inventory-valuation.constants';

const repoRoot = join(__dirname, '..', '..', '..', '..');
const migrationsRoot = join(repoRoot, 'prisma', 'migrations');

function findMigrationSql(namePart: string): string {
  const dir = readdirSync(migrationsRoot).find(
    (entry) => entry.includes(namePart) && entry.startsWith('2026'),
  );
  if (!dir) {
    throw new Error(`Migration directory containing '${namePart}' not found in ${migrationsRoot}`);
  }
  return readFileSync(join(migrationsRoot, dir, 'migration.sql'), 'utf8');
}

describe('VAL-R1A migration-contract guard', () => {
  const sql = findMigrationSql('inventory_valuation_r1a_foundation');

  it('A: policy method source constants match the SQL CHECK method values', () => {
    const check = sql.match(/inventory_valuation_policies_method_ck[^;]*?IN\s*\(([^)]*)\)/is);
    expect(check).toBeDefined();
    const sqlValues = (check![1].match(/N'([^']+)'/g) || []).map((v) => v.slice(2, -1));
    expect(sqlValues).toEqual([...INVENTORY_VALUATION_METHODS]);
  });

  it('B: policy status source constants match the SQL CHECK status values', () => {
    const check = sql.match(/inventory_valuation_policies_status_ck[^;]*?IN\s*\(([^)]*)\)/is);
    expect(check).toBeDefined();
    const sqlValues = (check![1].match(/N'([^']+)'/g) || []).map((v) => v.slice(2, -1));
    expect(sqlValues).toEqual([...INVENTORY_VALUATION_POLICY_STATUSES]);
  });

  it('C: currencyCode has no hardcoded USD/SAR database default', () => {
    const table = sql.match(/CREATE TABLE \[dbo\]\.\[inventory_valuation_policies\][\s\S]*?\);/)![0];
    const curLine = table.split('\n').find((l) => l.includes('[currencyCode]'));
    expect(curLine).toBeDefined();
    expect(curLine).toMatch(/\[currencyCode\] NVARCHAR\(1000\) NOT NULL,\s*$/);
    expect(curLine).not.toMatch(/DEFAULT/i);
    expect(curLine).not.toMatch(/USD|SAR/i);
    expect(INVENTORY_VALUATION_METHOD_DEFAULT).toBe('WEIGHTED_AVERAGE');
    expect(INVENTORY_VALUATION_POLICY_STATUS_DEFAULT).toBe('DRAFT');
  });

  it('D: movement monetary snapshot columns are nullable', () => {
    const moveAdd = sql.match(/ALTER TABLE \[dbo\]\.\[inventory_movement_lines\] ADD[\s\S]*?;/i)![0];
    expect(moveAdd).toMatch(/\[currencyCode\] NVARCHAR\(1000\),/);
    expect(moveAdd).toMatch(/\[totalCost\] DECIMAL\(19,4\),/);
    expect(moveAdd).toMatch(/\[unitCost\] DECIMAL\(19,6\),/);
    expect(moveAdd).toMatch(/\[valuationMethod\] NVARCHAR\(1000\);/);
    // nullable => the movement ADD block carries no NOT NULL modifiers
    expect(moveAdd).not.toMatch(/NOT NULL/i);
  });

  it('E: opening quantityBase is nullable', () => {
    expect(sql).toMatch(/ALTER TABLE \[dbo\]\.\[inventory_opening_balance_lines\] ADD \[quantityBase\] DECIMAL\(18,4\);/);
  });

  it('F: operational receipt quantityBase is nullable', () => {
    expect(sql).toMatch(/ALTER TABLE \[dbo\]\.\[inventory_operational_receipt_lines\] ADD \[quantityBase\] DECIMAL\(18,4\);/);
  });

  it('G: unique keys match the accepted contract exactly', () => {
    expect(sql).toMatch(/CONSTRAINT \[inventory_valuation_policies_companyId_warehouseId_key\] UNIQUE NONCLUSTERED \(\[companyId\],\[warehouseId\]\)/);
    expect(sql).toMatch(/CONSTRAINT \[inventory_valuation_balances_companyId_warehouseId_productId_key\] UNIQUE NONCLUSTERED \(\[companyId\],\[warehouseId\],\[productId\]\)/);
  });

  it('G-tenant: policy has tenant FKs to company, warehouse and audit users', () => {
    expect(sql).toMatch(/inventory_valuation_policies_companyId_fkey/);
    expect(sql).toMatch(/inventory_valuation_policies_warehouseId_fkey/);
    expect(sql).toMatch(/inventory_valuation_policies_activatedById_fkey/);
    expect(sql).toMatch(/inventory_valuation_policies_initializedById_fkey/);
    expect(sql).toMatch(/inventory_valuation_policies_createdById_fkey/);
    expect(sql).toMatch(/inventory_valuation_policies_updatedById_fkey/);
    expect(sql).toMatch(/inventory_valuation_balances_companyId_fkey/);
    expect(sql).toMatch(/inventory_valuation_balances_warehouseId_fkey/);
    expect(sql).toMatch(/inventory_valuation_balances_productId_fkey/);
  });

  it('H: migration performs no INSERT into the new valuation tables (no backfill / no seeding)', () => {
    const insertBlock = sql.match(/INSERT\s+INTO\s+\[?dbo\]?\.?\[?inventory_valuation_(policies|balances)\]?/i);
    expect(insertBlock).toBeNull();
    // the only 'ACTIVE' references are within the status CHECK constraint definition
    // and the explanatory comment, never an INSERT row value
    expect(sql).not.toMatch(/INSERT/i);
    // no monetary backfill into movement lines
    expect(sql).not.toMatch(/UPDATE\s+\[?dbo\]?\.?\[?inventory_movement_lines\]?/i);
  });

  it('I: migration contains no manual _prisma_migrations insert', () => {
    expect(sql).not.toMatch(/_prisma_migrations/i);
  });

  it('CHECK constraints are created ENABLED and TRUSTED (WITH CHECK ADD + CHECK CONSTRAINT)', () => {
    const checks = ['inventory_valuation_policies_method_ck', 'inventory_valuation_policies_status_ck', 'inventory_movement_lines_valuation_method_ck'];
    for (const c of checks) {
      expect(sql).toMatch(new RegExp(`WITH CHECK ADD CONSTRAINT \\[${c}\\]`, 'i'));
      expect(sql).toMatch(new RegExp(`CHECK CONSTRAINT \\[${c}\\]`, 'i'));
      expect(sql).not.toMatch(new RegExp(`WITH NOCHECK.*\\[${c}\\]`, 'i'));
    }
  });

  it('migration is wrapped in a transactional BEGIN TRY / COMMIT / ROLLBACK block', () => {
    expect(sql).toMatch(/BEGIN TRY/i);
    expect(sql).toMatch(/BEGIN TRAN/i);
    expect(sql).toMatch(/COMMIT TRAN/i);
    expect(sql).toMatch(/ROLLBACK TRAN/i);
    expect(sql).toMatch(/END TRY/i);
    expect(sql).toMatch(/END CATCH/i);
  });
});
