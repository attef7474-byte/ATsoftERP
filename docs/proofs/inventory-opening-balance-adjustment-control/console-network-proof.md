# Console & Network Proof — Opening Balances & Stock Adjustments

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Browser console errors captured | ✅ PASS | Test run captured `console.error` and `window.onerror` entries. No unhandled errors were observed during opening-balance or stock-adjustment workflows. |
| 2 | Network failures captured | ✅ PASS | `window.fetch` and `XMLHttpRequest` error events monitored. All XHR/fetch calls to `/inventory/*` returned HTTP 200/201/204; zero network faults. |
| 3 | ChunkLoadError monitored | ✅ PASS | `webpackChunkLoadError` global handler registered. No chunk-load failures occurred in any test scenario. |
| 4 | Failed `_next/static` loads monitored | ✅ PASS | Static-asset fetch errors (`_next/static/*`) tracked via the same error handler. Zero failures. |
| 5 | Screenshots | ⚠️ DISABLED | Screenshot capture was disabled by user configuration (`screenshots: false`). No visual regression evidence is available. |
| 6 | Network requests to `/inventory/opening-balances` verified | ✅ PASS | Request/response pairs recorded. Status 200, body includes `data[]` with expected shape. |
| 7 | Network requests to `/inventory/stock-adjustments` verified | ✅ PASS | Request/response pairs recorded. Status 200, body includes `data[]` with expected shape. |
