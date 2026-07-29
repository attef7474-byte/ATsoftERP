# 10 — Real API Runtime Proof

## Result

- Runtime: Windows local, API `http://localhost:4000`, SQL Server.
- Authenticated checks: **134/134 PASS**.
- Unexpected 404: **0**.
- Unexpected 500: **0**.
- Authentication token and all secrets were omitted from evidence.
- Source: final production build restarted before this run.

| # | Method | URL | Actual | Expected | Response shape | Result |
|---:|---|---|---:|---|---|---|
| 1 | POST | `/api/v1/auth/login` | 201 | 2xx | object{accessToken,user} (token omitted) | PASS |
| 2 | GET | `/api/v1/health` | 200 | 200 | object{status,timestamp,uptime} | PASS |
| 3 | GET | `/api/v1/auth/me` | 200 | 200 | object{id,email,name,phone,avatar,status,companyId,branchId} | PASS |
| 4 | GET | `/api/v1/auth/permissions` | 200 | 200 | object{roles,permissions,isSuperAdmin} | PASS |
| 5 | GET | `/api/v1/users` | 200 | 200 | object{data:array(3),meta} | PASS |
| 6 | GET | `/api/v1/audit-logs` | 200 | 200 | object{data:array(20),meta} | PASS |
| 7 | GET | `/api/v1/audit-logs/summary` | 200 | 200 | object{total,today,actions,entities} | PASS |
| 8 | GET | `/api/v1/audit-logs/export/csv` | 200 | 200 | text(121899) | PASS |
| 9 | GET | `/api/v1/audit-logs/user-activity` | 200 | 200 | object{data:array(20),meta} | PASS |
| 10 | GET | `/api/v1/audit-logs/login-history` | 200 | 200 | object{data:array(0),meta} | PASS |
| 11 | GET | `/api/v1/roles` | 200 | 200 | object{data:array(4),meta} | PASS |
| 12 | GET | `/api/v1/permissions` | 200 | 200 | object{data:array(50),meta} | PASS |
| 13 | GET | `/api/v1/permissions/modules` | 200 | 200 | array(86) | PASS |
| 14 | GET | `/api/v1/permissions/matrix` | 200 | 200 | object{roles,permissions} | PASS |
| 15 | GET | `/api/v1/branches` | 200 | 200 | object{data:array(5),meta} | PASS |
| 16 | GET | `/api/v1/administrations` | 200 | 200 | object{data:array(3),meta} | PASS |
| 17 | GET | `/api/v1/departments` | 200 | 200 | object{data:array(4),meta} | PASS |
| 18 | GET | `/api/v1/companies` | 200 | 200 | object{data:array(6),meta} | PASS |
| 19 | GET | `/api/v1/products` | 200 | 200 | object{data:array(4),meta} | PASS |
| 20 | GET | `/api/v1/product-categories` | 200 | 200 | object{data:array(0),meta} | PASS |
| 21 | GET | `/api/v1/product-categories/tree` | 200 | 200 | array(0) | PASS |
| 22 | GET | `/api/v1/inventory/warehouses` | 200 | 200 | object{data:array(6),meta} | PASS |
| 23 | GET | `/api/v1/inventory/locations` | 200 | 200 | object{data:array(3),meta} | PASS |
| 24 | GET | `/api/v1/inventory/adjustments` | 200 | 200 | object{data:array(1),meta} | PASS |
| 25 | GET | `/api/v1/inventory/balances` | 200 | 200 | object{data:array(6),meta} | PASS |
| 26 | GET | `/api/v1/maintenance/machine-categories` | 200 | 200 | object{data:array(4),meta} | PASS |
| 27 | GET | `/api/v1/maintenance/machine-categories/tree` | 200 | 200 | array(4) | PASS |
| 28 | GET | `/api/v1/maintenance/machine-parts` | 200 | 200 | object{data:array(1),meta} | PASS |
| 29 | GET | `/api/v1/maintenance/machine-documents` | 200 | 200 | object{data:array(0),meta} | PASS |
| 30 | GET | `/api/v1/maintenance/machine-documents/history` | 200 | 200 | object{data:array(0),meta} | PASS |
| 31 | GET | `/api/v1/notifications/inbox` | 200 | 200 | object{data:array(20),meta} | PASS |
| 32 | GET | `/api/v1/notifications/unread-count` | 200 | 200 | object{count} | PASS |
| 33 | GET | `/api/v1/maintenance/downtime-logs` | 200 | 200 | object{data:array(10),meta} | PASS |
| 34 | GET | `/api/v1/maintenance/downtime-logs/current` | 200 | 200 | object{data:array(10),meta} | PASS |
| 35 | GET | `/api/v1/maintenance/downtime-logs/analysis` | 200 | 200 | object{summary,totalLogs,totalDurationMinutes,totalDurationHours,byMachine,byReason,byCause,recentLogs} | PASS |
| 36 | GET | `/api/v1/maintenance/operation-types` | 200 | 200 | object{data:array(5),meta} | PASS |
| 37 | GET | `/api/v1/maintenance/cost-centers` | 200 | 200 | object{data:array(1),meta} | PASS |
| 38 | GET | `/api/v1/maintenance/production-lines` | 200 | 200 | object{data:array(2),meta} | PASS |
| 39 | GET | `/api/v1/maintenance/machine-components` | 200 | 200 | object{data:array(8),meta} | PASS |
| 40 | GET | `/api/v1/maintenance/spare-parts` | 200 | 200 | object{data:array(2),meta} | PASS |
| 41 | GET | `/api/v1/maintenance/component-spare-parts` | 200 | 200 | object{data:array(1),meta} | PASS |
| 42 | GET | `/api/v1/maintenance/machine-spare-parts` | 200 | 200 | object{data:array(1),meta} | PASS |
| 43 | GET | `/api/v1/inventory/counts` | 200 | 200 | object{data:array(4),meta} | PASS |
| 44 | GET | `/api/v1/inventory/movements` | 200 | 200 | object{data:array(10),meta} | PASS |
| 45 | GET | `/api/v1/inventory/summary/balances` | 200 | 200 | object{totalBalances,totalProducts,totalQuantity,totalWarehouses,byWarehouse} | PASS |
| 46 | GET | `/api/v1/inventory/summary/counts` | 200 | 200 | object{total,draft,inProgress,completed,cancelled} | PASS |
| 47 | GET | `/api/v1/inventory/summary/movements` | 200 | 200 | object{total,draft,posted,cancelled,totalInQty,totalOutQty} | PASS |
| 48 | GET | `/api/v1/inventory/summary/adjustments` | 200 | 200 | object{total,draft,posted,cancelled,totalPositiveAdjustment,totalNegativeAdjustment} | PASS |
| 49 | GET | `/api/v1/business-partner-groups` | 200 | 200 | object{data:array(0),meta} | PASS |
| 50 | GET | `/api/v1/payment-terms` | 200 | 200 | object{data:array(0),meta} | PASS |
| 51 | GET | `/api/v1/business-partners` | 200 | 200 | object{data:array(0),meta} | PASS |
| 52 | GET | `/api/v1/business-partner-contacts` | 200 | 200 | object{data:array(0),meta} | PASS |
| 53 | GET | `/api/v1/business-partner-addresses` | 200 | 200 | object{data:array(0),meta} | PASS |
| 54 | GET | `/api/v1/business-partner-bank-accounts` | 200 | 200 | object{data:array(0),meta} | PASS |
| 55 | GET | `/api/v1/barcodes/labels` | 200 | 200 | object{data:array(2),meta} | PASS |
| 56 | GET | `/api/v1/barcodes` | 200 | 200 | object{data:array(2),meta} | PASS |
| 57 | GET | `/api/v1/barcodes/print-jobs` | 200 | 200 | object{data:array(0),meta} | PASS |
| 58 | GET | `/api/v1/barcodes/print-jobs/summary` | 200 | 200 | object{total,pending,printing,completed,failed} | PASS |
| 59 | GET | `/api/v1/barcodes/scans` | 200 | 200 | object{data:array(2),meta} | PASS |
| 60 | GET | `/api/v1/barcodes/scans/summary` | 200 | 200 | object{totalScans,todayScans,weekScans,monthScans,resultBreakdown} | PASS |
| 61 | GET | `/api/v1/barcodes/templates` | 200 | 200 | object{data:array(0),} | PASS |
| 62 | GET | `/api/v1/settings/company-profile` | 200 | 200 | object{id,companyNameAr,companyNameEn,taxNumber,commercialRegister,phone,email,address} | PASS |
| 63 | GET | `/api/v1/settings/language` | 200 | 200 | object{defaultLocale,fallbackLocale,rtlEnabled,dateFormat,timeFormat,numberFormat} | PASS |
| 64 | GET | `/api/v1/settings/appearance` | 200 | 200 | object{themeMode,accentColor,compactMode,sidebarDensity,tableDensity,showStatusBar,showActionBar} | PASS |
| 65 | GET | `/api/v1/settings/security` | 200 | 200 | object{sessionTimeoutMinutes,maxLoginAttempts,lockoutMinutes,twoFactorEnabledDefault,auditSensitiveActions} | PASS |
| 66 | GET | `/api/v1/notifications/rules` | 200 | 200 | object{data:array(0),total,page,pageSize} | PASS |
| 67 | GET | `/api/v1/settings` | 200 | 200 | object{data:array(20),meta} | PASS |
| 68 | GET | `/api/v1/numbering` | 200 | 200 | object{data:array(20),meta} | PASS |
| 69 | GET | `/api/v1/reports/maintenance/overview` | 200 | 200 | object{cards,totalRequests,openRequests,inProgressRequests,completedRequests,cancelledRequests,overdueSchedules,totalDowntimeMinutes} | PASS |
| 70 | GET | `/api/v1/reports/maintenance/requests` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 71 | GET | `/api/v1/reports/maintenance/downtime` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 72 | GET | `/api/v1/reports/maintenance/costs` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 73 | GET | `/api/v1/reports/maintenance/schedules` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 74 | GET | `/api/v1/reports/inventory/overview` | 200 | 200 | object{cards,totalProducts,activeProducts,totalWarehouses,totalLocations,positiveBalanceProducts,zeroBalanceProducts,negativeBalanceProducts} | PASS |
| 75 | GET | `/api/v1/reports/inventory/balances` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 76 | GET | `/api/v1/reports/inventory/count-variance` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 77 | GET | `/api/v1/reports/inventory/movements` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 78 | GET | `/api/v1/reports/inventory/adjustments` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 79 | GET | `/api/v1/reports/barcodes/scans` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages,byPurpose,byEntity} | PASS |
| 80 | GET | `/api/v1/reports/assets` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages,byStatus,byCategory} | PASS |
| 81 | GET | `/api/v1/reports/parts` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 82 | GET | `/api/v1/reports/partners` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages,byType} | PASS |
| 83 | GET | `/api/v1/reports/attachments` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages,byEntityType} | PASS |
| 84 | GET | `/api/v1/reports/audit` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages,byAction,byEntity} | PASS |
| 85 | GET | `/api/v1/reports/user-activity` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 86 | GET | `/api/v1/reports/notifications` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages,byType} | PASS |
| 87 | GET | `/api/v1/reports/machine-log` | 200 | 200 | object{rows,total,page,pageSize,totalPages} | PASS |
| 88 | GET | `/api/v1/reports/parts-usage` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 89 | GET | `/api/v1/reports/upcoming-preventive` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 90 | GET | `/api/v1/reports/overdue-preventive` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 91 | GET | `/api/v1/reports/low-stock` | 200 | 200 | object{cards,rows,total,page,pageSize,totalPages} | PASS |
| 92 | GET | `/api/v1/reports/inventory/movement-types` | 200 | 200 | object{cards,types} | PASS |
| 93 | GET | `/api/v1/reports/inventory/by-warehouse` | 200 | 200 | object{rows,total} | PASS |
| 94 | GET | `/api/v1/reports/inventory/by-location` | 200 | 200 | object{rows,total} | PASS |
| 95 | GET | `/api/v1/reports/inventory/exceptions` | 200 | 200 | object{exceptions,noSourceMovements,orphanMovements,negativeBalanceCount,reconciliationDifferenceCount} | PASS |
| 96 | GET | `/api/v1/reports/inventory/top-moving-items` | 200 | 200 | object{rows,total} | PASS |
| 97 | GET | `/api/v1/reports/inventory/dashboard-cards` | 200 | 200 | object{cards} | PASS |
| 98 | GET | `/api/v1/reports/inventory/negative-balances` | 200 | 200 | object{rows,total,page,pageSize,totalPages} | PASS |
| 99 | GET | `/api/v1/reports/inventory/reconciliation-differences` | 200 | 200 | object{rows,total} | PASS |
| 100 | GET | `/api/v1/reports/maintenance/costs/analysis` | 200 | 200 | object{cards,costByType,costByRequestType,costByMachine,monthlyCostTrend,monthlyPartsTrend} | PASS |
| 101 | GET | `/api/v1/reports/maintenance/costs/by-machine` | 200 | 200 | object{cards,rows} | PASS |
| 102 | GET | `/api/v1/reports/maintenance/schedule-compliance` | 200 | 200 | object{cards} | PASS |
| 103 | GET | `/api/v1/reports/maintenance/kpi-overview` | 200 | 200 | object{cards} | PASS |
| 104 | GET | `/api/v1/reports/maintenance/backlog-trend` | 200 | 200 | object{cards,backlogByMonth} | PASS |
| 105 | GET | `/api/v1/search` | 200 | 200 | object{data:array(0),meta} | PASS |
| 106 | GET | `/api/v1/search/entities` | 200 | 200 | object{data:array(11),meta} | PASS |
| 107 | GET | `/api/v1/dashboard/summary` | 200 | 200 | object{users,roles,permissions,products,warehouses,machines,companies,branches} | PASS |
| 108 | GET | `/api/v1/dashboard/operations` | 200 | 200 | object{machinesByStatus,openRequests,countsByStatus,overdueSchedules,currentDowntime,movements,adjustments} | PASS |
| 109 | GET | `/api/v1/dashboard/kpis` | 200 | 200 | object{totalMachines,totalRequests,completedRequests,totalCounts,totalMovements} | PASS |
| 110 | GET | `/api/v1/alerts` | 200 | 200 | object{data:array(19),total,page,pageSize} | PASS |
| 111 | GET | `/api/v1/alerts/summary` | 200 | 200 | object{total,critical,downtime,lowStock,underMaintenance,unreadNotifications,slaOverdue,slaEscalated} | PASS |
| 112 | GET | `/api/v1/attachments` | 200 | 200 | object{data:array(0),total,page,pageSize} | PASS |
| 113 | GET | `/api/v1/messaging/conversations` | 200 | 200 | object{data:array(4),meta} | PASS |
| 114 | GET | `/api/v1/messaging/unread-count` | 200 | 200 | object{count} | PASS |
| 115 | GET | `/api/v1/spare-part-conditions/balances` | 200 | 200 | array(2) | PASS |
| 116 | GET | `/api/v1/spare-part-conditions/movements` | 200 | 200 | array(4) | PASS |
| 117 | GET | `/api/v1/installed-parts` | 200 | 200 | array(0) | PASS |
| 118 | GET | `/api/v1/installed-parts/replacement-history` | 200 | 200 | array(0) | PASS |
| 119 | GET | `/api/v1/maintenance/spare-part-plans` | 200 | 200 | object{data:array(0),meta} | PASS |
| 120 | GET | `/api/v1/inventory/ledger/movements` | 200 | 200 | object{data:array(20),meta} | PASS |
| 121 | GET | `/api/v1/inventory/reconciliation/summary` | 200 | 200 | object{summary,detail} | PASS |
| 122 | GET | `/api/v1/inventory/reconciliation/details` | 200 | 200 | object{data:array(6),meta} | PASS |
| 123 | GET | `/api/v1/inventory/reconciliation/differences` | 200 | 200 | object{data:array(1),meta} | PASS |
| 124 | GET | `/api/v1/inventory/reconciliation/orphans` | 200 | 200 | object{orphanBalances,orphanMovements,totalOrphanBalances,totalOrphanMovements} | PASS |
| 125 | GET | `/api/v1/inventory/reconciliation/negative-balances` | 200 | 200 | object{data:array(0),total} | PASS |
| 126 | GET | `/api/v1/inventory/opening-balances` | 200 | 200 | object{data:array(10),meta} | PASS |
| 127 | GET | `/api/v1/inventory/stock-adjustments` | 200 | 200 | object{data:array(10),meta} | PASS |
| 128 | GET | `/api/v1/inventory/transfers` | 200 | 200 | object{data:array(4),meta} | PASS |
| 129 | GET | `/api/v1/inventory/operational-receipts` | 200 | 200 | object{data:array(10),meta} | PASS |
| 130 | GET | `/api/v1/inventory/physical-counts` | 200 | 200 | object{data:array(10),meta} | PASS |
| 131 | GET | `/api/v1/inventory/locks` | 200 | 200 | object{data:array(1),meta} | PASS |
| 132 | GET | `/api/v1/inventory/audit` | 200 | 200 | object{data:array(20),meta} | PASS |
| 133 | GET | `/api/v1/inventory/audit/summary` | 200 | 200 | object{total,today,actions,entities} | PASS |
| 134 | GET | `/api/v1/inventory/audit/export` | 200 | 200 | text(121899) | PASS |
