import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');

const PAGE = 'src/app/admin/maintenance/production-lines/page.tsx';
const SERVICE = path.join(
  repoRoot,
  'apps/api/src/modules/factory/maintenance/production-lines/production-lines.service.ts',
);

describe('ProductionLine create/edit form context binding', () => {
  describe('A. foreign company leak removed from the create modal', () => {
    it('no longer fetches the unscoped global /companies list', () => {
      const page = read(PAGE);
      expect(page).not.toContain("api.get<any>('/companies')");
      expect(page).not.toContain('setCompanies');
    });

    it('derives company and branch from the active operational context on create', () => {
      const page = read(PAGE);
      expect(page).toContain('useOperationalContext');
      expect(page).toContain('const { activeContext } = useOperationalContext();');
      expect(page).toContain("companyId: activeContext?.companyId || ''");
      expect(page).toContain("branchId: activeContext?.branchId || ''");
    });

    it('displays company and branch as camera-trust context values, never dropdowns', () => {
      const page = read(PAGE);
      const companyBadgeline = page.match(/<Input label=\{t\('core\.company'\)\}[\s\S]*?disabled \/>/);
      expect(companyBadgeline).not.toBeNull();
      expect(companyBadgeline![0]).toContain('activeContext?.companyName');
      expect(companyBadgeline![0]).toContain('disabled');
      const branchBadgeline = page.match(/<Input label=\{t\('core\.branch'\)\}[\s\S]*?disabled \/>/);
      expect(branchBadgeline).not.toBeNull();
      expect(branchBadgeline![0]).toContain('activeContext?.branchName');
      expect(branchBadgeline![0]).toContain('disabled');
      expect(page).not.toContain('options={companies.');
      expect(page).not.toContain('options={branches.');
    });
  });

  describe('B. dependent lookups are scoped to the active context', () => {
    it('does not fetch branches by a user-chosen company', () => {
      expect(read(PAGE)).not.toContain("api.get<any>('/branches'");
    });

    it('loads administrations and cost centres from context-scoped endpoints', () => {
      const page = read(PAGE);
      expect(page).toContain("api.get<any>('/administrations'");
      expect(page).toContain("api.get<any>('/maintenance/cost-centers'");
      expect(page).toContain("api.get<any>('/maintenance/operation-types'");
    });

    it('keeps the dependent administration -> department chain', () => {
      const page = read(PAGE);
      expect(page).toContain("api.get<any>('/departments', { params: { administrationId, limit: 100 } }");
      expect(page).toContain('fetchDepartments(val)');
    });
  });

  describe('C. edit prefill completes for all stored IDs', () => {
    it('maps every tenant/dependent field from the fetched detail record', () => {
      const page = read(PAGE);
      expect(page).toContain('companyId: item.companyId, branchId: item.branchId, administrationId: item.administrationId || \'\'');
      expect(page).toContain('departmentId: item.departmentId, operationTypeId: item.operationTypeId');
      expect(page).toContain('costCenterId: item.costCenterId || \'\'');
    });

    it('reloads departments for the stored administration and scoped lookups on edit', () => {
      const page = read(PAGE);
      expect(page).toContain('if (item.administrationId) fetchDepartments(item.administrationId);');
      expect(page).toContain('loadContextLookups();');
    });
  });

  describe('D. real API path preserved (no mock or placeholder data)', () => {
    it('still creates via POST and edits the same record via PATCH /:id', () => {
      const page = read(PAGE);
      expect(page).toContain("api.post('/maintenance/production-lines'");
      expect(page).toContain('api.patch(`/maintenance/production-lines/${editItem.id}`');
    });
  });

  describe('E. backend write security remains intact (company/branch only from active context)', () => {
    it('create strips client company/branch and writes from the active context', () => {
      const service = fs.readFileSync(SERVICE, 'utf8');
      expect(service).toContain('companyId: ctx.companyId, branchId: ctx.branchId');
      expect(service).toContain('_ignoredCompanyId');
      expect(service).toContain('_ignoredBranchId');
    });

    it('list and detail reads are always scoped to the active company/branch', () => {
      const service = fs.readFileSync(SERVICE, 'utf8');
      expect(service).toContain("where: any = { deletedAt: null, companyId: ctx.companyId, branchId: ctx.branchId }");
      expect(service).toContain('item.companyId === ctx.companyId && item.branchId === ctx.branchId');
    });
  });
});
