import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PersonAssignmentsService } from './person-assignments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('PersonAssignmentsService', () => {
  let prisma: any;
  let auditService: any;
  let service: PersonAssignmentsService;
  const ctx: ActiveOperationalContext = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  const assignment = (overrides: Record<string, any> = {}) => ({
    id: 'pa1',
    companyId: 'company-a',
    branchId: 'branch-a',
    administrationId: null,
    departmentId: 'dept1',
    jobTitleId: 'jt1',
    personnelId: 'person1',
    assignmentType: 'PRIMARY',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    notes: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      operationalPersonAssignment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      department: { findFirst: jest.fn() },
      jobTitle: { findFirst: jest.fn() },
      branch: { findFirst: jest.fn() },
      administration: { findFirst: jest.fn() },
      operationalPerson: { findFirst: jest.fn() },
      supervisorAssignment: { count: jest.fn() },
      $transaction: jest.fn(),
    };
    auditService = { log: jest.fn() };
    service = new PersonAssignmentsService(prisma as PrismaService, auditService as AuditService);
  });

  describe('reference validation', () => {
    it('rejects a department not found in the company', async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      const promise = service.create(
        { departmentId: 'deptX', personnelId: 'person1', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'departmentId', code: 'validation.invalidReference' });
    });

    it('rejects a job title not found in the company', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept1' });
      prisma.jobTitle.findFirst.mockResolvedValue(null);

      const promise = service.create(
        { departmentId: 'dept1', jobTitleId: 'jtX', personnelId: 'person1', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'jobTitleId', code: 'validation.invalidReference' });
    });

    it('rejects an inactive or missing operational person', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept1' });
      prisma.operationalPerson.findFirst.mockResolvedValue(null);

      const promise = service.create(
        { departmentId: 'dept1', personnelId: 'personX', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'personnelId', code: 'validation.invalidReference' });
    });
  });

  describe('create', () => {
    it('rejects duplicate PRIMARY when one already exists for the person', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept1' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({ id: 'existing' });

      const promise = service.create(
        { departmentId: 'dept1', personnelId: 'person1', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'assignmentType', code: 'validation.duplicatePrimary' });
    });

    it('creates a SECONDARY assignment without PRIMARY enforcement', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept1' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.operationalPersonAssignment.create.mockResolvedValue(assignment({ assignmentType: 'SECONDARY' }));

      const result = await service.create(
        { departmentId: 'dept1', personnelId: 'person1', assignmentType: 'SECONDARY', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'OperationalPersonAssignment', userId: 'user-1' }),
      );
      expect(result.assignmentType).toBe('SECONDARY');
    });

    it('creates a PRIMARY assignment with audit log', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept1' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);
      prisma.operationalPersonAssignment.create.mockResolvedValue(assignment());

      const result = await service.create(
        { departmentId: 'dept1', personnelId: 'person1', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(result.departmentId).toBe('dept1');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'OperationalPersonAssignment' }),
      );
    });

    it('rejects effectiveTo before effectiveFrom', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept1' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });

      const promise = service.create(
        {
          departmentId: 'dept1',
          personnelId: 'person1',
          effectiveFrom: '2026-06-01T00:00:00.000Z',
          effectiveTo: '2026-01-01T00:00:00.000Z',
        },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'effectiveTo', code: 'validation.invalidRange' });
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the company', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([assignment()]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctx);

      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a', deletedAt: null }) }),
      );
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('filters by personnelId', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);

      await service.findAll({ personnelId: 'person1' }, ctx);

      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ personnelId: 'person1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when assignment is missing', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      const promise = service.findOne('nope', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.assignmentNotFound',
        message: 'Person assignment not found',
      });
    });

    it('returns assignment within the active company', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(assignment());

      const result = await service.findOne('pa1', ctx);
      expect(result.id).toBe('pa1');
    });
  });

  describe('update', () => {
    it('enforces single PRIMARY when type is PRIMARY', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(assignment())
        .mockResolvedValueOnce({ id: 'other-primary' });

      const promise = service.update('pa1', { assignmentType: 'PRIMARY' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'assignmentType', code: 'validation.duplicatePrimary' });
    });

    it('updates and returns the assignment with audit', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(assignment())
        .mockResolvedValueOnce(null);
      prisma.operationalPersonAssignment.update.mockResolvedValue(assignment({ notes: 'updated' }));

      const result = await service.update('pa1', { notes: 'updated' }, ctx, 'user-1');

      expect(result.notes).toBe('updated');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE', entity: 'OperationalPersonAssignment', userId: 'user-1' }),
      );
    });
  });

  describe('remove', () => {
    it('rejects deletion when active supervisor relationships exist', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(assignment());
      prisma.supervisorAssignment.count.mockResolvedValue(1);

      const promise = service.remove('pa1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'assignmentId', code: 'validation.hasDependencies' });
    });

    it('soft-deletes an assignment with no supervisor dependencies', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(assignment());
      prisma.supervisorAssignment.count.mockResolvedValue(0);
      prisma.operationalPersonAssignment.update.mockResolvedValue(assignment());

      const result = await service.remove('pa1', ctx, 'user-1');

      expect(prisma.operationalPersonAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pa1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entity: 'OperationalPersonAssignment', userId: 'user-1' }),
      );
      expect(result.message).toContain('deleted');
    });
  });

  describe('transfer', () => {
    it('rejects transfer on a non-PRIMARY assignment', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(assignment({ assignmentType: 'SECONDARY' }));

      const promise = service.transfer('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'assignmentId', code: 'validation.invalidOperation' });
    });

    it('rejects transfer when assignment already has an effectiveTo', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(
        assignment({ effectiveTo: new Date('2026-03-01') }),
      );

      const promise = service.transfer('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
    });

    it('rejects transfer when effectiveFrom is before original start', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(
        assignment({ effectiveFrom: new Date('2026-06-01') }),
      );

      const promise = service.transfer('pa1', { departmentId: 'dept2', effectiveFrom: '2026-03-01T00:00:00.000Z' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'effectiveFrom', code: 'validation.invalidRange' });
    });

    it('closes old assignment and creates a new one via transaction', async () => {
      const current = assignment();
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(null);
      prisma.department.findFirst.mockResolvedValue({ id: 'dept2' });
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });

      const mockTx = {
        operationalPersonAssignment: {
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue(assignment({ id: 'pa2', departmentId: 'dept2' })),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const result = await service.transfer(
        'pa1',
        { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(mockTx.operationalPersonAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pa1' }, data: { effectiveTo: expect.any(Date) } }),
      );
      expect(mockTx.operationalPersonAssignment.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TRANSFER', entity: 'OperationalPersonAssignment' }),
      );
      expect(result.departmentId).toBe('dept2');
    });
  });
});
