# Final Acceptance Report — v11 Entity Workspace UI Redesign

## Status

**ACCEPTED**

## Repository

| Metric | Value |
|--------|-------|
| Branch | `main` |
| Design-phase baseline | `2a5ead7` — v10 validation error toast corrective |
| Corrective-phase HEAD | `c151e2e` (prior committed work); corrective fixes currently **uncommitted** |
| Final commit | *(to be created on user request)* |
| Tags | *(to be pushed on user request)* |
| Git status | 15 modified files (5 pages, 2 entity components + hook + barrel, globals.css, 4 machine-parts pages, 2 locale files) + 1 untracked proof token |

## Scope

### Implemented (design phase + corrective phase)

- **10 reusable entity workspace components** in `apps/web/src/components/entity/` (incl. race-safe `useDrawerSectionData` hook)
- **Drawer rendered via portal** to `document.body` (overlay z-80, panel z-90) — fixes close-button interception by the fixed topbar (z-60)
- **BodyRow click guard** (skips interactive elements)
- **`--ws-*` design tokens + 3 accent variants** (`data-sidebar-accent=blue|emerald|violet`) in `globals.css` — follows the Appearance page theme
- **workspace i18n namespace** (11 keys, EN+AR) + **2 maintenance keys** (`linkedInventoryItem`, `linkedInventoryItemHint`, EN+AR)
- **5 pages refactored with real, verified data flows**:
  - Companies: drawer sections Branches / Departments / Users / Warehouses — all via `useDrawerSectionData`, real rows (6 / 3 / 3 / 18 in default context)
  - Branches: Departments (real empty OK), Users, Warehouses — keyed on branch company
  - Departments: Users section keyed on department company
  - Users: Roles inline from `user.roles` — 404 endpoints (`/users/:id/roles`, `/users/:id/operational-scopes`) removed from UI
  - Warehouses: Locations via plain-array mapping; Balance Summary section removed (no such endpoint)
- All 5 pages route API errors through `useApiErrorHandler` (Global Error Dialog, localized)
- Machine Parts label: `المنتج` → `الصنف المخزني المرتبط` (Linked Inventory Item) in list, form, edit, detail pages
- **Playwright browser proof: 25/25 PASS** — zero console errors, zero request failures, zero unexpected 4xx/5xx
- Drawer lifecycle: open on row click, close on route change, entity deletion, × button, Esc, overlay

### Explicitly not implemented

- No detail page replacement — existing `/[id]/page.tsx` routes remain
- No API changes (404 endpoints were removed from frontend usage, not added)
- No permission changes
- No DB/schema changes
- No sidebar/navigation changes
- No forbidden module activation

### Forbidden modules untouched

| Module | Status |
|--------|--------|
| Finance | ❌ Not touched |
| Purchasing | ❌ Not touched |
| Sales | ❌ Not touched |
| HR | ❌ Not touched |
| AI | ❌ Not touched |
| IoT | ❌ Not touched |
| BI | ❌ Not touched |
| Workflows | ❌ Not touched |
| Universal Requests | ❌ Not touched |
| Import-Export | ❌ Not touched |
| Forecasting | ❌ Not touched |
| Predictive Maintenance | ❌ Not touched |
| Print Template Designer | ❌ Not touched |

## Database

| Check | Result |
|-------|--------|
| Schema changed | No |
| Migration created | No |
| Prisma validate/generate | Not needed |
| DB counters | Unchanged |

## Backend

| Check | Result |
|-------|--------|
| New modules | 0 |
| New endpoints | 0 |
| Modified endpoints | 0 |
| Permission changes | 0 |
| API i18n changes | 0 |

## Frontend

| Check | Result |
|-------|--------|
| New components | 10 entity workspace components + hook |
| Modified pages | 5 refactored + 4 label-only machine-parts pages |
| New i18n keys | 13 (11 workspace + 2 maintenance), EN + AR |
| Raw keys in JSX | 0 |
| Build errors | 0 (`✓ Compiled successfully`, 166/166 pages) |
| Page count | 166 (unchanged) |

## Proof

| Evidence | Count/Result |
|----------|-------------|
| Build proof | ✓ 166 pages, 0 errors (final run after portal change) |
| i18n proof | ✓ 2,990 keys EN / 2,990 AR — 100% match (parity sweep) |
| Browser/DOM proof | ✓ **25/25 Playwright checks PASS** (real Chromium, DOM assertions, console/network clean) |
| Bugs caught by proof | ✓ close-button interception (portal fix) — re-proven PASS |
| Permissions proof | ✓ No changes |
| DB integrity proof | ✓ No changes |
| API proof | ✓ HTTP probes: companies 200, warehouses 200, locations 200 `[]`, removed endpoints confirmed 404 (hence removed) |

## Security

| Check | Result |
|-------|--------|
| No secrets printed | ✓ |
| No passwordHash leakage | ✓ |
| No JWT leakage | ✓ (token kept in untracked local file, not committed) |
| No SQL errors exposed | ✓ |
| Permission checks preserved | ✓ |

## Limitations (documented)

- **Cross-company rows**: opening a drawer row whose company differs from the active context triggers `ActiveContextInterceptor` 403 → localized Global Error Dialog. This is the platform's strict context rule — the user switches context via the top-bar switcher. Verified safe, not a broken flow.
- **Warehouses Locations in default context**: API returns `[]` — the empty state shown is the true state (probe-verified), not a loading/error artifact.
- **Section data caching**: none added — each drawer open fetches fresh section data.
- No runtime screenshots (disabled per user policy) — proof is DOM/console/network assertions.

## Next batch recommendation

Apply the same entity workspace pattern to remaining CRUD-only list pages (Administrations, Machine Categories, Operation Types, Production Lines, Cost Centers), then commit/tag/push the v11 corrective phase (3 tags: `atsoft-erp-v11-entity-workspace-ui-redesign`, `atsoft-erp-current-release-final-audited-v11-entity-workspace`, `atsoft-erp-v11-entity-workspace-proof`) when the user requests it.
