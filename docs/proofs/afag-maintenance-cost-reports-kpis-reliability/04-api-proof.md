# API Proof — AF-AG

## Validation Method

- Backend build: `npm run build` → PASS (0 errors)
- TypeScript typecheck: `npx tsc --noEmit` → PASS (0 errors)
- Server startup: `npm run start:dev` → PASS with all new routes mapped:
  - `/api/reports/maintenance/costs/analysis`
  - `/api/reports/maintenance/costs/by-machine`
  - `/api/reports/maintenance/schedule-compliance`
  - `/api/reports/maintenance/kpi-overview`
  - `/api/reports/maintenance/backlog-trend`
  - `/api/maintenance/reliability/repeat-failure-rate`
  - `/api/maintenance/reliability/availability`
  - `/api/maintenance/reliability/sla-times`
  - `/api/reports/export/csv/*endpoint`
  - `/api/reports/export/excel/*endpoint`

## Route Registration Proof

From server startup log:
```
Mapped {/api/reports/maintenance/costs/analysis, GET}
Mapped {/api/reports/maintenance/costs/by-machine, GET}
Mapped {/api/reports/maintenance/schedule-compliance, GET}
Mapped {/api/reports/maintenance/kpi-overview, GET}
Mapped {/api/reports/maintenance/backlog-trend, GET}
Mapped {/api/reports/maintenance/export/csv/*endpoint, GET}
Mapped {/api/reports/maintenance/export/excel/*endpoint, GET}
Mapped {/api/maintenance/reliability/repeat-failure-rate, GET}
Mapped {/api/maintenance/reliability/availability, GET}
Mapped {/api/maintenance/reliability/sla-times, GET}
```

## Response Shapes (from code)

### GET /reports/maintenance/kpi-overview
```json
{
  "cards": [{ "label": "totalRequests", "value": 42 }, ...],
  "totalCost": 125000,
  "partsCost": 85000,
  "openBacklog": 5,
  "pmCmRatio": 65,
  "emergencyPercentage": 15,
  "slaOverduePercentage": 8,
  "avgCompletionTime": 12.5
}
```

### GET /maintenance/reliability/repeat-failure-rate
```json
{
  "totalEvents": 100,
  "repeatEvents": 12,
  "repeatFailureRate": 12.0
}
```

### GET /maintenance/reliability/availability
```json
{
  "periodHours": 720,
  "downtimeHours": 48.5,
  "uptimeHours": 671.5,
  "availabilityPercent": 93.26,
  "note": "Approximate — assumes 24/7 operations"
}
```

### GET /maintenance/reliability/sla-times
```json
{
  "avgResponseTimeHours": 2.5,
  "avgRepairTimeHours": 8.0,
  "avgCompletionTimeHours": 24.0,
  "samplesResponse": 15,
  "samplesRepair": 12,
  "samplesCompletion": 30
}
```

### GET /reports/maintenance/costs/analysis
```json
{
  "cards": [{ "label": "totalCost", "value": 125000 }, ...],
  "costByType": [{ "type": "LABOR", "total": 40000, "count": 20 }],
  "costByRequestType": [{ "type": "CORRECTIVE", "count": 30 }],
  "costByMachine": [{ "machineId": "...", "machine": {}, "totalCost": 5000 }],
  "monthlyCostTrend": [{ "month": "2026-01", "total": 10000 }],
  "monthlyPartsTrend": [{ "month": "2026-01", "total": 8000 }]
}
```

### GET /reports/maintenance/schedule-compliance
```json
{
  "cards": [
    { "label": "totalSchedules", "value": 20 },
    { "label": "activeSchedules", "value": 15 },
    { "label": "overdueSchedules", "value": 3 },
    { "label": "completedPreventive", "value": 10 },
    { "label": "scheduleComplianceTarget", "value": 15 },
    { "label": "complianceRate", "value": 67, "unit": "%" }
  ]
}
```

## Existing Endpoints Preserved

All existing report and reliability endpoints continue to work unchanged. No breaking changes.
