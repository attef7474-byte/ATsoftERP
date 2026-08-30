import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../..');
const readWeb = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const PAGE = 'src/app/admin/maintenance/production-lines/page.tsx';
const CC_SERVICE = 'apps/api/src/modules/factory/maintenance/cost-centers/cost-centers.service.ts';
const PL_SERVICE = 'apps/api/src/modules/factory/maintenance/production-lines/production-lines.service.ts';

describe('ProductionLine edit cost-center prefill contract', () => {
  describe('A. stored costCenterId restores into the edit form', () => {
    it('maps item.costCenterId into form.costCenterId (valid references prefill)', () => {
      const page = readWeb(PAGE);
      expect(page).toContain("costCenterId: item.costCenterId || ''");
      expect(page).toContain("costCenterId: form.costCenterId");
    });
  });

  describe('B. options are scoped to active context AND exclude soft-deleted rows', () => {
    it('the cost-centre lookup is served from the context-scoped endpoint', () => {
      const page = readWeb(PAGE);
      expect(page).toContain("api.get<any>('/maintenance/cost-centers'");
    });

    it('options are sourced only from non-deleted, active-company cost centres', () => {
      const svc = readApi(CC_SERVICE);
      expect(svc).toContain('where: any = { deletedAt: null, companyId: ctx.companyId }');
      expect(svc).toContain('{ branchId: ctx.branchId }');
      expect(svc).toContain('{ branchId: null }');
    });

    it('deleted cost centres are never surfaced (soft-delete guard preserved)', () => {
      // A stored costCenterId pointing at a deleted cost centre cannot be a valid
      // option. This pins the correct guard: do NOT broaden the lookup to
      // include soft-deleted or foreign rows merely to show a stale value.
      const svc = readApi(CC_SERVICE);
      expect(svc).toContain('deletedAt: null');
    });
  });

  describe('C. visible label resolves for an available option', () => {
    it('the cost-centre Select maps option id -> name', () => {
      const page = readWeb(PAGE);
      expect(page).toMatch(/<Select label=\{t\('maintenance\.costCenter'\)\} value=\{form\.costCenterId\}[^>]*options=\{costCenters\.map\(\(c: any\) => \(\{ value: c\.id, label: c\.name \}\)/);
    });
  });

  describe('D. unchanged edit preserves costCenterId, backend re-validates it', () => {
    it('the payload keeps the stored costCenterId (not coerced to empty)', () => {
      const page = readWeb(PAGE);
      expect(page).toContain('costCenterId: form.costCenterId || undefined');
    });

    it('backend refuses a reference to a deleted cost centre (guards data integrity)', () => {
      const svc = readApi(PL_SERVICE);
      expect(svc).toContain('where: { id: dto.costCenterId, companyId: ctx.companyId, deletedAt: null }');
      expect(svc).toContain("Cost center must belong to the active company");
    });
  });

  describe('E. legitimate null cost centre remains blank', () => {
    it('maps null costCenterId to empty (not a stale id)', () => {
      const page = readWeb(PAGE);
      expect(page).toContain("costCenterId: item.costCenterId || ''");
    });
  });

  describe('F. foreign-branch cost centres remain unavailable', () => {
    it('options never cross to another branch (only active branch or branch-null)', () => {
      const svc = readApi(CC_SERVICE);
      expect(svc).toContain('companyId: ctx.companyId');
      expect(svc).toContain('{ branchId: ctx.branchId }');
    });
  });

  describe('G. already-fixed ProductionLine fields remain unchanged', () => {
    it('company/branch stay bound to the active context (no dropdown regression)', () => {
      const page = readWeb(PAGE);
      expect(page).toContain("companyId: activeContext?.companyId || ''");
      expect(page).toContain("branchId: activeContext?.branchId || ''");
      expect(page).not.toContain('options={companies.');
      expect(page).not.toContain('options={branches.');
    });

    it('administration/department/operationType/name/description/location mappings intact', () => {
      const page = readWeb(PAGE);
      expect(page).toContain("companyId: item.companyId, branchId: item.branchId, administrationId: item.administrationId || ''");
      expect(page).toContain("departmentId: item.departmentId, operationTypeId: item.operationTypeId");
      expect(page).toContain("code: item.code, name: item.name, description: item.description || '', location: item.location || ''");
      expect(page).toContain("loadContextLookups();");
    });
  });
});
