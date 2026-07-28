# Frontend Proof — Batch V

## Pages created
| Page | Route | Description |
|------|-------|-------------|
| Locks list | `/admin/inventory/locks` | Table with status/type/date filtering + activate/deactivate/delete |
| Create lock | `/admin/inventory/locks/new` | Form with code/type/dates/reason + warehouse F9 picker |
| Lock detail | `/admin/inventory/locks/[id]` | Read-only detail + edit modal + activate/deactivate buttons |
| Governance audit | `/admin/inventory/governance-audit` | Audit log table with action/date filters + detail expand |

## Navigation
Two new sidebar entries under Inventory section:
- Inventory Locks → `/admin/inventory/locks`
- Inventory Audit (Governance) → `/admin/inventory/governance-audit`

## i18n
Labels added to both English and Arabic navigation files:
- `inventoryLocks`: 'Inventory Locks' / 'أقفال المخزون'
- `inventoryAudit`: 'Inventory Audit (Governance)' / 'سجل تدقيق المخزون'

## Read-only integrity
- Lock list/detail pages do NOT create/update/delete any StockBalance
- Lock list/detail pages do NOT create/update/delete any InventoryMovement
- Audit page is pure read-only — no mutation buttons
- No balance editing UI on governance pages
- No movement creation button on governance pages
