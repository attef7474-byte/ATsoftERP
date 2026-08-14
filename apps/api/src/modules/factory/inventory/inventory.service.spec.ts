import { ForbiddenException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
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

describe('InventoryService updateLocation tenant isolation', () => {
  let prisma: any;
  let numbering: any;
  let service: InventoryService;

  beforeEach(() => {
    prisma = {
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      inventoryBalance: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('LOC-0001') };
    service = new InventoryService(prisma as unknown as PrismaService, numbering as unknown as NumberingService);
  });

  it('rejects re-pointing a location to a foreign-company warehouse', async () => {
    prisma.warehouseLocation.findUnique.mockResolvedValue({
      id: 'loc1',
      warehouseId: 'w1',
      code: 'L1',
      name: 'Loc 1',
      status: 'ACTIVE',
    });
    prisma.warehouse.findUnique
      .mockResolvedValueOnce({ id: 'w1', companyId: 'c1', branchId: 'b1' })
      .mockResolvedValueOnce({ id: 'w-foreign', companyId: 'c2', branchId: 'b9' });

    await expect(
      service.updateLocation('loc1', { warehouseId: 'w-foreign' } as any, ctx),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.warehouseLocation.update).not.toHaveBeenCalled();
  });

  it('allows re-pointing to a same-company warehouse', async () => {
    prisma.warehouseLocation.findUnique.mockResolvedValue({
      id: 'loc1',
      warehouseId: 'w1',
      code: 'L1',
      name: 'Loc 1',
      status: 'ACTIVE',
    });
    prisma.warehouse.findUnique
      .mockResolvedValueOnce({ id: 'w1', companyId: 'c1', branchId: 'b1' })
      .mockResolvedValueOnce({ id: 'w2', companyId: 'c1', branchId: 'b1' });
    prisma.warehouseLocation.update.mockResolvedValue({ id: 'loc1', warehouseId: 'w2' });

    const result = await service.updateLocation('loc1', { warehouseId: 'w2' } as any, ctx);
    expect(result.warehouseId).toBe('w2');
  });

  it('scopes the warehouse list to the active company and branch, ignoring client companyId', async () => {
    prisma.warehouse.findMany = jest.fn().mockResolvedValue([]);
    prisma.warehouse.count = jest.fn().mockResolvedValue(0);

    await service.findAllWarehouses({ companyId: 'c2', search: 'saw', warehouseType: 'SPARE_PARTS' } as any, ctx);

    expect(prisma.warehouse.findMany).toHaveBeenCalledTimes(1);
    const where = prisma.warehouse.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      deletedAt: null,
      companyId: 'c1',
      OR: [{ branchId: 'b1' }, { branchId: null }],
      name: { contains: 'saw' },
      warehouseType: 'SPARE_PARTS',
    });
    expect(where.companyId).not.toBe('c2');
  });

  it('scopes the location list to active-company warehouses', async () => {
    prisma.warehouseLocation.findMany = jest.fn().mockResolvedValue([]);
    prisma.warehouseLocation.count = jest.fn().mockResolvedValue(0);

    await service.findAllLocations({} as any, ctx);

    expect(prisma.warehouseLocation.findMany).toHaveBeenCalledTimes(1);
    const where = prisma.warehouseLocation.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      warehouse: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
    });
  });

  it('rejects a location list scoped to a foreign-company warehouse', async () => {
    prisma.warehouse.findUnique.mockResolvedValue({ id: 'w-foreign', companyId: 'c2', branchId: 'b9' });

    await expect(
      service.findAllLocations({ warehouseId: 'w-foreign' } as any, ctx),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.warehouseLocation.findMany).not.toHaveBeenCalled();
  });
});
