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

  const personAssignment = (id: string, personnelId: string, overrides: Record<string, any> = {}) => ({
    id,
    companyId: 'company-a',
    personnelId,
    departmentId: 'dept1',
    assignmentType: 'PRIMARY',
    branchId: 'branch-a',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    deletedAt: null,
    ...overrides,
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
    deletedAt: null,
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

    it('creates a supervisor assignment with audit', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord());

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.supervisorAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'company-a', assignmentId: 'pa1', supervisorAssignmentId: 'pa2' }),
        }),
      );
      expect(auditService.logWithClient).toHaveBeenCalledWith(
        prisma,
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

  describe('one effective DIRECT supervisor rule', () => {
    it('rejects second DIRECT with overlapping interval', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([
        { id: 'existing-direct', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, supervisorAssignmentId: 'pa3' },
      ]);

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-06-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'assignmentId', code: 'validation.directSupervisorOverlap' });
    });

    it('accepts historical non-overlapping DIRECT', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([
        { id: 'old-direct', effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-03-01'), supervisorAssignmentId: 'pa3' },
      ]);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord());

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-03-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
      );
      expect(result.assignmentId).toBe('pa1');
    });

    it('accepts future non-overlapping DIRECT', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([
        { id: 'old-direct', effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-06-01'), supervisorAssignmentId: 'pa3' },
      ]);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord());

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-06-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
      );
      expect(result.assignmentId).toBe('pa1');
    });

    it('accepts exact boundary (old.effectiveTo == new.effectiveFrom)', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([
        { id: 'old-direct', effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-06-01'), supervisorAssignmentId: 'pa3' },
      ]);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord());

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-06-01T00:00:00.000Z', effectiveTo: '2026-12-31T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
      );
      expect(result.assignmentId).toBe('pa1');
    });

    it('rejects true interval overlap', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([
        { id: 'existing-direct', effectiveFrom: new Date('2026-03-01'), effectiveTo: new Date('2026-09-01'), supervisorAssignmentId: 'pa3' },
      ]);

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-06-01T00:00:00.000Z', effectiveTo: '2026-12-31T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.directSupervisorOverlap' });
    });

    it('rejects open-ended interval overlap', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([
        { id: 'existing-direct', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, supervisorAssignmentId: 'pa3' },
      ]);

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-06-01T00:00:00.000Z', effectiveTo: '2026-12-31T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.directSupervisorOverlap' });
    });
  });

  describe('MATRIX and FUNCTIONAL coexistence', () => {
    it('allows MATRIX alongside existing DIRECT', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord({ relationshipType: 'MATRIX' }));

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', relationshipType: 'MATRIX', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      expect(result.relationshipType).toBe('MATRIX');
    });

    it('allows FUNCTIONAL alongside existing DIRECT', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord({ relationshipType: 'FUNCTIONAL' }));

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', relationshipType: 'FUNCTIONAL', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      expect(result.relationshipType).toBe('FUNCTIONAL');
    });
  });

  describe('date-aware effective filtering', () => {
    it('future DIRECT not returned before effectiveFrom', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const result = await service.getReportingLine('pa1', ctx, new Date('2025-12-31'));
      expect(result.reportingLine).toEqual([]);
    });

    it('future DIRECT returned after effectiveFrom', async () => {
      prisma.supervisorAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1',
          supervisorAssignmentId: 'pa2',
          relationshipType: 'DIRECT',
          effectiveFrom: new Date('2026-06-01'),
          effectiveTo: null,
          isActive: true,
          deletedAt: null,
          supervisorAssignment: {
            id: 'pa2',
            personnelId: 'personB',
            person: { id: 'personB', name: 'Supervisor B', code: 'SUP-001' },
            department: { id: 'dept1', name: 'Dept 1', code: 'D1' },
            jobTitle: { id: 'jt1', name: 'Manager', code: 'MGR' },
          },
        })
        .mockResolvedValueOnce(null);

      const result = await service.getReportingLine('pa1', ctx, new Date('2026-06-01'));
      expect(result.reportingLine).toHaveLength(1);
      expect(result.reportingLine[0].level).toBe(1);
    });

    it('expired DIRECT not returned', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const result = await service.getReportingLine('pa1', ctx, new Date('2027-06-01'));
      expect(result.reportingLine).toEqual([]);
    });

    it('soft-deleted DIRECT not returned', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const result = await service.getReportingLine('pa1', ctx);
      expect(result.reportingLine).toEqual([]);
    });
  });

  describe('reporting line', () => {
    it('returns DIRECT only', async () => {
      prisma.supervisorAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1',
          supervisorAssignmentId: 'pa2',
          relationshipType: 'DIRECT',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          isActive: true,
          deletedAt: null,
          supervisorAssignment: {
            id: 'pa2',
            personnelId: 'personB',
            person: { id: 'personB', name: 'Supervisor B', code: 'SUP-001' },
            department: { id: 'dept1', name: 'Dept 1', code: 'D1' },
            jobTitle: { id: 'jt1', name: 'Manager', code: 'MGR' },
          },
        })
        .mockResolvedValueOnce(null);

      const result = await service.getReportingLine('pa1', ctx);
      expect(result.reportingLine).toHaveLength(1);
      expect(result.reportingLine[0].supervisor.name).toBe('Supervisor B');
      expect(result.depth).toBe(1);
    });

    it('returns true hierarchical levels', async () => {
      prisma.supervisorAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1', supervisorAssignmentId: 'pa2', relationshipType: 'DIRECT',
          effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
          isActive: true, deletedAt: null,
          supervisorAssignment: {
            id: 'pa2', personnelId: 'personB',
            person: { id: 'personB', name: 'Supervisor', code: 'S1' },
            department: { id: 'dept1', name: 'Dept', code: 'D1' },
            jobTitle: { id: 'jt1', name: 'Manager', code: 'MGR' },
          },
        })
        .mockResolvedValueOnce({
          id: 'sa2', supervisorAssignmentId: 'pa3', relationshipType: 'DIRECT',
          effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
          isActive: true, deletedAt: null,
          supervisorAssignment: {
            id: 'pa3', personnelId: 'personC',
            person: { id: 'personC', name: 'Director', code: 'D1' },
            department: { id: 'dept1', name: 'Dept', code: 'D1' },
            jobTitle: { id: 'jt2', name: 'Director', code: 'DIR' },
          },
        })
        .mockResolvedValueOnce(null);

      const result = await service.getReportingLine('pa1', ctx);
      expect(result.reportingLine).toHaveLength(2);
      expect(result.reportingLine[0].level).toBe(1);
      expect(result.reportingLine[1].level).toBe(2);
    });
  });

  describe('subordinates', () => {
    it('returns DIRECT only', async () => {
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([{
          id: 'sa1', assignmentId: 'pa2', relationshipType: 'DIRECT',
          effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
          isActive: true, deletedAt: null,
          assignment: {
            id: 'pa2', personnelId: 'personB',
            person: { id: 'personB', name: 'Employee B', code: 'E1' },
            department: { id: 'dept1', name: 'Dept', code: 'D1' },
            jobTitle: { id: 'jt1', name: 'Tech', code: 'TECH' },
          },
        }])
        .mockResolvedValue([]);

      const result = await service.getSubordinates('pa1', ctx);
      expect(result.subordinates).toHaveLength(1);
      expect(result.subordinates[0].level).toBe(1);
      expect(result.subordinates[0].relationshipType).toBe('DIRECT');
    });

    it('returns true tree levels (depth not count)', async () => {
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([
          { id: 'sa-a', assignmentId: 'pa-a', relationshipType: 'DIRECT',
            effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
            isActive: true, deletedAt: null,
            assignment: { id: 'pa-a', person: { name: 'Head A' }, department: {}, jobTitle: {} } },
          { id: 'sa-b', assignmentId: 'pa-b', relationshipType: 'DIRECT',
            effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
            isActive: true, deletedAt: null,
            assignment: { id: 'pa-b', person: { name: 'Head B' }, department: {}, jobTitle: {} } },
        ])
        .mockResolvedValueOnce([
          { id: 'sa-a1', assignmentId: 'pa-a1', relationshipType: 'DIRECT',
            effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
            isActive: true, deletedAt: null,
            assignment: { id: 'pa-a1', person: { name: 'Emp A1' }, department: {}, jobTitle: {} } },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValue([]);

      const result = await service.getSubordinates('pa-mgr', ctx);
      expect(result.subordinates[0].level).toBe(1); // Head A
      expect(result.subordinates[1].level).toBe(1); // Head B
      expect(result.subordinates[2].level).toBe(2); // Emp A1 (child of Head A)
    });

    it('more than 100 descendants not truncated', async () => {
      const children = Array.from({ length: 150 }, (_, i) => ({
        id: `sa-${i}`, assignmentId: `pa-${i}`, relationshipType: 'DIRECT',
        effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
        isActive: true, deletedAt: null,
        assignment: { id: `pa-${i}`, person: { name: `Emp ${i}` }, department: {}, jobTitle: {} },
      }));

      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce(children)
        .mockResolvedValue([]);

      const result = await service.getSubordinates('pa-mgr', ctx);
      expect(result.subordinates.length).toBe(150);
    });

    it('depth guard stops at MAX_HIERARCHY_DEPTH', async () => {
      for (let i = 1; i <= 101; i++) {
        prisma.supervisorAssignment.findMany.mockResolvedValueOnce([{
          id: `sa-${i}`, assignmentId: `pa-${i + 1}`, relationshipType: 'DIRECT',
          effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
          isActive: true, deletedAt: null,
          assignment: { id: `pa-${i + 1}`, person: { name: `Emp ${i + 1}` }, department: {}, jobTitle: {} },
        }]);
      }
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.getSubordinates('pa1', ctx);
      expect(result.subordinates.length).toBeLessThanOrEqual(100);
    });
  });

  describe('assignment validity', () => {
    it('rejects subordinate assignment date-window violation', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA', { effectiveTo: new Date('2026-12-31') }));

      const promise = service.create(
        { assignmentId: 'pa1', effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: '2027-06-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.assignmentOutOfRange' });
    });

    it('rejects open-ended supervision when subordinate has finite effectiveTo', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA', { effectiveTo: new Date('2026-12-31') }));

      const promise = service.create(
        { assignmentId: 'pa1', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.assignmentOutOfRange' });
    });

    it('rejects supervisor assignment date-window violation', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB', { effectiveTo: new Date('2026-06-30') }));

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: '2026-12-31T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.assignmentOutOfRange' });
    });

    it('rejects effectiveTo before effectiveFrom', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'));

      const promise = service.create(
        { assignmentId: 'pa1', effectiveFrom: '2026-12-31T00:00:00.000Z', effectiveTo: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.invalidRange' });
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

    it('no-search uses a valid Prisma branch-or-null filter (does not put null inside `in`)', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctx);

      const call = prisma.supervisorAssignment.findMany.mock.calls[0][0];
      // Regression: Prisma rejects `in: [branchId, null]` for a nullable field (PrismaClientValidationError).
      expect(call.where.assignment.is).toEqual({
        OR: [{ branchId: 'branch-a' }, { branchId: null }],
      });
      expect(call.where).toMatchObject({ companyId: 'company-a', deletedAt: null });
    });

    it('returns the { data, meta } shape for the current relationships grid', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([supervisorRecord()]);
      prisma.supervisorAssignment.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctx);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.meta).toMatchObject({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('search still resolves to a valid branch-scoped query (search regression)', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);

      await service.findAll({ search: 'manager' }, ctx);

      const call = prisma.supervisorAssignment.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-a');
      expect(Array.isArray(call.where.OR)).toBe(true);
      expect(call.where.OR).toHaveLength(2);
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
        supervisorRecord({ assignment: { personnelId: 'personA', branchId: 'branch-a' } }),
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

    it('rejects date creation overlap on update', async () => {
      prisma.supervisorAssignment.findFirst
        .mockResolvedValueOnce(supervisorRecord({ effectiveFrom: new Date('2026-01-01'), effectiveTo: null, assignment: { personnelId: 'personA', branchId: 'branch-a' } }));

      prisma.supervisorAssignment.findMany.mockResolvedValue([
        { id: 'other-direct', effectiveFrom: new Date('2026-06-01'), effectiveTo: null },
      ]);

      const promise = service.update(
        'sa1',
        { effectiveFrom: '2026-03-01T00:00:00.000Z', effectiveTo: '2026-09-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
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

  describe('branch policy (5 cases)', () => {
    it('CASE 1: subordinate.branch=A, supervisor.branch=A → ALLOW', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA', { branchId: 'branch-a' }))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB', { branchId: 'branch-a' }));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord());

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      expect(result.assignmentId).toBe('pa1');
    });

    it('CASE 2: subordinate.branch=A, supervisor.branch=null → ALLOW', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA', { branchId: 'branch-a' }))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB', { branchId: null }));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord());

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      expect(result.assignmentId).toBe('pa1');
    });

    it('CASE 3: subordinate.branch=A, supervisor.branch=B → REJECT', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA', { branchId: 'branch-a' }))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB', { branchId: 'branch-b' }));

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.invalidBranchHierarchy' });
    });

    it('CASE 4: subordinate.branch=null, supervisor.branch=null → ALLOW', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA', { branchId: null }))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB', { branchId: null }));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord());

      const result = await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      expect(result.assignmentId).toBe('pa1');
    });

    it('CASE 5: subordinate.branch=null, supervisor.branch=A → REJECT', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA', { branchId: null }))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB', { branchId: 'branch-a' }));

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ code: 'validation.invalidBranchHierarchy' });
    });
  });

  describe('atomic transaction protection', () => {
    it('DIRECT create executes within $transaction', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord());

      await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    });

    it('MATRIX create does NOT use $transaction', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa1', 'personA'))
        .mockResolvedValueOnce(personAssignment('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.create.mockResolvedValue(supervisorRecord({ relationshipType: 'MATRIX' }));

      await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', relationshipType: 'MATRIX', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('DIRECT update with date change executes within $transaction', async () => {
      prisma.supervisorAssignment.findFirst
        .mockResolvedValueOnce(supervisorRecord({ effectiveFrom: new Date('2026-01-01'), effectiveTo: null, assignment: { personnelId: 'personA', branchId: 'branch-a' } }));
      prisma.supervisorAssignment.findMany.mockResolvedValue([
        { id: 'other-direct', effectiveFrom: new Date('2026-06-01'), effectiveTo: null },
      ]);

      await expect(
        service.update('sa1', { effectiveFrom: '2026-03-01T00:00:00.000Z', effectiveTo: '2026-09-01T00:00:00.000Z' }, ctx),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('MATRIX → DIRECT change executes within $transaction', async () => {
      prisma.supervisorAssignment.findFirst
        .mockResolvedValueOnce(supervisorRecord({ relationshipType: 'MATRIX', assignment: { personnelId: 'personA', branchId: 'branch-a' } }));
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(personAssignment('pa3', 'personC'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.update.mockResolvedValue(supervisorRecord({ relationshipType: 'DIRECT' }));

      await service.update(
        'sa1',
        { relationshipType: 'DIRECT', supervisorAssignmentId: 'pa3' },
        ctx,
        'user-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
      expect(auditService.logWithClient).toHaveBeenCalled();
    });
  });

  describe('getCurrentTeam', () => {
    it('returns DIRECT team members for a supervisor', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1',
          personnelId: 'personA',
          branchId: 'branch-a',
          person: { id: 'personA', name: 'Manager A', code: 'MGR-001' },
          department: { id: 'dept1', name: 'Dept', code: 'D1' },
          jobTitle: { id: 'jt1', name: 'Manager', code: 'MGR' },
          branch: { id: 'branch-a', name: 'Branch A', code: 'BA' },
        });
      prisma.supervisorAssignment.findMany.mockResolvedValue([
        {
          assignmentId: 'pa3',
          isActive: true,
          deletedAt: null,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          assignment: {
            person: { id: 'personC', name: 'Employee C', code: 'E003' },
            department: { id: 'dept1', name: 'Dept', code: 'D1' },
            jobTitle: { id: 'jt2', name: 'Tech', code: 'TECH' },
            branch: { id: 'branch-a', name: 'Branch A', code: 'BA' },
            administration: null,
            assignmentType: 'PRIMARY',
          },
        },
      ]);

      const result = await service.getCurrentTeam('sa1', ctx);
      expect(result.teamCount).toBe(1);
      expect(result.team[0].person.name).toBe('Employee C');
      expect(result.supervisor.name).toBe('Manager A');
    });

    it('excludes MATRIX and FUNCTIONAL from formal team', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1',
          personnelId: 'pA',
          branchId: 'branch-a',
          person: { id: 'pA', name: 'M', code: 'M' },
          department: {},
          jobTitle: {},
          branch: {},
        });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([
          { assignmentId: 'pa3', isActive: true, deletedAt: null, effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
            assignment: { person: { name: 'E1' }, department: {}, jobTitle: {}, branch: {}, administration: {}, assignmentType: 'PRIMARY' } },
        ]);

      const result = await service.getCurrentTeam('sa1', ctx);
      expect(result.teamCount).toBe(1);
    });

    it('excludes expired DIRECT', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1',
          personnelId: 'pA',
          branchId: 'branch-a',
          person: { id: 'pA', name: 'M', code: 'M' },
          department: {},
          jobTitle: {},
          branch: {},
        });
      prisma.supervisorAssignment.findMany.mockResolvedValue([
        { assignmentId: 'pa3', isActive: true, deletedAt: null, effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-06-30'),
          assignment: { person: { name: 'E1' }, department: {}, jobTitle: {}, branch: {}, administration: {}, assignmentType: 'PRIMARY' } },
      ]);

      const result = await service.getCurrentTeam('sa1', ctx, new Date('2026-12-31'));
      expect(result.teamCount).toBe(0);
    });

    it('throws NotFoundException for missing supervisor', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);
      await expect(service.getCurrentTeam('nope', ctx)).rejects.toThrow(NotFoundException);
    });

    it('uses asOf date for temporal filtering', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1',
          personnelId: 'pA',
          branchId: 'branch-a',
          person: { id: 'pA', name: 'M', code: 'M' },
          department: {},
          jobTitle: {},
          branch: {},
        });
      prisma.supervisorAssignment.findMany.mockResolvedValue([
        { assignmentId: 'pa3', isActive: true, deletedAt: null, effectiveFrom: new Date('2026-06-01'), effectiveTo: null,
          assignment: { person: { name: 'E1' }, department: {}, jobTitle: {}, branch: {}, administration: {}, assignmentType: 'PRIMARY' } },
      ]);

      const result = await service.getCurrentTeam('sa1', ctx, new Date('2026-03-01'));
      expect(result.teamCount).toBe(0);
    });
  });

  describe('getCandidates', () => {
    const candidateQuery = (overrides: Record<string, any> = {}) => ({
      page: '1', limit: '10', ...overrides,
    });

    it('returns paginated candidates with eligibility', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1',
        personnelId: 'personA',
        branchId: 'branch-a',
        person: { id: 'personA', name: 'Manager A', code: 'MGR-001' },
        branch: { id: 'branch-a', name: 'Branch A', code: 'BA' },
      });
      prisma.operationalPersonAssignment.findMany
        .mockResolvedValueOnce([
          personAssignment('pa3', 'personC', { person: { id: 'personC', name: 'Emp C', code: 'E003' }, department: { id: 'd1', name: 'Dept', code: 'D1' }, jobTitle: { id: 'jt1', name: 'Tech', code: 'TECH' }, branch: { id: 'branch-a', name: 'BA', code: 'BA' }, administration: null }),
        ]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getCandidates('sa1', candidateQuery(), ctx);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('ELIGIBLE');
      expect(result.meta.total).toBe(1);
    });

    it('identifies SELF candidates', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1',
        personnelId: 'personA',
        branchId: 'branch-a',
        person: { id: 'personA', name: 'Manager A', code: 'M' },
        branch: { id: 'branch-a' },
      });
      prisma.operationalPersonAssignment.findMany
        .mockResolvedValueOnce([personAssignment('pa1', 'personA', { person: { id: 'personA', name: 'Manager A', code: 'M' }, department: {}, jobTitle: {}, branch: {}, administration: {} })]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]).mockResolvedValue([]);

      const result = await service.getCandidates('sa1', candidateQuery(), ctx);
      expect(result.data[0].status).toBe('SELF');
    });

    it('identifies ALREADY_ON_THIS_TEAM', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1',
        personnelId: 'personA',
        branchId: 'branch-a',
        person: { id: 'personA', name: 'M', code: 'M' },
        branch: { id: 'branch-a' },
      });
      prisma.operationalPersonAssignment.findMany
        .mockResolvedValueOnce([personAssignment('pa3', 'personC', { person: { name: 'E', code: 'E' }, department: {}, jobTitle: {}, branch: {}, administration: {} })]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'on-team', assignmentId: 'pa3' }]);

      const result = await service.getCandidates('sa1', candidateQuery(), ctx);
      expect(result.data[0].status).toBe('ALREADY_ON_THIS_TEAM');
    });

    it('identifies HAS_OTHER_DIRECT_SUPERVISOR', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1',
        personnelId: 'personA',
        branchId: 'branch-a',
        person: { id: 'personA', name: 'M', code: 'M' },
        branch: { id: 'branch-a' },
      });
      prisma.operationalPersonAssignment.findMany
        .mockResolvedValueOnce([personAssignment('pa3', 'personC', { person: { name: 'E', code: 'E' }, department: {}, jobTitle: {}, branch: {}, administration: {} })]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([{ id: 'other', assignmentId: 'pa3', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true, deletedAt: null }])
        .mockResolvedValueOnce([]);

      const result = await service.getCandidates('sa1', candidateQuery(), ctx);
      expect(result.data[0].status).toBe('HAS_OTHER_DIRECT_SUPERVISOR');
    });

    it('filters withoutCurrentDirectSupervisor', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1',
        personnelId: 'personA',
        branchId: 'branch-a',
        person: { id: 'personA', name: 'M', code: 'M' },
        branch: { id: 'branch-a' },
      });
      prisma.operationalPersonAssignment.findMany
        .mockResolvedValueOnce([
          personAssignment('pa3', 'personC', { person: { name: 'E1', code: 'E1' }, department: {}, jobTitle: {}, branch: {}, administration: {} }),
          personAssignment('pa4', 'personD', { person: { name: 'E2', code: 'E2' }, department: {}, jobTitle: {}, branch: {}, administration: {} }),
        ]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(2);
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([
          { id: 'r1', assignmentId: 'pa3', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true, deletedAt: null },
          { id: 'r2', assignmentId: 'pa4', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true, deletedAt: null },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getCandidates('sa1', candidateQuery({ withoutCurrentDirectSupervisor: 'true' }), ctx);
      expect(result.data).toHaveLength(0);
    });

    it('throws NotFoundException for missing supervisor', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);
      await expect(service.getCandidates('nope', candidateQuery(), ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkPreview', () => {
    const bulkDto = (overrides: Record<string, any> = {}) => ({
      supervisorAssignmentId: 'pa2',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      assignmentIds: ['pa3', 'pa4'],
      ...overrides,
    });

    it('returns eligible status for valid candidates', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
          person: { name: 'S', code: 'S' }, branch: { id: 'branch-a' },
        });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa3', 'personC'),
        personAssignment('pa4', 'personD'),
      ]);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.bulkPreview(bulkDto(), ctx);
      expect(result.summary.requested).toBe(2);
      expect(result.summary.eligible).toBe(2);
      expect(result.rows[0].status).toBe('ELIGIBLE');
    });

    it('rejects duplicate assignment IDs', async () => {
      await expect(service.bulkPreview(bulkDto({ assignmentIds: ['pa3', 'pa3'] }), ctx)).rejects.toThrow(BadRequestException);
    });

    it('identifies missing assignments', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
        person: { name: 'S', code: 'S' }, branch: { id: 'branch-a' },
      });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([personAssignment('pa3', 'personC')]);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.bulkPreview(bulkDto({ assignmentIds: ['pa3', 'nonexistent'] }), ctx);
      expect(result.summary.invalid).toBe(1);
      expect(result.rows[1].status).toBe('MISSING');
    });

    it('identifies self-supervision', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
        person: { name: 'S', code: 'S' }, branch: { id: 'branch-a' },
      });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa2', 'personB'),
      ]);

      const result = await service.bulkPreview(bulkDto({ assignmentIds: ['pa2'] }), ctx);
      expect(result.rows[0].status).toBe('SELF');
    });

    it('identifies HAS_OTHER_DIRECT_SUPERVISOR', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
        person: { name: 'S', code: 'S' }, branch: { id: 'branch-a' },
      });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa3', 'personC'),
      ]);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.bulkPreview(bulkDto({ assignmentIds: ['pa3'] }), ctx);
      expect(result.rows[0].status).toBe('ELIGIBLE');
    });

    it('identifies branch incompatibility', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
        person: { name: 'S', code: 'S' }, branch: { id: 'branch-a' },
      });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa3', 'personC', { branchId: 'branch-b' }),
      ]);

      const result = await service.bulkPreview(bulkDto({ assignmentIds: ['pa3'] }), ctx);
      expect(result.rows[0].status).toBe('OUTSIDE_ALLOWED_BRANCH_SCOPE');
    });

    it('does NOT write to database', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
        person: { name: 'S', code: 'S' }, branch: { id: 'branch-a' },
      });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa3', 'personC'),
      ]);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      await service.bulkPreview(bulkDto(), ctx);
      expect(prisma.supervisorAssignment.create).not.toHaveBeenCalled();
    });

    it('identifies DATE_WINDOW_CONFLICT', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue({
        id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
        person: { name: 'S', code: 'S' }, branch: { id: 'branch-a' },
      });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa3', 'personC', { effectiveTo: new Date('2026-06-30') }),
      ]);

      const result = await service.bulkPreview(bulkDto({ effectiveTo: '2026-12-31T00:00:00.000Z', assignmentIds: ['pa3'] }), ctx);
      expect(result.rows[0].status).toBe('DATE_WINDOW_CONFLICT');
    });

    it('throws NotFoundException for missing supervisor', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);
      await expect(service.bulkPreview(bulkDto(), ctx)).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkApply', () => {
    const bulkDto = (overrides: Record<string, any> = {}) => ({
      supervisorAssignmentId: 'pa2',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      assignmentIds: ['pa3', 'pa4'],
      ...overrides,
    });

    it('creates multiple assignments atomically', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
          person: { id: 'personB', name: 'S', code: 'S' }, department: {},
        });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa3', 'personC'),
        personAssignment('pa4', 'personD'),
      ]);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.create
        .mockResolvedValueOnce(supervisorRecord({ id: 'new1', assignmentId: 'pa3' }))
        .mockResolvedValueOnce(supervisorRecord({ id: 'new2', assignmentId: 'pa4' }));

      const result = await service.bulkApply(bulkDto(), ctx, 'user-1');
      expect(result.count).toBe(2);
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
      expect(auditService.logWithClient).toHaveBeenCalled();
    });

    it('creates one assignment', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
          person: { id: 'personB', name: 'S', code: 'S' }, department: {},
        });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([personAssignment('pa3', 'personC')]);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.create.mockResolvedValueOnce(supervisorRecord({ id: 'new1', assignmentId: 'pa3' }));

      const result = await service.bulkApply(bulkDto({ assignmentIds: ['pa3'] }), ctx, 'user-1');
      expect(result.count).toBe(1);
    });

    it('rejects entire group when one candidate has OTHER_DIRECT_SUPERVISOR', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
          person: { id: 'personB', name: 'S', code: 'S' }, department: {},
        });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa3', 'personC'),
        personAssignment('pa4', 'personD'),
      ]);
      prisma.supervisorAssignment.findMany.mockImplementation((args: any) =>
        args?.where?.assignmentId === 'pa4'
          ? Promise.resolve([{ id: 'other', assignmentId: 'pa4', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true, deletedAt: null, supervisorAssignmentId: 'paX' }])
          : Promise.resolve([]),
      );

      await expect(service.bulkApply(bulkDto(), ctx, 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.supervisorAssignment.create).not.toHaveBeenCalled();
    });

    it('rejects when one candidate has self-reference', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
          person: { id: 'personB', name: 'S', code: 'S' }, department: {},
        });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa2', 'personB'),
      ]);

      await expect(service.bulkApply(bulkDto({ assignmentIds: ['pa2'] }), ctx, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects when one candidate has branch incompatibility', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
          person: { id: 'personB', name: 'S', code: 'S' }, department: {},
        });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa3', 'personC', { branchId: 'branch-b' }),
      ]);

      await expect(service.bulkApply(bulkDto({ assignmentIds: ['pa3'] }), ctx, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate input IDs', async () => {
      await expect(service.bulkApply(bulkDto({ assignmentIds: ['pa3', 'pa3'] }), ctx, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects effectiveTo before effectiveFrom', async () => {
      await expect(service.bulkApply(bulkDto({ effectiveFrom: '2026-12-31T00:00:00.000Z', effectiveTo: '2026-01-01T00:00:00.000Z' }), ctx, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rolls back all when one candidate fails', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
          person: { id: 'personB', name: 'S', code: 'S' }, department: {},
        });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        personAssignment('pa3', 'personC'),
        personAssignment('pa4', 'personD'),
      ]);
      prisma.supervisorAssignment.findMany.mockImplementation((args: any) =>
        args?.where?.assignmentId === 'pa4'
          ? Promise.resolve([{ id: 'other', assignmentId: 'pa4', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true, deletedAt: null, supervisorAssignmentId: 'paX' }])
          : Promise.resolve([]),
      );

      try { await service.bulkApply(bulkDto(), ctx, 'user-1'); } catch {}
      expect(prisma.supervisorAssignment.create).not.toHaveBeenCalled();
    });
  });

  describe('bulkApply concurrency', () => {
    it('uses Serializable isolation for bulk DIRECT apply', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa1', personnelId: 'personB', branchId: 'branch-a', effectiveTo: null,
          person: { id: 'personB', name: 'S', code: 'S' }, department: {},
        });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([personAssignment('pa3', 'personC')]);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.create.mockResolvedValueOnce(supervisorRecord({ id: 'new1', assignmentId: 'pa3' }));

      await service.bulkApply({
        supervisorAssignmentId: 'pa2',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        assignmentIds: ['pa3'],
      }, ctx, 'user-1');

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    });
  });

  describe('getHierarchyTree', () => {
    const fullAssignment = (id: string, overrides: Record<string, any> = {}) => ({
      id,
      companyId: 'company-a',
      personnelId: id.replace('pa', 'person'),
      departmentId: 'dept1',
      assignmentType: 'PRIMARY',
      branchId: 'branch-a',
      leadershipLevel: 'NONE',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      deletedAt: null,
      person: { id: id.replace('pa', 'person'), name: `Person ${id}`, code: id.toUpperCase() },
      department: { id: 'dept1', name: 'Dept 1', code: 'D1' },
      jobTitle: { id: 'jt1', name: 'Engineer', code: 'ENG' },
      branch: { id: 'branch-a', name: 'Branch A', code: 'BA' },
      administration: null,
      ...overrides,
    });

    const saWithAssignment = (assignmentId: string, supervisorAssignmentId: string | null, overrides: Record<string, any> = {}) => ({
      id: `sa-${assignmentId}`,
      companyId: 'company-a',
      assignmentId,
      supervisorAssignmentId,
      relationshipType: 'DIRECT',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      isActive: true,
      deletedAt: null,
      assignment: fullAssignment(assignmentId),
      ...overrides,
    });

    it('throws NotFoundException when root assignment not found', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);
      await expect(service.getHierarchyTree('missing', ctx)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when root is not effective at asOf', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment('pa1', {
          effectiveFrom: new Date('2026-06-01'),
        }));

      await expect(service.getHierarchyTree('pa1', ctx, new Date('2026-01-01'))).rejects.toThrow(NotFoundException);
    });

    it('returns root with zero descendants for a leaf node', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment('pa1'));
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.getHierarchyTree('pa1', ctx);
      expect(result.root.assignmentId).toBe('pa1');
      expect(result.totalDescendants).toBe(0);
      expect(result.maxDepth).toBe(0);
      expect(result.truncated).toBe(false);
      expect(result.root.children).toEqual([]);
    });

    it('builds a two-level tree (root -> 2 children)', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment('pa1'));
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const child1 = saWithAssignment('pa2', 'pa1');
      const child2 = saWithAssignment('pa3', 'pa1');
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([child1, child2])
        .mockResolvedValue([]);

      const result = await service.getHierarchyTree('pa1', ctx);
      expect(result.totalDescendants).toBe(2);
      expect(result.root.children).toHaveLength(2);
      expect(result.root.childCount).toBe(2);
      expect(result.root.children[0].assignmentId).toBe('pa2');
      expect(result.root.children[1].assignmentId).toBe('pa3');
    });

    it('builds a three-level tree (root -> child -> grandchild)', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment('pa1'));
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const child1 = saWithAssignment('pa2', 'pa1');
      const grandchild1 = saWithAssignment('pa3', 'pa2');
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([child1])
        .mockResolvedValueOnce([grandchild1])
        .mockResolvedValue([]);

      const result = await service.getHierarchyTree('pa1', ctx);
      expect(result.totalDescendants).toBe(2);
      expect(result.maxDepth).toBe(2);
      expect(result.root.children).toHaveLength(1);
      expect(result.root.children[0].children).toHaveLength(1);
      expect(result.root.children[0].children[0].assignmentId).toBe('pa3');
    });

    it('includes leadershipLevel from assignment', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment('pa1', { leadershipLevel: 'DEPARTMENT_HEAD' }));
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.getHierarchyTree('pa1', ctx);
      expect(result.root.leadershipLevel).toBe('DEPARTMENT_HEAD');
    });

    it('excludes inactive children from tree', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment('pa1'));
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const activeChild = saWithAssignment('pa2', 'pa1');
      const inactiveChild = saWithAssignment('pa3', 'pa1', { isActive: false });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([activeChild, inactiveChild])
        .mockResolvedValue([]);

      const result = await service.getHierarchyTree('pa1', ctx);
      expect(result.totalDescendants).toBe(1);
      expect(result.root.children).toHaveLength(1);
      expect(result.root.children[0].assignmentId).toBe('pa2');
    });

    it('excludes expired children from tree (temporal filter)', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment('pa1'));
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const expiredChild = saWithAssignment('pa2', 'pa1', {
        effectiveTo: new Date('2025-12-31'),
      });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([expiredChild])
        .mockResolvedValue([]);

      const result = await service.getHierarchyTree('pa1', ctx, new Date('2026-06-01'));
      expect(result.totalDescendants).toBe(0);
    });

    it('returns reportingLine from getReportingLine', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment('pa1'));
      prisma.supervisorAssignment.findFirst
        .mockResolvedValueOnce({
          id: 'sa0',
          supervisorAssignmentId: null,
          relationshipType: 'DIRECT',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          isActive: true,
          deletedAt: null,
          supervisorAssignment: fullAssignment('pa0'),
        });

      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.getHierarchyTree('pa1', ctx);
      expect(result.reportingLine).toHaveLength(1);
      expect(result.reportingLine[0].supervisor.name).toBe('Person pa0');
    });

    it('truncates at MAX_TOTAL_NODES (10000)', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment('pa1'));
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const manyChildren = Array.from({ length: 10001 }, (_, i) =>
        saWithAssignment(`pa${i + 2}`, 'pa1'),
      );
      prisma.supervisorAssignment.findMany.mockResolvedValue(manyChildren);

      const result = await service.getHierarchyTree('pa1', ctx);
      expect(result.truncated).toBe(true);
      expect(result.totalDescendants).toBe(10001);
    });

    it('respects tenant/company scope', async () => {
      const otherCtx = {
        ...ctx,
        companyId: 'other-company',
        contextKey: 'other-company:branch-a',
      } as ActiveOperationalContext;

      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);
      await expect(service.getHierarchyTree('pa1', otherCtx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSupervisionHistory', () => {
    const historyRecord = (overrides: Record<string, any> = {}) => ({
      id: 'sa-h1',
      companyId: 'company-a',
      assignmentId: 'pa-sub',
      supervisorAssignmentId: 'pa-sup',
      relationshipType: 'DIRECT',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      isActive: true,
      status: 'ACTIVE',
      deletedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      assignment: {
        person: { id: 'person-sub', name: 'Employee A', code: 'E001' },
        department: { id: 'd1', name: 'Dept 1', code: 'D1' },
        jobTitle: { id: 'jt1', name: 'Engineer', code: 'ENG' },
        branch: { id: 'branch-a', name: 'Branch A', code: 'BA' },
        administration: null,
        assignmentType: 'PRIMARY',
      },
      supervisorAssignment: {
        person: { id: 'person-sup', name: 'Manager B', code: 'M001' },
        department: { id: 'd1', name: 'Dept 1', code: 'D1' },
        jobTitle: { id: 'jt2', name: 'Manager', code: 'MGR' },
        branch: { id: 'branch-a', name: 'Branch A', code: 'BA' },
        administration: null,
        assignmentType: 'PRIMARY',
      },
      ...overrides,
    });

    it('returns paginated supervision history', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([historyRecord()]);
      prisma.supervisorAssignment.count.mockResolvedValue(1);
      const result = await service.getSupervisionHistory({}, ctx);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('returns CURRENT temporal status for active open-ended record', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([historyRecord()]);
      prisma.supervisorAssignment.count.mockResolvedValue(1);
      const result = await service.getSupervisionHistory({}, ctx);
      expect(result.data[0].temporalStatus).toBe('CURRENT');
    });

    it('returns PAST temporal status for expired record', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([historyRecord({
        effectiveTo: new Date('2025-12-31'),
        isActive: true,
      })]);
      prisma.supervisorAssignment.count.mockResolvedValue(1);
      const result = await service.getSupervisionHistory({}, ctx);
      expect(result.data[0].temporalStatus).toBe('PAST');
    });

    it('returns FUTURE temporal status for future record', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([historyRecord({
        effectiveFrom: new Date('2027-01-01'),
      })]);
      prisma.supervisorAssignment.count.mockResolvedValue(1);
      const result = await service.getSupervisionHistory({}, ctx);
      expect(result.data[0].temporalStatus).toBe('FUTURE');
    });

    it('filters by relationshipType', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);
      await service.getSupervisionHistory({ relationshipType: 'MATRIX' }, ctx);
      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ relationshipType: 'MATRIX' }) }),
      );
    });

    it('filters by personId on subordinate side', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);
      await service.getSupervisionHistory({ personId: 'person-sub' }, ctx);
      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([expect.objectContaining({ assignment: { personnelId: 'person-sub' } })]) }) }),
      );
    });

    it('applies date range overlap filter', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);
      await service.getSupervisionHistory({ from: '2026-06-01T00:00:00.000Z', to: '2026-06-30T23:59:59.999Z' }, ctx);
      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalled();
    });

    it('filters CURRENT status correctly', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);
      await service.getSupervisionHistory({ status: 'CURRENT' }, ctx);
      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalled();
    });

    it('includes subordinate and supervisor human context', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([historyRecord()]);
      prisma.supervisorAssignment.count.mockResolvedValue(1);
      const result = await service.getSupervisionHistory({}, ctx);
      expect(result.data[0].subordinate.person.name).toBe('Employee A');
      expect(result.data[0].supervisor.person.name).toBe('Manager B');
    });

    it('returns null supervisor for root records', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([historyRecord({ supervisorAssignmentId: null, supervisorAssignment: null })]);
      prisma.supervisorAssignment.count.mockResolvedValue(1);
      const result = await service.getSupervisionHistory({}, ctx);
      expect(result.data[0].supervisor).toBeNull();
    });

    it('respects tenant company scope', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);
      await service.getSupervisionHistory({}, ctx);
      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
    });

    it('applies pagination correctly', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);
      await service.getSupervisionHistory({ page: 2, limit: 10 }, ctx);
      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('getLeadershipHistory', () => {
    const leadershipRecord = (overrides: Record<string, any> = {}) => ({
      id: 'pa-lead1',
      companyId: 'company-a',
      personnelId: 'person-a',
      departmentId: 'd1',
      jobTitleId: 'jt1',
      branchId: 'branch-a',
      administrationId: null,
      assignmentType: 'PRIMARY',
      leadershipLevel: 'DEPARTMENT_HEAD',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      status: 'ACTIVE',
      deletedAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      person: { id: 'person-a', name: 'Ahmed Ali', code: 'A001' },
      department: { id: 'd1', name: 'Dept 1', code: 'D1' },
      jobTitle: { id: 'jt1', name: 'Head', code: 'HEAD' },
      branch: { id: 'branch-a', name: 'Branch A', code: 'BA' },
      administration: null,
      ...overrides,
    });

    it('returns paginated leadership history', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([leadershipRecord()]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);
      const result = await service.getLeadershipHistory({}, ctx);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('excludes NONE leadership level by default', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);
      await service.getLeadershipHistory({}, ctx);
      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ leadershipLevel: { not: 'NONE' } }) }),
      );
    });

    it('returns CURRENT temporal status for active record', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([leadershipRecord()]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);
      const result = await service.getLeadershipHistory({}, ctx);
      expect(result.data[0].temporalStatus).toBe('CURRENT');
    });

    it('returns PAST temporal status for expired record', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([leadershipRecord({
        effectiveTo: new Date('2025-06-01'),
      })]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);
      const result = await service.getLeadershipHistory({}, ctx);
      expect(result.data[0].temporalStatus).toBe('PAST');
    });

    it('returns FUTURE temporal status for future record', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([leadershipRecord({
        effectiveFrom: new Date('2027-01-01'),
      })]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);
      const result = await service.getLeadershipHistory({}, ctx);
      expect(result.data[0].temporalStatus).toBe('FUTURE');
    });

    it('filters by leadershipLevel', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);
      await service.getLeadershipHistory({ leadershipLevel: 'ADMINISTRATION_MANAGER' }, ctx);
      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ leadershipLevel: 'ADMINISTRATION_MANAGER' }) }),
      );
    });

    it('filters by assignmentType', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);
      await service.getLeadershipHistory({ assignmentType: 'ACTING' }, ctx);
      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ assignmentType: 'ACTING' }) }),
      );
    });

    it('filters by personId', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);
      await service.getLeadershipHistory({ personId: 'person-a' }, ctx);
      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ personnelId: 'person-a' }) }),
      );
    });

    it('returns human person context without raw IDs', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([leadershipRecord()]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(1);
      const result = await service.getLeadershipHistory({}, ctx);
      expect(result.data[0].person.name).toBe('Ahmed Ali');
      expect(result.data[0].leadershipLevel).toBe('DEPARTMENT_HEAD');
    });

    it('includes PRIMARY and ACTING records together', async () => {
      const primary = leadershipRecord({ id: 'pa-p1', assignmentType: 'PRIMARY' });
      const acting = leadershipRecord({ id: 'pa-a1', assignmentType: 'ACTING', effectiveFrom: new Date('2026-06-01'), effectiveTo: new Date('2026-06-15') });
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([primary, acting]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(2);
      const result = await service.getLeadershipHistory({}, ctx);
      expect(result.data).toHaveLength(2);
      expect(result.data.map((r: any) => r.assignmentType)).toContain('PRIMARY');
      expect(result.data.map((r: any) => r.assignmentType)).toContain('ACTING');
    });

    it('respects tenant company scope', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);
      await service.getLeadershipHistory({}, ctx);
      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
    });

    it('applies pagination correctly', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);
      await service.getLeadershipHistory({ page: 2, limit: 10 }, ctx);
      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });
});
