# Phase 6 Audit Persistence Proof — 2026-11-21

Status: COMPLETE

## 1. Audit model reality

`AuditLog` in `apps/api/prisma/schema.prisma` has `userId`, `action`, `entity`, `entityId`, `details`, `ip`, `userAgent`, and `createdAt`. It has no direct `companyId`, `branchId`, employee, previous/new, or reason columns. Business audit scope is carried in the serialized `details` JSON.

An initial probe selected nonexistent `companyId` / `branchId` columns and failed with `Unknown field companyId for select statement on model AuditLog`. The probe was corrected to read scope from `details` and actor home scope from the `user` relation. No application code was changed for the probe.

## 2. Export action totals in the live DB

| Action | Total rows |
| --- | ---: |
| `EXPORT` | 10 |
| `EXCEL_EXPORT` | 2 |
| `EXCEL_IMPORT` | 6 |

These counts include historical rows. The Phase 6 browser proof produced four new export-like rows after deployment.

## 3. New Phase 6 export audit rows

| Time UTC | Action | Actor present | Active company in details | Active branch in details |
| --- | --- | --- | --- | --- |
| 2026-11-21T20:07:16Z | `EXPORT` | yes | `cmrvaph2200009g95oj1o8m1j` | `cmrvaph4100019g95kisacppa` |
| 2026-11-21T20:08:06Z | `EXPORT` | yes | `cmrvaph2200009g95oj1o8m1j` | `cmrvaph4100019g95kisacppa` |
| 2026-11-21T20:09:18Z | `EXCEL_EXPORT` | yes | `cmrvaph2200009g95oj1o8m1j` | `cmrvaph4100019g95kisacppa` |
| 2026-11-21T20:09:42Z | `EXCEL_EXPORT` | yes | `cmrvaph2200009g95oj1o8m1j` | `cmrvaph4100019g95kisacppa` |

All four rows have `userId`. Actorless export-like row count: 0.

## 4. Writer paths verified

* Canonical report XLSX/CSV export writes `EXPORT` with endpoint, actor, active company, active branch, row count, truncation flag, and timestamp in `details`.
* Governance Excel export writes `EXCEL_EXPORT` with user, active company, active branch, route, row count, and filters in details.
* Existing Excel import writes `EXCEL_IMPORT`; no Phase 6 runtime import was executed.

## 5. Audit report visibility caveat

`/reports/audit` filters by the actor's home `companyId` / `branchId` through the `user` relation because `AuditLog` has no direct tenant columns. The proof token's active export context was a company different from the actor user's home company. Therefore the four persisted audit rows were visible in the database but not in that context-filtered audit report view. This is a report-scope limitation, not missing persistence.

Switching the SUPER_ADMIN session to the actor's authorized home context aligns the report filter with the actor scope; the DB evidence remains authoritative for this proof.

## 6. Probe cleanup

All in-repo throwaway probes (`phase6-audit-probe.throwaway.cjs`, browser token helpers, RBAC probe, and reconciliation probe) were explicitly deleted from `apps/api` before staging. Final `git status --short --branch` showed no untracked throwaway helpers.

## 7. Conclusion

Actor-scoped export audit persistence is proven in the live database. The report-view limitation is documented rather than hidden. Audit persistence status is COMPLETE.
