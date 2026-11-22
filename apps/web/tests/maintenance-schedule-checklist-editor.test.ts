import fs from 'node:fs';
import path from 'node:path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';

const webSrc = path.resolve(__dirname, '../src');
const page = fs.readFileSync(path.join(webSrc, 'app/admin/maintenance/schedules/page.tsx'), 'utf8');

describe('Phase 7 unified schedule + checklist editor contract', () => {
  it('loads active checklist items from the schedule detail GET', () => {
    expect(page).toContain("api.get(`/maintenance/schedules/${id}`)");
    expect(page).toContain('res.data?.checklistItems');
    expect(page).toContain('rowFromApi(row, index)');
  });

  it('submits the edited checklist atomically with create and update', () => {
    expect(page).toContain('checklistItems: buildChecklistPayload()');
    expect(page).toContain("api.post('/maintenance/schedules', payload)");
    expect(page).toContain('api.patch(`/maintenance/schedules/${editItem.id}`, payload)');
  });

  it('supports add, deterministic reorder, soft-retire and restore', () => {
    expect(page).toContain('const addChecklistRow =');
    expect(page).toContain('const moveChecklistRow =');
    expect(page).toContain('const retireChecklistRow =');
    expect(page).toContain('const restoreChecklistRow =');
    expect(page).toContain('retired: true');
    expect(page).toContain('sortOrder: index + 1');
  });

  it('keeps retired template rows visible for restore but drops unsaved rows', () => {
    // Regression guard: an inverted filter silently removed persisted rows and
    // left the retired-items section empty while still omitting them from the
    // save payload. Persisted rows must be retained with retired: true.
    expect(page).toContain('.filter((row) => row.key !== key || !!row.id))');
    expect(page).not.toContain('.filter((row) => row.key === key ? !row.id : true))');
  });

  it('never sends execution actors or snapshot fields from the editor', () => {
    expect(page).not.toMatch(/startedById|completedById|itemTitleSnapshot|resultTypeSnapshot/);
  });

  it('validates blank titles and invalid numeric ranges before submit', () => {
    expect(page).toContain("activeRows.forEach((row) => {");
    expect(page).toContain("t('maintenance.checklistItemTitleRequired')");
    expect(page).toContain("t('maintenance.invalidResultRange')");
  });
});

describe('Phase 7/8 Arabic and English checklist editor translations', () => {
  const keys = [
    'maintenance.checklistItemTitle',
    'maintenance.checklistItemDescription',
    'maintenance.checklistItemUnit',
    'maintenance.unifiedChecklistEditorHint',
    'maintenance.checklistEditorNoItems',
    'maintenance.addChecklistItem',
    'maintenance.moveUp',
    'maintenance.moveDown',
    'maintenance.retireChecklistItem',
    'maintenance.restoreChecklistItem',
    'maintenance.retiredChecklistItems',
    'maintenance.checklistItemTitleRequired',
    'maintenance.invalidResultType',
    'maintenance.resultRangeNotApplicable',
    'maintenance.invalidResultRange',
    'maintenance.checklistItemNotFound',
    'maintenance.checklistStartNotAuthorized',
    'maintenance.duplicateActiveChecklistExecution',
    'maintenance.scheduleRequired',
    'maintenance.executionNotFound',
    'maintenance.executionItemNotFound',
    'maintenance.executionNotInProgress',
    'maintenance.invalidExecutionStatus',
    'maintenance.resultValueRequired',
    'maintenance.resultValueOutOfRange',
    'maintenance.requestMachineMismatch',
  ];

  it.each(keys)('resolves %s in both locales with a translated value', (key) => {
    const enValue = resolveTranslation(en as any, 'en', key);
    const arValue = resolveTranslation(ar as any, 'ar', key);
    expect(enValue).toBeTruthy();
    expect(arValue).toBeTruthy();
    expect(enValue).not.toBe(TRANSLATION_FALLBACKS.en);
    expect(arValue).not.toBe(TRANSLATION_FALLBACKS.ar);
    expect(arValue).not.toContain('????');
  });
});
