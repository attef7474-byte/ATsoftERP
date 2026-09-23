import { readFileSync } from 'fs';
import { join } from 'path';

const migrationSql = readFileSync(
  join(__dirname, '..', '..', '..', 'prisma', 'migrations', '20260923000000_repair_widen_audit_details', 'migration.sql'),
  'utf8',
);

describe('repair D2b: audit_logs.details width', () => {
  it('widens audit_logs.details to NVARCHAR(MAX) to match the declared String? model', () => {
    expect(migrationSql).toMatch(
      /ALTER\s+TABLE\s+\[dbo\]\.\[audit_logs\]\s+ALTER\s+COLUMN\s+\[details\]\s+NVARCHAR\(MAX\)\s+NULL/i,
    );
  });

  it('performs no row mutation (existing audit values are preserved untouched)', () => {
    expect(/INSERT\s+INTO/i.test(migrationSql)).toBe(false);
    expect(/^\s*UPDATE\b/i.test(migrationSql)).toBe(false);
    expect(/DELETE\s+FROM/i.test(migrationSql)).toBe(false);
    expect(/DROP\s+TABLE/i.test(migrationSql)).toBe(false);
  });

  it('stays inside a single transaction with a guard so a failed batch rolls back', () => {
    expect(migrationSql).toMatch(/BEGIN\s+TRY/i);
    expect(migrationSql).toMatch(/BEGIN\s+TRAN/i);
    expect(migrationSql).toMatch(/COMMIT\s+TRAN/i);
    expect(migrationSql).toMatch(/ROLLBACK\s+TRAN/i);
    expect(/GO\b/i.test(migrationSql)).toBe(false);
  });
});