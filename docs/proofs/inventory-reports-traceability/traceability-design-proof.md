# Traceability Design Proof: Inventory Reports & Traceability (Batch U)

## Design Overview
Traceability provides full audit trail across inventory movements with source document resolution.

## Source Resolution Strategy
| Source Type | Linked Document | Resolution Method |
|---|---|---|
| PURCHASE_ORDER | Purchase Order receiving | Query Receiving model |
| TRANSFER | Stock Transfer | Query Transfer model |
| ADJUSTMENT | Stock Adjustment | Query Adjustment model |
| OPENING_BALANCE | Opening Balance | Query OpeningBalance model |
| PHYSICAL_COUNT | Physical Count | Query PhysicalCount model |
| OPERATIONAL_RECEIPT | Operational Receipt | Query OperationalReceipt model |
| RETURN | Return document | Query Return model |
| UNKNOWN | — | Marked as no-source (exception) |

## Traceability Response Shape
```json
{
  "movement": { "id", "reference", "type", "date", "status" },
  "lines": [{ "productId", "quantity", "direction", "batchRef" }],
  "traceResolved": { "sourceType", "sourceId", "sourceReference", "status" }
}
```

## Proof
- API: movement traceability returns lines and traceResolved for 200 OK
- API: invalid traceability ID returns 404
- Browser: traceability page loads with search input
- All source types resolve correctly or return status indicator
