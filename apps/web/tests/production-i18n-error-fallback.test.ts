import * as fs from 'fs';
import * as path from 'path';

import { normalizeApiError, resolveApiErrorMessage } from '../src/lib/error-utils';
import { isResolvedTranslation, resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';
import type { Locale, TranslationNamespace, TranslationParams } from '../src/lib/i18n/types';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');

const EN_PROD = 'src/lib/i18n/locales/en/production.ts';
const AR_PROD = 'src/lib/i18n/locales/ar/production.ts';

const PRODUCTION_PANELS = [
  'src/app/admin/production/orders/_components/order-form.tsx',
  'src/app/admin/production/orders/[id]/page.tsx',
  'src/app/admin/production/runs/[id]/page.tsx',
  'src/components/factory/unified-production/production-orders-panel.tsx',
  'src/components/factory/unified-production/downtime-panel.tsx',
  'src/components/factory/unified-production/losses-panel.tsx',
  'src/components/factory/unified-production/finished-goods-receipts-panel.tsx',
  'src/components/factory/unified-production/material-documents-panel.tsx',
  'src/components/factory/unified-production/material-requirements-panel.tsx',
  'src/components/factory/unified-production/performance-targets-panel.tsx',
];

/**
 * Production UI i18n error-fallback regression.
 *
 * A production panel used to override the API's already-localized error message
 * with `handleApiError(err, { message: t(webKey) })`. When the composed web key
 * did not exist, `t()` returned the generic "requested text could not be
 * displayed" sentence, so the precise server message was lost and the user saw
 * a meaningless fallback.
 *
 * The contract now is:
 *   - a curated web key overrides the server message only when it really resolves;
 *   - otherwise the server message (already localized by the API) is kept;
 *   - the web dictionary contains every key the production panels compose.
 */
describe('Production i18n error message fallback', () => {
  describe('isResolvedTranslation', () => {
    it('treats the localized fallback sentence as unresolved', () => {
      expect(isResolvedTranslation(TRANSLATION_FALLBACKS.en)).toBe(false);
      expect(isResolvedTranslation(TRANSLATION_FALLBACKS.ar)).toBe(false);
    });

    it('treats a real translation as resolved', () => {
      expect(isResolvedTranslation('Production Orders')).toBe(true);
    });

    it('treats a translation identical to its own key as unresolved', () => {
      expect(isResolvedTranslation('production.missing.key', 'production.missing.key')).toBe(false);
    });

    it('treats empty and non-string values as unresolved', () => {
      expect(isResolvedTranslation('')).toBe(false);
      expect(isResolvedTranslation('   ')).toBe(false);
      expect(isResolvedTranslation(undefined)).toBe(false);
      expect(isResolvedTranslation(null)).toBe(false);
      expect(isResolvedTranslation({})).toBe(false);
    });
  });

  describe('resolveApiErrorMessage', () => {
    const dictionary: Record<string, string> = {
      'production.losses.quantityMustBePositive': 'Loss quantity must be positive.',
      'errors.generalError': 'An unexpected error occurred.',
    };

    const t = (key: string, _ns?: TranslationNamespace, _params?: TranslationParams): string =>
      resolveTranslation({ production: { losses: { quantityMustBePositive: dictionary['production.losses.quantityMustBePositive'] } } } as never, 'en' as Locale, key);

    it('returns the curated web text when the key resolves', () => {
      expect(resolveApiErrorMessage(t, 'production.losses.quantityMustBePositive')).toBe('Loss quantity must be positive.');
    });

    it('returns undefined when the web key is missing so the server message survives', () => {
      expect(resolveApiErrorMessage(t, 'production.losses.doesNotExist')).toBeUndefined();
    });

    it('returns undefined when no web key is provided', () => {
      expect(resolveApiErrorMessage(t)).toBeUndefined();
      expect(resolveApiErrorMessage(t, '')).toBeUndefined();
    });
  });

  describe('normalizeApiError keeps the localized server message', () => {
    const t = (key: string): string => {
      if (key === 'errors.generalError') return 'An unexpected error occurred.';
      if (key === 'errors.badRequest') return 'Bad request.';
      return TRANSLATION_FALLBACKS.en;
    };

    function apiError(body: Record<string, unknown>): Error {
      const error = new Error('HTTP 400') as Error & { status?: number };
      (error as any).response = { status: 400, data: { success: false, statusCode: 400, ...body } };
      error.status = 400;
      return error;
    }

    it('keeps the API-localized message when the web key does not resolve', () => {
      const config = normalizeApiError(
        apiError({ messageKey: 'productionMaterial.concurrencyConflict', message: ['تعارض في التعديل المتزامن'] }),
        t as never,
      );
      expect(config.message).toBe('تعارض في التعديل المتزامن');
      expect(config.message).not.toBe(TRANSLATION_FALLBACKS.en);
    });

    it('never surfaces the generic fallback sentence when the server sent a message', () => {
      const config = normalizeApiError(
        apiError({ messageKey: 'productionRun.orderStateChanged', message: ['تم تغيير حالة أمر الإنتاج'] }),
        t as never,
      );
      expect(config.message).not.toBe(TRANSLATION_FALLBACKS.en);
      expect(config.messageKey).toBe('productionRun.orderStateChanged');
    });

    it('falls back to the status text when neither side provides a message', () => {
      const config = normalizeApiError(
        apiError({ messageKey: 'productionRun.orderStateChanged', message: ['productionRun.orderStateChanged'] }),
        t as never,
      );
      expect(config.message).toBe('Bad request.');
    });
  });

  describe('production panels keep the server message', () => {
    it('no production panel overrides the API error message with a raw t() lookup', () => {
      for (const panel of PRODUCTION_PANELS) {
        const source = read(panel);
        expect(source).not.toMatch(/handleApiError\(\s*err\s*,\s*\{\s*message:\s*t\(/);
        expect(source).not.toMatch(/handleApiError\([^)]*\{\s*message:\s*t\(/);
      }
    });

    it('every production panel that maps an API error key uses resolveApiErrorMessage', () => {
      for (const panel of PRODUCTION_PANELS) {
        const source = read(panel);
        if (!source.includes('messageKey') && !source.includes("startsWith('production")) continue;
        expect(source).toContain('resolveApiErrorMessage');
      }
    });

    it('resolveApiErrorMessage is imported from the shared error utils', () => {
      for (const panel of PRODUCTION_PANELS) {
        expect(read(panel)).toMatch(/import \{ resolveApiErrorMessage \} from '.*lib\/error-utils';/);
      }
    });
  });

  describe('production dictionary completeness', () => {
    const REQUIRED_KEYS = [
      'runNumber:',
      'snapshot:',
      'assignmentAmbiguous:',
      'assignmentInvalid:',
      'orderStateChanged:',
      'quantityMustBePositive:',
      'concurrencyConflict:',
      'runValuationClosed:',
      'costPurposeInvalid:',
      'costPurposeOverrideReasonRequired:',
      'status:',
      'details:',
      'transitions:',
      'invalidWindow:',
      'catMAINTENANCE_REQUEST:',
      'catSTOPPED_MACHINE:',
      'catPRODUCTION_ORDER:',
      'catQUALITY_ISSUE:',
      'catMATERIAL_SHORTAGE:',
      'catSAFETY_OBSERVATION:',
      'catGENERAL:',
      'entityPRODUCTION_NONCONFORMANCE:',
    ];

    it('every production key required by the panels exists in both locales', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      for (const key of REQUIRED_KEYS) {
        expect(en).toContain(key);
        expect(ar).toContain(key);
      }
    });

    it('the handover category and entity values are fully covered in both locales', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      const categories = [
        'MAINTENANCE_REQUEST', 'STOPPED_MACHINE', 'PRODUCTION_ORDER',
        'QUALITY_ISSUE', 'MATERIAL_SHORTAGE', 'SAFETY_OBSERVATION', 'GENERAL',
      ];
      const entities = [
        'MAINTENANCE_REQUEST', 'MACHINE', 'PRODUCTION_ORDER', 'PRODUCTION_NONCONFORMANCE', 'SPARE_PART',
      ];
      for (const value of categories) {
        expect(en).toContain(`cat${value}:`);
        expect(ar).toContain(`cat${value}:`);
      }
      for (const value of entities) {
        expect(en).toContain(`entity${value}:`);
        expect(ar).toContain(`entity${value}:`);
      }
    });
  });

  describe('tab labels resolve to real translations', () => {
    it('the production tabs use the .title keys of their namespaces', () => {
      const orders = read('src/app/admin/production/orders/page.tsx');
      expect(orders).toContain("t('production.orders.title')");
      expect(orders).toContain("t('production.runs.title')");
      expect(orders).toContain("t('production.measurementPoints.title')");
      expect(orders).not.toContain("t('production.runs')");
      expect(orders).not.toContain("t('production.productionOrders')");

      const materials = read('src/app/admin/production/material-documents/page.tsx');
      expect(materials).toContain("t('production.materialRequirements.title')");
      expect(materials).toContain("t('production.materialDocuments.title')");
      expect(materials).toContain("t('production.finishedGoodsReceipts.title')");
      expect(materials).not.toContain("t('production.materialRequirements')");
    });
  });

  describe('forbidden state uses a real key', () => {
    it('no web file uses the non-existent validation.forbidden key', () => {
      const srcRoot = path.resolve(webRoot, 'src');
      const offenders: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (/\.tsx?$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes('validation.forbidden')) {
            offenders.push(path.relative(webRoot, full));
          }
        }
      };
      walk(srcRoot);
      expect(offenders).toEqual([]);
    });
  });
});
