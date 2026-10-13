/**
 * Maintenance execution duplication + completion web contract.
 *
 * The API is the authorization and invariant boundary. These tests keep the
 * operator-facing surface honest: the duplicate-conflict feedback is localized,
 * a PENDING execution tells the operator to start before completing, and the
 * create form routes to the execution that already exists rather than letting
 * the operator manufacture another duplicate.
 */
import fs from 'node:fs';
import path from 'node:path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';

const SRC = path.resolve(__dirname, '../src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('maintenance execution duplication prevention (web)', () => {
  it('W1. the duplicate-conflict message resolves in both locales', () => {
    for (const [locale, dictionary] of [['en', en], ['ar', ar]] as const) {
      expect(resolveTranslation(dictionary, locale, 'maintenance.executionActiveExists')).not.toBe(TRANSLATION_FALLBACKS[locale]);
    }
  });

  it('W2. the pending-start guidance resolves in both locales', () => {
    for (const [locale, dictionary] of [['en', en], ['ar', ar]] as const) {
      expect(resolveTranslation(dictionary, locale, 'maintenance.startRequiredForCompletion')).not.toBe(TRANSLATION_FALLBACKS[locale]);
    }
  });

  it('W3. the tasks page shows start-before-complete guidance for a PENDING execution', () => {
    const page = read('app/admin/maintenance/tasks/page.tsx');
    expect(page).toContain("selected.status === 'PENDING'");
    expect(page).toContain("t('maintenance.startRequiredForCompletion')");
  });

  it('W4. start and complete stay permission-gated and double-submit guarded', () => {
    const page = read('app/admin/maintenance/tasks/page.tsx');
    expect(page).toContain("can('maintenance-task:start')");
    expect(page).toContain("can('maintenance-task:complete')");
    expect(page).toMatch(/if \(!selected \|\| busy\) return;/);
    expect(page).toContain('loading={busy}');
  });

  it('W5. the table keeps stable identity keys and never dedupes by source', () => {
    const page = read('app/admin/maintenance/tasks/page.tsx');
    expect(page).toContain('key={item.id}');
    expect(page).not.toMatch(/dedupe/i);
  });

  it('W6. the create form routes an existing active execution instead of duplicating', () => {
    const form = read('components/maintenance/execution-form.tsx');
    expect(form).toContain('maintenance.executionActiveExists');
    expect(form).toContain('onCreated(String(data.params.executionId))');
    expect(form).toContain('createdId');
  });
});
