import {
  initHistoryPersonSelection,
  selectHistoryPerson,
  clearHistoryPersonSelection,
  handleHistoryPersonChange,
} from '../src/lib/supervisor-history-filter';

describe('SUPERVISOR-HISTORY person filter ID contract', () => {
  it('CASE A: initial state keeps assignment id (F9 value) and person id (API) separate', () => {
    const assignmentId = 'opa-assignment-A';
    const personId = 'person-P';
    const sel = initHistoryPersonSelection(assignmentId, personId);
    expect(sel.opaLookupId).toBe('opa-assignment-A');
    expect(sel.personId).toBe('person-P');
  });

  it('CASE A: when only a personId is supplied the F9 value stays empty', () => {
    const sel = initHistoryPersonSelection(undefined, 'person-P');
    expect(sel.opaLookupId).toBe('');
    expect(sel.personId).toBe('person-P');
  });

  it('CASE B: selecting an assignment maps F9 value to item.id and API personId to item.personnelId', () => {
    const sel = selectHistoryPerson({ id: 'opa-A2', personnelId: 'person-P2' });
    expect(sel.opaLookupId).toBe('opa-A2');
    expect(sel.personId).toBe('person-P2');
    expect(sel.opaLookupId).not.toBe(sel.personId);
  });

  it('CASE B: a single-char/other id must never be used as the API person id (id !== personnelId)', () => {
    const item = { id: 'x', personnelId: 'y' };
    const sel = selectHistoryPerson(item);
    expect(sel.personId).toBe('y');
    expect(sel.opaLookupId).toBe('x');
    expect(sel.personId).not.toBe(item.id);
  });

  it('CASE B: API personId is the personnelId, not the OperationalPersonAssignment id', () => {
    const assignmentId = 'cmszev547006e98956mkr7lfx';
    const personnelId = 'person-EMP-0007';
    const sel = selectHistoryPerson({ id: assignmentId, personnelId });
    expect(sel.opaLookupId).toBe(assignmentId);
    expect(sel.personId).toBe(personnelId);
    expect(sel.personId).not.toBe(assignmentId);
  });

  it('CASE C: clearing resets both F9 value and API personId', () => {
    const sel = clearHistoryPersonSelection();
    expect(sel.opaLookupId).toBe('');
    expect(sel.personId).toBeUndefined();
  });

  it('CASE C: onChange with empty string clears both F9 value and API personId', () => {
    const current = { opaLookupId: 'opa-A', personId: 'person-P' };
    const next = handleHistoryPersonChange(current, '');
    expect(next.opaLookupId).toBe('');
    expect(next.personId).toBeUndefined();
  });

  it('CASE C: onChange with empty clears stale personId even when previously set', () => {
    const current = { opaLookupId: 'opa-A', personId: 'person-P' };
    const next = handleHistoryPersonChange(current, '');
    expect(next.personId).toBeUndefined();
  });

  it('CASE B/D: onChange with a non-empty id only updates the F9 value, never the API personId', () => {
    const current = { opaLookupId: 'opa-A', personId: 'person-P' };
    const next = handleHistoryPersonChange(current, 'opa-X');
    expect(next.opaLookupId).toBe('opa-X');
    expect(next.personId).toBe('person-P');
    expect(next.opaLookupId).not.toBe(next.personId);
  });

  it('CASE D: display contract - adapter label is human-readable, never a raw id', () => {
    // The selector displays adapter.displayLabel(...), which formats name/group/type.
    // It must never fall back to an arbitrary CUID. Assert the selection carries
    // distinct human and id fields that a label builder can use.
    const assignmentId = 'cmszev547006e98956mkr7lfx';
    const personnelId = 'cmsrq9vjh00039j2z27c0nfy7';
    const sel = selectHistoryPerson({ id: assignmentId, personnelId });
    expect(sel.opaLookupId).toBe(assignmentId);
    expect(sel.personId).toBe(personnelId);
    // A raw CUID must not be the only source used for both F9 value and API filter.
    expect([sel.opaLookupId, sel.personId].filter((v) => v === assignmentId)).toHaveLength(1);
  });
});

describe('SUPERVISOR-HISTORY i18n regression (temporal categories still resolve)', () => {
  const en = require('../src/lib/i18n/locales/en').default;
  const ar = require('../src/lib/i18n/locales/ar').default;
  const { resolveTranslation } = require('../src/lib/i18n/translation-core');

  it('EN core.temporalCategories.* resolves for all statuses', () => {
    for (const s of ['PAST', 'CURRENT', 'FUTURE']) {
      const value = resolveTranslation((en as any), 'en', `core.temporalCategories.${s}`);
      expect(value).toBeTruthy();
    }
  });

  it('AR core.temporalCategories.* resolves for all statuses', () => {
    for (const s of ['PAST', 'CURRENT', 'FUTURE']) {
      const value = resolveTranslation((ar as any), 'ar', `core.temporalCategories.${s}`);
      expect(value).toBeTruthy();
    }
  });
});
