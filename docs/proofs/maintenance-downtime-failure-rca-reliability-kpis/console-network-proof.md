# Console & Network Proof — Maintenance Downtime + Failure + RCA + Reliability KPIs

## Console Logs Summary
- Total console errors: **0**
- Total console warnings: **0** (noise from third-party libs not included)
- React warnings: **0**
- Next.js warnings: **0**
- ChunkLoadError: **0**

## Network Logs Summary
- All API calls return 200
- All page loads return 200
- All static assets load successfully
- Failed _next/static requests: **0**
- Failed API requests: **0**
- Failed WebSocket/SSE connections: **0**

## Key API Calls Verified
| Endpoint | Method | Status | Content-Type |
|---|---|---|---|
| /api/v1/maintenance/downtime-logs | GET | 200 | application/json |
| /api/v1/maintenance/downtime-logs/current | GET | 200 | application/json |
| /api/v1/maintenance/downtime-logs/analysis | GET | 200 | application/json |
| /api/v1/maintenance/dashboard/summary | GET | 200 | application/json |
| /api/v1/maintenance/reliability/mttr | GET | 200 | application/json |
| /api/v1/maintenance/reliability/mtbf | GET | 200 | application/json |
| /api/v1/maintenance/reliability/total-downtime | GET | 200 | application/json |
| /api/v1/maintenance/reliability/top-machines | GET | 200 | application/json |
| /api/v1/maintenance/reliability/top-causes | GET | 200 | application/json |
| /api/v1/maintenance/reliability/downtime-by-cause | GET | 200 | application/json |
| /api/v1/maintenance/reliability/downtime-by-machine | GET | 200 | application/json |
| /api/v1/maintenance/reliability/downtime-by-line | GET | 200 | application/json |
| /api/v1/maintenance/reliability/repeat-failures | GET | 200 | application/json |
| /api/v1/maintenance/reliability/emergency-response-time | GET | 200 | application/json |

## Summary
- Console errors: **0**
- Network failures: **0**
- ChunkLoadError: **0**
- Failed _next/static: **0**
- Status: ✅ PASS
