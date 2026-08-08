import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CostCentersService } from './cost-centers.service';
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

const ctxB: ActiveOperationalContext = {
  ...ctxA,
  contextKey: 'c2:b2:-:-',
  companyId: 'c2',
  companyName: 'Company B',
  branchId: 'b2',
  branchName: 'HQ2',
};

const costCenter = (overrides: Record<string, any> = {}) => ({
  id: 'cc1',
  code: 'CC1',
  name: 'Main',
  description: null,
  type: 'PRODUCTION',
  parentId: null,
  effectiveFrom: null,
  effectiveTo: null,
  isPrimary: false,
  companyId: 'c1',
  branchId: 'b1',
  administrationId: null,
  departmentId: null,
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const assignment = (overrides: Record<string, any> = {}) => ({
  id: 'a1',
  code: 'OCCA-000001',
  resourceType: 'MACHINE',
  costCenterId: 'cc1',
  machineId: 'm1',
  productionLineId: null,
  productionUnitId: null,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  effectiveTo: null,
  priority: 0,
  source: 'MANUAL',
  reason: null,
  companyId: 'c1',
  branchId: 'b1',
  status: 'DRAFT',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('CostCentersService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let resolver: any;
  let service: CostCentersService;

  beforeEach(() => {
    prisma = {
      costCenter: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      operationalCostCenterAssignment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      machine: { findUnique: jest.fn(), count: jest.fn() },
      productionLine: { findFirst: jest.fn(), count: jest.fn() },
      productionUnit: { findFirst: jest.fn() },
      maintenanceRequest: { count: jest.fn() },
      department: { findUnique: jest.fn() },
      administration: { findUnique: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('CC-000001') };
    resolver = { resolve: jest.fn() };
    service = new CostCentersService(prisma, audit, numbering, resolver);
  });

  const baseDto = { name: 'New Center', type: 'PRODUCTION' };

  describe('create (tenant scope)', () => {
    it('derives company/branch exclusively from the active context', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(null); // duplicate code check
      prisma.costCenter.create.mockImplementation(({ data }: any) => Promise.resolve(costCenter(data)));

      await service.create(baseDto, 'u1', ctxA);

      expect(prisma.costCenter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'ACTIVE' }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'CostCenter', 'cc1', expect.anything());
    });

    it('rejects a companyId that does not match the active context (403)', async () => {
      await expect(
        service.create({ ...baseDto, companyId: 'c2' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a branchId that does not match the active context (403)', async () => {
      await expect(
        service.create({ ...baseDto, branchId: 'b2' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('treats an explicit null branchId as a company-level record', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(null);
      prisma.costCenter.create.mockImplementation(({ data }: any) => Promise.resolve(costCenter(data)));

      await service.create({ ...baseDto, branchId: null }, 'u1', ctxA);

      expect(prisma.costCenter.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ branchId: null }) }),
      );
    });

    it('rejects a duplicate code within the company (409)', async () => {
      prisma.costCenter.findFirst.mockResolvedValue({ id: 'cc9' });

      await expect(service.create({ ...baseDto, code: 'CC1' }, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects effectiveTo before effectiveFrom', async () => {
      await expect(
        service.create({ ...baseDto, effectiveFrom: '2026-02-01', effectiveTo: '2026-01-01' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create (hierarchy validation)', () => {
    it('rejects a parent from another company (parent not found in tenant scope)', async () => {
      prisma.costCenter.findFirst.mockResolvedValueOnce(null); // duplicate code check
      prisma.costCenter.findFirst.mockResolvedValueOnce(null); // parent lookup -> not found

      await expect(
        service.create({ ...baseDto, parentId: 'foreign' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an INACTIVE parent', async () => {
      prisma.costCenter.findFirst.mockResolvedValueOnce(null); // duplicate code check
      prisma.costCenter.findFirst.mockResolvedValueOnce({ id: 'p1', status: 'INACTIVE', branchId: 'b1', parentId: null, companyId: 'c1' });

      await expect(
        service.create({ ...baseDto, parentId: 'p1' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a branch-level parent for a company-level child', async () => {
      prisma.costCenter.findFirst.mockResolvedValueOnce(null); // duplicate code check
      prisma.costCenter.findFirst.mockResolvedValueOnce({ id: 'p1', status: 'ACTIVE', branchId: 'b1', parentId: null, companyId: 'c1' });

      await expect(
        service.create({ ...baseDto, parentId: 'p1', branchId: null }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAll / findOne (tenant isolation)', () => {
    it('scopes the list to the active company and branch-or-company-level', async () => {
      prisma.costCenter.findMany.mockResolvedValue([costCenter()]);
      prisma.costCenter.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);

      expect(prisma.costCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'c1',
            deletedAt: null,
            OR: expect.arrayContaining([{ branchId: 'b1' }, { branchId: null }]),
          }),
        }),
      );
      expect(result.meta.total).toBe(1);
    });

    it('does not leak a cost center owned by another company (404)', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(null);

      await expect(service.findOne('cc1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.costCenter.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'cc1', companyId: 'c2' }) }),
      );
    });
  });

  describe('update', () => {
    it('rejects changing the code', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(costCenter());

      await expect(
        service.update('cc1', { code: 'CC2' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a reason when the parent changes', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(costCenter());

      await expect(
        service.update('cc1', { parentId: 'p1' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not update a cost center from another company (404)', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(null);

      await expect(service.update('cc1', { name: 'X' }, 'u1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects self-parent', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(costCenter());

      await expect(
        service.update('cc1', { parentId: 'cc1', reason: 'reorg' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a hierarchy cycle', async () => {
      prisma.costCenter.findFirst
        .mockResolvedValueOnce(costCenter()) // findOwned
        .mockResolvedValueOnce({ id: 'p1', status: 'ACTIVE', branchId: 'b1', parentId: 'cc1', companyId: 'c1' }); // parent lookup

      await expect(
        service.update('cc1', { parentId: 'p1', reason: 'reorg' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates non-sensitive fields without a reason', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(costCenter());
      prisma.costCenter.update.mockImplementation(({ data }: any) => Promise.resolve(costCenter({ ...data, name: 'Renamed' })));

      const result = await service.update('cc1', { name: 'Renamed' }, 'u1', ctxA);

      expect(prisma.costCenter.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Renamed' }) }),
      );
      expect(result).toBeTruthy();
    });

    it('allows moving a cost center to company-level with an explicit null branchId', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(costCenter());
      prisma.costCenter.update.mockImplementation(({ data }: any) => Promise.resolve(costCenter(data)));

      await service.update('cc1', { branchId: null }, 'u1', ctxA);

      expect(prisma.costCenter.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ branchId: null }) }),
      );
    });
  });

  describe('remove', () => {
    it('rejects deletion when machines are linked', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(costCenter());
      prisma.machine.count.mockResolvedValue(2);

      await expect(service.remove('cc1', 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('soft deletes when nothing references the cost center', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(costCenter());
      prisma.machine.count.mockResolvedValue(0);
      prisma.productionLine.count.mockResolvedValue(0);
      prisma.maintenanceRequest.count.mockResolvedValue(0);
      prisma.costCenter.count.mockResolvedValue(0); // children
      prisma.operationalCostCenterAssignment.count.mockResolvedValue(0);
      prisma.costCenter.update.mockResolvedValue(costCenter());

      await service.remove('cc1', 'u1', ctxA);

      expect(prisma.costCenter.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'CostCenter', 'cc1', expect.anything());
    });
  });

  describe('createAssignment', () => {
    const base = { resourceType: 'MACHINE', costCenterId: 'cc1', machineId: 'm1', effectiveFrom: '2026-01-01' };

    it('rejects a cost center outside the tenant context', async () => {
      prisma.costCenter.findFirst.mockResolvedValue(null); // cost center lookup scoped to tenant

      await expect(service.createAssignment(base, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a machine from another company', async () => {
      prisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1' });
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c2', branchId: 'b2' });

      await expect(service.createAssignment(base, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an equal-priority overlap on the same resource (409)', async () => {
      prisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1' });
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.operationalCostCenterAssignment.findUnique.mockResolvedValue(null); // code check
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue({ id: 'a9' }); // overlap

      await expect(service.createAssignment(base, 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a DRAFT assignment scoped to the active tenant', async () => {
      prisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1' });
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.operationalCostCenterAssignment.findUnique.mockResolvedValue(null);
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(null);
      prisma.operationalCostCenterAssignment.create.mockImplementation(({ data }: any) => Promise.resolve(assignment(data)));

      await service.createAssignment(base, 'u1', ctxA);

      expect(prisma.operationalCostCenterAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            branchId: 'b1',
            status: 'DRAFT',
            source: 'MANUAL',
            resourceType: 'MACHINE',
            machineId: 'm1',
          }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'OperationalCostCenterAssignment', 'a1', expect.anything());
    });

    it('creates a DRAFT UNIT assignment scoped to the active tenant', async () => {
      prisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1' });
      prisma.productionUnit.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.operationalCostCenterAssignment.findUnique.mockResolvedValue(null);
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(null);
      prisma.operationalCostCenterAssignment.create.mockImplementation(({ data }: any) => Promise.resolve(assignment(data)));

      await service.createAssignment(
        { resourceType: 'UNIT', costCenterId: 'cc1', productionUnitId: 'u1', effectiveFrom: '2026-01-01' },
        'u1',
        ctxA,
      );

      expect(prisma.productionUnit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'u1', companyId: 'c1', branchId: 'b1', deletedAt: null }) }),
      );
      expect(prisma.operationalCostCenterAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            branchId: 'b1',
            status: 'DRAFT',
            resourceType: 'UNIT',
            machineId: null,
            productionLineId: null,
            productionUnitId: 'u1',
          }),
        }),
      );
    });

    it('rejects a production unit from another company', async () => {
      prisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1' });
      prisma.productionUnit.findFirst.mockResolvedValue(null);

      await expect(
        service.createAssignment(
          { resourceType: 'UNIT', costCenterId: 'cc1', productionUnitId: 'u1', effectiveFrom: '2026-01-01' },
          'u1',
          ctxA,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAssignments / findAssignment (tenant isolation)', () => {
    it('scopes assignment list to the tenant and excludes deleted records', async () => {
      prisma.operationalCostCenterAssignment.findMany.mockResolvedValue([assignment()]);
      prisma.operationalCostCenterAssignment.count.mockResolvedValue(1);

      const result = await service.findAssignments({ page: 1, limit: 10 }, ctxA);

      expect(prisma.operationalCostCenterAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'c1',
            deletedAt: null,
            AND: [{ OR: expect.arrayContaining([{ branchId: 'b1' }, { branchId: null }]) }],
          }),
        }),
      );
      expect(result.meta.total).toBe(1);
    });

    it('does not leak an assignment owned by another company (404)', async () => {
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(null);

      await expect(service.findAssignment('a1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateAssignment', () => {
    it('rejects updates to an ENDED assignment', async () => {
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(assignment({ status: 'ENDED' }));

      await expect(
        service.updateAssignment('a1', { priority: 1 }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('forbids changing the resource scope of an ACTIVE assignment', async () => {
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(assignment({ status: 'ACTIVE' }));

      await expect(
        service.updateAssignment('a1', { machineId: 'm2' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a reason to override an ACTIVE assignment', async () => {
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(assignment({ status: 'ACTIVE' }));

      await expect(
        service.updateAssignment('a1', { costCenterId: 'cc2' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates a DRAFT assignment priority', async () => {
      prisma.operationalCostCenterAssignment.findFirst
        .mockResolvedValueOnce(assignment()) // findOwned
        .mockResolvedValue(null); // overlap -> none
      prisma.operationalCostCenterAssignment.update.mockImplementation(({ data }: any) => Promise.resolve(assignment(data)));

      const result = await service.updateAssignment('a1', { priority: 2 }, 'u1', ctxA);

      expect(prisma.operationalCostCenterAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ priority: 2 }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'UPDATE', 'OperationalCostCenterAssignment', 'a1', expect.anything());
      expect(result).toBeTruthy();
    });
  });

  describe('transitionAssignment', () => {
    it('requires a reason for every transition', async () => {
      await expect(
        service.transitionAssignment('a1', { toStatus: 'ACTIVE', reason: '' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects transitions of an ENDED assignment', async () => {
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(assignment({ status: 'ENDED' }));

      await expect(
        service.transitionAssignment('a1', { toStatus: 'ACTIVE', reason: 'reopen' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('activates a DRAFT assignment only when no overlap exists', async () => {
      prisma.operationalCostCenterAssignment.findFirst
        .mockResolvedValueOnce(assignment()) // findOwned
        .mockResolvedValue(null); // overlap -> none
      prisma.operationalCostCenterAssignment.update.mockImplementation(({ data }: any) => Promise.resolve(assignment({ ...data, status: 'ACTIVE' })));

      const result = await service.transitionAssignment('a1', { toStatus: 'ACTIVE', reason: 'starting' }, 'u1', ctxA);

      expect(prisma.operationalCostCenterAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE', reason: 'starting' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'TRANSITION', 'OperationalCostCenterAssignment', 'a1', expect.objectContaining({ to: 'ACTIVE' }));
      expect(result).toBeTruthy();
    });

    it('rejects activation when an equal-priority overlap exists (409)', async () => {
      prisma.operationalCostCenterAssignment.findFirst
        .mockResolvedValueOnce(assignment()) // findOwned
        .mockResolvedValueOnce({ id: 'a9' }); // overlap

      await expect(
        service.transitionAssignment('a1', { toStatus: 'ACTIVE', reason: 'starting' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects activating an ACTIVE assignment', async () => {
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(assignment({ status: 'ACTIVE' }));

      await expect(
        service.transitionAssignment('a1', { toStatus: 'ACTIVE', reason: 'again' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ends an ACTIVE assignment', async () => {
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(assignment({ status: 'ACTIVE' }));
      prisma.operationalCostCenterAssignment.update.mockImplementation(({ data }: any) => Promise.resolve(assignment({ ...data, status: 'ENDED' })));

      const result = await service.transitionAssignment('a1', { toStatus: 'ENDED', reason: 'superseded' }, 'u1', ctxA);

      expect(prisma.operationalCostCenterAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ENDED' }) }),
      );
      expect(result).toBeTruthy();
    });

    it('rejects ending a DRAFT assignment directly', async () => {
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(assignment());

      await expect(
        service.transitionAssignment('a1', { toStatus: 'ENDED', reason: 'never started' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('removeAssignment', () => {
    it('only DRAFT assignments can be deleted', async () => {
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(assignment({ status: 'ACTIVE' }));

      await expect(service.removeAssignment('a1', 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('soft deletes a DRAFT assignment', async () => {
      prisma.operationalCostCenterAssignment.findFirst.mockResolvedValue(assignment());
      prisma.operationalCostCenterAssignment.update.mockResolvedValue(assignment());

      await service.removeAssignment('a1', 'u1', ctxA);

      expect(prisma.operationalCostCenterAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'OperationalCostCenterAssignment', 'a1', expect.anything());
    });
  });

  describe('resolve', () => {
    it('delegates to the standalone resolver with the active context', async () => {
      const resolved = { costCenterId: 'cc1', costCenter: { id: 'cc1' }, matchedAssignment: {}, tenant: { companyId: 'c1', branchId: 'b1' }, hierarchyChain: [] };
      resolver.resolve.mockResolvedValue(resolved);

      const result = await service.resolve({ resourceType: 'MACHINE', machineId: 'm1' }, ctxA);

      expect(resolver.resolve).toHaveBeenCalledWith({ resourceType: 'MACHINE', machineId: 'm1' }, ctxA);
      expect(result).toBe(resolved);
    });
  });
});
