# Analysis — Maintenance Spare Parts Request + Reservation + Usage Proof (Batch L)

## Current State Audit

### Models/Tables

| Area | Model/Table | Current behavior | Missing behavior | Decision |
|---|---|---|---|---|
| Spare part catalog | `SparePart` (spare_parts) | Full CRUD, F9 lookup, links to Product | No request workflow fields | Extend `MaintenanceRequestRequiredPart` instead |
| Machine spare part links | `MachineSparePart` (machine_spare_parts) | Links machine ↔ spare part | Not a request | No change |
| Component spare part links | `ComponentSparePart` (component_spare_parts) | Links component ↔ spare part | Not a request | No change |
| Required parts on request | `MaintenanceRequestRequiredPart` (maintenance_request_required_parts) | Links request ↔ spare part, quantity, status (REQUESTED/CANCELLED), unique per spare part per request | No approve/reject/reserve/use workflow, no reason, no userId tracking per status, no timestamps per status | **Extend** with workflow fields |
| Part accountability | `MaintenancePartAccountability` (maintenance_part_accountability) | Tracks personnel accountability for assigned parts | Not a request workflow | No change |
| Part usage (product) | `MaintenanceRequestPartUsage` (maintenance_request_part_usages) | Product-based consumption (inventory) | Not spare-part-based, not operational workflow | No change |
| Stock balances | `InventoryBalance` (inventory_balances) | Product stock | Not modified by this batch | No change |
| Inventory movements | `InventoryMovement` (inventory_movements) | Stock movements | Not created by this batch | No change |

### Existing APIs

| Route | Method | Permission | Purpose |
|---|---|---|---|
| /maintenance/spare-parts | GET/POST/PATCH/DELETE | spare-part:* | Spare part catalog CRUD |
| /maintenance/machine-spare-parts | GET/POST/PATCH | (machine-spare-part:*) | Machine-spare part links |
| /maintenance/component-spare-parts | GET/POST/PATCH | (component-spare-part:*) | Component-spare part links |
| /maintenance/requests/:id/required-parts | GET/POST | maintenance-request-required-part:* | Required parts on request (planning) |
| /maintenance/requests/required-parts/:partId | PATCH | maintenance-request-required-part:update | Update required part |
| /maintenance/requests/required-parts/:partId/cancel | PATCH | maintenance-request-required-part:cancel | Cancel required part |
| /maintenance/part-accountabilities | GET/POST/PATCH/DELETE | (part-accountability:*) | Part accountability |
| /maintenance/request-parts | GET/POST/PATCH/DELETE | (request-parts:*) | Product-based part usage |

### Existing UI

| Page | Location | Shows |
|---|---|---|
| Request detail | /admin/maintenance/requests/[id] | Required parts table, assignments, accountabilities |
| New request | /admin/maintenance/requests/new | Add required parts with F9 |
| Edit request | /admin/maintenance/requests/[id]/edit | Edit required parts |

### Missing for this batch

| Feature | Status |
|---|---|
| Part request workflow (DRAFT → REQUESTED → APPROVED → REJECTED → RESERVED → USED → CANCELLED) | ❌ Missing |
| Request/approve/reject/reserve/use action endpoints | ❌ Missing |
| Reason field for request | ❌ Missing |
| Quantity tracking per status (requested, approved, reserved, used) | ❌ Missing |
| User tracking per status (who requested, approved, reserved, used) | ❌ Missing |
| Timestamp tracking per status | ❌ Missing |
| Workflow UI in request detail (buttons for request/approve/reject/reserve/use/cancel) | ❌ Missing |
| F9 spare part selector in request detail parts section | ❌ Missing (exists in new/edit pages) |
| Reports/dashboard part counts by status | ❌ Missing |
| Permissions for request-parts workflow | ❌ Missing |
| i18n for workflow statuses and actions | ❌ Missing |

## Approach

1. **Extend** `MaintenanceRequestRequiredPart` with workflow fields (all nullable)
2. **Create** new `MaintenanceSparePartRequestLinesModule` with controller/service for workflow endpoints under `/maintenance/requests/:requestId/parts`
3. **Extend** existing request detail page UI with parts workflow tab
4. **Add** permissions and i18n
5. **No** inventory/stock/finance changes
