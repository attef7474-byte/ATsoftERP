import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');

const HOST_PAGE = 'src/app/admin/production/quality/plans/page.tsx';
const INSPECTIONS_REDIRECT = 'src/app/admin/production/quality/inspections/page.tsx';
const NCRS_REDIRECT = 'src/app/admin/production/quality/ncrs/page.tsx';
const PLANS_PANEL = 'src/components/factory/unified-production/quality-plans-panel.tsx';
const INSPECTIONS_PANEL = 'src/components/factory/unified-production/quality-inspections-panel.tsx';
const NCRS_PANEL = 'src/components/factory/unified-production/quality-ncrs-panel.tsx';
const EN_PROD = 'src/lib/i18n/locales/en/production.ts';
const AR_PROD = 'src/lib/i18n/locales/ar/production.ts';

/**
 * Workspace F — Quality consolidation.
 *
 * Three related quality surfaces (Quality Plans master data, Inspections,
 * Nonconformance Reports) collapse into one canonical workspace hosted at
 * /admin/production/quality/plans with tabs, while the legacy /quality/inspections
 * and /quality/ncrs routes become redirect stubs (never 404). Backend,
 * endpoints, permissions and data are unchanged.
 */
describe('Workspace F — Quality consolidation', () => {
  describe('F1. Unified workspace and tabs', () => {
    it('renders one canonical workspace hosting the three panels', () => {
      const page = read(HOST_PAGE);
      expect(page).toContain("import { QualityPlansPanel }");
      expect(page).toContain("import { QualityInspectionsPanel }");
      expect(page).toContain("import { QualityNcrsPanel }");
      expect(page).toContain("{ id: 'plans', label: t('production.qualityPlans.title') }");
      expect(page).toContain("{ id: 'inspections', label: t('production.inspections.title') }");
      expect(page).toContain("{ id: 'ncrs', label: t('production.ncrs.title') }");
      expect(page).toContain("'plans' | 'inspections' | 'ncrs'");
      expect(page).toContain('<TabPanel id="plans"');
      expect(page).toContain('<TabPanel id="inspections"');
      expect(page).toContain('<TabPanel id="ncrs"');
    });
    it('reads the ?tab= deep link', () => {
      expect(read(HOST_PAGE)).toContain("searchParams?.get('tab')");
    });
  });

  describe('F2. Legacy routes redirect (never 404)', () => {
    it('inspections redirects to the inspections tab', () => {
      const redirect = read(INSPECTIONS_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/quality/plans?tab=inspections')");
      expect(redirect).not.toContain('AdminDataGrid');
      expect(redirect).not.toContain('export function');
    });
    it('ncrs redirects to the ncrs tab', () => {
      const redirect = read(NCRS_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/quality/plans?tab=ncrs')");
      expect(redirect).not.toContain('AdminDataGrid');
      expect(redirect).not.toContain('export function');
    });
  });

  describe('F3. One canonical panel per surface (no duplicate implementations)', () => {
    it('the panels export the canonical implementations', () => {
      expect(read(PLANS_PANEL)).toContain('export function QualityPlansPanel');
      expect(read(INSPECTIONS_PANEL)).toContain('export function QualityInspectionsPanel');
      expect(read(NCRS_PANEL)).toContain('export function QualityNcrsPanel');
    });
    it('the panels no longer render their own PageHeader (the workspace owns it)', () => {
      for (const panel of [read(PLANS_PANEL), read(INSPECTIONS_PANEL), read(NCRS_PANEL)]) {
        expect(panel).not.toContain('PageHeader');
      }
    });
  });

  describe('F4. Endpoints and lifecycle actions preserved', () => {
    it('quality plans keeps CRUD + submit/approve/reject/deactivate + children', () => {
      const panel = read(PLANS_PANEL);
      expect(panel).toContain("api.get<{ data: ProductionQualityPlan[]; meta: any }>('/production/quality-plans'");
      expect(panel).toContain("api.post('/production/quality-plans'");
      expect(panel).toContain('/submit`');
      expect(panel).toContain('/approve`');
      expect(panel).toContain('/reject`');
      expect(panel).toContain('/deactivate`');
      expect(panel).toContain('/characteristics`');
      expect(panel).toContain('/sampling-points`');
    });
    it('inspections keeps CRUD + results/complete/dispositions', () => {
      const panel = read(INSPECTIONS_PANEL);
      expect(panel).toContain("api.post('/production/inspections'");
      expect(panel).toContain('/results`');
      expect(panel).toContain('/complete`');
      expect(panel).toContain('/dispositions`');
    });
    it('ncrs keeps CRUD + transition + attachments', () => {
      const panel = read(NCRS_PANEL);
      expect(panel).toContain("api.post('/production/ncrs'");
      expect(panel).toContain('/transition`');
      expect(panel).toContain('/attachments`');
    });
  });

  describe('F5. Permission gating preserved', () => {
    it('quality plans keeps its permission keys', () => {
      const panel = read(PLANS_PANEL);
      expect(panel).toContain("'production-quality-plan:create'");
      expect(panel).toContain("'production-quality-plan:submit'");
      expect(panel).toContain("'production-quality-plan:approve'");
      expect(panel).toContain("'production-quality-plan:reject'");
      expect(panel).toContain("'production-quality-plan:deactivate'");
      expect(panel).toContain("'production-quality-plan:delete'");
    });
    it('inspections and ncrs keep their permission keys', () => {
      expect(read(INSPECTIONS_PANEL)).toContain("'production-inspection:create'");
      expect(read(INSPECTIONS_PANEL)).toContain("'production-inspection:complete'");
      expect(read(NCRS_PANEL)).toContain("'production-ncr:create'");
      expect(read(NCRS_PANEL)).toContain("'production-ncr:transition'");
    });
  });

  describe('F6. Arabic and English keys exist and stay synchronized', () => {
    it('both locales define the workspace title and description', () => {
      expect(read(EN_PROD)).toContain('qualityWorkspace:');
      expect(read(AR_PROD)).toContain('qualityWorkspace:');
      expect(read(EN_PROD)).toContain('qualityWorkspaceDescription:');
      expect(read(AR_PROD)).toContain('qualityWorkspaceDescription:');
    });
    it('the tab label keys resolve in both locales', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      expect(en).toContain('qualityPlans: {');
      expect(ar).toContain('qualityPlans: {');
      expect(en).toContain('inspections: {');
      expect(ar).toContain('inspections: {');
      expect(en).toContain('ncrs: {');
      expect(ar).toContain('ncrs: {');
    });
  });

  describe('F7. F9 hygiene', () => {
    it('panels never build index params and never hard-code cuids', () => {
      for (const panel of [read(PLANS_PANEL), read(INSPECTIONS_PANEL), read(NCRS_PANEL)]) {
        expect(panel).not.toMatch(/\?0=/);
        expect(panel).not.toMatch(/\?1=/);
        expect(panel).not.toMatch(/c[a-z0-9]{20,}/);
      }
    });
  });
});
