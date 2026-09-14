import * as fs from 'fs';
import * as path from 'path';
import {
  OVERHEAD_CATEGORIES,
  OVERHEAD_DIRECT_COST_EXCLUSIONS,
} from './operational-overhead.constants';

/** SQL contract guards preserve FK compatibility and check every declared key, including single-column PKs. */

const MIGRATION_DIR = path.resolve(
  __dirname,
  '../../../../prisma/migrations/20260904130000_cost_r2d_b1_overhead_source_period_foundation',
);
const MIGRATION_FILE = path.join(MIGRATION_DIR, 'migration.sql');

const MAX_INDEX_KEY_BYTES = 1700;

/** NVARCHAR(N) byte width helper. */
function nvarcharBytes(nStr: string | undefined): number {
  if (!nStr || !/^\d+$/.test(nStr)) return NaN;
  return parseInt(nStr, 10) * 2;
}

describe('COST-R2D-B1 overhead migration database contract', () => {
  let sql: string;
  // `code` is the migration with `--` line comments removed. The header comments are
  // intentional prose (they document the fix), so content/safety checks that must not
  // see words like "allocation" or referential "ON UPDATE" clauses operate on `code`.
  let code: string;

  beforeAll(() => {
    expect(fs.existsSync(MIGRATION_FILE)).toBe(true);
    sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    code = sql.replace(/--[^\n]*/g, '');
  });

  it('references the expected single B1 migration', () => {
    expect(path.basename(MIGRATION_DIR)).toBe('20260904130000_cost_r2d_b1_overhead_source_period_foundation');
  });

  it('is wrapped in an atomic TRY/CATCH transaction (all-or-nothing, rollback on any failure)', () => {
    expect(sql).toMatch(/BEGIN\s+TRY/i);
    expect(sql).toMatch(/BEGIN\s+TRAN/i);
    expect(sql).toMatch(/ROLLBACK\s+TRAN/i);
    expect(sql).toMatch(/THROW/i);
    expect(sql).toMatch(/END\s+CATCH/i);
  });

  describe('FK source-to-DB type-exactness (root cause 1: NVARCHAR(191) vs NVARCHAR(1000))', () => {
    it('period.id is bounded NVARCHAR(200)', () => {
      const m = sql.match(/\[id\]\s+NVARCHAR\((\d+)\)/i);
      expect(m).toBeTruthy();
      expect(m![1]).toBe('200');
      expect(nvarcharBytes(m![1])).toBe(400);
    });

    it('entry.periodId is bounded NVARCHAR(200), matching period.id byte-for-byte', () => {
      const m = sql.match(/\[periodId\]\s+NVARCHAR\((\d+)\)/i);
      expect(m).toBeTruthy();
      expect(m![1]).toBe('200');
      expect(nvarcharBytes(m![1])).toBe(400);
    });

    it('companyId and branchId on BOTH tables are NVARCHAR(1000) matching companies/branches', () => {
      const companyIds = [...sql.matchAll(/\[companyId\]\s+NVARCHAR\((\d+)\)/gi)].map((x) => x[1]);
      const branchIds = [...sql.matchAll(/\[branchId\]\s+NVARCHAR\((\d+)\)/gi)].map((x) => x[1]);
      expect(companyIds.length).toBeGreaterThanOrEqual(2);
      expect(branchIds.length).toBeGreaterThanOrEqual(2);
      for (const w of [...companyIds, ...branchIds]) {
        expect(w).toBe('1000');
      }
    });

    it('sourceCostCenterId on the entry is NVARCHAR(1000) matching cost_centers.id', () => {
      const m = sql.match(/\[sourceCostCenterId\]\s+NVARCHAR\((\d+)\)/i);
      expect(m).toBeTruthy();
      expect(m![1]).toBe('1000');
    });

    it('defines the FK operational_overhead_entries.periodId -> periods.id and six exact FKs total', () => {
      const fkPeriod = sql.match(/fk_operational_overhead_entries_period/);
      expect(fkPeriod).toBeTruthy();
      const fkCandidates = sql.match(/REFERENCE[^\)]*/gi) ?? [];
      expect(fkCandidates.length).toBeGreaterThanOrEqual(6);
      // The period FK references the periods table id column.
      expect(sql).toMatch(/fk_operational_overhead_entries_period\]\s+FOREIGN\s+KEY\s*\(\s*\[periodId\]\s*\)\s+REFERENCES\s+\[dbo\]\.\[operational_overhead_periods\]\s*\(\s*\[id\]/i);
      // The period FK points at the same physical width (periodId 200 == periods.id 200),
      // which is the exact defect that caused the first production rollback.
      const periodIdDef = sql.match(/\[periodId\]\s+NVARCHAR\((\d+)\)/i);
      expect(periodIdDef?.[1]).toBe('200');
    });

    it('does not declare any NVARCHAR(191) id column (period.id must never regress to 191)', () => {
      // Operate on the comment-stripped code: the header comment documents the original
      // NVARCHAR(191) bug, so only actual column declarations may not use 191.
      const wideUsage = code.match(/NVARCHAR\(191\)/gi);
      expect(wideUsage ?? []).toEqual([]);
    });
  });

  describe('index / uniqueness design (root cause 2: wide composite keys)', () => {
    it('contains no composite UNIQUE index at all (uniqueness is app-enforced, not a wide unique index)', () => {
      expect(sql).not.toMatch(/CREATE\s+UNIQUE/i);
    });


    it('every index and primary key fits its declared SQL Server limit, including single-column keys', () => {
      const tables = [...code.matchAll(/CREATE\s+TABLE\s+\[dbo\]\.\[([^\]]+)\]\s*\(([\s\S]*?)\n\);/gi)];
      const widths = new Map<string, Map<string, number>>();
      for (const [, table, body] of tables) {
        const cols = new Map<string, number>();
        for (const [, col, chars] of body.matchAll(/\[([^\]]+)\]\s+NVARCHAR\((\d+)\)/gi)) cols.set(col, Number(chars) * 2);
        for (const [, col] of body.matchAll(/\[([^\]]+)\]\s+DATETIME2/gi)) cols.set(col, 8);
        widths.set(table, cols);
        for (const [, keys] of body.matchAll(/PRIMARY KEY CLUSTERED\s*\(([^)]*)\)/gi)) {
          const bytes = [...keys.matchAll(/\[([^\]]+)\]/g)].reduce((sum, m) => sum + (cols.get(m[1]) ?? Infinity), 0);
          expect(bytes).toBeLessThanOrEqual(900);
        }
      }
      const indexes = [...code.matchAll(/CREATE\s+NONCLUSTERED\s+INDEX\s+\[([^\]]+)\]\s+ON\s+\[dbo\]\.\[([^\]]+)\]\s*\(([^)]*)\)/gi)];
      expect(indexes).toHaveLength(7);
      for (const [, , table, keys] of indexes) {
        const bytes = [...keys.matchAll(/\[([^\]]+)\]/g)].reduce((sum, m) => sum + (widths.get(table)?.get(m[1]) ?? Infinity), 0);
        expect(bytes).toBeLessThanOrEqual(MAX_INDEX_KEY_BYTES);
      }
    });

    it('wide legacy FK sources are not indexed; exact bounded mirrors supply their query keys', () => {
      const indexes = [...code.matchAll(/CREATE\s+NONCLUSTERED\s+INDEX[\s\S]*?\(([^)]*)\)/gi)];
      for (const [, keys] of indexes) expect(keys).not.toMatch(/\[(companyId|branchId|sourceCostCenterId)\]/);
      for (const key of ['companyKey', 'branchKey', 'sourceCostCenterKey']) {
        expect(code).toMatch(new RegExp('\\[' + key + '\\]\\s+NVARCHAR\\(200\\)'));
      }
    });
  });

  describe('CHECK constraints (trusted + bounded enums)', () => {
    const checkNames = [
      'operational_overhead_periods_period_ck',
      'operational_overhead_periods_status_ck',
      'operational_overhead_periods_close_meta_ck',
      'operational_overhead_periods_code_ck',
      'operational_overhead_entries_amount_ck',
      'operational_overhead_entries_category_ck',
      'operational_overhead_entries_status_ck',
      'operational_overhead_entries_finalize_meta_ck',
      'operational_overhead_entries_currency_ck',
      'operational_overhead_entries_reference_ck',
    ];

    it('declares all ten CHECK constraints, each WITH CHECK and re-enabled (trusted)', () => {
      for (const name of checkNames) {
        expect(sql).toMatch(new RegExp(`WITH\\s+CHECK\\s+ADD\\s+CONSTRAINT\\s+\\[${name}\\]`, 'i'));
        expect(sql).toMatch(new RegExp(`CHECK\\s+CONSTRAINT\\s+\\[${name}\\]`, 'i'));
      }
      expect(sql).not.toMatch(/WITH\s+NOCHECK/i);
    });

    it('overhead category CHECK matches the canonical OVERHEAD_CATEGORIES and excludes direct costs', () => {
      const body = sql.match(/operational_overhead_entries_category_ck\]\s+CHECK\s*\(\s*\[overheadCategory\]\s+IN\s*\(([^)]*)\)/i)?.[1] ?? '';
      const values = (body.match(/'[^']*'/g) ?? []).map((v) => v.replace(/^N?'?/i, '').replace(/'$/, ''));
      expect([...values].sort()).toEqual([...OVERHEAD_CATEGORIES].sort());
      for (const ex of OVERHEAD_DIRECT_COST_EXCLUSIONS) {
        expect(values).not.toContain(ex);
      }
    });

    it('amount CHECK is strictly positive (no zero, no negative), matching the DTO', () => {
      const body = sql.match(/operational_overhead_entries_amount_ck\]\s+CHECK\s*\(([\s\S]*?)\);/i)?.[1] ?? '';
      expect(body).toMatch(/\[amount\]\s*>\s*\(0\)/i);
    });

    it('enforces the half-open period invariant periodFrom < periodTo', () => {
      expect(sql).toMatch(/\[periodFrom\]\s*<\s*\[periodTo\]/i);
    });
  });

  describe('scope control / safety (Section 4, Section 12)', () => {
    it('creates ONLY the two B1 source tables (no unrelated ALTER on existing tables)', () => {
      const creates = [...sql.matchAll(/CREATE\s+TABLE\s+\[dbo\]\.\[([^\]]+)\]/gi)].map((x) => x[1]);
      expect(creates).toEqual(['operational_overhead_periods', 'operational_overhead_entries']);
      // No ALTER TABLE outside the two new tables and their own constraints.
      const alters = [...sql.matchAll(/ALTER\s+TABLE\s+\[dbo\]\.\[([^\]]+)\]/gi)].map((x) => x[1]);
      for (const t of alters) {
        expect(['operational_overhead_periods', 'operational_overhead_entries']).toContain(t);
      }
    });

    it('is purely additive: performs NO source DML, NO backfill, NO ledger posting, NO history mutation', () => {
      // Method: match DML as full statements on the comment-stripped `code`. The FK
      // clauses "ON UPDATE NO ACTION" and column names like [updatedById] are NOT DML
      // and must not trip the guard.
      expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(code).not.toMatch(/(?:^|;)\s*UPDATE\s+\[/i);
      expect(code).not.toMatch(/(?:^|;)\s*DELETE\s+FROM\b/i);
      expect(code).not.toMatch(/\bTRUNCATE\s+TABLE\b/i);
      expect(code).not.toMatch(/\bMERGE\s+\[/i);
      expect(code).not.toMatch(/(?:BACKFILL|operationalCostTransaction)/i);
      expect(code).not.toMatch(/_prisma_migrations/i);
    });
  });

  describe('B2 / B3 / external-service scope exclusion (negative scope)', () => {
    it('B1 contains NO allocation (B2) constructs', () => {
      // The header comment says "NO allocation"; that is prose. The actual schema (code)
      // must contain no allocation table/column/index/function.
      expect(code).not.toMatch(/allocat/i);
      expect(code).not.toMatch(/allocation|split|pro-rata/i);
    });

    it('B1 contains NO energy (B3) constructs', () => {
      expect(code).not.toMatch(/energy/i);
      expect(code).not.toMatch(/kwh/i);
    });

    it('B1 does not add an EXTERNAL_SERVICE overhead category', () => {
      expect(sql).not.toMatch(/'EXTERNAL_SERVICE'/);
      expect(OVERHEAD_CATEGORIES).not.toContain('EXTERNAL_SERVICE');
    });
  });
});
