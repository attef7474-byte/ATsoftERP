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
});
