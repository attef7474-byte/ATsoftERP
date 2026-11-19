# Cross-Prompt Inspection Pitfalls Register
Status: ACTIVE — permanent, applies to every prompt/session  
Last updated: 2026-11-20  
Provenance: Phase 2 unified receipt voucher discovery, implementation, validation, deployment, and browser proof.

## 0. العربية — قاعدة دائمة

من الآن فصاعداً، في كل برومبت، تقرأ هذا الملف قبل أي فحص أو تعديل أو تحقق. تُطبّق كل فحوصات الـ `ACTIVE CHECK` المذكورة هنا، وتُسجّل أي مشكلة جديدة تظهر أثناء الفحص في هذا الملف، ثم يُذكر في التقرير النهائي أي فحوصات تم تطبيقها. الهدف هو عدم إعادة اكتشاف نفس المشاكل أو تأخير العمل بسببها في كل مرة.

## 1. Purpose

This is the permanent, append-only register of problems already encountered during inspection, testing, migration, deployment, and browser proof. It exists so future prompts/sessions do not rediscover the same failures, reapply ad-hoc fixes from memory, or lose time to the same environment/build/test traps.

This file is an operational governance companion to `AGENTS.md`. It is not a design authority. On conflict, the Engineering Constitution, relevant domain rules, and the Permanent Development Contract remain authoritative.

## 2. Mandatory workflow — every prompt

1. **Read this register first**, before opening code, running tests, or changing files.
2. Treat every `ACTIVE CHECK` row as a pre-flight check for the relevant area.
3. If the task touches an area with a recorded problem, apply its preventive check before implementing and include the result in validation.
4. If a problem recurs, stop and reuse the recorded resolution; do not restart investigation from scratch.
5. During the task, append newly discovered problems using the template in section 6. Never write credentials, connection strings, tokens, or passwords — use `REDACTED`.
6. In the final response, state which register checks were applied and whether any new entries were added.

Entries are append-only. A status may change to `RESOLVED` only with evidence. A preventive check is never deleted merely because it passed once.

## 3. Problem ledger

| ID | Problem / symptom | Preventive check | Status |
| --- | --- | --- | --- |
| P01 | A web assertion counted every `select` option on the page instead of the intended first field, producing a misleading test result. | Scope selectors to the dialog/form and the first field (`data-testid`, role within dialog, or labeled control). Assert the exact first-field label, not a global option count. | ACTIVE CHECK |
| P02 | React `act(...)` warnings appeared during focused web tests. | Wrap state-updating interactions in `act(...)`; use fake timers for debounce/async UI; unmount in cleanup so pending timers cannot leak into later tests. | ACTIVE CHECK |
| P03 | Unified receipt pagination applied `skip` twice when merging authority result sets. | Assert `skip: 0` for each authority on page 1 and that the union receives `skip` exactly once. Keep the regression assertion for combined pagination. | ACTIVE CHECK — fixed by runtime commit `402d29c` |
| P04 | Prisma failed with `Unknown field _sum` because `_sum` was placed in `findMany` `select`. | Never use `_sum` in `findMany` `select`. Use `aggregate`, `groupBy`, or explicit count paths, and add a list-endpoint regression test. | ACTIVE CHECK |
| P05 | Route-contract checker reported dynamic template-literal route findings. | Keep route-contract-visible endpoint references as literal native paths. Expected baseline is `MALFORMED=3`, `UNRESOLVED=3`, `MISMATCHES=0`, exit `1`; do not report this baseline as a new failure. | ACTIVE CHECK / EXPECTED BASELINE |
| P06 | Stale `apps/web/.next` produced `global-not-found.js` errors after a build. | If a stale-cache error appears, clear only the build cache with `node -e "require('fs').rmSync('apps/web/.next',{recursive:true,force:true})"`, then rebuild. Never delete source files to fix this. | ACTIVE CHECK |
| P07 | Migration failed with `P3018` / SQL Server error `1088` because runtime user had `ALTER_PERM=0`. | For a reviewed schema migration, use Windows sysadmin `sqlcmd -E`, then `prisma migrate resolve --applied`. Never use `prisma migrate reset`, `db push`, destructive reset, or edit an applied migration. | ACTIVE CHECK |
| P08 | `EADDRINUSE` appeared while NSSM services auto-restarted. | Identify the actual listener with `Get-NetTCPConnection`; recycle only `ATsoftERP_API` / `ATsoftERP_Web` with `Restart-Service`; verify health after restart. Do not kill arbitrary processes. | ACTIVE CHECK |
| P09 | Production CORS blocked cross-origin browser-proof fetches. | Browser proof must use same-origin `/api/v1`. Do not add permissive CORS rules to make a proof pass. | ACTIVE CHECK |
| P10 | A browser selector matched a same-labeled background filter instead of the dialog control. | Scope selectors to the dialog, `data-testid`, or row container. Never rely on a label string alone when the same label exists in the background UI. | ACTIVE CHECK |
| P11 | Login rate limiting interrupted repeated browser-proof runs. | Restart the API service to clear the attempt counter before rerunning proof. If still blocked, report honestly; do not weaken authentication or lockout rules. | ACTIVE CHECK |
| P12 | A diagnostic `[Uri]` parse emitted `DATABASE_URL` once and had to be treated as `REDACTED`. | Never pass `DATABASE_URL` to `[Uri]`. Parse only host/database name with a regex and redact all other content. Load env-only credentials without printing them. | ACTIVE CHECK / SECURITY |
| P13 | Swagger was unavailable in production. | Absence is expected when `SWAGGER_ENABLED` is unset. Do not enable Swagger in production merely to prove routes; use authenticated route probes instead. | EXPECTED BEHAVIOR |
| P14 | 18 legacy receipts have `branchId = NULL` and are excluded under a branch context. | Mirror the native service behavior. Do not invent a branch for legacy rows; state the exclusion explicitly in proof reports. | DOMAIN NOTE |
| P15 | Runtime row-level deep-link proof was not exercised for native receipt deep links. | Unit tests assert both native deep links. If browser proof is required, create an authorized fixture first; otherwise report `NOT_VERIFIED` instead of claiming runtime proof. | KNOWN LIMITATION |
| P16 | Pre-existing non-blockers recur: global F9 `cost-snapshots` 500, Jest worker teardown warning, dynamic `t()` warnings. | Classify these as pre-existing and report them separately from new failures. Do not delete tests or weaken assertions to make them disappear. | PRE-EXISTING / WATCH |

## 4. Related standing guards from Phase 2

These are not new scope; they prevent repeated scope confusion:

* Phase 2 covered only the unified **Receipt Voucher** UI (`إذن استلام` / `Receipt Voucher`). No Phase 3, unified Issue Voucher, global Excel program, `Product.quantity`, `Product.stock`, `SparePart.quantity`, or second receipt authority is implied.
* Stock posting authority remains `InventoryOperationalReceipt` for non-FG types and `ProductionFinishedGoodsReceipt` for `FINISHED_GOOD`.
* Canonical route is `/admin/inventory/receipts`; native deep links must still work.
* Frontend must not send company/branch. Backend derives and validates tenant/branch context.
* Page visibility is the union of native read permissions via `getUserPermissionSnapshot` OR semantics; no new umbrella permission.

## 5. Quick pre-flight checklist

Copy mentally at the start of every prompt:

- [ ] Read this register before inspecting or changing anything.
- [ ] Dialog/first-field scoped selectors, not global option counts.
- [ ] React fake timers + `act` + unmount in web tests.
- [ ] Pagination: `skip: 0` per authority, union `skip` once.
- [ ] No `_sum` in `findMany` `select`.
- [ ] Literal native endpoints; route-contract baseline known and unchanged.
- [ ] Clear `apps/web/.next` only on stale-cache error.
- [ ] Reviewed migration + sysadmin `sqlcmd -E` + `migrate resolve --applied` when `ALTER_PERM=0`.
- [ ] `Get-NetTCPConnection` + `Restart-Service` for listener conflicts.
- [ ] Same-origin `/api/v1` for browser proof.
- [ ] Scoped browser selectors; no same-label collisions.
- [ ] Restart API before repeating login proof.
- [ ] Regex env parsing; credentials `REDACTED`; never `[Uri]` on `DATABASE_URL`.
- [ ] Separate pre-existing failures from new failures.
- [ ] Append new findings here and mention applied checks in the final report.

## 6. Append template for new problems

```md
| PXX | YYYY-MM-DD | Symptom observed | Root cause | Preventive check / exact command | Evidence / status |
```

Use `ACTIVE CHECK` until the preventive step is verified in a later task. Use `RESOLVED` only with a commit, test output, or runtime evidence reference.

## 7. Application log

| Date | Task | Checks applied | New entries |
| --- | --- | --- | --- |
| 2026-11-20 | Created this register and added `AGENTS.md` pointer | Documentation-only task; no code/build/runtime checks invoked | P01–P16 seeded from Phase 2 closeout |
