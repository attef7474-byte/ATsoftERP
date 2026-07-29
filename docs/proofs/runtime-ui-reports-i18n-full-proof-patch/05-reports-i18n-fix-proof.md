# 05 — Reports i18n Fix Proof

## Scope

- Report hub navigation groups.
- Audit, assets, barcode scans, inventory overview/adjustments/count variance/movements.
- Machine log, maintenance overview/KPIs/requests/schedules.
- Notifications, overdue/upcoming preventive maintenance, partners, parts and user activity.
- Shared report summary cards.

## Changes

- Added the missing report labels to both EN and AR locale trees.
- Corrected the shared summary-card namespace so it no longer resolves `reports.reports.*`.
- Replaced uppercase/dynamic raw output with shared enum and status translation.
- Added translated zero-value, quantity, currency, duration and count labels.
- Navigation report groups now resolve through valid Arabic/English keys.

## Proof

- EN/AR parity: 3351/3351.
- All modified report routes were part of the 36-route real-browser run.
- Visible `reports.*`/`REPORTS.*`: 0.
- Runtime errors and console errors: 0.
