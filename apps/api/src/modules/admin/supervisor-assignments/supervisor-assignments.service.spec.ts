import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SupervisorAssignmentsService } from './supervisor-assignments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('SupervisorAssignmentsService', () => {
  let prisma: any;
  let auditService: any;
  let service: SupervisorAssignmentsService;
  const ctx: ActiveOperationalContext = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  const personAssignment = (id: string, personnelId: string) => ({
    id,
    companyId: 'company-a',
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
      operationalPersonAssignment: {
        findFirst: jest.fn(),
      },
      supervisorAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    auditService = { log: jest.fn() };
    service = new SupervisorAssignmentsService(prisma as PrismaService, auditService as AuditService);
  });

  describe('reference validation', () => {
    it('rejects a missing assignment reference', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      const promise = service.create({ assignmentId: 'paX', effectiveFrom: '2026-01-01T00:00:00.000Z' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'assignmentId', code: 'validation.invalidReference' });
    });

    it('rejects a missing supervisor assignment reference', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(null);

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'paX', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'supervisorAssignmentId', code: 'validation.invalidReference' });
    });
  });

  describe('create', () => {
    it('rejects self-reference (same person)', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personA'));

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'supervisorAssignmentId', code: 'validation.selfReference' });
    });

    it('detects a cycle when the supervisor chain loops back', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));

      // pa2 already reports to pa1 -> making pa1 report to pa2 would create a cycle
      prisma.supervisorAssignment.findFirst
        .mockResolvedValueOnce({ supervisorAssignmentId: 'pa1' }); // pa2 -> pa1

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'supervisorAssignmentId', code: 'validation.cycleDetected' });
    });

    it('creates a supervisor assignment with audit', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord());

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(prisma.supervisorAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'company-a', assignmentId: 'pa1', supervisorAssignmentId: 'pa2' }),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'SupervisorAssignment', userId: 'user-1' }),
      );
      expect(result.assignmentId).toBe('pa1');
    });

    it('creates a supervisor assignment without a supervisor (null supervisorAssignmentId)', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(personAssignment('pa1', 'personA'));
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord({ supervisorAssignmentId: null }));

      const result = await service.create(
        { assignmentId: 'pa1', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(result.supervisorAssignmentId).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the company', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([supervisorRecord()]);
      prisma.supervisorAssignment.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctx);

      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a', deletedAt: null }) }),
      );
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('filters by assignmentId', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);

      await service.findAll({ assignmentId: 'pa1' }, ctx);

      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignmentId: 'pa1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when record is missing', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const promise = service.findOne('nope', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.supervisorAssignmentNotFound',
        message: 'Supervisor assignment not found',
      });
    });

    it('returns a supervisor assignment within the active company', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(supervisorRecord());

      const result = await service.findOne('sa1', ctx);
      expect(result.id).toBe('sa1');
    });
  });

  describe('update', () => {
    it('rejects self-reference when changing the supervisor', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(
        supervisorRecord({ assignment: { personnelId: 'personA' } }),
      );
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa3', 'personA'));

      const promise = service.update(
        'sa1',
        { supervisorAssignmentId: 'pa3' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'supervisorAssignmentId', code: 'validation.selfReference' });
    });

    it('updates and returns the supervisor assignment with audit', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(supervisorRecord());
      prisma.supervisorAssignment.update.mockResolvedValue(
        supervisorRecord({ relationshipType: 'MATRIX' }),
      );

      const result = await service.update('sa1', { relationshipType: 'MATRIX' }, ctx, 'user-1');

      expect(result.relationshipType).toBe('MATRIX');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE', entity: 'SupervisorAssignment', userId: 'user-1' }),
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes a supervisor assignment with audit', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(supervisorRecord());
      prisma.supervisorAssignment.update.mockResolvedValue(supervisorRecord());

      const result = await service.remove('sa1', ctx, 'user-1');

      expect(prisma.supervisorAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sa1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REMOVE', entity: 'SupervisorAssignment', userId: 'user-1' }),
      );
      expect(result.message).toContain('removed');
    });
  });
});
