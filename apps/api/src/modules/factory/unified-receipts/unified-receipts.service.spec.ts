import { ForbiddenException } from '@nestjs/common';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InventoryOperationalReceiptsService } from '../inventory-operational-receipts/inventory-operational-receipts.service';
import { ProductionFinishedGoodsReceiptsService } from '../production-finished-goods-receipts/production-finished-goods-receipts.service';
import { UnifiedReceiptsService } from './unified-receipts.service';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1:-:-',
  scopeId: 's1',
  companyId: 'company-a',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'branch-a',
  branchName: 'Main',
  branchCode: 'MAIN',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const OP_READ = 'inventory:operational-receipt:read';
const FG_READ = 'production-finished-goods-receipt:read';

function roles(keys: string[], isSuperAdmin = false) {
  if (isSuperAdmin) {
    return [{ role: { status: 'ACTIVE', code: 'SUPER_ADMIN', permissions: [] } }];
  }
  return [{
    role: {
      status: 'ACTIVE',
      code: 'OPERATOR',
      permissions: keys.map((key) => ({ permission: { key, status: 'ACTIVE' } })),
    },
  }];
}

const operationalRow = (overrides: Record<string, any> = {}) => ({
  id: 'op-1',
  code: 'OR-000001',
  companyId: ctx.companyId,
  branchId: ctx.branchId,
  warehouseId: 'wh-1',
  locationId: null,
  status: 'POSTED',
  documentDate: new Date('2026-11-18T10:00:00Z'),
  reason: 'استلام مواد خام',
  notes: null,
  supplierName: null,
  supplierDoc: null,
  receiptType: 'RAW_MATERIAL',
  receiptSource: 'SUPPLIER',
  postedAt: new Date('2026-11-18T11:00:00Z'),
  cancelledAt: null,
  createdAt: new Date('2026-11-18T09:00:00Z'),
  warehouse: { id: 'wh-1', code: 'WH', name: 'Main' },
  location: null,
  _count: { lines: 2 },
  _sum: { quantity: 12 },
  ...overrides,
});

const finishedGoodsRow = (overrides: Record<string, any> = {}) => ({
  id: 'fg-1',
  companyId: ctx.companyId,
  branchId: ctx.branchId,
  receiptNumber: 'PFR-000001',
  productionOrderId: 'order-1',
  productionRunId: 'run-1',
  receiptWarehouseId: 'wh-fg',
  status: 'POSTED',
  sourceType: 'MANUAL',
  notes: null,
  receiptDate: new Date('2026-11-19T10:00:00Z'),
  postedAt: new Date('2026-11-19T11:00:00Z'),
  cancelledAt: null,
  createdAt: new Date('2026-11-19T09:00:00Z'),
  movementId: 'mov-1',
  movementNumber: 'IM-000001',
  receiptWarehouse: { id: 'wh-fg', code: 'FGWH', name: 'Finished Goods' },
  productionOrder: { id: 'order-1', orderNumber: 'PO-1' },
  productionRun: { id: 'run-1', runNumber: 'RUN-1' },
  lines: [{ id: 'fgl-1', quantity: 7 }],
  ...overrides,
});

describe('UnifiedReceiptsService', () => {
  let prisma: any;
  let operationalService: any;
  let finishedGoodsService: any;
  let service: UnifiedReceiptsService;

  beforeEach(() => {
    prisma = {
      userRole: { findMany: jest.fn() },
      inventoryOperationalReceipt: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      productionFinishedGoodsReceipt: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    operationalService = { findOne: jest.fn() };
    finishedGoodsService = { findOne: jest.fn() };
    service = new UnifiedReceiptsService(
      prisma as unknown as PrismaService,
      operationalService as unknown as InventoryOperationalReceiptsService,
      finishedGoodsService as unknown as ProductionFinishedGoodsReceiptsService,
    );
  });

  it('denies a user with neither native read permission', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([]));

    await expect(service.findAll({}, 'u1', ctx)).rejects.toThrow(ForbiddenException);
    expect(prisma.inventoryOperationalReceipt.findMany).not.toHaveBeenCalled();
    expect(prisma.productionFinishedGoodsReceipt.findMany).not.toHaveBeenCalled();
  });

  it('uses OR semantics so either native read key can open the page', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([OP_READ]));
    await service.capabilities('u1');

    prisma.userRole.findMany.mockResolvedValue(roles([FG_READ]));
    const capabilities = await service.capabilities('u1');

    expect(capabilities.canRead).toEqual({ operational: false, productionFinishedGoods: true });
    expect(capabilities.receiptTypes).toHaveLength(6);
  });

  it('returns only rows from the authority the actor may read', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([FG_READ]));
    prisma.productionFinishedGoodsReceipt.findMany.mockResolvedValue([finishedGoodsRow()]);
    prisma.productionFinishedGoodsReceipt.count.mockResolvedValue(1);

    const result = await service.findAll({}, 'u1', ctx);

    expect(prisma.inventoryOperationalReceipt.findMany).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      authority: 'PRODUCTION_FG',
      documentNumber: 'PFR-000001',
      receiptType: 'FINISHED_GOOD',
      receiptSource: null,
      sourceDetail: 'MANUAL',
      productionOrderNumber: 'PO-1',
    });
  });

  it('normalizes both authorities and scopes every query to the active tenant', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([OP_READ, FG_READ], true));
    prisma.inventoryOperationalReceipt.findMany.mockResolvedValue([operationalRow()]);
    prisma.inventoryOperationalReceipt.count.mockResolvedValue(1);
    prisma.productionFinishedGoodsReceipt.findMany.mockResolvedValue([finishedGoodsRow()]);
    prisma.productionFinishedGoodsReceipt.count.mockResolvedValue(1);

    const result = await service.findAll({}, 'u1', ctx);

    expect(prisma.inventoryOperationalReceipt.findMany.mock.calls[0][0].where).toMatchObject({
      companyId: 'company-a',
      branchId: 'branch-a',
      deletedAt: null,
    });
    expect(prisma.productionFinishedGoodsReceipt.findMany.mock.calls[0][0].where).toMatchObject({
      companyId: 'company-a',
      branchId: 'branch-a',
    });
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(result.data.map((row: any) => row.authority)).toEqual(['PRODUCTION_FG', 'OPERATIONAL']);
    expect(result.data[0].deepLink).toBe('/admin/production/finished-goods-receipts?receipt=fg-1');
    expect(result.data[1].deepLink).toBe('/admin/inventory/operational-receipts?receipt=op-1');
    expect(result.data[1]).toMatchObject({
      authority: 'OPERATIONAL',
      documentNumber: 'OR-000001',
      receiptType: 'RAW_MATERIAL',
      receiptSource: 'SUPPLIER',
      itemType: 'RAW_MATERIAL',
      lineCount: 2,
      totalQuantity: 12,
    });
  });

  it('paginates the merged union once, not once per authority', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([OP_READ, FG_READ]));
    prisma.inventoryOperationalReceipt.findMany.mockResolvedValue([
      operationalRow({ id: 'op-1', documentDate: new Date('2026-11-01T10:00:00Z') }),
      operationalRow({ id: 'op-2', documentDate: new Date('2026-11-03T10:00:00Z') }),
      operationalRow({ id: 'op-3', documentDate: new Date('2026-11-05T10:00:00Z') }),
    ]);
    prisma.inventoryOperationalReceipt.count.mockResolvedValue(3);
    prisma.productionFinishedGoodsReceipt.findMany.mockResolvedValue([
      finishedGoodsRow({ id: 'fg-1', receiptDate: new Date('2026-11-02T10:00:00Z') }),
      finishedGoodsRow({ id: 'fg-2', receiptDate: new Date('2026-11-04T10:00:00Z') }),
      finishedGoodsRow({ id: 'fg-3', receiptDate: new Date('2026-11-06T10:00:00Z') }),
    ]);
    prisma.productionFinishedGoodsReceipt.count.mockResolvedValue(3);

    const result = await service.findAll({ page: 2, limit: 2 }, 'u1', ctx);

    expect(prisma.inventoryOperationalReceipt.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 4 });
    expect(prisma.productionFinishedGoodsReceipt.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 4 });
    expect(result.meta).toEqual({ page: 2, limit: 2, total: 6, totalPages: 3 });
    expect(result.data.map((row: any) => row.id)).toEqual(['fg-2', 'op-2']);
  });

  it('narrows FINISHED_GOOD to the production authority only', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([OP_READ, FG_READ]));
    prisma.productionFinishedGoodsReceipt.findMany.mockResolvedValue([finishedGoodsRow()]);

    const result = await service.findAll({ receiptType: 'FINISHED_GOOD' }, 'u1', ctx);

    expect(prisma.inventoryOperationalReceipt.findMany).not.toHaveBeenCalled();
    expect(prisma.productionFinishedGoodsReceipt.findMany).toHaveBeenCalledTimes(1);
    expect(result.data).toHaveLength(1);
  });

  it('narrows non-FG receipt types to the operational authority only', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([OP_READ, FG_READ]));
    prisma.inventoryOperationalReceipt.findMany.mockResolvedValue([operationalRow()]);

    const result = await service.findAll({ receiptType: 'RAW_MATERIAL' }, 'u1', ctx);

    expect(prisma.productionFinishedGoodsReceipt.findMany).not.toHaveBeenCalled();
    expect(prisma.inventoryOperationalReceipt.findMany.mock.calls[0][0].where.receiptType).toBe('RAW_MATERIAL');
    expect(result.data).toHaveLength(1);
  });

  it('does not fabricate a source for production receipts when filtering by receipt source', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([OP_READ, FG_READ]));
    prisma.inventoryOperationalReceipt.findMany.mockResolvedValue([operationalRow()]);

    await service.findAll({ receiptSource: 'SUPPLIER' }, 'u1', ctx);

    expect(prisma.inventoryOperationalReceipt.findMany.mock.calls[0][0].where.receiptSource).toBe('SUPPLIER');
    expect(prisma.productionFinishedGoodsReceipt.findMany).not.toHaveBeenCalled();
  });

  it('applies production-only filters without querying the operational authority', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([OP_READ, FG_READ]));

    await service.findAll({ productionRunId: 'run-1' }, 'u1', ctx);

    expect(prisma.inventoryOperationalReceipt.findMany).not.toHaveBeenCalled();
    expect(prisma.productionFinishedGoodsReceipt.findMany.mock.calls[0][0].where.productionRunId).toBe('run-1');
  });

  it('denies detail reads for an authority the actor cannot read', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([FG_READ]));

    await expect(service.findOne('OPERATIONAL', 'op-1', 'u1', ctx)).rejects.toThrow(ForbiddenException);
    expect(operationalService.findOne).not.toHaveBeenCalled();
  });

  it('returns normalized detail lines from the native operational authority', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([OP_READ]));
    operationalService.findOne.mockResolvedValue({
      ...operationalRow(),
      lines: [{ id: 'opl-1', productId: 'prd-1', quantity: 12, notes: null, product: { code: 'RM-1', name: 'Raw' } }],
    });

    const detail = await service.findOne('OPERATIONAL', 'op-1', 'u1', ctx);

    expect(operationalService.findOne).toHaveBeenCalledWith('op-1', ctx);
    expect(detail.lines[0]).toMatchObject({
      productCode: 'RM-1',
      productName: 'Raw',
      quantity: 12,
      unit: null,
      batchNumber: null,
      serialNumber: null,
    });
  });

  it('returns normalized detail lines and UOM/batch metadata from the FG authority', async () => {
    prisma.userRole.findMany.mockResolvedValue(roles([FG_READ]));
    finishedGoodsService.findOne.mockResolvedValue({
      ...finishedGoodsRow(),
      lines: [{
        id: 'fgl-1',
        productId: 'prd-fg',
        productCodeSnapshot: 'FG-1',
        productNameSnapshot: 'Finished',
        unit: 'PCS',
        quantity: 7,
        batchNumber: 'B-1',
        serialNumber: null,
        expiryDate: null,
        notes: null,
      }],
    });

    const detail = await service.findOne('PRODUCTION_FG', 'fg-1', 'u1', ctx);

    expect(finishedGoodsService.findOne).toHaveBeenCalledWith('fg-1', ctx);
    expect(detail.lines[0]).toMatchObject({
      productCode: 'FG-1',
      productName: 'Finished',
      unit: 'PCS',
      batchNumber: 'B-1',
    });
  });
});
