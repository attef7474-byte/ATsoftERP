import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PersonAssignmentsService } from './person-assignments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { SupervisorAssignmentsService } from '../supervisor-assignments/supervisor-assignments.service';

describe('PersonAssignments Tenant Isolation', () => {
  let prisma: any;
  let auditService: any;
  let service: PersonAssignmentsService;

  const ctxA: ActiveOperationalContext = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  const ctxB: ActiveOperationalContext = {
    contextKey: 'company-b:branch-b',
    scopeId: 'branch-b',
    companyId: 'company-b',
    branchId: 'branch-b',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  beforeEach(() => {
    prisma = {
      operationalPersonAssignment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      department: { findFirst: jest.fn() },
      jobTitle: { findFirst: jest.fn() },
      branch: { findFirst: jest.fn() },
      administration: { findFirst: jest.fn() },
      operationalPerson: { findFirst: jest.fn() },
      supervisorAssignment: {
        count: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    auditService = { log: jest.fn(), logWithClient: jest.fn() };
    service = new PersonAssignmentsService(
      prisma as PrismaService,
      auditService as AuditService,
      new SupervisorAssignmentsService(prisma as PrismaService, auditService as AuditService),
    );
  });

  describe('create - cross-company reference rejection', () => {
    it('Company A cannot create assignment using Company B Department', async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      const promise = service.create(
        { departmentId: 'dept-b', personnelId: 'person1', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({
        field: 'departmentId',
        code: 'validation.invalidReference',
      });
      expect(prisma.department.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });

    it('Company A cannot create assignment using Company B Branch', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.branch.findFirst.mockResolvedValue(null);

      const promise = service.create(
        { departmentId: 'dept-a', branchId: 'branch-b', personnelId: 'person1', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({
        field: 'branchId',
        code: 'validation.invalidReference',
      });
      expect(prisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });

    it('Company A cannot create assignment using Company B JobTitle', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-a' });
      prisma.jobTitle.findFirst.mockResolvedValue(null);
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });

      const promise = service.create(
        { departmentId: 'dept-a', jobTitleId: 'jt-b', personnelId: 'person1', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({
        field: 'jobTitleId',
        code: 'validation.invalidReference',
      });
      expect(prisma.jobTitle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });

    it('Company A cannot create assignment using Company B Administration', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.administration.findFirst.mockResolvedValue(null);

      const promise = service.create(
        { departmentId: 'dept-a', administrationId: 'admin-b', personnelId: 'person1', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({
        field: 'administrationId',
        code: 'validation.invalidReference',
      });
    });

    it('Company A cannot create assignment with an inactive person', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue(null);

      const promise = service.create(
        { departmentId: 'dept-a', personnelId: 'personX', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({
        field: 'personnelId',
        code: 'validation.invalidReference',
      });
    });

    it('creates assignment with Company A scope when all references are valid', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-a' });
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt-a' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);
      prisma.operationalPersonAssignment.create.mockResolvedValue({
        id: 'pa1', companyId: 'company-a', departmentId: 'dept-a', personnelId: 'person1',
      });

      const result = await service.create(
        { departmentId: 'dept-a', jobTitleId: 'jt-a', branchId: 'branch-a', personnelId: 'person1', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
        'user-1',
      );

      expect(result.companyId).toBe('company-a');
      expect(prisma.operationalPersonAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });
  });

  describe('HIER-G transfer tenant isolation', () => {
    const currentA = {
      id: 'pa-a',
      companyId: 'company-a',
      branchId: 'branch-a',
      administrationId: null,
      departmentId: 'dept-a',
      jobTitleId: 'jt-a',
      personnelId: 'person-a',
      assignmentType: 'PRIMARY',
      leadershipLevel: 'NONE',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      deletedAt: null,
    };

    function setupValidTransferReferences() {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-new-a', companyId: 'company-a' });
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt-a', companyId: 'company-a' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a', companyId: 'company-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person-a', isActive: true });
    }

    function expectZeroTransferWrites() {
      expect(prisma.operationalPersonAssignment.updateMany).not.toHaveBeenCalled();
      expect(prisma.operationalPersonAssignment.create).not.toHaveBeenCalled();
      expect(prisma.supervisorAssignment.updateMany).not.toHaveBeenCalled();
      expect(prisma.supervisorAssignment.create).not.toHaveBeenCalled();
      expect(auditService.logWithClient).not.toHaveBeenCalled();
    }

    it('Company A cannot transfer a Company B root assignment', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(service.transfer(
        'pa-b',
        { departmentId: 'dept-new-a', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctxA,
        'user-a',
      )).rejects.toThrow(NotFoundException);

      expect(prisma.operationalPersonAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'pa-b', companyId: 'company-a', deletedAt: null },
      }));
      expectZeroTransferWrites();
    });

    it('Company A cannot continue a relationship to a Company B supervisor', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(currentA);
      setupValidTransferReferences();
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([{
          id: 'sa-foreign-supervisor',
          companyId: 'company-a',
          assignmentId: 'pa-a',
          supervisorAssignmentId: 'pa-supervisor-b',
          relationshipType: 'DIRECT',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          isActive: true,
          deletedAt: null,
          supervisorAssignment: { id: 'pa-supervisor-b', companyId: 'company-b' },
        }])
        .mockResolvedValueOnce([]);

      await expect(service.transfer('pa-a', {
        departmentId: 'dept-new-a',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{
          relationshipId: 'sa-foreign-supervisor',
          action: 'CONTINUE_ON_NEW_ASSIGNMENT',
        }],
      }, ctxA, 'user-a')).rejects.toThrow(BadRequestException);
      expectZeroTransferWrites();
    });

    it('Company A cannot continue a relationship for a Company B subordinate', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(currentA);
      setupValidTransferReferences();
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          id: 'sa-foreign-subordinate',
          companyId: 'company-a',
          assignmentId: 'pa-subordinate-b',
          supervisorAssignmentId: 'pa-a',
          relationshipType: 'DIRECT',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          isActive: true,
          deletedAt: null,
          assignment: { id: 'pa-subordinate-b', companyId: 'company-b' },
        }]);

      await expect(service.transfer('pa-a', {
        departmentId: 'dept-new-a',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{
          relationshipId: 'sa-foreign-subordinate',
          action: 'CONTINUE_ON_NEW_ASSIGNMENT',
        }],
      }, ctxA, 'user-a')).rejects.toThrow(BadRequestException);
      expectZeroTransferWrites();
    });

    it('Company A cannot submit a Company B relationship resolution when none is affected', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(currentA);
      setupValidTransferReferences();
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      await expect(service.transfer('pa-a', {
        departmentId: 'dept-new-a',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: 'sa-company-b', action: 'END_AT_TRANSFER' }],
      }, ctxA, 'user-a')).rejects.toThrow(BadRequestException);
      expectZeroTransferWrites();
    });
  });

  describe('findOne tenant isolation', () => {
    it('Company A cannot read Company B PersonAssignment by ID', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(service.findOne('pa-b', ctxA)).rejects.toThrow(NotFoundException);
      expect(prisma.operationalPersonAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pa-b', companyId: 'company-a', deletedAt: null },
        }),
      );
    });

    it('findOne uses companyId from context, preventing cross-company access', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      const promise = service.findOne('pa-b', ctxA);
      await expect(promise).rejects.toThrow(NotFoundException);

      const findCall = prisma.operationalPersonAssignment.findFirst.mock.calls[0][0];
      expect(findCall.where.companyId).toBe('company-a');
    });
  });

  describe('update tenant isolation', () => {
    it('Company A cannot update Company B PersonAssignment', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(service.update('pa-b', { notes: 'hacked' }, ctxA)).rejects.toThrow(NotFoundException);
    });

    it('companyId is never modifiable through update', async () => {
      const existing = {
        id: 'pa1', companyId: 'company-a', branchId: 'branch-a', departmentId: 'dept1',
        jobTitleId: 'jt1', personnelId: 'person1', assignmentType: 'PRIMARY',
        effectiveFrom: new Date('2026-01-01'), effectiveTo: null, notes: null,
      };
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      prisma.operationalPersonAssignment.update.mockResolvedValue(existing);

      await service.update('pa1', { notes: 'updated' }, ctxA, 'user-1');

      const updateCall = prisma.operationalPersonAssignment.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('companyId');
    });
  });

  describe('remove tenant isolation', () => {
    it('Company A cannot delete Company B PersonAssignment', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(service.remove('pa-b', ctxA)).rejects.toThrow(NotFoundException);
    });

    it('remove validates tenant through findOne which enforces companyId', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(service.remove('pa-b', ctxA)).rejects.toThrow(NotFoundException);
      expect(prisma.operationalPersonAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });
  });

  describe('findAll tenant isolation', () => {
    it('List only returns Company A PersonAssignments', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        { id: 'pa1', companyId: 'company-a', departmentId: 'dept1', personnelId: 'person1' },
      ]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);

      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a', deletedAt: null }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].companyId).toBe('company-a');
    });

    it('findAll never includes Company B records', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctxA);

      const findManyCall = prisma.operationalPersonAssignment.findMany.mock.calls[0][0];
      expect(findManyCall.where.companyId).toBe('company-a');
    });

    it('findAll search filter is scoped to company', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);

      await service.findAll({ search: 'engineer' }, ctxA);

      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-a',
          }),
        }),
      );
    });
  });

  describe('findByPerson tenant isolation', () => {
    it('findByPerson only returns assignments within the company', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);

      await service.findByPerson('person1', ctxA);

      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ personnelId: 'person1', companyId: 'company-a', deletedAt: null }),
        }),
      );
    });
  });
});
