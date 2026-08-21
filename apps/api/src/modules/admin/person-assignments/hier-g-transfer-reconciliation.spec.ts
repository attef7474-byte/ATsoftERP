import { BadRequestException } from '@nestjs/common';
import { PersonAssignmentsService } from './person-assignments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('PersonAssignmentsService — HIER-G Transfer Reconciliation', () => {
  let prisma: any;
  let auditService: any;
  let service: PersonAssignmentsService;
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
      person: { id: 'super1', name: 'Supervisor', code: 'S001' },
      department: { id: 'dept-s', name: 'SuperDept', code: 'SD' },
      jobTitle: { id: 'jt-s', name: 'Manager', code: 'M1' },
      branch: { id: 'branch-a', name: 'Branch A' },
      administration: null, leadershipLevel: 'DEPARTMENT_HEAD',
    }, ...overrides,
  });

  const baseOutbound = (overrides: Record<string, any> = {}) => ({
    id: 'sa-out1', companyId: 'company-a', assignmentId: 'pa-sub1',
    supervisorAssignmentId: 'pa1', relationshipType: 'DIRECT',
    effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
    isActive: true, deletedAt: null,
    assignment: {
      person: { id: 'sub1', name: 'Subordinate', code: 'SUB01' },
      department: { id: 'dept-sub', name: 'SubDept', code: 'SD' },
      jobTitle: { id: 'jt-sub', name: 'Worker', code: 'W1' },
      branch: { id: 'branch-a', name: 'Branch A' },
      administration: null, assignmentType: 'PRIMARY',
    }, ...overrides,
  });

  const newDept2 = { id: 'dept2', name: 'Dept2', code: 'D2' };
  const newBranch = { id: 'branch-b', name: 'Branch B' };

  beforeEach(() => {
    prisma = {
      operationalPersonAssignment: {
        findFirst: jest.fn(), create: jest.fn(), update: jest.fn(),
        findMany: jest.fn(), count: jest.fn(),
      },
      department: { findFirst: jest.fn() },
      jobTitle: { findFirst: jest.fn() },
      branch: { findFirst: jest.fn() },
      administration: { findFirst: jest.fn() },
      operationalPerson: { findFirst: jest.fn() },
      supervisorAssignment: {
        count: jest.fn(), findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(), create: jest.fn(), update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    auditService = { log: jest.fn(), logWithClient: jest.fn() };
    service = new PersonAssignmentsService(prisma, auditService);
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
    const subordinateForOutbound = baseAssignment({ id: 'pa-sub1', personnelId: 'sub1' });
    const supervisorForInbound = baseAssignment({ id: 'pa-super', personnelId: 'super1', branchId: 'branch-a' });
    const tx = {
      operationalPersonAssignment: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue(baseAssignment({ id: 'pa2', departmentId: 'dept2' })),
        findFirst: jest.fn().mockImplementation((args: any) => {
          if (args?.where?.id === 'pa-sub1') return Promise.resolve(subordinateForOutbound);
          if (args?.where?.id === 'pa-super') return Promise.resolve(supervisorForInbound);
          if (args?.where?.id === 'pa2') return Promise.resolve(baseAssignment({ id: 'pa2', personnelId: 'person1' }));
          if (args?.where?.id && args?.where?.id !== 'pa1') return Promise.resolve(baseAssignment({ id: args.where.id, personnelId: 'other' }));
          if (args?.where?.personnelId === 'sub1' && !args?.where?.assignmentType) return Promise.resolve(subordinateForOutbound);
          if (args?.where?.personnelId === 'super1' && !args?.where?.assignmentType) return Promise.resolve(supervisorForInbound);
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      supervisorAssignment: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'new-sa', relationshipType: 'DIRECT' }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ...extra,
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    return tx;
  }

  describe('transferPreview', () => {
    it('returns empty when no relationships exist', async () => {
      setupNoRelations();
      const result = await service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx);
      expect(result.summary.totalAffected).toBe(0);
      expect(result.affectedRelationships).toHaveLength(0);
      expect(result.oldAssignment.id).toBe('pa1');
    });

    it('discovers inbound relationships with human context', async () => {
      const rel = setupWithInbound();
      const result = await service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx);
      expect(result.summary.currentInbound).toBe(1);
      const r = result.affectedRelationships[0];
      expect(r.direction).toBe('INBOUND');
      expect(r.otherParty.person.name).toBe('Supervisor');
      expect(r.otherParty.leadershipLevel).toBe('DEPARTMENT_HEAD');
    });

    it('discovers outbound relationships with human context', async () => {
      setupWithOutbound();
      const result = await service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx);
      expect(result.summary.currentOutbound).toBe(1);
      const r = result.affectedRelationships[0];
      expect(r.direction).toBe('OUTBOUND');
      expect(r.otherParty.person.name).toBe('Subordinate');
    });

    it('classifies historical relationships as HISTORICAL', async () => {
      setupWithInbound({ effectiveTo: new Date('2026-03-01'), isActive: false });
      const result = await service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx);
      expect(result.summary.historicalUnaffected).toBe(1);
      expect(result.affectedRelationships[0].temporalCategory).toBe('HISTORICAL');
      expect(result.affectedRelationships[0].allowedResolutions).toHaveLength(0);
    });

    it('classifies future relationships as FUTURE', async () => {
      setupWithInbound({ effectiveFrom: new Date('2027-01-01') });
      const result = await service.transferPreview('pa1', { departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z' }, ctx);
      expect(result.summary.futureInbound).toBe(1);
      expect(result.affectedRelationships[0].temporalCategory).toBe('FUTURE');
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
      expect(tx.supervisorAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: rel.id }, data: expect.objectContaining({ isActive: false }) }),
      );
    });

    it('CONTINUE_ON_NEW_ASSIGNMENT creates inbound relationship on new assignment', async () => {
      const rel = setupWithInbound();
      const tx = mockTx();
      tx.supervisorAssignment.findFirst.mockResolvedValue(null);
      const result = await service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: rel.id, action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      }, ctx, 'user-1');
      expect(result.relationshipsContinued).toBe(1);
      expect(tx.supervisorAssignment.create).toHaveBeenCalled();
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
      const result = await service.transfer('pa1', {
        departmentId: 'dept2', effectiveFrom: '2026-06-01T00:00:00.000Z',
        relationshipResolutions: [{ relationshipId: rel.id, action: 'CONTINUE_ON_NEW_ASSIGNMENT' }],
      }, ctx, 'user-1');
      expect(result.relationshipsContinued).toBe(1);
      expect(tx.supervisorAssignment.create).toHaveBeenCalled();
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
      expect(tx.operationalPersonAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pa1' }, data: { effectiveTo: expect.any(Date) } }),
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
      expect(tx.supervisorAssignment.update).not.toHaveBeenCalled();
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
    });
  });
});
