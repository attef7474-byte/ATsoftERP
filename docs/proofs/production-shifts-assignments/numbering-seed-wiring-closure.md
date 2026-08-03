# Phase 1.2 Numbering Seed Wiring Closure

**Task:** Connect the existing Phase 1.2 production-shift numbering seeder to the canonical main seed flow.
**Date:** 2026-08-04
**Canonical repo:** `C:\Users\attef\PycharmProjects\Trae\ATsofterp`
**Checkpoint before this task:** `489fef3dbd6e245bdaaafb4ccb44d8cc83c1d825`
**Status:** COMPLETE

---

## 1. Initial finding

The five Phase 1.2 numbering sequences (`PRODUCTION_SHIFT`, `PRODUCTION_SHIFT_TEMPLATE`,
`PRODUCTION_SHIFT_CALENDAR`, `PRODUCTION_SHIFT_ASSIGNMENT`, `PRODUCTION_OPERATIONAL_ASSIGNMENT`)
existed in `apps/api/prisma/seed/seed-production-shifts-numbering.ts` and in the current database,
but were **not** invoked by the main seed flow `apps/api/prisma/seed/seed.ts`. A clean install
running only the main seed would therefore lack these five sequences, and any runtime call to
`generateNumberAtomic('PRODUCTION_SHIFT')` etc. would fail with `numbering.sequenceNotFound`.

## 2. Root cause

The Phase 1.2 numbering seeder was delivered as a standalone script wired to package.json only
(`seed:production-shifts-numbering`), while the main seed flow (`npm run seed` →
`apps/api/prisma/seed/seed.ts`) was not extended to call it. Phase 1.1 numbering, by contrast, was
registered inline in `seed.ts` (`PRODUCTION_UNIT`, `PRODUCTION_PRODUCT`), so the two phases used
different registration paths. The standalone script also created its own `PrismaClient` at module
scope and auto-ran `main()` on import, making it unsafe to import into `seed.ts` as-is.

## 3. Files inspected

- `apps/api/prisma/seed/seed.ts` — main seed flow (sequence upsert loop at lines ~262–268).
- `apps/api/prisma/seed/seed-production-shifts-numbering.ts` — standalone Phase 1.2 seeder (5 sequences, findUnique/create-if-missing).
- `apps/api/prisma/seed/seed-production-numbering.ts` — Phase 1.1 standalone seeder (pattern reference).
- `apps/api/package.json` — registered standalone seed scripts.
- `apps/api/tsconfig.json` / `tsconfig.build.json` — compile scope (`prisma/seed/**/*` included; `**/*spec.ts` excluded from build).
- `apps/api/jest.config.js` — test roots (`<rootDir>/src`), requiring explicit roots override for the seed spec.

## 4. Files changed

| File | Change |
|---|---|
| `apps/api/prisma/seed/seed-production-shifts-numbering.ts` | Modified — exported `PRODUCTION_SHIFTS_NUMBER_SEQUENCES` and `seedProductionShiftsNumbering(prisma)`; moved adapter/client creation into guarded standalone `main()` (`require.main === module`), so import is side-effect-free and the standalone npm script keeps working |
| `apps/api/prisma/seed/seed.ts` | Modified — imports the seeder and invokes it once after the core `numberSequence.upsert` loop |
| `apps/api/prisma/seed/seed-production-shifts-numbering.spec.ts` | Added — focused spec (6 tests) for the seeder |
| `apps/api/scripts/check-production-shifts-numbering.ts` | Added — non-destructive read-only DB check for the five sequences (id, prefix, current counter, status, duplicate detection) |

## 5. Main seed integration

- `seed.ts` imports `{ seedProductionShiftsNumbering }` from `./seed-production-shifts-numbering`.
- It is invoked exactly once, after the main `numberSequences` upsert loop and before the final
  summary log — deterministic order: core + Phase 1.1 sequences first, then the Phase 1.2 seeder.
- The existing module-level `prisma` client is passed into the seeder (`await seedProductionShiftsNumbering(prisma)`);
  no second client is created inside the main flow.
- No direct `NumberSequence` definitions for the five Phase 1.2 codes were added to `seed.ts`
  (verified: zero matches), avoiding duplicate definitions and a second implementation.

## 6. Five sequence keys and prefixes

| Code | Prefix | Status |
|---|---|---|
| `PRODUCTION_SHIFT` | `PS-` | ACTIVE |
| `PRODUCTION_SHIFT_TEMPLATE` | `PST-` | ACTIVE |
| `PRODUCTION_SHIFT_CALENDAR` | `PSC-` | ACTIVE |
| `PRODUCTION_SHIFT_ASSIGNMENT` | `PSA-` | ACTIVE |
| `PRODUCTION_OPERATIONAL_ASSIGNMENT` | `POA-` | ACTIVE |

All keys/prefixes taken verbatim from the accepted Phase 1.2 implementation; no alternative keys created.

## 7. Idempotency behavior

The seeder uses `findUnique` → `create` only when missing; existing sequences are logged and skipped
(`Number sequence <CODE> already exists`). Seeds remain idempotent across runs.

## 8. Existing-counter preservation

The seeder never calls `update` and never writes `currentNumber`. Verified by the focused spec
("preserves their counters", "keeps counters" assertions) and by live DB runs (section 11).

## 9. Focused test results

Command (from `apps/api`):
```
npx jest --roots prisma/seed --testMatch "**/*.spec.ts" prisma/seed/seed-production-shifts-numbering.spec.ts
```
Result: **1 suite, 6/6 PASS**

- exports exactly the five Phase 1.2 sequence keys and prefixes
- creates all five sequences when none exist
- does not duplicate existing sequences and preserves their counters
- is idempotent: rerunning with all existing sequences creates nothing and keeps counters
- creates only the missing sequences in a mixed state and preserves existing counters
- surfaces database failures instead of swallowing them

## 10. API validation/build results

| Gate | Command | Result |
|---|---|---|
| Prisma validate | `npx prisma validate` | PASS (schema valid) |
| API typecheck | `npm run typecheck` (tsc --noEmit) | PASS |
| API build | `npm run build` (tsc) | PASS |
| Phase 1.2 focused tests | `npx jest src/modules/factory/production-shifts` | 6 suites, **76/76 PASS** (regression intact) |

## 11. Database verification (live, non-destructive)

Executed against the current SQL Server database via `npm run seed:production-shifts-numbering`
(exact same code path as the main seed invocation) and the read-only check script.

**Before (recorded):**

| Code | ID | current | status |
|---|---|---|---|
| PRODUCTION_SHIFT | cmsdehqal00004495pd58r475 | 6 | ACTIVE |
| PRODUCTION_SHIFT_TEMPLATE | cmsdehqbe000144954ek6htsf | 2 | ACTIVE |
| PRODUCTION_SHIFT_CALENDAR | cmsdehqbv00024495nl3tixv3 | 2 | ACTIVE |
| PRODUCTION_SHIFT_ASSIGNMENT | cmsdehqc7000344955jcs1ae2 | 4 | ACTIVE |
| PRODUCTION_OPERATIONAL_ASSIGNMENT | cmsdehqco00044495gqhwqif3 | 4 | ACTIVE |

**Run 1:** all five reported "already exists", exit 0.
**Run 2:** all five reported "already exists", exit 0.

**After (recorded):** identical rows — same five IDs, same counters
(`PS-=6, PST-=2, PSC-=2, PSA-=4, POA-=4`), all ACTIVE, `5/5` rows, **no duplicate rows (1 row per code)**,
`padding=6`, `domain=production`. Counters were not reset; no rows created; no destructive SQL.

## 12. Duplicate-key scan

Scanned all `apps/api/prisma/seed/*.ts` for `code: "PRODUCTION_*"` definitions:

- The five Phase 1.2 codes are defined **exactly once each** in `seed-production-shifts-numbering.ts`.
- `seed.ts` contains **zero** direct definitions of the Phase 1.2 codes (only the Phase 1.1 codes
  `PRODUCTION_LINE`, `PRODUCTION_UNIT`, `PRODUCTION_PRODUCT` remain in the main flow — unchanged).
- Phase 1.1 standalone seeder (`seed-production-numbering.ts`) untouched.
- No duplicate production numbering keys across seed files.

## 13. Git diff check

`git diff --check` — exit 0 (clean; only expected LF→CRLF warnings on the two modified files).

## 14. Final Git status

```
 M apps/api/prisma/seed/seed-production-shifts-numbering.ts
 M apps/api/prisma/seed/seed.ts
?? apps/api/prisma/seed/seed-production-shifts-numbering.spec.ts
?? apps/api/scripts/check-production-shifts-numbering.ts
?? RECONCILIATION-SUMMARY.txt
```
All changes left uncommitted for independent review. No commit, push, tag, reset, or other Git
write operation performed.

## 15. Limitations

- The full global seed (`npm run seed`) was **not** executed end-to-end (not necessary; the wiring
  is static and covered by typecheck/build, and the invoked seeder was run live twice with identical
  idempotent behavior). The full seed itself is upsert-based and was previously executed unchanged.
- The focused spec lives outside jest's default `src/` roots; it must be run with the explicit
  `--roots prisma/seed` override shown in section 9 (default `npm test` scope is unaffected).
- The check script is not registered in package.json (intentionally; run via
  `npx ts-node scripts/check-production-shifts-numbering.ts`).

## 16. Final conclusion

The Phase 1.2 numbering seeder is now connected to the canonical main seed flow: imported once,
invoked once with the existing Prisma client, idempotent, counter-preserving, and free of duplicate
definitions. Phase 1.1 numbering remains connected; no schema/migration/API/frontend/permission
files were touched; database sequences verified unchanged and non-duplicated live.

**Result: PHASE_1_2_SEED_WIRING_CLOSED**
