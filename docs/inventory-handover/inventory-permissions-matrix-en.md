# Inventory Permissions Matrix — English

## Available Inventory Permissions
| Permission | Description |
|-----------|-------------|
| inventory:reports:* | View all inventory reports |
| inventory:ledger:read | View ledger |
| inventory:reconciliation:read | View reconciliation |
| inventory:opening-balance:create | Create opening balance |
| inventory:opening-balance:read | View opening balances |
| inventory:opening-balance:update | Update draft opening balance |
| inventory:opening-balance:submit | Submit for approval |
| inventory:opening-balance:approve | Approve opening balance |
| inventory:opening-balance:post | Post opening balance |
| inventory:opening-balance:cancel | Cancel opening balance |
| inventory:opening-balance:delete-draft | Delete draft opening balance |
| inventory:stock-adjustment:create | Create stock adjustment |
| inventory:stock-adjustment:read | View stock adjustments |
| inventory:stock-adjustment:update | Update draft adjustment |
| inventory:stock-adjustment:submit | Submit for approval |
| inventory:stock-adjustment:approve | Approve adjustment |
| inventory:stock-adjustment:post | Post adjustment |
| inventory:stock-adjustment:cancel | Cancel adjustment |
| inventory:transfer:create | Create transfer |
| inventory:transfer:read | View transfers |
| inventory:transfer:update | Update draft transfer |
| inventory:transfer:submit | Submit for approval |
| inventory:transfer:approve | Approve transfer |
| inventory:transfer:post | Post transfer |
| inventory:transfer:cancel | Cancel transfer |
| inventory:operational-receipt:create | Create operational receipt |
| inventory:operational-receipt:read | View operational receipts |
| inventory:operational-receipt:update | Update draft receipt |
| inventory:operational-receipt:submit | Submit for approval |
| inventory:operational-receipt:approve | Approve receipt |
| inventory:operational-receipt:post | Post receipt |
| inventory:operational-receipt:cancel | Cancel receipt |
| inventory:physical-count:create | Create physical count |
| inventory:physical-count:read | View physical counts |
| inventory:physical-count:update | Update draft count |
| inventory:physical-count:submit | Submit for approval |
| inventory:physical-count:approve | Approve count |
| inventory:physical-count:post | Post count variance |
| inventory:physical-count:cancel | Cancel count |
| inventory:lock:create | Create lock |
| inventory:lock:read | View locks |
| inventory:lock:update | Update lock |
| inventory:lock:activate | Activate lock |
| inventory:lock:deactivate | Deactivate lock |
| inventory:lock:delete | Delete lock |
| inventory:lock:override | Override lock restriction (future use) |
| inventory:audit:read | View audit log |
| inventory:audit:export | Export audit log |
| inventory:governance:read | View governance configuration |
| inventory:reports:ledger | View ledger reports |
| inventory:reports:reconciliation | View reconciliation reports |
| inventory:reports:permissions-view | View permissions report |
| inventory:stock:issue | Issue stock (maintenance) |
| inventory:stock:return | Return stock (maintenance) |
| maintenance-stock-issue:create | Create maintenance stock issue |
| maintenance-stock-issue:read | Read maintenance stock issues |

## Role Mapping (Recommended)
| Role | Key Permissions |
|------|----------------|
| Warehouse Officer | Create/read/update/submit for opening balances, adjustments, transfers, operational receipts, physical counts |
| Maintenance User | maintenance-stock-issue:create, inventory:stock:issue/return |
| Maintenance Supervisor | Above + approve maintenance transactions |
| Inventory Supervisor | Approve/post all inventory documents, manage locks |
| Administrator | All permissions including override, governance, audit |
| Auditor/Viewer | Read reports, ledger, reconciliation, locks, audit |
