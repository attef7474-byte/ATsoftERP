import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SupervisorAssignmentsService } from './supervisor-assignments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('HIER-H Tenant Security — Supervisor Assignments', () => {
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

  const pa = (id: string, companyId: string, personnelId: string, overrides: Record<string, any> = {}) => ({
    id,
    companyId,
    personnelId,
    departmentId: 'dept1',
    assignmentType: 'PRIMARY',
    branchId: companyId === 'company-a' ? 'branch-a' : 'branch-b',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    deletedAt: null,
    ...overrides,
  });

  const sa = (id: string, companyId: string, overrides: Record<string, any> = {}) => ({
    id,
    companyId,
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

  describe('§6 Root Isolation — Cross-Company findOne', () => {
    it('CROSS_COMPANY_ROOT_ACCESS: Company A findOne rejects Company B ID', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const promise = service.findOne('sa-from-b', ctxA);
      await expect(promise).rejects.toThrow(NotFoundException);
      expect(prisma.supervisorAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
    });

    it('CROSS_COMPANY_ROOT_ACCESS: Company B cannot read Company A record by ID', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const promise = service.findOne('sa-from-a', ctxB);
      await expect(promise).rejects.toThrow(NotFoundException);
      expect(prisma.supervisorAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-b' }) }),
      );
    });
  });

  describe('§6 Root Isolation — Cross-Company create', () => {
    it('CROSS_COMPANY_ROOT_ACCESS: Company A cannot create with Company B assignment', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      const promise = service.create(
        { assignmentId: 'pa-from-b', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      expect(prisma.operationalPersonAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
    });

    it('CROSS_COMPANY_ROOT_ACCESS: Company A cannot link Company B as supervisor', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(pa('pa1', 'company-a', 'personA'))
        .mockResolvedValueOnce(null);

      const promise = service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa-from-b', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctxA,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      expect(prisma.operationalPersonAssignment.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
    });
  });

  describe('§6 Root Isolation — Cross-Company update', () => {
    it('CROSS_COMPANY_ROOT_ACCESS: Company A cannot update Company B record', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const promise = service.update('sa-from-b', { relationshipType: 'MATRIX' } as any, ctxA);
      await expect(promise).rejects.toThrow(NotFoundException);
    });
  });

  describe('§6 Root Isolation — Cross-Company remove', () => {
    it('CROSS_COMPANY_ROOT_ACCESS: Company A cannot remove Company B record', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const promise = service.remove('sa-from-b', ctxA);
      await expect(promise).rejects.toThrow(NotFoundException);
    });
  });

  describe('§6 Root Isolation — Cross-Company team', () => {
    it('CROSS_COMPANY_ROOT_ACCESS: Company A cannot view Company B team', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      const promise = service.getCurrentTeam('sa-from-b', ctxA);
      await expect(promise).rejects.toThrow(NotFoundException);
    });
  });

  describe('§6 Root Isolation — Cross-Company candidates', () => {
    it('CROSS_COMPANY_NESTED_LEAK: Company A candidates query scoped to Company A', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(
        pa('sa1', 'company-a', 'person1'),
      );
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.getCandidates('sa1', { page: '1', limit: '10' } as any, ctxA);

      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
    });
  });

  describe('§6 Root Isolation — Cross-Company bulk preview', () => {
    it('CROSS_COMPANY_ROOT_ACCESS: Company A bulk preview scoped to Company A', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(
        pa('sa1', 'company-a', 'sup-person'),
      );
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);

      await service.bulkPreview(
        { supervisorAssignmentId: 'sa1', assignmentIds: ['pa-x'], effectiveFrom: '2026-06-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctxA,
      );

      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
    });
  });

  describe('§6 Root Isolation — Cross-Company reporting line', () => {
    it('CROSS_COMPANY_ROOT_ACCESS: Company A reporting line scoped to Company A', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);

      const promise = service.getReportingLine('pa-from-b', ctxA);
      const result = await promise;
      expect(result.reportingLine).toEqual([]);
    });
  });

  describe('§6 Root Isolation — Cross-Company subordinates', () => {
    it('CROSS_COMPANY_ROOT_ACCESS: Company A subordinates scoped to Company A', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.getSubordinates('pa-from-b', ctxA);
      expect(result.subordinates).toEqual([]);
    });
  });

  describe('§6 Root Isolation — Cross-Company hierarchy', () => {
    it('CROSS_COMPANY_ROOT_ACCESS: Company A hierarchy for non-existent Company A assignment', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      const promise = service.getHierarchyTree('pa-missing', ctxA);
      await expect(promise).rejects.toThrow(NotFoundException);
    });
  });

  describe('§6 Root Isolation — Cross-Company history', () => {
    it('CROSS_COMPANY_NESTED_LEAK: supervision history scoped to Company A', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);

      const result = await service.getSupervisionHistory({}, ctxA);

      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
      expect(result.data).toEqual([]);
    });

    it('CROSS_COMPANY_NESTED_LEAK: leadership history scoped to Company A', async () => {
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);

      const result = await service.getLeadershipHistory({}, ctxA);

      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
      expect(result.data).toEqual([]);
    });
  });

  describe('§7 Mixed-Tenant Bulk', () => {
    it('MIXED_TENANT_BULK_ALL_OR_NOTHING: bulk apply with non-existent IDs fails atomically', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(
        pa('sa1', 'company-a', 'sup-person'),
      );
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);

      const promise = service.bulkApply(
        { supervisorAssignmentId: 'sa1', assignmentIds: ['pa-a1', 'pa-a2', 'pa-x'], effectiveFrom: '2026-06-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctxA,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
    });

    it('MIXED_TENANT_BULK_ALL_OR_NOTHING: bulk apply rejects when some IDs not in Company A', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(
        pa('sa1', 'company-a', 'sup-person'),
      );
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        pa('pa-a1', 'company-a', 'personA1'),
      ]);

      const promise = service.bulkApply(
        { supervisorAssignmentId: 'sa1', assignmentIds: ['pa-a1', 'pa-missing'], effectiveFrom: '2026-06-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctxA,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
    });
  });

  describe('§10 Cancelled Future Relationship Leak', () => {
    it('CANCELLED_FUTURE_OPERATIONAL_LEAK: isActive=false record does not appear in team', async () => {
      const supervisor = { id: 'sa1', companyId: 'company-a', personnelId: 'sup-person', branchId: 'branch-a', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, deletedAt: null, person: { id: 'p1', name: 'S', code: 'C1' }, department: { id: 'd1', name: 'D', code: 'D1' }, jobTitle: { id: 'j1', name: 'J', code: 'J1' }, branch: { id: 'b1', name: 'B', code: 'B1' } };
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(supervisor);

      const cancelledRelation = sa('sa-cancelled', 'company-a', {
        assignmentId: 'pa-sub', supervisorAssignmentId: 'sa1',
        isActive: false, deletedAt: null,
        assignment: { personnelId: 'personSub', person: { id: 'ps', name: 'Sub', code: 'CS' }, department: { id: 'd1', name: 'D', code: 'D1' }, jobTitle: { id: 'j1', name: 'J', code: 'J1' }, branch: { id: 'b1', name: 'B', code: 'B1' }, administration: null, assignmentType: 'PRIMARY' },
      });
      prisma.supervisorAssignment.findMany.mockResolvedValue([cancelledRelation]);

      const result = await service.getCurrentTeam('sa1', ctxA);
      expect(result.team).toHaveLength(0);
    });

    it('CANCELLED_FUTURE_OPERATIONAL_LEAK: status=CANCELLED with isActive=false not in hierarchy', async () => {
      const rootSa = sa('sa-root', 'company-a', { assignment: { personnelId: 'root-person', person: { id: 'rp', name: 'Root', code: 'CR' }, department: { id: 'd1', name: 'D', code: 'D1' }, jobTitle: { id: 'j1', name: 'J', code: 'J1' }, branch: { id: 'b1', name: 'B', code: 'B1' }, branchId: 'branch-a', administration: null, assignmentType: 'PRIMARY', leadershipLevel: 'NONE' } });
      prisma.supervisorAssignment.findFirst
        .mockResolvedValueOnce(rootSa);

      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.getReportingLine('pa-root', ctxA);
      expect(result.reportingLine).toEqual([]);
    });
  });

  describe('§11 Soft-Delete Leak', () => {
    it('SOFT_DELETED_OPERATIONAL_LEAK: deletedAt≠null records excluded from findAll', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);

      const result = await service.findAll({}, ctxA);

      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
      expect(result.data).toEqual([]);
    });

    it('SOFT_DELETED_OPERATIONAL_LEAK: deletedAt≠null records excluded from history', async () => {
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);

      const result = await service.getSupervisionHistory({}, ctxA);

      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });

    it('SOFT_DELETED_OPERATIONAL_LEAK: deletedAt≠null excluded from candidates', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(
        pa('sa1', 'company-a', 'sup-person'),
      );
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      await service.getCandidates('sa1', { page: '1', limit: '10' } as any, ctxA);

      expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });
  });
});
