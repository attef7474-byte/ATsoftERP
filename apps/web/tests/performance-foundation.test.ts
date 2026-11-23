import * as fs from 'fs';
import * as path from 'path';

const repo = path.resolve(__dirname, '..', '..', '..');
const read = (p: string) => fs.readFileSync(path.join(repo, p), 'utf8');

function extractBlock(source: string, key: string): string {
  const m = source.match(new RegExp(`\\b${key}\\s*:\\s*\\{`));
  if (!m || m.index === undefined) return '';
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(m.index, i);
}
function keysInBlock(block: string): string[] {
  const keys: string[] = [];
  const re = /^\s{2,20}([A-Za-z0-9_]+)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    if (['performance'].includes(m[1])) continue;
    keys.push(m[1]);
  }
  return keys;
}

describe('Performance Phase 1 foundation - frontend contracts', () => {
  const profilesPage = read('apps/web/src/app/admin/performance/profiles/page.tsx');
  const coveragePage = read('apps/web/src/app/admin/performance/coverage/page.tsx');
  const personPage = read('apps/web/src/app/admin/core/persons/[id]/page.tsx');
  const enCore = read('apps/web/src/lib/i18n/locales/en/core.ts');
  const arCore = read('apps/web/src/lib/i18n/locales/ar/core.ts');
  const enPerf = extractBlock(enCore, 'performance');
  const arPerf = extractBlock(arCore, 'performance');

  it('has performance profile and coverage pages', () => {
    expect(fs.existsSync(path.join(repo, 'apps/web/src/app/admin/performance/profiles/page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(repo, 'apps/web/src/app/admin/performance/coverage/page.tsx'))).toBe(true);
  });

  it('profiles page has permission-aware actions and CRUD/mapping controls', () => {
    for (const perm of [
      'performance-profile:create', 'performance-profile:update', 'performance-profile:deactivate',
      'performance-profile-mapping:create', 'performance-profile-mapping:update', 'performance-profile-mapping:deactivate',
    ]) expect(profilesPage).toContain(perm);
    expect(profilesPage).toContain('/performance/profiles');
    expect(profilesPage).toContain('/performance/profile-mappings');
    expect(profilesPage).toMatch(/deactivate|activate/);
    expect(profilesPage).toMatch(/Pagination|meta/);
    expect(profilesPage).toMatch(/Search|search/);
  });

  it('profiles page localizes target/category enums and does not expose raw enum-only labels', () => {
    expect(profilesPage).toContain('core.performance.targetType_');
    expect(profilesPage).toContain('core.performance.category_');
    expect(profilesPage).toMatch(/labelTarget|targetType_/);
    expect(profilesPage).not.toMatch(/>JOB_TITLE</);
    expect(profilesPage).not.toMatch(/>MAINTENANCE_ROLE</);
  });

  it('coverage page shows required data-quality stats and filters', () => {
    for (const key of [
      'activeEmployees', 'withCurrentAssignment', 'withoutCurrentAssignment',
      'withJobTitle', 'withoutJobTitle', 'withSupervisor', 'withoutSupervisor',
      'withProfile', 'withoutProfile', 'coverageList',
    ]) expect(coveragePage).toContain(`core.performance.${key}`);
    expect(coveragePage).toContain('/performance/coverage');
    expect(coveragePage).toContain('/performance/coverage/employees');
    expect(coveragePage).toMatch(/hasProfile/);
    expect(coveragePage).toMatch(/Pagination|meta/);
  });

  it('employee detail has read-only performance context with unassigned state and no score/KPI fields', () => {
    expect(personPage).toContain('core.performance.currentProfile');
    expect(personPage).toContain('core.performance.unassigned');
    expect(personPage).toContain('core.performance.supervisor');
    expect(personPage).toContain('core.performance.machineResponsibilities');
    expect(personPage).toContain('core.performance.productionAssignment');
    const perfSection = personPage.toLowerCase();
    for (const banned of ['score', 'kpi', 'ranking', 'bonus', 'penalty', 'attendance score']) {
      expect(perfSection).not.toContain(banned);
    }
  });

  it('performance EN/AR locale keys exist and are mirrored', () => {
    expect(enPerf.length).toBeGreaterThan(100);
    expect(arPerf.length).toBeGreaterThan(100);
    const enKeys = keysInBlock(enPerf).sort();
    const arKeys = keysInBlock(arPerf).sort();
    expect(enKeys.length).toBeGreaterThan(20);
    const missingInAr = enKeys.filter(k => !arKeys.includes(k));
    const missingInEn = arKeys.filter(k => !enKeys.includes(k));
    expect({ missingInAr, missingInEn }).toEqual({ missingInAr: [], missingInEn: [] });
  });

  it('performance locale includes unassigned/coverage/profile labels in both languages', () => {
    expect(enPerf).toMatch(/unassigned\s*:\s*['"][^'"]+/i);
    expect(arPerf).toMatch(/unassigned\s*:\s*['"][^'"]+/);
    expect(enPerf).toMatch(/coverage\s*:/);
    expect(arPerf).toMatch(/coverage\s*:/);
  });

  it('navigation includes performance section', () => {
    const nav = read('apps/web/src/components/admin/shell/navigation-data.ts');
    expect(nav).toMatch(/performance/i);
    expect(nav).toContain('/admin/performance/profiles');
    expect(nav).toContain('/admin/performance/coverage');
  });
});
