# 01 — Requirements & Audit Basis

## Source Audit

This cleanup batch is based on findings from:
`docs/proofs/navigation-sidebar-duplicate-audit/04-duplicate-analysis.md`
`docs/proofs/navigation-sidebar-duplicate-audit/06-i18n-label-analysis.md`
`docs/proofs/navigation-sidebar-duplicate-audit/07-recommended-future-cleanup-plan.md`

## Pre-cleanup State

| Check | Result |
|-------|--------|
| Branch | `main` |
| Starting commit | `34242b0` |
| `git status --porcelain` | Only untracked audit proof docs (from previous read-only audit batch) |
| `git diff --check` | PASS |
| Working tree | Clean (zero modified tracked files) |

## Scope

**High priority issues addressed:**
1. Inventory Adjustments vs Stock Adjustments — Arabic labels differentiated
2. Notifications (management) vs Notifications Report — EN/AR labels differentiated
3. Attachments (management) vs Attachments Report — EN/AR labels differentiated
4. Missing "Report" / "تقرير" suffix in report labels

**Medium priority issues addressed:**
5. Audit Trail report vs Audit Log system — AR labels differentiated
6. User Activity report vs User Activity system — EN labels differentiated
7. stockAdjustments vs inventoryAdjustments — AR labels differentiated

**Label clarity issues addressed:**
- Barcode group labels clarified with "Barcode" / "باركود" prefix
- Machine Parts AR renamed from "قطع الغيار" to "قطع الماكينات"
- Accountability renamed to "Maintenance Responsibilities" / "مسؤوليات الصيانة"

**Structural issues addressed:**
- Reports group reordered into logical sub-sections
- Alerts icon fixed (dashboard → notification icon)

**Not in scope (documented as future):**
- Route path changes (e.g., installed-parts → /admin/maintenance/)
- Permission-based nav filtering
- Documents group expansion/removal (1 child kept as-is)
- Production Lines / Operation Types / Cost Centers moved to Core (kept under Maintenance to match their /admin/maintenance/ route paths)
- Sub-group visual separators in sidebar (not supported by current renderer)
