import {
  BRANCH_BOOTSTRAP_ENDPOINT,
  BRANCH_CREATE_ENDPOINT,
  resolveBranchCreateRoute,
} from '../src/lib/first-branch-bootstrap';
import { readFileSync } from 'fs';
import { join } from 'path';

const TARGET = 'cmum3jqh8001mf495zaankx05';
const CALLER_COMPANY = 'cmrenjo';

describe('resolveBranchCreateRoute (ORG-FIRST-BRANCH-R1)', () => {
  it('routes a SUPER_ADMIN to bootstrap when a foreign company has zero branches', () => {
    const decision = resolveBranchCreateRoute({
      isSuperAdmin: true,
      selectedCompanyId: TARGET,
      activeCompanyId: CALLER_COMPANY,
      selectedCompanyBranchCount: 0,
    });

    expect(decision.useBootstrap).toBe(true);
    expect(decision.endpoint).toBe(BRANCH_BOOTSTRAP_ENDPOINT);
    expect(decision.reason).toBe('superAdminZeroBranchForeignCompany');
  });

  it('keeps a non-SUPER_ADMIN on the normal context-bound path even with zero branches', () => {
    const decision = resolveBranchCreateRoute({
      isSuperAdmin: false,
      selectedCompanyId: TARGET,
      activeCompanyId: CALLER_COMPANY,
      selectedCompanyBranchCount: 0,
    });

    expect(decision.endpoint).toBe(BRANCH_CREATE_ENDPOINT);
    expect(decision.reason).toBe('notSuperAdmin');
  });

  it('keeps a company that already has branches on the normal path', () => {
    const decision = resolveBranchCreateRoute({
      isSuperAdmin: true,
      selectedCompanyId: CALLER_COMPANY,
      activeCompanyId: CALLER_COMPANY,
      selectedCompanyBranchCount: 1,
    });

    expect(decision.endpoint).toBe(BRANCH_CREATE_ENDPOINT);
    expect(decision.reason).toBe('activeContextCompany');
  });

  it('rejects bootstrap for a foreign company that already has branches', () => {
    const decision = resolveBranchCreateRoute({
      isSuperAdmin: true,
      selectedCompanyId: 'other-company',
      activeCompanyId: CALLER_COMPANY,
      selectedCompanyBranchCount: 3,
    });

    expect(decision.useBootstrap).toBe(false);
    expect(decision.reason).toBe('companyAlreadyHasBranches');
  });

  it('never bootstraps without a selected company', () => {
    expect(
      resolveBranchCreateRoute({
        isSuperAdmin: true,
        selectedCompanyId: '',
        activeCompanyId: CALLER_COMPANY,
        selectedCompanyBranchCount: 0,
      }).reason,
    ).toBe('noCompanySelected');
  });

  it('fails closed when the branch count is unknown', () => {
    for (const count of [undefined, null]) {
      const decision = resolveBranchCreateRoute({
        isSuperAdmin: true,
        selectedCompanyId: TARGET,
        activeCompanyId: CALLER_COMPANY,
        selectedCompanyBranchCount: count,
      });
      expect(decision.useBootstrap).toBe(false);
      expect(decision.reason).toBe('branchCountUnknown');
    }
  });

  it('never routes a non-SUPER_ADMIN to the bootstrap endpoint for any input', () => {
    const companies = ['', TARGET, 'other-company'];
    const counts = [0, 1, undefined, null];
    const contexts = [null, undefined, CALLER_COMPANY, 'other-company'];

    for (const selectedCompanyId of companies) {
      for (const selectedCompanyBranchCount of counts) {
        for (const activeCompanyId of contexts) {
          const decision = resolveBranchCreateRoute({
            isSuperAdmin: false,
            selectedCompanyId,
            activeCompanyId,
            selectedCompanyBranchCount,
          });
          expect(decision.endpoint).toBe(BRANCH_CREATE_ENDPOINT);
        }
      }
    }
  });

  it('only selects bootstrap for the exact zero-branch foreign-company case', () => {
    const companies = ['', TARGET, 'other-company'];
    const counts = [0, 1, 2, undefined, null];
    const contexts = [null, undefined, CALLER_COMPANY, 'other-company', TARGET];

    let bootstrapCombinations = 0;
    for (const selectedCompanyId of companies) {
      for (const selectedCompanyBranchCount of counts) {
        for (const activeCompanyId of contexts) {
          const decision = resolveBranchCreateRoute({
            isSuperAdmin: true,
            selectedCompanyId,
            activeCompanyId,
            selectedCompanyBranchCount,
          });
          if (decision.useBootstrap) {
            bootstrapCombinations += 1;
            expect(selectedCompanyBranchCount).toBe(0);
            expect(selectedCompanyId).not.toBe('');
            expect(activeCompanyId).not.toBe(selectedCompanyId);
            expect(decision.endpoint).toBe(BRANCH_BOOTSTRAP_ENDPOINT);
          } else {
            expect(decision.endpoint).toBe(BRANCH_CREATE_ENDPOINT);
          }
        }
      }
    }
    expect(bootstrapCombinations).toBe(8);
  });
});

describe('branches page wiring', () => {
  const pagePath = join(__dirname, '..', 'src', 'app', 'admin', 'core', 'branches', 'page.tsx');
  const page = readFileSync(pagePath, 'utf8');

  it('posts to the literal endpoints declared by the decision helper', () => {
    expect(page).toContain(`api.post('${BRANCH_BOOTSTRAP_ENDPOINT}', payload)`);
    expect(page).toContain(`api.post('${BRANCH_CREATE_ENDPOINT}', payload)`);
  });

  it('never posts a branch without consulting the route decision', () => {
    const postCalls = page.match(/api\.post\(/g) ?? [];
    expect(postCalls.length).toBe(2);
    expect(page).toMatch(/if \(decision\.useBootstrap\)/);
  });

  it('captures the selected company branch count from the F9 selection', () => {
    expect(page).toContain('onItemSelect=');
    expect(page).toContain('setSelectedCompanyBranchCount(company._count?.branches ?? null)');
  });

  it('recomputes the decision from the live form so it cannot go stale', () => {
    expect(page).toContain('selectedCompanyId: form.companyId');
    expect(page).toContain('activeCompanyId: activeContext?.companyId');
  });
});
