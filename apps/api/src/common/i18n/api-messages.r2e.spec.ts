import { getApiMessage, getApiMessageEntry } from './api-messages';

/**
 * R2-E regression guard.
 *
 * The API localizes an error through `getApiMessage(messageKey)`. When a key is
 * absent from this catalog `getApiMessage` returns the KEY ITSELF, so the API
 * echoes a raw translation key to the client. The R2-E replacement contract
 * introduced 23 new backend keys, and every one of them must resolve here or a
 * non-web consumer (or a client that renders `message` verbatim) would receive
 * `maintenance.replacementOldInstalledPartNotActive` instead of a sentence.
 *
 * This test fails if a backend-emitted key is added to the service without
 * being mirrored into the API catalog.
 */
const R2E_BACKEND_KEYS = [
  'maintenance.replacementActionRequired',
  'maintenance.replacementActionInvalid',
  'maintenance.replacementNewInstallationRejectsOldPart',
  'maintenance.replacementNewInstallationRejectsRemovedPartFields',
  'maintenance.replacementOldInstalledPartRequired',
  'maintenance.replacementOldInstalledPartNotFound',
  'maintenance.replacementOldInstalledPartNotActive',
  'maintenance.replacementOldInstalledPartMachineMismatch',
  'maintenance.replacementOldInstalledPartComponentMismatch',
  'maintenance.replacementOldInstalledPartQuantityInvalid',
  'maintenance.replacementPartialRemovalNotSupported',
  'maintenance.replacementRemovedPartConditionRequired',
  'maintenance.replacementRemovedPartWarehouseRequired',
  'maintenance.replacementRemovedPartQuantityRequired',
  'maintenance.replacementRemovedPartConditionInvalid',
  'maintenance.replacementReturnedRejectsNoReturnReason',
  'maintenance.replacementNoReturnReasonRequired',
  'maintenance.replacementNoReturnRejectsReturnFields',
  'maintenance.repairSourceNotFound',
  'maintenance.repairSourceNotRepairable',
  'maintenance.repairSourceOldIdentityMissing',
  'maintenance.repairSourceReturnMovementNotFound',
  'maintenance.repairSourceReturnMovementMismatch',
];

describe('R2-E backend message key resolution', () => {
  it.each(R2E_BACKEND_KEYS)('%s exists in the API catalog', (key) => {
    expect(getApiMessageEntry(key)).toBeDefined();
  });

  it.each(R2E_BACKEND_KEYS)('%s resolves to real English text, never the key', (key) => {
    const en = getApiMessage(key, 'en-US');
    expect(en).not.toBe(key);
    expect(en.trim().length).toBeGreaterThan(0);
  });

  it.each(R2E_BACKEND_KEYS)('%s resolves to real Arabic text, never the key', (key) => {
    const ar = getApiMessage(key, 'ar');
    expect(ar).not.toBe(key);
    // Arabic entries must contain Arabic script, not Latin.
    expect(/[\u0600-\u06FF]/.test(ar)).toBe(true);
  });

  it('no R2-E key is missing or duplicated as a raw-key echo', () => {
    const unresolved = R2E_BACKEND_KEYS.filter((k) => !getApiMessageEntry(k));
    expect(unresolved).toEqual([]);
  });

  it('English and Arabic text differ for every R2-E key', () => {
    const identical = R2E_BACKEND_KEYS.filter(
      (k) => getApiMessage(k, 'en-US') === getApiMessage(k, 'ar'),
    );
    expect(identical).toEqual([]);
  });
});
