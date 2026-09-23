# Production Readiness Checklist — Phase 1 (1.1–1.9)

Base line: Phase 1 closeout on 2026-09-23. Proof evidence: `docs/proofs/production-phase-1-final-closeout-2026-09-23/`.

## Verified items

- [x] 1.1 Production master data (products, versions, packagings, production lines, machines) — tenant/branch scoped.
- [x] 1.2 Shifts and operational assignments with central numbering (`PS-`, `PST-`, `PSC-`, `PSA-`, `POA-`, numbering index 53).
- [x] 1.3 Product capacity standards — CRUD, approvals, revision/suspend/reactive/archive transitions, history, resolve.
- [x] 1.4 Production orders — CRUD, plan, status transitions, history.
- [x] 1.5 Runs/execution and output recording at measurement points; run auto-start on `POST /production/runs`.
- [x] 1.6 Downtime segments/logs, loss reasons, loss quantity events with corrections.
- [x] 1.7 Material requirements prepare/freeze, material documents, finished-goods receipts — atomic inventory effects.
- [x] 1.8 Quality plans, characteristics, sampling points, inspections, results, dispositions, NCRs.
- [x] 1.9 Performance targets (deterministic precedence), OEE/analytics dashboards, production cost aggregation.
- [x] i18n: Arabic + English, RTL + LTR on every production page.
- [x] Permission keys seeded and enforced on backend; used on frontend.
- [x] Audit on sensitive production actions (orders, runs, transitions, material docs, receipts, targets).
- [x] Runtime proof on isolated clone: 104/104 PASS (all non-defect slices; D1–D4 captured as expected deterministic errors).
- [x] Browser proof: 32/32 PASS (15 production pages × Arabic RTL + English LTR clean render; loss-reasons create via UI; capacity-standard create dialog).
- [x] Regression gates green: API Jest 2898/2898, Web Jest 1011/1011, route contract 1112/0, i18n 6110 keys synchronized, raw-keys, credentials, ui-baseline, typecheck, `qa:build`, `prisma validate/generate`, `prisma migrate status` (84 migrations, up to date), `git diff --check`.
- [x] Fixture cleanup after proof: 0 survivors; inventory balances restored (WH-000001 qty=4, WH-000006 qty=0); production movements zero.

## Known defects (block final certification of dependent flows)

- [ ] D1 — `PATCH production/performance-targets/:id` partial body → HTTP 500 `[DecimalError] Invalid argument: undefined`.
- [ ] D2a/D2b — `PATCH production/orders/:id` partial body → HTTP 500 DecimalError; full body → HTTP 500 audit details truncation.
- [ ] D3 — `POST production/material-consumptions` → HTTP 500 `Unknown field 'recordedBy'`.
- [ ] D4 — `POST production/orders/:id/material-requirements` → HTTP 500 `Argument `company` is missing` (nested lines.create omits companyId/branchId). Cascades to material-document post and run close-for-valuation.

Each defect requires a dedicated, tested fix task before the affected slice is considered final. Do not treat the 104/104 runtime proof as covering these paths — they were captured as expected failures, not passes.