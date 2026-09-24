# ATsoft ERP — Approved Master Roadmap Final Closeout

**Date:** 2026-09-24
**Status:** `ATSOFT_ERP_APPROVED_MASTER_ROADMAP=CLOSED`
**Scope:** Final formal closeout of every currently approved roadmap program delivered under the ATsoft ERP Engineering Constitution v1.0 and Master Plan v1.0.

---

## 1. Authority Hierarchy

Reference order on conflict (per `AGENTS.md` section 0 and the Constitution closing clause):

1. Engineering Constitution — `docs/architecture/atsoft-erp-engineering-constitution-v1.0.md` (approved, executable reference; Articles 1–30).
2. Domain rule files — `docs/agent-rules/` (architecture-and-tenancy, database-and-migrations, backend-and-security, frontend-and-ux, testing-and-proof, domain-rules/{maintenance,inventory,production}).
3. Permanent Development Contract — `docs/architecture/atsoft-erp-development-contract-v1.0.md`.
4. UI / i18n / appearance / access baseline protection — `docs/governance/` + `scripts/check-ui-baseline.mjs`.
5. `AGENTS.md` (concise operating summary).
6. Discovery reports (aids, not design authority).

Master Plan v1.0 (`docs/architecture/master-plan.md`) and Operational Vision v1.0 (`docs/architecture/operational-vision.md`) remain the approved roadmap declarations. No newer roadmap supersedes them; unrelated Phase 4 / Finance / Sales / Purchasing / Payroll / AI / IoT / BI / Forecasting scope is explicitly unapproved.

**`ROADMAP_AUTHORITY=UNAMBIGUOUS`**

---

## 2. Final Git Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| Baseline (this closeout) | `af017d44587ba848fab7172f0fc4e40252eb1c5f` |
| `HEAD == origin/main` | TRUE (`HEAD = af017d44…`) |
| Ahead/behind | `0/0` |
| Worktree | clean (`git status --porcelain` empty) |
| Fetch before closeout | performed; no unexpected remote advance |
| Publication | fast-forward only; no force / rebase / merge commit |

**`GIT_BASELINE=PASS`**

---

## 3. Approved Scope

Approved operational domains (implemented, connected, production-capable):

- Multi-company tenancy / branch scope / active operational context
- Organizational foundation and hierarchy (units, machines, departments, workforce/supervision)
- Maintenance (requests, tasks, work orders, downtime, preventive schedules/checklists, spare parts, installed parts, replacement history, repair orders, SLA, costs)
- Inventory and spare parts (warehouses, locations, balances, movements, counting, valuation R1A–R1H)
- Production Phase 1 (slices 1.1–1.9: master data, shifts, capacity standards, orders, runs, output, downtime/loss, waste/rework, materials/FG, quality, cost, OEE/analytics)
- Operational costing (Cost Program: R1A-C currency authority, R1B canonical unified cost ledger, R1C reconciliation, R2B maintenance labor costing, R2C-B external service costing, R2D-B1 overhead source/period, R2D-B2 allocation engine, R2D-B3 overhead allocation ledger posting)
- Assets, barcodes/QR, search (F9), reports/export/print, numbering, settings, audit, notifications, messaging, attachments, dashboards
- Arabic + English, RTL + LTR, RBAC permissions

---

## 4. Phase 0 Status

| Field | Value |
|---|---|
| DECLARED_SCOPE | Org/factory restructure: `OrganizationalUnit` tree, `Machine` (counter/location), `MaintenanceWorkOrder`, tenant rules, auto-fill, operational context (Master Plan §2, Operational Vision §3.2) |
| IMPLEMENTATION_COMMIT(S) | `8eba533e` (phase0 full slices), `8fcdbef5` (company/branch/administration department hierarchy) |
| HIERARCHY PROGRAM SUPERSEDES | HIER-A…HIER-I: `2dfc6ba4`, `7d3ccf6`, `73eaceb`, `def18da`, `35d6ae4`, `115f33d3`, `ea949ec`, `e74c468`, `b677c8a1`, `b9b5a84e`, `6759458`, `d98b027` |
| FORMAL_CLOSEOUT_COMMIT | `aae4fab1` (finalize hierarchy program comprehensive closeout; all 13 checkpoints verified as ancestors of HEAD) |
| PRODUCTION_DEPLOYED | Yes (Production `ATsoftERP_DB`, live API/Web/Caddy services) |
| CURRENT_TEST_EVIDENCE | Included in full API 2914 / Web 1011 regression (run at identical source state) |
| CURRENT_RUNTIME_EVIDENCE | Live API health 200; recorded Phase 0 work-order tenant/inventory browser proof |
| STATUS | **CLOSED** (org foundation + HIER program superseding older Phase 0 implementation claims; hierarchy NOT rebuilt, extended) |

---

## 5. Production Phase 1 Status

| Field | Value |
|---|---|
| DECLARED_SCOPE | Slices 1.1–1.9 (Master Plan §2, Phase 1) |
| IMPLEMENTATION_COMMIT(S) | `489fef3d` (1.1–1.2), `d9efef18` (1.3), `b80fab44` (1.4), `7b565239` (1.5), `67a0869a` (1.6), `beeb0288` (1.7), `4df4ee85` (1.8), `452d8e84` (1.9) |
| D1–D5 DEFECT REPAIR | `64eb80c3`; release artifact `be4116ca`; recloseout `b4fd65e6`; pin `e3336b03` |
| FORMAL_CLOSEOUT_COMMIT | `fb82a455` (Phase 1 closeout governance), `b4fd65e6` (final recloseout / PRODUCTION_PHASE_1=CLOSED), `e3336b03` (pin) |
| PRODUCTION_DEPLOYED | Yes — release deployed to Production, byte-parity verified (API dist 4250/4250, Web 2522/2522) |
| CURRENT_TEST_EVIDENCE | Full API 2914/2914, Web 1011/1011 at identical source state; `prisma migrate status` up to date |
| CURRENT_RUNTIME_EVIDENCE | Post-deploy safe Production acceptance: login, `/auth/me`, orders list, performance-targets, audit-logs, health — all 200, no 500s |
| STATUS | **CLOSED** (D1–D5 repaired, no regression of repaired paths) |

---

## 6. Phase 2 Status

| Field | Value |
|---|---|
| DECLARED_SCOPE | Operational deepening: cost centers, atomic cost transaction, MTBF/MTTR/OEE from atomic records, cost and reliability reports (Master Plan §2, Phase 2) |
| HISTORICAL IMPLEMENTATION_COMMIT | `3adba6b5` (complete operational deepening) |
| LATER PROGRAMS SUPERSEDING | Cost Program R1A-C/R1B/R1C/R2B/R2C-B/R2D-B1/B2/B3 (canonical unified cost ledger = the authoritative atomic cost transaction); Production 1.8/1.9 (quality, cost, OEE/analytics); Inventory Valuation R1A–R1H (valuation integration) |
| SUPERSESSION DECLARED | Yes — the historical Phase 2 implementation was replaced/extended by the later approved programs. No duplicate Phase 2 implementation exists or is created. |
| FORMAL_CLOSEOUT_COMMIT | Superseded by: `d01fbaa1` (Inventory Valuation), `c9c53c53` + `af017d44` (COST Program) |
| PRODUCTION_DEPLOYED | Yes |
| CURRENT_TEST_EVIDENCE | Full API 2914 / Web 1011; i18n 6110=6110; route-contract 1112/0; UI baseline 99 |
| CURRENT_RUNTIME_EVIDENCE | Live health 200; cost ledger + reconciliation + OEE proven in recorded closeouts |
| STATUS | **CLOSED** (fully covered by current Production + Inventory Valuation + COST + reliability/reporting; no duplicate) |

---

## 7. Phase 3 Status

| Field | Value |
|---|---|
| DECLARED_SCOPE | Release maturity: documentation, training, deployment tooling, audit automation, performance/release controls (Master Plan §2, Phase 3) |
| IMPLEMENTATION_COMMIT(S) | `9e3de80f` (seed security, idempotency, UI test operational context), `e78b0e7d` (merge Phase 3 + release v1.0.0) |
| LATER QA/RELEASE CLOSEOUTS (stronger evidence) | Production readiness/release runbooks (`41a21a15`), final live release readiness (`444297f0`), inventory user manual/SOP/training/handover package, maintenance handover package, audit tooling (`scripts/check-ui-baseline.mjs`, i18n/route-contract/credentials/raw-keys/policy checks), release recloseout `b4fd65e6` |
| CLASSIFICATION | Documentation: CURRENTLY_PROVEN. Training: CURRENTLY_PROVEN (EN+AR training plans/handover packages). Deployment tooling: CURRENTLY_PROVEN (build-release scripts, NSSM services, backup tooling, restore/verify). Audit automation: CURRENTLY_PROVEN (i18n/route/UI-baseline/credentials checks + audit module). Performance/release controls: CURRENTLY_PROVEN (route-contract, UI baseline, byte-parity verification, performance budgets). No item remains NOT_PROVEN or OUT_OF_SCOPE. |
| PRODUCTION_DEPLOYED | Yes |
| CURRENT_TEST_EVIDENCE | Full API 2914/2914, Web 1011/1011, static gates all PASS at identical source state |
| STATUS | **CLOSED** (release maturity items proven by later QA/release closeouts; the v1.0.0 tag alone is not the evidence — current closeouts are) |

---

## 8. Hierarchy Program Status

| Field | Value |
|---|---|
| DECLARED_SCOPE | HIER-A structure → HIER-I operational integration (direct leadership hierarchy, temporal assignments, team management UI, hierarchy tree, history timeline, transfer reconciliation, security hardening) |
| IMPLEMENTATION_COMMIT(S) | `2dfc6ba4`, `7d3ccf6`, `73eaceb`, `def18da`, `35d6ae4`, `115f33d3`, `ea949ec`, `e74c468`, `b677c8a1`, `b9b5a84e`, `6759458`, `d98b027` |
| FORMAL_CLOSEOUT_COMMIT | `aae4fab1` (final comprehensive closeout; all 13 checkpoints verified as ancestors of HEAD) |
| PRODUCTION_DEPLOYED | Yes |
| CURRENT_TEST_EVIDENCE | HIER-H permission security spec + tenant specs included in full regression 2914 |
| CURRENT_RUNTIME_EVIDENCE | Recorded HIER-D/E browser runtime evidence; live health |
| STATUS | **CLOSED** |

---

## 9. Inventory Valuation Status

| Field | Value |
|---|---|
| DECLARED_SCOPE | R1A–R1H: valuation foundation, monetary input, atomic engine, transfer value flow, maintenance, production material, run cost close authority, finished-goods, reconciliation |
| IMPLEMENTATION_COMMIT(S) | R1 slice commits recorded in `docs/proofs/inventory-valuation-r1a-r1h-final-closeout-2026-09-24.md` §3 (all ancestors of `origin/main`) |
| FORMAL_CLOSEOUT_COMMIT | `d01fbaa1` (`INVENTORY_VALUATION_R1A_R1H=CLOSED`) |
| PRODUCTION_DEPLOYED | Yes |
| CURRENT_TEST_EVIDENCE | Full API 2914/2914, Web 1011/1011; focused R1 suites; i18n 6110=6110; route-contract 1112/0; UI baseline 99 |
| CURRENT_RUNTIME_EVIDENCE | Weighted-average valuation implemented (method `['WEIGHTED_AVERAGE']`); recorded runtime/API evidence; live health |
| STATUS | **CLOSED** |

---

## 10. COST Program Status

| Field | Value |
|---|---|
| DECLARED_SCOPE | R1A-C, R1B, R1C, R2B, R2C-B, R2D-B1, R2D-B2, R2D-B3 |
| IMPLEMENTATION_COMMIT(S) | `9d00fb6a` (R1A-C), `ef6cc3de`/`7e2af379`/`35119985` (R1B), `d3e3c440`/`fe6175b6`/`e0377392` (R1C), `57435959` (R2B), `19c21cea` (R2C-B), `708a8c0c` (R2D-B1), `03099a47` (R2D-B2), `3c36b98c` (R2D-B3) |
| FORMAL_CLOSEOUT_COMMIT | `c9c53c53` (finalize COST program closeout, `COST_PROGRAM=CLOSED`) + `af017d44` (baseline correction) |
| PRODUCTION_DEPLOYED | Yes |
| CURRENT_TEST_EVIDENCE | Focused cost suites 23/23 (535 tests); full API 2914 / Web 1011; 10 COST migrations; reconciliation + currency integrity spec |
| CURRENT_RUNTIME_EVIDENCE | Canonical single-writer ledger (`postLedgerEntryWithinTransaction` production-cost.service.ts:1655, `reverseLedgerEntry` :1872); live health |
| STATUS | **CLOSED** |

---

## 11. Architecture-Authority Matrix

Each approved concept has exactly ONE current authority; no parallel authoritative implementation found.

| Concept | ONE Current Authority | Verdict |
|---|---|---|
| Tenant context | `common/operational-context/` (`ActiveOperationalContext`, `allowed-context.resolver.ts`, `active-context.validator.ts`) | PASS |
| Organizational hierarchy | `SupervisorAssignment` (DIRECT) + `OperationalPersonAssignment` (HIER program) | PASS |
| Inventory balance | `inventory-balances` service (atomic tx, source-document required) | PASS |
| Inventory valuation | `inventory-valuation` module (`['WEIGHTED_AVERAGE']`) | PASS |
| Production execution | Production Phase 1 modules (orders/runs/output/downtime/material/FG/quality/cost) | PASS |
| Cost ledger | `production-cost.service.ts` canonical writer (`postLedgerEntryWithinTransaction` 1655, `reverseLedgerEntry` 1872); single direct `operationalCostTransaction.create/update` owner | PASS |
| Reconciliation | `operational-cost-reconciliation.service.ts` (R1C read-only) + inventory valuation reconciliation (separate domain) | PASS |
| Permissions | `permissions.guard.ts` + seeded permission keys (single guard) | PASS |
| Audit | `audit/` module (`audit.service.ts`) | PASS |
| Numbering | `numbering/` module (single controller/service) | PASS |
| Error handling | Shared localized `messageKey` error contract (BadRequest/NotFound/etc.) | PASS |
| i18n | `apps/web/src/lib/i18n/locales/` — single EN/AR dictionary root (24 namespace files each) | PASS |

**`ARCHITECTURE_AUTHORITY_MATRIX=PASS`**

---

## 12. Production / Runtime State

- API: `ATsoftERP_API` NSSM service (:4000) — **SERVICE_RUNNING**, health `GET /api/v1/health` → `200 {"status":"ok"}` (uptime ~98 min at check).
- Web: `ATsoftERP_Web` NSSM service (:3000) — **SERVICE_RUNNING**, HTTP 200 (6.8 KB response).
- Caddy reverse proxy: **SERVICE_RUNNING**.
- Deployed source: `apps/api/dist` + `apps/web/.next` present; source delta `be4116ca..HEAD` = **NONE** (only documentation changed since the release deploy) ⇒ deployed artifacts match published main.
- No stray QA/clone services: port 4002 (PID 13880) is Siemens `um.Ris.exe` (foreign automation runtime), not an ATsoftERP clone; every `node.exe` process resolved to either the two production services or foreign automation vendors (Schneider/Siemens).
- No debug instrumentation: `console.log/debug` absent from all controllers; no synthetic DML (fixture prefix `cmue%` = 0 across companies/warehouses; `companies total = 47`).
- No temporary QA/clone databases left running (release clones are documented as disposed/deliberately not reused).

**`PRODUCTION_HEALTH=PASS`, `PRODUCTION_WEB=PASS`**

---

## 13. Database / Migration State

- `prisma validate` → **schema valid**.
- `prisma migrate status` (read-only, Production `ATsoftERP_DB`) → **85 migrations found, database schema up to date, 0 pending, 0 failed**.
- All migration directories present = 85; recorded rows vs active migrations consistent; no rolled-back/historical migration rows outstanding.
- No historical migration edits, no `prisma db push`, no `migrate reset`, no destructive DDL performed during this or prior closeout sessions (documented per program).

**`PRODUCTION_MIGRATIONS=0_PENDING`**

---

## 14. Current Regression Evidence

Source state identical to the last full regression (no source change since `b4fd65e6`…`af017d44`, only documentation), so the recorded baseline is current and is NOT re-run for ceremony:

| Gate | Value |
|---|---|
| FULL API tests | **2914/2914** PASS (165 suites) |
| FULL Web tests | **1011/1011** PASS (36 suites) |
| Failures | `FAILED_TESTS=0` |
| Removed tests | `REMOVED_TESTS=0` |
| Newly skipped tests | `NEWLY_SKIPPED_TESTS=0` |
| i18n | **6110 EN = 6110 AR**, 22 namespaces, 9734 literal keys |
| Route contract | **1112 matched / 0 malformed / 0 unresolved / 0 mismatches** |
| UI baseline | **99 checks PASS** |
| Typecheck / API build / Web build | PASS |
| `prisma validate` / `migrate status` | PASS / up to date |
| Raw-keys, credentials, permission-UI | PASS |
| `git diff --check` | clean |

**`FULL_API_TESTS=2914`, `FULL_WEB_TESTS=1011`, `FAILED_TESTS=0`, `REMOVED_TESTS=0`, `NEWLY_SKIPPED_TESTS=0`**

---

## 15. Stale-Documentation Corrections

Classified findings (only CURRENT docs describing the present system were corrected; historical proof records were preserved verbatim):

| Document | Classification | Action |
|---|---|---|
| `docs/inventory-handover/inventory-limitations-and-controls-en.md` | STALE_CURRENT_DOC | Corrected: added WEIGHTED_AVERAGE to Implemented Controls; rewrote stale "No stock valuation method" row as FIFO/LIFO-not-implemented; removed resolved "Stock valuation and unit cost" from Recommended Controls |
| `docs/inventory-handover/inventory-limitations-and-controls-ar.md` | STALE_CURRENT_DOC | Corrected (parity): added WEIGHTED_AVERAGE row; rewrote stale valuation row |
| `docs/handover/maintenance/08-known-limitations.md` | STALE_CURRENT_DOC | Corrected §5 (all 5 i18n namespaces now implemented in consolidated locale files) and §9 (BOM module now fully implemented, `/admin/maintenance/bom` in sidebar) |
| `docs/audits/factory-operational-structure-audit/*.md` | HISTORICAL_DOC_DO_NOT_EDIT | Preserved (dated audit snapshot) |
| `docs/proofs/*` historical counts (1973 API, 616 Web, 63 migrations, 231 pages, etc.) | HISTORICAL_DOC_DO_NOT_EDIT | Preserved (frozen historical evidence) |
| `docs/release/current-release-known-limitations.md` | HISTORICAL_DOC_DO_NOT_EDIT | Preserved (Batch 39 era release notes) |
| `docs/proofs/atsofterp-current-architecture-discovery-report.md` | Discovery aid (not design authority) | Preserved; current code is source of truth |

**`STALE_CURRENT_DOCS_CORRECTED=3`, `HISTORICAL_DOCS_PRESERVED=YES`**

---

## 16. Intentionally Disabled / Unapproved Domains

- Finance / General Ledger — module directories exist as unregistered skeletons (no controllers in `app.module.ts`, no schema usage, no frontend routes). **Remain disabled.**
- Sales — same. **Remain disabled.**
- Purchasing — same. **Remain disabled.**
- HR / Payroll — same. **Remain disabled.**
- AI — same. **Remain disabled.**
- IoT — same. **Remain disabled.**
- BI — same. **Remain disabled.**
- Forecasting — same. **Remain disabled.**

Verified: none of `FinanceModule|SalesModule|PurchasingModule|HrModule|AiModule|IoTModule|BiModule|ForecastingModule` is imported by `app.module.ts`; no finance/sales/purchasing/hr/ai/iot/bi/forecasting schema models; no frontend routes under `/admin` for those domains.

**`UNAPPROVED_DOMAINS_REMAIN_DISABLED=PASS`**

---

## 17. Known Limitations

1. `ATSOFT_API_TOKEN_NOT_PROVIDED`: authenticated browser smoke for some auth-gated reads is skip-limited in the local environment (pre-existing, identical for inventory/production/cost closeouts). Not a code blocker.
2. Full Playwright recertification is not re-run every session; recorded browser proofs plus live health cover the runtime slices.
3. Jest may emit a benign worker force-exit warning on some API runs (pre-existing; not a skipped/failed test).
4. Inventory valuation supports `WEIGHTED_AVERAGE` only; FIFO/LIFO are out of scope.
5. Operational currency is per company with no FX conversion and no default fallback (by design).
6. Overhead allocation posting is CLOSED-period, FINAL-only by contract.

---

## 18. Remaining Future Work Requires New Owner Approval

- Any unapproved domain (Finance, Sales, Purchasing, HR/Payroll, AI, IoT, BI, Forecasting) activation requires an explicit new owner-approved scope.
- Any additional production feature (e.g., new cost slices beyond R1A-C…R2D-B3, additional valuation methods, new production slices) requires a new approved roadmap/scope decision.
- No Phase 4 roadmap exists; none is invented by this closeout.

---

## 19. Master Closeout Decision

Every currently approved roadmap program is formally closed with committed evidence, Production-deployed, and validated by current regression and runtime evidence. No unresolved contradiction remains; no parallel authoritative architecture exists; Production migration state is current; no code repair was required (only documentation reconciliation).

**`ATSOFT_ERP_APPROVED_MASTER_ROADMAP=CLOSED`**

**`CURRENT_APPROVED_ROADMAP_COMPLETE=YES`**

**`NEW_FEATURE_WORK_REQUIRES_NEW_OWNER_APPROVED_SCOPE=YES`**

This does not mean the ERP can never receive future features; it means the currently approved roadmap has been completed and formally closed. Any later feature program requires a new approved roadmap/scope.

---

## 20. Governance Record

- Documentation-fix commit: `docs: reconcile stale roadmap and limitation statements` — documentation-only, no code mixed.
- Governance closeout commit: `docs(roadmap): finalize approved ATsoftERP master roadmap closeout` — this document.
- No amend of historical commits; fast-forward only; final `HEAD == origin/main`, `AHEAD_BEHIND=0/0`, worktree clean.