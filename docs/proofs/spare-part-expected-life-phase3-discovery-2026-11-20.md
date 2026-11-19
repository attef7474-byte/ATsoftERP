# Phase 3 Discovery — Spare Part Expected Life & Installed-Part Lifecycle

Date: 2026-11-20  
Status: `DISCOVERY COMPLETE — IMPLEMENTATION MAY PROCEED`  
Authoritative scope: the Phase 3 user prompt; no Phase 4 scope introduced.

## 1. Entry gate

| Check | Result |
| --- | --- |
| Repository | `C:\Users\attef\PycharmProjects\Trae\ATsofterp` |
| Starting branch | `main` |
| Starting HEAD / `origin/main` | `88a99b24cec60266ff0781e533d62c3e1e74d862` |
| Ahead/behind | `0/0` |
| Working tree | Only the known governance docs from the prior prompt (`AGENTS.md`, new pitfalls register); committed as prerequisite `d1ce2e97` on `feat/spare-part-life-phase-3` before implementation |
| Migration count | `98` applied migration directories |
| Latest migration | `20261119130000_add_operational_receipt_classification` |
| Deployed production commit | Services `ATsoftERP_API` / `ATsoftERP_Web` are NSSM-run from this repo's `apps/api/dist` and `apps/web/.next`; builds last written 2026-11-20 after Phase 2 closeout commit `88a99b24` |
| Phase 2 receipt functionality present | `UnifiedReceiptsModule` in `apps/api/src/app.module.ts:115`; controller `apps/api/src/modules/factory/unified-receipts/unified-receipts.controller.ts:19`; web panel and nav route `/admin/inventory/receipts` present; closeout `docs/proofs/unified-receipt-phase2-final-closeout-2026-11-20.md` ends `PHASE 2 CLOSED — COMPLETE` / `PHASE_3_READY=YES` |
| Services | Both NSSM services running; Caddy untouched |

## 2. Inspect-first classification key

* `EXISTS — REUSE`
* `PARTIAL — EXTEND`
* `MISSING — ADD`
* `LEGACY — PRESERVE`
* `NOT REQUIRED IN PHASE 3`

## 3. Required discovery findings

### 3.1 Current `SparePart` fields

`apps/api/prisma/schema.prisma:2742-2804`. Catalog identity/classification/stock recommendation/product link/status/soft-delete and relations exist. **No expected-life field of any name exists.** Repository grep for `defaultExpected*`, `expectedLife*` on `SparePart` returned zero matches.

| Exact missing field | Proposed canonical name | Semantics |
| --- | --- | --- |
| Standard expected life value | `defaultExpectedLifeValue` | Nullable `Float`; `> 0` when configured; NULL = default not defined |
| Standard expected life unit | `defaultExpectedLifeUnit` | Nullable `String`; `DAYS`, `HOURS`, `CYCLES`; NULL only with NULL value |
| Standard warning threshold | `defaultWarningThresholdPercent` | Nullable `Int`; `1–99` when configured; default reused as `80` |

No `defaultDueThresholdPercent` is added: the existing centralized `DUE_PROGRESS_THRESHOLD = 0.9` is authoritative.

### 3.2 Current `MachineInstalledPart` life fields

`apps/api/prisma/schema.prisma:4264-4326`, especially `:4295-4307`:

`expectedLifeValue`, `expectedLifeUnit`, `lifeStartDate`, `lifeStartReading`, `currentReading`, `warningThresholdPercent` (default `80`), `expectedExpiryDate`, `expectedExpiryReading`, `lifeStatus` (default `UNKNOWN`), `lastEvaluatedAt`, `alertThresholdReached` (default `NONE`), `expectedLifeAlertAt`. Index on `lifeStatus` exists.

### 3.3 Current reading fields

`MachineInstalledPartReading` at `apps/api/prisma/schema.prisma:4329-4345`: `installedPartId`, `readingType` (`HOURS`/`CYCLES`), `readingValue`, `isReset`, `recordedByUserId`, `recordedAt`, `notes`, `createdAt`, with indexes on installed part and recorded time.

`isReset` exists but current recording logic at `installed-parts-replacement.service.ts:692-748` sets `currentReading = 0` and `lifeStartReading = 0` when `isReset` is true. It records the reading row with `isReset`, old readings remain immutable, and audit logs the event. It does not require a separate reason field; `notes` is available and will be used.

### 3.4 Current calculation algorithm

`apps/api/src/modules/factory/maintenance/installed-parts-replacement/installed-parts-replacement.service.ts:9-71` — note the actual path is `installed-parts-replacement` (no extra `in`):

* `DUE_PROGRESS_THRESHOLD = 0.9`; warning default `80`.
* Missing/non-positive `expectedLifeValue` → `UNKNOWN`.
* `DAYS`: `elapsed / (expectedLifeValue * 86400000)`; `expectedExpiryDate = lifeStartDate + total`.
* `HOURS`/`CYCLES`: `(currentReading - lifeStartReading) / expectedLifeValue`; `expectedExpiryReading = lifeStartReading + expectedLifeValue`.
* Status: `progress >= 1` → `EXPIRED`; `>= 0.9` → `DUE`; `>= warning%` → `WARNING`; else `NORMAL`.
* No rounding in the calculator; audit metadata rounds progress to 3 decimals.

Reliability analytics at `maintenance-reliability/reliability-calculations.ts:100-151` explicitly preserve unknown/no-fabrication and reuse the same DUE threshold.

### 3.5 Current warning threshold behavior

Configurable per installed instance via `SetExpectedLifeDto.warningThresholdPercent` with `@Min(1)` / `@Max(99)` and service default `part.warningThresholdPercent ?? 80`. No catalog-level warning exists yet.

### 3.6 Current DUE threshold behavior

Canonical constant `DUE_PROGRESS_THRESHOLD = 0.9` in the installed-parts service, imported by reliability calculations. Frontend tests already assert no duplicated magic threshold. It will be reused unchanged.

### 3.7 Current install writer(s)

Single direct writer: `InstalledPartsReplacementService.recordInstalledPartInTx` at `installed-parts-replacement.service.ts:125-176`. It enforces component-on-machine and creates `machineInstalledPart`. It currently sets **no** expected-life fields.

Production call sites:

1. Manual registration — `installed-parts-replacement.service.ts:351-365`.
2. Maintenance execution part issue — `maintenance-stock-issue.service.ts:869-876`, reached from `maintenance-tasks.service.ts:348`.
3. Direct stock issue / replacement installation — `maintenance-stock-issue.service.ts:1148-1163`.

Test call sites in the corresponding service specs also exist. Standalone spare-part issue voucher (`spare-part-issues.service.ts`) does not create installed parts.

### 3.8 Current replacement writer(s)

`recordReplacementInTx` at `installed-parts-replacement.service.ts:178+` writes `SparePartReplacementHistory`; old instance closure is `markInstalledPartRemovedInTx` at `:247-270`. Replacement is driven by the two stock-issue paths above. New installed instances therefore flow through the same single writer and will inherit defaults there.

### 3.9 Current API for life configuration

`installed-parts-replacement.controller.ts`:

| Route | Permission | Purpose |
| --- | --- | --- |
| `POST /installed-parts` | `installed-parts:create` | Manual registration |
| `PATCH /installed-parts/:id/expected-life` | `machine:update` | Configure/override instance life |
| `POST /installed-parts/:id/readings` | `machine:update` | Record reading |
| `GET /installed-parts/:id/readings` | `installed-parts:read` | Reading history |
| `POST /installed-parts/evaluate-expected-life` | `installed-parts:read` | Explicit evaluation |
| `POST /installed-parts/:id/remove` | `installed-parts:update` | Removal |
| `GET /installed-parts/:id` | `installed-parts:read` | Detail |

No new redundant endpoint is needed. SparePart default life will use existing `POST /maintenance/spare-parts` and `PATCH /maintenance/spare-parts/:id` with `spare-part:create` / `spare-part:update`.

### 3.10 Current UI for expected life

Canonical lifecycle page already exists: `apps/web/src/app/admin/installed-parts/[id]/page.tsx` with expected-life form, reading entry, and reading history. It must be reused/extended, not duplicated.

Reliability installed-parts page (`apps/web/src/app/admin/maintenance/reliability/installed-parts/page.tsx`) is read-only analytics with a minimal percent formatter. Alerts page (`.../reliability/alerts/page.tsx`) is read-only and already consumes `EXPECTED_LIFE` alerts.

Spare-parts page, detail, and standalone edit page have no expected-life controls/column/card.

### 3.11 Current reliability UI

`installed-parts` page preserves service life, expected life, failure/replacement count, MTBF/MTTR and DQ/timeline panels. `alerts` page preserves alert list, summary, DQ panel, and preventive-planning handoff. Phase 3 will add display/drill-through only where safe, without redesigning alerts.

### 3.12 Current permissions

Seeded keys (`apps/api/prisma/seed/seed-cmms-permission-keys.ts:80-83`, `:129-135`; `seed.ts:41,55`):

* `installed-parts:read`, `installed-parts:create`, `installed-parts:update`
* `spare-part:create`, `spare-part:read`, `spare-part:update`, `spare-part:activate`, `spare-part:deactivate`, `spare-part:delete`
* `machine:update`

No `installed-parts-life:update` or `installed-parts-reading:create` exists. Per the user's rule, no cosmetic new permission is created; existing maintenance authorities are reused. Dedicated life/read permission naming is `NOT REQUIRED IN PHASE 3`.

### 3.13 Current audit behavior

Canonical `AuditService` already logs `INSTALLED_PART_REGISTERED`, `INSTALLED_PART_REMOVED`, `EXPECTED_LIFE_CONFIGURED`, `INSTALLED_PART_READING_RECORDED`, `EXPECTED_LIFE_ALERT`, `MACHINE_INSTALLED_PART_REPLACED`, and SparePart `CREATE`/`UPDATE`. Phase 3 will enrich default-life update details and instance override details using these existing actions.

### 3.14 Exact missing UX

1. SparePart form section `العمر الافتراضي القياسي` with unit selector and unit-adaptive fields.
2. SparePart list column `العمر الافتراضي`.
3. SparePart detail card showing standard life/unit/warning threshold plus linked Product and machines.
4. Standalone SparePart edit page parity for the same record.
5. Installed-part grid/detail showing machine, component, spare part, serial, installed date, expected life, consumed, remaining, consumed %, and localized life status/progress.
6. Configure-life action with unit-adaptive fields and standard-vs-applied comparison.
7. Record-reading action for HOURS/CYCLES only, with prior reading, new reading, date, notes, and explicit reset.
8. Reading history with type/value/date/user/reset/notes.
9. Complete EN/AR keys for all labels and statuses; no raw enum text.

### 3.15 Exact missing inheritance behavior

`recordInstalledPartInTx` does not read SparePart defaults and does not populate any life field. Consequently all three production install paths create `UNKNOWN` instances even when a catalog default would exist. A single shared snapshot helper must be added to that writer so manual registration, execution issue, direct issue/replacement, and any future writer inherit identically.

### 3.16 Out of scope

* Second expected-life calculator or status model — `NOT REQUIRED IN PHASE 3`.
* Proactive alert scheduler / advanced monitoring / replacement planning — Phase 4.
* Global Excel program — `NOT REQUIRED IN PHASE 3`; only preserve existing Spare Part round-trip if needed.
* Product/stock quantity, inventory movement, balance, valuation changes — prohibited.
* Mass backfill of historical installed parts — prohibited.

## 4. Decision

Proceed with an additive-only migration on `SparePart`, a single snapshot helper in `recordInstalledPartInTx`, targeted enrichment of existing APIs/UI, and focused regression tests. No applied migration will be edited. No fake values or backfill will be introduced.
