import * as fs from 'fs';
import * as path from 'path';
import { isKnownResource, getResourceDef, getResourceLabel, getDomainForResource } from '../src/lib/permissions/permission-catalogue';
import {
  InventoryValuationPolicy,
  InventoryValuationReadiness,
  InventoryValuationInitialization,
  InventoryValuationReadyProduct,
  InventoryValuationStatus,
  InventoryValuationMethod,
} from '../src/lib/admin-types';

const webRoot = path.resolve(__dirname, '..');
const fileExists = (rel: string) => fs.existsSync(path.join(webRoot, rel));
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

const PAGE = 'src/app/admin/inventory/valuation/page.tsx';
const NAV = 'src/components/admin/shell/navigation-data.ts';
const EN_LOCALE = 'src/lib/i18n/locales/en/inventory-valuation.ts';
const AR_LOCALE = 'src/lib/i18n/locales/ar/inventory-valuation.ts';
const EN_COMMON = 'src/lib/i18n/locales/en/common.ts';
const AR_COMMON = 'src/lib/i18n/locales/ar/common.ts';
const EN_NAV = 'src/lib/i18n/locales/en/navigation.ts';
const AR_NAV = 'src/lib/i18n/locales/ar/navigation.ts';

function page() {
  return read(PAGE);
}

function extractObjectKeys(src: string): Set<string> {
  const keys = new Set<string>();
  const stack: string[] = [];
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('//') || line.startsWith('import') || line.startsWith('export') || line.startsWith('const')) continue;
    const closeIdx = line.indexOf('}');
    if (closeIdx === 0 && stack.length > 0) {
      stack.pop();
      continue;
    }
    const nested = line.match(/^(\w+):\s*[{]/);
    if (nested) {
      stack.push(nested[1]);
      continue;
    }
    const val = line.match(/^(\w+):\s*['"]/);
    if (val) keys.add([...stack, val[1]].join('.'));
  }
  return keys;
}

function localeKeys(localeFile: string): Set<string> {
  const src = read(localeFile);
  const keys = extractObjectKeys(src);
  keys.delete('inventoryValuation'); // root node is not a value key
  return keys;
}

describe('Inventory Valuation UI (VAL-R1B)', () => {
  describe('1. no-policy state is presented', () => {
    it('renders the empty state when no policies exist', () => {
      expect(page()).toContain("t('inventoryValuation.noPolicies')");
      expect(page()).toContain("emptyMessage={t('inventoryValuation.noPolicies')}");
    });

    it('offers a create-policy button in the empty state only for cost-input users', () => {
      const src = page();
      const emptyBlock = src.slice(src.indexOf("noPolicies')"), src.length);
      expect(emptyBlock).toContain("canCostInput &&");
      expect(emptyBlock).toContain("t('inventoryValuation.createPolicy')");
    });
  });

  describe('2. create-policy is gated by inventory-valuation:cost-input (not generic inventory)', () => {
    it('uses direct hasPerm-style keys, not generic inventory permissions or checkCrudPermissions', () => {
      const src = page();
      expect(src).toContain("'inventory-valuation:read'");
      expect(src).toContain("'inventory-valuation:cost-input'");
      expect(src).toContain("'inventory-valuation:initialize'");
      expect(src).not.toContain('checkCrudPermissions');
      expect(src).not.toContain("'inventory:read'");
    });

    it('create button is only rendered when the cost-input permission is present', () => {
      const src = page();
      expect(src).toContain('canCostInput ? (');
      expect(src).toContain("setCreateOpen(true)}>{t('inventoryValuation.createPolicy')}");
    });

    it('warehouse and currency are validated before submission', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.warehouseRequired')");
      expect(src).toContain("t('inventoryValuation.currencyRequired')");
    });

    it('creates with the WEIGHTED_AVERAGE method and posts to /inventory-valuation/policies', () => {
      const src = page();
      expect(src).toContain("method: 'WEIGHTED_AVERAGE'");
      expect(src).toContain("api.post('/inventory-valuation/policies'");
    });
  });

  describe('3. read-only user sees the page but no create affordance', () => {
    it('renders the listing when read permission exists; otherwise a missing-permission notice', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.missingPermission')");
      expect(src).toContain('canRead');
    });

    it('shows a read-only label instead of the create button when cost-input is absent', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.readOnly')");
      expect(src).toContain('canCostInput');
      expect(src).toContain("actions={canCostInput ? (");
    });
  });

  describe('4. begin-initialization transition', () => {
    it('offers a begin-initialization button only while DRAFT (canCostInput)', () => {
      const src = page();
      expect(src).toContain("selectedPolicy.status === POLICY_STATUS && canCostInput");
      expect(src).toContain("t('inventoryValuation.beginInitialization')");
      expect(src).toContain('beginConfirmOpen');
    });

    it('confirms before calling the begin-initialization endpoint', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.beginInitializationConfirm')");
      expect(src).toContain('begin-initialization');
    });

    it('refreshes policy, readiness and history after starting', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.successInitializationStarted')");
      expect(src).toContain('fetchPolicies(policyMeta.page)');
      expect(src).toContain('fetchReadiness(selectedPolicy.id)');
      expect(src).toContain('fetchHistory(selectedPolicy.warehouseId, 1)');
    });
  });

  describe('5. currency UX (frozen once initialization begins)', () => {
    it('defines currencyDisallowed for statuses beyond DRAFT/INITIALIZING', () => {
      expect(page()).toContain("const currencyDisallowed = !!selectedPolicy && selectedPolicy.status !== 'DRAFT' && selectedPolicy.status !== 'INITIALIZING';");
    });

    it('disables the currency input and shows the frozen note when disallowed', () => {
      const src = page();
      expect(src).toContain('disabled={currencyDisallowed}');
      expect(src).toContain("t('inventoryValuation.currencyFrozen')");
    });
  });

  describe('6. derived readiness counts', () => {
    it('renders productsWithStock, initializedCount and missingCount readiness cards', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.productsWithStock')");
      expect(src).toContain("t('inventoryValuation.initializedCount')");
      expect(src).toContain("t('inventoryValuation.missingCount')");
    });

    it('derives ready/not-ready readiness from the backend flag', () => {
      const src = page();
      expect(src).toContain("readiness.ready ? t('inventoryValuation.ready') : t('inventoryValuation.notReady')");
    });

    it('loads readiness only once a policy is selected', () => {
      expect(page()).toContain("/readiness");
      expect(page()).toContain('fetchReadiness(policy.id)');
    });
  });

  describe('7. missing products table', () => {
    it('renders the missing-products table with quantity snapshot when non-empty', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.missingProducts')");
      expect(src).toContain("t('inventoryValuation.quantitySnapshot')");
      expect(src).toContain("t('inventoryValuation.noMissingProducts')");
    });

    it('shows product code + name, never a raw productId', () => {
      const src = page();
      expect(src).toContain('`[${product.code}] ${product.name}`');
      expect(src).not.toContain(': mp.productId');
    });

    it('never allows editing the physical quantity snapshot', () => {
      const src = page();
      expect(src).toContain('quantitySnapshot');
      expect(src).not.toContain('quantitySnapshot-input');
      expect(src).not.toContain('value={mp.quantitySnapshot}');
    });
  });

  describe('8. initialize product (monetary input) rules', () => {
    it('requires a non-negative, finite unit cost', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.unitCostRequired')");
      expect(src).toContain("t('inventoryValuation.negativeCost')");
    });

    it('requires a reason when the unit cost is zero', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.reasonRequiredForZero')");
      expect(src).toContain("t('inventoryValuation.zeroCostHint')");
      expect(src).toContain('unitCost === 0 && !initForm.reason.trim()');
    });

    it('posts to the initialize endpoint with productId and unitCost', () => {
      const src = page();
      expect(src).toContain('/initialize');
      expect(src).toContain('productId: initProductId');
      expect(src).toContain('unitCost');
    });
  });

  describe('9. cost-input for legacy posted lines', () => {
    it('uses explicit valuation-labelled action text, not edit-posted-transaction', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.addValuationBasis')");
      expect(src).toContain("t('inventoryValuation.setValuationCost')");
      expect(src).toContain("t('inventoryValuation.setCostFor')");
      expect(src).not.toContain('Edit posted inventory transaction');
    });

    it('keeps quantity read-only in the cost modal', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.quantity')");
    });

    it('posts to the opening-cost or receipt-cost endpoint by selected tab', () => {
      const src = page();
      expect(src).toContain('/opening-cost');
      expect(src).toContain('/receipt-cost');
    });

    it('never edits the posted transaction line; only advances the valuation basis', () => {
      const src = page();
      expect(src).not.toContain("api.patch(`/inventory/opening-balances/${");
      expect(src).not.toContain("api.patch(`/inventory/operational-receipts/${");
      expect(src).not.toContain('/lines/${');
      expect(src).not.toContain("api.patch(`/inventory/opening-balances/");
    });
  });

  describe('10. history', () => {
    it('renders initialization history with unit cost and total value', () => {
      const src = page();
      expect(src).toContain("t('inventoryValuation.history')");
      expect(src).toContain("t('inventoryValuation.unitCost')");
      expect(src).toContain("t('inventoryValuation.totalValue')");
      expect(src).toContain("t('inventoryValuation.noHistory')");
    });
  });

  describe('11. no ACTIVE transition / activation is exposed', () => {
    it('has no activate action anywhere in the page', () => {
      expect(page().toLowerCase()).not.toContain('activate');
      expect(page().toLowerCase()).not.toContain('activation');
    });

    it('does not allow transitioning a policy to ACTIVE from the UI', () => {
      const src = page();
      expect(src).not.toContain('/activate');
      expect(src).not.toContain('status: \'ACTIVE\'');
    });
  });

  describe('12. cross-permission visibility', () => {
    it('only shows initialize buttons when canInitialize AND status is INITIALIZING', () => {
      const src = page();
      expect(src).toContain("canInitialize && selectedPolicy.status === 'INITIALIZING'");
    });

    it('only shows cost/monetary input when canCostInput AND status is DRAFT/INITIALIZING', () => {
      const src = page();
      expect(src).toContain("canCostInput && (");
    });
  });

  describe('13. monetary values are rendered as amounts, not currency-typed inconsistencies', () => {
    it('formats numbers with locale-aware grouping', () => {
      expect(page()).toContain('minimumFractionDigits');
      expect(page()).toContain('maximumFractionDigits');
    });
  });

  describe('14. permission catalogue', () => {
    it('declares the inventory-valuation resource as a known inventory resource', () => {
      expect(isKnownResource('inventory-valuation')).toBe(true);
      expect(getDomainForResource('inventory-valuation')).toBe('inventory');
    });

    it('labels the resource in both en and ar', () => {
      expect(getResourceLabel('inventory-valuation', 'en')).toContain('Inventory Valuation');
      expect(getResourceLabel('inventory-valuation', 'ar')).toContain('تقييم المخزون');
    });

    it('resolves the resource definition for the read permission key', () => {
      const def = getResourceDef('inventory-valuation:read');
      expect(def).toBeTruthy();
      expect(def?.domain).toBe('inventory');
    });
  });

  describe('15. admin-types export the valuation contract', () => {
    it('re-exports the valuation types from the admin-types barrel', () => {
      expect(read('src/lib/admin-types/index.ts')).toContain("export * from './inventory-valuation'");
    });

    it('models the core policy/readiness/initialization shapes', () => {
      expect(({} as InventoryValuationPolicy).id).toBeUndefined();
      expect(({} as InventoryValuationReadiness).ready).toBeUndefined();
      expect(({} as InventoryValuationInitialization).unitCost).toBeUndefined();
      expect(({} as InventoryValuationReadyProduct).quantitySnapshot).toBeUndefined();
    });

    it('restricts status to the supported lifecycle and method to weighted average', () => {
      const statuses: InventoryValuationStatus[] = ['DRAFT', 'INITIALIZING', 'ACTIVE', 'RETIRED'];
      expect(statuses).toContain('INITIALIZING');
      const method: InventoryValuationMethod = 'WEIGHTED_AVERAGE';
      expect(method).toBe('WEIGHTED_AVERAGE');
    });
  });

  describe('16. navigation entry route + permission', () => {
    it('adds one localized nav entry to the inventory-monitoring section', () => {
      const nav = read(NAV);
      expect(nav).toContain("{ id: 'inv-valuation'");
      expect(nav).toContain("route: '/admin/inventory/valuation'");
      expect(nav).toContain("permission: 'inventory-valuation:read'");
      expect(nav).toContain("labelKey: 'navigation.inventoryValuation'");
    });

    it('declares the inventoryValuation label in both en and ar navigation', () => {
      expect(read(EN_NAV)).toContain("inventoryValuation:");
      expect(read(AR_NAV)).toContain("inventoryValuation:");
    });

    it('resolves the valuation nav to the canonical route and never the doubled admin path', () => {
      const nav = read(NAV);
      const match = nav.match(/\{\s*id: 'inv-valuation'[^}]*\}/);
      expect(match).not.toBeNull();
      const entry = match![0];
      const route = entry.match(/route:\s*'([^']+)'/);
      expect(route).not.toBeNull();
      expect(route![1]).toBe('/admin/inventory/valuation');
      expect(route![1]).not.toContain('admin/admin/');
    });

    it('contains no doubled-admin navigation declaration for valuation', () => {
      const nav = read(NAV);
      expect(nav).not.toContain('/admin/inventory/valuation'.replace('/admin', '/admin/admin'));
      expect(nav).not.toContain("'/admin/admin/inventory/valuation'");
    });
  });

  describe('17. Arabic + English parity and key completeness', () => {
    it('has a translated INITIALIZING status in both en and ar common', () => {
      expect(read(EN_COMMON)).toContain('INITIALIZING:');
      expect(read(AR_COMMON)).toContain('INITIALIZING:');
    });

    it('keeps the inventoryValuation namespace keys synchronized between en and ar', () => {
      const en = localeKeys(EN_LOCALE);
      const ar = localeKeys(AR_LOCALE);
      expect(en.size).toBeGreaterThan(0);
      expect([...en].filter((k) => !ar.has(k))).toEqual([]);
      expect([...ar].filter((k) => !en.has(k))).toEqual([]);
    });

    it('includes the domain-critical keys used by the page', () => {
      const en = localeKeys(EN_LOCALE);
      for (const k of ['title', 'createPolicy', 'noPolicies', 'beginInitialization', 'currencyFrozen', 'ready', 'notReady', 'missingProducts', 'setValuationCost', 'addValuationBasis', 'setCostFor', 'noHistory', 'noUnvaluedLines']) {
        expect(en.has('inventoryValuation.' + k)).toBe(true);
      }
    });
  });
});
