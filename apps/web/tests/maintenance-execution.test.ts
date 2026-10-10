import fs from 'node:fs';
import path from 'node:path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';
import {
  canInstallExecutionPart,
  emptyExecutionScope,
  executionSourceReference,
  executionWaitingForContinuation,
  isExecutionSourceEligible,
  isValidHistoricalInterval,
} from '../src/lib/maintenance-execution';

describe('canonical maintenance execution UI policy', () => {
  it('sends exactly one source link and none for direct work', () => {
    expect(executionSourceReference('MAINTENANCE_REQUEST', 'request-a')).toEqual({ sourceType: 'MAINTENANCE_REQUEST', requestId: 'request-a' });
    expect(executionSourceReference('WORK_ORDER', 'order-a')).toEqual({ sourceType: 'WORK_ORDER', workOrderId: 'order-a' });
    expect(executionSourceReference('DIRECT', 'stale-source')).toEqual({ sourceType: 'DIRECT' });
  });

  it('clears all stale machine context when scope changes', () => {
    expect(emptyExecutionScope('GENERAL')).toEqual({ scopeType: 'GENERAL', productionLineId: '', machineId: '', machineComponentId: '' });
    expect(emptyExecutionScope('PRODUCTION_LINE').machineId).toBe('');
  });

  it.each(['COMPLETED', 'CANCELLED', 'CLOSED'])('does not select terminal source %s', (status) => {
    expect(isExecutionSourceEligible(status)).toBe(false);
  });

  it('accepts a real historical interval and rejects impossible or future chronology', () => {
    const now = Date.parse('2026-10-08T12:00:00Z');
    expect(isValidHistoricalInterval('2026-10-08T08:00:00Z', '2026-10-08T10:00:00Z', now)).toBe(true);
    expect(isValidHistoricalInterval('2026-10-08T10:00:00Z', '2026-10-08T08:00:00Z', now)).toBe(false);
    expect(isValidHistoricalInterval('2026-10-08T08:00:00Z', '2026-10-08T13:00:00Z', now)).toBe(false);
    expect(isValidHistoricalInterval('', '', now)).toBe(false);
  });

  it('allows installation only on an actual machine', () => {
    expect(canInstallExecutionPart('MACHINE', 'machine-a')).toBe(true);
    expect(canInstallExecutionPart('MACHINE', null)).toBe(false);
    expect(canInstallExecutionPart('GENERAL', 'stale-machine')).toBe(false);
    expect(canInstallExecutionPart('PRODUCTION_LINE', null)).toBe(false);
  });

  it('derives waiting state after handoff without marking execution complete', () => {
    expect(executionWaitingForContinuation({ status: 'IN_PROGRESS', sessions: [] })).toBe(true);
    expect(executionWaitingForContinuation({ status: 'IN_PROGRESS', sessions: [{ id: 's', executionId: 'e', technicianUserId: 'u', startedAt: '2026-10-08T08:00Z' }] })).toBe(false);
    expect(executionWaitingForContinuation({ status: 'COMPLETED', sessions: [] })).toBe(false);
  });
});


describe('execution runtime translation values', () => {
  it.each(['common.name', 'maintenance.sourceType', 'maintenance.workPerformed', 'maintenance.responsibleEngineer', 'common.status', 'maintenance.elapsedHours', 'maintenance.laborHours'])('resolves table heading %s', key => {
    for (const [locale, dictionary] of [['en', en], ['ar', ar]] as const) {
      expect(resolveTranslation(dictionary, locale, key)).not.toBe(TRANSLATION_FALLBACKS[locale]);
    }
  });
  it('resolves every literal execution-screen translation to text in both languages', () => {
    const files = [
      'components/maintenance/execution-parts.tsx',
      'components/maintenance/execution-form.tsx',
      'app/admin/maintenance/tasks/page.tsx',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8');
      for (const match of source.matchAll(/\bt\('([^']+)'\)/g)) {
        for (const [locale, dictionary] of [['en', en], ['ar', ar]] as const) {
          expect({ file, key: match[1], locale, message: resolveTranslation(dictionary, locale, match[1]) }).not.toMatchObject({ message: TRANSLATION_FALLBACKS[locale] });
        }
      }
    }
  });
});
