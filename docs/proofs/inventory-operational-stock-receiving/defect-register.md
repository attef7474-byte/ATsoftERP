# Defect Register — Operational Stock Receiving

| ID | Description | Severity | Status | Notes |
|----|-------------|----------|--------|-------|
| — | No defects found during implementation | — | CLOSED | All validations passed |

## Known Limitations
1. No multi-warehouse receipt — each receipt targets a single warehouse
2. No unit cost tracking — pricing is out of scope
3. No auto-generation from purchase orders — purchasing not activated
4. P3006 shadow DB limitation persists — use `migrate deploy` not `migrate dev`
