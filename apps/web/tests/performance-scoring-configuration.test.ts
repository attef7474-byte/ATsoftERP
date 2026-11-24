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
  const re = /^\s{2,24}([A-Za-z0-9_]+)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) keys.push(m[1]);
  return keys.sort();
}

describe('Performance Phase 3 scoring configuration frontend contracts', () => {
  const page = read('apps/web/src/app/admin/performance/scoring/page.tsx');
  const nav = read('apps/web/src/components/admin/shell/navigation-data.ts');
  const controller = read('apps/api/src/modules/performance/scoring/performance-scoring.controller.ts');
  const service = read('apps/api/src/modules/performance/scoring/performance-scoring.service.ts');
  const seeds = read('apps/api/prisma/seed/seed-performance-permission-keys.ts');
  const enCore = read('apps/web/src/lib/i18n/locales/en/core.ts');
  const arCore = read('apps/web/src/lib/i18n/locales/ar/core.ts');
  const enNav = read('apps/web/src/lib/i18n/locales/en/navigation.ts');
  const arNav = read('apps/web/src/lib/i18n/locales/ar/navigation.ts');
  const enScoring = extractBlock(extractBlock(enCore, 'performance'), 'scoring');
  const arScoring = extractBlock(extractBlock(arCore, 'performance'), 'scoring');

  it('exposes a real admin route under the performance section', () => {
    expect(fs.existsSync(path.join(repo, 'apps/web/src/app/admin/performance/scoring/page.tsx'))).toBe(true);
    expect(nav).toContain('/admin/performance/scoring');
    expect(nav).toContain('performanceScoring');
    expect(enNav).toContain('performanceScoring');
    expect(arNav).toContain('performanceScoring');
  });

  it('uses only real API endpoints with POST create and PATCH same-record update', () => {
    for (const endpoint of [
      '/performance/targets',
      '/performance/weights',
      '/performance/scoring-rules',
      '/performance/profiles',
      '/performance/kpis',
      '/performance/configuration-coverage',
      '/performance/simulate',
      '/production/operational-people',
    ]) {
      expect(page).toContain(endpoint);
    }
    expect(page).toContain('api.get(`/performance/profiles/${profileId}/readiness`');
    for (const endpoint of ['/performance/targets', '/performance/weights', '/performance/scoring-rules']) {
      expect(page).toContain(`api.get('${endpoint}', params)`);
      expect(page).toContain(`api.post('${endpoint}', payload)`);
      expect(page).toContain('api.patch(`' + endpoint + '/${id}`, payload)');
      expect(page).toContain('api.post(`' + endpoint + '/${id}/${action}`, {})');
    }
    expect(page).toMatch(/editingId\s*\?\s*t\(cfg\.editKey\)/);
  });

  it('gates every configuration action with the seeded backend permission keys', () => {
    const permissions = [
      'performance-target:read',
      'performance-target:create',
      'performance-target:update',
      'performance-target:deactivate',
      'performance-weight:read',
      'performance-weight:create',
      'performance-weight:update',
      'performance-weight:deactivate',
      'performance-scoring-rule:read',
      'performance-scoring-rule:create',
      'performance-scoring-rule:update',
      'performance-scoring-rule:deactivate',
      'performance-config-coverage:read',
      'performance-simulation:read',
    ];
    for (const permission of permissions) {
      expect(page).toContain(permission);
      expect(controller).toContain(`'${permission}'`);
      expect(seeds).toContain(`'${permission}'`);
    }
    expect(page).toContain('isSuperAdmin');
    expect(page).toContain('permissions?.permissions.includes');
  });

  it('renders preview-only simulation evidence and never posts a persisted evaluation', () => {
    for (const field of [
      'previewOnly',
      'noPersistedEvaluation',
      'simulationLabel',
      'rawValue',
      'targetValue',
      'score',
      'weightPercent',
      'weightedContribution',
      'evidenceCount',
      'explanation',
      'versions',
    ]) {
      expect(page).toContain(field);
    }
    expect(page).toContain("result.simulationLabel === 'PREVIEW_ONLY_NOT_APPROVED'");
    expect(service).toContain('simulationLabel: "PREVIEW_ONLY_NOT_APPROVED"');
    for (const forbidden of [
      '/performance/evaluations',
      'persistedEvaluation',
      '/performance/ranking',
      '/performance/bonus',
      '/performance/payroll',
      '/performance/disciplinary',
    ]) {
      expect(page).not.toContain(forbidden);
      expect(controller).not.toContain(forbidden);
    }
  });

  it('has mirrored EN/AR scoring labels with no hardcoded enum display text', () => {
    expect(enScoring.length).toBeGreaterThan(1000);
    expect(arScoring.length).toBeGreaterThan(1000);
    const enKeys = keysInBlock(enScoring);
    const arKeys = keysInBlock(arScoring);
    expect(enKeys.length).toBeGreaterThan(100);
    expect({ missingInAr: enKeys.filter(k => !arKeys.includes(k)), missingInEn: arKeys.filter(k => !enKeys.includes(k)) })
      .toEqual({ missingInAr: [], missingInEn: [] });
    for (const key of ['title', 'targets', 'weights', 'rules', 'readiness', 'coverage', 'simulation', 'simLabel', 'mode_LINEAR_TARGET', 'direction_LOWER_IS_BETTER', 'issueInvalidTotal']) {
      expect(enKeys).toContain(key);
      expect(arKeys).toContain(key);
    }
    for (const hardcoded of ['Linear to target', 'Higher is better', 'Company', 'Draft', 'Select...']) {
      expect(page).not.toContain(hardcoded);
    }
  });

  it('contains loading, error, empty and permission states through shared components', () => {
    expect(page).toContain('LoadingState');
    expect(page).toContain("t('errors.loadFailed')");
    expect(page).toContain("t('errors.saveFailed')");
    expect(page).toContain("t('common.noData')");
    expect(page).toContain('permissionNotice');
    expect(page).toContain('useToast');
    expect(page).toContain('Modal');
    expect(page).toContain('Pagination');
  });

  it('does not introduce mock or duplicate canonical production target authority', () => {
    expect(page).not.toMatch(/\bmock\b|\bfake\b|\bdummy\b/i);
    expect(page).not.toContain('ProductionPerformanceTarget');
    expect(page).not.toContain('EMP-');
    expect(page).not.toContain('P3RT_');
  });
});
