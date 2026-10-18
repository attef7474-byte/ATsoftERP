import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');

const HOST_PAGE = 'src/app/admin/production/cost/rates/page.tsx';
const SNAPSHOTS_REDIRECT = 'src/app/admin/production/cost/snapshots/page.tsx';
const TRANSACTIONS_REDIRECT = 'src/app/admin/production/cost/transactions/page.tsx';
const OVERHEAD_REDIRECT = 'src/app/admin/production/cost/overhead-allocations/page.tsx';
const RATES_PANEL = 'src/components/factory/unified-production/cost-rates-panel.tsx';
const SNAPSHOTS_PANEL = 'src/components/factory/unified-production/cost-snapshots-panel.tsx';
const TRANSACTIONS_PANEL = 'src/components/factory/unified-production/cost-transactions-panel.tsx';
const OVERHEAD_PANEL = 'src/components/factory/unified-production/overhead-allocations-panel.tsx';
const EN_PROD = 'src/lib/i18n/locales/en/production.ts';
const AR_PROD = 'src/lib/i18n/locales/ar/production.ts';

/**
 * Workspace G — Production Costing consolidation.
 *
 * Four related costing surfaces (Cost Rates master data, Cost Snapshots,
 * Cost Transactions, Overhead Allocations) collapse into one canonical workspace
 * hosted at /admin/production/cost/rates with tabs, while the legacy
 * /cost/snapshots, /cost/transactions and /cost/overhead-allocations routes
 * become redirect stubs (never 404). Backend, endpoints, permissions and data
 * are unchanged.
 */
describe('Workspace G — Production Costing consolidation', () => {
  describe('G1. Unified workspace and tabs', () => {
    it('renders one canonical workspace hosting the four panels', () => {
      const page = read(HOST_PAGE);
      expect(page).toContain('import { CostRatesPanel }');
      expect(page).toContain('import { CostSnapshotsPanel }');
      expect(page).toContain('import { CostTransactionsPanel }');
      expect(page).toContain('import { OverheadAllocationsPanel }');
      expect(page).toContain("{ id: 'rates', label: t('production.costRates.title') }");
      expect(page).toContain("{ id: 'snapshots', label: t('production.costSnapshots.title') }");
      expect(page).toContain("{ id: 'transactions', label: t('production.costTransactions.title') }");
      expect(page).toContain("{ id: 'overhead-allocations', label: t('overheadAllocation.title') }");
      expect(page).toContain("'rates' | 'snapshots' | 'transactions' | 'overhead-allocations'");
      expect(page).toContain('<TabPanel id="rates"');
      expect(page).toContain('<TabPanel id="snapshots"');
      expect(page).toContain('<TabPanel id="transactions"');
      expect(page).toContain('<TabPanel id="overhead-allocations"');
    });
    it('reads the ?tab= deep link', () => {
      expect(read(HOST_PAGE)).toContain("searchParams?.get('tab')");
    });
  });

  describe('G2. Legacy routes redirect (never 404)', () => {
    it('snapshots redirects to the snapshots tab', () => {
      const redirect = read(SNAPSHOTS_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/cost/rates?tab=snapshots')");
      expect(redirect).not.toContain('AdminDataGrid');
      expect(redirect).not.toContain('export function');
    });
    it('transactions redirects to the transactions tab', () => {
      const redirect = read(TRANSACTIONS_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/cost/rates?tab=transactions')");
      expect(redirect).not.toContain('AdminDataGrid');
      expect(redirect).not.toContain('export function');
    });
    it('overhead-allocations redirects to the overhead-allocations tab', () => {
      const redirect = read(OVERHEAD_REDIRECT);
      expect(redirect).toContain("router.replace('/admin/production/cost/rates?tab=overhead-allocations')");
      expect(redirect).not.toContain('AdminDataGrid');
      expect(redirect).not.toContain('export function');
    });
  });

  describe('G3. One canonical panel per surface (no duplicate implementations)', () => {
    it('the panels export the canonical implementations', () => {
      expect(read(RATES_PANEL)).toContain('export function CostRatesPanel');
      expect(read(SNAPSHOTS_PANEL)).toContain('export function CostSnapshotsPanel');
      expect(read(TRANSACTIONS_PANEL)).toContain('export function CostTransactionsPanel');
      expect(read(OVERHEAD_PANEL)).toContain('export function OverheadAllocationsPanel');
    });
    it('the panels no longer render their own PageHeader (the workspace owns it)', () => {
      for (const panel of [read(RATES_PANEL), read(SNAPSHOTS_PANEL), read(TRANSACTIONS_PANEL), read(OVERHEAD_PANEL)]) {
        expect(panel).not.toContain('PageHeader');
      }
    });
  });

  describe('G4. Endpoints and lifecycle actions preserved', () => {
    it('cost rates keeps CRUD', () => {
      const panel = read(RATES_PANEL);
      expect(panel).toContain("api.post('/production/cost-rates'");
      expect(panel).toContain('await api.patch(`/production/cost-rates/${editItem.id}`');
      expect(panel).toContain('await api.delete(`/production/cost-rates/${selectedId}`');
    });
    it('cost snapshots keeps freeze and supersede', () => {
      const panel = read(SNAPSHOTS_PANEL);
      expect(panel).toContain("api.post('/production/cost-snapshots'");
      expect(panel).toContain('/freeze`');
      expect(panel).toContain('/supersede`');
    });
    it('cost transactions keeps reverse', () => {
      const panel = read(TRANSACTIONS_PANEL);
      expect(panel).toContain("api.post('/production/cost-transactions'");
      expect(panel).toContain('/reverse`');
    });
    it('overhead allocations keeps create/calculate/finalize', () => {
      const panel = read(OVERHEAD_PANEL);
      expect(panel).toContain("const ROOT = '/production/overhead-allocations'");
      expect(panel).toContain('api.post<OverheadAllocation>(ROOT');
      expect(panel).toContain('/calculate`');
      expect(panel).toContain('/finalize`');
    });
  });

  describe('G5. Permission gating preserved', () => {
    it('cost rates keeps its permission keys', () => {
      const panel = read(RATES_PANEL);
      expect(panel).toContain("'production-cost-rate:create'");
      expect(panel).toContain("'production-cost-rate:update'");
      expect(panel).toContain("'production-cost-rate:delete'");
    });
    it('cost snapshots keeps its permission keys', () => {
      const panel = read(SNAPSHOTS_PANEL);
      expect(panel).toContain("'production-cost-snapshot:create'");
      expect(panel).toContain("'production-cost-snapshot:update'");
      expect(panel).toContain("'production-cost-snapshot:freeze'");
      expect(panel).toContain("'production-cost-snapshot:supersede'");
    });
    it('cost transactions keeps its permission keys', () => {
      const panel = read(TRANSACTIONS_PANEL);
      expect(panel).toContain("'production-cost-transaction:post'");
      expect(panel).toContain("'production-cost-transaction:reverse'");
    });
    it('overhead allocations keeps its permission checks', () => {
      const panel = read(OVERHEAD_PANEL);
      expect(panel).toContain("can('read')");
      expect(panel).toContain("can('create')");
      expect(panel).toContain("can('calculate')");
      expect(panel).toContain("can('finalize')");
      expect(panel).toContain("can('post')");
      expect(panel).toContain("can('reconcile')");
    });
  });

  describe('G6. Arabic and English keys exist and stay synchronized', () => {
    it('both locales define the workspace title and description', () => {
      expect(read(EN_PROD)).toContain('costWorkspace:');
      expect(read(AR_PROD)).toContain('costWorkspace:');
      expect(read(EN_PROD)).toContain('costWorkspaceDescription:');
      expect(read(AR_PROD)).toContain('costWorkspaceDescription:');
    });
    it('the tab label keys resolve in both locales', () => {
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      expect(en).toContain('costRates: {');
      expect(ar).toContain('costRates: {');
      expect(en).toContain('costSnapshots: {');
      expect(ar).toContain('costSnapshots: {');
      expect(en).toContain('costTransactions: {');
      expect(ar).toContain('costTransactions: {');
    });
  });

  describe('G7. F9 hygiene', () => {
    it('panels never build index params and never hard-code cuids', () => {
      for (const panel of [read(RATES_PANEL), read(SNAPSHOTS_PANEL), read(TRANSACTIONS_PANEL), read(OVERHEAD_PANEL)]) {
        expect(panel).not.toMatch(/\?0=/);
        expect(panel).not.toMatch(/\?1=/);
        expect(panel).not.toMatch(/c[a-z0-9]{20,}/);
      }
    });
  });
});
