import * as fs from 'fs';
import * as path from 'path';
import { hasValuationCostInputPermission, VALUATION_COST_INPUT_PERMISSION } from '../src/lib/inventory-valuation-helper';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

const STOCK_ADJ_PAGE = 'src/app/admin/inventory/stock-adjustments/page.tsx';
const PHYSICAL_COUNT_PAGE = 'src/app/admin/inventory/physical-counts/[id]/page.tsx';
const HELPER = 'src/lib/inventory-valuation-helper.ts';
const EN_LOCALE = 'src/lib/i18n/locales/en/inventory-valuation.ts';
const AR_LOCALE = 'src/lib/i18n/locales/ar/inventory-valuation.ts';

const adjPage = () => read(STOCK_ADJ_PAGE);
const countPage = () => read(PHYSICAL_COUNT_PAGE);

describe('Inventory Valuation R1D UI (transfer / adjustment / physical count)', () => {
  describe('ADJUSTMENT_IN_COST_FIELDS', () => {
    it('shows unitCost + fixed policy currency + valuationReason for an IN line on an ACTIVE warehouse', () => {
      const src = adjPage();
      expect(src).toContain("isActivePolicyAdjustmentIn(lineForm.adjustmentType)");
      expect(src).toContain("t('inventoryValuation.unitCost')");
      expect(src).toContain("t('inventoryValuation.reason')");
      expect(src).toContain("inventoryValuation.monetaryInputHint");
    });

    it('sends unitCost, currencyCode and valuationReason for IN lines in the create payload', () => {
      const src = adjPage();
      expect(src).toContain("l.adjustmentType === 'ADJUSTMENT_IN' && l.unitCost !== undefined");
      expect(src).toContain('currencyCode:');
      expect(src).toContain('valuationReason:');
    });
  });

  describe('ADJUSTMENT_OUT_NO_MANUAL_COST', () => {
    it('never attaches cost fields to OUT lines in the payload', () => {
      const src = adjPage();
      expect(src).toContain("l.adjustmentType === 'ADJUSTMENT_IN' && l.unitCost !== undefined ? l.unitCost : undefined");
      expect(src).toContain("l.adjustmentType === 'ADJUSTMENT_IN' && l.currencyCode ? l.currencyCode : undefined");
    });

    it('resets cost fields when the line type is switched to OUT', () => {
      const src = adjPage();
      expect(src).toContain("setLineForm({ ...lineForm, adjustmentType: e.target.value, unitCost: '', valuationReason: '' })");
    });
  });

  describe('COUNT_SURPLUS_COST_FIELDS', () => {
    it('shows unitCost + fixed currency + reason only for a surplus line on an ACTIVE warehouse', () => {
      const src = countPage();
      expect(src).toContain("activePolicyCurrency && (editQty - line.systemQty) > 0");
      expect(src).toContain("t('inventoryValuation.unitCost')");
      expect(src).toContain("t('inventoryValuation.reason')");
    });

    it('attaches unitCost, currencyCode and valuationReason to the surplus enter call', () => {
      const src = countPage();
      expect(src).toContain('unitCost: needsCost ? Number(editUnitCost) : undefined');
      expect(src).toContain('currencyCode: needsCost ? activePolicyCurrency : undefined');
      expect(src).toContain('valuationReason: needsCost && editValuationReason ? editValuationReason : undefined');
    });
  });

  describe('COUNT_SHORTAGE_NO_MANUAL_COST', () => {
    it('requires cost only when the counted quantity is a surplus; otherwise weighted average is used', () => {
      const src = countPage();
      expect(src).toContain('const isSurplus = line ? (editQty - line.systemQty) > 0 : false;');
      expect(src).toContain('const needsCost = isSurplus && !!activePolicyCurrency;');
      expect(src).toContain("t('inventoryValuation.methodWeightedAverage')");
    });
  });

  describe('ACTIVE_POLICY_CURRENCY_FIXED', () => {
    it('displays the policy currency as a disabled/read-only value (no arbitrary selection)', () => {
      const adj = adjPage();
      expect(adj).toContain("value={activePolicyCurrency} disabled");
      const count = countPage();
      expect(count).toContain("value={activePolicyCurrency} disabled");
    });

    it('is derived from /inventory-valuation/policies?status=ACTIVE for the selected warehouse', () => {
      expect(read(HELPER)).toContain("'/inventory-valuation/policies'");
      expect(read(HELPER)).toContain("status: 'ACTIVE'");
    });
  });

  describe('ZERO_COST_REASON_REQUIRED', () => {
    it('blocks an IN line with zero cost unless a valuation reason is provided', () => {
      const src = adjPage();
      expect(src).toContain("unitCost === 0 && !l.valuationReason");
      expect(src).toContain("t('inventoryValuation.reasonRequiredForZero')");
    });

    it('hints the zero-cost-reason rule in the line form', () => {
      const src = adjPage();
      expect(src).toContain("lineForm.unitCost === '0' && !lineForm.valuationReason");
      expect(src).toContain("t('inventoryValuation.zeroCostHint')");
    });

    it('applies the same rule to a count surplus entry', () => {
      const src = countPage();
      expect(src).toContain("unitCost < 0");
      expect(src).toContain("unitCost === 0 && !editValuationReason");
      expect(src).toContain("t('inventoryValuation.reasonRequiredForZero')");
    });
  });

  describe('COST_INPUT_PERMISSION', () => {
    it('exposes the exact inventory-valuation:cost-input permission key helper', () => {
      expect(VALUATION_COST_INPUT_PERMISSION).toBe('inventory-valuation:cost-input');
      expect(hasValuationCostInputPermission(['inventory-valuation:cost-input'], false)).toBe(true);
      expect(hasValuationCostInputPermission(['inventory:edit'], false)).toBe(false);
      expect(hasValuationCostInputPermission(null, true)).toBe(true);
    });

    it('gates monetary input in the adjustment form on canCostInput', () => {
      const src = adjPage();
      expect(src).toContain('getUserPermissions()');
      expect(src).toContain('hasValuationCostInputPermission(res.permissions, res.isSuperAdmin)');
      expect(src).toContain("!canCostInput ? (");
      expect(src).toContain("t('inventoryValuation.missingPermission')");
    });

    it('gates the count surplus cost entry on canCostInput', () => {
      const src = countPage();
      expect(src).toContain('hasValuationCostInputPermission(p.permissions, p.isSuperAdmin)');
      expect(src).toContain("!canCostInput ? (");
      expect(src).toContain("t('inventoryValuation.missingPermission')");
    });
  });

  describe('POSTED_REPRICE_UI_BLOCKED', () => {
    it('only allows editing an adjustment while it is a DRAFT', () => {
      const src = adjPage();
      expect(src).toContain("if (action === 'edit') return status === 'DRAFT';");
    });

    it('does not expose any historical re-pricing action for a posted adjustment', () => {
      const src = adjPage();
      expect(src).not.toContain("action === 'reprice'");
      expect(src).not.toContain('reprice');
    });

    it('disables physical-count line entry once posted or cancelled', () => {
      const src = countPage();
      expect(src).toContain("count.status === 'POSTED' || count.status === 'CANCELLED'");
    });
  });

  describe('NO_RAW_IDS', () => {
    it('renders a human product name/code in the adjustment line table, not a raw id', () => {
      const src = adjPage();
      expect(src).toContain('line.product?.name || line.productId');
    });
  });

  describe('ARABIC_RTL / parity', () => {
    const en = read(EN_LOCALE);
    const ar = read(AR_LOCALE);
    const required = [
      'unitCost', 'unitCostRequired', 'negativeCost', 'zeroCostHint', 'reason',
      'reasonRequiredForZero', 'currency', 'currencyMismatch', 'monetaryInputHint',
      'methodWeightedAverage', 'missingPermission', 'transferNotBothActive',
      'transferCurrencyMismatch', 'adjustmentCostRequired', 'countSurplusCostRequired',
    ];
    it('declares every R1D UI key in both en and ar', () => {
      for (const k of required) {
        expect(en).toContain(`${k}:`);
        expect(ar).toContain(`${k}:`);
      }
    });
    it('keeps the en and ar inventoryValuation namespaces synchronized', () => {
      expect(ar).toContain('transferNotBothActive:');
      expect(ar).toContain('transferCurrencyMismatch:');
      expect(ar).toContain('adjustmentCostRequired:');
      expect(ar).toContain('countSurplusCostRequired:');
    });
  });
});
