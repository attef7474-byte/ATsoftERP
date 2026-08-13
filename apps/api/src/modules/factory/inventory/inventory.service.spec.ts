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
});
