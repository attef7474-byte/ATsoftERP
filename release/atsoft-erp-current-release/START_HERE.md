# START HERE — ATsoft ERP Current Release

## What This Package Is

This is the final release package for the ATsoft ERP current approved scope. It contains all documentation, scripts, and proofs for handover.

## Current Release Status

**COMPLETE_WITH_DOCUMENTED_LIMITATION** — The current release is ready for user acceptance and handover.

## Where to Begin

1. Read `README.md` — system overview and quick start
2. Read `RELEASE_MANIFEST.md` — what's included
3. Read `FINAL_ACCEPTANCE_REPORT.md` — acceptance summary
4. Read `CURRENT_RELEASE_SCOPE.md` — approved modules
5. Read `KNOWN_LIMITATIONS.md` — limitations before proceeding
6. Read `REJECTED_DOMAINS.md` — what's not included

## Quick Links

| Guide | Location |
|-------|----------|
| User Manual | `docs/user-manual/` |
| Admin Guide | `docs/admin-guide/` |
| Training Package | `docs/training/` |
| Operations Quick Ref | `docs/operations/` |
| API Summary | `docs/api/` |
| Mobile Guide | `docs/mobile/` |
| QA Summary | `docs/qa/` |
| Release Notes | `docs/release/` |

## Runtime Commands

```powershell
# Start API
npm run start:dev --workspace apps/api

# Start Web (dev)
npm run dev --workspace apps/web

# Start Web (production)
npm run build:web && npm start --workspace apps/web

# Health check
powershell -ExecutionPolicy Bypass -File tools/health/health-check.ps1

# Smoke test
powershell -ExecutionPolicy Bypass -File tools/health/smoke-check.ps1
```

## Final Tag and Commit

- **Final commit**: `97b795b`
- **Release tag**: `atsoft-erp-current-release-final`
- **Batch tag**: `atsoft-erp-batch40-final-release-package-acceptance-handover`
- **Source of truth**: GitHub repository at this tag

## Important Limitations

1. PDF export is browser print-to-PDF only
2. Flutter SDK unavailable on dev machine — requires Flutter-enabled workstation
3. No automated E2E suite yet
4. Dev-mode console noise may appear

## Rejected Domains (NOT included)

Sales, Purchasing, Finance, HR, AI, IoT, BI, Forecasting, Workflows, Import/Export Designer, Print Template Designer
