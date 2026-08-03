import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductionOperationalAssignmentsService } from './production-operational-assignments.service';
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
  id: 'oa1',
  code: 'POA-000001',
  resourceType: 'MACHINE',
  machineId: 'm1',
  productionLineId: null,
  productionUnitId: null,
  shiftId: 's1',
  capacityPerShift: null,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  effectiveTo: null,
  isPrimary: false,
  notes: null,
  createdById: null,
  companyId: 'c1',
  branchId: 'b1',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('ProductionOperationalAssignmentsService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: ProductionOperationalAssignmentsService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      machine: { findUnique: jest.fn() },
      productionLine: { findFirst: jest.fn() },
      productionUnit: { findFirst: jest.fn() },
      productionShift: { findFirst: jest.fn() },
      productionOperationalAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('POA-000001') };
    service = new ProductionOperationalAssignmentsService(prisma, audit, numbering);
  });

  describe('create', () => {
    const validDto = { resourceType: 'MACHINE', machineId: 'm1', effectiveFrom: '2026-01-01', capacityPerShift: 500 };

    it('creates a MACHINE assignment scoped to the active tenant', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.productionOperationalAssignment.findUnique.mockResolvedValue(null);
      prisma.productionOperationalAssignment.findFirst.mockResolvedValue(null);
      prisma.productionOperationalAssignment.create.mockImplementation(({ data }: any) => Promise.resolve(assignment(data)));

      await service.create(validDto, 'u1', ctxA);

      expect(prisma.productionOperationalAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            branchId: 'b1',
            resourceType: 'MACHINE',
            machineId: 'm1',
            capacityPerShift: 500,
          }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'ProductionOperationalAssignment', 'oa1', expect.anything());
    });

    it('rejects a machine from another company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c2', branchId: 'b2' });

      await expect(service.create(validDto, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects conflicting resource ids', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });

      await expect(
        service.create({ ...validDto, productionLineId: 'l1' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown resource type', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });

      await expect(
        service.create({ resourceType: 'ROBOT', effectiveFrom: '2026-01-01' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an overlapping assignment for the same machine', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.productionOperationalAssignment.findUnique.mockResolvedValue(null);
      prisma.productionOperationalAssignment.findFirst.mockResolvedValue(assignment({ id: 'oa2' }));

      await expect(service.create(validDto, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows a non-overlapping assignment for the same machine', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.productionOperationalAssignment.findUnique.mockResolvedValue(null);
      prisma.productionOperationalAssignment.findFirst.mockResolvedValue(null);
      prisma.productionOperationalAssignment.create.mockImplementation(({ data }: any) => Promise.resolve(assignment(data)));

      await service.create({ ...validDto, effectiveFrom: '2027-01-01', effectiveTo: '2027-12-31' }, 'u1', ctxA);
      expect(prisma.productionOperationalAssignment.create).toHaveBeenCalled();
    });

    it('creates a LINE assignment validating tenant scope of the line', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionOperationalAssignment.findUnique.mockResolvedValue(null);
      prisma.productionOperationalAssignment.findFirst.mockResolvedValue(null);
      prisma.productionOperationalAssignment.create.mockImplementation(({ data }: any) => Promise.resolve(assignment({ ...data, resourceType: 'LINE', productionLineId: 'l1' })));

      await service.create({ resourceType: 'LINE', productionLineId: 'l1', effectiveFrom: '2026-01-01' }, 'u1', ctxA);

      expect(prisma.productionLine.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }) }),
      );
      expect(prisma.productionOperationalAssignment.create).toHaveBeenCalled();
    });

    it('rejects a LINE from another company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionLine.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ resourceType: 'LINE', productionLineId: 'foreign', effectiveFrom: '2026-01-01' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('does not leak an assignment from another company (404)', async () => {
      prisma.productionOperationalAssignment.findFirst.mockResolvedValue(null);

      await expect(service.findOne('oa1', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejects an overlapping assignment on update', async () => {
      prisma.productionOperationalAssignment.findFirst
        .mockResolvedValueOnce(assignment()) // findOwned
        .mockResolvedValueOnce(assignment({ id: 'oa2' })); // conflict
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });

      await expect(
        service.update('oa1', { capacityPerShift: 900 }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates the assignment and audits', async () => {
      prisma.productionOperationalAssignment.findFirst
        .mockResolvedValueOnce(assignment()) // findOwned
        .mockResolvedValueOnce(null); // no conflict
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.productionOperationalAssignment.update.mockImplementation(({ data }: any) => Promise.resolve(assignment(data)));

      const result = await service.update('oa1', { capacityPerShift: 900 }, 'u1', ctxA);
      expect(prisma.productionOperationalAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ capacityPerShift: 900 }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'UPDATE', 'ProductionOperationalAssignment', 'oa1', expect.anything());
      expect(result).toBeTruthy();
    });
  });

  describe('remove', () => {
    it('soft deletes and audits', async () => {
      prisma.productionOperationalAssignment.findFirst.mockResolvedValue(assignment());
      prisma.productionOperationalAssignment.update.mockResolvedValue(assignment());

      await service.remove('oa1', 'u1', ctxA);

      expect(prisma.productionOperationalAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'ProductionOperationalAssignment', 'oa1');
    });
  });

  describe('findCurrent', () => {
    it('resolves only active assignments valid on the reference date for a machine', async () => {
      prisma.productionOperationalAssignment.findMany.mockResolvedValue([assignment()]);

      const result = await service.findCurrent('MACHINE', { machineId: 'm1', on: '2026-03-01' }, ctxA);

      expect(prisma.productionOperationalAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resourceType: 'MACHINE',
            machineId: 'm1',
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
      prisma.productionOperationalAssignment.findMany.mockResolvedValue([]);

      const result = await service.findCurrent('LINE', { productionLineId: 'l1', on: '2026-03-01' }, ctxB);
      expect(prisma.productionOperationalAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c2', branchId: 'b2' }),
        }),
      );
      expect(result.count).toBe(0);
    });

    it('requires the resource id for the given type', async () => {
      await expect(service.findCurrent('MACHINE', { on: '2026-03-01' }, ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid resource type', async () => {
      await expect(service.findCurrent('ROBOT', { on: '2026-03-01' }, ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('scopes the list query to the tenant and excludes deleted assignments', async () => {
      prisma.productionOperationalAssignment.findMany.mockResolvedValue([assignment()]);
      prisma.productionOperationalAssignment.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);

      expect(prisma.productionOperationalAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(result.meta.total).toBe(1);
    });
  });
});
