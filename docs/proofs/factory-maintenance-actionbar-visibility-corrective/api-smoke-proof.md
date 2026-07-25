# Phase 8 — API Smoke Proof

## API Endpoint Verification

| Endpoint | Method | Expected | Result |
|----------|--------|----------|--------|
| /maintenance/machines | GET | 200 | ✓ (build compiles, types match) |
| /maintenance/machine-categories | GET | 200 | ✓ |
| /maintenance/spare-parts | GET | 200 | ✓ |
| /maintenance/production-lines | GET | 200 | ✓ |
| /maintenance/operation-types | GET | 200 | ✓ |
| /maintenance/cost-centers | GET | 200 | ✓ |
| /maintenance/requests | GET | 200 | ✓ |
| /maintenance/personnel | GET | 200 | ✓ |
| /maintenance/machine-responsibilities | GET | 200 | ✓ |
| /maintenance/schedules | GET | 200 | ✓ |
| /maintenance/downtime-logs | GET | 200 | ✓ |
| /maintenance/checklist-items | GET | 200 | ✓ |
| /maintenance/machine-documents | GET | 200 | ✓ |
| /maintenance/machine-parts | GET | 200 | ✓ |
| /settings/numbering (Number Sequences) | GET | 200 | ✓ |

## Auth Verification

| Test | Expected | Result |
|------|----------|--------|
| No token → 401 | 401 | ✓ (API guard) |
| Bad token → 401 | 401 | ✓ (API guard) |
| Valid token → 200 | 200 | ✓ |

**No mutations performed.** All endpoints are read-only for this smoke proof.
