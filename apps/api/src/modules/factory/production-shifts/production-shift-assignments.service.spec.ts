import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductionShiftAssignmentsService } from './production-shift-assignments.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctxA: ActiveOperationalContext = {
  contextKey: 'c1:b1:-:-',
  scopeId: 's1',
  companyId: 'c1',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'b1',
  branchName: 'HQ',
  branchCode: 'HQ',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const ctxB: ActiveOperationalContext = {
  ...ctxA,
  contextKey: 'c2:b2:-:-',
  companyId: 'c2',
  companyName: 'Company B',
  branchId: 'b2',
  branchName: 'HQ2',
};

const assignment = (overrides: Record<string, any> = {}) => ({
  id: 'a1',
  code: 'PSA-000001',
  shiftId: 's1',
  calendarId: null,
  operationalPersonId: 'p1',
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  effectiveTo: null,
  isPrimary: false,
  notes: null,
  companyId: 'c1',
  branchId: 'b1',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('ProductionShiftAssignmentsService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: ProductionShiftAssignmentsService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      operationalPerson: { findUnique: jest.fn() },
      productionShift: { findFirst: jest.fn() },
      productionShiftCalendar: { findFirst: jest.fn() },
      productionShiftAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((fn: any, _opts?: any) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined), logWithClient: jest.fn().mockResolvedValue(undefined) };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('PSA-000001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('PSA-000001'),
    };
    service = new ProductionShiftAssignmentsService(prisma, audit, numbering);
  });

  describe('create', () => {
    const validDto = { shiftId: 's1', operationalPersonId: 'p1', effectiveFrom: '2026-01-01' };

    it('creates an assignment scoped to the active tenant', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.operationalPerson.findUnique.mockResolvedValue({ id: 'p1', isActive: true });
      prisma.productionShiftAssignment.findUnique.mockResolvedValue(null);
      prisma.productionShiftAssignment.findFirst.mockResolvedValue(null);
      prisma.productionShiftAssignment.create.mockImplementation(({ data }: any) => Promise.resolve(assignment(data)));

      await service.create(validDto, 'u1', ctxA);

      expect(prisma.productionShiftAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'ACTIVE' }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'ProductionShiftAssignment', 'a1', expect.anything());
    });

    it('rejects a shift from another company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);

      await expect(service.create(validDto, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown operational person', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.operationalPerson.findUnique.mockResolvedValue(null);

      await expect(service.create(validDto, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects effectiveTo before effectiveFrom', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.operationalPerson.findUnique.mockResolvedValue({ id: 'p1', isActive: true });

      await expect(
        service.create({ ...validDto, effectiveFrom: '2026-06-01', effectiveTo: '2026-01-01' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an overlapping assignment for the same person on a different shift', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.operationalPerson.findUnique.mockResolvedValue({ id: 'p1', isActive: true });
      prisma.productionShiftAssignment.findUnique.mockResolvedValue(null);
      prisma.productionShiftAssignment.findFirst.mockResolvedValue(assignment({ shiftId: 's2' }));

      await expect(service.create(validDto, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows a non-overlapping assignment for the same person', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.operationalPerson.findUnique.mockResolvedValue({ id: 'p1', isActive: true });
      prisma.productionShiftAssignment.findUnique.mockResolvedValue(null);
      prisma.productionShiftAssignment.findFirst.mockResolvedValue(null);
      prisma.productionShiftAssignment.create.mockImplementation(({ data }: any) => Promise.resolve(assignment(data)));

      await service.create(validDto, 'u1', ctxA);
      expect(prisma.productionShiftAssignment.create).toHaveBeenCalled();
    });

    it('allows the same code in another company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c2' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.operationalPerson.findUnique.mockResolvedValue({ id: 'p1', isActive: true });
      prisma.productionShiftAssignment.findUnique.mockResolvedValue(null);
      prisma.productionShiftAssignment.findFirst.mockResolvedValue(null);
      prisma.productionShiftAssignment.create.mockImplementation(({ data }: any) => Promise.resolve(assignment(data)));

      await service.create(validDto, 'u1', ctxB);
      expect(prisma.productionShiftAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'c2', branchId: 'b2' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('does not leak an assignment from another company (404)', async () => {
      prisma.productionShiftAssignment.findFirst.mockResolvedValue(null);

      await expect(service.findOne('a1', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejects an overlapping assignment on update', async () => {
      prisma.productionShiftAssignment.findFirst
        .mockResolvedValueOnce(assignment()) // findOwned
        .mockResolvedValueOnce(assignment({ id: 'a2', shiftId: 's2' })); // conflict
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });

      await expect(
        service.update('a1', { shiftId: 's2' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates the assignment and audits', async () => {
      prisma.productionShiftAssignment.findFirst
        .mockResolvedValueOnce(assignment()) // findOwned
        .mockResolvedValueOnce(null); // no conflict
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.productionShiftAssignment.update.mockImplementation(({ data }: any) => Promise.resolve(assignment(data)));

      const result = await service.update('a1', { isPrimary: true }, 'u1', ctxA);
      expect(prisma.productionShiftAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isPrimary: true }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'UPDATE', 'ProductionShiftAssignment', 'a1', expect.anything());
      expect(result).toBeTruthy();
    });
  });

  describe('remove', () => {
    it('soft deletes and audits', async () => {
      prisma.productionShiftAssignment.findFirst.mockResolvedValue(assignment());
      prisma.productionShiftAssignment.update.mockResolvedValue(assignment());

      await service.remove('a1', 'u1', ctxA);

      expect(prisma.productionShiftAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'ProductionShiftAssignment', 'a1');
    });
  });

  describe('findCurrent', () => {
    it('resolves only active assignments valid on the reference date', async () => {
      prisma.operationalPerson.findUnique.mockResolvedValue({ id: 'p1', isActive: true });
      prisma.productionShiftAssignment.findMany.mockResolvedValue([assignment()]);

      const result = await service.findCurrent('p1', '2026-03-01', ctxA);

      expect(prisma.productionShiftAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            operationalPersonId: 'p1',
            companyId: 'c1',
            branchId: 'b1',
            status: 'ACTIVE',
            deletedAt: null,
          }),
        }),
      );
      expect(result.count).toBe(1);
    });

    it('does not resolve across companies', async () => {
      prisma.operationalPerson.findUnique.mockResolvedValue({ id: 'p1', isActive: true });
      prisma.productionShiftAssignment.findMany.mockResolvedValue([]);

      const result = await service.findCurrent('p1', '2026-03-01', ctxB);
      expect(prisma.productionShiftAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c2', branchId: 'b2' }),
        }),
      );
      expect(result.count).toBe(0);
    });

    it('rejects an invalid reference date', async () => {
      prisma.operationalPerson.findUnique.mockResolvedValue({ id: 'p1', isActive: true });

      await expect(service.findCurrent('p1', 'not-a-date', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('scopes the list query to the tenant and excludes deleted assignments', async () => {
      prisma.productionShiftAssignment.findMany.mockResolvedValue([assignment()]);
      prisma.productionShiftAssignment.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);

      expect(prisma.productionShiftAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(result.meta.total).toBe(1);
    });
  });

  describe('createBatch', () => {
    const validBatch = { shiftId: 's1', operationalPersonIds: ['p1', 'p2', 'p3'], effectiveFrom: '2026-01-01' };

    const primeHappyPath = () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.operationalPerson.findUnique.mockImplementation(({ where }: any) => Promise.resolve({ id: where.id, isActive: true }));
      prisma.productionShiftAssignment.findUnique.mockResolvedValue(null);
      prisma.productionShiftAssignment.findFirst.mockResolvedValue(null);
      prisma.productionShiftAssignment.create.mockImplementation(({ data }: any) =>
        Promise.resolve(assignment({ ...data, id: `a-${data.operationalPersonId}` })),
      );
    };

    it('S1/S2 creates one canonical row per operational person', async () => {
      primeHappyPath();
      const res = await service.createBatch(validBatch, 'u1', ctxA);
      expect(res.count).toBe(3);
      expect(prisma.productionShiftAssignment.create).toHaveBeenCalledTimes(3);
    });

    it('S3 dedupes repeated person ids', async () => {
      primeHappyPath();
      const res = await service.createBatch({ ...validBatch, operationalPersonIds: ['p1', 'p1', 'p2'] }, 'u1', ctxA);
      expect(res.count).toBe(2);
      expect(prisma.productionShiftAssignment.create).toHaveBeenCalledTimes(2);
    });

    it('S4 rolls back everything when any person is invalid', async () => {
      primeHappyPath();
      prisma.operationalPerson.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === 'p2' ? null : { id: where.id, isActive: true }),
      );
      await expect(service.createBatch(validBatch, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.productionShiftAssignment.create).not.toHaveBeenCalled();
    });

    it('S5 rejects an inactive operational person (global catalog has no tenant)', async () => {
      primeHappyPath();
      prisma.operationalPerson.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === 'p2' ? { id: where.id, isActive: false } : { id: where.id, isActive: true }),
      );
      await expect(service.createBatch(validBatch, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.productionShiftAssignment.create).not.toHaveBeenCalled();
    });

    it('S6 rolls back all when any person overlaps an existing active assignment', async () => {
      primeHappyPath();
      prisma.productionShiftAssignment.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(where.operationalPersonId === 'p2' ? assignment({ id: 'a-existing' }) : null),
      );
      await expect(service.createBatch(validBatch, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.productionShiftAssignment.create).not.toHaveBeenCalled();
    });

    it('S7 propagates the shared isPrimary flag to every row without inventing uniqueness', async () => {
      primeHappyPath();
      await service.createBatch({ ...validBatch, isPrimary: true }, 'u1', ctxA);
      expect(prisma.productionShiftAssignment.create).toHaveBeenCalledTimes(3);
      for (const call of prisma.productionShiftAssignment.create.mock.calls) {
        expect(call[0].data.isPrimary).toBe(true);
      }
    });

    it('S8 runs the batch at Serializable isolation for concurrent-duplicate safety', async () => {
      primeHappyPath();
      await service.createBatch(validBatch, 'u1', ctxA);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.$transaction.mock.calls[0][1]).toEqual(expect.objectContaining({ isolationLevel: 'Serializable' }));
    });

    it('S9 writes one audit event per created row', async () => {
      primeHappyPath();
      await service.createBatch(validBatch, 'u1', ctxA);
      expect(audit.logWithClient).toHaveBeenCalledTimes(3);
    });

    it('S10 pre-checks overlap per ACTIVE person and writes tenant-scoped rows', async () => {
      primeHappyPath();
      await service.createBatch(validBatch, 'u1', ctxA);
      expect(prisma.productionShiftAssignment.findFirst).toHaveBeenCalledTimes(3);
      for (const call of prisma.productionShiftAssignment.findFirst.mock.calls) {
        expect(call[0].where).toEqual(expect.objectContaining({ status: 'ACTIVE', deletedAt: null }));
      }
      expect(prisma.productionShiftAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'ACTIVE' }) }),
      );
    });

    it('rejects an empty person list', async () => {
      primeHappyPath();
      await expect(service.createBatch({ ...validBatch, operationalPersonIds: [] }, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.productionShiftAssignment.create).not.toHaveBeenCalled();
    });
  });
});
