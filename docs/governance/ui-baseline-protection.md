# Official UI / Appearance / i18n / Access Baseline Protection

Status: ACTIVE (permanent governance contract)

## 1. Purpose

ATsofterp's appearance, theming, translation, and access/roles/permissions UI layers
represent **accepted, approved application baseline** work. A stale legacy local
checkout (`C:\Users\attef\PycharmProjects\Trae\ATsofterp` at `e78b0e7`) contains
historical/stale tracked 0-byte appearance placeholders and local changes. That stale
state is **not** the baseline and is never described as "canonical main committing
empty files".

This document makes the protected baseline explicit and mechanical so future agents
and tools cannot silently revert, empty, or rewrite it. It is the human-readable
companion of the machine-readable manifest
`docs/governance/accepted-ui-i18n-baseline.json`, which is the contract the baseline
checker (`scripts/check-ui-baseline.mjs`) enforces.

## 2. Authoritative Source of Truth

* `origin/main` is the sole authoritative source of truth for the protected baseline.
* The stale legacy local checkout (`Trae/ATsofterp`, `e78b0e7`) is NOT authoritative.
* `docs/proofs/atsofterp-current-architecture-discovery-report.md` is a discovery aid only.
* Any disagreement: restore the protected files from `origin/main` and verify with the
  checks below. Never replace a protected file with an empty placeholder to make a build pass.

## 3. Authority and Reference Order

1. Engineering Constitution (`docs/architecture/atsoft-erp-engineering-constitution-v1.0.md`).
2. Domain rule files in `docs/agent-rules/`.
3. Permanent Development Contract (`docs/architecture/atsoft-erp-development-contract-v1.0.md`)
   — section 8-5 defines the baseline non-regression rule; section 14-10 adds the
   baseline check to the validation gates.
4. This governance contract and `docs/governance/accepted-ui-i18n-baseline.json`.
5. `AGENTS.md` (concise summary).
6. Discovery report (aid only, never design authority).

## 4. Protected Files and Invariants

Defined in `docs/governance/accepted-ui-i18n-baseline.json` under `protectedFiles`.
Highlights:

| Area | Files | Invariant |
| --- | --- | --- |
| Theme layer | `apps/web/src/lib/appearance-theme.ts` | Non-empty; exports `REFERENCE_DEFAULT`, `PRESET_PROFILES`, `normalizeAppearanceSettings`, `buildAppearancePayload`, `buildGradientCss`, `buildTopbarGradientCss`, `buildRadiusValue`, `buildSidebarPalette`, `buildFormHeaderTokens` |
| Provider | `apps/web/src/components/admin/theme/appearance-provider.tsx` | Non-empty; defines `AppearanceProvider`, `useAppearance`, `applyAppearance` |
| Facade | `apps/web/src/components/admin/theme/use-appearance.ts` | Non-empty; re-exports `useAppearance` |
| Admin wiring | `apps/web/src/app/admin/layout.tsx` | Wraps children in `AppearanceProvider` > `AdminShell` |
| Shell | `apps/web/src/components/admin/shell/admin-shell.tsx` | Consumes `useAppearance` and `AdminActionBarProvider` |
| Appearance studio | `apps/web/src/app/admin/settings/appearance/page.tsx` | Non-empty; renders `data-theme-preview`; consumes `PRESET_PROFILES` |
| Access pages | `apps/web/src/app/admin/access/` pages listed in the manifest | Use `translatePermissionKey` for user-visible permission labels; no visible raw permission keys |
| Role localization | `apps/web/src/lib/i18n/literals.ts` | Exports `translatePermissionKey`, `translateRoleName`, `translateRoleDescription`, `translateEnum` |
| Design tokens | `apps/web/src/app/globals.css` | Defines all 14 `--ats-*` tokens |
| i18n | `apps/web/src/lib/i18n/` locale namespaces | All namespaces non-empty in `en` and `ar`; key sets synchronized |
| Routes | `/admin/settings/appearance`, `/admin/access/permissions`, `/admin/access/roles`, `/admin/access/roles/[id]/permissions` | Present in `apps/web/src/app` |

## 5. Raw Permission Key Policy (final owner rule)

* Normal user-facing pages MUST NOT render raw permission keys
  (`administration:update`, `attachment:read`, `settings.appearance.manage`, ...).
* Raw keys are permitted only in internal contexts: state, API payloads, database,
  debugging, and permission matching.
* The UI must show only localized human-readable labels
  (`translatePermissionKey` / `translateEnum`).
* The baseline checker rejects any `{...permission.key}` / `{...perm.key}` rendering
  in the protected access pages (forbiddenVisiblePatterns in the manifest).

## 6. System Role Display Localization

* System-defined roles (e.g. `SUPER_ADMIN`) display localized labels and descriptions:
  `translateRoleName(code, name, isSystem, locale)` and
  `translateRoleDescription(code, description, isSystem, locale)`.
  Keys: `access.roleSuperAdmin`, `access.roleSuperAdminDescription` in `en`/`ar`.
* Custom roles pass through with their stored name/description untouched
  (`CUSTOM_ROLE_CONTENT_PRESERVED=YES`).

## 7. Accepted Minimum Commits

The baseline requires these commits to be recorded in `origin/main` ancestry
(manifest `acceptedMinimumCommits`):

| SHA | Subject | Purpose |
| --- | --- | --- |
| `d9d0486c71665a3e966e78f1ebe9faa7cb56e71d` | appearance | resolve final appearance integration regressions |
| `95b8f9f446c5d2e0c678383744e2c2f1daac7150` | permission-localization | localize access permission labels |

## 8. Mechanical Guardrails (must pass before finishing any UI/i18n task)

```sh
npm run ui-baseline:check        # reads the manifest; baseline integrity + i18n parity + raw keys + permission UI
npm run i18n:check               # en/ar key parity, namespaces registered, no empty values
npm run raw-keys:check           # no raw status/priority renders, canonical translators
node scripts/verify-permission-ui.mjs   # no raw permission keys, localized denial text
```

`npm run qa:all` includes `ui-baseline:check`; it is part of the release gate.

## 9. Corruption Detection Rule

Any protected file that is missing, empty, truncated, or missing a required export/token
**fails the build gate**. Do not "fix" the gate by deleting the check or emptying the file;
restore the real implementation from `origin/main`. Mojibake (U+FFFD) in protected text
files also fails the gate.

## 10. Change Policy

Changes to protected files require an explicit, approved task. They must keep the
invariants above and add/update regression tests. Merges must be reviewed against this
baseline before integration to `origin/main`. Any change to the manifest itself is a
governance change and requires explicit approval.
