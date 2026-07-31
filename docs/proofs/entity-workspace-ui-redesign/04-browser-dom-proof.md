# Browser / DOM Proof — Corrective Phase

**Method**: Real Playwright browser (headless Chromium, 1440×900) against `http://localhost:3000` (Next.js dev server) + `http://localhost:4000/api/v1` (NestJS). Screenshots disabled per user policy — assertions are DOM-based.

**Credentials**: safe local test account (`admin@atsofterp.com`), active default context: company `Test` (DEFAULT) / branch `Headquarters` (HQ). Second context used for warehouse-row proof: `Runtime Co` / `Rt Branch` (contains warehouse `WH-000001`).

## Result: 25 / 25 PASS — FAIL 0

| # | Check | Result | Detail |
|---|-------|--------|--------|
| 1 | Login → dashboard | PASS | URL `/admin/dashboard` |
| 2 | Companies table rows | PASS | active-context row: DEFAULT / Test |
| 3 | Companies drawer opens | PASS | `role=complementary`, aria-label = Test |
| 4 | Close button visible | PASS | `button[aria-label="إغلاق اللوحة"]` |
| 5 | Close button closes drawer | PASS | drawer detached after click |
| 6 | Drawer section [الفروع] | PASS | 6 real branch rows (Headquarters/HQ, Updated Test Branch/BR-001…) |
| 7 | Drawer section [الأقسام] | PASS | 3 real department rows (Administration/ADMIN…) |
| 8 | Drawer section [المستخدمون] | PASS | 3 real user rows (Administrator/admin@atsofterp.com…) |
| 9 | Drawer section [المستودعات] | PASS | 18 real warehouse rows (مخزن قطع الغيار/WH-000001, Main Warehouse/WH-MAIN…) |
| 10 | Branches table rows | PASS | first row HQ / Headquarters / Test |
| 11 | Branches [الأقسام] | PASS | real empty state (API returns []) |
| 12 | Branches [المستخدمون] | PASS | real user rows |
| 13 | Branches [المستودعات] | PASS | real warehouse rows |
| 14 | Departments [المستخدمون] | PASS | real user rows (scoped by company) |
| 15 | Users drawer [الأدوار] | PASS | inline role "Super Administrator" (no fetch) |
| 16 | Users drawer no [النطاقات التشغيلية] tab | PASS | 404 endpoint removed from UI |
| 17 | Warehouses page rows (default context) | PASS | 6 rows |
| 18 | Context switch to Runtime Co | PASS | via top-bar switcher |
| 19 | Warehouses rows after switch | PASS | 6 rows (context-scoped) |
| 20 | Warehouses [المواقع] | PASS | real empty — API `/inventory/warehouses/:id/locations` returns `[]` (probe-verified), drawer no longer shows false loading |
| 21 | Machine Parts label | PASS | "الصنف المخزني المرتبط" visible on form |
| 22 | No exact "المنتج" label | PASS | 0 exact `label` matches |
| 23 | Zero console errors | PASS | — |
| 24 | Zero request failures | PASS | navigation aborts excluded |
| 25 | No unexpected 4xx/5xx API | PASS | zero 403/404/500 during flows (401 excluded: auth probing) |

## Bugs caught and fixed during proof

1. **Close button unclickable** (topbar z-60 intercepted the drawer trapped inside `.admin-main` z-40 stacking context) → fixed by portaling drawer to `document.body` (overlay z-80, panel z-90). Re-proven PASS (#4, #5).
2. **403 mismatch handling**: drawer fetches for entities outside the active context are rejected by `ActiveContextInterceptor` (by design) — proof selects active-context rows; cross-context rows surface a localized Global Error Dialog via `useApiErrorHandler`.
3. **Hydration timing**: login fill before React hydration was reset — proof waits for hydration (2.5 s) before filling.

## Cross-company behavior (documented limitation)

Opening a drawer row whose company differs from the active context triggers the interceptor's 403 → Global Error Dialog with localized message (`operationalContext.companyMismatch`). This is the platform's strict context rule, surfaced with a clear error instead of stale data. The user selects the correct context via the top-bar switcher.
