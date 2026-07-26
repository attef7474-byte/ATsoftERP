# Reports / Dashboard Proof — Maintenance Downtime + Failure + RCA + Reliability KPIs

## Dashboard Cards

### Existing Cards (Preserved)
| Card | Data Source |
|---|---|
| Open Requests | maintenance-dashboard:summary |
| Critical Requests | maintenance-dashboard:summary |
| Overdue Items | maintenance-dashboard:summary |
| Machines Under Maintenance | maintenance-dashboard:summary |
| Current Downtime | maintenance-dashboard:summary |
| Upcoming Preventive | maintenance-dashboard:summary |
| Total Cost | maintenance-dashboard:summary |
| Completion Rate | maintenance-dashboard:summary |

### New Reliability Cards
| Card | Data Source | Real Data |
|---|---|---|
| MTTR (Mean Time To Repair) | dashboard summary → reliability.mttr | Computed from real downtime logs |
| MTBF (Mean Time Between Failures) | dashboard summary → reliability.mtbf | Computed from real downtime logs |
| Total Downtime | dashboard summary → reliability.totalDowntimeHours | Sum of all closed log durations |
| Reliability KPIs Count | dashboard summary → reliability.totalDowntimeEvents | Count of all non-cancelled logs |

## New API Endpoints for Reports

| Endpoint | Purpose | Filters |
|---|---|---|
| GET /maintenance/reliability/mttr | MTTR | machineId, productionLineId, dateFrom, dateTo |
| GET /maintenance/reliability/mtbf | MTBF | machineId, productionLineId, dateFrom, dateTo |
| GET /maintenance/reliability/total-downtime | Total downtime | machineId, productionLineId, dateFrom, dateTo |
| GET /maintenance/reliability/downtime-by-machine | By machine | dateFrom, dateTo, limit |
| GET /maintenance/reliability/downtime-by-line | By production line | dateFrom, dateTo |
| GET /maintenance/reliability/downtime-by-cause | By failure cause | dateFrom, dateTo |
| GET /maintenance/reliability/repeat-failures | Repeat failure logs | dateFrom, dateTo, limit |
| GET /maintenance/reliability/emergency-response-time | Emergency response | dateFrom, dateTo |
| GET /maintenance/reliability/top-machines | Top machines | dateFrom, dateTo, limit |
| GET /maintenance/reliability/top-causes | Top causes | dateFrom, dateTo |

## KPI Calculation Methods

### MTTR (Mean Time To Repair)
- Filter: non-cancelled logs with endTime and durationMinutes
- Calculation: AVG(durationMinutes) across all matching logs
- Response: mttrMinutes, mttrHours, totalEvents

### MTBF (Mean Time Between Failures)
- Filter: non-cancelled logs
- Calculation: (lastEventTime - firstEventTime) / (totalEvents - 1)
- Requires minimum 2 events
- Response: mtbfMinutes, mtbfHours, totalEvents

### Total Downtime
- Filter: non-cancelled logs
- Calculation: SUM(durationMinutes)
- Response: totalMinutes, totalHours, totalEvents

### Emergency Response Time
- Filter: logs with detectedAt AND responseStartedAt set
- Calculation: AVG(responseStartedAt - detectedAt) in minutes
- Response: avgResponseTimeMinutes, avgResponseTimeHours, totalEvents

## Existing Reports (Preserved)
- Machine Downtime Report: PRESERVED
- Maintenance Requests Report: PRESERVED
- Maintenance Schedules Report: PRESERVED
- Maintenance Costs Report: PRESERVED
- Maintenance Overview: PRESERVED

## No Mock Data
- All values computed from real SQL Server data
- No hardcoded fake counts
- No seed data for reliability KPIs
