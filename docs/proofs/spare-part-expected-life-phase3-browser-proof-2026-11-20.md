# Spare Part Expected Life — Phase 3 Browser Proof (2026-11-20)

**Status:** `PHASE3_BROWSER_PROOF=PASS`  
**Application source SHA:** `ebc70e5eebe422f8983863bbcb033d9c40404ce0`  
**Deployed build ID:** `U-4jzO4R_WsGB_tMlQ4lA`  
**Base URL:** `https://DELL`  
**API base path:** same-origin `/api/v1` only  
**Evidence:** `.tmp/phase3-browser-proof/evidence.json`  
**Script:** `.tmp/phase3-browser-proof/run.js`  
**Screenshots:** 12 PNG files in `.tmp/phase3-browser-proof/`  
**Secrets:** `REDACTED`

## 1. Execution identity

| Item | Result |
| --- | --- |
| Final run generated at | `2026-11-20T00:06:08.673Z` |
| Branch recorded in evidence | `main` |
| HEAD recorded in evidence | `ebc70e5eebe422f8983863bbcb033d9c40404ce0` |
| Services after final deployment | `ATsoftERP_API`, `ATsoftERP_Web`, `ATsoftERP_Caddy` all Running |
| Direct API health | `200` |
| Proxied API health | `200` |
| Web root | `200` |
| Served build ID present | `True` |

## 2. Authentication and safety

The proof used `AUTH_MODE=ENV_DERIVED_JWT`. The HS256 token was derived only from the root `.env` `JWT_SECRET` plus the database-queried canonical admin `id`, `email`, and `authVersion`. No password, secret, connection string, or token was printed or written to evidence. The operational context was selected through `/auth/contexts` and all API calls stayed same-origin under `/api/v1`.

## 3. Instrumentation

Real Playwright/Chromium navigated the deployed application. The script recorded console errors, page errors, 5xx responses, and unexpected 4xx responses, asserted API status codes, inspected DOM selectors, and queried the database only for audit-detail assertions and row-count reconciliation. Four proof-script defects were corrected before the final PASS run: paired catalog life fields, the lookup endpoint for tenant search, a long-string SQL reader for audit details, and distinct standard-vs-applied label assertions. None of these corrections changed application behavior.

## 4. Catalog configuration and immutable inheritance

| Check | Result |
| --- | --- |
| Initial DAYS standard / applied | `5` / `5` |
| Initial HOURS standard / applied | `8000` / `8000` |
| Initial CYCLES standard / applied | `500` / `500` |
| Catalog HOURS value after change | `10000` |
| First HOURS installed part after catalog change | applied remains `8000` |
| New HOURS installed part after catalog change | applied inherits `10000` |
| Conclusion | Existing installed-part snapshots are immutable; new instances inherit the current catalog default. |

## 5. Lifecycle, readings, and reset

| Check | Result |
| --- | --- |
| DAYS configuration status | `200` |
| Backend DAYS life status | `WARNING` |
| Backend DAYS progress | `80` percent |
| HOURS reading for a DAYS-based life | rejected with `400` |
| Decreasing HOURS reading | rejected with `400` |
| Preserved reading history count | `3` |
| Explicit reset current reading | `0` |
| Reset notes | `PHASE3_BROWSER_PROOF_RESET` |

All readings were persisted as real database rows through the existing API. The rejected readings created no silent correction and no hidden history mutation.

## 6. Tenant and permission denial

| Check | Result |
| --- | --- |
| Cross-tenant direct read | `404` |
| Cross-tenant write | `404` |
| Cross-tenant lookup search leak | `false` |
| Missing-permission life configuration | `403` |
| Missing-permission reading creation | `403` |

The search assertion used `/installed-parts/lookup?search=...` because the generic installed-parts list DTO does not expose `search`.

## 7. Audit proof

Three audit actions were read directly from `dbo.audit_logs` with full-detail SQL output:

| Action | Evidence ID | Asserted content |
| --- | --- | --- |
| `INSTALLED_PART_REGISTERED` | `cmwo7xupr006i2g95ni1zd8uv` | applied life snapshot, standard value/unit, warning threshold, tenant IDs |
| `EXPECTED_LIFE_CONFIGURED` | `cmwo7xv5t006o2g95citu4nqs` | previous/current values, unit, warning threshold, actor, timestamp |
| `INSTALLED_PART_READING_RECORDED` | `cmwo7xvj9006v2g95riobw844` | old/new reading, `isReset`, notes, actor, timestamp |

The audit checks confirmed that resetting a meter reading is explicit and carries old value, new value, actor, time, and notes.

## 8. Arabic / RTL and English / LTR

| Locale | Direction | Observed labels |
| --- | --- | --- |
| English | `ltr` | `Warning`, `Normal`, `Days`, `Operating Hours`, `Cycles`; standard and applied values shown separately |
| Arabic | `rtl` | `تحذير`, `طبيعي`, `أيام`, `ساعات تشغيل`, `دورات`; standard and applied values shown separately |

The DOM body was asserted free of raw enum/status text and raw i18n keys on installed-part detail pages.

## 9. Network and visual proof

| Check | Result |
| --- | --- |
| Console errors | `0` |
| Page errors | `0` |
| 5xx responses | `0` |
| Unexpected 4xx responses | none |
| Screenshots | `12` |

Screenshot files:

* `.tmp/phase3-browser-proof/installed-part-en-days.png`
* `.tmp/phase3-browser-proof/installed-part-en-hours-snapshot.png`
* `.tmp/phase3-browser-proof/installed-part-en-hours-current.png`
* `.tmp/phase3-browser-proof/installed-part-en-cycles.png`
* `.tmp/phase3-browser-proof/installed-part-ar-days.png`
* `.tmp/phase3-browser-proof/installed-part-ar-hours-snapshot.png`
* `.tmp/phase3-browser-proof/installed-part-ar-hours-current.png`
* `.tmp/phase3-browser-proof/installed-part-ar-cycles.png`
* `.tmp/phase3-browser-proof/reliability-en.png`
* `.tmp/phase3-browser-proof/reliability-ar.png`
* `.tmp/phase3-browser-proof/spare-part-en-hours.png`
* `.tmp/phase3-browser-proof/spare-part-ar-hours.png`

## 10. Stock safety and cleanup

Counts before, after operations, and after guarded cleanup were reconciled. Guard prefixes were `PHASE3_BROWSER_PROOF%` for installed parts and `P3BP-%` for spare parts; readings were removed by installed-part ID.

| Table / measure | Before | After cleanup |
| --- | ---: | ---: |
| `products` | 128 | 128 |
| `spare_parts` | 406 | 406 |
| `machine_installed_parts` | 3 | 3 |
| `machine_installed_part_readings` | 0 | 0 |
| `inventory_movements` | 74 | 74 |
| `inventory_movement_lines` | 89 | 89 |
| `inventory_balances` | 21 | 21 |
| `spare_part_replacement_histories` | 0 | 0 |
| Inventory quantity sum | 1966550 | 1966550 |
| Inventory base quantity sum | 547 | 547 |

## 11. Result

`cleanup=PASS`, `result=PASS`. The real path Frontend → API → Permission → Service → Database → Audit → Result was exercised in both languages with no stock side effects.
