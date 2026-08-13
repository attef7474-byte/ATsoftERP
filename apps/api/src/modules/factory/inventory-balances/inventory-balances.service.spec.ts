import { InventoryBalancesService } from './inventory-balances.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
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

describe('InventoryBalancesService recalculate tenant scoping', () => {
  let prisma: any;
  let audit: any;
  let service: InventoryBalancesService;

  beforeEach(() => {
    prisma = {
      inventoryBalance: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      inventoryMovement: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn(), aggregate: jest.fn() },
      inventoryMovementLine: { aggregate: jest.fn() },
      inventoryAdjustment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn() },
      inventoryAdjustmentLine: { aggregate: jest.fn() },
      inventoryCount: { count: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new InventoryBalancesService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  });

  it('scopes recalculate deleteMany to company + branch via warehouse relation', async () => {
    prisma.inventoryBalance.deleteMany.mockResolvedValue({ count: 5 });
    prisma.inventoryMovement.findMany.mockResolvedValue([]);
    prisma.inventoryAdjustment.findMany.mockResolvedValue([]);

    await service.recalculate('u1', ctx);

    const deleteWhere = prisma.inventoryBalance.deleteMany.mock.calls[0][0].where;
    expect(deleteWhere.warehouse.companyId).toBe('c1');
    expect(deleteWhere.warehouse.branchId).toBe('b1');
  });

  it('scopes movement and adjustment rebuild queries by warehouse relation of the same tenant', async () => {
    prisma.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 'mov1',
        warehouseId: 'w1',
        companyId: 'c1',
        lines: [
          { productId: 'prd1', warehouseLocationId: null, quantity: 5, direction: 'IN' },
        ],
      },
    ]);
    prisma.inventoryAdjustment.findMany.mockResolvedValue([
      {
        id: 'a1',
        warehouseId: 'w1',
        companyId: 'c1',
        lines: [
          { productId: 'prd1', warehouseLocationId: null, differenceQty: -2 },
        ],
      },
    ]);
    prisma.inventoryBalance.findFirst.mockResolvedValue(null);
    prisma.inventoryBalance.create.mockResolvedValue({});

    await service.recalculate('u1', ctx);

    const movWhere = prisma.inventoryMovement.findMany.mock.calls[0][0].where;
    expect(movWhere.companyId).toBe('c1');
    expect(movWhere.warehouse.companyId).toBe('c1');
    expect(movWhere.warehouse.branchId).toBe('b1');

    const adjWhere = prisma.inventoryAdjustment.findMany.mock.calls[0][0].where;
    expect(adjWhere.companyId).toBe('c1');
    expect(adjWhere.warehouse.companyId).toBe('c1');
    expect(adjWhere.warehouse.branchId).toBe('b1');
  });

  it('rebuilds balance from movement + adjustment deltas in the tenant warehouse', async () => {
    prisma.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 'mov1',
        warehouseId: 'w1',
        companyId: 'c1',
        lines: [
          { productId: 'prd1', warehouseLocationId: null, quantity: 5, direction: 'IN' },
        ],
      },
    ]);
    prisma.inventoryAdjustment.findMany.mockResolvedValue([
      {
        id: 'a1',
        warehouseId: 'w1',
        companyId: 'c1',
        lines: [
          { productId: 'prd1', warehouseLocationId: null, differenceQty: -2 },
        ],
      },
    ]);
    prisma.inventoryBalance.findFirst
      .mockResolvedValueOnce({ id: 'bal1', quantity: 0 })
      .mockResolvedValueOnce({ id: 'bal1', quantity: 5 });

    await service.recalculate('u1', ctx);

    const updateCall = prisma.inventoryBalance.update.mock.calls[1][0];
    expect(updateCall.data.quantity).toBe(3);
  });
});
