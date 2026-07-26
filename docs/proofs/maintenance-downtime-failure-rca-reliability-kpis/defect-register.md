# Defect Register — Maintenance Downtime + Failure + RCA + Reliability KPIs

## Open Defects
- None

## Closed Defects
- None (batch implemented without defects)

## Pre-existing Issues (Not Related to This Batch)
1. **Smoke test login failure**: The smoke test script (`tools/health/smoke-check.ps1`) prompts for admin password via `Read-Host`. When run non-interactively, it reads empty password causing "password must be longer than or equal to 6 characters" error. This is pre-existing and unrelated to this batch.

## Mitigation
- No open blocking defects.
- Pre-existing smoke test issue is documented and does not affect the functionality of this batch.
