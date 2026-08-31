import * as fs from 'fs';
import * as path from 'path';

const base = path.resolve(__dirname, '..');
const read = (rel: string) =>
  fs.readFileSync(path.resolve(base, rel), 'utf8');

const FORM = 'src/app/admin/maintenance/machines/machine-form.tsx';
const EN = 'src/lib/i18n/locales/en/maintenance.ts';
const AR = 'src/lib/i18n/locales/ar/maintenance.ts';
const MACHINE_TYPES = 'src/lib/admin-types/maintenance.ts';
const SERVICE =
  '../../apps/api/src/modules/factory/maintenance/maintenance.service.ts';
const CC_DTO =
  '../../apps/api/src/modules/factory/maintenance/cost-centers/dto/create-cost-center.dto.ts';

describe('R2 machine dedicated cost-center type', () => {
  const form = read(FORM);

  describe('A. no universal PRODUCTION default', () => {
    it('create form no longer defaults the cost-center type to PRODUCTION', () => {
      expect(form).not.toContain("dedicatedCostCenterType: 'PRODUCTION'");
    });

    it('dedicatedCostCenterType starts empty so a classification is explicit', () => {
      expect(form).toContain("dedicatedCostCenterType: ''");
    });

    it('edit does not reset the stored type to PRODUCTION (rule 8)', () => {
      expect(form).not.toContain("dedicatedCostCenterType: 'PRODUCTION'");
      expect(form).toContain("dedicatedCostCenterType: machine.defaultCostCenter?.type || ''");
    });
  });

  describe('B. canonical OperationType mapping (rules 2-3)', () => {
    it('exposes a suggestion function defined only from OperationType', () => {
      expect(form).toContain('export function suggestCostCenterType');
      expect(form).toContain('OP_TYPE_TO_CC_TYPE');
    });

    it('maps each seeded operation type via the canonical map', () => {
      for (const [ot, cc] of [
        ['UTILITIES', 'UTILITIES'],
        ['MAINTENANCE', 'MAINTENANCE'],
        ['QUALITY', 'QUALITY'],
        ['PROJECT', 'PROJECT'],
        ['MANUFACTURING', 'PRODUCTION'],
        ['PREPARATION', 'PRODUCTION'],
        ['MIXING', 'PRODUCTION'],
        ['FILLING', 'PRODUCTION'],
        ['PACKAGING', 'PRODUCTION'],
      ]) {
        expect(form).toContain(`${ot}: '${cc}'`);
      }
    });

    it('the suggestion returns empty for an unmapped operation type and enforces explicit choice', () => {
      expect(form).toContain("return OP_TYPE_TO_CC_TYPE[operationTypeCode] || '';");
      expect(form).toContain('if (!operationTypeCode) return \'\';');
    });

    it('the OperationType field wires onItemSelect to the suggestion (rule 2)', () => {
      expect(form).toContain('onItemSelect={handleOperationTypeSelect}');
      expect(form).toContain('handleOperationTypeSelect');
      expect(form).toContain('suggestCostCenterType(ot.code)');
    });
  });

  describe('C. MachineCategory / Department / ProductionLine never determine the type (rules 5-7)', () => {
    it('the suggestion path only reads the operation type, not category/department/line', () => {
      const suggestionBlock = form.slice(form.indexOf('handleOperationTypeSelect'), form.indexOf('confirmDedicatedCostCenter'));
      expect(suggestionBlock).toContain('ot.code');
      expect(suggestionBlock).not.toContain('categoryId');
      expect(suggestionBlock).not.toContain('departmentId');
      expect(suggestionBlock).not.toContain('productionLineId');
    });
  });

  describe('D. explicit user confirmation (rules 3-4)', () => {
    it('resolves a type only when a valid classification is chosen', () => {
      expect(form).toContain('ccTypeResolved');
      expect(form).toContain('MACHINE_CC_TYPES.includes(form.dedicatedCostCenterType)');
    });

    it('confirm is disabled until a type is resolved', () => {
      expect(form).toContain('<Button onClick={confirmDedicatedCostCenter} disabled={!ccTypeResolved}>');
      expect(form).toContain('if (!ccTypeResolved) return;');
    });

    it('the suggested type is visible and editable in the modal (rule 4)', () => {
      expect(form).toContain('machineCostCenterTypeSuggested');
      expect(form).toContain('selectMachineCostCenterType');
      expect(form).toContain('dedicatedCostCenterType: e.target.value');
    });
  });

  describe('E. save gate requires a resolved type when creating the dedicated cost center', () => {
    it('machineFormFieldErrors requires a type for a staged cost center (rule 1)', () => {
      expect(form).toContain("!form.defaultCostCenterId && form.dedicatedCostCenterReady && !form.dedicatedCostCenterType");
      expect(form).toContain('machineCostCenterTypeRequired');
    });

    it('an existing linked cost center (no staged create) is not force-typed', () => {
      expect(form).toContain("form.dedicatedCostCenterReady && !form.dedicatedCostCenterType");
    });

    it('machineDedicatedCcPayload never sends an empty type to the backend', () => {
      expect(form).toContain('if (!form.dedicatedCostCenterType) return null;');
    });
  });

  describe('F. stored type is returned and loaded on edit (rule 8)', () => {
    it('backend includes the cost-center type in the machine default cost center', () => {
      const service = read(SERVICE);
      const count = (service.match(/defaultCostCenter: \{ select: \{ id: true, name: true, code: true, type: true \} \}/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('web Machine type exposes the default cost-center type', () => {
      const types = read(MACHINE_TYPES);
      expect(types).toContain('defaultCostCenter?: { id: string; name: string; code: string; type?: string };');
    });
  });

  describe('G. backend contract: type stays required master-data classification', () => {
    it('create cost-center DTO keeps type required against the fixed allow-list (rule 1/9)', () => {
      const dto = read(CC_DTO);
      expect(dto).toContain("@IsIn(COST_CENTER_TYPES)");
      expect(dto).toContain("const COST_CENTER_TYPES = ['PRODUCTION', 'MAINTENANCE', 'PROJECT', 'DEVELOPMENT', 'QUALITY', 'UTILITIES', 'ADMIN', 'OTHER']");
    });
  });

  describe('H. i18n keys present in English and Arabic', () => {
    const en = read(EN);
    const ar = read(AR);
    const keys = ['machineCostCenterTypeRequired', 'machineCostCenterTypeSuggested', 'selectMachineCostCenterType'];
    it('defines every R2 key in English', () => {
      for (const k of keys) expect(en).toContain(`${k}:`);
    });
    it('defines every R2 key in Arabic', () => {
      for (const k of keys) expect(ar).toContain(`${k}:`);
    });
  });

  describe('I. R5 contract preserved', () => {
    it('still builds the dedicated cost-center payload from the machine name + type', () => {
      expect(form).toContain('name: form.name.trim()');
      expect(form).toContain('type: form.dedicatedCostCenterType');
    });
  });
});
