import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');

const PAGE = 'src/app/admin/maintenance/machines/page.tsx';
const FORM = 'src/app/admin/maintenance/machines/machine-form.tsx';
const CREATE_ROUTE = 'src/app/admin/maintenance/machines/new/page.tsx';
const EDIT_ROUTE = 'src/app/admin/maintenance/machines/[id]/edit/page.tsx';

describe('Machine create/edit modal unification', () => {
  describe('A. shared MachineForm exists and is used by the list modal', () => {
    it('the machines list imports and renders MachineForm', () => {
      const page = read(PAGE);
      expect(page).toContain("from './machine-form'");
      expect(page).toContain('<MachineForm');
    });

    it('the shared form contains the full editable field set (no duplicated raw forms)', () => {
      const form = read(FORM);
      const fields = ['name', 'categoryId', 'companyId', 'branchId', 'departmentId', 'productionLineId', 'operationTypeId', 'defaultCostCenterId', 'technicalAdministrationId', 'technicalDepartmentId', 'model', 'serialNumber', 'manufacturer', 'location', 'notes'];
      for (const f of fields) expect(form).toContain(f);
    });

    it('the list page no longer inlines a duplicate create/edit form JSX', () => {
      const page = read(PAGE);
      const f9Count = (page.match(/F9Lookup/g) || []).length;
      // List page must not render its own F9 lookups; they live in MachineForm.
      expect(f9Count).toBe(0);
      expect(page).not.toContain('machineCategoryAdapter');
    });
  });

  describe('B. create/from list opens a modal and does not navigate full-page', () => {
    it('Create action opens the modal via openCreate, not router.push(/new)', () => {
      const page = read(PAGE);
      expect(page).toContain("new: () => openCreate()");
      expect(page).not.toContain("router.push('/admin/maintenance/machines/new')");
    });

    it('Create and Edit share one canonical Modal', () => {
      const page = read(PAGE);
      expect(page).toContain('<Modal open={modalOpen}');
      expect(page).toContain("title={selectedMode === 'edit' ? t('maintenance.editMachine') : t('maintenance.newMachine')}");
    });
  });

  describe('C. Create state starts clean (no stale values)', () => {
    it('uses a factory initialForm so every openCreate starts blank', () => {
      const page = read(PAGE);
      expect(page).toContain('initialForm: createMachineForm');
      expect(page).toContain('createMachineForm');
    });

    it('EMPTY_MACHINE_FORM and createMachineForm produce a clean blank form', () => {
      const form = read(FORM);
      expect(form).toContain('export const EMPTY_MACHINE_FORM');
      expect(form).toContain("name: ''");
    });
  });

  describe('D. Cancel closes the create modal', () => {
    it('Modal onClose calls closeFormModal and clears validation', () => {
      const page = read(PAGE);
      expect(page).toContain("onClose={() => { closeFormModal(); setValidationErrors({}); }}");
      expect(page).toContain('<Button variant="secondary" onClick={() => { closeFormModal(); setValidationErrors({}); }}');
    });
  });

  describe('E. Edit opens modal, loads correct record, prefills, PATCHes same id', () => {
    it('Edit action and grid action open the modal via openEdit(record)', () => {
      const page = read(PAGE);
      expect(page).toContain("edit: () => { if (selectedRecord) openEdit(selectedRecord); }");
      expect(page).toContain('onClick: (m: Machine) => openEdit(m)');
      expect(page).not.toContain("router.push(`/admin/maintenance/machines/${m.id}/edit`)");
    });

    it('detail is fetched and mapped into MachineForm via mapMachineToForm', () => {
      const page = read(PAGE);
      expect(page).toContain('mapRecordToForm: (detail) => mapMachineToForm(detail)');
      expect(page).toContain('mapMachineToForm');
    });

    it('machine-form maps every stored id into the form for prefill', () => {
      const form = read(FORM);
      expect(form).toContain('mapMachineToForm');
      expect(form).toContain('machine.categoryId || ');
      expect(form).toContain('machine.productionLineId || ');
      expect(form).toContain('machine.technicalDepartmentId || ');
      expect(form).toContain("code: machine.code || ''");
    });

    it('PATCH targets the same machine id and POST creates', () => {
      const page = read(PAGE);
      expect(page).toContain("createRequest: (payload) => api.post('/maintenance/machines', payload)");
      expect(page).toContain('updateRequest: (id, payload) => api.patch(`/maintenance/machines/${id}`, payload)');
    });
  });

  describe('F. Code contract', () => {
    it('Create has no manual code input; edit renders code as immutable', () => {
      const form = read(FORM);
      expect(form).toContain("mode === 'edit' && (");
      expect(form).toContain('<Input label={t(\'maintenance.code\')} value={form.code} disabled />');
    });
  });

  describe('G. isReadOnly behavior preserved', () => {
    it('shared form exposes read-only detection for inactive/scrapped/out-of-service', () => {
      const form = read(FORM);
      expect(form).toContain("status === 'INACTIVE' || status === 'SCRAPPED' || status === 'OUT_OF_SERVICE'");
      expect(form).toContain('isMachineReadOnly');
    });
  });

  describe('H. edit metadata preserved', () => {
    it('edit mode renders metadata from createdAt/updatedAt', () => {
      const form = read(FORM);
      expect(form).toContain('complexForms.metadata');
      expect(form).toContain('common.createdAt');
      expect(form).toContain('common.updatedAt');
    });
  });

  describe('I. lookups preserved and shared', () => {
    it('MachineForm uses every required adapter and dependent filters', () => {
      const form = read(FORM);
      ['machineCategoryAdapter', 'companyAdapter', 'branchAdapter', 'departmentAdapter', 'productionLineAdapter', 'operationTypeAdapter', 'costCenterAdapter', 'administrationAdapter'].forEach((a) => expect(form).toContain(a));
      expect(form).toContain('technicalAdministrationId');
      expect(form).toContain('administrationId: form.technicalAdministrationId');
    });
  });

  describe('J. dependent field reset rules preserved', () => {
    it('company resets branch/department/line; branch resets department; admin resets tech department', () => {
      const form = read(FORM);
      expect(form).toContain("if (field === 'companyId')");
      expect(form).toContain('next.branchId = \'\'');
      expect(form).toContain('next.departmentId = \'\'');
      expect(form).toContain('next.productionLineId = \'\'');
      expect(form).toContain("if (field === 'branchId') next.departmentId = ''");
      expect(form).toContain("if (field === 'technicalAdministrationId') next.technicalDepartmentId = ''");
    });
  });

  describe('K. save behavior closes modal and refreshes the list (no full-page nav)', () => {
    it('handleSave from useCrudList posts/patches then closes + refreshes in place', () => {
      const page = read(PAGE);
      expect(page).toContain('openCreate');
      expect(page).toContain('openEdit');
      expect(page).toContain('handleSave');
      // edit navigation removed after save; only the viewDetails nav remains
      expect(page).not.toContain("router.push(`/admin/maintenance/machines/${m.id}/edit`)");
      expect(page).toContain("router.push(`/admin/maintenance/machines/${m.id}`)");
    });
  });

  describe('L. direct routes preserved for compatibility', () => {
    it('direct create route file still exists (KEEP)', () => {
      expect(fs.existsSync(path.resolve(webRoot, CREATE_ROUTE))).toBe(true);
    });
    it('direct edit route file still exists (KEEP)', () => {
      expect(fs.existsSync(path.resolve(webRoot, EDIT_ROUTE))).toBe(true);
    });
  });

  describe('M. permissions/actions unaffected', () => {
    it('activate/deactivate/delete action bar wiring is retained', () => {
      const page = read(PAGE);
      expect(page).toContain('useRegisterAdminActions');
      expect(page).toContain('ActionActivateIcon');
      expect(page).toContain('ActionDeactivateIcon');
      expect(page).toContain('ActionDeleteIcon');
      expect(page).toContain('/activate');
      expect(page).toContain('/deactivate');
      expect(page).toContain('api.delete(`/maintenance/machines/${selectedId}`)');
    });
  });

  describe('N. isolation preserved', () => {
    it('backend still forces companyId/branchId from operational context on create', () => {
      const service = path.resolve(__dirname, '../../../apps/api/src/modules/factory/maintenance/maintenance.service.ts');
      const src = fs.readFileSync(service, 'utf8');
      expect(src).toContain('dataDto.companyId = ctx.companyId');
      expect(src).toContain('dataDto.branchId = ctx.branchId');
    });
    it('list is scoped to the active company/branch via machineScope', () => {
      const service = path.resolve(__dirname, '../../../apps/api/src/modules/factory/maintenance/maintenance.service.ts');
      const src = fs.readFileSync(service, 'utf8');
      expect(src).toContain('this.machineScope(ctx)');
    });
  });
});
