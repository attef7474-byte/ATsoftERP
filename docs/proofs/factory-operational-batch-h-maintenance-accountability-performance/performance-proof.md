# Performance Proof — Batch H

**Date:** 2026-07-25  

## Result: ✅ PASSED — All endpoints under 1000ms

| Endpoint | Status | Time (ms) |
|----------|--------|-----------|
| `GET /dashboard/accountability-kpis` | 200 | 84 |
| `GET /personnel` | 200 | 33 |
| `GET /machine-responsibilities` | 200 | 31 |
| `GET /request-assignments` | 200 | 29 |
| `GET /dashboard/accountability-kpis?timeRange=month` | 200 | 33 |
| `GET /dashboard/accountability-kpis?timeRange=quarter` | 200 | 35 |
| `GET /dashboard/accountability-kpis?timeRange=year` | 200 | 31 |

**Max:** 84ms · **Min:** 29ms · **Threshold:** 1000ms

### Web page load times

| Page | Status | Time (ms) |
|------|--------|-----------|
| `/admin/maintenance/personnel` | 200 | 112 |
| `/admin/maintenance/machine-responsibilities` | 200 | 122 |
| `/admin/maintenance/accountability` | 200 | 114 |
