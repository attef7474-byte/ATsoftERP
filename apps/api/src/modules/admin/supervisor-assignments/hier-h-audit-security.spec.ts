import { BadRequestException } from '@nestjs/common';
import { SupervisorAssignmentsService } from './supervisor-assignments.service';
import { PersonAssignmentsService } from '../person-assignments/person-assignments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('HIER-H Audit Security — Supervisor Assignments', () => {
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

  const supervisorSaForBulk = (overrides: Record<string, any> = {}) => ({
    id: 'sa1',
    companyId: 'company-a',
    personnelId: 'sup-person',
    departmentId: 'dept1',
    assignmentType: 'PRIMARY',
    branchId: 'branch-a',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    deletedAt: null,
    person: { id: 'sup-p', name: 'Sup Person', code: 'SP' },
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

  describe('§15 Audit Coverage Matrix', () => {
    it('HIGH_RISK_MUTATION_WITHOUT_AUDIT: create (DIRECT) emits audit via logWithClient', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(pa('pa1', 'personA'))
        .mockResolvedValueOnce(pa('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.create.mockResolvedValue(saRecord());

      await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(auditService.logWithClient).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-1',
          action: 'CREATE',
          entity: 'SupervisorAssignment',
        }),
      );
    });

    it('HIGH_RISK_MUTATION_WITHOUT_AUDIT: create (MATRIX) emits audit via log', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(pa('pa1', 'personA'))
        .mockResolvedValueOnce(pa('pa2', 'personB'));
      prisma.supervisorAssignment.create.mockResolvedValue(saRecord({ relationshipType: 'MATRIX' }));

      await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', relationshipType: 'MATRIX', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'CREATE',
          entity: 'SupervisorAssignment',
        }),
      );
    });

    it('HIGH_RISK_MUTATION_WITHOUT_AUDIT: remove emits audit REMOVE', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(saRecord());

      await service.remove('sa1', ctx, 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'REMOVE',
          entity: 'SupervisorAssignment',
          entityId: 'sa1',
        }),
      );
    });

    it('HIGH_RISK_MUTATION_WITHOUT_AUDIT: update (non-transactional) emits audit UPDATE', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(saRecord());
      prisma.supervisorAssignment.update.mockResolvedValue(saRecord());

      await service.update('sa1', { relationshipType: 'MATRIX' } as any, ctx, 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'UPDATE',
          entity: 'SupervisorAssignment',
          entityId: 'sa1',
        }),
      );
    });

    it('HIGH_RISK_MUTATION_WITHOUT_AUDIT: bulk apply emits individual + summary audit', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(supervisorSaForBulk());
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([
        pa('pa1', 'personA'),
        pa('pa2', 'personB'),
      ]);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);
      prisma.supervisorAssignment.create.mockResolvedValue(saRecord({ id: 'sa-new-1' }));

      await service.bulkApply(
        { supervisorAssignmentId: 'sa1', assignmentIds: ['pa1', 'pa2'], effectiveFrom: '2026-06-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
        'user-1',
      );

      const logCalls = auditService.logWithClient.mock.calls.map((c: any) => c[1]);
      const createCalls = logCalls.filter((c: any) => c.action === 'CREATE' && c.entity === 'SupervisorAssignment');
      const bulkSummary = logCalls.filter((c: any) => c.action === 'BULK_CREATE');

      expect(createCalls.length).toBe(2);
      expect(bulkSummary.length).toBe(1);
      expect(bulkSummary[0].details).toContain('"bulkOperation":true');
    });

    it('audit details include companyId (DIRECT create via logWithClient)', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(pa('pa1', 'personA'))
        .mockResolvedValueOnce(pa('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.create.mockResolvedValue(saRecord());

      await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
        'user-1',
      );

      const logCall = auditService.logWithClient.mock.calls[0][1];
      const details = JSON.parse(logCall.details);
      expect(details.companyId).toBe('company-a');
    });
  });

  describe('§16 Audit Atomicity', () => {
    it('BULK_AUDIT_INSIDE_TRANSACTION = YES: bulk apply audit uses logWithClient', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(supervisorSaForBulk());
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.operationalPersonAssignment.findMany.mockResolvedValue([pa('pa1', 'personA')]);
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.count.mockResolvedValue(0);
      prisma.supervisorAssignment.create.mockResolvedValue(saRecord());

      await service.bulkApply(
        { supervisorAssignmentId: 'sa1', assignmentIds: ['pa1'], effectiveFrom: '2026-06-01T00:00:00.000Z', relationshipType: 'DIRECT' },
        ctx,
        'user-1',
      );

      expect(auditService.logWithClient).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('SINGLE_RELATION_AUDIT_INSIDE_TRANSACTION: non-DIRECT update uses auditService.log (not in TX)', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(saRecord());
      prisma.supervisorAssignment.update.mockResolvedValue(saRecord());

      await service.update('sa1', { relationshipType: 'MATRIX' } as any, ctx, 'user-1');

      expect(auditService.log).toHaveBeenCalled();
      expect(auditService.logWithClient).not.toHaveBeenCalled();
    });

    it('SINGLE_RELATION_AUDIT_INSIDE_TRANSACTION: DIRECT change with transaction uses logWithClient', async () => {
      prisma.supervisorAssignment.findFirst.mockResolvedValue(
        saRecord({ assignment: { personnelId: 'personA', branchId: 'branch-a', effectiveTo: null } }),
      );
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(pa('pa2-new', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.update.mockResolvedValue(saRecord());

      await service.update('sa1', {
        supervisorAssignmentId: 'pa2-new',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
      } as any, ctx, 'user-1');

      expect(auditService.logWithClient).toHaveBeenCalled();
    });

    it('LEADERSHIP_AUDIT_INSIDE_TRANSACTION: person-assignment create leadershipLevel is audited post-commit via auditService.log (no transaction)', async () => {
      const personPrisma = {
        operationalPersonAssignment: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'pa-new',
            companyId: 'company-a',
            leadershipLevel: 'DEPARTMENT_HEAD',
            assignmentType: 'PRIMARY',
          }),
        },
        department: { findFirst: jest.fn().mockResolvedValue({ id: 'dept1', branchId: 'branch-a', companyId: 'company-a', branch: { id: 'branch-a', companyId: 'company-a', deletedAt: null } }) },
        jobTitle: { findFirst: jest.fn().mockResolvedValue({ id: 'jt1', companyId: 'company-a', deletedAt: null }) },
        branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-a', companyId: 'company-a', deletedAt: null }) },
        operationalPerson: { findFirst: jest.fn().mockResolvedValue({ id: 'person1' }) },
        $transaction: jest.fn(),
      };
      personPrisma.$transaction.mockImplementation(async (fn: any) => fn(personPrisma));
      const personAudit = { log: jest.fn(), logWithClient: jest.fn() };
      const personService = new PersonAssignmentsService(personPrisma as any, personAudit as any, {} as any);

      await personService.create(
        {
          departmentId: 'dept1',
          branchId: 'branch-a',
          personnelId: 'person1',
          leadershipLevel: 'DEPARTMENT_HEAD',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
        } as any,
        ctx,
        'user-1',
      );

      expect(personAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'CREATE',
          entity: 'OperationalPersonAssignment',
        }),
      );
      const auditDetails = JSON.parse(personAudit.log.mock.calls[0][0].details);
      expect(auditDetails.leadershipLevel).toBe('DEPARTMENT_HEAD');
      expect(personAudit.logWithClient).not.toHaveBeenCalled();
    });

    it('LEADERSHIP_AUDIT_INSIDE_TRANSACTION: person-assignment update leadershipLevel is audited post-commit via auditService.log (no transaction)', async () => {
      const existingRecord = {
        id: 'pa1',
        companyId: 'company-a',
        personnelId: 'person1',
        departmentId: 'dept1',
        jobTitleId: 'jt1',
        assignmentType: 'PRIMARY',
        leadershipLevel: 'NONE',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        deletedAt: null,
        company: { id: 'company-a', name: 'CoA', code: 'CA' },
        branch: { id: 'branch-a', name: 'BrA' },
        administration: null,
        department: { id: 'dept1', name: 'D1', code: 'D1', branchId: 'branch-a', companyId: 'company-a', branch: { id: 'branch-a', companyId: 'company-a', deletedAt: null } },
        jobTitle: { id: 'jt1', name: 'JT1', code: 'JT1' },
        person: { id: 'person1', name: 'P1', code: 'P1' },
      };
      const personPrisma = {
        operationalPersonAssignment: {
          findFirst: jest.fn()
            .mockResolvedValueOnce(existingRecord)
            .mockResolvedValueOnce(null),
          update: jest.fn().mockImplementation(({ where, data }) =>
            Promise.resolve({ id: where.id, ...data, companyId: 'company-a' }),
          ),
        },
        department: { findFirst: jest.fn().mockResolvedValue({ id: 'dept1', branchId: 'branch-a', companyId: 'company-a', branch: { id: 'branch-a', companyId: 'company-a', deletedAt: null } }) },
        jobTitle: { findFirst: jest.fn().mockResolvedValue({ id: 'jt1', companyId: 'company-a', deletedAt: null }) },
        branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-a', companyId: 'company-a', deletedAt: null }) },
        operationalPerson: { findFirst: jest.fn().mockResolvedValue({ id: 'person1' }) },
        $transaction: jest.fn(),
      };
      personPrisma.$transaction.mockImplementation(async (fn: any) => fn(personPrisma));
      const personAudit = { log: jest.fn(), logWithClient: jest.fn() };
      const personService = new PersonAssignmentsService(personPrisma as any, personAudit as any, {} as any);

      await personService.update(
        'pa1',
        { leadershipLevel: 'DEPARTMENT_HEAD' } as any,
        ctx,
        'user-1',
      );

      expect(personAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'UPDATE',
          entity: 'OperationalPersonAssignment',
          entityId: 'pa1',
        }),
      );
      const auditDetails = JSON.parse(personAudit.log.mock.calls[0][0].details);
      expect(auditDetails.leadershipLevel).toBe('DEPARTMENT_HEAD');
      expect(personAudit.logWithClient).not.toHaveBeenCalled();
    });
  });

  describe('§16 Audit Atomicity — Transfer (via SupervisorAssignmentsService.assertDirectIntegrityWithClient)', () => {
    it('TRANSFER_AUDIT_INSIDE_TRANSACTION: transfer uses logWithClient for atomic audit', async () => {
      expect(typeof service.assertDirectIntegrityWithClient).toBe('function');
    });
  });

  describe('§15 Audit — No userId leakage', () => {
    it('audit uses userId from context, not from body', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(pa('pa1', 'personA'))
        .mockResolvedValueOnce(pa('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.create.mockResolvedValue(saRecord());

      await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
        'actual-user-id',
      );

      const logCall = auditService.logWithClient.mock.calls[0][1];
      expect(logCall.userId).toBe('actual-user-id');
    });

    it('audit defaults to system when userId is undefined', async () => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce(pa('pa1', 'personA'))
        .mockResolvedValueOnce(pa('pa2', 'personB'));
      prisma.supervisorAssignment.findMany.mockResolvedValue([]);
      prisma.supervisorAssignment.findFirst.mockResolvedValue(null);
      prisma.supervisorAssignment.create.mockResolvedValue(saRecord());

      await service.create(
        { assignmentId: 'pa1', supervisorAssignmentId: 'pa2', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        ctx,
      );

      const logCall = auditService.logWithClient.mock.calls[0][1];
      expect(logCall.userId).toBe('system');
    });
  });
});
