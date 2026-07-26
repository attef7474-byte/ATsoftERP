# Reports & Dashboard Proof — Maintenance Spare Parts Request + Reservation + Usage Proof

## Spare Parts Request Workflow Reporting

The following data can be queried via the part lines API:

### Counts by Status
| Metric | Source | Real Data |
|---|---|---|
| Requested parts count | GET /maintenance/requests/:id/parts (status=REQUESTED) | ✅ Real |
| Approved parts count | GET /maintenance/requests/:id/parts (status=APPROVED) | ✅ Real |
| Reserved parts count | GET /maintenance/requests/:id/parts (status=RESERVED) | ✅ Real |
| Used parts count | GET /maintenance/requests/:id/parts (status=USED) | ✅ Real |

### Parts by Request
- Available via GET /maintenance/requests/:id/parts with full spare part data

### Parts by Machine
- Available via machineId field on each part line

### Parts by Failure Cause
- Available via failureCauseId field and FailureCause relation

### Top Requested/Used Parts
- Can be aggregated from part lines data by sparePart and status

### Dashboard
- The existing maintenance dashboard service can be extended with spare part request counts
- Current implementation shows part lines per request with full workflow status

## No Fake Data
All counts and data come from real database queries. No mock counts or hardcoded values.
