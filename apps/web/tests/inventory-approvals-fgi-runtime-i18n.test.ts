import * as fs from 'fs';
import * as path from 'path';

import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { isResolvedTranslation, resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';
import type { Locale, TranslationParams } from '../src/lib/i18n/types';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');

/**
 * Regression: `/admin/inventory/approvals` and `/admin/inventory/finished-goods-issues`
 * rendered the generic fallback sentence ("The requested text could not be
 * displayed." / "تعذر عرض النص المطلوب.") for the page title, subtitle, KPI
 * labels, filters, table headers, dialogs and actions.
 *
 * Root cause was not a missing key: `finishedGoodsIssue` and
 * `warehouseApprovals` were accidentally declared inside the `physicalCount`
 * namespace instead of `inventory`, so every `t('inventory.warehouseApprovals.*')`
 * and `t('inventory.finishedGoodsIssue.*')` lookup resolved to `undefined` and
 * `resolveTranslation` returned the localized fallback text.
 *
 * These tests drive the REAL runtime contract: the shipped locale dictionaries
 * are passed through `resolveTranslation` (the exact function the `t()` accessor
 * uses) for every key the two screens render, in both locales.
 */

const DICTIONARIES: Record<Locale, Record<string, unknown>> = {
  en: en as unknown as Record<string, unknown>,
  ar: ar as unknown as Record<string, unknown>,
};

const SCREEN_SOURCES = [
  'src/app/admin/inventory/approvals/page.tsx',
  'src/app/admin/inventory/finished-goods-issues/page.tsx',
  'src/app/admin/inventory/finished-goods-issues/_components/lines-editor.tsx',
  'src/components/inventory/warehouse-approvals-panel.tsx',
  'src/components/factory/unified-production/finished-goods-issues-panel.tsx',
];

/** Keys composed at runtime (label helpers, dialog/success maps, prefix maps). */
const DYNAMIC_KEYS = [
  'inventory.warehouseApprovals.title',
  'inventory.warehouseApprovals.subtitle',
  'inventory.warehouseApprovals.totalPending',
  'inventory.warehouseApprovals.countSparePart',
  'inventory.warehouseApprovals.countRawMaterial',
  'inventory.warehouseApprovals.countFinishedGoods',
  'inventory.warehouseApprovals.countPackagingMaterial',
  'inventory.warehouseApprovals.countConsumable',
  'inventory.warehouseApprovals.countGeneral',
  'inventory.warehouseApprovals.allTypes',
  'inventory.warehouseApprovals.emptyMessage',
  'inventory.warehouseApprovals.searchPlaceholder',
  'inventory.warehouseApprovals.approveSuccess',
  'inventory.warehouseApprovals.rejectSuccess',
  'inventory.warehouseApprovals.withdrawSuccess',
  'inventory.warehouseApprovals.cancelApprovalSuccess',
  'inventory.warehouseApprovals.confirmApprove',
  'inventory.warehouseApprovals.confirmReject',
  'inventory.warehouseApprovals.confirmWithdraw',
  'inventory.warehouseApprovals.confirmCancelApproval',
  'inventory.warehouseApprovals.rejectReason',
  'inventory.warehouseApprovals.withdrawReason',
  'inventory.warehouseApprovals.cancelApprovalReason',
  'inventory.finishedGoodsIssue.title',
  'inventory.finishedGoodsIssue.subtitle',
  'inventory.finishedGoodsIssue.newIssue',
  'inventory.finishedGoodsIssue.totalDocuments',
  'inventory.finishedGoodsIssue.submittedCount',
  'inventory.finishedGoodsIssue.approvedCount',
  'inventory.finishedGoodsIssue.postedCount',
  'inventory.finishedGoodsIssue.allStatuses',
  'inventory.finishedGoodsIssue.errors.loadFailed',
  'inventory.finishedGoodsIssue.errors.notFound',
  'inventory.finishedGoodsIssue.errors.warehouseRequired',
  'inventory.finishedGoodsIssue.errors.lineRequired',
  'inventory.finishedGoodsIssue.errors.productRequired',
  'inventory.finishedGoodsIssue.errors.quantityPositive',
  'inventory.finishedGoodsIssue.errors.unitRequired',
  'inventory.finishedGoodsIssue.errors.reasonRequired',
];

const WAREHOUSE_APPROVAL_TYPES = ['SPARE_PART', 'RAW_MATERIAL', 'FINISHED_GOOD', 'PACKAGING_MATERIAL', 'CONSUMABLE', 'GENERAL'];
const WAREHOUSE_APPROVAL_STATUSES = ['SUBMITTED', 'REQUESTED', 'APPROVED', 'REJECTED'];
const FINISHED_GOODS_ISSUE_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED'];
const FINISHED_GOODS_ISSUE_SOURCES = ['MANUAL', 'REVERSE'];

for (const type of WAREHOUSE_APPROVAL_TYPES) {
  DYNAMIC_KEYS.push(`inventory.warehouseApprovals.type${type}`);
}
for (const status of WAREHOUSE_APPROVAL_STATUSES) {
  DYNAMIC_KEYS.push(`inventory.warehouseApprovals.status${status}`);
}
for (const status of FINISHED_GOODS_ISSUE_STATUSES) {
  DYNAMIC_KEYS.push(`inventory.finishedGoodsIssue.status${status}`);
}
for (const source of FINISHED_GOODS_ISSUE_SOURCES) {
  DYNAMIC_KEYS.push(`inventory.finishedGoodsIssue.source${source}`);
}

/** Extracts complete `inventory.*` string literals referenced by the two screens. */
function staticKeysFromScreens(): string[] {
  const keys = new Set<string>();
  const pattern = /'(inventory\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)'/g;
  for (const rel of SCREEN_SOURCES) {
    const source = read(rel);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

function translate(locale: Locale, key: string, params?: TranslationParams): string {
  return resolveTranslation(
    DICTIONARIES[locale] as never,
    locale,
    key,
    undefined,
    params,
  );
}

function collectLeafKeys(node: unknown, prefix: string, out: string[]): void {
  if (typeof node === 'string') {
    out.push(prefix);
    return;
  }
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  for (const [childKey, childValue] of Object.entries(node as Record<string, unknown>)) {
    collectLeafKeys(childValue, prefix ? `${prefix}.${childKey}` : childKey, out);
  }
}

const SCREEN_KEYS = [...new Set([...staticKeysFromScreens(), ...DYNAMIC_KEYS])].sort();

describe('inventory approvals + finished-goods issues runtime translations', () => {
  it('collects the keys the two screens really render (guards against an empty sweep)', () => {
    expect(SCREEN_KEYS.length).toBeGreaterThan(60);
    expect(SCREEN_KEYS).toContain('inventory.warehouseApprovals.title');
    expect(SCREEN_KEYS).toContain('inventory.finishedGoodsIssue.title');
  });

  describe('dictionary placement (root cause)', () => {
    it('declares warehouseApprovals and finishedGoodsIssue directly under inventory', () => {
      for (const locale of ['en', 'ar'] as Locale[]) {
        const inventory = DICTIONARIES[locale].inventory as Record<string, unknown>;
        expect(inventory).toBeDefined();
        expect(typeof inventory.warehouseApprovals).toBe('object');
        expect(typeof inventory.finishedGoodsIssue).toBe('object');
      }
    });

    it('does not leave the two subtrees nested under physicalCount', () => {
      for (const locale of ['en', 'ar'] as Locale[]) {
        const physicalCount = DICTIONARIES[locale].physicalCount as Record<string, unknown>;
        expect(physicalCount).toBeDefined();
        expect(physicalCount.warehouseApprovals).toBeUndefined();
        expect(physicalCount.finishedGoodsIssue).toBeUndefined();
      }
    });
  });

  describe.each(['en', 'ar'] as Locale[])('%s locale', (locale) => {
    it('resolves every key the approvals and finished-goods issue screens use', () => {
      const unresolved: string[] = [];
      for (const key of SCREEN_KEYS) {
        const resolved = translate(locale, key);
        if (!isResolvedTranslation(resolved, key) || resolved === TRANSLATION_FALLBACKS[locale]) {
          unresolved.push(key);
        }
      }
      expect(unresolved).toEqual([]);
    });

    it('resolves every leaf of the two new inventory subtrees to real text', () => {
      const inventory = DICTIONARIES[locale].inventory as Record<string, unknown>;
      const prefixes = ['inventory.warehouseApprovals', 'inventory.finishedGoodsIssue'];
      const failures: string[] = [];
      let checked = 0;

      for (const prefix of prefixes) {
        const subtree = prefix.endsWith('warehouseApprovals')
          ? inventory.warehouseApprovals
          : inventory.finishedGoodsIssue;
        const leaves: string[] = [];
        collectLeafKeys(subtree, prefix, leaves);
        expect(leaves.length).toBeGreaterThan(15);
        for (const key of leaves) {
          checked += 1;
          const resolved = translate(locale, key);
          const leaf = key.substring(key.lastIndexOf('.') + 1);
          if (
            !isResolvedTranslation(resolved, key)
            || resolved === TRANSLATION_FALLBACKS[locale]
            || resolved.trim().length === 0
            || resolved === leaf
          ) {
            failures.push(key);
          }
        }
      }

      expect(failures).toEqual([]);
      expect(checked).toBeGreaterThan(100);
    });

    it('renders the page headings with the screen titles, not the fallback sentence', () => {
      const approvalsTitle = translate(locale, 'inventory.warehouseApprovals.title');
      const fgiTitle = translate(locale, 'inventory.finishedGoodsIssue.title');
      expect(approvalsTitle).not.toBe(TRANSLATION_FALLBACKS[locale]);
      expect(fgiTitle).not.toBe(TRANSLATION_FALLBACKS[locale]);
      expect(approvalsTitle).not.toBe('inventory.warehouseApprovals.title');
      expect(fgiTitle).not.toBe('inventory.finishedGoodsIssue.title');
      expect(approvalsTitle.trim().length).toBeGreaterThan(0);
      expect(fgiTitle.trim().length).toBeGreaterThan(0);
    });
  });

  it('keeps the two locales distinct (no cross-locale copy/paste of one string)', () => {
    expect(translate('en', 'inventory.warehouseApprovals.title')).not.toBe(
      translate('ar', 'inventory.warehouseApprovals.title'),
    );
    expect(translate('en', 'inventory.finishedGoodsIssue.title')).not.toBe(
      translate('ar', 'inventory.finishedGoodsIssue.title'),
    );
  });
});
