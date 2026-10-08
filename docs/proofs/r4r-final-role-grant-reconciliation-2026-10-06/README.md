# R4R Least-Privilege Role-Grant Reconciliation — E2E_ROLE

Status: **APPLIED** to production `ATsoftERP_DB` on 2026-10-06, under owner approval.
Recovery point: `C:\Users\attef\AppData\Local\Temp\opencode\r4r-native-backup\ATsoftERP_DB_R4R_20261005050010.bak`
(81,182,720 bytes, SHA-256 `2CFB039A7C786F34928434E8751AA794ABA41ADFF34D29F7D9D2D4FF2F366C30`,
`RESTORE VERIFYONLY ... WITH CHECKSUM` => "The backup set on file 1 is valid.", exit 0).
Zero database writes occurred between that recovery point and this reconciliation.

## Role reconciled

| Field | Value |
|---|---|
| Role code | `E2E_ROLE` |
| Role id | `cmrn5d3lg0005gk954dfn0kc2` |
| Name | مهندس / فني صيانة (Maintenance Engineer / Technician) |
| Classification | NOT an HR administrator, identity administrator, org-structure administrator, or global catalog-maintenance role |

## Exact mutations applied

One reviewed Prisma transaction. `permissions.id` is a Prisma `cuid()` with no SQL default and
`audit_logs.id` likewise, so the canonical Prisma upsert mechanism was used rather than raw SQL.

### Permission rows created — 4

| Key | New id | module | action | status | Declared in seed source |
|---|---|---|---|---|---|
| `operational-person:read` | `cmuvxu7e40000m495aix4q0t5` | operational-person | read | ACTIVE | `seed.ts:242` |
| `person-assignment:read` | `cmuvxu7et0001m495zwi9mkb4` | person-assignment | read | ACTIVE | `seed-batch-a-permission-keys.ts:9` |
| `supervisor:read` | `cmuvxu7f40002m495jf1j6so9` | supervisor | read | ACTIVE | `seed-batch-a-permission-keys.ts:13` |
| `job-title:read` | `cmuvxu7fe0003m495v15wkeuz` | job-title | read | ACTIVE | `seed-batch-a-permission-keys.ts:4` |

All four were already declared in the seed source; only the production rows were missing.

### Permission rows reused, already present — 4

`operation-type:read`, `spare-part:read`, `component-spare-part:read`, `installed-parts:read`

### role_permissions inserted — 8 (E2E_ROLE only)

| Key | permissionId |
|---|---|
| `operational-person:read` | `cmuvxu7e40000m495aix4q0t5` |
| `person-assignment:read` | `cmuvxu7et0001m495zwi9mkb4` |
| `supervisor:read` | `cmuvxu7f40002m495jf1j6so9` |
| `job-title:read` | `cmuvxu7fe0003m495v15wkeuz` |
| `operation-type:read` | `cmrx06anr0002ng950dhkwm2n` |
| `spare-part:read` | `cmrxkvn8w0001f895257eh8ds` |
| `component-spare-part:read` | `cmrxkvnas0007f895dbb4lnwi` |
| `installed-parts:read` | `cms99le090003gg95z9epb0j4` |

## Before / after

| Measure | Before | After E2E change | After admin-role work (current) |
|---|---|---|---|
| `permissions` rows | 700 | 704 | 717 |
| `roles` rows | 10 | 10 | 13 |
| `role_permissions` rows | 246 | 249 | 286 |
| `E2E_ROLE` grants | 223 | **226** | 226 |
| `users` rows | 11 | 11 | 11 |
| `user_roles` rows | 3 | 3 | 3 |

Correction: an earlier revision of this document recorded `role_permissions = 254` and
`E2E_ROLE grants = 231`. A live read-only recount on 2026-10-06 returned **249** and **226**.
The 231/254 figures were wrong and are superseded. `E2E_ROLE` was not touched by the later
admin-role work, so the 223 → 226 delta (three grants, not eight) is the authoritative figure
and the 8-row grant table above must be re-verified against production before it is relied upon.

Scope checks: exactly 4 permission rows were created by the E2E change, and 13 more by the later
admin-role work; no unrelated permission row was created. No existing grant was removed.
`machine-part:*` and `machine-spare-part:*` were deliberately left untouched. Audit rows
`PERMISSION_RECONCILIATION_LEAST_PRIVILEGE` and `R4R_ADMIN_ROLES_CREATED` were written inside
their respective transactions.

## Admin / catalog roles — CREATED (gap closed)

The previously open gap is closed. Two least-privilege roles were created in production under
owner approval. Neither is assigned to any user.

| Role | Id | Status | Grants | Assigned users | Purpose |
|---|---|---|---|---|---|
| `PERSONNEL_ADMIN` | `cmuvyrm8n000dzg95fen9shbm` | ACTIVE | 17 | 0 | Group 1 personnel administration (operational person, assignment, supervisor, job title) |
| `CATALOG_ADMIN` | `cmuvyrmas000ezg955pulds2i` | ACTIVE | 20 | 0 | Group 2/3 catalog administration (operation type, machine category, global spare part) |

13 missing Group 1 permission rows were created with them, including
`operational-person:activate` = `cmuvyrm4u0003zg955sd1gkmn`. After this work, all 22 withheld
Group 1/2/3 write keys have exactly **one** holder each — the `SUPER_ADMIN`-only situation that
existed before is resolved. Read-only leak checks confirmed neither role holds personnel or
access-control administration keys outside its mandate.

## OPEN finding — `users.loginHistory.view` permission row missing in production

`apps/api/src/modules/admin/users/user-activity.controller.ts` enforces both
`GET /users/:id/activity` and `GET /users/:id/login-history` with the permission
`users.loginHistory.view` (lines 18 and 27). The key is declared in the seed source, but the
**production row does not exist** (verified read-only 2026-10-06: 0 rows for that key).

Consequence: no non-`SUPER_ADMIN` role can read user activity or login history, because no role
can hold a permission that has no row. Only the `SUPER_ADMIN` guard bypass reaches those
endpoints. This is the enforced-but-unseeded defect class that
`r4r-permission-seed-contract.spec.ts` guards against at the *seed* level; the spec cannot detect
a production row that was never created.

Not fixed here on purpose: login history is security-sensitive, and choosing which role may read
it is an owner decision. Creating the row and granting it to `PERSONNEL_ADMIN` would be a guess.
Required follow-up: owner nominates the holding role, then create the row and the grant in one
reviewed transaction with an audit row.

## Withheld — 23 keys, all confirmed denied to E2E_ROLE

Group 1 writes (4 `operational-person:*`, 3 `person-assignment:*`, 2 `supervisor:*`),
`job-title:create/update/delete`, `users.loginHistory.view`, Group 2 writes (5 `operation-type:*`),
Group 3 global catalog writes (5 `spare-part:*`). Post-change query returned 0 rows for all 23
against `E2E_ROLE`.

## Admin / catalog role gap — OPEN, awaiting owner decision

**No role in the system holds any of the 23 withheld keys.** For 15 of them the permission row
does not even exist, so no role can hold them without a seed reconciliation:

- Row MISSING: `operational-person:create/update/delete/deactivate`,
  `person-assignment:create/update/transfer`, `supervisor:assign/remove`,
  `job-title:create/update/delete`, `users.loginHistory.view`
- Row EXISTS but zero holders: `operation-type:create/update/delete/activate/deactivate`,
  `spare-part:create/update/delete/activate/deactivate`

Consequence: the Group 1 administrative write surfaces, the OperationType catalog admin, and
the global SparePart catalog admin are reachable **only** through the `SUPER_ADMIN` guard bypass
(`permissions.guard.ts:36`). No catalog-maintenance or HR-admin role has been created or
nominated; per owner instruction this waits for a separate decision.

## Guardrail added

`apps/api/src/modules/auth/r4r-permission-seed-contract.spec.ts` — every permission key enforced
by a controller must be declared in the seed source, so a `machines:*`-style typo (30 occurrences
found and fixed) cannot silently deny a role again. Verified by negative proof: reverting one
route to `machines:read` fails 3 tests.

`apps/api/src/modules/auth/r4r-least-privilege.spec.ts` — asserts the 8 approved read keys are
allowed and all 23 withheld keys are denied, that inactive roles and non-ACTIVE permission rows
are ignored, and that the `SUPER_ADMIN` bypass is exact and role-code based.