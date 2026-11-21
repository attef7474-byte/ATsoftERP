# Phase 6 Runtime Permission Seed Proof — 2026-11-21

Status: COMPLETE

## 1. Scope

This proof covers the runtime application of the 61 Phase 6 governance permission keys to the live database and SUPER_ADMIN role. No workflow role logic outside the approved Phase 6 scope was changed.

Canonical declaration: `apps/api/prisma/seed/seed-phase6-governance-permission-keys.ts`.
Runtime wiring: `apps/api/prisma/seed/seed.ts`.
Contract regression: `apps/api/src/modules/auth/r4r-permission-seed-contract.spec.ts`.

## 2. Seed execution

| Measurement | First run | Idempotency re-run |
| --- | ---: | ---: |
| Permissions created | 61 | 0 |
| SUPER_ADMIN grants created | 61 | 0 |
| Total grants for Phase 6 keys | 61 | 61 |

The second run created no rows and no duplicate grants, proving idempotency.

## 3. Runtime totals

| Measurement | Before Phase 6 runtime seed | After Phase 6 runtime seed |
| --- | ---: | ---: |
| Admin-visible permissions | 767 | 828 |

The delta of 61 matches the declared Phase 6 key count exactly.

## 4. Permission parity

| Gate | Expected | Observed |
| --- | ---: | ---: |
| Phase 6 keys declared by static contract | 61 | 61 |
| Phase 6 permission rows present in DB | 61 | 61 |
| SUPER_ADMIN grants for those keys | 61 | 61 |
| R4R allowlist entries | 0 | 0 |
| Unexpected enforced-but-unseeded keys | 0 | 0 |

## 5. Focused regression after runtime seed

Command run from `apps/api`:

```powershell
npx jest --testMatch="**/*.spec.ts" --runInBand --silent --testPathPattern=r4r-permission-seed-contract
```

Result:

```text
PASS src/modules/auth/r4r-permission-seed-contract.spec.ts
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

## 6. Seed-key reconstruction rule

Permission parity was not inferred from string literals alone. The contract reconstructs seeded keys from:

1. Literal declarations in `prisma/seed/*.ts`.
2. Imported `*constants*` / `*permission*` modules.
3. The `MODULES x ACTIONS` generator.

This applies inspection-register check P45 and keeps the R4R allowlist empty.

## 7. Known standalone-seed gap

The static permission catalogue and deployed standalone seed history were not fully convergent before Phase 6: the production DB had 767 active/distinct permissions while the static catalogue contained 792 keys. The Phase 6 runtime seed added the 61 approved governance keys, bringing admin-visible permissions to 828. The historical standalone-seed reconciliation remains a separate deployment/seed item and is not represented as a Phase 6 code defect.

## 8. Conclusion

The 61 governance keys are declared, seeded, granted to SUPER_ADMIN, idempotent on re-run, and covered by the focused parity contract. Runtime permission-seed status is COMPLETE.
