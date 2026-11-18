import { BadRequestException } from '@nestjs/common';
import { MaintenanceSparePartRequestLinesService } from './maintenance-spare-part-request-lines.service';
const ctx: any = {
  companyId: 'a',
  branchId: 'a1'
};
function fixture() {
  const prisma: any = {
    maintenanceRequest: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'request-a'
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'request-a',
        status: 'OPEN',
        machineId: 'machine-a',
        machine: {
          companyId: 'a',
          branchId: 'a1'
        }
      })
    },
    sparePart: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'spare-a'
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'spare-a',
        status: 'ACTIVE',
        productId: 'product-a'
      })
    },
    warehouse: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'warehouse-a',
        warehouseType: 'SPARE_PART'
      })
    },
    inventoryBalance: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'balance-a'
      }),
      // Present so the zero-stock test can prove no direct balance write occurs.
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn()
    },
    maintenanceRequestRequiredPart: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'line-a',
        status: 'DRAFT'
      })
    }
  };
  prisma.$transaction = jest.fn(callback => callback(prisma));
  const audit: any = {
    log: jest.fn(),
    logWithClient: jest.fn()
  };
  const service = new MaintenanceSparePartRequestLinesService(prisma, audit, {} as any);
  const dto = {
    sparePartId: 'spare-a',
    warehouseId: 'warehouse-a',
    quantity: 2,
    unit: 'PC'
  };
  return {
    prisma,
    audit,
    service,
    dto
  };
}
describe('spare-part issue voucher native persistence', () => {
  it('saves the selected warehouse on the native DRAFT line and audits in the transaction', async () => {
    const {
      prisma,
      service,
      dto,
      audit
    } = fixture();
    await service.create('request-a', dto, 'operator', ctx);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.maintenanceRequestRequiredPart.create.mock.calls[0][0].data).toMatchObject({
      maintenanceRequestId: 'request-a',
      warehouseId: 'warehouse-a',
      sparePartId: 'spare-a',
      status: 'DRAFT'
    });
    expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({
      entity: 'MaintenanceRequestRequiredPart',
      details: expect.objectContaining({
        companyId: 'a',
        branchId: 'a1',
        warehouseId: 'warehouse-a'
      })
    }));
    expect(prisma.warehouse.findFirst).toHaveBeenCalledTimes(2);
  });
  it('allows a spare part with no balance row in a DRAFT while scoping stock lookup to the selected warehouse', async () => {
    const {
      prisma,
      service,
      dto
    } = fixture();
    prisma.inventoryBalance.findFirst.mockResolvedValue(null);

    const result = await service.create('request-a', dto, 'operator', ctx);

    expect(result).toMatchObject({ id: 'line-a', status: 'DRAFT' });
    // The service validates once before and once inside the transaction; both
    // stock lookups must remain scoped to the selected warehouse and tenant.
    expect(prisma.inventoryBalance.findFirst).toHaveBeenCalledTimes(2);
    for (const [args] of prisma.inventoryBalance.findFirst.mock.calls) {
      expect(args.where).toMatchObject({
        warehouseId: 'warehouse-a',
        productId: 'product-a',
        warehouse: {
          companyId: 'a',
          OR: [{ branchId: 'a1' }, { branchId: null }]
        }
      });
    }
    expect(prisma.maintenanceRequestRequiredPart.create).toHaveBeenCalled();
    expect(prisma.inventoryBalance.create).not.toHaveBeenCalled();
    expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    expect(prisma.inventoryBalance.upsert).not.toHaveBeenCalled();
    expect(prisma.inventoryBalance.deleteMany).not.toHaveBeenCalled();
  });
  it('rejects a finished-good product ID passed to the spare-part endpoint', async () => {
    const {
      prisma,
      service,
      dto
    } = fixture();
    prisma.sparePart.findUnique.mockResolvedValue(null);
    await expect(service.create('request-a', {
      ...dto,
      sparePartId: 'finished-product-id'
    }, 'operator', ctx)).rejects.toThrow();
    expect(prisma.maintenanceRequestRequiredPart.create).not.toHaveBeenCalled();
  });
  it('rejects a warehouse from another company/branch', async () => {
    const {
      prisma,
      service,
      dto
    } = fixture();
    prisma.warehouse.findFirst.mockResolvedValue(null);
    await expect(service.create('request-a', dto, 'operator', ctx)).rejects.toThrow(BadRequestException);
    expect(prisma.warehouse.findFirst.mock.calls[0][0].where).toMatchObject({
      companyId: 'a',
      OR: [{
        branchId: 'a1'
      }, {
        branchId: null
      }]
    });
  });
});
