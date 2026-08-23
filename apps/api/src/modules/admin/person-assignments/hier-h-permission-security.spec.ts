import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PersonAssignmentsService } from './person-assignments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { SupervisorAssignmentsService } from '../supervisor-assignments/supervisor-assignments.service';

describe('HIER-H Permission Security — Person Assignments', () => {
  let prisma: any;
  let auditService: any;
  let service: PersonAssignmentsService;
  let supervisorService: SupervisorAssignmentsService;

  const ctx: ActiveOperationalContext = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  const fullAssignment = (overrides: Record<string, any> = {}) => ({
    id: overrides.id ?? 'pa1',
    companyId: 'company-a',
    branchId: 'branch-a',
    administrationId: null,
    departmentId: overrides.departmentId ?? 'dept1',
    jobTitleId: 'jt1',
    personnelId: overrides.personnelId ?? 'person1',
    assignmentType: overrides.assignmentType ?? 'PRIMARY',
    leadershipLevel: 'NONE',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: overrides.effectiveTo ?? null,
    notes: null,
    status: 'ACTIVE',
    deletedAt: null,
    company: { id: 'company-a', name: 'CoA', code: 'CA' },
    branch: { id: 'branch-a', name: 'BrA' },
    administration: null,
    department: { id: overrides.departmentId ?? 'dept1', name: 'Dept1', code: 'D1' },
    jobTitle: { id: 'jt1', name: 'JT1', code: 'JT1' },
    person: { id: overrides.personnelId ?? 'person1', name: 'Person1', code: 'P1' },
  });

  beforeEach(() => {
    prisma = {
      operationalPersonAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      department: { findFirst: jest.fn().mockResolvedValue({ id: 'dept2', branchId: 'branch-a', companyId: 'company-a', branch: { id: 'branch-a', companyId: 'company-a', deletedAt: null } }) },
      jobTitle: { findFirst: jest.fn().mockResolvedValue({ id: 'jt1', companyId: 'company-a', deletedAt: null }) },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-a', companyId: 'company-a', deletedAt: null }) },
      administration: { findFirst: jest.fn() },
      operationalPerson: { findFirst: jest.fn().mockResolvedValue({ id: 'person1' }) },
      supervisorAssignment: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'sa-new' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    auditService = { log: jest.fn(), logWithClient: jest.fn() };
    supervisorService = new SupervisorAssignmentsService(prisma as PrismaService, auditService as AuditService);
    service = new PersonAssignmentsService(prisma as PrismaService, auditService as AuditService, supervisorService);
  });

  function setupNoAffRelationships() {
    prisma.supervisorAssignment.findMany.mockResolvedValue([]);
  }

  function setupAffRelationships(relationships: any[]) {
    prisma.supervisorAssignment.findMany
      .mockResolvedValueOnce(relationships)
      .mockResolvedValueOnce([]);
  }

  describe('§4 Permission Negative Matrix — assertUserPermissions', () => {
    it('1. No person-assignment:transfer → transfer rejected when affected relationships exist', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment())
        .mockResolvedValueOnce(null);
      setupAffRelationships([{
        id: 'sa1', assignmentId: 'pa1', supervisorAssignmentId: 'pa2',
        relationshipType: 'DIRECT', effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
        isActive: true, deletedAt: null, companyId: 'company-a',
        supervisorAssignment: { personnelId: 'person2', companyId: 'company-a', person: { id: 'p2', name: 'B', code: 'C2' }, department: { id: 'd2', name: 'D2', code: 'D2' }, jobTitle: { id: 'j2', name: 'J2', code: 'J2' }, branch: { id: 'b1', name: 'B1' }, administration: null, assignmentType: 'PRIMARY', leadershipLevel: 'NONE' },
      }]);

      const promise = service.transfer('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
        relationshipResolutions: [{ relationshipId: 'sa1', action: 'END_AT_TRANSFER' }],
      } as any, ctx, 'user-no-perm');

      await expect(promise).rejects.toThrow(ForbiddenException);
    });

    it('2. person-assignment:transfer only + no relationships → transfer allowed', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment())
        .mockResolvedValueOnce(null);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.operationalPersonAssignment.create.mockResolvedValue(fullAssignment({ id: 'pa-new-created' }));

      const result = await service.transfer('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
      } as any, ctx, 'user-transfer-only');

      expect(result).toBeDefined();
      expect(result.newAssignment).toBeDefined();
    });

    it('3. person-assignment:transfer + supervisor:remove required for END resolution', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment())
        .mockResolvedValueOnce(null);
      setupAffRelationships([{
        id: 'sa1', assignmentId: 'pa1', supervisorAssignmentId: 'pa2',
        relationshipType: 'DIRECT', effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
        isActive: true, deletedAt: null, companyId: 'company-a',
        supervisorAssignment: { personnelId: 'person2', companyId: 'company-a', person: { id: 'p2', name: 'B', code: 'C2' }, department: { id: 'd2', name: 'D2', code: 'D2' }, jobTitle: { id: 'j2', name: 'J2', code: 'J2' }, branch: { id: 'b1', name: 'B1' }, administration: null, assignmentType: 'PRIMARY', leadershipLevel: 'NONE' },
      }]);

      const promise = service.transfer('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
        relationshipResolutions: [{ relationshipId: 'sa1', action: 'END_AT_TRANSFER' }],
      } as any, ctx, 'user-transfer-only');

      await expect(promise).rejects.toThrow(ForbiddenException);
    });

    it('4. person-assignment:transfer + supervisor:remove → END allowed', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment())
        .mockResolvedValueOnce(null);
      setupAffRelationships([{
        id: 'sa1', assignmentId: 'pa1', supervisorAssignmentId: 'pa2',
        relationshipType: 'DIRECT', effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
        isActive: true, deletedAt: null, companyId: 'company-a',
        supervisorAssignment: { personnelId: 'person2', companyId: 'company-a', person: { id: 'p2', name: 'B', code: 'C2' }, department: { id: 'd2', name: 'D2', code: 'D2' }, jobTitle: { id: 'j2', name: 'J2', code: 'J2' }, branch: { id: 'b1', name: 'B1' }, administration: null, assignmentType: 'PRIMARY', leadershipLevel: 'NONE' },
      }]);
      prisma.userRole.findMany.mockResolvedValue([{
        role: { status: 'ACTIVE', code: 'TEST', permissions: [{ permission: { key: 'supervisor:remove', status: 'ACTIVE' } }] },
      }]);
      prisma.operationalPersonAssignment.create.mockResolvedValue(fullAssignment({ id: 'pa-new-created' }));

      const result = await service.transfer('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
        relationshipResolutions: [{ relationshipId: 'sa1', action: 'END_AT_TRANSFER' }],
      } as any, ctx, 'user-transfer-and-remove');

      expect(result).toBeDefined();
      expect(result.relationshipsEnded).toBe(1);
    });

    it('5. person-assignment:transfer + supervisor:remove (no supervisor:assign) → CONTINUE rejected', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment())
        .mockResolvedValueOnce(null);
      setupAffRelationships([{
        id: 'sa1', assignmentId: 'pa1', supervisorAssignmentId: 'pa2',
        relationshipType: 'DIRECT', effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
        isActive: true, deletedAt: null, companyId: 'company-a',
        supervisorAssignment: { personnelId: 'person2', companyId: 'company-a', person: { id: 'p2', name: 'B', code: 'C2' }, department: { id: 'd2', name: 'D2', code: 'D2' }, jobTitle: { id: 'j2', name: 'J2', code: 'J2' }, branch: { id: 'b1', name: 'B1' }, administration: null, assignmentType: 'PRIMARY', leadershipLevel: 'NONE' },
      }]);
      prisma.userRole.findMany.mockResolvedValue([{
        role: { status: 'ACTIVE', code: 'TEST', permissions: [{ permission: { key: 'supervisor:remove', status: 'ACTIVE' } }] },
      }]);

      const promise = service.transfer('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
        relationshipResolutions: [{ relationshipId: 'sa1', action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      } as any, ctx, 'user-transfer-and-remove');

      await expect(promise).rejects.toThrow(ForbiddenException);
    });

    it('6. person-assignment:transfer + supervisor:remove + supervisor:assign → CONTINUE allowed', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment())
        .mockResolvedValueOnce(fullAssignment({ id: 'pa2', personnelId: 'person2', branchId: 'branch-a' }))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(fullAssignment({ id: 'pa-new-created', personnelId: 'person1', branchId: 'branch-a' }))
        .mockResolvedValueOnce(fullAssignment({ id: 'pa2', personnelId: 'person2', branchId: 'branch-a' }));
      setupAffRelationships([{
        id: 'sa1', assignmentId: 'pa1', supervisorAssignmentId: 'pa2',
        relationshipType: 'DIRECT', effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
        isActive: true, deletedAt: null, companyId: 'company-a',
        supervisorAssignment: { personnelId: 'person2', companyId: 'company-a', person: { id: 'p2', name: 'B', code: 'C2' }, department: { id: 'd2', name: 'D2', code: 'D2' }, jobTitle: { id: 'j2', name: 'J2', code: 'J2' }, branch: { id: 'b1', name: 'B1' }, administration: null, assignmentType: 'PRIMARY', leadershipLevel: 'NONE' },
      }]);
      prisma.userRole.findMany.mockResolvedValue([{
        role: { status: 'ACTIVE', code: 'TEST', permissions: [
          { permission: { key: 'supervisor:remove', status: 'ACTIVE' } },
          { permission: { key: 'supervisor:assign', status: 'ACTIVE' } },
        ] },
      }]);
      prisma.operationalPersonAssignment.create.mockResolvedValue(fullAssignment({ id: 'pa-new-created' }));
      prisma.supervisorAssignment.create.mockResolvedValue({ id: 'sa-new' });

      const result = await service.transfer('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
        relationshipResolutions: [{ relationshipId: 'sa1', action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      } as any, ctx, 'user-all-perms');

      expect(result).toBeDefined();
      expect(result.relationshipsContinued).toBe(1);
    });
  });

  describe('§5 Transfer Permission Escalation Prevention', () => {
    it('TRANSFER_PERMISSION_ESCALATION_BYPASS = NO: preview without supervisor:read discloses no relationships', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment())
        .mockResolvedValueOnce(null);
      setupAffRelationships([{
        id: 'sa1', assignmentId: 'pa1', supervisorAssignmentId: 'pa2',
        relationshipType: 'DIRECT', effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
        isActive: true, deletedAt: null, companyId: 'company-a',
        supervisorAssignment: { personnelId: 'person2', companyId: 'company-a', person: { id: 'p2', name: 'B', code: 'C2' }, department: { id: 'd2', name: 'D2', code: 'D2' }, jobTitle: { id: 'j2', name: 'J2', code: 'J2' }, branch: { id: 'b1', name: 'B1' }, administration: null, assignmentType: 'PRIMARY', leadershipLevel: 'NONE' },
      }]);

      const promise = service.transferPreview('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
      } as any, ctx, 'user-no-supervisor-read');

      await expect(promise).rejects.toThrow(ForbiddenException);
    });

    it('preview without affected relationships does not require supervisor:read', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment())
        .mockResolvedValueOnce(null);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);

      const result = await service.transferPreview('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
      } as any, ctx, 'user-transfer-only');

      expect(result).toBeDefined();
      expect(result.summary.totalAffected).toBe(0);
    });
  });

  describe('§7 SUPER_ADMIN bypass', () => {
    it('SUPER_ADMIN role bypasses assertUserPermissions', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment())
        .mockResolvedValueOnce(fullAssignment({ id: 'pa2', personnelId: 'person2', branchId: 'branch-a' }))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(fullAssignment({ id: 'pa-new-created', personnelId: 'person1', branchId: 'branch-a' }))
        .mockResolvedValueOnce(fullAssignment({ id: 'pa2', personnelId: 'person2', branchId: 'branch-a' }));
      setupAffRelationships([{
        id: 'sa1', assignmentId: 'pa1', supervisorAssignmentId: 'pa2',
        relationshipType: 'DIRECT', effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
        isActive: true, deletedAt: null, companyId: 'company-a',
        supervisorAssignment: { personnelId: 'person2', companyId: 'company-a', person: { id: 'p2', name: 'B', code: 'C2' }, department: { id: 'd2', name: 'D2', code: 'D2' }, jobTitle: { id: 'j2', name: 'J2', code: 'J2' }, branch: { id: 'b1', name: 'B1' }, administration: null, assignmentType: 'PRIMARY', leadershipLevel: 'NONE' },
      }]);
      prisma.userRole.findMany.mockResolvedValue([{
        role: { status: 'ACTIVE', code: 'SUPER_ADMIN', permissions: [] },
      }]);
      prisma.operationalPersonAssignment.create.mockResolvedValue(fullAssignment({ id: 'pa-new-created' }));
      prisma.supervisorAssignment.create.mockResolvedValue({ id: 'sa-new' });

      const result = await service.transfer('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
        relationshipResolutions: [{ relationshipId: 'sa1', action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      } as any, ctx, 'super-admin-user');

      expect(result).toBeDefined();
      expect(result.relationshipsContinued).toBe(1);
    });
  });

  describe('§12 Query Validation — Transfer', () => {
    it('rejects transfer with transferDate before assignment start', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment({ effectiveFrom: new Date('2026-03-01') }));

      const promise = service.transferPreview('pa1', {
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        departmentId: 'dept2',
      } as any, ctx);

      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0].code).toBe('validation.invalidRange');
    });

    it('rejects transfer of non-PRIMARY assignment', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment({ assignmentType: 'SECONDARY' }));

      const promise = service.transferPreview('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
      } as any, ctx);

      await expect(promise).rejects.toThrow(BadRequestException);
    });

    it('rejects transfer of already-closed assignment', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(fullAssignment({ effectiveTo: new Date('2026-05-01') }));

      const promise = service.transferPreview('pa1', {
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        departmentId: 'dept2',
      } as any, ctx);

      await expect(promise).rejects.toThrow(BadRequestException);
    });
  });
});
