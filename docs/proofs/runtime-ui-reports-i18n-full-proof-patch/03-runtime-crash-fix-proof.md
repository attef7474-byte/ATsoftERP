# 03 — Runtime Crash Fix Proof

## Machine detail

- Root cause: `/maintenance/machine-spare-parts` returns an object envelope while the page passed the response directly to the table.
- Source normalization now extracts the array and preserves explicit loading, error, retry, and empty states.
- `DataTable` and `AdminDataGrid` now use `Array.isArray(data) ? data : []` before rendering.
- Machine detail also normalizes linked units, documents, requests, installed parts and replacement history values through shared localization.

## Runtime result

- Real machine route: `/admin/maintenance/machines/cmrx68p3i0000r095f0kcrqnz`.
- Heading: `ماكينة تغليف10019`.
- `data.map is not a function`: absent.
- Runtime overlay: absent.
- Main content and component tables: visible.
- Browser result: PASS.
