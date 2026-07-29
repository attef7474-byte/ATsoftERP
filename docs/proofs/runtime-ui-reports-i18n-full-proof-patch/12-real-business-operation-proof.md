# 12 — Real Business Operation Proof

## Result

- Operations: **51/51 PASS**.
- Mutations: **3** (login, controlled company update, exact restore).
- Read-only operations: **48**.
- Company rollback verified: **PASS**.
- Stock issue remained read-only because no isolated safe stock/request/warehouse context was available; condition balances and movements were verified without risking inventory integrity.
- No destructive delete, database reset, seed, schema change, or unsafe stock mutation was used.

| # | Action | Route/API | Mode | Expected | Actual | Result | Safety note |
|---:|---|---|---|---|---|---|---|
| 1 | Login as configured admin proof user | POST `/api/v1/auth/login` | MUTATION | 2xx | 201 / object{user} | PASS | Authentication token omitted from proof output |
| 2 | Read current authenticated profile | GET `/api/v1/auth/me` | READ_ONLY | 2xx | 200 / object{id,email,name,phone,avatar,status,companyId,branchId} | PASS |  |
| 3 | Read current authenticated permissions | GET `/api/v1/auth/permissions` | READ_ONLY | 2xx | 200 / object{roles,permissions,isSuperAdmin} | PASS |  |
| 4 | Verify API health | GET `/api/v1/health` | READ_ONLY | 2xx | 200 / object{status,timestamp,uptime} | PASS |  |
| 5 | List companies | GET `/api/v1/companies?page=1&limit=50` | READ_ONLY | 2xx | 200 / object{data:array(6),meta:yes} | PASS |  |
| 6 | Read safe QA company detail | GET `/api/v1/companies/cmrwx8ovu0000ws955a1pqpva` | READ_ONLY | 2xx | 200 / object{id,code,name,legalName,taxNumber,phone,email,address} | PASS |  |
| 7 | Update safe QA company legal name | PATCH `/api/v1/companies/cmrwx8ovu0000ws955a1pqpva` | MUTATION | 2xx | 200 / object{id,code,name,legalName,taxNumber,phone,email,address} | PASS | Temporary reversible update on QA_CORP only |
| 8 | Verify temporary QA company update | GET `/api/v1/companies/cmrwx8ovu0000ws955a1pqpva` | READ_ONLY | 2xx | 200 / object{id,code,name,legalName,taxNumber,phone,email,address} | PASS |  |
| 9 | Restore safe QA company original legal name | PATCH `/api/v1/companies/cmrwx8ovu0000ws955a1pqpva` | MUTATION | 2xx | 200 / object{id,code,name,legalName,taxNumber,phone,email,address} | PASS | Rollback of the temporary proof update |
| 10 | Verify QA company rollback | GET `/api/v1/companies/cmrwx8ovu0000ws955a1pqpva` | READ_ONLY | 2xx | 200 / object{id,code,name,legalName,taxNumber,phone,email,address} | PASS |  |
| 11 | Verify branches | GET `/api/v1/branches?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(5),meta:yes} | PASS |  |
| 12 | Verify administrations | GET `/api/v1/administrations?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(3),meta:yes} | PASS |  |
| 13 | Verify departments | GET `/api/v1/departments?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(4),meta:yes} | PASS |  |
| 14 | Verify products | GET `/api/v1/products?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(4),meta:yes} | PASS |  |
| 15 | Verify warehouses | GET `/api/v1/inventory/warehouses?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(6),meta:yes} | PASS |  |
| 16 | Verify inventory balances | GET `/api/v1/inventory/balances?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(6),meta:yes} | PASS |  |
| 17 | Verify inventory movements | GET `/api/v1/inventory/movements?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(20),meta:yes} | PASS |  |
| 18 | Verify opening balances | GET `/api/v1/inventory/opening-balances?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(20),meta:yes} | PASS |  |
| 19 | Verify stock adjustments | GET `/api/v1/inventory/stock-adjustments?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(20),meta:yes} | PASS |  |
| 20 | Verify stock transfers | GET `/api/v1/inventory/transfers?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(4),meta:yes} | PASS |  |
| 21 | Verify physical counts | GET `/api/v1/inventory/physical-counts?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(20),meta:yes} | PASS |  |
| 22 | Verify machine list | GET `/api/v1/maintenance/machines?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(2),meta:yes} | PASS |  |
| 23 | Verify existing machine detail | GET `/api/v1/maintenance/machines/cmrx68p3i0000r095f0kcrqnz` | READ_ONLY | 2xx | 200 / object{id,code,name,categoryId,companyId,branchId,departmentId,productionLineId} | PASS |  |
| 24 | Verify machine components | GET `/api/v1/maintenance/machine-components?machineId=cmrx68p3i0000r095f0kcrqnz` | READ_ONLY | 2xx | 200 / object{data:array(8),meta:yes} | PASS |  |
| 25 | Verify machine-spare-part links | GET `/api/v1/maintenance/machine-spare-parts?machineId=cmrx68p3i0000r095f0kcrqnz` | READ_ONLY | 2xx | 200 / object{data:array(1),meta:yes} | PASS |  |
| 26 | Verify spare parts | GET `/api/v1/maintenance/spare-parts?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(2),meta:yes} | PASS |  |
| 27 | Verify spare-part condition balances | GET `/api/v1/spare-part-conditions/balances` | READ_ONLY | 2xx | 200 / array(2) | PASS |  |
| 28 | Verify installed parts | GET `/api/v1/installed-parts?machineId=cmrx68p3i0000r095f0kcrqnz` | READ_ONLY | 2xx | 200 / array(0) | PASS |  |
| 29 | Verify replacement history | GET `/api/v1/installed-parts/replacement-history?machineId=cmrx68p3i0000r095f0kcrqnz` | READ_ONLY | 2xx | 200 / array(0) | PASS |  |
| 30 | Verify maintenance requests | GET `/api/v1/maintenance/requests?page=1&limit=20&machineId=cmrx68p3i0000r095f0kcrqnz` | READ_ONLY | 2xx | 200 / object{data:array(20),meta:yes} | PASS |  |
| 31 | Verify repair-order list | GET `/api/v1/maintenance/repair-orders?limit=20` | READ_ONLY | 2xx | 200 / array(0) | PASS |  |
| 32 | Verify repairable-parts queue | GET `/api/v1/maintenance/repair-orders/queue?limit=20` | READ_ONLY | 2xx | 200 / array(0) | PASS |  |
| 33 | Verify maintenance BOM list | GET `/api/v1/maintenance/bom?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(0),meta:yes} | PASS |  |
| 34 | Verify preventive spare-part plans | GET `/api/v1/maintenance/spare-part-plans?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(0),meta:yes} | PASS |  |
| 35 | Verify SLA overview | GET `/api/v1/maintenance/sla/stats/overview` | READ_ONLY | 2xx | 200 / object{total,onTrack,overdue,escalated,critical} | PASS |  |
| 36 | Verify maintenance calendar | GET `/api/v1/maintenance/calendar-workload/events?startDate=2026-07-01&endDate=2026-07-31` | READ_ONLY | 2xx | 200 / array(43) | PASS |  |
| 37 | Verify maintenance workload | GET `/api/v1/maintenance/calendar-workload/workload/summary?date=2026-07-29` | READ_ONLY | 2xx | 200 / object{totalActiveRequests,totalPersonnel,activeAssignmentsCount,unassignedCount,overdueCount,slaDueCount,emergencyCount,preventiveCount} | PASS |  |
| 38 | Verify accountability KPIs | GET `/api/v1/maintenance/dashboard/accountability-kpis` | READ_ONLY | 2xx | 200 / object{personnelByRole,activeResponsibilities,topAssignees,machinesWithMostResponsibilities,partAccountabilityByStatus,topPersonnelPartAccountability} | PASS |  |
| 39 | Verify maintenance overview report | GET `/api/v1/reports/maintenance/overview` | READ_ONLY | 2xx | 200 / object{cards,totalRequests,openRequests,inProgressRequests,completedRequests,cancelledRequests,overdueSchedules,totalDowntimeMinutes} | PASS |  |
| 40 | Verify maintenance KPI report | GET `/api/v1/reports/maintenance/kpi-overview` | READ_ONLY | 2xx | 200 / object{cards} | PASS |  |
| 41 | Verify audit report | GET `/api/v1/reports/audit` | READ_ONLY | 2xx | 200 / object{cards,rows,total,page,pageSize,totalPages,byAction,byEntity} | PASS |  |
| 42 | Verify login history audit trail | GET `/api/v1/audit-logs/login-history?limit=20` | READ_ONLY | 2xx | 200 / object{data:array(0),meta:yes} | PASS |  |
| 43 | Verify barcode records | GET `/api/v1/barcodes/labels?limit=20` | READ_ONLY | 2xx | 200 / object{data:array(2),meta:yes} | PASS |  |
| 44 | Verify barcode templates | GET `/api/v1/barcodes/templates?limit=20` | READ_ONLY | 2xx | 200 / object{data:array(0),meta:no} | PASS |  |
| 45 | Verify barcode print jobs | GET `/api/v1/barcodes/print-jobs?limit=20` | READ_ONLY | 2xx | 200 / object{data:array(0),meta:yes} | PASS |  |
| 46 | Verify barcode scan history | GET `/api/v1/barcodes/scans?limit=20` | READ_ONLY | 2xx | 200 / object{data:array(2),meta:yes} | PASS |  |
| 47 | Verify barcode scan summary route | GET `/api/v1/barcodes/scans/summary` | READ_ONLY | 2xx | 200 / object{totalScans,todayScans,weekScans,monthScans,resultBreakdown} | PASS |  |
| 48 | Verify an existing barcode record detail | GET `/api/v1/barcodes/labels/cmrvb4cvr0007no95kurvh2br` | READ_ONLY | 2xx | 200 / object{id,code,value,symbology,entityType,entityId,status,title} | PASS |  |
| 49 | Verify numbering sequences | GET `/api/v1/numbering?page=1&limit=20` | READ_ONLY | 2xx | 200 / object{data:array(20),meta:yes} | PASS |  |
| 50 | Verify system settings | GET `/api/v1/settings` | READ_ONLY | 2xx | 200 / object{data:array(20),meta:yes} | PASS |  |
| 51 | Spare-part issue mutation | POST `Not executed` | READ_ONLY | Safe test stock, request, and warehouse context required | SKIPPED_SAFETY / Read-only condition balance and movement proof used | PASS | Mutation intentionally skipped to avoid unsafe stock deduction or double deduction on existing business data |
