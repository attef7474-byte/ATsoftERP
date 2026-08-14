import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryCountLinesService } from './inventory-count-lines.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'company-a:branch-a:-:-',
  scopeId: 'scope-a',
  companyId: 'company-a',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'branch-a',
  branchName: 'Branch A',
  branchCode: 'BA',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const countDocument = (overrides: Record<string, unknown> = {}) => ({
  id: 'count-a',
  companyId: 'company-a',
  branchId: 'branch-a',
  warehouseId: 'warehouse-a',
  status: 'DRAFT',
  deletedAt: null,
  ...overrides,
});

const countLine = (overrides: Record<string, unknown> = {}) => ({
  id: 'line-a',
  countId: 'count-a',
  productId: 'product-a',
  warehouseLocationId: null,
  systemQty: 10,
  countedQty: null,
  differenceQty: null,
  status: 'PENDING',
  deletedAt: null,
  count: countDocument(),
  ...overrides,
});

describe('InventoryCountLinesService tenant isolation', () => {
  let prisma: any;
  let audit: any;
  let service: InventoryCountLinesService;

  beforeEach(() => {
    prisma = {
      inventoryCount: { findFirst: jest.fn() },
      inventoryCountLine: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: { findFirst: jest.fn() },
      product: { findFirst: jest.fn() },
      inventoryBalance: { findFirst: jest.fn() },
      $transaction: jest.fn().mockImplementation(
        async (operation: (tx: any) => Promise<unknown>) =>
          operation(prisma),
      ),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new InventoryCountLinesService(
      prisma as PrismaService,
      audit as AuditService,
    );
  });

  it('rejects listing lines when the parent count is outside the active tenant', async () => {
    prisma.inventoryCount.findFirst.mockResolvedValue(null);

    await expect(
      service.findByCountId('count-b', ctx),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.inventoryCountLine.findMany).not.toHaveBeenCalled();
  });

  it('scopes line by-id through its parent count to prevent parent-child IDOR', async () => {
    prisma.inventoryCountLine.findFirst.mockResolvedValue(null);

    await expect(service.findOne('line-b', ctx)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.inventoryCountLine.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'line-b',
          deletedAt: null,
          count: expect.objectContaining({
            companyId: 'company-a',
            branchId: 'branch-a',
            deletedAt: null,
            warehouse: expect.objectContaining({
              companyId: 'company-a',
            }),
          }),
        },
      }),
    );
  });

  it('rejects adding a line with a location outside the count warehouse', async () => {
    prisma.inventoryCount.findFirst.mockResolvedValue(countDocument());
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'warehouse-a',
      companyId: 'company-a',
      branchId: 'branch-a',
    });
    prisma.warehouseLocation.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        'count-a',
        {
          productId: 'product-a',
          warehouseLocationId: 'location-b',
        },
        'user-a',
        ctx,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.inventoryCountLine.create).not.toHaveBeenCalled();
  });

  it('revalidates parent, warehouse, location, and product inside the transaction before creating', async () => {
    prisma.inventoryCount.findFirst.mockResolvedValue(countDocument());
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'warehouse-a',
      companyId: 'company-a',
      branchId: null,
    });
    prisma.warehouseLocation.findFirst.mockResolvedValue({
      id: 'location-a',
      warehouseId: 'warehouse-a',
      status: 'ACTIVE',
    });
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-a',
      deletedAt: null,
    });
    prisma.inventoryCountLine.findFirst.mockResolvedValue(null);
    prisma.inventoryBalance.findFirst.mockResolvedValue({ quantity: 9 });
    prisma.inventoryCountLine.create.mockResolvedValue(countLine());

    const result = await service.create(
      'count-a',
      {
        productId: 'product-a',
        warehouseLocationId: 'location-a',
      },
      'user-a',
      ctx,
    );

    expect(prisma.inventoryCount.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.warehouse.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.warehouseLocation.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.product.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.inventoryCountLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        countId: 'count-a',
        productId: 'product-a',
        warehouseLocationId: 'location-a',
        systemQty: 9,
      }),
    });
    expect(result.id).toBe('line-a');
  });

  it('prevents a TOCTOU parent-scope change from creating a line', async () => {
    prisma.inventoryCount.findFirst
      .mockResolvedValueOnce(countDocument())
      .mockResolvedValueOnce(null);
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'warehouse-a',
      companyId: 'company-a',
      branchId: 'branch-a',
    });
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-a',
      deletedAt: null,
    });

    await expect(
      service.create(
        'count-a',
        { productId: 'product-a' },
        'user-a',
        ctx,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.inventoryCountLine.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('does not count or verify a foreign by-id line', async () => {
    prisma.inventoryCountLine.findFirst.mockResolvedValue(null);

    await expect(
      service.countLine(
        'line-b',
        { countedQty: 8 },
        'user-a',
        ctx,
      ),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.verify('line-b', 'user-a', ctx),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.inventoryCountLine.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
