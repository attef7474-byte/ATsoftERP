# MachineComponent shared multi-machine architecture and runtime proof

**Date:** 2026-11-19
**Branch:** `fix/machine-components-shared-multi-machine`
**Baseline:** `main` @ `029f5e6f8cad220116df30cd67056faf49e00ad0`
**Status:** Architecture correction and proof-only runtime flow are `COMPLETE`. Overall task remains `BLOCKED` until the requested git/deploy/production-reconciliation gates are executed.

This document proves the old architecture, the corrected architecture, and the real browser → API → database → audit flow on a **clone database only**. No production write or production migration was performed for this proof.

## 1. Old architecture — proven from `main`

| Evidence | Location on `main` | Observed fact |
|---|---|---|
| Schema | `apps/api/prisma/schema.prisma` | `model MachineComponent` had required `machineId String`, `machine Machine @relation(...)`, `locationInMachine`, `serialNumber`, and `@@unique([machineId, code])`. One row was therefore inherently one-machine-only. |
| Batch service | `apps/api/src/modules/factory/maintenance/machine-components/machine-components.service.ts` | `createBatch` deduped `machineIds`, validated each machine, then ran `for (const machine of ordered) { tx.machineComponent.create({ data: { machineId: machine.id, ... } }) }`. The comment explicitly said "One independent MachineComponent row per unique selected machine". |
| Web create | `apps/web/src/app/admin/maintenance/machine-components/page.tsx` | Create posted to `/maintenance/machine-components/batch`; success messaging was based on `createdCount`. |
| Web edit | same page | Edit used single-select `<F9Lookup>` bound to `form.machineId`; serial and parent were disabled for multi-machine cases. |
| Old web test | `apps/web/tests/machine-components-multi-machine.test.ts` | Asserted `api.post('/maintenance/machine-components/batch')`, `confirmBatchOpen`, `batchCreateSuccess`, `'edit still uses the single-select F9Lookup'`, `'form.machineId'`, and `'the service creates one row per machine inside the loop'`. |

Conclusion: the old design created `N` `MachineComponent` rows for `N` machines sharing one logical component code. That is the defect this task corrects.

## 2. New architecture — implemented contract

* `MachineComponent` is the logical component authority. `machineLinks` is the only authoritative machine membership.
* New canonical join model/table: `MachineComponentMachine` / `machine_component_machines`.
* `MachineComponent.companyId` and `branchId` are nullable, additive ownership fields derived from the authenticated context and validated machines; they are never accepted from client input.
* `locationInMachine` and `serialNumber` are machine-specific and canonical on the join row. Legacy physical columns remain temporarily as non-canonical/deprecated columns for backward compatibility.
* Create is one component plus `N` active links in one transaction, deduped, with company/branch/status/`deletedAt` validation.
* Edit is set-based: `toAdd` / `toKeep` / `toRemove` are derived from submitted `machineIds`; kept links keep their association id; removed links are set `INACTIVE` with `unlinkedAt`; re-added links are reactivated on the same association row instead of creating a duplicate.
* List/detail/F9/filter/pagination return one row per logical component. `?machineId=` means active association.
* Child machine set is validated as a subset of the parent's active machine set; cycles, self-parenting, and removal of a parent machine still needed by a child are rejected.
* The active code uniqueness guard is an application check plus a SQL Server filtered unique index on `(companyId, branchId, code)` where `deletedAt IS NULL`.
* Rows with null ownership remain hidden from non-`SUPER_ADMIN` contexts.

## 3. Schema, migration, and clone proof

* Schema diff in `apps/api/prisma/schema.prisma`: `86 insertions(+), 14 deletions(-)`; `npx prisma validate` and `npx prisma generate` passed.
* New migration only: `apps/api/prisma/migrations/20261119000000_shared_machine_component_multi_machine/migration.sql`. No applied migration was edited; no migration history was deleted.
* Verified backup: `C:\Users\attef\AppData\Local\Temp\ATsofterp_pre_MCM_20261119_030636.bak` (`COPY_ONLY, CHECKSUM`, `RESTORE VERIFYONLY` passed).
* Fresh clone `ATsoftERP_DB_MCM_PROOF2` on `tcp:localhost,50079`; `prisma migrate deploy` and `prisma migrate status` both succeeded.
* Full reconciliation is recorded in `docs/proofs/machine-component-migration-clone-reconciliation-2026-11-19.md`. Key results: total components `13`, active `4`, soft-deleted `9`, links `14`, active duplicate groups `0`, orphan links `0`, `merge_link_rows = 1`, `AMBIGUOUS_GROUPS_AUTO_MERGED = 0`, all downstream counts preserved.
* Proven duplicate `U-000005` was merged by `batchCorrelationId + code` only; canonical `cmwmrhf0p00012095az0mn5hu`, merged sibling `cmwmrhf1d000320953szhrgpp`, both machines retained as links.

## 4. Static validation results

| Gate | Result |
|---|---|
| Focused API batch spec | `20` new-architecture tests green |
| Full API suite | `229` suites / `4966` tests passed |
| API `npx tsc --noEmit` | passed |
| API `npm run build` | passed |
| Focused web spec | `19` new-architecture tests green |
| Full web suite | `129` suites / `2413` tests passed |
| Web `npm run typecheck` | passed |
| Web `npm run build` | passed |
| `npm run i18n:check` | `7369` EN keys / `7369` AR keys, synchronized; `11527` literal `t()` keys resolve |
| `npm run ui-baseline:check` | `99` checks verified |
| `git diff --check` | no errors |

## 5. Proof-only runtime environment

* API: `http://localhost:4100/api/v1`, `NODE_ENV=development`, connected to `ATsoftERP_DB_MCM_PROOF2`.
* Web: `http://localhost:3100`, `NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1`.
* Login: `mcm-proof@atsofterp.local` / `REDACTED`, role `SUPER_ADMIN`.
* Active company: `cmrvaph2200009g95oj1o8m1j`; branch: `cmrvaph4100019g95kisacppa`.
* Browser tab: `tab_d30dabd7-1aa8-47a1-a84b-d4443d4952bc`.

## 6. Browser/runtime proof — create (EN)

UI action: list → Create → filled code/name/type/criticality/description → `F9MultiLookup` selected 3 machines → per-machine location/serial entered → Save → shared-component confirmation → confirmed.

Captured POST:

* Request id `7a051800-beb1-4002-9992-462c75af9ed6:171`
* `POST http://localhost:4100/api/v1/maintenance/machine-components` → **201**
* Body: `machineIds` with 3 ids; `machineData` with 3 per-machine `locationInMachine`/`serialNumber` values; `code: MC-BROWSER-PROOF-001`.
* Response component id: `cmwmulley00022s95dwxwstam`
* Response contained exactly 1 component with 3 active `machineLinks` and 3 flattened `machines`.

Database proof:

```text
id                       code                  ActiveLinks
cmwmulley00022s95dwxwstam MC-BROWSER-PROOF-001 3

link id                   machineId                     status
cmwmullfk00032s953mk5ocfd cmv5ws0br001hcc95wab6eorf    ACTIVE
cmwmullfk00042s956f1h760o cmv5wpklt001ccc95rmyjc58z    ACTIVE
cmwmullfk00052s95iu8symgr cmv5wg90j0010cc9599dre9ac    ACTIVE
```

The list page showed one row `MC-BROWSER-PROOF-001` with all three machine names, not three rows.

## 7. Browser/runtime proof — edit same record, unlink, reactivate

### 7.1 First edit (remove MCH-000027, add MCH-000026)

* `GET /maintenance/machine-components/cmwmulley00022s95dwxwstam` prefilled the same component id, code, name, type, criticality, and the 3 active machine-specific values. Code input was disabled.
* Request id `7a051800-beb1-4002-9992-462c75af9ed6:193`
* `PATCH /maintenance/machine-components/cmwmulley00022s95dwxwstam` → **200**
* Response id was unchanged: `cmwmulley00022s95dwxwstam`.
* Database result: removed machine link `cmwmullfk00052s95iu8symgr` became `INACTIVE` with `unlinkedAt = 2026-11-19 01:07:58.947`; new machine MCH-000026 got link `cmwmupi1700072s95nadzkqan` with `ACTIVE`. No component row was created.

### 7.2 Second edit (reactivate MCH-000027, unlink MCH-000026)

* Request id `7a051800-beb1-4002-9992-462c75af9ed6:209`
* `PATCH /maintenance/machine-components/cmwmulley00022s95dwxwstam` → **200**
* Database result: the **same association row** `cmwmullfk00052s95iu8symgr` was reactivated to `ACTIVE`, `unlinkedAt = NULL`, while `cmwmupi1700072s95nadzkqan` became `INACTIVE`. Total links stayed `4`; no duplicate association was created.

This proves same-record edit, set-based add/keep/remove behavior, inactive-unlink instead of hard delete, and reactivation.

## 8. Detail page and `?machineId=` filter

* Browser detail route: `http://localhost:3100/admin/maintenance/machine-components/cmwmulley00022s95dwxwstam` → **200** with one component header and a `Machine-Specific Attributes` table showing the 3 active machines and their values.
* F9/global search typed `MC-BROWSER-PROOF-001`; request `7a051800-beb1-4002-9992-462c75af9ed6:328` `GET /maintenance/machine-components?page=1&limit=5&search=MC-BROWSER-PROOF-001` → **200**, `meta.total = 1`, one component row with 3 active links.
* Active membership filter via API (using the browser session token):
  * `?machineId=cmv5ws0br001hcc95wab6eorf` → **200**, total `2`, includes `MC-BROWSER-PROOF-001`.
  * `?machineId=cmupglw1i01lulc953bab25md` (link now inactive) → **200**, total `2`, **does not** include `MC-BROWSER-PROOF-001`.

## 9. Arabic / English and RTL / LTR

* English list, create, edit, detail, and F9 flows were executed successfully; document direction was LTR.
* Language switched to Arabic: `document.documentElement.dir = rtl`, `lang = ar`. Labels rendered in Arabic (`الكود`, `الاسم`, `الحالة`, `نوع المكون`, `الخصائص الخاصة بالماكينة`, `الماكينات`, `الموقع في الماكينة`, `الرقم التسلسلي`). F9 search showed the component under `أجزاء ووحدات الآلات`.
* User-entered proof data remains English/Arabic machine names as stored in the clone; no raw translation key was displayed.

## 10. Console and network proof

* No uncaught JavaScript errors during create, edit, detail, F9, or language switch.
* One console error occurred during the global "All entities" F9 search: `GET /api/v1/production/cost-snapshots?page=1&limit=5&search=MC-BROWSER-PROOF-001` → **500**. This is a pre-existing unrelated global-search adapter failure, not caused by this change; the machine-components search request in the same F9 flow returned **200**.
* All machine-components POST/PATCH/GET requests used the real API with `x-active-company-id`, `x-active-branch-id`, and `x-locale` headers; no mock response was involved.

## 11. Audit proof

`audit_logs` rows for `cmwmulley00022s95dwxwstam`:

| Action | Time (UTC) | Details |
|---|---|---|
| `CREATE` | `01:04:56.777` | `companyId`, `branchId`, `code`, `batch: true`, `batchCorrelationId: mcbatch:mcmproofuser0000000000001:1795050296744`, `batchSize: 3`, `machineIds` with all 3 ids |
| `UPDATE` | `01:07:59.005` | `beforeMachines` / `afterMachines`, `addedMachines: [MCH-000026]`, `removedMachines: [MCH-000027]`, changed fields |
| `UPDATE` | `01:09:26.654` | `beforeMachines` / `afterMachines`, `addedMachines: [MCH-000027]`, `removedMachines: [MCH-000026]`, changed fields |

No duplicate-merge audit uses component name as evidence; migration merge evidence remains `batchCorrelationId + code` only.

## 12. Permission and tenant-isolation proof

* Backend permission enforcement and tenant/branch guards were exercised by the full API suite, including the rewritten `machine-components.batch.spec.ts`, `tenant-guards` call sites, maintenance request/work order/BOM/spare-part/stock-issue/replacement/measurement-point specs, and the new Excel specs.
* The proof login is `SUPER_ADMIN`; its use is explicit and confined to the clone. Normal-role allow/deny and Company A / Company B isolation assertions are covered in the API suite, not by writing to production.

## 13. Known limitations

* Nine legacy soft-deleted components were migrated with backfilled links whose join `status` is `ACTIVE`; application reads still filter `deletedAt IS NULL`, so they are hidden. Cleanup of those legacy join statuses is deferred.
* Legacy `machineId`, `locationInMachine`, and `serialNumber` columns on `MachineComponent` remain temporarily as non-canonical/deprecated fields.
* Excel `machineCodes` uses `;` as the separator; a literal semicolon cannot be represented. Misaligned `MachineCodes` / `LocationsInMachine` / `SerialNumbers` lists produce row errors. Legacy `machineCode` is accepted only for single-machine rows; `MachineCodes` wins when both are present.
* The shared component detail page shows generic "requested text could not be displayed" fallback labels for some unrelated pre-existing detail sections (both EN and AR). The machine-component-specific sections are fully translated.
* Global F9 "All entities" search has a pre-existing 500 on `production/cost-snapshots`; the machine-components entity search itself is healthy.

## 14. Status

* Architecture correction: `COMPLETE`
* Migration clone proof: `COMPLETE`
* Backend/API/UI/Excel code: `COMPLETE`
* Static tests/builds/i18n/UI baseline: `COMPLETE`
* Browser runtime proof on clone: `COMPLETE`
* Git commit / push / merge / post-merge gates / push main / deploy / production reconciliation: `NOT_VERIFIED`
* Overall task: `BLOCKED` until those remaining requested gates are executed and recorded.
