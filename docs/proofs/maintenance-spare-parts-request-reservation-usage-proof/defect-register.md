# Defect Register — Maintenance Spare Parts Request + Reservation + Usage Proof

## Open Defects
- None

## Closed Defects
- None (batch implemented without defects)

## Pre-existing Issues (Not Related to This Batch)
1. **Smoke test login failure in non-interactive mode**: The smoke test script prompts for admin password via `Read-Host` when no password is passed. When run without `-Password` flag, it reads empty string causing "password must be longer than or equal to 6 characters" error. Fixed by passing `-Password Admin@123456`.

2. **No ESLint configuration detected**: Pre-existing warning, not related to this batch.

## Mitigation
- No open blocking defects.
- Pre-existing smoke test issue is documented and mitigated by using the correct password flag.
