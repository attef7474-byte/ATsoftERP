import { getApiMessage, getApiMessageEntry } from '../../../common/i18n/api-messages';

/**
 * Every productionCostTransaction.* and productionCostCalculation.* message key that
 * the production-cost controllers/services can raise, i.e. the full translated set.
 */
const PRODUCTION_COST_KEYS: string[] = [
  // productionCostTransaction.*
  'productionCostTransaction.notFound',
  'productionCostTransaction.orderNotFound',
  'productionCostTransaction.runNotFound',
  'productionCostTransaction.orderContextMismatch',
  'productionCostTransaction.productNotFound',
  'productionCostTransaction.versionNotFound',
  'productionCostTransaction.packagingNotFound',
  'productionCostTransaction.lineNotFound',
  'productionCostTransaction.machineNotFound',
  'productionCostTransaction.shiftNotFound',
  'productionCostTransaction.costCenterNotFound',
  'productionCostTransaction.snapshotNotFound',
  'productionCostTransaction.snapshotNotFrozen',
  'productionCostTransaction.outputEventNotFound',
  'productionCostTransaction.duplicateRequest',
  'productionCostTransaction.reversableOnlyPosted',
  'productionCostTransaction.alreadyReversed',
  'productionCostTransaction.requestPayloadConflict',
  'productionCostTransaction.sourceAlreadyValued',
  'productionCostTransaction.sourceOrderNotFound',
  'productionCostTransaction.sourceRunNotFound',
  'productionCostTransaction.sourceOutputEventNotFound',
  'productionCostTransaction.sourceReceiptNotFound',
  'productionCostTransaction.sourceMaterialDocumentNotFound',
  'productionCostTransaction.sourceQualityDispositionNotFound',
  'productionCostTransaction.snapshotResolutionMissing',
  'productionCostTransaction.snapshotAmbiguous',
  'productionCostTransaction.sourceDowntimeNotFound',
  'productionCostTransaction.downtimeMachineNotFound',
  'productionCostTransaction.downtimeNotProductionLoss',
  'productionCostTransaction.downtimeMachineMismatch',
  'productionCostTransaction.downtimeContextMismatch',
  'productionCostTransaction.sourceNotComplete',
  'productionCostTransaction.sourceCancelled',
  'productionCostTransaction.sourceSuperseded',
  'productionCostTransaction.sourceMissingDuration',
  'productionCostTransaction.sourceCorrectionConflict',
  'productionCostTransaction.rateResolutionMissing',
  'productionCostTransaction.rateAmbiguous',
  'productionCostTransaction.sourceValuationConflict',
  'productionCostTransaction.costCenterMismatch',
  'productionCostTransaction.calculationScopeMismatch',
  'productionCostTransaction.operationalCurrencyRequired',
  'productionCostTransaction.downtimeCurrencyMismatch',
  'productionCostTransaction.materialCurrencyMismatch',
  'productionCostTransaction.unsupportedCanonicalSource',
  'productionCostTransaction.cannotReverseReversal',
  // productionCostCalculation.*
  'productionCostCalculation.notFound',
  'productionCostCalculation.orderNotFound',
  'productionCostCalculation.runNotFound',
  'productionCostCalculation.branchScopeMismatch',
  'productionCostCalculation.invalidPeriod',
  'productionCostCalculation.linkOnlyDraft',
  'productionCostCalculation.transactionNotPosted',
  'productionCostCalculation.transactionAlreadyLinked',
  'productionCostCalculation.reviewOnlyDraft',
  'productionCostCalculation.finalizeOnlyReview',
  'productionCostCalculation.reopenOnlyFinalized',
];

describe('COST-R1B production-cost i18n consistency', () => {
  it('defines every production-cost message key with non-empty ar and en translations', () => {
    for (const key of PRODUCTION_COST_KEYS) {
      const entry = getApiMessageEntry(key);
      expect(entry).toBeDefined();
      expect(typeof entry!.ar).toBe('string');
      expect(entry!.ar!.length).toBeGreaterThan(0);
      expect(typeof entry!.en).toBe('string');
      expect(entry!.en!.length).toBeGreaterThan(0);
    }
  });

  it('getApiMessage returns the translated string (never the raw key) for both locales', () => {
    for (const key of PRODUCTION_COST_KEYS) {
      const en = getApiMessage(key, 'en');
      const ar = getApiMessage(key, 'ar');
      expect(en).not.toBe(key);
      expect(en.length).toBeGreaterThan(0);
      expect(ar).not.toBe(key);
      expect(ar.length).toBeGreaterThan(0);
    }
  });
});
