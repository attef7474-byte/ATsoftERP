# Phase 6 Browser, i18n, RBAC, and Tenant Proof — 2026-11-21

Status: COMPLETE

## 1. Browser environment

| Item | Value |
| --- | --- |
| Origin used for proof | `http://localhost:3000` |
| API path model | Same-origin `/api/v1/:path*`, rewritten to `http://127.0.0.1:4000/api/v1/:path*` |
| Caddy proxy checked separately | `https://dell/api/v1/health` returned HTTP 200 |
| Proof tab | `tab_91ebce32-c903-478e-ba76-6afd5654ba45` |
| Authenticated role for allow cases | SUPER_ADMIN |
| Restricted user for deny cases | `cmrvc41md0000ys95gy4pegey` (`E2E_ROLE`, `CAPACITY_APPROVER`) |

Temporary env-only token servers on ports `4599`, `4600`, and `4601` were stopped after proof. All three ports were verified as no longer listening. No password, token, or JWT value is recorded here; credential material is `REDACTED`.

## 2. English LTR canonical report export

| Check | Result |
| --- | --- |
| Route | `/admin/reports/inventory` |
| Direction | `dir=ltr` |
| Button | `Export XLSX` |
| API | `GET /api/v1/reports/export/excel/inventory/overview` |
| HTTP status | 200 |
| Download | `Inventory Overview_2026-11-21.xlsx` |
| Size | 7,416 bytes |
| XLSX magic bytes | `50 4B 03 04` |
| Raw-key candidates | 0 |
| Console errors | 0 |
| HTTP failures | 0 |

## 3. Arabic RTL canonical report export

| Check | Result |
| --- | --- |
| Route | `/admin/reports/inventory` |
| Direction | `dir=rtl` |
| Button | `تصدير XLSX` |
| API | `GET /api/v1/reports/export/excel/inventory/overview` |
| HTTP status | 200 |
| Download | `نظرة عامة على المخزون_2026-11-21.xlsx` |
| Size | 7,416 bytes |
| XLSX magic bytes | `50 4B 03 04` |
| Raw-key candidates | 0 |
| Console errors | 0 |
| HTTP failures | 0 |

## 4. English LTR governance Excel export

| Check | Result |
| --- | --- |
| Route | `/admin/access/permissions` |
| Direction | `dir=ltr` |
| Button | `Export search results` |
| API | `GET /api/v1/master-data-excel/permissions/export?locale=en` |
| HTTP status | 200 |
| Download | `permissions-export.xlsx` |
| Size | 33,595 bytes |
| Visible permissions total | 828 |
| Raw-key candidates | 0 |

## 5. Arabic RTL governance Excel export

| Check | Result |
| --- | --- |
| Route | `/admin/access/permissions` |
| Direction | `dir=rtl` |
| Button | `تصدير نتائج البحث` |
| API | `GET /api/v1/master-data-excel/permissions/export?locale=ar` |
| HTTP status | 200 |
| Download | `permissions-export.xlsx` |
| Size | 33,800 bytes |
| Raw-key candidates | 0 |

Both Arabic and English downloads were real XLSX files. No translated UI string was replaced by a raw translation key.

## 6. RBAC allow proof

The SUPER_ADMIN session displayed both the canonical report `Export XLSX` action and the governance `Export search results` / `تصدير نتائج البحث` action. Both export APIs returned 200 with XLSX bytes when the active context was authorized.

## 7. RBAC deny proof

The restricted user did not see either governance export button. With correct active operational-context headers:

| Request | Result |
| --- | --- |
| Governance export | HTTP 403, `messageKey: auth.insufficientPermissions` |
| Canonical report export | HTTP 403, `messageKey: auth.insufficientPermissions` |

Frontend hiding was not treated as enforcement; the backend denial is the proof.

## 8. Tenant spoofing proof

The restricted user was given foreign active-company/branch headers:

| Request | Result |
| --- | --- |
| Governance export with foreign context | HTTP 403, `messageKey: operationalContext.notAllowed` |
| Canonical report export with foreign context | HTTP 403, `messageKey: auth.insufficientPermissions` |
| Authorized SUPER_ADMIN context, same report | HTTP 200 with real XLSX bytes |

The correct operational-context header names were `x-active-company-id`, `x-active-branch-id`, `x-active-administration-id`, and `x-active-department-id`. Incorrect `x-companyId` / `x-branchId` headers produce `operationalContext.headersRequired` and were not used as proof.

## 9. Browser proof hygiene

* `browser.network.list` intermittently returned `Expected JSON value`; the read was retried and request status was corroborated with same-origin `fetch` plus downloaded bytes.
* `browser.evaluate` bodies were wrapped in IIFEs; top-level `return` produced an illegal statement in an earlier attempt.
* Downloads were rechecked after the action settled because one download appeared one call after the click.
* Element refs were not reused across tabs.
* No console error or HTTP failure was attributed to the passing flows.

## 10. Conclusion

Arabic RTL and English LTR are proven on both export surfaces. SUPER_ADMIN allow, restricted-user deny, and foreign-context spoof rejection are proven at the backend. Browser/RBAC/i18n status is COMPLETE.
