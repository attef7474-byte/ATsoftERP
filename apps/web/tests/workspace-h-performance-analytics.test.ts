import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');

const HOST_PAGE = 'src/app/admin/production/analytics/page.tsx';
const TARGETS_REDIRECT = 'src/app/admin/production/performance-targets/page.tsx';
const RELIABILITY_REDIRECT = 'src/app/admin/production/reliability/page.tsx';
const ANALYTICS_PANEL = 'src/components/factory/unified-production/analytics-panel.tsx';
const TARGETS_PANEL = 'src/components/factory/unified-production/performance-targets-panel.tsx';
const RELIABILITY_PANEL = 'src/components/factory/unified-production/reliability-panel.tsx';
const EN_PROD = 'src/lib/i18n/locales/en/production.ts';
const AR_PROD = 'src/lib/i18n/locales/ar/production.ts';

/**
 * Workspace H — Performance & Analytics consolidation.
 *
 * Analytics, Performance Targets and Reliability collapse into one canonical
 * workspace hosted at /admin/production/analytics with tabs, while the legacy
 * /performance-targets and /reliability routes become redirect stubs (never 404).
 * Performance Targets gains an atomic multi-select batch CREATE (one canonical
 * DRAFT row per selected target, one POST, all-or-nothing); Edit stays single-record.
 */
describe('Workspace H — Performance & Analytics consolidation', () => {
  describe('H1. Unified workspace and tabs', () => {
    it('renders one canonical workspace hosting the three panels', () => {
      const page = read(HOST_PAGE);
      expect(page).toContain('import { AnalyticsPanel }');
      expect(page).toContain('import { PerformanceTargetsPanel }');
      expect(page).toContain('import { ReliabilityPanel }');
      expect(page).toContain("{ id: 'analytics', label: t('production.analytics.title') }");
      expect(page).toContain("{ id: 'performance-targets', label: t('production.performanceTargets.title') }");
      expect(page).toContain("{ id: 'reliability', label: t('productionReliability.title') }");
      expect(page).toContain("'analytics' | 'performance-targets' | 'reliability'");
      expect(page).toContain('<TabPanel id="analytics"');
      expect(page).toContain('<TabPanel id="performance-targets"');
      expect(page).toContain('<TabPanel id="reliability"');
    });

    it('H2 loads the analytics tab panel', () => {
      expect(read(HOST_PAGE)).toContain('<TabPanel id="analytics" activeId={tab}>');
      expect(read(ANALYTICS_PANEL)).toContain('export function AnalyticsPanel');
    });

    it('H3 loads the performance-targets tab panel', () => {
      expect(read(HOST_PAGE)).toContain('<TabPanel id="performance-targets" activeId={tab}>');
      expect(read(TARGETS_PANEL)).toContain('export function PerformanceTargetsPanel');
    });

    it('H4 loads the reliability tab panel', () => {
      expect(read(HOST_PAGE)).toContain('<TabPanel id="reliability" activeId={tab}>');
      expect(read(RELIABILITY_PANEL)).toContain('export function ReliabilityPanel');
    });
  });

  describe('H5. Legacy routes redirect (never 404)', () => {
    it('performance-targets redirects to the performance-targets tab', () => {
      const redirect = read(TARGETS_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/analytics?tab=performance-targets')");
      expect(redirect).not.toContain('AdminDataGrid');
      expect(redirect).not.toContain('export function');
    });
    it('reliability redirects to the reliability tab', () => {
      const redirect = read(RELIABILITY_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/analytics?tab=reliability')");
      expect(redirect).not.toContain('AdminDataGrid');
      expect(redirect).not.toContain('export function');
    });
  });

  describe('H7. Deep-link tab refresh', () => {
    it('reads the ?tab= deep link and re-applies it on change', () => {
      const page = read(HOST_PAGE);
      expect(page).toContain("searchParams?.get('tab')");
      expect(page).toContain('useEffect');
    });
  });

  describe('H8–H14. Performance Targets batch CREATE UI', () => {
    const panel = read(TARGETS_PANEL);

    it('H8 reuses F9MultiLookup for multi-target selection', () => {
      expect(panel).toContain('F9MultiLookup');
      expect(panel).toContain("import { F9Lookup, F9MultiLookup } from '../../../components/f9';");
    });

    it('H9 scope-specific selector switches adapter by scope type', () => {
      expect(panel).toContain("batchScope === 'MACHINE'");
      expect(panel).toContain("batchScope === 'LINE'");
      expect(panel).toContain("batchScope === 'UNIT'");
      expect(panel).toContain("batchScope === 'PRODUCT'");
      expect(panel).toContain('machineAdapter');
      expect(panel).toContain('productionLineAdapter');
      expect(panel).toContain('productionUnitAdapter');
      expect(panel).toContain('productionProductDefinitionAdapter');
    });

    it('H10 multiple selections are retained in batchTargetIds state', () => {
      expect(panel).toContain('const [batchTargetIds, setBatchTargetIds] = useState<string[]>([])');
      expect(panel).toContain('setBatchTargetIds(ids)');
    });

    it('H11 shows the selected count and the create count before save', () => {
      expect(panel).toContain("batchSelectedCount', undefined, { count: batchTargetIds.length }");
      expect(panel).toContain("batchConfirmCount', undefined, { count: batchTargetIds.length }");
    });

    it('H12 removal works through F9MultiLookup toggle', () => {
      // F9MultiLookup handles removal internally; the panel wires onChange to replace the array.
      expect(panel).toContain('onChange={(ids) => { setBatchTargetIds(ids)');
    });

    it('H13 batch confirmation shows the exact count', () => {
      expect(panel).toContain("batchCreated', undefined, { count: batchTargetIds.length }");
    });

    it('H14 issues exactly one batch POST per submission', () => {
      expect(panel).toContain("api.post('/production/performance-targets/batch'");
      const posts = panel.match(/api\.post\('\/production\/performance-targets\/batch'/g) || [];
      expect(posts).toHaveLength(1);
    });

    it('builds one target row per selected id using the scope dimension', () => {
      expect(panel).toContain("const dimensionKey: Record<string, string> = {");
      expect(panel).toContain("UNIT: 'productionUnitId'");
      expect(panel).toContain("LINE: 'productionLineId'");
      expect(panel).toContain("MACHINE: 'machineId'");
      expect(panel).toContain("PRODUCT: 'productionProductDefinitionId'");
      expect(panel).toContain('const targets = batchTargetIds.map((id) => ({ [dimensionKey[batchScope]]: id }));');
    });

    it('never mixes scope types in one request (single scopeType for the batch)', () => {
      expect(panel).toContain('scopeType: batchScope');
      expect(panel).not.toMatch(/scopeType:.*scopeType:/);
    });
  });

  describe('H15. Edit remains single-record', () => {
    it('edit PATCHes one record and create (non-batch) posts a single record', () => {
      const panel = read(TARGETS_PANEL);
      expect(panel).toContain('await api.patch(`/production/performance-targets/${editItem.id}`');
      expect(panel).toContain("api.post('/production/performance-targets'");
    });
  });

  describe('H16. No raw IDs or hard-coded cuids', () => {
    it('panels never hard-code cuids or build malformed F9 index queries', () => {
      for (const panel of [read(ANALYTICS_PANEL), read(TARGETS_PANEL), read(RELIABILITY_PANEL)]) {
        expect(panel).not.toMatch(/c[a-z0-9]{20,}/);
        expect(panel).not.toMatch(/\?0=/);
        expect(panel).not.toMatch(/\?1=/);
      }
    });
  });

  describe('H17. Permissions respected', () => {
    it('the targets panel gates read/create/update on its permission keys', () => {
      const panel = read(TARGETS_PANEL);
      // The panel builds keys from the stable prefix plus the action.
      expect(panel).toContain('production-performance-target:${action}');
      expect(panel).toContain("can('read')");
      expect(panel).toContain("can('create')");
      expect(panel).toContain("can('update')");
    });
    it('the batch button is gated by can(create)', () => {
      expect(read(TARGETS_PANEL)).toMatch(/\{can\('create'\) && <Button variant="secondary" onClick=\{openBatch\}>/);
    });
  });

  describe('H18–H20. Arabic and English keys exist, synchronized, no fallback', () => {
    it('both locales define the workspace title and description', () => {
      expect(read(EN_PROD)).toContain('analyticsWorkspace:');
      expect(read(AR_PROD)).toContain('analyticsWorkspace:');
      expect(read(EN_PROD)).toContain('analyticsWorkspaceDescription:');
      expect(read(AR_PROD)).toContain('analyticsWorkspaceDescription:');
    });

    it('every new batch label and error key exists in both locales', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      const keys = [
        'batchAddMultiple:', 'batchHint:', 'batchSelectUnits:', 'batchSelectLines:',
        'batchSelectMachines:', 'batchSelectProducts:', 'batchTargetsHint:',
        'batchSelectedCount:', 'batchConfirmCount:', 'batchCreated:',
        'duplicateTargetInRequest:',
      ];
      for (const key of keys) {
        expect(en).toContain(key);
        expect(ar).toContain(key);
      }
    });

    it('the panel never renders a raw translation key or hard-coded fallback text', () => {
      const panel = read(TARGETS_PANEL);
      // No literal fallback strings passed to t() as a default that would mask a missing key.
      expect(panel).not.toMatch(/t\(\s*'[^']+'\s*,\s*'/);
    });

    it('the tab label namespaces resolve in both locales', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      expect(en).toContain('analytics: {');
      expect(ar).toContain('analytics: {');
      expect(en).toContain('performanceTargets: {');
      expect(ar).toContain('performanceTargets: {');
    });
  });

  describe('H-batch backend wiring', () => {
    it('the panel posts the exact batch contract field names', () => {
      const panel = read(TARGETS_PANEL);
      expect(panel).toContain('scopeType: batchScope');
      expect(panel).toContain('targets,');
      expect(panel).toContain('availabilityTarget: batchForm.availabilityTarget');
      expect(panel).toContain('performanceTarget: batchForm.performanceTarget');
      expect(panel).toContain('qualityTarget: batchForm.qualityTarget');
      expect(panel).toContain('oeeTarget: batchForm.oeeTarget');
    });
  });
});
