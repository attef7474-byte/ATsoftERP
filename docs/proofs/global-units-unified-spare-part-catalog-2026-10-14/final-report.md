# UNIFIED SPARE PART CATALOG + GLOBAL UNITS

# FINAL PRODUCTION REPORT

Observed at: 2026-10-14
Repository: `attef7474-byte/ATsoftERP`
Branch: `main`
Report location: `docs/proofs/global-units-unified-spare-part-catalog-2026-10-14/final-report.md`
Evidence directory: `.tmp/unified-spare-part-catalog/` (git-ignored runtime evidence)

---

## 1. Task Identity and Objective

Establish a **global Unit master** and a **single canonical Spare Part catalog** where:
one Spare Part is entered once, its unit is chosen from the global master, its inventory
product authority is single, and one Spare Part can be linked to many machines — removing
the duplicate machine-part data-entry UX while preserving all legacy history.

Objective status: **FIXED_DEPLOYED_PROVEN**.

---

## 2. Exact Scope Completed

- Added global `Unit` model + 11 seeded units + nullable `unitId` FK on `Product`, `SparePart`, `MachinePart`.
- Unified Spare Part page and four-section create/edit form (Data / Technical / Inventory Link / Linked Machines).
- Single canonical product authority (`SparePart.productId`); `MachineSparePart` derives unit from `SparePart`.
- Multi-machine applicability (`MachineSparePart`, `@@unique([machineId, sparePartId])`).
- Removed duplicated `mnt-machine-parts` navigation entry; legacy route kept reachable as read-only.
- Backend unit CRUD API, spare-part machines batch endpoints, permissions, i18n EN/AR, tests.
- Production migration, deployment, and read-only proof.

No unrelated module was modified.

---

## 3. Environment

- Runtime: Windows, SQL Server `ATsoftERP_DB` on `DELL\WINCC` (`localhost,50079`), Prisma 7.8.0, NestJS API, Next.js web.
- API health: `http://localhost:4000/api/v1/health` → `200`.
- Services (NSSM): `ATsoftERP_API`, `ATsoftERP_Web`, `ATsoftERP_Caddy`.
- Privileged migration path: Windows integrated (`DELL\attef`, sysadmin); application login has no DDL.
- Credentials redacted (`DATABASE_URL=...<REDACTED>...`).

---

## 4. Git Baseline

- Pre-change HEAD: `cd92d1ad56ecc6d41ca139e71b9642f886369c30`.
- Change commit: `ac90e59369ac6b81f2033b14adafdb94e65234e9` — "feat(maintenance): unify spare part catalog and machine applicability" (30 files, +1754 / −263).
- Pushed: `cd92d1ad..ac90e593 main -> main`.
- Final closeout: `HEAD = origin/main = ac90e593`, ahead/behind `0/0`, working tree clean, `git diff --check` clean.

---

## 5. Pre-Change Production State

`production-sentinels-before.json` (2026-10-14T00:43:51Z):

`units = NOT_PRESENT`, `spare_parts = 12`, `machine_parts = 889`, `machine_spare_parts = 0`,
`component_spare_parts = 0`, `machine_installed_parts = 0`, `products = 13`,
`inventory_movements = 61`, `inventory_balances = 11`, `audit_logs = 2720`,
`permissions = 721`, `roles = 13`, `role_permissions = 286`, `user_roles = 10`.

---

## 6. Data Model Changes

- New model `Unit` (global master; not tenant-scoped).
- Nullable `unitId` FK added to `Product`, `SparePart`, `MachinePart` with `ON DELETE NO ACTION`.
- Ownership contract: `SparePart.unitId = CANONICAL_SPARE_PART_UNIT_AUTHORITY`;
  `MachineSparePart = DERIVES_UNIT_FROM_SPAREPART`; `ComponentSparePart = DERIVES_UNIT_FROM_SPAREPART`;
  `MachinePart.unitId = LEGACY_COMPATIBILITY_ONLY`.

Report: `global-unit-ownership-contract.md`, `global-unit-normalization-plan.md`.

---

## 7. Migration Details

- Path: `apps/api/prisma/migrations/20261014090000_add_global_unit_master/migration.sql`.
- Size 4378 bytes, 97 lines, LF-only, no BOM, no destructive `DROP`.
- SHA256: `70B6E958F3339C527871D9E97D13F76ED705D83CB3CADB455760A785FFE5A3BC`.
- Guarded `TRY/CATCH` + `TRAN`, idempotent seed, NULL-guarded backfill.

---

## 8. Backup Evidence

`production-backup.json`:

- File: `C:\ATsoftERP\Backups\ATsoftERP_DB_PRE_SPAREPART_UNITS_20261014-034407.bak`.
- Size 84066304 bytes; SHA256 `4A37BB9949DB93C422B7B4381022588439628DD439DE229A6FFD2AB9EB83F485`.
- `BACKUP ... WITH COPY_ONLY, CHECKSUM, INIT`; `BACKUP` exit 0; `VERIFYONLY` exit 0.

Decision: recovery window established before schema change.

---

## 9. Migration Application

- Command (cwd `apps/api`, integrated security):
  `node ../../node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts`.
- Result: ledger recorded normally (`migration_applied = 1`); no manual ledger rewrite.
- Log: `migration-deploy.log`.

Decision: **FIXED_DEPLOYED_PROVEN** (migration).

---

## 10. Post-Migration Verification

`production-migration-proof.json`:

- `units_count = 11`, `units_seed_codes = 11`.
- `spare_parts = 12`, `machine_parts = 889`, `products = 13`, `machine_spare_parts = 0`.
- Backfilled: `products = 13`, `spare_parts = 8`, `machine_parts = 889`.
- `bad_fk = 0` (all tables); `unit_fk_found = 3`; `unit_fk_disabled_or_untrusted = 0`.
- `migration_applied = 1`; `failed_rows = 0`; `ok = true`.

---

## 11. Data Safety / Legacy Preservation

- `machine_parts`: 889 → 889 (`LEGACY_MACHINEPART_COUNT_DELTA = 0`).
- `spare_parts`: 12 → 12; `products`: 13 → 13.
- `machine_parts` unit text preserved; no deletion, rename, auto-link, or text merge.
- Decision: **LEGACY_MACHINE_PART_HISTORY_PRESERVED**.

---

## 12. API Contract

- Units: `GET/POST /units`, `GET/PATCH/DELETE /units/:id`, `PATCH /units/:id/activate|deactivate`; list supports `activeOnly`.
- Spare-part machines: `GET /maintenance/spare-parts/:id/machines`, `PUT /maintenance/spare-parts/:id/machines` (batch).
- Tenant/branch validated server-side; DTO validation; no raw DB errors.

---

## 13. Permissions

- Keys: `unit:create|read|update|delete|activate|deactivate`; spare-part/machine-spare-part keys reused from existing catalogue.
- Backend enforcement + frontend gating; Super Admin bypass unchanged.
- No role/permission grants added for deploy; `SYNTHETIC_BUSINESS_WRITE = NONE`.

---

## 14. Frontend Unified Page

- Route: `/admin/maintenance/spare-parts`; title `maintenance.sparePartsUnifiedTitle`
  (EN "Spare Parts & Machine Applicability", AR "دليل قطع الغيار والآلات").
- Columns: Code, Name, Category, Manufacturer, Model, Part Number, Unit, Linked Inventory Product,
  Linked Machines, Importance, Critical, Status (+ Actions).
- Production proof: single catalog, no duplicate codes, no raw CUID leak (22/22 checks EN and AR).

---

## 15. Frontend Unified Form (Four Sections)

Section A `section.data`, B `section.technical`, C `section.inventoryLink`, D `section.machines`.
Production proof confirms exactly one heading per section in EN and AR.

---

## 16. Machine Multi-Select

- `MachineMultiSelect` keyed by machine id; selection survives paging/search; chips are human-readable.
- Production proof: selected 2 machines and rendered 2 chips **without saving the form**.
- E2E: `ONE_SPARE_MULTI_MACHINE`, `LIST_exposes_linked_machine_count`, `EDIT_MACHINE_LINKS`.

Decision: **SPARE_PART_MACHINE_MULTI_LINKING_PROVEN**.

---

## 17. Unit Controlled Selector

- Controlled native `Select` from global Unit master; no free-text; single empty placeholder.
- Production proof: 11 selectable options, human-readable labels, no raw id.
- Decision: **SPAREPART_CANONICAL_UNIT_CONTROLLED**.

---

## 18. Technical Description Unification

- Single field; EN "Technical Description / Specification", AR "الوصف الفني / المواصفات"; bound to existing `specification` value.
- Legacy `form.specification` label absent (`form_no_duplicate_legacy_specification_label` PASS).

---

## 19. Legacy Route Decision

- `mnt-machine-parts` navigation entry removed; `mnt-spare-parts` remains the single primary entry
  (`PRIMARY_SPARE_PART_MANAGEMENT_ENTRY_COUNT = 1`).
- `/admin/maintenance/machine-parts` kept reachable and classified **LEGACY_READ_ONLY** with no create affordance.
- Decision: **DUPLICATE_MACHINE_PART_DATA_ENTRY_REMOVED_FROM_UX**.

---

## 20. Arabic / English / RTL / LTR

- i18n parity 6506 EN / 6506 AR; 10098 literal `t()` keys; raw-keys check PASS; no fallback text.
- Production proof asserts `dir=rtl` (AR) and `dir=ltr` (EN) on every page.

---

## 21. Build and Test Gates

- API focused 4 suites / 53 tests; API full 192 suites / 3847 tests; API build EXIT 0.
- Web focused 19 tests; Web full 65 suites / 1459 tests; Web tsc EXIT 0; Web build EXIT 0.
- i18n 6506/6506; raw-keys PASS; UI baseline 99 checks; route-contract MATCHED=1125; permission UI PASS.
- `prisma validate` valid; `credentials:check` OK; `git diff --check` clean.

---

## 22. Production Deployment

`production-deploy.json`:

- API PID 2804 → 29372 (Running); Web PID 29916 → 46552 (Running).
- Web BUILD_ID `Mmyrr3wKf3AjRcWRxD6GM` served in `/login` HTML.
- API health 200; login 200; `ATsoftERP_Caddy` and `MSSQL$WINCC` untouched.
- Decision: **GLOBAL_UNITS_SPAREPART_PRODUCTION_DEPLOYED**.

---

## 23. Production Read-Only UI Proof

`production-unified-ui-proof.json` — status **PASS**; mode `READ_ONLY_GET_PLUS_CANONICAL_CONTEXT_VALIDATE`;
`businessMutations = NONE`; EN 22/22, AR 22/22; 0 blocked writes; 0 page errors; 10 screenshots.
Context: Super Admin `cmrl31v0g0004ok95wxhdi9lm` (authVersion 3), company `cmum3jqh8001mf495zaankx05`, branch `cmum5dwmo0000ro95qq4day18`.

Decision: **FIXED_DEPLOYED_NONMUTATING_PROOF**.

---

## 24. Permission UI Regression

`node scripts/verify-permission-ui.mjs` → "UI VERIFICATION PASSED: all checks succeeded."
(no raw permission keys, no hardcoded denial text, EN/AR parity, shared error dialog, translated states).

---

## 25. Sentinel Diff

`production-sentinel-diff.json` — status **PASS**. Only change:
`units NOT_PRESENT → 11` = `EXPECTED_MIGRATION_CHANGE`. All business tables unchanged;
`audit_logs 2720 → 2720` (read-only proof performed no writes).

---

## 26. Legacy 889 Unit-Mapping Waiver

- `machine_parts` = 889 subject to legacy mapping review; **OWNER WAIVED** row-by-row review.
- Classified `LEGACY_COMPATIBILITY_ONLY`; not a blocker. `LEGACY_MACHINEPART_UNIT_TEXT_PRESERVED = PASS`.

---

## 27. Unit / Multi-Machine Status Decisions

`production-unit-multi-machine-proof.json`:

- `GLOBAL_UNIT_MASTER_FOUNDATION_COMPLETE = PASS`
- `SPAREPART_CANONICAL_UNIT_CONTROLLED = PASS`
- `SPARE_PART_MACHINE_MULTI_LINKING_PROVEN = PASS`
- `SPAREPART_PRODUCT_AUTHORITY_PRESERVED = PASS`
- `LEGACY_MACHINEPART_UNIT_TEXT_PRESERVED = PASS`

E2E (`disposable-e2e.json`) 13/13 PASS on a disposable clone (dropped, no production mutation).

---

## 28. Known Limitations

- Global Unit master adopted on Product / SparePart / MachinePart only; full adoption elsewhere tracked as
  `UNIT_MASTER_ADOPTION_FOLLOWUP`.
- Legacy `/admin/maintenance/machine-parts` remains reachable as read-only history (intentional).
- 889 legacy MachinePart unit mappings remain `LEGACY_COMPATIBILITY_ONLY` by owner decision.

---

## 29. Runtime Proof Summary and Decision Codes

| Area | Verification | Decision |
|---|---|---|
| Migration | backup + verify + deploy + post-check | FIXED_DEPLOYED_PROVEN |
| Deployment | API/Web restart, health, BUILD_ID | FIXED_DEPLOYED_PROVEN |
| Unified page | production EN/AR | FIXED_DEPLOYED_NONMUTATING_PROOF |
| Unified form | production EN/AR | FIXED_DEPLOYED_NONMUTATING_PROOF |
| Multi-machine | production + E2E | FIXED_DEPLOYED_PROVEN |
| Data safety | sentinel diff | PASS |

No `BLOCKED_*` or `FAILED_*` codes occurred; no recovery was required.

---

## 30. Closure

- `GLOBAL_UNIT_MASTER_FOUNDATION_COMPLETE`
- `SPAREPART_CANONICAL_UNIT_CONTROLLED`
- `SPARE_PART_SINGLE_CANONICAL_CATALOG_ESTABLISHED`
- `SPARE_PART_MACHINE_MULTI_LINKING_PROVEN`
- `DUPLICATE_MACHINE_PART_DATA_ENTRY_REMOVED_FROM_UX`
- `SPARE_PART_PRODUCT_AUTHORITY_PRESERVED`
- `LEGACY_MACHINE_PART_HISTORY_PRESERVED`
- `UNIFIED_SPARE_PART_PAGE_PROVEN`
- `UNIFIED_SPARE_PART_FORM_PROVEN`
- `GLOBAL_UNITS_SPAREPART_PRODUCTION_DEPLOYED`
- `UNIFIED_SPARE_PART_CATALOG_FINAL_CLOSEOUT_COMPLETE`

Final status: **COMPLETE**. HEAD = origin/main = `ac90e593`, ahead/behind `0/0`, clean.
