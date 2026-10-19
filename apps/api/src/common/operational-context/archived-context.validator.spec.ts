import { ForbiddenException } from '@nestjs/common';
import { ArchivedContextValidator } from './archived-context.validator';
import { AllowedContextResolver } from './allowed-context.resolver';
import type { ResolvedOperationalAccess } from './operational-context.types';

const DELETED_AT = new Date('2026-09-29T01:49:30.991Z');

const company = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'company_1',
  code: 'DEFAULT',
  name: 'Test Company',
  status: 'ACTIVE',
  deletedAt: null,
  ...over,
});

const branch = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'branch_1',
  code: 'HQ',
  name: 'Headquarters',
  status: 'ACTIVE',
  deletedAt: null,
  companyId: 'company_1',
  company: company({ deletedAt: DELETED_AT }),
  ...over,
});

function createPrismaMock(overrides: {
  branch?: unknown;
  administration?: unknown;
  department?: unknown;
  scope?: unknown;
} = {}) {
  const branchRecord = 'branch' in overrides ? overrides.branch : branch();
  return {
    branch: { findFirst: jest.fn().mockResolvedValue(branchRecord) },
    administration: {
      findFirst: jest.fn().mockResolvedValue(
        'administration' in overrides ? overrides.administration : null,
      ),
    },
    department: {
      findFirst: jest.fn().mockResolvedValue(
        'department' in overrides ? overrides.department : null,
      ),
    },
    userOperationalScope: {
      findFirst: jest.fn().mockResolvedValue('scope' in overrides ? overrides.scope : null),
    },
    // Mutation surfaces that must never be touched by archive validation.
    company: {
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    branchUpdate: { update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
  };
}

function createResolverMock(over: Partial<ResolvedOperationalAccess> = {}) {
  const access: ResolvedOperationalAccess = {
    authorization: {
      roles: [],
      permissions: ['company:readArchive'],
      isSuperAdmin: false,
    },
    contexts: [],
    defaultContext: null,
    grants: [],
    legacyCompanyId: 'company_1',
    legacyBranchId: 'branch_1',
    legacyDepartmentId: null,
    ...over,
  };
  return { resolve: jest.fn().mockResolvedValue(access) } as unknown as AllowedContextResolver;
}

async function rejectionKey(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    const response = (error as ForbiddenException).getResponse();
    return typeof response === 'string' ? response : (response as { messageKey: string }).messageKey;
  }
  throw new Error('expected the validation to be rejected');
}

const VALID_SELECTION = { companyId: 'company_1', branchId: 'branch_1' };

describe('ArchivedContextValidator', () => {
  it('requires a company and a branch', async () => {
    const validator = new ArchivedContextValidator(
      createPrismaMock() as never,
      createResolverMock(),
    );

    await expect(
      rejectionKey(validator.validate('user_1', { companyId: '', branchId: 'branch_1' })),
    ).resolves.toBe('operationalContext.companyRequired');
    await expect(
      rejectionKey(validator.validate('user_1', { companyId: 'company_1', branchId: '' })),
    ).resolves.toBe('operationalContext.branchRequired');
  });

  it('rejects a branch that does not belong to the selected company', async () => {
    const prisma = createPrismaMock({ branch: null });
    const validator = new ArchivedContextValidator(prisma as never, createResolverMock());

    await expect(rejectionKey(validator.validate('user_1', VALID_SELECTION))).resolves.toBe(
      'operationalContext.invalidRelationship',
    );
  });

  it('accepts a soft-deleted company ancestor as an archived context', async () => {
    const validator = new ArchivedContextValidator(
      createPrismaMock() as never,
      createResolverMock(),
    );

    const { context } = await validator.validate('user_1', VALID_SELECTION);

    expect(context.isArchived).toBe(true);
    expect(context.isDefault).toBe(false);
    expect(context.companyId).toBe('company_1');
    expect(context.branchId).toBe('branch_1');
    expect(context.archivedAncestors).toEqual([
      {
        level: 'company',
        id: 'company_1',
        code: 'DEFAULT',
        name: 'Test Company',
        deletedAt: DELETED_AT.toISOString(),
      },
    ]);
  });

  it('treats a fully active selection as NOT archived (archive mode never silences active access)', async () => {
    const prisma = createPrismaMock({
      branch: branch({ company: company(), deletedAt: null }),
    });
    const validator = new ArchivedContextValidator(prisma as never, createResolverMock());

    await expect(rejectionKey(validator.validate('user_1', VALID_SELECTION))).resolves.toBe(
      'archiveContext.notArchived',
    );
  });

  it('rejects a non-deleted inactive ancestor instead of resurrecting it', async () => {
    const prisma = createPrismaMock({
      branch: branch({ company: company({ status: 'SUSPENDED' }) }),
    });
    const validator = new ArchivedContextValidator(prisma as never, createResolverMock());

    await expect(rejectionKey(validator.validate('user_1', VALID_SELECTION))).resolves.toBe(
      'operationalContext.invalidRelationship',
    );
  });

  it('rejects a non SUPER_ADMIN without an explicit or legacy scope', async () => {
    const prisma = createPrismaMock({ scope: null });
    const validator = new ArchivedContextValidator(
      prisma as never,
      createResolverMock({ legacyCompanyId: 'company_other', legacyBranchId: 'branch_other' }),
    );

    await expect(rejectionKey(validator.validate('user_1', VALID_SELECTION))).resolves.toBe(
      'operationalContext.notAllowed',
    );
  });

  it('accepts an explicit active operational scope for the archived company/branch', async () => {
    const prisma = createPrismaMock({
      scope: {
        id: 'scope_1',
        userId: 'user_1',
        companyId: 'company_1',
        branchId: 'branch_1',
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    const validator = new ArchivedContextValidator(prisma as never, createResolverMock());

    const { context } = await validator.validate('user_1', VALID_SELECTION);

    expect(context.scopeId).toBe('scope_1');
    expect(context.source).toBe('EXPLICIT_SCOPE');
  });

  it('lets SUPER_ADMIN browse any archived organization without a scope row', async () => {
    const prisma = createPrismaMock({ scope: null });
    const validator = new ArchivedContextValidator(
      prisma as never,
      createResolverMock({
        authorization: { roles: [], permissions: [], isSuperAdmin: true },
        legacyCompanyId: null,
        legacyBranchId: null,
      }),
    );

    const { context, authorization } = await validator.validate('user_1', VALID_SELECTION);

    expect(authorization.isSuperAdmin).toBe(true);
    expect(context.source).toBe('SUPER_ADMIN');
    expect(prisma.userOperationalScope.findFirst).not.toHaveBeenCalled();
  });

  it('resolves the archived administration and department ancestors', async () => {
    const administration = {
      id: 'admin_1',
      branchId: 'branch_1',
      code: 'ADM',
      name: 'Administration',
      status: 'ACTIVE',
      deletedAt: DELETED_AT,
    };
    const department = {
      id: 'dept_1',
      companyId: 'company_1',
      branchId: 'branch_1',
      administrationId: 'admin_1',
      administration,
      code: 'DEP',
      name: 'Department',
      status: 'ACTIVE',
      deletedAt: DELETED_AT,
    };
    const validator = new ArchivedContextValidator(
      createPrismaMock({ administration, department }) as never,
      createResolverMock(),
    );

    const { context } = await validator.validate('user_1', {
      companyId: 'company_1',
      branchId: 'branch_1',
      administrationId: 'admin_1',
      departmentId: 'dept_1',
    });

    expect(context.administrationId).toBe('admin_1');
    expect(context.departmentId).toBe('dept_1');
    expect(context.archivedAncestors?.map((a) => a.level)).toEqual([
      'company',
      'administration',
      'department',
    ]);
  });

  it('never mutates organizational records while validating archive access', async () => {
    const prisma = createPrismaMock();
    const validator = new ArchivedContextValidator(prisma as never, createResolverMock());

    await validator.validate('user_1', VALID_SELECTION);

    expect(prisma.company.update).not.toHaveBeenCalled();
    expect(prisma.company.updateMany).not.toHaveBeenCalled();
    expect(prisma.company.delete).not.toHaveBeenCalled();
    expect(prisma.company.deleteMany).not.toHaveBeenCalled();
    expect(prisma.branchUpdate.update).not.toHaveBeenCalled();
    expect(prisma.branchUpdate.delete).not.toHaveBeenCalled();
  });

  it('rejects with a messageKey only so the API filter can localize it', async () => {
    const validator = new ArchivedContextValidator(
      createPrismaMock({ branch: null }) as never,
      createResolverMock(),
    );

    await expect(
      validator.validate('user_1', VALID_SELECTION).catch((error) => {
        const response = (error as ForbiddenException).getResponse() as Record<string, unknown>;
        expect(response.messageKey).toBe('operationalContext.invalidRelationship');
        // AllExceptionsFilter only localizes when messageKey !== message.
        expect(response.message).not.toBe(response.messageKey);
        return response.messageKey as string;
      }),
    ).resolves.toBe('operationalContext.invalidRelationship');
  });
});
