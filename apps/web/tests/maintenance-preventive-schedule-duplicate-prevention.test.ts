/**
 * Preventive maintenance schedule duplicate prevention (web contract).
 *
 * The API is the invariant boundary; these tests keep the operator-facing
 * surface honest: the duplicate-conflict feedback is localized in Arabic and
 * English, the operator is routed to the existing schedule instead of being
 * allowed to manufacture another duplicate, no internal identifier is leaked,
 * and non-duplicate errors keep their normal handling.
 */
import fs from 'node:fs';
import path from 'node:path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';

const WEB_SRC = path.resolve(__dirname, '../src');
const read = (rel: string) => fs.readFileSync(path.join(WEB_SRC, rel), 'utf8');

const API_MESSAGES = path.resolve(__dirname, '../../../apps/api/src/common/i18n/api-messages.ts');
const SCHEDULES_PAGE = 'app/admin/maintenance/schedules/page.tsx';

describe('preventive schedule duplicate prevention (web)', () => {
  it('W1. the duplicate-conflict message resolves in both locales', () => {
    for (const [locale, dictionary] of [['en', en], ['ar', ar]] as const) {
      expect(resolveTranslation(dictionary, locale, 'maintenance.preventiveScheduleDuplicateActive')).not.toBe(
        TRANSLATION_FALLBACKS[locale],
      );
    }
  });

  it('W2. the open-existing-schedule affordance resolves in both locales', () => {
    for (const [locale, dictionary] of [['en', en], ['ar', ar]] as const) {
      expect(resolveTranslation(dictionary, locale, 'maintenance.openExistingSchedule')).not.toBe(
        TRANSLATION_FALLBACKS[locale],
      );
    }
  });

  it('W3. the schedules page detects the duplicate message key specifically (no guess from HTTP status)', () => {
    const page = read(SCHEDULES_PAGE);
    expect(page).toContain("config.messageKey === 'maintenance.preventiveScheduleDuplicateActive'");
  });

  it('W4. the conflict panel routes the operator to the existing schedule by id', () => {
    const page = read(SCHEDULES_PAGE);
    expect(page).toContain('maintenance.openExistingSchedule');
    expect(page).toMatch(/onClick=\{\(\) => openEdit\(duplicateConflict\.id\)\}/);
  });

  it('W5. the conflict panel shows the schedule title, never a raw identifier', () => {
    const page = read(SCHEDULES_PAGE);
    expect(page).toContain('duplicateConflict.title');
    expect(page).not.toMatch(/\{duplicateConflict\.id\}/);
  });

  it('W6. the conflict state is cleared when opening create, opening edit, and before a new save', () => {
    const page = read(SCHEDULES_PAGE);
    const clears = page.match(/setDuplicateConflict\(null\)/g) ?? [];
    expect(clears.length).toBeGreaterThanOrEqual(3);
  });

  it('W7. non-duplicate errors still flow through the standard error handler', () => {
    const page = read(SCHEDULES_PAGE);
    expect(page).toContain('handleApiError(err)');
    expect(page).toContain('normalizeApiError(err, t as any)');
  });

  it('W8. create/update keep the real backend route contract', () => {
    const page = read(SCHEDULES_PAGE);
    expect(page).toContain("api.post('/maintenance/schedules', payload)");
    expect(page).toMatch(/api\.patch\(`\/maintenance\/schedules\/\$\{editItem\.id\}`, payload\)/);
  });

  it('W9. the duplicate banner reuses localized text, not the raw server key', () => {
    const page = read(SCHEDULES_PAGE);
    expect(page).toContain("setSaveError(t('maintenance.preventiveScheduleDuplicateActive'))");
  });

  it('W10. the reliability-alert prefill still forces a PREVENTIVE schedule', () => {
    const page = read(SCHEDULES_PAGE);
    expect(page).toContain("type: 'PREVENTIVE'");
    expect(page).toContain('scheduleFromAlertLoadFailed');
  });

  it('W11. both duplicate keys are defined together in the EN and AR maintenance dictionaries', () => {
    const enSrc = fs.readFileSync(path.join(WEB_SRC, 'lib/i18n/locales/en/maintenance.ts'), 'utf8');
    const arSrc = fs.readFileSync(path.join(WEB_SRC, 'lib/i18n/locales/ar/maintenance.ts'), 'utf8');
    for (const src of [enSrc, arSrc]) {
      expect(src).toContain('preventiveScheduleDuplicateActive:');
      expect(src).toContain('openExistingSchedule:');
    }
  });

  it('W12. the backend message key is localized in both Arabic and English', () => {
    const apiSrc = fs.readFileSync(API_MESSAGES, 'utf8');
    const line = apiSrc.split(/\r?\n/).find((l) => l.includes("'maintenance.preventiveScheduleDuplicateActive'"));
    expect(line).toBeTruthy();
    expect(line).toMatch(/\bar:/);
    expect(line).toMatch(/\ben:/);
  });
});
