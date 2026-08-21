# HIER-G Transfer Supervision Synchronization Proof

**Date:** 2026-08-21  
**Branch:** `checkpoint/backend-lan-responsive-shell`  
**Base Commit:** `ea949ec` (HIER-F)

## Summary

HIER-G implements **Person Assignment Transfer + Supervision Relationship Synchronization + Team Reconciliation + History Preservation**. When a person's PRIMARY assignment is transferred to a new department/branch, any affected supervision relationships (both inbound and outbound) are discovered, classified by temporal status, and reconciled with explicit user-resolvable actions.

## Backend Implementation

### New DTOs
- `transfer-preview.dto.ts` — `TransferPreviewDto` mirrors transfer fields for read-only preview
- `transfer-apply.dto.ts` — `TransferApplyDto` with optional `relationshipResolutions: RelationshipResolutionDto[]`; `@ArrayUnique` validation

### New Service Methods
| Method | Purpose |
|--------|---------|
| `transferPreview()` | Read-only discovery of affected relationships with human context |
| `discoverAffectedRelationships()` | Finds inbound (supervisor of old) + outbound (subordinate of old) |
| `classifyTemporalCategory()` | HISTORICAL / CURRENT / FUTURE classification |
| `getAllowedResolutions()` | Per-category allowed actions |
| `validateResolutions()` | Foreign, missing, invalid-action checks |
| `closeRelationshipInTx()` | Close at transfer date, isActive=false |
| `createContinuationInTx()` | Full HIER-A validation (cycle, self, branch, DIRECT conflict) |
| `detectCycleInTx()` | Transaction-safe cycle detection for DIRECT relationships |

### Controller Endpoints
| Endpoint | Permission | Description |
|----------|------------|-------------|
| `POST /person-assignments/:id/transfer/preview` | `person-assignment:transfer` | Read-only impact preview |
| `POST /person-assignments/:id/transfer` | `person-assignment:transfer` | Apply transfer with reconciliation |

### Service Exports
`intervalsOverlap`, `isEffectivelyActive`, `assertBranchCompatible` exported from `supervisor-assignments.service.ts` for reuse.

## Frontend Implementation

### Multi-Step Transfer Workflow
1. **Step 1: New Placement** — Branch, administration, department, job title, leadership level, date
2. **Step 2: Impact Preview** — Calls `POST /transfer/preview`, shows affected relationships with human-readable context
3. **Step 3: Resolve Relationships** — Each non-historical relationship has resolution buttons (END_AT_TRANSFER / CONTINUE_ON_NEW_ASSIGNMENT)
4. **Step 4: Confirm Transfer** — Summary of what will happen with counts
5. **Step 5: Result** — Success with ended/continued counts

### Types Added
- `TransferPreviewResponse`, `TransferApplyRequest`, `TransferApplyResponse`
- `AffectedRelationship`, `AffectedRelationshipOtherParty`
- `RelationshipResolutionAction`, `TemporalCategory`, `RelationshipDirection`

### i18n Keys
- 42 top-level EN keys + 8 nested keys = 50 EN keys
- 42 top-level AR keys + 8 nested keys = 50 AR keys
- All synchronized between EN and AR

## Test Results

### Backend
- **HIER-G tests:** 22 pass (preview: 7, reconciliation: 13, temporal: 2)
- **Total API tests:** 1884 pass (baseline 1862 + HIER-G 22)
- **Test suites:** 116 pass

### Frontend
- **HIER-G tests:** 119 pass (i18n: 96, types: 7, logic: 16)
- **Total Web tests:** 538 pass (baseline 419 + HIER-G 119)
- **Test suites:** 13 pass

## Gates

| Gate | Result |
|------|--------|
| API tests | PASS (1884/1884) |
| Web tests | PASS (538/538) |
| API TypeScript | PASS (clean) |
| Web TypeScript | PASS (clean) |
| API build | PASS |
| Web build | PASS |
| Prisma generate | PASS |
| UI baseline | PASS (99 checks) |
| git diff --check | PASS |

## Safety Rules Enforced

1. **No silent carries** — Every affected non-historical SupervisorAssignment must have explicit resolution
2. **Serializable transaction** — Transfers with reconciliation use `Serializable` isolation
3. **Half-open intervals** — Old ends at T-1, new starts at T, no overlap
4. **HIER-A validation preserved** — Cycle detection, self-reference, branch compatibility, DIRECT conflict all enforced for continuations
5. **Backward compatible** — Zero affected relationships proceeds without resolutions
6. **Leadership defaults to NONE** — Transfer never auto-inherits leadership level
7. **Audit logging** — Every transfer, relationship end, and relationship continue is audited

## Files Created
- `apps/api/src/modules/admin/person-assignments/dto/transfer-preview.dto.ts`
- `apps/api/src/modules/admin/person-assignments/dto/transfer-apply.dto.ts`
- `apps/api/src/modules/admin/person-assignments/hier-g-transfer-reconciliation.spec.ts`
- `apps/web/tests/hier-g-transfer-workflow.test.ts`

## Files Modified
- `apps/api/src/modules/admin/person-assignments/person-assignments.service.ts`
- `apps/api/src/modules/admin/person-assignments/person-assignments.controller.ts`
- `apps/api/src/modules/admin/person-assignments/person-assignments.service.spec.ts`
- `apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.service.ts`
- `apps/web/src/app/admin/core/person-assignments/page.tsx`
- `apps/web/src/lib/admin-types/core.ts`
- `apps/web/src/lib/i18n/locales/en/core.ts`
- `apps/web/src/lib/i18n/locales/ar/core.ts`
- `apps/web/tests/hier-d-leadership-roles.test.ts`

## Status: COMPLETE
