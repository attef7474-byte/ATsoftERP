import { getApiMessage, getApiMessageEntry } from './api-messages';

/**
 * M5 integration-hardening guard.
 *
 * The installed-part writer and the required-part line service both emit
 * `maintenance.machineComponentMachineMismatch` when a MachineComponent does not
 * belong to the machine it is paired with. The API must resolve that key for both
 * locales (never echo the raw key) because clients render `message` verbatim.
 */
describe('M5 machine-component/machine invariant message key', () => {
  const KEY = 'maintenance.machineComponentMachineMismatch';

  it('exists in the API catalog', () => {
    expect(getApiMessageEntry(KEY)).toBeDefined();
  });

  it('resolves to real English text, never the key', () => {
    const en = getApiMessage(KEY, 'en-US');
    expect(en).not.toBe(KEY);
    expect(en.trim().length).toBeGreaterThan(0);
  });

  it('resolves to real Arabic text with Arabic script', () => {
    const ar = getApiMessage(KEY, 'ar');
    expect(ar).not.toBe(KEY);
    expect(/[\u0600-\u06FF]/.test(ar)).toBe(true);
  });

  it('English and Arabic text differ', () => {
    expect(getApiMessage(KEY, 'en-US')).not.toBe(getApiMessage(KEY, 'ar'));
  });
});