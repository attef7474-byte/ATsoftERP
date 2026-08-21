import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PersonAssignmentsService } from './person-assignments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { SupervisorAssignmentsService } from '../supervisor-assignments/supervisor-assignments.service';

describe('PersonAssignmentsService — HIER-G Transfer Reconciliation', () => {
  let prisma: any;
  let auditService: any;
  let service: PersonAssignmentsService;
  let supervisorAssignmentsService: SupervisorAssignmentsService;
  const ctx = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  const baseAssignment = (overrides: Record<string, any> = {}) => ({
    id: 'pa1', companyId: 'company-a', branchId: 'branch-a', administrationId: null,
    departmentId: 'dept1', jobTitleId: 'jt1', personnelId: 'person1',
    assignmentType: 'PRIMARY', leadershipLevel: 'NONE',
    effectiveFrom: new Date('2026-01-01'), effectiveTo: null, notes: null,
    deletedAt: null, isActive: true,
    person: { id: 'person1', name: 'Ahmed', code: 'P001' },
    department: { id: 'dept1', name: 'Dept1', code: 'D1' },
    jobTitle: { id: 'jt1', name: 'Engineer', code: 'E1' },
    branch: { id: 'branch-a', name: 'Branch A' },
    administration: null, supervisorAssignments: [], ...overrides,
  });

  const baseInbound = (overrides: Record<string, any> = {}) => ({
    id: 'sa-in1', companyId: 'company-a', assignmentId: 'pa1',
    supervisorAssignmentId: 'pa-super', relationshipType: 'DIRECT',
    effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
    isActive: true, deletedAt: null,
    supervisorAssignment: {
      companyId: 'company-a',
      person: { id: 'super1', name: 'Supervisor', code: 'S001' },
      department: { id: 'dept-s', name: 'SuperDept', code: 'SD' },
      jobTitle: { id: 'jt-s', name: 'Manager', code: 'M1' },
      branch: { id: 'branch-a', name: 'Branch A' },
      administration: null, assignmentType: 'PRIMARY', leadershipLevel: 'DEPARTMENT_HEAD',
    }, ...overrides,
  });

  const baseOutbound = (overrides: Record<string, any> = {}) => ({
    id: 'sa-out1', companyId: 'company-a', assignmentId: 'pa-sub1',
    supervisorAssignmentId: 'pa1', relationshipType: 'DIRECT',
    effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
    isActive: true, deletedAt: null,
    assignment: {
      companyId: 'company-a',
      person: { id: 'sub1', name: 'Subordinate', code: 'SUB01' },
      department: { id: 'dept-sub', name: 'SubDept', code: 'SD' },
      jobTitle: { id: 'jt-sub', name: 'Worker', code: 'W1' },
      branch: { id: 'branch-a', name: 'Branch A' },
      administration: null, assignmentType: 'PRIMARY', leadershipLevel: 'NONE',
    }, ...overrides,
  });

  const newDept2 = { id: 'dept2', name: 'Dept2', code: 'D2' };
  const newBranch = { id: 'branch-b', name: 'Branch B' };

  beforeEach(() => {
    prisma = {
      operationalPersonAssignment: {
        findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(),
        findMany: jest.fn(), count: jest.fn(),
      },
      department: { findFirst: jest.fn() },
      jobTitle: { findFirst: jest.fn() },
      branch: { findFirst: jest.fn() },
      administration: { findFirst: jest.fn() },
      operationalPerson: { findFirst: jest.fn() },
      supervisorAssignment: {
        count: jest.fn(), findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(),
      },
      userRole: {
        findMany: jest.fn().mockResolvedValue([{
          role: {
            code: 'HIERARCHY_ADMIN',
            status: 'ACTIVE',
            permissions: ['supervisor:read', 'supervisor:remove', 'supervisor:assign'].map((key) => ({
              permission: { key, status: 'ACTIVE' },
            })),
          },
        }]),
      },
      $transaction: jest.fn(),
    };
    prisma.operationalPersonAssignment.findFirst.mockImplementation((args: any) => {
      const id = args?.where?.id;
      if (id === 'pa1') return Promise.resolve(baseAssignment());
      if (id === 'pa2') return Promise.resolve(baseAssignment({ id: 'pa2' }));
      if (id) {
        return Promise.resolve(baseAssignment({
          id,
          personnelId: id === 'pa-sub1' ? 'sub1' : id === 'pa-super' ? 'super1' : `person-${id}`,
          assignmentType: id.startsWith('pa-sub') ? 'PRIMARY' : 'SECONDARY',
          effectiveFrom: new Date('2025-01-01'),
        }));
      }
      return Promise.resolve(null);
    });
    prisma.operationalPersonAssignment.updateMany.mockResolvedValue({ count: 1 });
    prisma.operationalPersonAssignment.create.mockResolvedValue(baseAssignment({ id: 'pa2', departmentId: 'dept2' }));
    prisma.supervisorAssignment.updateMany.mockResolvedValue({ count: 1 });
    prisma.supervisorAssignment.create.mockImplementation((args: any) => Promise.resolve({ id: 'new-sa', ...args.data }));
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    auditService = { log: jest.fn(), logWithClient: jest.fn() };
    supervisorAssignmentsService = new SupervisorAssignmentsService(prisma, auditService);
    service = new PersonAssignmentsService(
      prisma,
      auditService,
      supervisorAssignmentsService,
    );
  });

  function setupNoRelations() {
    prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
    prisma.department.findFirst.mockResolvedValue(newDept2);
    prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
    prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
    prisma.supervisorAssignment.findMany.mockResolvedValue([]);
  }

  function setupWithInbound(relOverrides: Record<string, any> = {}) {
    const rel = baseInbound(relOverrides);
    prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
    prisma.department.findFirst.mockResolvedValue(newDept2);
    prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
    prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
    prisma.supervisorAssignment.findMany
      .mockResolvedValueOnce([rel])
      .mockResolvedValueOnce([]);
    return rel;
  }

  function setupWithOutbound(overrides: Record<string, any> = {}) {
    const rel = baseOutbound(overrides);
    prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
    prisma.department.findFirst.mockResolvedValue(newDept2);
    prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
    prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
    prisma.supervisorAssignment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([rel]);
    return rel;
  }

  function mockTx(extra: Record<string, any> = {}) {
    const tx = {
      ...prisma,
      operationalPersonAssignment: {
        ...prisma.operationalPersonAssignment,
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue(baseAssignment({ id: 'pa2', departmentId: 'dept2' })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      supervisorAssignment: {
        ...prisma.supervisorAssignment,
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'new-sa', ...args.data })),
      },
      ...extra,
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    return tx;
  }

  function grantPermissions(...keys: string[]) {
    prisma.userRole.findMany.mockResolvedValue([{
      role: {
        code: 'TRANSFER_OPERATOR',
        status: 'ACTIVE',
        permissions: keys.map((key) => ({ permission: { key, status: 'ACTIVE' } })),
      },
    }]);
  }

  describe('transferPreview', () => {
    it('returns empty when no relationships exist', async () => {
      setupNoRelations();
      const result = await service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx, 'user-1');
      expect(result.summary.totalAffected).toBe(0);
      expect(result.affectedRelationships).toHaveLength(0);
      expect(result.oldAssignment.id).toBe('pa1');
    });

    it('discovers inbound relationships with human context', async () => {
      const rel = setupWithInbound();
      const result = await service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx, 'user-1');
      expect(result.summary.currentInbound).toBe(1);
      const r = result.affectedRelationships[0];
      expect(r.direction).toBe('INBOUND');
      expect(r.otherParty.person.name).toBe('Supervisor');
      expect(r.otherParty.assignmentType).toBe('PRIMARY');
      expect(r.otherParty.leadershipLevel).toBe('DEPARTMENT_HEAD');
    });

    it('discovers outbound relationships with human context', async () => {
      setupWithOutbound();
      const result = await service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx, 'user-1');
      expect(result.summary.currentOutbound).toBe(1);
      const r = result.affectedRelationships[0];
      expect(r.direction).toBe('OUTBOUND');
      expect(r.otherParty.person.name).toBe('Subordinate');
      expect(r.otherParty.leadershipLevel).toBe('NONE');
    });

    it('classifies historical relationships as HISTORICAL', async () => {
      setupWithInbound({ effectiveTo: new Date('2026-03-01'), isActive: false });
      const result = await service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx, 'user-1');
      expect(result.summary.historicalUnaffected).toBe(1);
      expect(result.affectedRelationships[0].temporalCategory).toBe('HISTORICAL');
      expect(result.affectedRelationships[0].allowedResolutions).toHaveLength(0);
    });

    it('classifies future relationships as FUTURE', async () => {
      setupWithInbound({ effectiveFrom: new Date('2027-01-01') });
      const result = await service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx, 'user-1');
      expect(result.summary.futureInbound).toBe(1);
      expect(result.affectedRelationships[0].temporalCategory).toBe('FUTURE');
    });

    it('is read-only and uses a Serializable snapshot', async () => {
      setupNoRelations();

      await service.transferPreview(
        'pa1',
        { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
      expect(prisma.operationalPersonAssignment.updateMany).not.toHaveBeenCalled();
      expect(prisma.operationalPersonAssignment.create).not.toHaveBeenCalled();
      expect(prisma.supervisorAssignment.updateMany).not.toHaveBeenCalled();
      expect(prisma.supervisorAssignment.create).not.toHaveBeenCalled();
      expect(auditService.logWithClient).not.toHaveBeenCalled();
    });

    it('requires supervisor:read before disclosing affected relationships', async () => {
      setupWithInbound();
      grantPermissions('person-assignment:transfer');

      await expect(service.transferPreview(
        'pa1',
        { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      )).rejects.toThrow(ForbiddenException);
    });

    it('G20 suppresses CONTINUE when the proposed branch is incompatible', async () => {
      setupWithInbound();
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-b' });

      const result = await service.transferPreview(
        'pa1',
        { departmentId: 'dept2', branchId: 'branch-b', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(result.affectedRelationships[0].allowedResolutions).toEqual(['END_AT_TRANSFER']);
      expect(result.affectedRelationships[0].continuationBlockedReason).toBe('validation.invalidBranchHierarchy');
    });

    it('G20 suppresses CONTINUE when the proposed assignment window ends before a future relationship', async () => {
      setupWithInbound({ effectiveFrom: new Date('2027-01-01') });

      const result = await service.transferPreview(
        'pa1',
        {
          departmentId: 'dept2',
          effectiveFrom: '2026-06-01T00:00:00.000Z',
          effectiveTo: '2026-12-31T00:00:00.000Z',
        },
        ctx,
        'user-1',
      );

      expect(result.affectedRelationships[0].allowedResolutions).toEqual(['END_AT_TRANSFER']);
      expect(result.affectedRelationships[0].continuationBlockedReason).toBe('validation.assignmentOutOfRange');
    });

    it('evaluates preview continuations independently without order-dependent over-blocking', async () => {
      const inbound = baseInbound({ id: 'sa-cycle-in' });
      const outbound = baseOutbound({ id: 'sa-cycle-out' });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
      prisma.department.findFirst.mockResolvedValue(newDept2);
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([inbound])
        .mockResolvedValueOnce([outbound])
        .mockImplementation((args: any) => {
          if (args?.where?.assignmentId === 'pa-super') {
            return Promise.resolve([{
              id: 'sa-a-b',
              assignmentId: 'pa-super',
              supervisorAssignmentId: 'pa-sub1',
              effectiveFrom: new Date('2025-01-01'),
              effectiveTo: null,
            }]);
          }
          return Promise.resolve([]);
        });

      const result = await service.transferPreview(
        'pa1',
        { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(result.affectedRelationships[0].allowedResolutions).toContain('CONTINUE_ON_NEW_ASSIGNMENT');
      expect(result.affectedRelationships[1].allowedResolutions).toContain('CONTINUE_ON_NEW_ASSIGNMENT');
      expect(result.affectedRelationships[1].continuationBlockedReason).toBeNull();
    });

    it('suppresses CONTINUE when canonical HIER-A detects an upstream temporal cycle', async () => {
      const inbound = baseInbound({ id: 'sa-cycle-in' });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
      prisma.department.findFirst.mockResolvedValue(newDept2);
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([inbound])
        .mockResolvedValueOnce([])
        .mockImplementation((args: any) => {
          if (args?.where?.assignmentId === 'pa-super') {
            return Promise.resolve([{
              id: 'sa-cycle-a',
              assignmentId: 'pa-super',
              supervisorAssignmentId: 'pa-cycle',
              effectiveFrom: new Date('2025-01-01'),
              effectiveTo: null,
            }]);
          }
          if (args?.where?.assignmentId === 'pa-cycle') {
            return Promise.resolve([{
              id: 'sa-cycle-b',
              assignmentId: 'pa-cycle',
              supervisorAssignmentId: 'pa-super',
              effectiveFrom: new Date('2025-01-01'),
              effectiveTo: null,
            }]);
          }
          return Promise.resolve([]);
        });

      const result = await service.transferPreview(
        'pa1',
        { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(result.affectedRelationships[0].allowedResolutions).toEqual(['END_AT_TRANSFER']);
      expect(result.affectedRelationships[0].continuationBlockedReason).toBe('validation.cycleDetected');
    });

    it('fails closed before exposing inbound context from a corrupt cross-company relationship', async () => {
      const relationship = setupWithInbound();
      relationship.supervisorAssignment.companyId = 'company-b';

      await expect(service.transferPreview(
        'pa1',
        { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      )).rejects.toThrow(BadRequestException);
    });

    it('fails closed before exposing outbound context from a corrupt cross-company relationship', async () => {
      const relationship = setupWithOutbound();
      relationship.assignment.companyId = 'company-b';

      await expect(service.transferPreview(
        'pa1',
        { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      )).rejects.toThrow(BadRequestException);
    });

    it('rejects preview for non-PRIMARY assignment', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment({ assignmentType: 'SECONDARY' }));
      await expect(service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx)).rejects.toThrow(BadRequestException);
    });

    it('rejects preview for already closed assignment', async () => {
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment({ effectiveTo: new Date('2026-03-01') }));
      await expect(service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx)).rejects.toThrow(BadRequestException);
    });
  });

  describe('transfer with reconciliation', () => {
    it('backward compatible: zero affected relationships proceeds without resolutions', async () => {
      setupNoRelations();
      mockTx();
      const result = await service.transfer('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx, 'user-1');
      expect(result.relationshipsEnded).toBe(0);
      expect(result.relationshipsContinued).toBe(0);
    });

    it('allows transfer-only users when no relationship mutation is needed', async () => {
      setupNoRelations();
      grantPermissions('person-assignment:transfer');
      mockTx();

      await expect(service.transfer(
        'pa1',
        { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      )).resolves.toBeDefined();
      expect(prisma.userRole.findMany).not.toHaveBeenCalled();
    });

    it('always rejects a foreign resolution even when zero relationships are affected', async () => {
      setupNoRelations();

      await expect(service.transfer('pa1', {
        departmentId: 'dept2',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: 'foreign-id', action: 'END_AT_TRANSFER' }],
      }, ctx, 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.operationalPersonAssignment.updateMany).not.toHaveBeenCalled();
    });

    it('rejects attempts to rewrite a historical relationship', async () => {
      const relationship = setupWithInbound({ effectiveTo: new Date('2026-03-01'), isActive: false });

      await expect(service.transfer('pa1', {
        departmentId: 'dept2',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: relationship.id, action: 'END_AT_TRANSFER' }],
      }, ctx, 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.supervisorAssignment.updateMany).not.toHaveBeenCalled();
    });

    it('rejects duplicate relationship resolutions at the service boundary', async () => {
      const relationship = setupWithInbound();

      await expect(service.transfer('pa1', {
        departmentId: 'dept2',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [
          { relationshipId: relationship.id, action: 'END_AT_TRANSFER' },
          { relationshipId: relationship.id, action: 'CONTINUE_ON_NEW_ASSIGNMENT' },
        ],
      }, ctx, 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.operationalPersonAssignment.updateMany).not.toHaveBeenCalled();
    });

    it('requires supervisor:remove for reconciliation', async () => {
      const relationship = setupWithInbound();
      grantPermissions('person-assignment:transfer');

      await expect(service.transfer('pa1', {
        departmentId: 'dept2',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: relationship.id, action: 'END_AT_TRANSFER' }],
      }, ctx, 'user-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.operationalPersonAssignment.updateMany).not.toHaveBeenCalled();
    });

    it('also requires supervisor:assign for continuation', async () => {
      const relationship = setupWithInbound();
      grantPermissions('supervisor:remove');

      await expect(service.transfer('pa1', {
        departmentId: 'dept2',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: relationship.id, action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      }, ctx, 'user-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.operationalPersonAssignment.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a cyclic multi-continuation final graph before any mutation', async () => {
      const inbound = baseInbound({ id: 'sa-cycle-in' });
      const outbound = baseOutbound({ id: 'sa-cycle-out' });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
      prisma.department.findFirst.mockResolvedValue(newDept2);
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([inbound])
        .mockResolvedValueOnce([outbound])
        .mockImplementation((args: any) => {
          if (args?.where?.assignmentId === 'pa-super') {
            return Promise.resolve([{
              id: 'sa-a-b',
              assignmentId: 'pa-super',
              supervisorAssignmentId: 'pa-sub1',
              effectiveFrom: new Date('2025-01-01'),
              effectiveTo: null,
            }]);
          }
          return Promise.resolve([]);
        });
      const tx = mockTx();

      await expect(service.transfer('pa1', {
        departmentId: 'dept2',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [
          { relationshipId: inbound.id, action: 'CONTINUE_ON_NEW_ASSIGNMENT' },
          { relationshipId: outbound.id, action: 'CONTINUE_ON_NEW_ASSIGNMENT' },
        ],
      }, ctx, 'user-1')).rejects.toThrow(BadRequestException);
      expect(tx.operationalPersonAssignment.updateMany).not.toHaveBeenCalled();
      expect(tx.supervisorAssignment.updateMany).not.toHaveBeenCalled();
    });

    it('rejects when affected relationships exist but no resolutions', async () => {
      setupWithInbound();
      await expect(service.transfer('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('END_AT_TRANSFER closes inbound relationship', async () => {
      const rel = setupWithInbound();
      const tx = mockTx();
      const result = await service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: rel.id, action: 'END_AT_TRANSFER' }],
      }, ctx, 'user-1');
      expect(result.relationshipsEnded).toBe(1);
      expect(result.relationshipsContinued).toBe(0);
      expect(tx.supervisorAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: rel.id, companyId: 'company-a' }),
          data: { effectiveTo: new Date('2026-06-01T00:00:00.000Z') },
        }),
      );
    });

    it('CONTINUE_ON_NEW_ASSIGNMENT creates inbound relationship on new assignment', async () => {
      const rel = setupWithInbound();
      const tx = mockTx();
      tx.supervisorAssignment.findFirst.mockResolvedValue(null);
      const integritySpy = jest.spyOn(supervisorAssignmentsService, 'assertDirectIntegrityWithClient');
      const result = await service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: rel.id, action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      }, ctx, 'user-1');
      expect(result.relationshipsContinued).toBe(1);
      expect(tx.supervisorAssignment.create).toHaveBeenCalled();
      expect(integritySpy).toHaveBeenCalledWith(tx, expect.objectContaining({
        companyId: 'company-a',
        assignmentId: 'pa2',
        supervisorAssignmentId: 'pa-super',
      }));
      expect(tx.supervisorAssignment.updateMany.mock.calls[0][0].data).toEqual({
        effectiveTo: new Date('2026-06-01T00:00:00.000Z'),
      });
      expect(tx.supervisorAssignment.updateMany.mock.invocationCallOrder[0])
        .toBeLessThan(integritySpy.mock.invocationCallOrder.at(-1)!);
    });

    it('END_AT_TRANSFER closes outbound team relationships', async () => {
      const rel1 = baseOutbound({ id: 'sa-out1', assignmentId: 'pa-sub1' });
      const rel2 = baseOutbound({ id: 'sa-out2', assignmentId: 'pa-sub2' });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
      prisma.department.findFirst.mockResolvedValue(newDept2);
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([rel1, rel2]);
      const tx = mockTx();
      const result = await service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [
          { relationshipId: 'sa-out1', action: 'END_AT_TRANSFER' },
          { relationshipId: 'sa-out2', action: 'END_AT_TRANSFER' },
        ],
      }, ctx, 'user-1');
      expect(result.relationshipsEnded).toBe(2);
    });

    it('CONTINUE_ON_NEW_ASSIGNMENT for outbound creates relationships under new assignment', async () => {
      const rel = setupWithOutbound();
      const tx = mockTx();
      tx.supervisorAssignment.findFirst.mockResolvedValue(null);
      const integritySpy = jest.spyOn(supervisorAssignmentsService, 'assertDirectIntegrityWithClient');
      const result = await service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: rel.id, action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      }, ctx, 'user-1');
      expect(result.relationshipsContinued).toBe(1);
      expect(tx.supervisorAssignment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ assignmentId: 'pa-sub1', supervisorAssignmentId: 'pa2' }),
      }));
      expect(integritySpy).toHaveBeenCalledWith(tx, expect.objectContaining({
        assignmentId: 'pa-sub1',
        supervisorAssignmentId: 'pa2',
      }));
    });

    it('mixed resolution: E1 continue, E2 end, E3 continue', async () => {
      const rel1 = baseOutbound({ id: 'sa-e1', assignmentId: 'pa-e1' });
      const rel2 = baseOutbound({ id: 'sa-e2', assignmentId: 'pa-e2' });
      const rel3 = baseOutbound({ id: 'sa-e3', assignmentId: 'pa-e3' });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
      prisma.department.findFirst.mockResolvedValue(newDept2);
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([rel1, rel2, rel3]);
      const tx = mockTx();
      tx.supervisorAssignment.findFirst.mockResolvedValue(null);
      const result = await service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [
          { relationshipId: 'sa-e1', action: 'CONTINUE_ON_NEW_ASSIGNMENT' },
          { relationshipId: 'sa-e2', action: 'END_AT_TRANSFER' },
          { relationshipId: 'sa-e3', action: 'CONTINUE_ON_NEW_ASSIGNMENT' },
        ],
      }, ctx, 'user-1');
      expect(result.relationshipsContinued).toBe(2);
      expect(result.relationshipsEnded).toBe(1);
    });

    it('rejects foreign relationship resolution', async () => {
      setupWithInbound();
      await expect(service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: 'foreign-id', action: 'END_AT_TRANSFER' }],
      }, ctx, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects missing resolution for affected relationship', async () => {
      const rel1 = baseInbound({ id: 'sa-r1' });
      const rel2 = baseInbound({ id: 'sa-r2' });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
      prisma.department.findFirst.mockResolvedValue(newDept2);
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([rel1, rel2])
        .mockResolvedValueOnce([]);
      await expect(service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: 'sa-r1', action: 'END_AT_TRANSFER' }],
      }, ctx, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('defaults leadershipLevel to NONE on transfer', async () => {
      setupNoRelations();
      const tx = mockTx();
      await service.transfer('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx, 'user-1');
      expect(tx.operationalPersonAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ leadershipLevel: 'NONE' }) }),
      );
    });

    it('preserves old leadershipLevel historically', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(baseAssignment({ leadershipLevel: 'DEPARTMENT_HEAD' }));
      prisma.department.findFirst.mockResolvedValue(newDept2);
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      const tx = mockTx();
      await service.transfer('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx, 'user-1');
      expect(tx.operationalPersonAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'pa1', companyId: 'company-a' }), data: { effectiveTo: expect.any(Date) } }),
      );
      expect(tx.operationalPersonAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ leadershipLevel: 'NONE' }) }),
      );
    });

    it('audit records transfer with relationship counts', async () => {
      const rel = setupWithInbound();
      const tx = mockTx();
      await service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: rel.id, action: 'END_AT_TRANSFER' }],
      }, ctx, 'user-1');
      expect(auditService.logWithClient).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: 'TRANSFER', entity: 'OperationalPersonAssignment' }),
      );
      const actions = auditService.logWithClient.mock.calls.map((call: any[]) => call[1].action);
      expect(actions).toEqual(expect.arrayContaining([
        'TRANSFER_ASSIGNMENT_CLOSE',
        'TRANSFER_ASSIGNMENT_CREATE',
        'TRANSFER_RELATIONSHIP_END',
        'TRANSFER',
      ]));
    });

    it('validates Administration ownership through the selected company and branch', async () => {
      setupNoRelations();
      prisma.administration.findFirst.mockResolvedValue({ id: 'admin1', branchId: 'branch-a' });
      mockTx();

      await service.transfer('pa1', {
        departmentId: 'dept2',
        administrationId: 'admin1',
        branchId: 'branch-a',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
      }, ctx, 'user-1');

      expect(prisma.administration.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'admin1',
          deletedAt: null,
          branch: { companyId: 'company-a', deletedAt: null },
        },
      });
    });

    it('rejects a stale assignment close before creating the replacement', async () => {
      setupNoRelations();
      const tx = mockTx();
      tx.operationalPersonAssignment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.transfer(
        'pa1',
        { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      )).rejects.toThrow(BadRequestException);
      expect(tx.operationalPersonAssignment.create).not.toHaveBeenCalled();
    });

    it('rejects a stale relationship mutation before creating its continuation', async () => {
      const relationship = setupWithInbound();
      const tx = mockTx();
      tx.supervisorAssignment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.transfer('pa1', {
        departmentId: 'dept2',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: relationship.id, action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      }, ctx, 'user-1')).rejects.toThrow(BadRequestException);
      expect(tx.supervisorAssignment.create).not.toHaveBeenCalled();
    });

    it('propagates a late audit failure through the Serializable transaction boundary', async () => {
      setupNoRelations();
      const tx = mockTx();
      auditService.logWithClient.mockRejectedValueOnce(new Error('audit unavailable'));

      await expect(service.transfer(
        'pa1',
        { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' },
        ctx,
        'user-1',
      )).rejects.toThrow('audit unavailable');
      expect(tx.operationalPersonAssignment.create).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
      expect(auditService.logWithClient).toHaveBeenCalledWith(tx, expect.any(Object));
    });

    it('rolls back old/new assignments and relationship reconciliation after a forced late failure', async () => {
      const durableState = {
        oldAssignmentEffectiveTo: null as Date | null,
        newAssignmentIds: [] as string[],
        oldRelationshipEffectiveTo: null as Date | null,
        continuationIds: [] as string[],
      };
      const relationship = baseInbound({ id: 'sa-rollback' });
      prisma.$transaction.mockImplementation(async (callback: any) => {
        const draft = {
          oldAssignmentEffectiveTo: durableState.oldAssignmentEffectiveTo,
          newAssignmentIds: [...durableState.newAssignmentIds],
          oldRelationshipEffectiveTo: durableState.oldRelationshipEffectiveTo,
          continuationIds: [...durableState.continuationIds],
        };
        const tx: any = {
          operationalPersonAssignment: {
            findFirst: jest.fn((args: any) => {
              if (args?.where?.id === 'pa1') {
                return Promise.resolve(baseAssignment({ effectiveTo: draft.oldAssignmentEffectiveTo }));
              }
              if (args?.where?.id === 'pa-super') {
                return Promise.resolve(baseAssignment({
                  id: 'pa-super',
                  personnelId: 'super1',
                  assignmentType: 'SECONDARY',
                  effectiveFrom: new Date('2025-01-01'),
                }));
              }
              if (args?.where?.id === 'pa2' && draft.newAssignmentIds.includes('pa2')) {
                return Promise.resolve(baseAssignment({ id: 'pa2' }));
              }
              return Promise.resolve(null);
            }),
            findMany: jest.fn().mockResolvedValue([]),
            updateMany: jest.fn((args: any) => {
              if (args.where.id === 'pa1' && draft.oldAssignmentEffectiveTo === null) {
                draft.oldAssignmentEffectiveTo = args.data.effectiveTo;
                return Promise.resolve({ count: 1 });
              }
              return Promise.resolve({ count: 0 });
            }),
            create: jest.fn(() => {
              draft.newAssignmentIds.push('pa2');
              return Promise.resolve(baseAssignment({ id: 'pa2', departmentId: 'dept2' }));
            }),
          },
          department: { findFirst: jest.fn().mockResolvedValue(newDept2) },
          jobTitle: { findFirst: jest.fn().mockResolvedValue({ id: 'jt1' }) },
          branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-a' }) },
          administration: { findFirst: jest.fn() },
          operationalPerson: { findFirst: jest.fn().mockResolvedValue({ id: 'person1' }) },
          userRole: prisma.userRole,
          supervisorAssignment: {
            findMany: jest.fn((args: any) => {
              if (args?.include?.supervisorAssignment && args?.where?.assignmentId === 'pa1') {
                return Promise.resolve([relationship]);
              }
              return Promise.resolve([]);
            }),
            updateMany: jest.fn((args: any) => {
              if (args.where.id === relationship.id && draft.oldRelationshipEffectiveTo === null) {
                draft.oldRelationshipEffectiveTo = args.data.effectiveTo;
                return Promise.resolve({ count: 1 });
              }
              return Promise.resolve({ count: 0 });
            }),
            create: jest.fn((args: any) => {
              draft.continuationIds.push('sa-continuation');
              return Promise.resolve({ id: 'sa-continuation', ...args.data });
            }),
          },
        };

        const result = await callback(tx);
        durableState.oldAssignmentEffectiveTo = draft.oldAssignmentEffectiveTo;
        durableState.newAssignmentIds = draft.newAssignmentIds;
        durableState.oldRelationshipEffectiveTo = draft.oldRelationshipEffectiveTo;
        durableState.continuationIds = draft.continuationIds;
        return result;
      });
      auditService.logWithClient.mockImplementation(async (_tx: any, entry: any) => {
        if (entry.action === 'TRANSFER') throw new Error('forced late audit failure');
      });

      await expect(service.transfer('pa1', {
        departmentId: 'dept2',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{
          relationshipId: relationship.id,
          action: 'CONTINUE_ON_NEW_ASSIGNMENT',
        }],
      }, ctx, 'user-1')).rejects.toThrow('forced late audit failure');

      expect(durableState.oldAssignmentEffectiveTo).toBeNull();
      expect(durableState.newAssignmentIds).toEqual([]);
      expect(durableState.oldRelationshipEffectiveTo).toBeNull();
      expect(durableState.continuationIds).toEqual([]);
    });
  });

  describe('canonical HIER-A integrity reuse', () => {
    const snapshot = (id: string, personnelId: string) => ({
      id,
      personnelId,
      branchId: 'branch-a',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: null,
    });

    it('scopes both overlap and cycle graph reads to the active company', async () => {
      prisma.supervisorAssignment.findMany.mockImplementation((args: any) => {
        if (args?.where?.companyId !== 'company-a') {
          return Promise.resolve([{
            id: 'poison-company-b',
            assignmentId: args?.where?.assignmentId,
            supervisorAssignmentId: 'pa-subordinate',
            effectiveFrom: new Date('2025-01-01'),
            effectiveTo: null,
          }]);
        }
        return Promise.resolve([]);
      });

      await expect(supervisorAssignmentsService.assertDirectIntegrityWithClient(prisma, {
        companyId: 'company-a',
        assignmentId: 'pa-subordinate',
        supervisorAssignmentId: 'pa-supervisor',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        assignmentSnapshot: snapshot('pa-subordinate', 'person-subordinate'),
        supervisorAssignmentSnapshot: snapshot('pa-supervisor', 'person-supervisor'),
      })).resolves.toBeUndefined();

      expect(prisma.supervisorAssignment.findMany).toHaveBeenCalledTimes(2);
      for (const [args] of prisma.supervisorAssignment.findMany.mock.calls) {
        expect(args.where.companyId).toBe('company-a');
      }
    });

    it('explores every temporally overlapping DIRECT edge and catches a non-first cycle path', async () => {
      prisma.supervisorAssignment.findMany.mockImplementation((args: any) => {
        switch (args?.where?.assignmentId) {
          case 'pa-subordinate':
            return Promise.resolve([]);
          case 'pa-supervisor':
            return Promise.resolve([
              {
                id: 'sa-first-safe-window',
                assignmentId: 'pa-supervisor',
                supervisorAssignmentId: 'pa-safe',
                effectiveFrom: new Date('2026-01-01'),
                effectiveTo: new Date('2026-06-01'),
              },
              {
                id: 'sa-second-cycle-window',
                assignmentId: 'pa-supervisor',
                supervisorAssignmentId: 'pa-cycle',
                effectiveFrom: new Date('2026-06-01'),
                effectiveTo: new Date('2027-01-01'),
              },
            ]);
          case 'pa-safe':
            return Promise.resolve([]);
          case 'pa-cycle':
            return Promise.resolve([{
              id: 'sa-cycle-back',
              assignmentId: 'pa-cycle',
              supervisorAssignmentId: 'pa-subordinate',
              effectiveFrom: new Date('2026-07-01'),
              effectiveTo: new Date('2026-12-01'),
            }]);
          default:
            return Promise.resolve([]);
        }
      });

      await expect(supervisorAssignmentsService.assertDirectIntegrityWithClient(prisma, {
        companyId: 'company-a',
        assignmentId: 'pa-subordinate',
        supervisorAssignmentId: 'pa-supervisor',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2027-01-01'),
        assignmentSnapshot: snapshot('pa-subordinate', 'person-subordinate'),
        supervisorAssignmentSnapshot: snapshot('pa-supervisor', 'person-supervisor'),
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('temporal boundary', () => {
    it('half-open intervals: old ends at T, new starts at T, no overlap', async () => {
      const rel = setupWithInbound();
      const tx = mockTx();
      tx.supervisorAssignment.findFirst.mockResolvedValue(null);
      await service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: rel.id, action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      }, ctx, 'user-1');
      const createCall = tx.supervisorAssignment.create.mock.calls[0][0];
      expect(createCall.data.effectiveFrom.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(createCall.data.effectiveTo).toBeNull();
    });

    it('historical relationship remains unchanged after transfer', async () => {
      const rel = baseInbound({ id: 'sa-hist', effectiveTo: new Date('2026-03-01'), isActive: false });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
      prisma.department.findFirst.mockResolvedValue(newDept2);
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([rel])
        .mockResolvedValueOnce([]);
      const tx = mockTx();
      await service.transfer('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx, 'user-1');
      expect(tx.supervisorAssignment.updateMany).not.toHaveBeenCalled();
      expect(tx.supervisorAssignment.create).not.toHaveBeenCalled();
    });

    it('cancels a future relationship without writing an inverted effective interval', async () => {
      const rel = baseInbound({ id: 'sa-future-end', effectiveFrom: new Date('2027-01-01') });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
      prisma.department.findFirst.mockResolvedValue(newDept2);
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([rel])
        .mockResolvedValueOnce([]);
      const tx = mockTx();

      await service.transfer('pa1', {
        departmentId: 'dept2',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: rel.id, action: 'END_AT_TRANSFER' }],
      }, ctx, 'user-1');

      const retirement = tx.supervisorAssignment.updateMany.mock.calls[0][0];
      expect(retirement.data).toEqual({ isActive: false, status: 'CANCELLED' });
      expect(retirement.data).not.toHaveProperty('effectiveTo');
      expect(tx.supervisorAssignment.create).not.toHaveBeenCalled();
    });

    it('future relationship dates preserved when continued', async () => {
      const rel = baseInbound({ id: 'sa-future', effectiveFrom: new Date('2027-01-01') });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValueOnce(baseAssignment());
      prisma.department.findFirst.mockResolvedValue(newDept2);
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.operationalPerson.findFirst.mockResolvedValue({ id: 'person1' });
      prisma.supervisorAssignment.findMany
        .mockResolvedValueOnce([rel])
        .mockResolvedValueOnce([]);
      const tx = mockTx();
      tx.supervisorAssignment.findFirst.mockResolvedValue(null);
      await service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: 'sa-future', action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      }, ctx, 'user-1');
      const createCall = tx.supervisorAssignment.create.mock.calls[0][0];
      expect(createCall.data.effectiveFrom.toISOString()).toBe('2027-01-01T00:00:00.000Z');
      expect(tx.supervisorAssignment.updateMany.mock.calls[0][0].data).toEqual({
        isActive: false,
        status: 'CANCELLED',
      });
    });
  });
});
