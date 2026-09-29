import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { AuditService } from '../../audit/audit.service';
import { AllowedContextResolver } from '../../../common/operational-context/allowed-context.resolver';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { OPERATIONAL_CONTEXT_OPTIONAL_KEY } from '../../../common/operational-context/operational-context-optional.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

/**
 * ORG-FIRST-BRANCH-R1 regression coverage for the first-branch bootstrap
 * deadlock:
 *
 *   new active Company -> zero Branches -> no Active Operational Context
 *   -> POST /branches is unreachable -> the company can never obtain a branch.
 *
 * The normal context-bound branch path must stay exactly as strict as before.
 */
describe('BranchesService first-branch bootstrap', () => {
  const SUPER_ADMIN = { isSuperAdmin: true, roles: [{ code: 'SUPER_ADMIN' }], permissions: [] };
  const SCOPED_USER = {
    isSuperAdmin: false,
    roles: [{ code: 'COMPANY_ADMIN' }],
    permissions: ['branches:create', 'branches:read'],
  };
  const CALLER = { id: 'super-admin-user', sub: 'super-admin-user' };
  const TARGET_COMPANY = 'cm-target-company';
  const CANDIDATE_BRANCH = { id: 'branch-1', companyId: TARGET_COMPANY, code: 'BRN-000002', name: 'HQ' };

  let prisma: any;
  let tx: any;
  let numbering: any;
  let audit: any;
  let resolver: any;
  let service: BranchesService;

  function txClient() {
    return {
      branch: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(CANDIDATE_BRANCH),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      numberSequence: {
        findUnique: jest.fn().mockResolvedValue({ id: 'seq', code: 'BRANCH', status: 'ACTIVE', resetPolicy: 'NEVER', increment: 1, padding: 6, prefix: 'BRN-', suffix: null, currentNumber: 1 }),
        update: jest.fn().mockImplementation(({ data }: any) => ({ id: 'seq', currentNumber: data?.currentNumber?.increment ?? 2 })),
      },
    };
  }

  beforeEach(() => {
    tx = txClient();
    prisma = {
      company: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: TARGET_COMPANY, code: 'COM-000042', name: 'Joubah', status: 'ACTIVE' }),
      },
      branch: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('BRN-000002'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('BRN-000002'),
    };
    audit = { logWithClient: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    resolver = { getAuthorization: jest.fn().mockResolvedValue(SUPER_ADMIN) };
    service = new BranchesService(
      prisma as PrismaService,
      numbering as NumberingService,
      audit as AuditService,
      resolver as AllowedContextResolver,
    );
  });

  describe('TEST 1 + TEST 2 - authorized first-branch creation', () => {
    it('lets a SUPER_ADMIN bootstrap the first branch of an active company with zero branches', async () => {
      const result = await service.bootstrapFirstBranch(
        { companyId: TARGET_COMPANY, name: 'HQ' },
        CALLER.id,
      );

      expect(resolver.getAuthorization).toHaveBeenCalledWith(CALLER.id);
      expect(prisma.company.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TARGET_COMPANY, deletedAt: null } }),
      );
      expect(result).toEqual(CANDIDATE_BRANCH);
    });

    it('assigns the branch to the explicitly targeted company, never the caller context company', async () => {
      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'HQ' }, CALLER.id);

      expect(tx.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: TARGET_COMPANY }),
        }),
      );
      const createdCompanyId = tx.branch.create.mock.calls[0][0].data.companyId;
      expect(createdCompanyId).toBe(TARGET_COMPANY);
      expect(createdCompanyId).not.toBe('caller-active-company');
    });

    it('records an auditable system-administration override', async () => {
      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'HQ' }, CALLER.id);

      expect(audit.logWithClient).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          userId: CALLER.id,
          action: 'BRANCH_FIRST_BOOTSTRAP',
          entity: 'Branch',
          entityId: CANDIDATE_BRANCH.id,
          details: expect.objectContaining({ companyId: TARGET_COMPANY }),
        }),
      );
    });

    it('never mutates user operational scopes as part of the bootstrap', async () => {
      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'HQ' }, CALLER.id);

      expect(prisma.userOperationalScope).toBeUndefined();
      expect(tx.userOperationalScope).toBeUndefined();
    });
  });

  describe('TEST 4 - authority enforcement', () => {
    it('refuses a non-SUPER_ADMIN caller that holds branch permissions', async () => {
      resolver.getAuthorization.mockResolvedValue(SCOPED_USER);

      const promise = service.bootstrapFirstBranch(
        { companyId: TARGET_COMPANY, name: 'HQ' },
        'scoped-user',
      );

      await expect(promise).rejects.toThrow(ForbiddenException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('organization.systemAdministrationRequired');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.branch.create).not.toHaveBeenCalled();
    });

    it('rejects before touching any company data when authority is missing', async () => {
      resolver.getAuthorization.mockResolvedValue({ isSuperAdmin: false, roles: [], permissions: [] });

      await expect(
        service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'HQ' }, 'scoped-user'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.company.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('TEST 5 + TEST 6 - company eligibility', () => {
    it('rejects an inactive company', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: TARGET_COMPANY, code: 'COM-1', name: 'Inactive', status: 'INACTIVE' });

      const promise = service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'HQ' }, CALLER.id);

      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('organization.bootstrapCompanyNotActive');
      expect(response.errors[0]).toMatchObject({ field: 'companyId', code: 'organization.bootstrapCompanyNotActive' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a soft-deleted company because the lookup is filtered by deletedAt null', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      const promise = service.bootstrapFirstBranch({ companyId: 'deleted-company', name: 'HQ' }, CALLER.id);

      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('organization.companyNotFound');
      expect(prisma.company.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'deleted-company', deletedAt: null } }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('TEST 7 - zero-branch-only rule', () => {
    it('rejects a company that already has a non-deleted branch', async () => {
      prisma.branch.count.mockResolvedValue(1);

      const promise = service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'Second' }, CALLER.id);

      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('organization.bootstrapBranchAlreadyExists');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.branch.create).not.toHaveBeenCalled();
    });

    it('re-audits the precondition inside the transaction to defeat a concurrent bootstrap', async () => {
      prisma.branch.count.mockResolvedValue(0);
      tx.branch.count.mockResolvedValue(1);

      const promise = service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'HQ' }, CALLER.id);

      await expect(promise).rejects.toThrow(ConflictException);
      expect(tx.branch.create).not.toHaveBeenCalled();
    });

    it('counts only non-deleted branches so a re-bootstrapped company can recover', async () => {
      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'HQ' }, CALLER.id);

      expect(prisma.branch.count).toHaveBeenCalledWith({
        where: { companyId: TARGET_COMPANY, deletedAt: null },
      });
    });
  });

  describe('TEST 8 - duplicate code protection', () => {
    it('rejects a code already used by a branch of the same company', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'existing', code: 'BRN-000002' });

      const promise = service.bootstrapFirstBranch(
        { companyId: TARGET_COMPANY, code: 'BRN-000002', name: 'HQ' },
        CALLER.id,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: { companyId: TARGET_COMPANY, code: 'BRN-000002', deletedAt: null },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('TEST 9 - numbering semantics', () => {
    it('consumes the canonical sequence exactly once on success', async () => {
      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'HQ' }, CALLER.id);

      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledTimes(1);
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('BRANCH', tx);
      expect(tx.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'BRN-000002' }) }),
      );
    });

    it('consumes numbering inside the same transaction as the insert', async () => {
      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'HQ' }, CALLER.id);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(numbering.generateNumberAtomic).not.toHaveBeenCalled();
    });

    it('does not consume a number for an owner-supplied code', async () => {
      await service.bootstrapFirstBranch(
        { companyId: TARGET_COMPANY, code: 'BRN-CUSTOM', name: 'HQ' },
        CALLER.id,
      );

      expect(numbering.generateNumberAtomicWithClient).not.toHaveBeenCalled();
      expect(tx.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'BRN-CUSTOM' }) }),
      );
    });

    it.each([
      ['missing authority', { isSuperAdmin: false }],
      ['inactive company', { isSuperAdmin: true, companyStatus: 'INACTIVE' }],
      ['unknown company', { isSuperAdmin: true, companyMissing: true }],
      ['company already has a branch', { isSuperAdmin: true, branchCount: 1 }],
      ['duplicate code', { isSuperAdmin: true, duplicateCode: true }],
    ])('never consumes a number when the request is rejected: %s', async (_label, scenario) => {
      const s = scenario as Record<string, unknown>;
      resolver.getAuthorization.mockResolvedValue({ isSuperAdmin: Boolean(s.isSuperAdmin) });
      if (s.companyStatus) {
        prisma.company.findFirst.mockResolvedValue({ id: TARGET_COMPANY, code: 'COM-1', name: 'X', status: s.companyStatus });
      }
      if (s.companyMissing) {
        prisma.company.findFirst.mockResolvedValue(null);
      }
      if (typeof s.branchCount === 'number') {
        prisma.branch.count.mockResolvedValue(s.branchCount as number);
      }
      if (s.duplicateCode) {
        prisma.branch.findFirst.mockResolvedValue({ id: 'dup', code: 'BRN-000002' });
      }

      await expect(
        service.bootstrapFirstBranch(
          { companyId: TARGET_COMPANY, code: 'BRN-000002', name: 'HQ' },
          CALLER.id,
        ),
      ).rejects.toThrow();

      expect(numbering.generateNumberAtomicWithClient).not.toHaveBeenCalled();
      expect(tx.numberSequence.update).not.toHaveBeenCalled();
    });
  });

  describe('TEST 10 - tenant isolation', () => {
    it('does not read, create or touch any record of a different company', async () => {
      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: 'HQ' }, CALLER.id);

      const companyIds = [
        ...prisma.company.findFirst.mock.calls.map((c: any[]) => c[0].where.id),
        ...prisma.branch.findFirst.mock.calls.map((c: any[]) => c[0].where.companyId),
        ...prisma.branch.count.mock.calls.map((c: any[]) => c[0].where.companyId),
        ...tx.branch.create.mock.calls.map((c: any[]) => c[0].data.companyId),
      ];
      expect(new Set(companyIds)).toEqual(new Set([TARGET_COMPANY]));
    });

    it('keeps the normal context-bound create path on ctx.companyId and ignores dto.companyId', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'caller-active-company' });
      prisma.branch.findFirst.mockResolvedValue(null);
      prisma.branch.create.mockResolvedValue({ id: 'b1' });
      const callerCtx = {
        contextKey: 'caller-active-company:branch-x',
        companyId: 'caller-active-company',
        branchId: 'branch-x',
        source: 'EXPLICIT_SCOPE',
      } as ActiveOperationalContext;

      await service.create(
        { companyId: 'attacker-company', name: 'Injected' } as any,
        callerCtx,
      );

      expect(prisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'caller-active-company' }),
        }),
      );
      expect(prisma.branch.create.mock.calls[0][0].data.companyId).not.toBe('attacker-company');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

describe('BranchesController route contract', () => {
  const reflector = new Reflector();

  function metadataOf(methodName: 'create' | 'bootstrapFirstBranch' | 'findAll' | 'update') {
    const handler = BranchesController.prototype[methodName] as unknown as object;
    return {
      permissions: Reflect.getMetadata('permissions', handler),
      contextOptional: Reflect.getMetadata(OPERATIONAL_CONTEXT_OPTIONAL_KEY, handler),
    };
  }

  it('requires the branches:create permission on the bootstrap route', () => {
    expect(metadataOf('bootstrapFirstBranch').permissions).toEqual(['branches:create']);
  });

  it('marks only the bootstrap route as operational-context optional', () => {
    expect(metadataOf('bootstrapFirstBranch').contextOptional).toBe(true);
    expect(metadataOf('create').contextOptional).toBeUndefined();
    expect(metadataOf('findAll').contextOptional).toBeUndefined();
    expect(metadataOf('update').contextOptional).toBeUndefined();
  });

  it('keeps the whole controller context-bound by default', () => {
    expect(Reflect.getMetadata(OPERATIONAL_CONTEXT_OPTIONAL_KEY, BranchesController)).toBeUndefined();
  });

  it('routes the caller identity from the JWT, not from the request body', () => {
    const calls: any[] = [];
    const service = {
      create: (...args: any[]) => calls.push(['create', ...args]),
      bootstrapFirstBranch: (...args: any[]) => calls.push(['bootstrap', ...args]),
    };
    const controller = new BranchesController(service as any);

    controller.bootstrapFirstBranch(
      { companyId: 'company-1', name: 'HQ' } as any,
      { id: 'user-1', sub: 'user-1' } as any,
    );

    expect(calls[0][0]).toBe('bootstrap');
    expect(calls[0][1]).toEqual({ companyId: 'company-1', name: 'HQ' });
    expect(calls[0][2]).toBe('user-1');
  });

  it('still requires a permission on the normal create route', () => {
    expect(metadataOf('create').permissions).toEqual(['branches:create']);
  });

  it('lets SUPER_ADMIN through the shared permission guard for the bootstrap key', () => {
    const prisma = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          { role: { status: 'ACTIVE', code: 'SUPER_ADMIN', permissions: [] } },
        ]),
      },
    };
    const guard = new PermissionsGuard(reflector, prisma as any);
    const context = {
      getHandler: () => BranchesController.prototype.bootstrapFirstBranch,
      getClass: () => BranchesController,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1' } }) }),
    } as any;

    return expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
