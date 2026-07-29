# 02 — Preflight and Current Status

## Repository

| Item | Value |
|---|---|
| Repository | `C:\Users\attef\PycharmProjects\Trae\ATsofterp` |
| Branch | `main` |
| Starting commit | `1a12163` |
| Remote | `origin/main` at `1a12163` |
| Ahead/behind | `0/0` |
| Initial Git status | clean |
| Latest release tag | `atsoft-erp-current-release-final-audited-v6-runtime-ui-clean` |

## Baseline discovery

| Item | Current count |
|---|---:|
| Admin `page.tsx` files | 259 |
| API controller files | 168 |
| API DTO files | 382 |
| API service files | 140 |
| Prisma models | 89 |
| Registered modules in `app.module.ts` | revalidated from current source; stale AGENTS count is not reused as proof |

## Runtime baseline

- SQL Server is listening on `127.0.0.1:50079`.
- API and Web were intentionally stopped after the preceding runtime-proof patch; no stale listener existed on ports 4000/3000 at this preflight.
- The immediately preceding accepted patch at `1a12163` proved API 134/134, browser 360/360, business operations 51/51, health 4/4, smoke 8/8, EN/AR parity and API/Web builds.
- Previous screenshot blockers (`data.map`, invalid `page`, zero page and raw runtime i18n) were closed by `1a12163`; this batch must re-run regression proof after its own changes.

## Existing context baseline

- `User` currently has optional `companyId`, `branchId` and `departmentId`, but no multi-context access table.
- `/auth/me` returns the single User organization identifiers and roles.
- `AuthProvider` loads profile and permissions, but has no allowed-context collection or active-context state.
- `api.ts` attaches JWT only; operational-context headers do not yet exist.
- Top bar has no context chip or switcher.
- UX-0 already auto-fills part of a maintenance request from a selected machine, but it is not a global authorization boundary.

## Gate

No application source is to be edited until the initial full coverage matrix exists.
