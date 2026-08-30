import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SupervisorAssignmentsService } from './supervisor-assignments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('SupervisorAssignments Tenant Isolation', () => {
  let prisma: any;
  let auditService: any;
  let service: SupervisorAssignmentsService;

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

  const personAssignment = (id: string, companyId: string, personnelId: string) => ({
    id,
    companyId,
    personnelId,
    departmentId: 'dept1',
    assignmentType: 'PRIMARY',
  });

  const supervisorRecord = (overrides: Record<string, any> = {}) => ({
    id: 'sa1',
    companyId: 'company-a',
    assignmentId: 'pa1',
    supervisorAssignmentId: 'pa2',
    relationshipType: 'DIRECT',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    isActive: true,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((fn: any) => fn(prisma)),
      operationalPersonAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      supervisorAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    auditService = { log: jest.fn(), logWithClient: jest.fn() };
    service = new SupervisorAssignmentsService(prisma as PrismaService, auditService as AuditService);
  });

  describe('create - cross-company reference rejection', () => {
    it('Company A cannot link assignment from Company B as the primary assignment', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      const promise = service.create(
        { assignmentId: 'pa-b', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({
        field: 'assignmentId',
        code: 'validation.invalidReference',
      });
      expect(prisma.operationalPersonAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });

    it('Company A cannot link assignment from Company B as the supervisor', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'company-a', 'personA'))
        .mockResolvedValueOnce(null);

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa-b', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({
        field: 'supervisorAssignmentId',
        code: 'validation.invalidReference',
      });
    });

    it('cannot create supervisor link with assignment from different company even if it exists in DB', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      const promise = service.create(
        { assignmentId: 'pa-from-company-b', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      expect(prisma.operationalPersonAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pa-from-company-b', companyId: 'company-a', deletedAt: null },
        }),
      );
    });

    it('creates supervisor assignment when both references belong to Company A', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'company-a', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'company-a', 'personB'));
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord());

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
        'user-1',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.supervisorAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
      expect(result.companyId).toBe('company-a');
    });
  });

  describe('findOne tenant isolation', () => {
    it('Company A cannot read Company B SupervisorAssignment by ID', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      await expect(service.findOne('sa-b', ctxA)).rejects.toThrow(NotFoundException);
      expect(prisma.supervisorAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'sa-b',
            companyId: 'company-a',
            deletedAt: null,
            assignment: { is: { OR: [{ branchId: 'branch-a' }, { branchId: null }] } },
          },
        }),
      );
    });

    it('findOne uses companyId from context', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      await expect(service.findOne('sa-b', ctxA)).rejects.toThrow(NotFoundException);

      const findCall = prisma.supervisorAssignment.findFirst.mock.calls[0][0];
      expect(findCall.where.companyId).toBe('company-a');
    });
  });

  describe('same-company cross-branch isolation', () => {
    const ctxA_otherBranch: ActiveOperationalContext = {
      contextKey: 'company-a:branch-c',
      scopeId: 'branch-c',
      companyId: 'company-a',
      branchId: 'branch-c',
      isDefault: false,
      source: 'EXPLICIT_SCOPE',
    } as ActiveOperationalContext;

    it('findOne filters through the subordinate assignment branch within the same company', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      await expect(service.findOne('sa-other-branch', ctxA)).rejects.toThrow(NotFoundException);

      const call = prisma.supervisorAssignment.findFirst.mock.calls[0][0];
      expect(call.where).toMatchObject({
        companyId: 'company-a',
        assignment: { is: { OR: [{ branchId: 'branch-a' }, { branchId: null }] } },
      });
    });

    it('findAll never spreads into another branch of the same company', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctxA);

      const call = prisma.supervisorAssignment.findMany.mock.calls[0][0];
      expect(call.where.assignment.is.OR).toEqual([
        { branchId: 'branch-a' },
        { branchId: null },
      ]);
    });

    it('getCandidates defaults to the active branch within the same company', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1', companyId: 'company-a', personnelId: 'p1', branchId: 'branch-c',
        departmentId: 'dept1', assignmentType: 'PRIMARY',
        effectiveFrom: new Date('2026-01-01'), effectiveTo: null, deletedAt: null,
      });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      await service.getCandidates('sa1', { page: '1', limit: '10' }, ctxA_otherBranch);

      const call = prisma.operationalPersonAssignment.findMany.mock.calls[0][0];
      expect(call.where).toMatchObject({ companyId: 'company-a', branchId: 'branch-c' });
    });
  });

  describe('update tenant isolation', () => {
    it('Company A cannot update Company B SupervisorAssignment', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      await expect(service.update('sa-b', { relationshipType: 'MATRIX' }, ctxA)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('update validates tenant through findOne which enforces companyId', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      await expect(service.update('sa-b', {}, ctxA)).rejects.toThrow(NotFoundException);
      expect(prisma.supervisorAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });

    it('cannot change supervisor to an assignment from a different company', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(supervisorRecord());
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      const promise = service.update(
        'sa1',
        { supervisorAssignmentId: 'pa-from-company-b' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({
        field: 'supervisorAssignmentId',
        code: 'validation.invalidReference',
      });
    });
  });

  describe('remove tenant isolation', () => {
    it('Company A cannot remove Company B SupervisorAssignment', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      await expect(service.remove('sa-b', ctxA)).rejects.toThrow(NotFoundException);
    });

    it('remove validates tenant through findOne which enforces companyId', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      await expect(service.remove('sa-b', ctxA)).rejects.toThrow(NotFoundException);
      expect(prisma.supervisorAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });
  });

  describe('findAll tenant isolation', () => {
    it('List only returns Company A SupervisorAssignments', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([supervisorRecord()]);
      prisma.supervisorAssignment.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);

      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a', deletedAt: null }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].companyId).toBe('company-a');
    });

    it('findAll never includes Company B records', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctxA);

      const findManyCall = prisma.supervisorAssignment.findMany.mock.calls[0][0];
      expect(findManyCall.where.companyId).toBe('company-a');
    });

    it('findAll search filter is scoped to company', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);

      await service.findAll({ search: 'manager' }, ctxA);

      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });
  });

  describe('getReportingLine tenant isolation', () => {
    it('getReportingLine queries only within company scope', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const result = await service.getReportingLine('pa1', ctxA);

      expect(result.reportingLine).toEqual([]);
      expect(result.depth).toBe(0);
      expect(prisma.supervisorAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });
  });

  describe('getSubordinates tenant isolation', () => {
    it('getSubordinates queries only within company scope', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.getSubordinates('pa1', ctxA);

      expect(result.subordinates).toEqual([]);
      expect(result.count).toBe(0);
      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });
  });

  describe('getCurrentTeam tenant isolation', () => {
    it('queries only within company scope', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(service.getCurrentTeam('sa-b', ctxA)).rejects.toThrow(NotFoundException);
      expect(prisma.operationalPersonAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });
  });

  describe('getCandidates tenant isolation', () => {
    it('queries only within company scope', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(service.getCandidates('sa-b', { page: '1', limit: '10' }, ctxA)).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkPreview tenant isolation', () => {
    it('validates supervisor within company scope', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(service.bulkPreview({
        supervisorAssignmentId: 'pa-b',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        assignmentIds: ['pa-x'],
      }, ctxA)).rejects.toThrow(BadRequestException);
    });

    it('loads subordinate assignments within company scope', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(
        personAssignment('pa1', 'company-a', 'personA'),
      );
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);

      const result = await service.bulkPreview({
        supervisorAssignmentId: 'pa1',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        assignmentIds: ['pa-b'],
      }, ctxA);

      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
      expect(result.summary.invalid).toBe(1);
    });
  });

  describe('bulkApply tenant isolation', () => {
    it('validates supervisor within company scope', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      await expect(service.bulkApply({
        supervisorAssignmentId: 'pa-b',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        assignmentIds: ['pa-x'],
      }, ctxA, 'user-1')).rejects.toThrow(BadRequestException);
    });
  });
});
