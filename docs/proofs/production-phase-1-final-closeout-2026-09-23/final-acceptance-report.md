# ATsoftERP — Production Phase 1 Final Closeout (1.1–1.9)

**إقفال المرحلة 1 لوحدة الإنتاج — التقرير النهائي للقبول**

- **Date:** 2026-09-23
- **Scope:** Production Phase 1 vertical slices 1.1–1.9 — master data, shifts/assignments, capacity standards, production orders, execution runs/output, downtime/loss reasons, waste/rework, material requirements/documents, finished-goods receipt, quality, production cost, OEE/analytics.
- **Method:** strict OWNER-AUTHORIZATION isolated clone proof against `localhost:4010` (clone DB `ATsoftERP_P1CLOSE_20260923`, SQL on 50079), production web build on 3000 with API rewrite 4000→4010 for browser proof.
- **Design constraint honored:** zero source-code changes. All proof artifacts live in this folder; defects D1–D4 are reported, not fixed.

---

## 1. Verdict

| Area | Result |
|---|---|
| Runtime proof (clone API) | 104 / 104 PASS (non-defect slices), D1–D4 captured as expected deterministic failures |
| Browser proof (production web → clone API) | 32 / 32 PASS |
| API Jest | 2898 / 2898 PASS (163 suites) |
| Web Jest | 1011 / 1011 PASS (36 suites) |
| Route contract | 1112 matched / 0 malformed / 0 unresolved / 0 mismatches |
| i18n | 6110 keys EN = 6110 keys AR, fully synchronized, all namespaces registered |
| Raw-key / credentials / ui-baseline | PASS |
| Typecheck (API tsc) | PASS |
| `qa:build` (API + Web) | PASS |
| `prisma validate` / `prisma generate` | PASS |
| `prisma migrate status` | 84 migrations, database up to date |
| `git diff --check` | PASS |
| Fixture sweep after proof | 0 survivors |
| Inventory balances restored | WH-000001 qty=4, WH-000006 qty=0; production movements 0 |

**Status: COMPLETE** for all non-defect production slices and for the closeout evidence itself. **BLOCKED paths:** D1–D4 (each requires a dedicated fix task — see §7).

---

## 2. Scope Completed in This Proof Cycle

No source files changed. Work performed:

1. Recorded baseline: branch `main`, HEAD `a4549eea docs(cost): freeze COST-R2D-B3 production closeout evidence`, clean working tree.
2. Provisioned strict-owner test fixtures on the isolated clone (limited role with a single operational context; checker SUPER_ADMIN role for cross-checks) and verified the isolation matrix (context B denied, default deny, SUPER_ADMIN = explicit).
3. Executed the full runtime proof: factory order → plan → material requirement prepare (KNOWN DEFECT D4) → run (auto-start) → measurement point → output → loss reasons → loss events → downtime → material document (blocked by missing frozen snapshot) → inventory-effect atomicity (balance unchanged) → finished-goods receipt → quality plan/characteristics/sampling → inspection → disposition → NCR → performance target (KNOWN DEFECT D1) → cost close-for-valuation (blocked by pending DRAFT material document) → analytics + security/summary checks.
4. Captured backend stderr evidence for every defect with requestId per failure.
5. Re-ran fixture sweep → 0 survivors; verified inventory balances unchanged after the entire proof and re-provision.
6. Ran the browser proof: 15 production pages × (Arabic RTL + English LTR) with console/chunk/static-error watchers and raw-key detection, plus real UI create flows (loss-reasons create persists to the grid; capacity-standard create dialog renders with real lookups).
7. Swept browser-created data (`PLR-BR-*` loss reasons included), re-verified balances.
8. Ran the full regression gate battery (§4).
9. Updated governance docs (§6).

---

## 3. Runtime Proof Details (isolated clone, 104/104)

Executed from the protected evidence workspace (outside the repo; scripts there read credentials from the local .env / trusted environment variables and are intentionally not committed). Results recorded in `evidence/clone-api-stderr.txt` (prisma/error evidence with requestId per failure) and `evidence/runtime-created-ids.json` (the created fixture ids). Each `[PASS]` is a real `Frontend→API→Permission→Service→Database→Audit→Result` (or `→ExpectedError`) assertion:

- Auth as admin and limited/checker fixture users; tenant context A enforced everywhere.
- 1.3 capacity standard create + detail + update + approve + history.
- 1.4 production order create (auto `PO-` numbering), plan, transition, history; material-requirement prepare expected-fails D4.
- 1.5 run create (auto-start, `RUN-`), session, measurement point, output events (sequential machine stage behavior verified — no double counting), run transitions, run history.
- 1.6 loss reasons create (`P1CLOSE-LR`, category WASTE), downtime segment/log create, loss quantity event with correction, linking.
- 1.7 material document for received goods (correct path), material-document.create for a DRAFT requirement expected-fails with `productionMaterialRequirement.missingFrozenSnapshot`; inventory-effect check showed balance unchanged (atomicity maintained); finished-goods receipt with valued quantity.
- 1.8 quality plan + characteristics + sampling points + inspection + results + disposition + NCR + transitions.
- 1.9 performance target create (D1 avoided on first path; D1 reproduced on partial PATCH below), OEE/analytics endpoint checks, cost close-for-valuation blocked by pending DRAFT material document (`productionRunCostAggregation.pendingDocuments`).
- Security: limited-user context-B access denied (403), limited-user default read denied (403), checker (SUPER_ADMIN) context-A allowed (200).

Summary line recorded: `RUNTIME PROOF SUMMARY: 104 PASS / 0 FAIL / 104 total` with `requestId` evidence for the four defect paths in `evidence/clone-api-stderr.txt`.

### Captured backend defect evidence (stderr, isolated clone)

| Defect | Method/URL | Error (stderr) |
|---|---|---|
| D1 | `PATCH /api/v1/production/performance-targets/{id}` | `[DecimalError] Invalid argument: undefined` |
| D2a | `PATCH /api/v1/production/orders/{id}` (partial) | `[DecimalError] Invalid argument: undefined` |
| D2b | `PATCH /api/v1/production/orders/{id}` (full) | `DriverAdapterError: String or binary data would be truncated` |
| D3 | `POST /api/v1/production/material-consumptions` | `PrismaClientValidationError: Unknown field 'recordedBy'` |
| D4 | `POST /api/v1/production/orders/{id}/material-requirements` | `PrismaClientValidationError: Argument `company` is missing` (nested `lines.create` omits `companyId`/`branchId`) |

`evidence/clone-api-stderr.txt` reproduces these exact error lines with their `requestId`s and the prisma client version.

---

## 4. Regression Gates (all run against the current source, 2026-09-23)

| Gate | Command | Result |
|---|---|---|
| i18n sync | `npm run i18n:check` | PASS — 6110 keys EN/AR, synchronized |
| Raw-key safety | `npm run raw-keys:check` | PASS |
| Hardcoded credentials | `npm run credentials:check` | PASS |
| API route contract | `npm run route-contract:check` | 1112 matched, 0 malformed, 0 unresolved |
| API unit/integration | `npm run test:api` | 2898/2898 PASS |
| Web logic | `npm run test:web-logic` | 1011/1011 PASS |
| Typecheck | `npm run typecheck` | PASS |
| Builds | `npm run qa:build` (api + web) | PASS |
| Prisma schema | `npx prisma validate` / `npx prisma generate` | PASS |
| Migrations | `npx prisma migrate status` | 84 migrations, up to date |
| UI baseline protection | `npm run ui-baseline:check` | PASS |
| Diff hygiene | `git diff --check` | PASS |

---

## 5. Browser Proof Details (32/32 PASS)

Proof script: `browser-proof.pw.ts` + `playwright.config.ts` (run from repo root against the repo's installed `@playwright/test`). Approach: production web (`next start -p 3000`) with `page.route` rewriting `localhost:4000/api/v1` → `localhost:4010/api/v1` so the browser exercises the isolated clone; single shared admin login (an API restart preceded the run to reset the login-rate-limit window).

Coverage:

- 15 production pages × 2 locales = 30 clean-render tests (AR = RTL `dir="rtl"`, EN = LTR `dir="ltr"`): orders, capacity-standards, runs, measurement-points, downtime, loss-reasons, losses, material-documents, material-requirements, finished-goods-receipts, performance-targets, quality/plans, quality/inspections, quality/ncrs, analytics.
- Each render test asserts: page loaded and interactive, `h1/h2/h3` visible, correct `dir` attribute, no console errors, no `ChunkLoadError`, no failed `/_next/static` requests, and no raw i18n keys leaked into the page body.
- Interaction: loss-reasons create through the real UI dialog → record persists into the grid (search finds the new code).
- Interaction: capacity-standard create dialog opens with real F9/product/line lookups (EN, LTR).

Result: **32 passed**.

---

## 6. Governance Documents Updated

- `AGENTS.md` — §12 Production Module updated from "does not exist" to implemented Phase 1 with D1–D4 cross-reference.
- `docs/agent-rules/domain-rules/production.md` — rewritten to reflect the implemented slices, invariants, and full D1–D4 defect contract (no silent fixes in doc work; dedicated tasks required).
- `docs/architecture/master-plan.md` — Phase 1 (1.1–1.9) marked as implemented with closeout pointers.
- `docs/43-production-readiness-checklist.md` — previously empty; filled with the verified checklist and the D1–D4 open items.
- `docs/19-production-orders.md` — previously empty; filled with order behavior, permissions, numbering, and D2/D4 defect notes.
- New proof evidence in `docs/proofs/production-phase-1-final-closeout-2026-09-23/`.

---

## 7. Known Defects (each requires a dedicated, tested fix task)

| ID | Location | Failure | Impact |
|---|---|---|---|
| D1 | `production-performance-targets` service update | Partial `PATCH` returns 500 `[DecimalError] Invalid argument: undefined` (undefined numeric field reaches Decimal constructor) | Performance-target partial edits broken |
| D2a | `production-orders` service update | Partial `PATCH` returns 500 `[DecimalError] Invalid argument: undefined` | Order partial edits broken |
| D2b | `production-orders` service update + audit | Full `PATCH` returns 500 `DriverAdapterError: String or binary data would be truncated` (audit `details` exceeds `nvarchar(1000)`) | Order full edits broken |
| D3 | `production-material-consumptions` constants | `POST` returns 500 `Unknown field 'recordedBy'` (permitted include not on the Prisma model) | Material-consumption posting broken |
| D4 | `production-material-requirements` `buildRequirementData` | `POST orders/:id/material-requirements` always returns 500 `Argument `company` is missing` (nested `lines.create` omits `companyId`/`branchId`) | Blocks requirement freeze, material-document posting (`missingFrozenSnapshot`), and run close-for-valuation (`pendingDocuments`) |

No fix was applied in this evidence cycle by design. Fixing D4 must be sequenced before re-certifying the material-requirement/material-document/close-for-valuation flow.

---

## 8. Data Integrity and Isolation Proof

- All proof fixtures created against the isolated clone DB only.
- Fixture sweep (incl. `P1CLOSE-` and browser `PLR-BR-` markers) → `SURVIVING_PHASE1_CLOSEOUT_FIXTURE_COUNT=0`.
- Inventory balances after the complete cycle: WH-000001 qty=4 and WH-000006 qty=0 (identical to seeded state); `productionMovements` count = 0.
- Tenant isolation requirements exercised: limited user granted context A denied for context B (403); default read denied (403); SUPER_ADMIN explicit and audited.

---

## 9. Pre-existing Issues / Constraints Encountered

- The clone API login rate limit (per IP+email, ~5 per window, reset only by API restart) throttled the first browser-proof attempt (32 per-test logins → 429). Restart + single shared admin token fixed it. This is a test-harness constraint, not a production defect.
- `npx playwright` from outside the repo resolved a different `playwright` package; the browser proof must be run from the repo root so the installed `@playwright/test` is used (config lives in this proof folder).
- The runtime proof's very first probe attempt used an incorrect run-start endpoint and produced a false material-document 400; corrected to `POST /production/runs` (auto-start) — documented to avoid re-running the misleading path.

---

## 10. Git Status

- Branch `main`, HEAD `a4549eea` before this cycle (unchanged until the governance commit).
- After proof: working tree contained only the new `docs/proofs/production-phase-1-final-closeout-2026-09-23/` directory (untracked) plus the governance doc edits above; `test-results/` is gitignored; no source files changed.
- Follow-up repair in verification: files credited as "committed" are final only after the single documentation-only governance commit is pushed and verified against `origin/main` (see the session closeout in the conversation).

---

## 11. How To Reproduce

Executable proof scripts (`runtime-proof.cjs`, `fixtures-setup.cjs`, `fixtures-setup-checker.cjs`, `fixtures-cleanup.cjs`, `verify-balances.cjs`, `restart-detached.ps1`) are deliberately kept out of the repository because they consume local `.env` credentials. They are preserved in the protected evidence workspace used for this run:

1. Start the isolated clone API: `powershell -NoProfile -ExecutionPolicy Bypass -File restart-detached.ps1` (evidence workspace) → `http://localhost:4010/api/v1`.
2. Provision fixtures: `node fixtures-setup.cjs && node fixtures-setup-checker.cjs`.
3. Run runtime proof: `node runtime-proof.cjs` (expect `104 PASS / 0 FAIL`).
4. Run browser proof from repo root (env-driven creds, matching `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` in `browser-proof.pw.ts`): `npx playwright test --config "docs/proofs/production-phase-1-final-closeout-2026-09-23/playwright.config.ts"` (expect 32 passed). Prerequisites: restart the production web server (`next start -p 3000`) after the last web rebuild so chunk manifests match the on-disk build, restart the clone API to clear the login-rate-limit window, and use a fresh browser run with no prior login probes — the spec logs in once and shares the token.
5. Sweep: `node fixtures-cleanup.cjs` (expect 0 survivors) and `node verify-balances.cjs`.
6. Regression gates: see §4 commands.

The committed evidence folder keeps only credential-free outputs: the browser-proof spec + config, this report, `evidence/clone-api-stderr.txt`, and `evidence/runtime-created-ids.json`.