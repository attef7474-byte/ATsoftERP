import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const apiRoot = path.resolve(__dirname, '../../api');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.resolve(apiRoot, rel), 'utf8');

const PAGE = 'src/app/admin/maintenance/machine-components/page.tsx';
const DETAIL = 'src/app/admin/maintenance/machine-components/[id]/page.tsx';
const EDIT = 'src/app/admin/maintenance/machine-components/[id]/edit/page.tsx';
const TYPES = 'src/lib/admin-types/maintenance.ts';
const SERVICE = 'src/modules/factory/maintenance/machine-components/machine-components.service.ts';
const DTO = 'src/modules/factory/maintenance/machine-components/dto/create-machine-component.dto.ts';
const EN_MAINT = 'src/lib/i18n/locales/en/maintenance.ts';
const AR_MAINT = 'src/lib/i18n/locales/ar/maintenance.ts';

/**
 * Shared machine component: ONE logical row with N active machine associations.
 * The UI must edit the same record and never create one component per machine.
 */
describe('Machine components — one shared component, many machines', () => {
  describe('W1. Multi-select F9 on create AND edit', () => {
    it('uses F9MultiLookup with the machine adapter on the list/create page', () => {
      const page = read(PAGE);
      expect(page).toContain('<F9MultiLookup');
      expect(page).toContain('adapter={machineAdapter}');
    });
    it('uses F9MultiLookup on the dedicated edit page', () => {
      expect(read(EDIT)).toContain('<F9MultiLookup');
    });
  });

  describe('W2. Real API — POST create and PATCH the same record', () => {
    const page = read(PAGE);
    it('creates through the canonical single-component endpoint', () => {
      expect(page).toContain("api.post('/maintenance/machine-components'");
      expect(page).toContain('machineIds: form.machineIds');
    });
    it('patches the existing id on edit and never posts a second component', () => {
      expect(page).toContain('api.patch(`/maintenance/machine-components/${editItem.id}`');
      expect(page).not.toContain("api.post('/maintenance/machine-components/batch'");
    });
    it('the edit page patches the loaded id', () => {
      expect(read(EDIT)).toContain('api.patch(`/maintenance/machine-components/${id}`');
    });
  });

  describe('W3. Per-machine physical attributes', () => {
    const page = read(PAGE);
    it('renders location/serial inputs per selected machine', () => {
      expect(page).toContain('machineSpecificAttributes');
      expect(page).toContain('form.machineIds.map((machineId)');
      expect(page).toContain("handleMachineDataChange(machineId, 'locationInMachine'");
      expect(page).toContain("handleMachineDataChange(machineId, 'serialNumber'");
    });
    it('sends the machineData array, never a shared physical field', () => {
      expect(page).toContain('machineData,');
    });
  });

  describe('W4. One row per component in lists and details', () => {
    it('the list renders one grid row per component and shows all machine names', () => {
      const page = read(PAGE);
      expect(page).toContain("keyExtractor={(c: MachineComponent) => c.id}");
      expect(page).toContain('c.machines ?? c.machineLinks ?? []');
      expect(page).not.toContain('data-testid="components-to-create-count"');
    });
    it('the detail page renders an active machine-link table', () => {
      const detail = read(DETAIL);
      expect(detail).toContain('machineLinks');
      expect(detail).toContain('maintenance.machineSpecificAttributes');
    });
    it('the client type exposes ownership and active associations', () => {
      const types = read(TYPES);
      expect(types).toContain('machineLinks?:');
      expect(types).toContain('machines?:');
      expect(types).toContain('companyId?:');
    });
  });

  describe('W5. Confirmation, permission and no duplicate submission', () => {
    const page = read(PAGE);
    it('confirms a multi-machine create', () => {
      expect(page).toContain('confirmCreateOpen');
      expect(page).toContain('maintenance.sharedComponentCreateConfirmTitle');
      expect(page).toContain('sharedComponentCreateSuccess');
    });
    it('gates create/update with stable permission keys and disables save while saving', () => {
      expect(page).toContain("'machine-component:create'");
      expect(page).toContain("'machine-component:update'");
      expect(page).toContain('loading={saving}');
    });
  });

  describe('W6. No raw identifiers or malformed F9 query params', () => {
    const page = read(PAGE);
    it('never builds ?0=/?1= index params', () => {
      expect(page).not.toMatch(/\?0=/);
      expect(page).not.toMatch(/\?1=/);
    });
    it('renders counts via state, never a hard-coded cuid literal', () => {
      expect(page).not.toMatch(/c[a-z0-9]{20,}/);
    });
  });

  describe('W7. Arabic and English keys exist and stay synchronized', () => {
    it('both locales define the shared-component keys', () => {
      const keys = [
        'machinesLabel', 'selectedMachines', 'oneComponentManyMachinesHint',
        'machineSpecificAttributes', 'sharedComponentCreateSuccess',
        'sharedComponentCreateConfirmTitle', 'sharedComponentCreateConfirm',
        'parentSubsetHint', 'machineInactive', 'batchSerialPerMachineRequired',
        'parentMachineScopeMismatch', 'parentMachineRemovalBlocked',
      ];
      const en = read(EN_MAINT), ar = read(AR_MAINT);
      for (const k of keys) {
        expect(en).toContain(`${k}:`);
        expect(ar).toContain(`${k}:`);
      }
    });
  });

  describe('W8. Backend contract — one component + links, set-based edit', () => {
    const service = readApi(SERVICE);
    const dto = readApi(DTO);
    it('creates one component row and many link rows in a transaction', () => {
      expect(service).toContain('machineComponentMachine.createMany');
      expect(service).toContain('$transaction');
      expect(service).not.toContain('for (const machine of ordered)');
    });
    it('edits through toAdd/toKeep/toRemove and soft-unlinks removals', () => {
      expect(service).toContain('toAdd');
      expect(service).toContain('toKeep');
      expect(service).toContain('toRemove');
      expect(service).toContain("status: 'INACTIVE', unlinkedAt: now");
    });
    it('enforces the parent-machine-subset rule and code integrity', () => {
      expect(service).toContain('maintenance.parentMachineScopeMismatch');
      expect(service).toContain('maintenance.parentMachineRemovalBlocked');
      expect(service).toContain('validateCodeUnique');
    });
    it('the DTO exposes both the full set and the delta shape', () => {
      expect(dto).toContain('machineIds?: string[]');
      expect(dto).toContain('toAdd?: string[]');
      expect(dto).toContain('toKeep?: string[]');
      expect(dto).toContain('toRemove?: string[]');
      expect(dto).toContain('machineData?: MachineComponentMachineInputDto[]');
    });
  });
});
