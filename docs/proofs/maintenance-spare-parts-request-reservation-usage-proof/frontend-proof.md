# Frontend Proof — Maintenance Spare Parts Request + Reservation + Usage Proof

## Changes

### Type Definitions
**File:** `apps/web/src/lib/admin-types/maintenance.ts`

Added `SparePartRequestLine` interface with all workflow fields.

### Request Detail Page
**File:** `apps/web/src/app/admin/maintenance/requests/[id]/page.tsx`

#### Parts Tab (replaces placeholder)
- Spare part request lines list
- F9 spare part lookup (uses existing `sparePartAdapter`)
- Quantity input
- Reason text field
- Usage notes field
- Status badges per line
- Workflow action buttons per line:

| Button | Shows for status | API call |
|---|---|---|
| Request Spare Part | DRAFT | PATCH :lineId/request |
| Approve Spare Part | REQUESTED | PATCH :lineId/approve |
| Reject Spare Part | REQUESTED | PATCH :lineId/reject |
| Operational Reservation | APPROVED | PATCH :lineId/reserve |
| Mark Part Used | RESERVED, APPROVED | PATCH :lineId/use |
| Cancel Request | DRAFT, REQUESTED, APPROVED, RESERVED | PATCH :lineId/cancel |

- "Add Spare Part" button opens inline form with F9 selector
- Real API calls with error handling
- No stock deduction UI
- Warning: "Stock is not deducted in this phase"

### i18n Namespace Added
- `sparePartRequest` — added to `TranslationNamespace` type
- English keys: 34
- Arabic keys: 34
- 2474/2474 keys synchronized

### Preserved
- All existing tabs (overview, tasks, downtimeLogs, assign, assignments, partAccountability, costs)
- Delete/edit/code immutability
- Action bar visibility
- F9 preload
- Select preload
