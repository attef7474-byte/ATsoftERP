# Defect Register — Tables / i18n / Edit Prefill Corrective

| # | Defect | Category | Severity | Status | Resolution |
|---|--------|----------|----------|--------|------------|
| 1 | Tables not fully unified (13 legacy DataTable pages, 2 raw `<table>` pages) | Table Unification | Low | **CLOSED** | 13 DataTable pages converted to AdminDataGrid; 2 barcode pages documented N/A_EXPECTED (custom multi-filter toolbar) |
| 2 | Raw i18n keys visible (alerts, barcode scans, notification rules, StatusBadge) | i18n | Medium | **CLOSED** | Dynamic keys given fallbacks; missing locale keys added; i18n:check PASS |
| 3 | Edit forms not loading previous data | Edit Prefill | Low | **CLOSED** | All 9 inline-modal pages verified: form fields fully populated from list data; save handlers safe (optional fields omit-empty) |
| 4 | i18n:check script reading wrong files | i18n | Medium | **CLOSED** | Script fixed to glob `locales/*/*.ts` directly; 2,144 keys validated |
| 5 | Raw i18n keys visible in StatusBadge component | i18n | Medium | **CLOSED** | StatusBadge now uses `t()` with locale keys; test via Playwright audit passes |

## Summary
- **Closed**: 5
- **Open**: 0
