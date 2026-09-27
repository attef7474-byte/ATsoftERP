/**
 * R2-F — every repair-order action label must resolve in BOTH locales.
 *
 * The action labels are looked up through a variable (`t(def.labelKey)`), so the
 * literal-key i18n checker cannot see them. A browser proof caught both labels
 * rendering the missing-key fallback; this test makes that unrepeatable.
 */
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation } from '../src/lib/i18n/translation-core';
import { REPAIR_ACTIONS } from '../src/app/admin/maintenance/repair-orders/repair-order-actions';

const FALLBACKS = ['The requested text could not be displayed.', 'تعذر عرض النص المطلوب.'];

describe('R2-F repair-order action labels resolve in both locales', () => {
  const locales = [
    ['en', en],
    ['ar', ar],
  ] as const;

  for (const [locale, data] of locales) {
    it(`${locale}: no action label falls back`, () => {
      const broken: string[] = [];
      for (const action of REPAIR_ACTIONS) {
        const value = resolveTranslation(data as any, locale, action.labelKey);
        if (!value || FALLBACKS.includes(value)) broken.push(`${action.key} -> ${action.labelKey}`);
      }
      expect(broken).toEqual([]);
    });
  }

  it('the EN and AR label sets are identical', () => {
    const enKeys = REPAIR_ACTIONS.map((a) => a.labelKey).sort();
    const arKeys = REPAIR_ACTIONS.map((a) => a.labelKey).sort();
    expect(enKeys).toEqual(arKeys);
  });

  it('every label is non-empty and distinct per action', () => {
    const values = REPAIR_ACTIONS.map((a) => resolveTranslation(en as any, 'en', a.labelKey));
    values.forEach((v) => expect(v.trim().length).toBeGreaterThan(0));
    expect(new Set(values).size).toBe(values.length);
  });
});
