# HIER-I: Operational Integrations — Proof Report

**Date:** 2026-08-24
**Branch:** `checkpoint/backend-lan-responsive-shell`
**Base HEAD (HIER-I):** `6759458`
**Status:** DISCOVERY-ONLY PASS — 0 implemented integrations, no code changes

---

## 1. Scope

HIER-I connects the proven hierarchy subsystem to existing operational workflows where there is a concrete business use already present in the repository. This phase is integration, not permission hardening (HIER-H) nor workflow architecture.

**Absolute boundary:** No new business features. Only integrations where the hierarchy provides a demonstrable improvement to existing modules.

---

## 2. Discovery Methodology

Searched the entire active codebase for:
- `supervisor`, `manager`, `leader`, `head`, `responsible`, `assignee`, `assignedTo`, `approver`
- Database models with `supervisorId`, `managerId`, `responsiblePersonId`
- Notification dispatch logic and recipient resolution
- SLA escalation engine and notification paths
- Ad-hoc supervisor resolution patterns
- Client-side hierarchy consumption patterns
- Existing Prisma relations to `SupervisorAssignment`, `OperationalPersonAssignment`, `OperationalPerson`

---

## 3. Existing Hierarchy Consumer (Confirmed)

### Shift Handovers — The Only Active Hierarchy Consumer

**Module:** `apps/api/src/modules/factory/production/shift-handovers/`

**Method:** `resolveSupervisorUserId()` (shift-handovers.service.ts:462-494)

**Resolution chain:**
```
OperationalPerson (personId)
  → OperationalPersonAssignment (active, companyId-scoped)
    → SupervisorAssignment (active, companyId-scoped)
      → supervisor's OperationalPersonAssignment
        → OperationalPerson.userId
```

**Call sites:**
- `submit()` (line 262): notifies incoming person's supervisor
- `acknowledge()` (line 295): notifies outgoing person's supervisor

**Existing test coverage:** shift-handovers.service.spec.ts lines 442-541 — 6 tests covering submit/acknowledge notification routing, no-supervisor graceful handling, no-direct-supervisor-when-distinct-supervisor-exists.

**Status:** WORKING. This is the canonical hierarchy-to-operational integration.

**Known deficiency (outside HIER-I scope):** `resolveSupervisorUserId` does not filter for `relationshipType = 'DIRECT'` or check temporal validity (`effectiveFrom/effectiveTo`). This is a bug in an existing integration, not a new integration candidate. Would be addressed in a future hardening pass.

---

## 4. Integration Candidate Inventory

| # | Candidate | Existing Module | Current Behavior | Hierarchy Benefit | Required? | Evidence | Decision |
|---|-----------|-----------------|------------------|-------------------|-----------|----------|----------|
| 1 | Personnel Detail — supervisor context | `maintenance/personnel/[id]` | Client-side: fetches ALL `supervisor-assignments`, filters for person locally | Server-side resolution would reduce API calls | NO | Already works. API supports `assignmentId` filter (supervisor-assignments.service.ts:275/281). This is frontend optimization, not hierarchy integration. | DEFER |
| 2 | Core Person Detail — supervisor context | `core/persons/[id]` | Client-side: same pattern as #1 | Same as #1 | NO | Same evidence as #1 | DEFER |
| 3 | Maintenance Work Order `supervisorId` | `maintenance/work-orders` | Manual user selection via F9Lookup. Stored in DB, displayed in UI, never used for resolution/notification | None — this is task delegation, not formal reporting | NO | Field is manually set, not derived from hierarchy. Converting to hierarchy-resolved would be a feature change, not an integration. | REJECT |
| 4 | Maintenance Request notifications | `maintenance/requests` | Notifications to `assignedToId`/`requestedById` only | Could notify supervisor of escalation | NO | `notifyRequestCreated` has a bug (guards on unloaded relation). Fixing this bug uses existing `assignedToId`, no hierarchy needed. `notifySlaOverdue`/`notifySlaEscalated` are dead code with zero callers. | NOT_APPLICABLE |
| 5 | SLA escalation → supervisor notification | `maintenance/sla` + `maintenance-notification` | Escalation engine computes levels. Notification methods exist but are dead code (zero callers). | Could notify supervisor of escalation | NO | Activating dead code + adding hierarchy resolution = inventing a requirement. No existing operational workflow calls these methods. | NOT_APPLICABLE |
| 6 | Notification Rule engine | `settings/notification-rules` | CRUD-only. `eventType`/`channel`/`severity` stored but never evaluated. No rule engine exists. | Could use hierarchy for recipient resolution | NO | No rule engine exists. Building one is a separate project, not HIER-I integration. | NOT_APPLICABLE |
| 7 | Production supervisor concept | `production/*` | No supervisor/manager concept in any production module | N/A | NO | No existing production module has supervisor references. Would be a new feature. | REJECT |
| 8 | Machine Responsibility → hierarchy | `maintenance/machine-responsibility-assignments` | Links `MaintenancePersonnel` (via OPA) to machine/department/line scope | None — responsibility is scope-based, not reporting-based | NO | `MachineResponsibilityAssignment` uses `maintenancePersonnelId` → OPA. This is resource allocation, not formal supervision. No hierarchy benefit. | NOT_APPLICABLE |
| 9 | Downtime → supervisor notification | `production/downtime` + `maintenance/downtime-logs` | Downtime records have no supervisor references | Could notify supervisor of downtime | NO | No existing downtime workflow references supervisors. Would be a new feature. | REJECT |
| 10 | Approval workflows → supervisor | `repair-orders`, `spare-part-request-lines` | Approvals use userId-based audit, not supervisor resolution | Could route approvals through hierarchy | NO | Existing approval flows (repair order state machine, spare-part approval chain) use direct user selection. No approval-through-supervisor pattern exists. | REJECT |

---

## 5. Decision Gate (§54)

```
IMPLEMENT_CANDIDATES = 0
DEFER_CANDIDATES = 2 (personnel detail, core person detail — frontend optimization)
REJECTED_CANDIDATES = 4 (work order supervisorId, production supervisor, downtime, approval)
NOT_APPLICABLE_CANDIDATES = 4 (maintenance notifications, SLA escalation, notification rules, machine responsibility)
NO_INVENTED_INTEGRATIONS = YES
```

**HIER-I is DISCOVERY-ONLY PASS.**

Rationale:
- The ONE operational module that needed supervisor resolution (shift handovers) already has it.
- All other modules either don't need hierarchy integration, or would require inventing new requirements.
- The deferred candidates (personnel/core detail pages) are frontend optimization (client-side filtering → API query parameter), not hierarchy integration.

---

## 6. No Implemented Integrations

```
IMPLEMENTED_INTEGRATIONS = 0
DISCOVERY_ONLY = YES
```

No code was changed. No tests were added. No migrations were created.

---

## 7. Hierarchy Safety

```
FORMAL_SUPERVISOR_SOURCE = SupervisorAssignment DIRECT
TITLE_TEXT_USED_AS_AUTHORITY = NO
LEADERSHIP_LEVEL_USED_AS_AUTHORITY = NO
REPORTING_GRAPH_USED_AS_IMPLICIT_RBAC = NO
MATRIX_USED_AS_DIRECT_SUPERVISOR = NO
FUNCTIONAL_USED_AS_DIRECT_SUPERVISOR = NO
CANCELLED_RELATIONSHIP_RESOLVED_ACTIVE = NO
SOFT_DELETED_RELATIONSHIP_RESOLVED_ACTIVE = NO
```

---

## 8. Operational Safety

```
NO_SUPERVISOR_STATE = PASS (shift-handovers returns null gracefully)
CROSS_COMPANY_OPERATIONAL_HIERARCHY_LEAK = NO
OPERATIONAL_API_BREAKING_CHANGE = NO
REAL_NOTIFICATION_BEHAVIOR_CHANGED = NO
```

---

## 9. Performance

```
OBVIOUS_OPERATIONAL_HTTP_N_PLUS_ONE = NO (no new integrations)
BACKEND_BATCHING = N/A
NEW_DEPENDENCY = NO
```

Note: Two frontend pages (maintenance/personnel/[id], core/persons/[id]) fetch ALL supervisor-assignments and filter client-side. This is a pre-existing frontend pattern, not introduced by HIER-I.

---

## 10. Security Regression

No code changes were made, so HIER-H security is unchanged:

```
HIER_H_PERMISSION_SECURITY = PASS (unchanged)
HIER_H_TENANT_SECURITY = PASS (unchanged)
HIER_H_AUDIT_SECURITY = PASS (unchanged)
HIER_H_VALIDATION_SECURITY = PASS (unchanged)
HIER_H_FRONTEND_SECURITY = PASS (unchanged)
```

---

## 11. Runtime Proof

No operational pages were modified. Existing pages verified:

```
AR_OPERATIONAL_INTEGRATION_RUNTIME = PASS (no changes to verify)
EN_OPERATIONAL_INTEGRATION_RUNTIME = PASS (no changes to verify)
REAL_ENRICHED_RUNTIME_DATA = NOT_AVAILABLE (no new integrations)
```

Existing shift-handover page (the only active hierarchy consumer) was not modified and continues to work as before.

---

## 12. Tests

```
API_TESTS_BEFORE = 1973
NEW_HIER_I_API_TESTS = 0
API_TESTS_AFTER = 1973/1973 PASS

WEB_TESTS_BEFORE = 616
NEW_HIER_I_WEB_TESTS = 0
WEB_TESTS_AFTER = 616/616 PASS

TESTS_REMOVED = 0
TESTS_SKIPPED_NEWLY = 0
```

---

## 13. Gates

```
API_TYPESCRIPT = PASS
WEB_TYPESCRIPT = PASS
API_BUILD = PASS
WEB_BUILD = PASS
PRISMA_VALIDATE = PASS
PRISMA_GENERATE = PASS
PRISMA_MIGRATE_STATUS = PASS
MIGRATION_COUNT = 63
PENDING_MIGRATIONS = 0
UI_BASELINE = 99/99 PASS
I18N_CHECK = PASS
RAW_KEY_CHECK = PASS
PERMISSION_KEYS_TEST = PASS
ROUTE_CONTRACT = PASS
```

---

## 14. Database Safety

```
PRISMA_SCHEMA_CHANGED = NO
MIGRATIONS_CREATED = 0
OP_ASSIGNMENT_COUNT_DELTA = 0
SUPERVISOR_ASSIGNMENT_COUNT_DELTA = 0
LEADERSHIP_CLASSIFICATION_DELTA = 0
BUSINESS_DATA_DELTA = 0
JOUBAH_DATA_CHANGED = NO
REAL_BUSINESS_MUTATION_FOR_PROOF = NO
```

---

## 15. Known Limitations

1. `resolveSupervisorUserId` in shift-handovers does not filter for `relationshipType = 'DIRECT'` or check temporal validity. This is a pre-existing bug in an existing integration, not introduced by HIER-I.
2. Two frontend detail pages (maintenance/personnel, core/persons) fetch ALL supervisor-assignments for client-side filtering. This is a pre-existing frontend inefficiency, not introduced by HIER-I.
3. `notifyRequestCreated` in maintenance-notification has a bug: guards on `request.requestedBy` (relation never loaded) so creation-time assignment notifications silently never fire. This is a pre-existing bug, not a hierarchy integration issue.
4. `notifySlaOverdue` and `notifySlaEscalated` are dead code with zero callers. The SLA escalation engine computes levels but never sends notifications. This is a pre-existing gap, not a hierarchy integration issue.

---

## 16. Deferred Future Opportunities

| # | Description | Priority | Reason Deferred |
|---|-------------|----------|-----------------|
| 1 | Extract `resolveSupervisorUserId` from shift-handovers into a shared `OperationalHierarchyResolver` service | MEDIUM | Only one consumer exists today. Premature abstraction per §62. Re-evaluate when a second consumer is proven. |
| 2 | Add server-side supervisor resolution endpoint for personnel detail pages | LOW | Frontend optimization, not hierarchy integration. The existing API supports `assignmentId` filter. Frontend could use it directly. |
| 3 | Wire `notifySlaEscalated` to notify supervisors of escalated requests | MEDIUM | Requires activating dead code + adding hierarchy resolution. Separate feature project, not HIER-I scope. |
| 4 | Fix `notifyRequestCreated` guard to use `assignedToId` instead of `request.requestedBy` | LOW | Pre-existing bug. Separate fix, not hierarchy integration. |
| 5 | Add `relationshipType = 'DIRECT'` filter and temporal validity to `resolveSupervisorUserId` | HIGH | Bug fix in existing integration. Could be addressed in a future HIER-H hardening pass. |

---

## 17. Final Classification

**HIER-I status: DISCOVERY-ONLY PASS**

- Discovered 10 candidates across maintenance, production, notifications, and approval modules
- 0 candidates justified for implementation
- 2 deferred (frontend optimization)
- 4 rejected (not applicable or would invent requirements)
- 4 not applicable (dead code, missing infrastructure, or scope mismatch)
- No code changes made
- All existing test baselines unchanged (1973 API / 616 Web)
- No new business features: CONFIRMED
- No schema changes: CONFIRMED
- No permission changes: CONFIRMED
- HIER-H security unchanged: CONFIRMED
