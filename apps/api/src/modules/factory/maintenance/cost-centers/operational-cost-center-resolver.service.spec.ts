import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OperationalCostCenterResolver } from './operational-cost-center-resolver.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

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

const assignment = (overrides: Record<string, any> = {}) => ({
  id: 'a1',
  code: 'OCCA-000001',
  resourceType: 'MACHINE',
  machineId: 'm1',
  productionLineId: null,
  productionUnitId: null,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  effectiveTo: null,
  priority: 0,
  source: 'MANUAL',
  isPrimary: false,
  branchId: 'b1',
  costCenter: { id: 'cc1', code: 'CC1', name: 'Main', companyId: 'c1', branchId: 'b1', parentId: null, isPrimary: false },
  ...overrides,
});

describe('OperationalCostCenterResolver', () => {
  let prisma: any;
  let resolver: OperationalCostCenterResolver;

  beforeEach(() => {
    prisma = {
      machine: { findFirst: jest.fn() },
      productionLine: { findFirst: jest.fn() },
      productionUnit: { findFirst: jest.fn() },
      operationalCostCenterAssignment: { findMany: jest.fn() },
      costCenter: { findFirst: jest.fn() },
    };
    resolver = new OperationalCostCenterResolver(prisma);
    prisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1', code: 'CC1', name: 'Main', parentId: null });
  });

  describe('resource chain construction', () => {
    it('rejects conflicting resource ids (machine + line)', async () => {
      await expect(
        resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', productionLineId: 'l1' }, ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown resource type', async () => {
      await expect(resolver.resolve({ resourceType: 'ROBOT' }, ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid reference date', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: null });
      await expect(
        resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: 'not-a-date' }, ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not resolve a machine from another company (404, never 200)', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c2', branchId: 'b2', productionLineId: null });
      await expect(
        resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1' }, ctxA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not resolve a machine with a null companyId (tenant-external, 404)', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: null, branchId: null, productionLineId: null });
      await expect(
        resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1' }, ctxA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scopes the machine lookup to the active tenant', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: null });
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([]);
      await expect(resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1' }, ctxA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.machine.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'm1', companyId: 'c1', deletedAt: null }) }),
      );
    });

    it('does not resolve a machine from another branch', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b9', productionLineId: null });
      await expect(
        resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1' }, ctxA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not resolve a production line from another company', async () => {
      prisma.productionLine.findFirst.mockResolvedValue(null);
      await expect(
        resolver.resolve({ resourceType: 'LINE', productionLineId: 'l1' }, ctxA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not resolve a production unit from another company', async () => {
      prisma.productionUnit.findFirst.mockResolvedValue(null);
      await expect(
        resolver.resolve({ resourceType: 'UNIT', productionUnitId: 'u1' }, ctxA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resolution', () => {
    it('resolves a machine at the MACHINE tier scoped to the tenant and reference date', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: null });
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([assignment()]);

      const result = await resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2026-03-01' }, ctxA);

      expect(prisma.operationalCostCenterAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resourceType: 'MACHINE',
            machineId: 'm1',
            companyId: 'c1',
            status: 'ACTIVE',
            deletedAt: null,
            effectiveFrom: { lte: new Date('2026-03-01') },
          }),
        }),
      );
      expect(result.costCenterId).toBe('cc1');
      expect(result.matchedAssignment.resourceType).toBe('MACHINE');
    });

    it('falls back from a machine to its production line when no MACHINE assignment qualifies', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: 'l1' });
      prisma.operationalCostCenterAssignment.findMany
        .mockResolvedValueOnce([]) // MACHINE tier: no match
        .mockResolvedValueOnce([assignment({ resourceType: 'LINE', productionLineId: 'l1' })]); // LINE tier: match

      const result = await resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2026-03-01' }, ctxA);

      expect(result.matchedAssignment.resourceType).toBe('LINE');
      expect(result.matchedAssignment.resourceId).toBe('l1');
      expect(prisma.operationalCostCenterAssignment.findMany).toHaveBeenCalledTimes(2);
    });

    it('returns 404 when no tier has a qualifying assignment', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: 'l1' });
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([]);

      await expect(
        resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2026-03-01' }, ctxA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves only assignments whose effective range contains a past reference date', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: null });
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([
        assignment({ effectiveFrom: new Date('2025-01-01T00:00:00.000Z'), effectiveTo: new Date('2025-12-31T00:00:00.000Z') }),
      ]);

      const result = await resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2025-06-01' }, ctxA);

      expect(prisma.operationalCostCenterAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effectiveFrom: { lte: new Date('2025-06-01') },
            AND: expect.arrayContaining([
              { OR: expect.arrayContaining([{ effectiveTo: null }, { effectiveTo: { gte: new Date('2025-06-01') } }]) },
            ]),
          }),
        }),
      );
      expect(result.costCenterId).toBe('cc1');
    });

    it('excludes assignments that have ended before the reference date', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: null });
      // The DB applies the effectiveTo bound; the resolver passes it and relies on the filter.
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([]);

      await expect(
        resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2026-06-01' }, ctxA),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.operationalCostCenterAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effectiveFrom: { lte: new Date('2026-06-01') },
            AND: expect.arrayContaining([
              { OR: expect.arrayContaining([{ effectiveTo: null }, { effectiveTo: { gte: new Date('2026-06-01') } }]) },
            ]),
          }),
        }),
      );
    });

    it('resolves a future reference date inside an open-ended effective range', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: null });
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([assignment()]);

      const result = await resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2030-01-01' }, ctxA);

      expect(result.costCenterId).toBe('cc1');
    });

    it('raises an explicit ambiguity (409) when two ACTIVE assignments have equal priority at the reference date', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: null });
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([
        assignment(),
        assignment({ id: 'a2', code: 'OCCA-000002', costCenter: { id: 'cc2', code: 'CC2', name: 'Alt', companyId: 'c1', branchId: 'b1', parentId: null, isPrimary: false } }),
      ]);

      await expect(
        resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2026-03-01' }, ctxA),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('picks the lowest priority (highest precedence) assignment', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: null });
      // The resolver trusts database ordering (orderBy priority asc); the mock
      // returns candidates in the same order the resolver relies on.
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([
        assignment({ id: 'a2', priority: 1, costCenter: { id: 'cc2', code: 'CC2', name: 'High', companyId: 'c1', branchId: 'b1', parentId: null, isPrimary: false } }),
        assignment({ id: 'a1', priority: 5, costCenter: { id: 'cc1', code: 'CC1', name: 'Low', companyId: 'c1', branchId: 'b1', parentId: null, isPrimary: false } }),
      ]);

      const result = await resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2026-03-01' }, ctxA);

      expect(prisma.operationalCostCenterAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ priority: 'asc' }, { effectiveFrom: 'asc' }, { createdAt: 'asc' }] }),
      );
      expect(result.matchedAssignment.id).toBe('a2');
      expect(result.costCenterId).toBe('cc2');
    });

    it('returns 404 when the resolved cost center belongs to another company', async () => {
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: null });
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([
        assignment({ costCenter: { id: 'cc9', code: 'CC9', name: 'Foreign', companyId: 'c2', branchId: 'b2', parentId: null, isPrimary: false } }),
      ]);

      await expect(
        resolver.resolve({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2026-03-01' }, ctxA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves a UNIT tier assignment', async () => {
      prisma.productionUnit.findFirst.mockResolvedValue({ id: 'u1', companyId: 'c1', branchId: 'b1' });
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([
        assignment({ resourceType: 'UNIT', machineId: null, productionUnitId: 'u1' }),
      ]);

      const result = await resolver.resolve({ resourceType: 'UNIT', productionUnitId: 'u1', referenceDate: '2026-03-01' }, ctxA);

      expect(result.matchedAssignment.resourceType).toBe('UNIT');
      expect(result.matchedAssignment.resourceId).toBe('u1');
    });
  });
});
