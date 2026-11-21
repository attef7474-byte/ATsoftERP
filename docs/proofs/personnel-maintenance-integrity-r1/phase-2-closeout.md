# Personnel / Maintenance Phase 2 closeout

Task date: 2026-11-22 (Asia/Aden). Status: **COMPLETE**.

Phase 2 only: shared maintenance row visual states. Phase 3 was not started.

## Scope and root cause

All three lists already used `AdminDataGrid`, directly or through `EntityDataTable`.
Its body rows supported only zebra/selection/hover backgrounds and had no semantic
row-state callback. The downtime list also omitted linked execution state, so a
stopped machine's `startTime` could not establish whether repair had begun.

`getRowTone(record)` now accepts `normal`, `attention`, or `in-progress`.
Domain policy lives in `maintenance-row-tones.ts`; one shared grid CSS module owns
presentation. Pages contain no row-color CSS, and no database color field exists.

| Domain | Attention / light red | In progress / light orange | Normal |
| --- | --- | --- | --- |
| Requests | OPEN | IN_PROGRESS | COMPLETED, CLOSED, CANCELLED, other states |
| Work orders | DRAFT, PLANNED | IN_PROGRESS | COMPLETED, CANCELLED, other states |
| Downtime | Open with no repair evidence | Repair timestamp, active execution or started execution, legacy IN_PROGRESS request when no execution is linked | Closed/cancelled stop, repair completion timestamp, DONE/completed execution, completed legacy request |

Downtime stop/first-response timestamps never imply repair. A pending execution
without `startedAt` remains red; a cancelled execution does not prove ongoing
repair. Execution evidence takes precedence over the legacy request fallback.
Repair completion can render normal even if the stop awaits a separate closure.
Existing lifecycle status badges remain authoritative and visible.

Selected blue rows and their inset outline take precedence over semantic tones,
including on hover. Unselected semantic rows retain red/orange hover variants;
normal rows retain zebra styling. The supported dark appearance has corresponding
backgrounds, readable cell text and readable action icons. `aria-selected` exposes
selection independently from the business-state badge. Existing row-action guards,
permission filtering and action handlers are preserved.

## Integration and ownership

- Existing feature branch: `fix/personnel-maintenance-integrity-r1-integrated`.
- Phase 1 preserved at `b1d2e15dfa3651767f005cfaeba4fcfb3e9945f1`.
- Fresh upstream baseline: `origin/main = 8c62740f3c95890a9daa99c93bf32aa5efe80026`.
- Semantic merge: `24d83b78af4c02f56e4f329a71f3d0f44fa19ffb`.
- Phase 2 implementation: `53b95cccf9d7dc2b5c17ff84057db5fb691eefc3`.
- Implementation pushed; `git ls-remote` returned the same full SHA.
- Integration began with a clean worktree, 3 ahead / 5 behind; after the merge it
  was 4 ahead / 0 behind. Both upstream and Phase 1 are verified ancestors.
- Only overlapping files were API messages and the pitfalls register. The message
  addition merged without conflict. The register retained both append histories.
- `origin/main` contained P01–P46; P47–P51 were read from the closed Phase 6 proof
  branch and preserved in the necessary shared-register reconciliation.
- All original 47 root-workspace files remain byte-for-byte unchanged: 43 Phase 1
  files, 2 shared/governance files, 2 other-agent proof files. They were not staged.
- The Phase 2 implementation commit contains exactly 20 explicit paths. This
  closeout is the sole additional documentation path. Ownership classifications
  are in [phase-2-ownership-proof.json](phase-2-ownership-proof.json): own Phase 2
  work or required shared grid/contract/governance changes; unknown files 0;
  other-agent files staged 0.
- Phase 6 Excel, permission seed, actor-aware audit, reporting/export and inventory
  authorities remain unchanged after integration. P01–P51 and all Phase 1 findings
  are preserved. No reset, clean, broad staging, force push or history rewrite.

## Files created

- `apps/api/scripts/personnel-phase2-proof.cjs`
- `apps/web/src/components/admin/datagrid/row-tone.module.css`
- `apps/web/src/lib/maintenance-row-tones.ts`
- `apps/web/tests/grid-row-tone.test.ts`
- `apps/web/tests/maintenance-row-tones.test.ts`
- This closeout and the three accompanying Phase 2 JSON proofs in this directory:
  ownership, runtime/browser, and Phase 1 regression.

## Files modified

- `apps/api/src/modules/factory/maintenance/downtime-logs/downtime-logs.service.ts`
- `apps/api/src/modules/factory/maintenance/downtime-logs/downtime-logs.service.spec.ts`
- `apps/web/src/app/admin/maintenance/requests/page.tsx`
- `apps/web/src/app/admin/maintenance/work-orders/page.tsx`
- `apps/web/src/app/admin/maintenance/downtime-logs/page.tsx`
- `apps/web/src/components/admin/admin-data-grid.tsx`
- `apps/web/src/components/admin/datagrid/admin-data-grid.tsx`
- `apps/web/src/components/admin/datagrid/body-row.tsx`
- `apps/web/src/components/admin/datagrid/index.ts`
- `apps/web/src/components/admin/datagrid/types.ts`
- `apps/web/src/lib/admin-types/maintenance.ts`
- `docs/governance/inspection-pitfalls-register.md` (one new Phase 2 preventive check).

## Database, API, routes and permissions

No schema, model, index or migration changed. The latest migration remains
`20261120160000_add_general_inventory_issue`. No migration was applied.

Existing `GET /api/v1/maintenance/downtime-logs` now adds only execution
`status/startedAt/completedAt` and the linked request's `status`. Both optional
relations carry explicit active company/branch predicates; machine scope and
request soft-delete filtering apply as well. The parent list remains paginated.
No endpoint, write behavior, permission or permission seeding was added or changed.

Existing frontend routes changed visually:
`/admin/maintenance/requests`, `/admin/maintenance/work-orders`, and
`/admin/maintenance/downtime-logs`. No route was added. No user-facing translation
text was introduced; existing translated status badges remain in use.

## Tests and validation

| Gate | Actual result |
| --- | --- |
| Phase 1 / Phase 6 reconciliation focus | 8 API suites / 123 tests passed |
| New semantic mapping and shared-grid tests | 2 web suites / 41 tests passed |
| Downtime service / explicit relation scope | 1 API suite / 16 tests passed, including the new query-scope test |
| Full API regression | 260 suites / 5298 tests passed |
| Full web regression | 137 suites / 2564 tests passed |
| API typecheck and build | PASS |
| Web typecheck and final production build | PASS; 199 pages generated |
| Prisma validation | PASS; schema/migrations unchanged |
| i18n parity | 7644 EN / 7644 AR keys; 100% match, no empty values |
| UI baseline / raw keys / permission UI | PASS |
| Credentials checker, including staged new files | PASS |
| Unstaged and staged diff checks / LF / conflict-marker scan | PASS |
| Route contract | Known baseline: MALFORMED=3, UNRESOLVED=3, MISMATCHES=0, exit 1 |

The new tests exercise terminal and unknown states, stop versus repair timestamps,
pending/started/cancelled/completed execution evidence, legacy request fallback,
selection, alternating rows, RTL/LTR, state refresh through `EntityDataTable`, and
interactive-element click guards. API assertions verify exact scoped relation
predicates and shared pagination/count filters rather than merely mocking denial.

## Runtime and browser evidence

Authoritative machine-readable evidence:
[phase-2-runtime-browser-proof.json](phase-2-runtime-browser-proof.json).
Final result: PASS, 15 checks, 32 visual observations, 14 local screenshots,
minimum measured normal text contrast **7.95:1**, failed required APIs **0**,
network failures **0**, unexpected console/JavaScript errors **0**.
The report's SHA256 matches the current committed proof script; start/end times,
run ID, fixture IDs and cleanup outcomes are recorded.

The final built UI ran through a loopback same-origin proxy at
`http://127.0.0.1:3320`, an isolated API, and a verified SQL Server COPY_ONLY restore
named `ATsoftERP_PERSONNEL_P2_20261122`. Production services were not changed.
Operational states were generated through real create/start/leave/complete/cancel
endpoints. Controlled malformed-link probes existed only in the disposable clone.

EN/LTR and AR/RTL each proved all three list mappings, red hover, orange dark hover,
enabled action menus, existing badges, and dark cell/action-icon contrast. Each
locale also proved selected-row readability and selected dark appearance on the
request list through the shared engine. Screenshots under ignored
`test-results/personnel-p2-*.png` were visually inspected. They are not build/source
artifacts staged into Git.

A real row-menu action then started the same OPEN request: the browser's PATCH
succeeded, the refreshed row became orange, SQL retained the same ID with
IN_PROGRESS, and the acting user's START audit persisted. Execution START audits
also persisted. Inventory movement count and all pre-existing request/order/task/
downtime/audit IDs were reconciled and preserved.

Normal scoped actors proved permission denial, foreign company list/read/edit/
reference denial, company-context spoof rejection, and unauthorized same-company
branch rejection. The intentionally malformed stop could expose neither the
foreign execution nor foreign request. Browser-only elevation used a distinct
clone fixture; final temporary SUPER_ADMIN grants **0**, fixture actors deactivated
**4**, open fixture labor sessions **0**. Audit/history remains available in the
clone for review.

Phase 6's canonical **61/61** governance permissions remain seeded in the fresh
clone. Its authority files were compared after integration and its audit/export/
permission tests passed as part of full regression.

Phase 1 was also rerun end-to-end after integration:
[phase-2-phase-1-regression.json](phase-2-phase-1-regression.json): PASS, 28 checks,
EN/LTR + AR/RTL validation/create/edit/history/transfer proof, tenant/permission
denials, original records preserved, inventory unchanged, temporary grants **0**.
Only require paths and output location were adapted in an ignored copy of the
original harness; the original Phase 1 script and committed evidence are unchanged.

## Existing issues and proof limitations

- Exact retained non-API browser error:
  `http://127.0.0.1:3320/favicon.ico` → 404. Source: the browser's native favicon
  request. `origin/main` contains neither `apps/web/src/app/favicon.ico` nor
  `apps/web/public/favicon.ico`; a fresh independent read of the already deployed
  `http://localhost:3000/favicon.ico` also returned 404. The console entry remains
  in the proof and is classified explicitly; it is unrelated to Phase 2.
- The six route-contract findings above and dynamic-translation fallback warnings
  remain pre-existing. No required API failure was hidden.
- Early harness runs corrected a wrong downtime URL and an immediate hover-style
  sample. The final fresh run passed with canonical routes and settled CSS; the
  transition timing issue is recorded as `PERSONNEL-P2-01`.
- Runtime proof certifies the integrated feature build on SQL Server clones.
  Phase 2 does not request a production deployment or a merge into main.
- Clone fixtures and audit history are retained for review, with fixture access
  deactivated. Production operational data was never used for test writes.

## Applied governance and release receipt

Applied P01, P02, P05, P09, P10, P12, P16, P20, P22, P23, P31, P36, P37,
P41–P46, P48 and PERSONNEL-P1-01/04/05/06/08/09. Added only
`PERSONNEL-P2-01`; preserved P01–P51 and PERSONNEL-P1-01 through 09.

The implementation push was verified at
`53b95cccf9d7dc2b5c17ff84057db5fb691eefc3` on the existing dedicated feature
branch. This closeout is committed and pushed separately; its final local/remote
SHA is verified in the release output. No tag, main merge or deployment requested.
The integration worktree was clean after the implementation push; the original
root workspace intentionally retains its unchanged parallel-work baseline.

```text
PHASE 2 — COMPLETE
SHARED_ROW_STATE_ENGINE=PASS
MAINTENANCE_REQUEST_ROW_STATES=PASS
WORK_ORDER_ROW_STATES=PASS
DOWNTIME_ROW_STATES=PASS
NEXT_PHASE_READY=YES
WAITING_FOR_USER_COMMAND:
انتقل لتنفيذ المرحلة التالية
```
