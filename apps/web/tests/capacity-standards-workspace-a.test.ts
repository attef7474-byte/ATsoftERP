import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const apiRoot = path.resolve(__dirname, '../../api');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.resolve(apiRoot, rel), 'utf8');

const WORKSPACE_PAGE = 'src/app/admin/production/product-definitions/page.tsx';
const LEGACY_PAGE = 'src/app/admin/production/capacity-standards/page.tsx';
const PANEL = 'src/components/factory/unified-production/capacity-standards-panel.tsx';
const MULTI_LOOKUP = 'src/components/f9/F9MultiLookup.tsx';
const EN_PROD = 'src/lib/i18n/locales/en/production.ts';
const AR_PROD = 'src/lib/i18n/locales/ar/production.ts';

const API_SERVICE = 'src/modules/factory/production-capacity-standards/production-capacity-standards.service.ts';
const API_CONTROLLER = 'src/modules/factory/production-capacity-standards/production-capacity-standards.controller.ts';
const API_DTO = 'src/modules/factory/production-capacity-standards/dto/create-production-capacity-standard.dto.ts';

/**
 * Workspace A — Products & Production Setup: Capacity Standards slice.
 *
 * Capacity standards are consolidated into the Products workspace as a tab (one canonical
 * panel, no duplicate standalone implementation). The multi-select batch create produces one
 * atomic DRAFT row per target with optional per-target overrides. Edit stays single-record.
 */
describe('Capacity Standards — Workspace A consolidation + batch', () => {
  describe('W1. Capacity Standards tab loads under Workspace A (not Workspace B)', () => {
    it('the product-definitions workspace page renders the canonical tab and panel', () => {
      const page = read(WORKSPACE_PAGE);
      expect(page).toContain("import { CapacityStandardsPanel }");
      expect(page).toContain("{ id: 'capacity-standards', label: t('production.capacityStandards') }");
      expect(page).toContain('<TabPanel id="capacity-standards" activeId={tab}>');
      expect(page).toContain('<CapacityStandardsPanel />');
      expect(page).toContain("'product-definitions' | 'units' | 'capacity-standards'");
    });
    it('does not add Capacity Standards as a seventh tab in the shifts workspace', () => {
      const shifts = read('src/app/admin/production/shifts/page.tsx');
      expect(shifts).not.toContain('capacity');
      expect(shifts).not.toContain('Capacity');
    });
  });

  describe('W2. Legacy /capacity-standards route redirects (never 404)', () => {
    it('the legacy page is a compatibility redirect to the Workspace A tab', () => {
      const legacy = read(LEGACY_PAGE);
      expect(legacy).toContain("router.replace('/admin/production/product-definitions?tab=capacity-standards')");
      expect(legacy).not.toContain('AdminDataGrid');
    });
  });

  describe('W3. One canonical panel (no duplicate standalone form)', () => {
    it('the legacy page no longer holds the full implementation', () => {
      const legacy = read(LEGACY_PAGE);
      expect(legacy).not.toContain('export function CapacityStandardsPanel');
      expect(legacy).not.toContain("api.post('/production/capacity-standards'");
    });
    it('the panel is the single canonical implementation', () => {
      expect(read(PANEL)).toContain('export function CapacityStandardsPanel');
    });
  });

  describe('W4. Multi-target F9 selection', () => {
    it('uses F9MultiLookup for machines and lines scoped by context', () => {
      const panel = read(PANEL);
      expect(panel).toContain('<F9MultiLookup');
      expect(panel).toContain('machineAdapter');
      expect(panel).toContain('productionLineAdapter');
      expect(panel).toContain('productionProductDefinitionAdapter');
      expect(panel).toContain('filters={batchLineId ? { productionLineId: batchLineId } : undefined}');
    });
    it('F9MultiLookup supports removing a selected target', () => {
      const multi = read(MULTI_LOOKUP);
      expect(multi).toContain('const remove = (id: string) => onChange(value.filter((v) => v !== id));');
    });
    it('F9MultiLookup reports resolved labels for per-target override rows', () => {
      expect(read(MULTI_LOOKUP)).toContain('onItemsChange?: (items: MultiLookupItem[]) => void');
    });
  });

  describe('W5. Selected count and confirmation count are derived from state', () => {
    it('shows the live selected-target count and the pre-save confirmation count', () => {
      const panel = read(PANEL);
      expect(panel).toContain("t('production.capacityBatchTargetsHint', undefined, { count: batchTargetIds.length })");
      expect(panel).toContain("t('production.capacityBatchConfirmCount', undefined, { count: batchTargetIds.length })");
    });
  });

  describe('W6. Shared defaults + per-target overrides', () => {
    it('shared defaults are part of the batch form', () => {
      const panel = read(PANEL);
      expect(panel).toContain('standardRate');
      expect(panel).toContain('targetEfficiencyPercent');
      expect(panel).toContain('expectedYieldPercent');
      expect(panel).toContain('changeoverMinutes');
    });
    it('per-target override UI exists and is wired to the target id', () => {
      const panel = read(PANEL);
      expect(panel).toContain("t('production.capacityPerTargetOverrides')");
      expect(panel).toContain('setOverride(item.id');
      expect(panel).toContain('batchOverrides');
    });
    it('overrides are only sent for currently selected targets', () => {
      expect(read(PANEL)).toContain('.filter(([id]) => batchTargetIds.includes(id))');
    });
  });

  describe('W7. Batch wiring and no partial-success UX', () => {
    it('posts once to the atomic batch endpoint and reports the created count', () => {
      const panel = read(PANEL);
      expect(panel).toContain("api.post('/production/capacity-standards/batch'");
      expect(panel).toContain("t('production.capacityBatchCreated', undefined, { count: batchTargetIds.length })");
    });
    it('the batch payload sends one scope and the matching target list (no targetIds stored on a row)', () => {
      const panel = read(PANEL);
      expect(panel).toContain("...(batchScope === 'LINE' ? { lineIds: batchTargetIds } : { productionLineId: batchLineId, machineIds: batchTargetIds })");
    });
    it('there is no per-row partial success handling client-side', () => {
      expect(read(PANEL)).not.toContain('partial');
    });
  });

  describe('W8. Edit stays single-record', () => {
    it('edit loads and patches exactly one record', () => {
      const panel = read(PANEL);
      expect(panel).toContain('api.get<ProductionCapacityStandard>(`/production/capacity-standards/${id}`)');
      expect(panel).toContain('api.patch(`/production/capacity-standards/${editItem.id}`');
    });
  });

  describe('W9. Lifecycle actions preserved', () => {
    it('keeps approve/revise/suspend/reactivate/archive transitions', () => {
      const panel = read(PANEL);
      for (const action of ['approve', 'revise', 'suspend', 'reactivate', 'archive']) {
        expect(panel).toContain(`action: '${action}'`);
      }
      expect(panel).toContain("api.post(`/production/capacity-standards/${transition.id}/${transition.action}`");
    });
  });

  describe('W10. Permission-aware create + F9 hygiene', () => {
    it('gates creation behind production-capacity-standard:create', () => {
      expect(read(PANEL)).toContain('production-capacity-standard:');
      expect(read(PANEL)).toContain("can('create')");
    });
    it('never builds ?0=/?1= index params and never hard-codes cuids', () => {
      const panel = read(PANEL);
      expect(panel).not.toMatch(/\?0=/);
      expect(panel).not.toMatch(/\?1=/);
      expect(panel).not.toMatch(/c[a-z0-9]{20,}/);
    });
  });

  describe('W11. Arabic and English keys exist and stay synchronized', () => {
    it('both locales define the batch keys', () => {
      const keys = [
        'capacityAddMultiple', 'capacityBatchHint', 'capacityBatchScope', 'capacityBatchScopeMachine',
        'capacityBatchScopeLine', 'capacityBatchMachines', 'capacityBatchLines', 'capacityBatchTargetsHint',
        'capacityBatchTargetsRequired', 'capacityBatchConfirmCount', 'capacityBatchCreated',
        'capacityPerTargetOverrides', 'capacityTarget',
      ];
      const en = read(EN_PROD);
      const ar = read(AR_PROD);
      for (const k of keys) {
        expect(en).toContain(`${k}:`);
        expect(ar).toContain(`${k}:`);
      }
    });
  });

  describe('W12. Backend: atomic, one row per target, deduped, per-row audit', () => {
    it('creates one row per resolved target inside a single Serializable transaction', () => {
      const service = readApi(API_SERVICE);
      expect(service).toContain('async createBatch(');
      expect(service).toContain('Prisma.TransactionIsolationLevel.Serializable');
      expect(service).toContain('for (const data of normalized)');
      expect(service).toContain('generateNumberAtomicWithClient');
    });
    it('dedupes target ids and validates every target before any write', () => {
      const service = readApi(API_SERVICE);
      expect(service).toContain('Array.from(new Set(');
      expect(service).toContain('normalized.push(await this.normalizeAndValidate(perTarget, ctx, tx))');
    });
    it('audits each created row transactionally with a batch flag', () => {
      const service = readApi(API_SERVICE);
      expect(service).toContain('logWithClient(tx');
      expect(service).toContain('batch: true');
    });
    it('never auto-approves and keeps the canonical initial DRAFT state', () => {
      const service = readApi(API_SERVICE);
      const start = service.indexOf('async createBatch(');
      const end = service.indexOf('private resolveBatchTargets');
      const batchBody = service.slice(start, end);
      expect(batchBody).toContain("status: 'DRAFT'");
      expect(batchBody).not.toContain("status: 'APPROVED'");
      expect(batchBody).not.toContain('.approve(');
    });
  });

  describe('W13. Backend contract: route order, DTO, permissions', () => {
    it('the static batch route is declared before :id routes with create permission', () => {
      const controller = readApi(API_CONTROLLER);
      const batchIdx = controller.indexOf("@Post('batch')");
      const idIdx = controller.indexOf("@Get(':id')");
      expect(batchIdx).toBeGreaterThan(-1);
      expect(idIdx).toBeGreaterThan(-1);
      expect(batchIdx).toBeLessThan(idIdx);
      expect(controller).toContain("@Permissions('production-capacity-standard:create')");
    });
    it('the batch DTO validates scope, target arrays and per-target overrides', () => {
      const dto = readApi(API_DTO);
      expect(dto).toContain('BatchCreateCapacityStandardsDto');
      expect(dto).toContain('CapacityBatchTargetOverrideDto');
      expect(dto).toContain("@IsIn(['LINE', 'MACHINE'])");
      expect(dto).toContain('machineIds?: string[]');
      expect(dto).toContain('lineIds?: string[]');
      expect(dto).toContain('@ValidateNested({ each: true })');
    });
  });
});
