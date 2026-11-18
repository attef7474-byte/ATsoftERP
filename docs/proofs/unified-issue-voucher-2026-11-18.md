# Unified Issue Voucher implementation and release proof

## Baseline

Task started on `main` at `cc07483af38c576d401ff6575ad3c11ae1c17892`. The working tree was clean, with zero modified or untracked files. A fresh `git fetch origin main` verified 0/0 divergence. Implementation branch is `feat/unified-issue-voucher`, created from the refreshed `origin/main`.

The Engineering Constitution, Development Contract, UI baseline protection and the relevant architecture, backend, frontend, testing, maintenance, inventory and production rules were read. All referenced task-relevant rule files exist. The architecture discovery report was used as an index and relevant facts were verified in current source.

## DISCOVERY RESULT

The following classifications describe the source before implementation. Numbers refer to sections of the supplied task.

| Requested behavior | Discovery | Current-source evidence and gap |
| --- | --- | --- |
| 1, 30–32, 52 unified navigation, title and route | MISSING | The inventory sidebar and `/admin/inventory/finished-goods-issues` mounted the finished-goods-only panel. |
| 2, 13, 17, 20, 38–39 separate authorities | EXISTS | Maintenance required-part lines and stock issue, `ProductionMaterialDocument`, and `FinishedGoodsIssue` are the existing persistence authorities. |
| 3–5 first type and contextual form | MISSING | Finished-goods panel has one warehouse and finished-goods line editor. |
| 6–7, 12, 16, 19 warehouse/domain-scoped candidates | PARTIAL | Canonical classification exists for spare parts, finished-product definitions and production requirements. Existing editor uses generic `/products` and `/inventory/locations` adapters. |
| 8 zero-stock policy | EXISTS | Draft requests permit planning quantities. Canonical posting validates sufficiency. Selected candidates will require an existing warehouse balance, including zero balances. |
| 9–10 dependency clearing | MISSING | Existing warehouse handler retains existing product/location/batch selections. |
| 11, 13 spare-part mode | PARTIAL | Native request CRUD, submit/withdraw, approval, issue, return and replacement exist. `warehouseId` exists on the native line model but its create/update DTOs omit it. |
| 14–17 raw-material mode | PARTIAL | Native material editor and request lifecycle exist. Unified form and warehouse-scoped candidates are absent. |
| 18–20 finished-goods mode | EXISTS | CRUD, submit/withdraw, separate warehouse approval, posting and reversal exist. Selection needs warehouse scoping. |
| 21 shared adaptive line editor | MISSING | Current editor is finished-goods-specific. |
| 22 available stock | PARTIAL | Native balance queries exist. Issue editor does not display a selected-warehouse balance. |
| 23 location | PARTIAL | Inventory location backend accepts `warehouseId` and rejects foreign locations. Existing issue editor omits that filter. |
| 24–25 batch and serial | PARTIAL | Balances and native movement lines store stock identity. Existing editor accepts arbitrary text. |
| 26 UOM | EXISTS | `ProductUomSelect` and the canonical server conversion authority exist. Unified scoped candidate data and edit restoration need connection. |
| 27 manipulated payload validation | PARTIAL | Native tenant, location, run/order and posting guards exist. Draft warehouse stock identity and raw-material classification need explicit checks. |
| 28–29 unified grid | PARTIAL | Approvals service already aggregates the three native families with native statuses. Its public inbox query defaults to pending requests. A creation/tracking view needs all statuses and filters. |
| 33 warehouse approvals | EXISTS | `/admin/inventory/approvals` already shows source type and calls native decision endpoints. |
| 34 requester/warehouse separation | EXISTS | Native submit/withdraw and approve/reject endpoints, separate actors and status guards are implemented and tested. |
| 35–37 permissions and tenancy | EXISTS | Native permission families, JWT guards and operational context exist. Unified reference lookups require family-specific checks. |
| 40 discovery and narrow implementation | EXISTS | Native services and shared F9, grid, modal, error, toast, i18n and action-bar infrastructure are reusable. |
| 41–43 dependency/security/UI regressions | MISSING | Existing native tests cover their workflows. Unified type routing, reset, scoped candidate and stale-response tests need adding. |
| 44–47, 52 authenticated deployed browser proof | MISSING | Fresh task-specific browser evidence is required. Browser inventory reports unavailable access host. Native Edge binding timed out awaiting app approval. |
| 48–49 regression and release gates | EXISTS | Repository provides API/Web Jest, type checks, builds, i18n, UI baseline and route/credential guards. Fresh execution is required. |
| 50–51, 53 Git, deployment and closeout | MISSING | Task branch, tested merge, push, new artifacts, deployment and task-specific final report are required. |

## Architecture and implementation boundary

The new `/admin/inventory/issues` page reads native documents through a read-only aggregation and routes writes directly to existing native endpoints. A new persistence model or migration is unnecessary. Historical records keep their native identities and statuses.

The native approvals inbox keeps its pending-status behavior. Its existing service also supplies an explicit all-status issue-tracking query. The new controller exposes list and scoped reference queries. All mutations retain native permission decorators, status transitions, audit, numbering and inventory posting.

The shared line editor changes its item authority by issue type. Warehouse-scoped stock identity selection supplies location, batch, serial and expiry together. Product UOM options come from the selected product's active `ProductUom` rows. Historical draft edits restore the selected UOM from the linked movement snapshot.

Spare-part vouchers correspond to one native required-part line. Its existing base-unit quantity is preserved. The maintenance request supplies the machine. Existing issue/return/replacement actions remain available through the native maintenance issue screen. Raw-material candidates follow the selected order's existing DRAFT/FROZEN material requirements, including requirement warehouse restrictions. Posting still requires its frozen snapshot. Finished goods follow active tenant-scoped production product definitions.

Changing issue type clears the warehouse, contexts and all line state. Changing warehouse clears all lines. Changing production order clears run and materials. Existing entered lines require confirmation before clearing. Scoped F9 detail resolution carries lookup filters, invalidates its cache and discards stale responses. This prevents an older request from repopulating a cleared selection.

The requester filter offers names from currently displayed tenant-scoped records and retains the selected requester while filtering. It avoids a global user lookup.

## API delta

Added read endpoints under `/api/v1/inventory/issues` for the unified list, warehouses, locations, candidates and stock, including scoped reference detail resolution. No write endpoint was added to this controller.

Existing native spare-part create/update DTOs now accept the existing `warehouseId` field. Warehouse-linked creation and edits validate warehouse/stock references inside the transaction and audit with the transaction client. Legacy unallocated spare-part drafts retain their native behavior.

Finished-goods create/update and raw-material ISSUE create/update validate selected warehouse stock identity. Raw-material ISSUE products must be valid existing requirement products for their order. DTOs reject empty line arrays. Existing posting authorities retain stock sufficiency and atomic inventory effects.

Permission delta is zero. Schema/model/migration delta is zero.

## Validation evidence

All non-browser gates below were rerun after the final source edits. Logs are retained under ignored `.tmp/unified-issue-*` paths. No test was skipped, disabled, weakened, or deleted. No `|| true` construct was used.

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused API suites | PASS: 9 suites, 185 tests | `.tmp/unified-issue-focused-api.log` |
| Focused Web suites after final fallback fix | PASS: 2 suites, 31 tests | `.tmp/unified-issue-web-focus-final.log` |
| Full API regression | PASS: 227 suites, 4887 tests, 0 failures | `.tmp/unified-issue-all-api-final.log` |
| Full Web regression | PASS: 127 suites, 2371 tests, 0 failures | `.tmp/unified-issue-all-web-final.log` |
| API typecheck (`tsc --noEmit`) | PASS | `.tmp/unified-issue-api-typecheck-final.log` |
| Web typecheck (`tsc --noEmit`) | PASS | `.tmp/unified-issue-web-typecheck-final.log` |
| API build (`tsc`) | PASS | `.tmp/unified-issue-api-build-final.log` |
| Web build (`next build`) | PASS | `.tmp/unified-issue-web-build-final.log` |
| Prisma validate | PASS; placeholder connection string only, no real secret read or modified | `.tmp/unified-issue-prisma-validate-final.log` |
| UI/i18n/raw-key/permission baseline | PASS: 99 UI checks; 7317 EN keys and 7317 AR keys synchronized; 11498 literal `t()` keys resolve | `.tmp/unified-issue-ui-baseline-final.log` |
| `git diff --check` | PASS, no whitespace errors | `.tmp/unified-issue-diff-check-final.log` |
| Read-only SQL Server service proof | PASS; `businessWrites: 0` | `.tmp/unified-issue-proof/sql-proof-final.log` |
| Native draft rollback proof | NOT CERTIFIED: failed with `ETIMEOUT` at `stage:"choose-stock"`; no committed business writes | `.tmp/unified-issue-proof/draft-proof.log` |
| Authenticated deployed browser proof | NOT VERIFIED in this agent run; user-owned | final task report |

The final Web build emits `/admin/inventory/issues` (10 kB), `/admin/inventory/approvals` (5.68 kB), `/admin/inventory/finished-goods-issues` redirect stub (141 B), and `/admin/production/material-documents` (15.5 kB). The build log is the route-identity evidence; browser acceptance remains separately owned by the user.

The final SQL proof covered 11 active branch contexts with zero business writes. It checked 19 spare-part warehouses, 4 spare-part candidates, 11 wrong-warehouse denials, 23 finished-goods warehouses, 2 finished-goods candidates, 8 finished-goods wrong-warehouse denials, and one context where raw-material order requirements existed (3 warehouses, 7 candidates, 2 wrong-warehouse denials). Ten contexts had no production order with material requirements and are reported explicitly as `NO_ORDER_REQUIREMENTS` rather than as passing raw-material coverage. Two intermediate proof attempts exposed an environment `ETIMEOUT` during Prisma connect/disconnect; stage instrumentation showed the final successful run completed all proof stages and recorded zero writes. The separate native draft rollback proof could not complete because of the same SQL timeout and is therefore not used as certification.

Full Web-suite console warnings about missing translation keys originate in existing negative tests and did not fail any assertion. The full API run may emit a Jest worker-force-exit warning; all 227 suites and 4887 tests still completed successfully.

`npm run route-contract:check` is not listed in the Constitution validation order or the relevant testing-and-proof rules, but it is part of the aggregate `qa:all` script. Its final result is `MATCHED=1186`, `MISMATCHES=0`, `MALFORMED=3`, `UNRESOLVED=3`, exit 1. Four findings are new dynamic-path patterns in `issue-vouchers-panel.tsx` (final lines 196, 212, 268, 271); one unresolved finding is pre-existing in unchanged `warehouse-approvals-panel.tsx:177`. A prior clean `HEAD` archive reproduced the baseline failure (`UNRESOLVED=1`, exit 1). The checker is a static-analysis limitation around template paths, not a runtime route mismatch: native write and transition paths are exercised by focused tests and the Web build emits all canonical routes.

The final source review found no blocker. Accepted non-blockers are service-layer (not route-metadata) permission enforcement on the read-only unified queries, explicit broad `any` types on dynamic Prisma scope predicates, a transient F9 cached label before a scoped refetch, a minor `loading` flag race after a context change, requester options limited to the currently loaded page, and no filter for the raw `REQUESTED` status although it displays correctly as `SUBMITTED`. None changes tenant scope, native authority routing, stock identity, or edit-same-record behavior.

## Current closeout status

Implementation and all mandatory non-browser technical gates are complete. Git commit, push, merge, deployment, post-deploy verification, and final Git-state evidence are recorded in the final task report. Authenticated deployed browser acceptance remains pending and is owned by the user; this report does not claim browser proof.
