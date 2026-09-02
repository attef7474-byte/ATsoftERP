import { readFileSync } from 'fs'
import { join } from 'path'

const apiRoot = join(__dirname, '..', '..', '..', '..')
const migrationSql = readFileSync(
  join(apiRoot, 'prisma', 'migrations', '20260902010000_company_operational_currency_authority', 'migration.sql'),
  'utf8',
)
const schema = readFileSync(join(apiRoot, 'prisma', 'schema.prisma'), 'utf8')

describe('COST-R1A-C additive migration contract', () => {
  it('adds a nullable company-owned currency field with no default', () => {
    expect(migrationSql).toMatch(/ADD \[operationalCurrencyCode\] NVARCHAR\(3\) NULL;/i)
    expect(migrationSql).not.toMatch(/operationalCurrencyCode[^;]*DEFAULT/i)
    expect(schema).toMatch(/operationalCurrencyCode\s+String\?\s+@db\.NVarChar\(3\)/)
  })

  it('performs no fake USD or SAR backfill', () => {
    expect(migrationSql).not.toMatch(/UPDATE\s+\[dbo\]\.\[companies\]/i)
    expect(migrationSql).not.toMatch(/INSERT\s+INTO/i)
    expect(migrationSql).not.toMatch(/DEFAULT\s+N?'(?:USD|SAR)'/i)
  })

  it('creates an enabled and trusted uppercase three-letter database guard', () => {
    expect(migrationSql).toMatch(/WITH CHECK ADD CONSTRAINT \[companies_operationalCurrencyCode_ck\]/i)
    expect(migrationSql).toMatch(/CHECK CONSTRAINT \[companies_operationalCurrencyCode_ck\]/i)
    expect(migrationSql).toMatch(/LEN\(\[operationalCurrencyCode\]\) = 3/i)
    expect(migrationSql).toMatch(/Latin1_General_100_BIN2/i)
    expect(migrationSql).not.toMatch(/WITH NOCHECK/i)
  })

  it('does not alter inventory valuation currency authority or cost ledger tables', () => {
    expect(migrationSql).not.toMatch(/inventory_valuation_policies/i)
    expect(migrationSql).not.toMatch(/inventory_movement_lines/i)
    expect(migrationSql).not.toMatch(/operational_cost_transactions/i)
  })

  it('is atomic and does not forge Prisma migration history', () => {
    expect(migrationSql).toMatch(/BEGIN TRY/i)
    expect(migrationSql).toMatch(/BEGIN TRAN/i)
    expect(migrationSql).toMatch(/COMMIT TRAN/i)
    expect(migrationSql).toMatch(/ROLLBACK TRAN/i)
    expect(migrationSql).not.toMatch(/_prisma_migrations/i)
  })
})
