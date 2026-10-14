import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const apiRoot = path.resolve(__dirname, '../../api');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.resolve(apiRoot, rel), 'utf8');

const PAGE = 'src/app/admin/maintenance/machine-components/page.tsx';
const SERVICE = 'src/modules/factory/maintenance/machine-components/machine-components.service.ts';
const CONTROLLER = 'src/modules/factory/maintenance/machine-components/machine-components.controller.ts';
const DTO = 'src/modules/factory/maintenance/machine-components/dto/create-machine-component.dto.ts';
const EN_MAINT = 'src/lib/i18n/locales/en/maintenance.ts';
const AR_MAINT = 'src/lib/i18n/locales/ar/maintenance.ts';

/**
 * Multi-machine component creation — one independent MachineComponent row per
 * selected machine. Mirrors the multi-scope machine-responsibility contract.
 */
describe('Machine components multi-machine creation', () => {
  describe('W1/W2. Multi-select Machines on create; single machine preserved on edit', () => {
    it('create uses F9MultiLookup with the machine adapter', () => {
      const page = read(PAGE);
      expect(page).toContain('<F9MultiLookup');
      expect(page).toContain('machineAdapter');
    });
    it('edit still uses the single-select F9Lookup', () => {
      const page = read(PAGE);
      expect(page).toContain('<F9Lookup');
      expect(page).toContain('form.machineId');
    });
  });

  describe('W3. Batch endpoint wiring', () => {
    it('create posts to the batch endpoint; edit patches the single record', () => {
      const page = read(PAGE);
      expect(page).toContain("api.post<{ createdCount: number }>('/maintenance/machine-components/batch'");
      expect(page).toContain('api.patch(`/maintenance/machine-components/${editItem.id}`');
      expect(page).not.toContain("api.post('/maintenance/machine-components',");
    });
  });

  describe('W4/W5. Selection counts and multiplicity state', () => {
    it('shows selected machines and components-to-create counts', () => {
      const page = read(PAGE);
      expect(page).toContain('maintenance.selectedMachines');
      expect(page).toContain('maintenance.componentsToCreate');
      expect(page).toContain('data-testid="selected-machines-count"');
      expect(page).toContain('data-testid="components-to-create-count"');
    });
    it('derives a multi-machine state for the create form', () => {
      expect(read(PAGE)).toContain('isMultiMachine');
    });
  });

  describe('W6. Confirmation is required before a multi-machine create', () => {
    it('opens a confirm dialog with the per-machine count message', () => {
      const page = read(PAGE);
      expect(page).toContain('confirmBatchOpen');
      expect(page).toContain('maintenance.batchCreateConfirm');
    });
  });

  describe('W7. Success/failure messaging reflects the created count', () => {
    it('reports the batch count and never a partial success', () => {
      const page = read(PAGE);
      expect(page).toContain('maintenance.batchCreateSuccess');
      expect(page).toContain('maintenance.batchCreateSuccessOne');
      expect(page).toContain('createdCount');
    });
  });

  describe('W8. Serial + parent are single-machine only in the UI', () => {
    it('disables serial and parent when more than one machine is selected', () => {
      const page = read(PAGE);
      expect(page).toContain('disabled={isMultiMachine}');
      expect(page).toContain('maintenance.serialNotSharedPerMachine');
      expect(page).toContain('maintenance.parentNotSharedPerMachine');
    });
    it('only sends serial/parent for a single machine', () => {
      const page = read(PAGE);
      expect(page).toContain('if (single && form.serialNumber)');
      expect(page).toContain('if (single && form.parentComponentId)');
    });
  });

  describe('W9. No raw identifiers or malformed F9 query params', () => {
    it('never builds ?0=/?1= index params', () => {
      const page = read(PAGE);
      expect(page).not.toMatch(/\?0=/);
      expect(page).not.toMatch(/\?1=/);
    });
    it('renders counts via state, never a hard-coded cuid literal', () => {
      const page = read(PAGE);
      expect(page).not.toMatch(/c[a-z0-9]{20,}/);
    });
  });

  describe('W10. Arabic and English keys exist and stay synchronized', () => {
    it('both locales define the multi-machine keys', () => {
      const keys = [
        'machinesLabel', 'selectedMachines', 'componentsToCreate', 'batchCreate',
        'batchCreateOnMultipleMachines', 'serialPerMachine', 'parentPerMachine',
        'batchCreateSuccess', 'batchCreateSuccessOne', 'batchCreateFailed',
        'noPartialRecordsCreated', 'batchCreateConfirm', 'serialNotSharedPerMachine',
        'parentNotSharedPerMachine', 'viewCreatedComponents',
      ];
      const en = read(EN_MAINT);
      const ar = read(AR_MAINT);
      for (const k of keys) {
        expect(en).toContain(`${k}:`);
        expect(ar).toContain(`${k}:`);
      }
    });
  });

  describe('W11. Permission-aware create action', () => {
    it('the page gates create with machine-component:create', () => {
      expect(read(PAGE)).toContain("'machine-component:create'");
    });
  });

  describe('W12. Backend: one row per machine, atomic, deduped, audited', () => {
    it('the service dedupes machine ids and runs one transaction', () => {
      const service = readApi(SERVICE);
      expect(service).toContain('new Set(');
      expect(service).toContain('$transaction');
    });
    it('the service creates one row per machine inside the loop', () => {
      const service = readApi(SERVICE);
      expect(service).toContain('for (const machine of ordered)');
      expect(service).toContain('machineId: machine.id');
    });
    it('the service audits each created component transactionally', () => {
      expect(readApi(SERVICE)).toContain('logWithClient');
    });
    it('serial/parent are rejected for multi-machine batches server-side', () => {
      const service = readApi(SERVICE);
      expect(service).toContain('maintenance.batchSerialPerMachineRequired');
      expect(service).toContain('maintenance.batchParentPerMachineRequired');
    });
  });

  describe('W13. Backend contract: route order, DTO, permissions', () => {
    it('the static batch route is declared before the :id routes', () => {
      const controller = readApi(CONTROLLER);
      const batchIdx = controller.indexOf("@Post('batch')");
      const idIdx = controller.indexOf("@Get(':id')");
      expect(batchIdx).toBeGreaterThan(-1);
      expect(idIdx).toBeGreaterThan(-1);
      expect(batchIdx).toBeLessThan(idIdx);
      expect(controller).toContain("@Permissions('machine-component:create')");
    });
    it('the batch DTO accepts an array of machine ids with per-element validation', () => {
      const dto = readApi(DTO);
      expect(dto).toContain('BatchCreateMachineComponentDto');
      expect(dto).toContain('@IsArray()');
      expect(dto).toContain('@ArrayNotEmpty()');
      expect(dto).toContain('@IsString({ each: true })');
      expect(dto).toContain('machineIds: string[]');
    });
  });
});
