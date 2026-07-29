# 01 — Preflight Verification

## Purpose
Confirm clean state before read-only audit begins.

## Checks

| Check | Result |
|-------|--------|
| Branch | `main` |
| HEAD commit | `34242b0` (previous: `33854f7` — operational context batch) |
| Ahead/behind origin/main | 0 / 0 |
| `git status --porcelain` | empty — zero dirty files |
| `git diff --check` | PASS — no whitespace errors |
| Unstaged changes | none |
| Untracked files | none |
| Working tree | clean |

## Source Files to Audit (read-only)

| # | File | Size |
|---|------|------|
| 1 | `apps/web/src/components/admin/shell/navigation-data.ts` | 158 lines, 10 groups + 4 standalone items |
| 2 | `apps/web/src/components/admin/shell/sidebar.tsx` | renderer component |
| 3 | `apps/web/src/components/admin/shell/admin-shell.tsx` | shell orchestrator |
| 4 | `apps/web/src/app/admin/layout.tsx` | route layout wrapper |
| 5 | `apps/web/src/lib/i18n/locales/en/navigation.ts` | 116 nav keys (EN labels) |
| 6 | `apps/web/src/lib/i18n/locales/ar/navigation.ts` | 116 nav keys (AR labels) |

## Confirmation
No application code, routes, i18n, permissions, schema, or package files will be modified during this audit. Only new files under `docs/proofs/navigation-sidebar-duplicate-audit/` will be created.
