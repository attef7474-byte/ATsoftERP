# UX-1A — Shared i18n / Error / Validation Foundation — Proof Report

Date: 2026-08-01 · Branch: `main` (23f9c65) · Stack: Next.js :3000 + NestJS :4000 + SQL Server (WINCC:50079 / ATsoftERP_DB), no Docker.

## Status: COMPLETE (verified end-to-end at runtime)

## 1. Live runtime proof (Playwright/Chromium, DOM assertions, no screenshots)

Evidence JSON: `docs/proofs/evidence/ux1a-runtime-proof.json` (script: `docs/proofs/ux1a-shared-i18n-errors-validation-foundation/browser-proof.mjs`)

**15/15 PASS:**

1. Default page: `html lang=ar dir=rtl` (server-side `cookies()` in `app/layout.tsx`).
2. `atsoft_locale=en` cookie → `html lang=en dir=ltr`.
3. Empty login submit → inline errors, `aria-invalid="true"` + `aria-describedby="email-error|password-error"`, localized "This field is required." (EN).
4. Wrong credentials → global error dialog: `role="dialog" aria-modal="true"`, title "Error", `role="alert"` message "Invalid credentials" (server-localized via `x-locale`), UUID `requestId` displayed.
5. `x-locale: en` header observed on real API requests.
6. Focus moved into the dialog on open.
7. Escape closes the dialog and **restores focus to the trigger button**.
8. Admin login succeeds → `/admin/dashboard`.
9. Create-company modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → heading "New Company".
10. Empty company submit → inline error on `name`, focus on first invalid field, **no global dialog** (client-validation path).
11. Operational context resolved in browser storage.
12. Live backend validation contract (EN): `POST /companies {name:123}` → 400, `messageKey: common.validationFailed`, `errors: [{field:name, code:validation.invalidValue, message:"Invalid field value"}]`, `requestId` UUID, no raw exception leak.
13. Same call with `x-locale: ar` → Arabic summary message "فشل التحقق من صحة البيانات".
14. Arabic runtime: `lang=ar dir=rtl` with Arabic UI text.
15. Arabic error dialog: Arabic heading "خطأ", Arabic message "بيانات الدخول غير صحيحة", Arabic "معرف الطلب" + UUID — **no raw key leaked**.

Note: an "invalid email" UI case is impossible against the backend (companies email is `@IsString()` only), so a junk test company created during an earlier failed proof attempt was **deleted** via the API (200) after verifying it existed; DB left clean.

## 2. Automated tests

- Web logic (new suite `npm run test:web-logic`, root jest, `apps/web/tests/`): **43/43 passed** — `translation-core.test.ts` (fallback-never-raw, interpolation, HTML escaping, once-per-session missing-key reporting), `form-validation.test.ts` (path get/set, field maps, stale filtering, first-invalid focus safety, id mapping), `error-utils.test.ts` (server-first, status fallbacks, requestId, field localization, never raw key, network/abort detection, legacy axios).
- Backend (new): `validation-error-transformer.spec.ts` + `http-exception.filter.spec.ts`: **21/21 passed** (mapping families, nested/array paths, localization, requestId, internal-error no-leak, legacy string messages).
- Full `npm run test --workspace apps/api`: **53/53 executed tests passed**; 18 suites fail to run — all are **0-byte empty spec files committed in the initial commit** (e.g., `roles.guard.spec.ts`, `auth.service.spec.ts`, all `workflow-engine/*`, `request-policy/*`, `request-notifications/*`, `template-rendering`, `condition-evaluator`, `mqtt-message.parser`, `hr-requests.service`) — pre-existing, unrelated to this task.

## 3. Static verification

- `npm run i18n:check`: **PASS** — 3467 keys EN + 3467 AR, synchronized, all namespaces registered, no empty values.
- `node scripts/check-raw-keys.mjs` (`npm run raw-keys:check`): **PASS** — badges use canonical translators; `status.URGENT/ONCE` exist in both locales; 17 dynamic-`t()` concatenation sites (e.g., `t(\`status.${...}\`)`, `t(\`barcodes.scan.${...}\`)`) are WARN-only (safe under the fallback contract).
- `git diff --check`: clean (only benign CRLF warnings).

## 4. Builds

- `npm run build --workspace apps/api`: PASS (fixed during the session: duplicate `useTranslation` import in `permissions/page.tsx` → duplicate identifier build error).
- `npm run build --workspace apps/web`: PASS (135+ routes).
- `tsc --noEmit -p apps/api/tsconfig.json`: exit 0.

## 5. Defects found and fixed during proof

1. `useCrudList.ts`: client-side validation results with field errors also fired `onError` with a synthesized Error → global error dialog opened on plain validation → now field errors route only through `onFieldErrors` (inline); string/object-without-fields results still go to `onError`.
2. `Modal`: focus restore relied on `document.activeElement` captured in the open effect — when the trigger button was `disabled` mid-request, the browser moved focus to `<body>` and restore targeted body. Now a mount-scoped `focusin` capture listener tracks the last focusable outside any `[role="dialog"]` and restores it on close (also skips other dialogs).
3. `Modal`: initial focus grabbed the header X button and the open-effect re-ran on every parent re-render (inline `onClose` arrow identity) re-stealing focus after `focusFirstInvalidField` — selector now prefers form controls (`button:not([aria-label])`), effect depends on `[open]` only, `onClose` used via ref.
4. `error-utils.ts`: unknown `messageKey` could render the raw key; plain fetch `Error` objects with a `status` were misread as canonical bodies → status-based fallback (`errors.*`) and `looksCanonical` guard added (regression tests added first).

## 6. Scope delivered

- i18n: `locale-shared.ts` (cookie/localStorage/html-lang resolution, pure module), `app/layout.tsx` async server locale/dir, `x-locale` header on all API calls, permission keys translated via `translatePermissionKey` (list/matrix/role pages).
- Errors: backend `requestId`, safe internal-error contract, `validation-error-transformer`, `ValidationPipe.exceptionFactory`, localized validation message keys; frontend `normalizeApiError` (never raw keys, status fallbacks 400/401/403/404/409/413/422/429/500), Error carries `errors`/`requestId`; `useApiErrorHandler` supports `{dialog:false}`; error dialog with field list, details, requestId.
- Forms: `form-validation.ts` helpers; ARIA (`aria-invalid`, `aria-describedby`, required asterisk, description) on Input/Select/Textarea/F9Lookup; modal dialog semantics + focus management.
- Flows: login (dirty validation, dialog), companies (inline validation + focus), maintenance requests new/edit, inventory locks new.
- 6 new translation keys (EN+AR); `scripts/check-raw-keys.mjs` (new); `npm run test:web-logic` + `npm run raw-keys:check` (new).

## 7. Git status

Working tree on `main` @ 23f9c65; no commits made. New files from this task: `apps/api/src/common/validation/` (transformer + spec), `apps/api/src/common/filters/http-exception.filter.spec.ts`, `apps/web/src/lib/i18n/locale-shared.ts`, `apps/web/tests/` (4 files), `scripts/check-raw-keys.mjs`, `docs/proofs/ux1a-shared-i18n-errors-validation-foundation/`, `docs/proofs/evidence/ux1a-runtime-proof.json`. Pre-existing modified/untracked files (earlier sessions) remain untouched: inventory-adjustments/inventory modules, `create-stock-adjustment.dto.ts` (D), `permissions.guard.spec.ts`, seed/permission scripts, AGENTS.md/.gitignore, `opencode.json`, `proof-token.txt`, `docs/agent-rules/`, discovery reports.

## 8. Known limitations

- 17 dynamic `t()` concatenation sites remain (WARN-only by design; fallback contract prevents raw-key display).
- 18 pre-existing empty API spec files still fail "suite failed to run" (see §2) — not addressed (outside scope).
- Frontend display of backend API field errors was proven via unit tests + the live 400 contract; no UI path currently produces a backend field-error on these four flows (client validation intercepts first).
