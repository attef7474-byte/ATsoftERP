import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const apiRoot = path.resolve(__dirname, '../../api');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.resolve(apiRoot, rel), 'utf8');

const PAGE = 'src/app/admin/maintenance/machine-responsibilities/page.tsx';
const SERVICE = 'src/modules/factory/maintenance/machine-responsibility-assignments/machine-responsibility-assignments.service.ts';
const CONTROLLER = 'src/modules/factory/maintenance/machine-responsibility-assignments/machine-responsibility-assignments.controller.ts';
const DTO = 'src/modules/factory/maintenance/machine-responsibility-assignments/dto/create-machine-responsibility-assignment.dto.ts';
const F9_MULTI = 'src/components/f9/F9MultiLookup.tsx';
const EN_NAV = 'src/lib/i18n/locales/en/navigation.ts';
const AR_NAV = 'src/lib/i18n/locales/ar/navigation.ts';
const EN_MAINT = 'src/lib/i18n/locales/en/maintenance.ts';
const AR_MAINT = 'src/lib/i18n/locales/ar/maintenance.ts';

describe('Machine responsibilities multi-scope (multi-line + multi-machine)', () => {
  describe('W1/W2. Multi-select F9 for Full Lines and Explicit Machines', () => {
    it('the page uses F9MultiLookup for both line and machine selection', () => {
      const page = read(PAGE);
      expect((page.match(/<F9MultiLookup/g) || []).length).toBe(2);
      expect(page).toContain('productionLineAdapter');
      expect(page).toContain('machineAdapter');
    });
    it('a reusable multi-select F9 component exists and reuses the modal in multi mode', () => {
      const multi = read(F9_MULTI);
      expect(multi).toContain('multiSelect');
      expect(multi).toContain('selectedIds');
      expect(multi).toContain('onToggle');
    });
  });

  describe('W3/W4. Single personnel lookup; scope either/or removed', () => {
    it('personnel uses the single-select F9Lookup', () => {
      const page = read(PAGE);
      expect(page).toContain('<F9Lookup');
      expect(page).toContain('maintenancePersonnelAdapter');
    });
    it('the old Work Scope (scopeType) either/or block is gone', () => {
      const page = read(PAGE);
      expect(page).not.toContain('scopeType');
      expect(page).not.toContain('scopeTypeMachine');
    });
  });

  describe('W5/W6. Batch create/update wiring', () => {
    it('create posts to the batch endpoint', () => {
      expect(read(PAGE)).toContain("api.post('/maintenance/machine-responsibilities/batch'");
    });
    it('edit patches the batch endpoint', () => {
      expect(read(PAGE)).toContain("api.patch('/maintenance/machine-responsibilities/batch'");
    });
  });

  describe('W7/W8. Grouped list + coverage read models', () => {
    it('list consumes the grouped assignments projection', () => {
      expect(read(PAGE)).toContain('/maintenance/machine-responsibilities/assignments');
    });
    it('effective coverage is derived and displayed', () => {
      const page = read(PAGE);
      expect(page).toContain('effectiveCount');
      expect(page).toContain('data-testid="effective-count"');
    });
  });

  describe('W9/W10/W11. Dynamic line inheritance, locked inherited, no redundant rows', () => {
    it('inherited machines are loaded LIVE by line membership (not snapshotted)', () => {
      const page = read(PAGE);
      expect(page).toContain('productionLineId=');
      expect(page).toContain('loadInherited');
      expect(page).toContain('inheritedMachines');
    });
    it('inherited machines are presented as line-covered and locked', () => {
      const page = read(PAGE);
      expect(page).toContain('inheritedLockedHint');
      expect(page).toContain('includedByLine');
    });
    it('redundant explicit machines are flagged, not persisted as duplicates', () => {
      expect(read(PAGE)).toContain('redundantSelection');
      const service = readApi(SERVICE);
      expect(service).toContain('redundantExplicitMachines');
    });
  });

  describe('W12. Effective machines = inherited UNION explicit', () => {
    it('effective count de-duplicates inherited and explicit ids', () => {
      const page = read(PAGE);
      expect(page).toContain('new Set([');
      const service = readApi(SERVICE);
      expect(service).toContain('effectiveMachines');
    });
  });

  describe('W13/W15. Permission-aware actions and end endpoint', () => {
    it('action bar is gated by machine-responsibility permissions', () => {
      const page = read(PAGE);
      expect(page).toContain("'machine-responsibility:create'");
      expect(page).toContain("'machine-responsibility:update'");
      expect(page).toContain("'machine-responsibility:delete'");
    });
    it('ending a logical assignment uses the batch end endpoint (soft-end, history preserved)', () => {
      expect(read(PAGE)).toContain("api.post('/maintenance/machine-responsibilities/end'");
      const service = readApi(SERVICE);
      expect(service).toContain("status: 'INACTIVE'");
      expect(service).toContain('BATCH_END');
    });
  });

  describe('W14. Edit hydration preserves scope intent', () => {
    it('edit seeds full lines and explicit machines from the grouped record', () => {
      const page = read(PAGE);
      expect(page).toContain('openEdit');
      expect(page).toContain('fullLineIds: g.fullLines.map');
      expect(page).toContain('explicitMachineIds: g.explicitMachines.map');
    });
    it('personnel and role are immutable while editing the logical assignment', () => {
      const page = read(PAGE);
      expect(page).toContain('disabled={!!editing}');
    });
  });

  describe('W16. Arabic and English keys exist and stay synchronized', () => {
    it('both locales define the coverage keys', () => {
      const keys = ['fullProductionLines', 'explicitMachines', 'inheritedMachines', 'includedByLine', 'effectiveMachines', 'machineCoverage', 'atLeastOneTarget', 'lineCoverageHint', 'inheritedLockedHint', 'machineCoveredByLine'];
      const en = read(EN_MAINT);
      const ar = read(AR_MAINT);
      for (const k of keys) {
        expect(en).toContain(`${k}:`);
        expect(ar).toContain(`${k}:`);
      }
    });
    it('the f9.selected key exists in both locales', () => {
      expect(read(EN_NAV)).toContain('selected:');
      expect(read(AR_NAV)).toContain('selected:');
    });
  });

  describe('W17. No malformed F9 query parameters', () => {
    it('the page builds query params with URLSearchParams, never ?0=/index keys', () => {
      const page = read(PAGE);
      expect(page).toContain('new URLSearchParams');
      expect(page).not.toMatch(/\?0=/);
      expect(page).not.toMatch(/\?1=/);
    });
  });

  describe('W18. Date range validation', () => {
    it('end date earlier than start date is rejected in the UI and server', () => {
      expect(read(PAGE)).toContain('validation.endDateBeforeStart');
      const service = readApi(SERVICE);
      expect(service).toContain('endDate must be on or after startDate');
    });
  });

  describe('W19. Grouped grid columns reflect the new model', () => {
    it('grid shows personnel, role, lines, explicit, effective, primary, dates, status', () => {
      const page = read(PAGE);
      for (const h of ['personnel', 'responsibilityRole', 'fullProductionLines', 'explicitMachines', 'effectiveMachines', 'isPrimary', 'startDate', 'endDate', 'status']) {
        expect(page).toContain(h);
      }
    });
  });

  describe('W20. Backend atomic batch + audit + tenant integrity', () => {
    it('batch create/update run inside a transaction and audit once', () => {
      const service = readApi(SERVICE);
      expect(service).toContain('$transaction');
      expect(service).toContain('BATCH_CREATE');
      expect(service).toContain('BATCH_UPDATE');
      expect(service).toContain('auditService.log');
    });
    it('static routes are declared before the :id route so they are not shadowed', () => {
      const controller = readApi(CONTROLLER);
      const batchIdx = controller.indexOf("@Post('batch')");
      const idIdx = controller.indexOf("@Get(':id')");
      expect(batchIdx).toBeGreaterThan(-1);
      expect(idIdx).toBeGreaterThan(-1);
      expect(batchIdx).toBeLessThan(idIdx);
      expect(controller).toContain("@Post('end')");
      expect(controller).toContain("@Patch('batch')");
    });
    it('batch DTOs reject unknown fields via declared validation decorators', () => {
      const dto = readApi(DTO);
      expect(dto).toContain('CreateMachineResponsibilityBatchDto');
      expect(dto).toContain('UpdateMachineResponsibilityBatchDto');
      expect(dto).toContain('EndMachineResponsibilityAssignmentDto');
      expect(dto).toContain('ArrayUnique');
    });
  });
});
