# Inventory Route / API Reference

## Web Routes (Next.js App Router)

| Route | Page | Description | Permission |
|-------|------|-------------|------------|
| `/inventory` | Dashboard | Inventory overview dashboard | inventory:reports:* |
| `/inventory/opening-balance` | OpeningBalancePage | Create, list, open opening balances | inventory:opening-balance:* |
| `/inventory/opening-balance/[id]` | OpeningBalanceDetailPage | View/edit opening balance detail | inventory:opening-balance:* |
| `/inventory/stock-adjustment` | StockAdjustmentPage | Create, list, open stock adjustments | inventory:stock-adjustment:* |
| `/inventory/stock-adjustment/[id]` | StockAdjustmentDetailPage | View/edit stock adjustment detail | inventory:stock-adjustment:* |
| `/inventory/transfer` | TransferPage | Create, list, open transfers | inventory:transfer:* |
| `/inventory/transfer/[id]` | TransferDetailPage | View/edit transfer detail | inventory:transfer:* |
| `/inventory/operational-receipt` | OperationalReceiptPage | Create, list, open operational receipts | inventory:operational-receipt:* |
| `/inventory/operational-receipt/[id]` | OperationalReceiptDetailPage | View/edit operational receipt detail | inventory:operational-receipt:* |
| `/inventory/physical-count` | PhysicalCountPage | Create, list, open physical counts | inventory:physical-count:* |
| `/inventory/physical-count/[id]` | PhysicalCountDetailPage | View/edit physical count detail | inventory:physical-count:* |
| `/inventory/ledger` | LedgerPage | View inventory ledger | inventory:ledger:read |
| `/inventory/reconciliation` | ReconciliationPage | View reconciliation | inventory:reconciliation:read |
| `/inventory/reports/stock-card` | StockCardReportPage | Stock card for a product | inventory:reports:* |
| `/inventory/reports/traceability` | TraceabilityReportPage | Trace movements to source | inventory:reports:* |
| `/inventory/reports/balance-summary` | BalanceSummaryPage | Balance summary | inventory:reports:* |
| `/inventory/reports/movement-register` | MovementRegisterPage | Movement register | inventory:reports:* |
| `/inventory/locks` | LockListPage | List and manage locks | inventory:lock:* |
| `/inventory/locks/create` | LockCreatePage | Create a new lock | inventory:lock:create |
| `/inventory/locks/[id]` | LockDetailPage | View/edit lock detail | inventory:lock:* |
| `/inventory/audit` | AuditPage | View audit log | inventory:audit:read |

## API Routes

### Opening Balance
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/opening-balance | List opening balances | inventory:opening-balance:read |
| POST | /api/inventory/opening-balance | Create opening balance | inventory:opening-balance:create |
| GET | /api/inventory/opening-balance/{id} | Get opening balance | inventory:opening-balance:read |
| PATCH | /api/inventory/opening-balance/{id} | Update opening balance | inventory:opening-balance:update |
| POST | /api/inventory/opening-balance/{id}/submit | Submit for approval | inventory:opening-balance:submit |
| POST | /api/inventory/opening-balance/{id}/approve | Approve | inventory:opening-balance:approve |
| POST | /api/inventory/opening-balance/{id}/post | Post | inventory:opening-balance:post |
| POST | /api/inventory/opening-balance/{id}/cancel | Cancel | inventory:opening-balance:cancel |
| DELETE | /api/inventory/opening-balance/{id} | Delete draft | inventory:opening-balance:delete-draft |

### Stock Adjustment
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/stock-adjustment | List adjustments | inventory:stock-adjustment:read |
| POST | /api/inventory/stock-adjustment | Create adjustment | inventory:stock-adjustment:create |
| GET | /api/inventory/stock-adjustment/{id} | Get adjustment | inventory:stock-adjustment:read |
| PATCH | /api/inventory/stock-adjustment/{id} | Update adjustment | inventory:stock-adjustment:update |
| POST | /api/inventory/stock-adjustment/{id}/submit | Submit | inventory:stock-adjustment:submit |
| POST | /api/inventory/stock-adjustment/{id}/approve | Approve | inventory:stock-adjustment:approve |
| POST | /api/inventory/stock-adjustment/{id}/post | Post | inventory:stock-adjustment:post |
| POST | /api/inventory/stock-adjustment/{id}/cancel | Cancel | inventory:stock-adjustment:cancel |

### Transfer
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/transfer | List transfers | inventory:transfer:read |
| POST | /api/inventory/transfer | Create transfer | inventory:transfer:create |
| GET | /api/inventory/transfer/{id} | Get transfer | inventory:transfer:read |
| PATCH | /api/inventory/transfer/{id} | Update transfer | inventory:transfer:update |
| POST | /api/inventory/transfer/{id}/submit | Submit | inventory:transfer:submit |
| POST | /api/inventory/transfer/{id}/approve | Approve | inventory:transfer:approve |
| POST | /api/inventory/transfer/{id}/post | Post | inventory:transfer:post |
| POST | /api/inventory/transfer/{id}/cancel | Cancel | inventory:transfer:cancel |

### Operational Receipt
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/operational-receipt | List receipts | inventory:operational-receipt:read |
| POST | /api/inventory/operational-receipt | Create receipt | inventory:operational-receipt:create |
| GET | /api/inventory/operational-receipt/{id} | Get receipt | inventory:operational-receipt:read |
| PATCH | /api/inventory/operational-receipt/{id} | Update receipt | inventory:operational-receipt:update |
| POST | /api/inventory/operational-receipt/{id}/submit | Submit | inventory:operational-receipt:submit |
| POST | /api/inventory/operational-receipt/{id}/approve | Approve | inventory:operational-receipt:approve |
| POST | /api/inventory/operational-receipt/{id}/post | Post | inventory:operational-receipt:post |
| POST | /api/inventory/operational-receipt/{id}/cancel | Cancel | inventory:operational-receipt:cancel |

### Physical Count
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/physical-count | List counts | inventory:physical-count:read |
| POST | /api/inventory/physical-count | Create count | inventory:physical-count:create |
| GET | /api/inventory/physical-count/{id} | Get count | inventory:physical-count:read |
| PATCH | /api/inventory/physical-count/{id} | Update count | inventory:physical-count:update |
| POST | /api/inventory/physical-count/{id}/submit | Submit | inventory:physical-count:submit |
| POST | /api/inventory/physical-count/{id}/approve | Approve | inventory:physical-count:approve |
| POST | /api/inventory/physical-count/{id}/post | Post variance | inventory:physical-count:post |
| POST | /api/inventory/physical-count/{id}/cancel | Cancel | inventory:physical-count:cancel |

### Ledger
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/ledger | Query ledger | inventory:ledger:read |
| GET | /api/inventory/ledger/summary | Ledger summary | inventory:ledger:read |

### Reconciliation
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/reconciliation | View reconciliation | inventory:reconciliation:read |
| GET | /api/inventory/reconciliation/{productId} | Reconciliation by product | inventory:reconciliation:read |

### Reports
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/reports/stock-card | Stock card | inventory:reports:* |
| GET | /api/inventory/reports/traceability | Traceability | inventory:reports:* |
| GET | /api/inventory/reports/balance-summary | Balance summary | inventory:reports:* |
| GET | /api/inventory/reports/movement-register | Movement register | inventory:reports:* |

### Locks
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/locks | List locks | inventory:lock:read |
| POST | /api/inventory/locks | Create lock | inventory:lock:create |
| GET | /api/inventory/locks/{id} | Get lock | inventory:lock:read |
| PATCH | /api/inventory/locks/{id} | Update lock | inventory:lock:update |
| DELETE | /api/inventory/locks/{id} | Delete lock | inventory:lock:delete |
| POST | /api/inventory/locks/{id}/activate | Activate lock | inventory:lock:activate |
| POST | /api/inventory/locks/{id}/deactivate | Deactivate lock | inventory:lock:deactivate |
| POST | /api/inventory/locks/{id}/override | Override lock (future) | inventory:lock:override |

### Audit
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/audit | List audit log | inventory:audit:read |
| GET | /api/inventory/audit/export | Export audit | inventory:audit:export |

### Governance
| Method | Path | Action | Permission |
|--------|------|--------|------------|
| GET | /api/inventory/governance | Get governance config | inventory:governance:read |
