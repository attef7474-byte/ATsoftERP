import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import {
  INVENTORY_VALUATION_PERMISSION_KEYS,
  INVENTORY_VALUATION_POLICY_ACTIONS,
  INVENTORY_VALUATION_AUDIT_ENTITY_POLICY,
  INVENTORY_VALUATION_AUDIT_ENTITY_INITIALIZATION,
} from './inventory-valuation.constants';
import { INVENTORY_VALUATION_PERMISSIONS } from '../../../../prisma/seed/seed-inventory-valuation-permission-keys';

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

describe('VAL-R1B migration-contract guard', () => {
  const sql = findMigrationSql('inventory_valuation_r1b_monetary_input');

  it('A: opening-balance lines gain nullable unitCost/currencyCode/valuationReason cost columns', () => {
    expect(sql).toMatch(/ALTER TABLE \[dbo\]\.\[inventory_opening_balance_lines\] ADD/i);
    expect(sql).toMatch(/\[unitCost\] DECIMAL\(19,6\),/);
    expect(sql).toMatch(/\[currencyCode\] NVARCHAR\(1000\),/);
    expect(sql).toMatch(/\[valuationReason\] NVARCHAR\(1000\)[;,]/);
  });

  it('B: operational-receipt lines gain nullable unitCost/currencyCode/valuationReason cost columns', () => {
    expect(sql).toMatch(/ALTER TABLE \[dbo\]\.\[inventory_operational_receipt_lines\] ADD/i);
    expect(sql).toMatch(/\[unitCost\] DECIMAL\(19,6\),/);
    expect(sql).toMatch(/\[currencyCode\] NVARCHAR\(1000\),/);
    expect(sql).toMatch(/\[valuationReason\] NVARCHAR\(1000\)[;,]/);
  });

  it('C: initialization evidence table is created with the exact monetary columns + currency must be non-empty', () => {
    const table = sql.match(/CREATE TABLE \[dbo\]\.\[inventory_valuation_initializations\][\s\S]*?\);/)![0];
    expect(table).toMatch(/\[id\] NVARCHAR\(1000\) NOT NULL/);
    expect(table).toMatch(/\[companyId\] NVARCHAR\(1000\) NOT NULL/);
    expect(table).toMatch(/\[warehouseId\] NVARCHAR\(1000\) NOT NULL/);
    expect(table).toMatch(/\[productId\] NVARCHAR\(1000\) NOT NULL/);
    expect(table).toMatch(/\[policyId\] NVARCHAR\(1000\) NOT NULL/);
    expect(table).toMatch(/\[quantitySnapshot\] DECIMAL\(18,4\) NOT NULL/);
    expect(table).toMatch(/\[unitCost\] DECIMAL\(19,6\) NOT NULL/);
    expect(table).toMatch(/\[totalValue\] DECIMAL\(19,4\) NOT NULL/);
    expect(table).toMatch(/\[currencyCode\] NVARCHAR\(1000\) NOT NULL/);
    expect(table).toMatch(/\[reason\] NVARCHAR\(1000\),/);
    expect(table).toMatch(/\[createdById\] NVARCHAR\(1000\),/);
  });

  it('D: initialization unique idempotency guard exists for company+warehouse+product', () => {
    expect(sql).toMatch(/inventory_valuation_initializations_companyId_warehouseId_productId_key/);
  });

  it('E: initialization table is tenant-scoped with FKs to company, warehouse, product, policy and user', () => {
    expect(sql).toMatch(/inventory_valuation_initializations_companyId_fkey/);
    expect(sql).toMatch(/inventory_valuation_initializations_warehouseId_fkey/);
    expect(sql).toMatch(/inventory_valuation_initializations_productId_fkey/);
    expect(sql).toMatch(/inventory_valuation_initializations_policyId_fkey/);
    expect(sql).toMatch(/inventory_valuation_initializations_createdById_fkey/);
  });

  it('F: CHECK constraints are ENABLED and TRUSTED (WITH CHECK ADD + CHECK CONSTRAINT)', () => {
    const checks = [
      'inventory_valuation_initializations_quantitySnapshot_ck',
      'inventory_valuation_initializations_unitCost_ck',
      'inventory_valuation_initializations_totalValue_ck',
      'inventory_opening_balance_lines_unitCost_ck',
      'inventory_opening_balance_lines_currencyCode_ck',
      'inventory_operational_receipt_lines_unitCost_ck',
      'inventory_operational_receipt_lines_currencyCode_ck',
    ];
    for (const c of checks) {
      expect(sql).toMatch(new RegExp(`WITH CHECK ADD CONSTRAINT \\[${c}\\]`, 'i'));
      expect(sql).toMatch(new RegExp(`CHECK CONSTRAINT \\[${c}\\]`, 'i'));
      expect(sql).not.toMatch(new RegExp(`WITH NOCHECK.*\\[${c}\\]`, 'i'));
    }
  });

  it('G: initialization migration performs no backfill of valuation rows and no movement writes', () => {
    expect(sql).not.toMatch(/INSERT\s+INTO\s+\[?dbo\]?\.?\[?inventory_valuation_initializations\]?/i);
    expect(sql).not.toMatch(/INSERT\s+INTO\s+\[?dbo\]?\.?\[?inventory_valuation_balances\]?/i);
    expect(sql).not.toMatch(/UPDATE\s+\[?dbo\]?\.?\[?inventory_movement_lines\]?/i);
    expect(sql).not.toMatch(/_prisma_migrations/i);
  });

  it('H: migration is wrapped in a transactional BEGIN TRY / COMMIT / ROLLBACK block', () => {
    expect(sql).toMatch(/BEGIN TRY/i);
    expect(sql).toMatch(/ROLLBACK TRAN/i);
    expect(sql).toMatch(/END TRY/i);
    expect(sql).toMatch(/END CATCH/i);
  });

  it('I: seeded permissions in lock-step with the module constants', () => {
    const keys = INVENTORY_VALUATION_PERMISSIONS.map((p) => p.key).sort();
    expect(keys).toEqual(
      [
        INVENTORY_VALUATION_PERMISSION_KEYS.read,
        INVENTORY_VALUATION_PERMISSION_KEYS.costInput,
        INVENTORY_VALUATION_PERMISSION_KEYS.initialize,
        INVENTORY_VALUATION_PERMISSION_KEYS.activate,
      ].sort(),
    );
    expect(keys).toContain('inventory-valuation:activate');
    // unique
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('J: audit action/entity constants are defined and non-empty', () => {
    expect(Object.keys(INVENTORY_VALUATION_POLICY_ACTIONS)).toEqual([
      'policyCreate',
      'policyUpdate',
      'policyInitializationStart',
      'openingCostInput',
      'receiptCostInput',
      'legacyValuationInitialize',
      'policyActivate',
    ]);
    expect(INVENTORY_VALUATION_AUDIT_ENTITY_POLICY).toBe('InventoryValuationPolicy');
    expect(INVENTORY_VALUATION_AUDIT_ENTITY_INITIALIZATION).toBe('InventoryValuationInitialization');
    for (const v of Object.values(INVENTORY_VALUATION_POLICY_ACTIONS)) {
      expect(v.length).toBeGreaterThan(0);
    }
  });
});
