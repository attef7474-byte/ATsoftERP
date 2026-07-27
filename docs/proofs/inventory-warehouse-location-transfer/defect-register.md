# Defect Register — Stock Transfers (Batch R)

## Open Defects

| # | Severity | Description | Status | Workaround |
|---|----------|-------------|--------|------------|
| 1 | Low | SQL Server key length warnings on NVARCHAR(1000) indexes (max key length 900/1700 bytes vs 2000 bytes) | **ACCEPTED** | CUID values are always 25 chars × 2 bytes = 50 bytes, well under limits. Can be reduced to NVARCHAR(255) in future schema alignment. |
| 2 | Medium | Prisma `migrate dev` fails with shadow database error (P3006) due to prior migration state maintenance_requests escalation_level column mismatch | **WORKAROUND** | Tables created via direct SQL. Prisma `generate` works fine. Long-term: fix shadow database or realign migrations. |

## Resolved During Development

| # | Description | Resolution |
|---|-------------|------------|
| 1 | Product FK length mismatch (NVARCHAR(1000) vs NVARCHAR(255)) | Changed all ID columns to NVARCHAR(1000) to match existing schema |
| 2 | Missing `operationName` column in number_sequences INSERT | Added full column list matching existing records |
| 3 | Prisma config shadow database URL not set | Removed shadowDatabaseUrl from prisma.config.ts (not needed for `generate`) |

## Mitigation Status

All defects have clear workarounds. No defect blocks the functional delivery of Batch R. Key length warnings are cosmetic — they do not affect runtime behavior since CUID values (25 chars) are far below the index limits.
