# 07 — Barcode, Inventory and Maintenance i18n Proof

## Barcode

Preview, records, templates, product labels, machine cards, scans and print jobs now use valid localized labels and shared enum translation. Preview no longer exposes raw JSON as normal UI.

## Inventory

Opening balances and stock adjustments received the required localized document/action labels. Inventory report movement/status/unit values use shared localization.

## Maintenance

SLA, workload, calendar, accountability, installed parts, repair orders, BOM, machine detail and KPI pages received missing labels and enum/status translation. Calendar SLA status is localized.

## Result

- Required barcode routes: 6/6 PASS.
- Required inventory routes: 2/2 PASS.
- Required maintenance routes in the screenshot set: 13/13 PASS.
- Raw namespace keys: 0 in visible DOM.
- Technical enum matches: 0 in visible DOM.
