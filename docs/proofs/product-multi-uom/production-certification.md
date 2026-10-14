# Product Multi-UOM Packaging — Production Release Certification

- Status: `FIXED_DEPLOYED_NONMUTATING_PROOF`
- Release commit: `a1c7e71ea1d0eeab09e80420ae742f8ef0e0b67a` (`feat(inventory): add product multi-UOM packaging and unit conversion`)
- Branch: `main` (HEAD = origin/main, ahead/behind 0/0, working tree clean)
- Database: `ATsoftERP_DB` (SQL Server 2016 / 13.0.5108.50), production
- Deployed at: 2026-10-14T17:07Z
- Migration: `20261014120000_add_product_uom_packaging` (additive/non-destructive), SHA256 `151e4a92edebdf0d4a7c5546ceb169259f884e9fd493e25893946dd26152a341`

## Preflight (matches recorded baseline)
- Products 13 (5 ACTIVE), Units 11, InventoryBalances 11 (sum quantity 545), InventoryMovements 61, InventoryMovementLines 68.
- `product_uoms` did not exist; `inventory_movement_lines` snapshot columns absent; pending migration = only the target migration; no unfinished migrations.

## Backup
- Path: `C:\ATsofterp\Backups\ATsoftERP_DB_PUM_PREDEPLOY_20261014_194615.bak`
- Size: 84,918,272 bytes; SHA256 `3c8dbe55e95ce602d0ecd62d31a1eb8c7b18df8c1e5f3d032c113ac3d62ff4dc`
- `BACKUP ... WITH COPY_ONLY, CHECKSUM, INIT`; `RESTORE VERIFYONLY WITH CHECKSUM` = PASS.
- Re-verified ledger + business snapshot immediately before mutation (unchanged since preflight).

## Migration application
- Method: `prisma migrate deploy` against integrated-security privileged deployment account.
- Result: `20261014120000_add_product_uom_packaging` applied; ledger finished; `pending` empty; no unfinished/rolled-back rows.

## Post-migration verification
- `PRODUCT_IDS_CHANGED = 0`
- `EXISTING_BALANCE_VALUE_CHANGES = 0`
- `EXISTING_MOVEMENT_MEANING_CHANGES = 0`
- `ORPHAN_PRODUCT_UOM = 0`
- `DUPLICATE_GLOBAL_UNITS_CREATED = 0`
- `product_uoms`: 13 rows, one base row per product, base `conversionToBase = 1` for all, 0 multi-base, 0 orphans.
- Snapshot columns present on `inventory_movement_lines`: `enteredUnitId`, `productUomId`, `enteredQuantity`, `conversionApplied`.
- Row counts unchanged (Products 13, Units 11, Balances 11, Movements 61, MovementLines 68).

## Deployment
- Method: in-place artifact rebuild + Windows service restart.
- API: `npm run build:api` → `apps/api/dist/src/main.js`; Web: `npm run build:web` → `apps/web/.next` (BUILD_ID `AKtqB-C7KhNMFNU3I9Te6`).
- Services restarted: `ATsoftERP_API`, `ATsoftERP_Web`; `ATsoftERP_Caddy` untouched (PID unchanged).
- Health: API `http://localhost:4000/api/v1/products` → 401 (auth required, serving new build); Web `http://localhost:3000` → 200.
- No database or migration commands during deployment.

## Runtime browser proof (read-only)
- Origin `https://DELL`, locales `en` (LTR) and `ar` (RTL), existing SUPER_ADMIN in valid operational context.
- Non-GET/HEAD/OPTIONS blocked at the browser layer (except canonical read-only `POST /api/v1/auth/context/validate`); blocked writes = 0; page errors = 0.
- Products list returns 200 with 5 rows in both locales.
- Create dialog: base inventory unit lookup present; "Add Packaging Unit" disabled before a base unit is chosen; "Select the base inventory unit first." shown.
- Edit dialog (same record, `?edit=<id>`): product code prefilled from the real record; base unit shown; packaging section renders "No packaging units defined".
- No translation-fallback text (`The requested text could not be displayed.` / `تعذر عرض النص المطلوب.`) rendered in either locale.
- Artifacts: `.tmp/pum-release/prod-{en,ar}-{list,create,edit}.png`, `.tmp/pum-release/prod-browser.json`.

## Final post-deploy verification
- Re-ran the five invariants against the pre-mutation snapshot: all `0`; counts unchanged; `product_uoms` structure intact.
- Artifact: `.tmp/pum-release/prod-verification.json`.

## Result
Production now runs the reviewed commit with the multi-UOM schema live and fully backward compatible. Existing products, balances, movements, barcodes, and units are unchanged; no mock data, no destructive operations, no unapproved scope.

Command evidence: `.tmp/pum-release/{preflight,backup,migration-deploy,post-migration-verify,deploy,runtime-before,runtime-after,prod-browser,prod-verification}.json`.
