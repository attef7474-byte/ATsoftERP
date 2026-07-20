# Rejected Domains — ATsoft ERP Current Release

> Domains rejected for the current release. These are NOT included, NOT mounted, NOT functional, and NOT documented as active.

## Rejected Domains List

| # | Domain | Status | Reason |
|---|--------|--------|--------|
| 1 | Sales | NOT MOUNTED | User-rejected for current release |
| 2 | Purchasing | NOT MOUNTED | User-rejected for current release |
| 3 | Finance / Accounting | NOT MOUNTED | User-rejected for current release |
| 4 | HR / Employees | NOT MOUNTED | User-rejected for current release |
| 5 | AI / Assistant | NOT MOUNTED | User-rejected for current release |
| 6 | IoT / Gateway | NOT MOUNTED | User-rejected for current release |
| 7 | BI / Analytics | NOT MOUNTED | User-rejected for current release |
| 8 | Forecasting | NOT MOUNTED | User-rejected for current release |
| 9 | Workflows | NOT MOUNTED | User-rejected for current release |
| 10 | Import/Export Designer | NOT MOUNTED | User-rejected for current release |
| 11 | Print Template Designer | NOT MOUNTED | User-rejected for current release |

## Verification

All 11 domains verified inactive:

| Check | Result |
|-------|--------|
| Imported in app.module.ts | No — none imported |
| Sidebar visible | No — no entries |
| API exposed | No — no routes |
| Web routes exist | No — no route directories |
| Prisma models exist | No — no tables |
| Documentation says active | No — all documented as inactive |
| Orphaned source stubs exist | Yes — historical artifacts, not imported |

## Key Observations

- Source files exist under `apps/api/src/modules/` for all 11 domains as historical planning stubs
- None are imported by `app.module.ts` or any active module
- None have sidebar entries, web routes, or Prisma models
- All are documented as `USER_REJECTED_FOR_CURRENT_RELEASE`
- False positives ruled out: `workflow` translation keys are `maintenanceWorkflow` namespace; `print` pages are contextual maintenance features
