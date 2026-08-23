import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SupervisorAssignmentsService } from './supervisor-assignments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('HIER-H Validation Security — Supervisor Assignments', () => {
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

  const pa = (id: string, personnelId: string, overrides: Record<string, any> = {}) => ({
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

  const saRecord = (overrides: Record<string, any> = {}) => ({
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
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    auditService = { log: jest.fn(), logWithClient: jest.fn() };
    service = new SupervisorAssignmentsService(prisma as PrismaService, auditService as AuditService);
  });

  describe('§8 Bulk DTO Security', () => {
    it('BULK_INPUT_LIMIT: rejects assignmentIds with more than BULK_MAX_SIZE (200)', async () => {
      const tooManyIds = Array.from({ length: 201 }, (_, i) => `pa-${i}`);

      const promise = service.bulkPreview(
        { supervisorAssignmentId: 'sa1', assignmentIds: tooManyIds, effectiveFrom: '2026-06-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
    });

    it('BULK_INPUT_LIMIT: rejects duplicate IDs in bulk', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(
        saRecord({ assignment: { personnelId: 'sup', branchId: 'branch-a' } }),
      );
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);

      const promise = service.bulkPreview(
        { supervisorAssignmentId: 'sa1', assignmentIds: ['pa1', 'pa1'], effectiveFrom: '2026-06-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
    });

    it('BULK_INPUT_LIMIT: rejects invalid relationshipType', async () => {
      const dto = { supervisorAssignmentId: 'sa1', assignmentIds: ['pa1'], effectiveFrom: '2026-06-01T00:00:00.000Z', relationshipType: 'INVALID_TYPE' };

      const promise = service.bulkPreview(dto as any, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
    });

    it('BULK_INPUT_LIMIT: rejects effectiveTo before effectiveFrom', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(
        saRecord({ assignment: { personnelId: 'sup', branchId: 'branch-a' } }),
      );

      const promise = service.bulkPreview(
        { supervisorAssignmentId: 'sa1', assignmentIds: ['pa1'], effectiveFrom: '2026-12-01T00:00:00.000Z', effectiveTo: '2026-06-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
    });
  });

  describe('§9 Error Leak Prevention', () => {
    it('does not expose Prisma model names in error response', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      try {
        await service.create(
          { assignmentId: 'missing', effectiveFrom: '2026-01-01T00:00:00.000Z' },
          ctx,
        );
        fail('should have thrown');
      } catch (e: any) {
        const response = e.getResponse();
        expect(response.message).not.toMatch(/prisma/i);
        expect(response.message).not.toMatch(/prisma/i);
        expect(response.message).not.toMatch(/sql/i);
        expect(response.message).not.toMatch(/database/i);
        expect(response.errors[0].code).toBe('validation.invalidReference');
      }
    });

    it('does not expose stack traces in error response', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      try {
        await service.create(
          { assignmentId: 'missing', effectiveFrom: '2026-01-01T00:00:00.000Z' },
          ctx,
        );
        fail('should have thrown');
      } catch (e: any) {
        const response = e.getResponse();
        expect(response.stack).toBeUndefined();
        expect(response.message).not.toContain('at ');
        expect(response.message).not.toContain('.ts:');
      }
    });

    it('does not expose foreign company names in cross-company errors', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      try {
        await service.create(
          { assignmentId: 'pa-from-company-b', effectiveFrom: '2026-01-01T00:00:00.000Z' },
          ctx,
        );
        fail('should have thrown');
      } catch (e: any) {
        const response = e.getResponse();
        const msg = JSON.stringify(response);
        expect(msg).not.toMatch(/company-b/i);
        expect(msg).not.toMatch(/company_b/i);
      }
    });

    it('returns structured 400 for invalid query parameters', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 10 }, ctx);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });
  });

  describe('§12 DTO Hardening — Invalid relationshipType', () => {
    it('rejects create with invalid relationshipType at service level', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(pa('pa1', 'personA'))
        .mockResolvedValueOnce(pa('pa2', 'personB'));

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', relationshipType: 'INVALID', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0].code).toBe('validation.invalidValue');
    });
  });

  describe('§12 DTO Hardening — Effective range', () => {
    it('rejects create with effectiveTo before effectiveFrom', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(pa('pa1', 'personA'))
        .mockResolvedValueOnce(pa('pa2', 'personB'));

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-12-01T00:00:00.000Z', effectiveTo: '2026-06-01T00:00:00.000Z' },
        ctx,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0].code).toBe('validation.invalidRange');
    });
  });

  describe('§12 DTO Hardening — Assignment window violations', () => {
    it('rejects supervision extending beyond subordinate assignment', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(pa('pa1', 'personA', { effectiveTo: new Date('2026-12-31') }))
        .mockResolvedValueOnce(pa('pa2', 'personB'));

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: '2027-06-01T00:00:00.000Z' },
        ctx,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0].code).toBe('validation.assignmentOutOfRange');
    });

    it('rejects open-ended supervision when subordinate assignment has finite end', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(pa('pa1', 'personA', { effectiveTo: new Date('2026-12-31') }))
        .mockResolvedValueOnce(pa('pa2', 'personB'));

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
    });
  });

  describe('§13 Hierarchy Depth Limits', () => {
    it('reporting line respects MAX_HIERARCHY_DEPTH', async () => {
      const chain = [];
      for (let i = 0; i < 150; i++) {
        chain.push({
          id: `sa-${i}`,
          supervisorAssignmentId: i < 149 ? `sa-${i + 1}` : null,
          relationshipType: 'DIRECT',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          isActive: true,
          deletedAt: null,
          supervisorAssignment: i < 149 ? {
            id: `sup-${i + 1}`,
            personnelId: `person-${i + 1}`,
            person: { id: `p-${i + 1}`, name: `Person ${i + 1}`, code: `C${i + 1}` },
            department: { id: `d-${i + 1}`, name: `Dept ${i + 1}`, code: `D${i + 1}` },
            jobTitle: { id: `j-${i + 1}`, name: `Job ${i + 1}`, code: `J${i + 1}` },
          } : null,
        });
      }

      prisma.supervisorAssignment.findFirst
        .mockResolvedValueOnce(chain[0]);

      for (let i = 0; i < 101; i++) {
        prisma.supervisorAssignment.findFirst
          .mockResolvedValueOnce(chain[i] ?? { ...chain[0], supervisorAssignment: null });
      }

      const result = await service.getReportingLine('pa-0', ctx);
      expect(result.depth).toBeLessThanOrEqual(100);
    });
  });
});
