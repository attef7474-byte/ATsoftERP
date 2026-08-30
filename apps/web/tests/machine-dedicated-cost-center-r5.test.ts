import * as fs from 'fs';
import * as path from 'path';

const base = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(base, rel), 'utf8');

const FORM = 'src/app/admin/maintenance/machines/machine-form.tsx';
const PAGE = 'src/app/admin/maintenance/machines/page.tsx';
const CREATE = 'src/app/admin/maintenance/machines/new/page.tsx';
const EDIT = 'src/app/admin/maintenance/machines/[id]/edit/page.tsx';
const EN = 'src/lib/i18n/locales/en/maintenance.ts';
const AR = 'src/lib/i18n/locales/ar/maintenance.ts';

describe('R5 machine dedicated cost center', () => {
  const form = read(FORM);

  describe('A. dedicated cost center draft state lives in the shared MachineForm', () => {
    it('exposes the staged cost center type/description/ready fields', () => {
      expect(form).toContain('dedicatedCostCenterType');
      expect(form).toContain('dedicatedCostCenterDescription');
      expect(form).toContain('dedicatedCostCenterReady');
    });

    it('create starts clean (not ready) and edit prefills ready=true when a default cost center exists', () => {
      expect(form).toContain('dedicatedCostCenterReady: false');
      expect(form).toContain('dedicatedCostCenterReady: Boolean(machine.defaultCostCenterId)');
    });
  });

  describe('B. nested modal + name auto-sync + machine-name-first gate', () => {
    it('renders a nested cost center Modal inside the shared form', () => {
      expect(form).toContain('createMachineCostCenter');
      expect(form).toContain('ccModalOpen');
    });

    it('enforces "enter the machine name first" before creating the cost center', () => {
      expect(form).toContain('enterMachineNameFirst');
      expect(form).toContain('disabled={!form.name.trim()}');
    });

    it('states that the cost center name matches the machine name', () => {
      expect(form).toContain('machineCostCenterNameAuto');
    });

    it('shows the staged/ready summary and a linked cost center label', () => {
      expect(form).toContain('machineCostCenterReady');
      expect(form).toContain('machineCostCenterLinked');
    });
  });

  describe('C. save gate is enforced by a single shared validator', () => {
    it('exports machineFormFieldErrors with the dedicated-cost-center gate', () => {
      expect(form).toContain('export function machineFormFieldErrors');
      expect(form).toContain('machineNeedCostCenter');
    });

    it('exports machineCostCenterSatisfied so save is blocked without a cost center', () => {
      expect(form).toContain('export function machineCostCenterSatisfied');
      expect(form).toContain('form.dedicatedCostCenterReady');
    });

    it('exports machineDedicatedCcPayload building name = machine name + type', () => {
      expect(form).toContain('export function machineDedicatedCcPayload');
      expect(form).toContain('name: form.name.trim()');
      expect(form).toContain('type: form.dedicatedCostCenterType');
    });
  });

  describe('D. operation type and department remain; technical admin/department are removed', () => {
    it('keeps operationTypeId and departmentId in the shared form', () => {
      expect(form).toContain('operationTypeId');
      expect(form).toContain('departmentId');
    });

    it('removes technicalAdministrationId and technicalDepartmentId from the shared form', () => {
      expect(form).not.toContain('technicalAdministrationId');
      expect(form).not.toContain('technicalDepartmentId');
    });
  });

  describe('E. list modal sends dedicatedCostCenter and drops removed fields', () => {
    const page = read(PAGE);

    it('maps the staged dedicatedCostCenter into the create payload', () => {
      expect(page).toContain('machineDedicatedCcPayload');
      expect(page).toContain('payload.dedicatedCostCenter = dedicatedCostCenter');
    });

    it('no longer sends defaultCostCenterId/technical fields on create', () => {
      expect(page).not.toContain('payload.defaultCostCenterId =');
      expect(page).not.toContain('payload.technicalAdministrationId =');
      expect(page).not.toContain('payload.technicalDepartmentId =');
    });

    it('uses the shared validator for the save gate', () => {
      expect(page).toContain('machineFormFieldErrors');
    });

    it('passes the linked cost center name to the shared form', () => {
      expect(page).toContain('existingCostCenterName={editRecord?.defaultCostCenter?.name}');
    });
  });

  describe('F. direct create route', () => {
    const page = read(CREATE);
    it('sends dedicatedCostCenter and drops removed fields', () => {
      expect(page).toContain('machineDedicatedCcPayload');
      expect(page).toContain('payload.dedicatedCostCenter = dedicatedCostCenter');
      expect(page).not.toContain('payload.technicalAdministrationId =');
      expect(page).not.toContain('payload.technicalDepartmentId =');
    });
    it('enforces the shared save gate on create', () => {
      expect(page).toContain('machineFormFieldErrors(form, t, \'create\')');
    });
  });

  describe('G. direct edit route preserves existing cost center, attaches only for legacy', () => {
    const page = read(EDIT);
    it('only sends dedicatedCostCenter for legacy machines without a cost center', () => {
      expect(page).toContain('!data?.defaultCostCenterId');
      expect(page).toContain('machineDedicatedCcPayload');
    });
    it('never reassigns or overwrites an existing cost center via a generic field', () => {
      expect(page).not.toContain('payload.defaultCostCenterId =');
      expect(page).not.toContain('payload.technicalAdministrationId =');
    });
    it('enforces the shared save gate on edit', () => {
      expect(page).toContain('machineFormFieldErrors(form, t, \'edit\'');
    });
    it('passes the linked cost center name to the shared form', () => {
      expect(page).toContain('existingCostCenterName={data.defaultCostCenter?.name}');
    });
  });

  describe('H. i18n keys are present in English and Arabic', () => {
    const en = read(EN);
    const ar = read(AR);
    const keys = ['machineNeedCostCenter', 'enterMachineNameFirst', 'createMachineCostCenter', 'machineCostCenterReady', 'machineCostCenterLinked', 'machineCostCenterNameAuto', 'removeMachineCostCenter'];
    it('defines every R5 key in English', () => {
      for (const k of keys) expect(en).toContain(`${k}:`);
    });
    it('defines every R5 key in Arabic', () => {
      for (const k of keys) expect(ar).toContain(`${k}:`);
    });
  });

  describe('I. backend atomic contract referenced by the UI', () => {
    it('create request is POST /maintenance/machines and update is PATCH', () => {
      const page = read(PAGE);
      expect(page).toContain("api.post('/maintenance/machines', payload)");
      expect(page).toContain('api.patch(`/maintenance/machines/${id}`, payload)');
    });
  });
});
