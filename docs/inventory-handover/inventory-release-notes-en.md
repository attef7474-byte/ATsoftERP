# Release Notes — Inventory Documentation Handover

**Release:** atsoft-erp-inventory-user-manual-sop-training-handover
**Base Release:** atsoft-erp-current-release-final-audited-v3 (Batches O–W)
**Date:** 2026-07-28

## What's New
This release is a **documentation-only** handover for the Inventory domain. No code, schema, or API changes are included. All documentation is based on the implemented inventory module as of Batch W (Inventory Final Integrated Audit).

## Contents
1. User Manual (English + Arabic)
2. Standard Operating Procedures (English + Arabic)
3. Training Plan (English + Arabic)
4. Quick Reference Guide (English + Arabic)
5. Permissions Matrix (English + Arabic)
6. Troubleshooting Guide (English + Arabic)
7. Handover Checklist (English + Arabic)
8. Release Notes (English + Arabic)
9. Limitations and Controls (English + Arabic)
10. Route/API Reference
11. Proof documentation (10 files)
12. README

## Coverage
- Opening Balance
- Stock Adjustment
- Warehouse Transfer
- Operational Receiving
- Maintenance Issue / Return
- Physical Count & Variance
- Ledger & Reconciliation
- Reports & Traceability
- Locks & Audit
- Permissions & Security

## Known Limitations (Carried Forward)
Refer to `inventory-limitations-and-controls-en.md` for full details.
- LOCATION_LOCK and ITEM_LOCK not implemented
- Finance, HR, Sales, Purchasing not activated
- Lock override not implemented (returns 403)
- Opening Balance posting requires governance; no pre-posting guard
- Migration uses `prisma migrate deploy` only

## Version Control
- Tag: atsoft-erp-inventory-user-manual-sop-training-handover
- Tag: atsoft-erp-current-release-final-audited-v3-inventory-handover
- Tag: atsoft-erp-inventory-handover-package-proof
- Branch: main (commit f393607 base)

## Validation
- TypeScript check: PASS
- API build: PASS
- Web build: PASS
- i18n check: PASS (no missing keys)
- Health/smoke: N/A (runtime unavailable)
