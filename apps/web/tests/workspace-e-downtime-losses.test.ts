import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');

const HOST_PAGE = 'src/app/admin/production/downtime/page.tsx';
const LOSSES_REDIRECT = 'src/app/admin/production/losses/page.tsx';
const REASONS_REDIRECT = 'src/app/admin/production/loss-reasons/page.tsx';
const DOWNTIME_PANEL = 'src/components/factory/unified-production/downtime-panel.tsx';
const LOSSES_PANEL = 'src/components/factory/unified-production/losses-panel.tsx';
const REASONS_PANEL = 'src/components/factory/unified-production/loss-reasons-panel.tsx';
const EN_PROD = 'src/lib/i18n/locales/en/production.ts';
const AR_PROD = 'src/lib/i18n/locales/ar/production.ts';

/**
 * Workspace E — Downtime & Losses consolidation.
 *
 * Three related surfaces (Production Downtime segments, Loss quantity events,
 * Loss reasons master data) collapse into one canonical workspace hosted at
 * /admin/production/downtime with tabs, while the legacy /losses and
 * /loss-reasons routes become redirect stubs (never 404). Backend, endpoints,
 * permissions and data are unchanged.
 */
describe('Workspace E — Downtime & Losses consolidation', () => {
  describe('W1. Unified workspace and tabs', () => {
    it('renders one canonical workspace hosting the three panels', () => {
      const page = read(HOST_PAGE);
      expect(page).toContain("import { DowntimePanel }");
      expect(page).toContain("import { LossesPanel }");
      expect(page).toContain("import { LossReasonsPanel }");
      expect(page).toContain("{ id: 'downtime', label: t('production.downtime.title') }");
      expect(page).toContain("{ id: 'losses', label: t('production.losses.title') }");
      expect(page).toContain("{ id: 'loss-reasons', label: t('production.lossReasons.title') }");
      expect(page).toContain("'downtime' | 'losses' | 'loss-reasons'");
      expect(page).toContain('<TabPanel id="downtime"');
      expect(page).toContain('<TabPanel id="losses"');
      expect(page).toContain('<TabPanel id="loss-reasons"');
    });
    it('reads the ?tab= deep link', () => {
      expect(read(HOST_PAGE)).toContain("searchParams?.get('tab')");
    });
  });

  describe('W2. Legacy routes redirect (never 404)', () => {
    it('losses redirects to the losses tab', () => {
      const redirect = read(LOSSES_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/downtime?tab=losses')");
      expect(redirect).not.toContain('AdminDataGrid');
      expect(redirect).not.toContain('export function LossesPanel');
    });
    it('loss-reasons redirects to the loss-reasons tab', () => {
      const redirect = read(REASONS_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/downtime?tab=loss-reasons')");
      expect(redirect).not.toContain('AdminDataGrid');
      expect(redirect).not.toContain('export function LossReasonsPanel');
    });
  });

  describe('W3. One canonical panel per surface (no duplicate implementations)', () => {
    it('the panels export the canonical implementations', () => {
      expect(read(DOWNTIME_PANEL)).toContain('export function DowntimePanel');
      expect(read(LOSSES_PANEL)).toContain('export function LossesPanel');
      expect(read(REASONS_PANEL)).toContain('export function LossReasonsPanel');
    });
    it('the panels no longer render their own PageHeader (the workspace owns it)', () => {
      for (const panel of [read(DOWNTIME_PANEL), read(LOSSES_PANEL), read(REASONS_PANEL)]) {
        expect(panel).not.toContain('PageHeader');
      }
    });
  });

  describe('W4. Endpoints and lifecycle actions preserved', () => {
    it('downtime keeps its open/close/correct/cancel/link-maintenance transitions', () => {
      const panel = read(DOWNTIME_PANEL);
      expect(panel).toContain("api.post('/production/downtime'");
      expect(panel).toContain('/close`');
      expect(panel).toContain('/correct`');
      expect(panel).toContain('/cancel`');
      expect(panel).toContain('/link-maintenance`');
    });
    it('losses keeps record and correct', () => {
      const panel = read(LOSSES_PANEL);
      expect(panel).toContain("api.post('/production/loss-quantity-events'");
      expect(panel).toContain('/correct`');
    });
    it('loss reasons keeps CRUD + activate/deactivate/delete', () => {
      const panel = read(REASONS_PANEL);
      expect(panel).toContain("api.post('/production/loss-reasons'");
      expect(panel).toContain('${selectedId}/${action}`');
      expect(panel).toContain("setStatusAction('activate')");
      expect(panel).toContain("setStatusAction('deactivate')");
      expect(panel).toContain('api.delete(`/production/loss-reasons/');
    });
  });

  describe('W5. Permission gating preserved', () => {
    it('each panel keeps the same permission keys as before', () => {
      expect(read(DOWNTIME_PANEL)).toContain("'production-downtime:record'");
      expect(read(DOWNTIME_PANEL)).toContain("'production-downtime:close'");
      expect(read(DOWNTIME_PANEL)).toContain("'production-downtime:correct'");
      expect(read(DOWNTIME_PANEL)).toContain("'production-downtime:link-maintenance'");
      expect(read(LOSSES_PANEL)).toContain("'production-loss:record'");
      expect(read(LOSSES_PANEL)).toContain("'production-loss:correct'");
      expect(read(REASONS_PANEL)).toContain("'production-loss-reason:create'");
      expect(read(REASONS_PANEL)).toContain("'production-loss-reason:activate'");
      expect(read(REASONS_PANEL)).toContain("'production-loss-reason:deactivate'");
      expect(read(REASONS_PANEL)).toContain("'production-loss-reason:delete'");
    });
  });

  describe('W6. Arabic and English keys exist and stay synchronized', () => {
    it('both locales define the workspace title and description', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      expect(en).toContain('downtimeLossesWorkspace:');
      expect(ar).toContain('downtimeLossesWorkspace:');
      expect(en).toContain('downtimeLossesWorkspaceDescription:');
      expect(ar).toContain('downtimeLossesWorkspaceDescription:');
    });
    it('the tab label keys resolve in both locales', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      // tab labels reuse the existing surface titles
      expect(en).toContain('lossReasons: {');
      expect(ar).toContain('lossReasons: {');
      expect(en).toContain('downtime: {');
      expect(ar).toContain('downtime: {');
      expect(en).toContain('losses: {');
      expect(ar).toContain('losses: {');
    });
    it('the material documents workspace title is defined (regression: was missing)', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      expect(en).toContain('materialDocumentsWorkspace:');
      expect(ar).toContain('materialDocumentsWorkspace:');
      expect(en).toContain('materialDocumentsWorkspaceDescription:');
      expect(ar).toContain('materialDocumentsWorkspaceDescription:');
    });
  });

  describe('W7. F9 hygiene', () => {
    it('panels never build index params and never hard-code cuids', () => {
      for (const panel of [read(DOWNTIME_PANEL), read(LOSSES_PANEL), read(REASONS_PANEL)]) {
        expect(panel).not.toMatch(/\?0=/);
        expect(panel).not.toMatch(/\?1=/);
        expect(panel).not.toMatch(/c[a-z0-9]{20,}/);
      }
    });
  });
});
