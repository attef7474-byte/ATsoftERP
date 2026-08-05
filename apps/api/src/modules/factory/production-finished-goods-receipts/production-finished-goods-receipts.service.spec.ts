import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductionFinishedGoodsReceiptsService } from './production-finished-goods-receipts.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const run = (overrides: Record<string, any> = {}) => ({
  id: 'run1',
  companyId: 'c1',
  branchId: 'b1',
  productionOrderId: 'po1',
  productionLineId: 'l1',
  machineId: 'm1',
  productionProductDefinitionId: 'def1',
  status: 'RUNNING',
  startedAt: new Date('2026-03-01T08:00:00Z'),
  ...overrides,
});

const order = (overrides: Record<string, any> = {}) => ({
  id: 'po1',
  companyId: 'c1',
  branchId: 'b1',
  orderNumber: 'PO-000001',
  receiptWarehouseId: 'wh1',
  status: 'RELEASED',
  ...overrides,
});

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'wh1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'WH1',
  name: 'FG Store',
  ...overrides,
});

const product = (overrides: Record<string, any> = {}) => ({
  id: 'prod1',
  companyId: 'c1',
  code: 'FG1',
  name: 'Finished Good',
  ...overrides,
});

const receipt = (overrides: Record<string, any> = {}) => ({
  id: 'rct1',
  companyId: 'c1',
  branchId: 'b1',
  receiptNumber: 'PFR-000001',
  productionOrderId: 'po1',
  productionRunId: 'run1',
  receiptWarehouseId: 'wh1',
  status: 'DRAFT',
  movementId: 'mov1',
  movementNumber: 'IM-000001',
  sourceType: 'MANUAL',
  requestId: 'req-rct-1',
  notes: null,
  receiptDate: new Date('2026-03-01T10:00:00Z'),
  postedAt: null,
  cancelledAt: null,
  createdById: 'u1',
  postedById: null,
  cancelledById: null,
  lines: [{ id: 'line1', productId: 'prod1', quantity: 10, unit: 'PC', substitutedProductId: null }],
  ...overrides,
});

const baseDto = (overrides: Record<string, any> = {}) => ({
  productionOrderId: 'po1',
  productionRunId: 'run1',
  receiptWarehouseId: 'wh1',
  requestId: 'req-rct-1',
  lines: [{ productId: 'prod1', quantity: 10, unit: 'PC' }],
  ...overrides,
});

function makeService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    productionFinishedGoodsReceipt: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    productionFinishedGoodsReceiptLine: { deleteMany: jest.fn(), createMany: jest.fn() },
    inventoryMovement: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    inventoryMovementLine: { deleteMany: jest.fn(), createMany: jest.fn() },
    productionRun: { findFirst: jest.fn() },
    productionOrder: { findFirst: jest.fn() },
    productionProductDefinition: { findFirst: jest.fn() },
    productionOutputEvent: { findMany: jest.fn() },
    warehouse: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
    warehouseLocation: { findUnique: jest.fn() },
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  const audit: any = { log: jest.fn(), logWithClient: jest.fn() };
  const numbering: any = {
    generateNumberAtomicWithClient: jest.fn().mockResolvedValue('SEQ-000001'),
  };
  const movements: any = { postMovementWithinTransaction: jest.fn().mockResolvedValue({}) };
  const service = new ProductionFinishedGoodsReceiptsService(prisma, audit, numbering, movements);
  return { prisma, audit, numbering, movements, service };
}

describe('ProductionFinishedGoodsReceiptsService', () => {
  describe('findOne (tenant isolation)', () => {
    it('rejects access from another company or branch', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(null);
      await expect(service.findOne('rct1', ctxB)).rejects.toThrow(NotFoundException);
      expect(prisma.productionFinishedGoodsReceipt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rct1', companyId: 'c2', branchId: 'b2' } }),
      );
    });

    it('returns the receipt for the owning context', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(receipt());
      await expect(service.findOne('rct1', ctxA)).resolves.toMatchObject({ id: 'rct1' });
    });
  });

  describe('create', () => {
    it('returns the existing receipt when the requestId already produced one (idempotency)', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValueOnce(receipt());
      const result = await service.create(baseDto(), 'u1', ctxA);
      expect(result.id).toBe('rct1');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a DRAFT receipt with a linked DRAFT IN movement and uses the order default warehouse when none is sent', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ id: 'def1', productId: 'prod1' });
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', movementNumber: 'IM-000001' });
      prisma.productionFinishedGoodsReceipt.create.mockResolvedValue(receipt());
      prisma.productionFinishedGoodsReceipt.update.mockResolvedValue(receipt());

      const result = await service.create(baseDto({ receiptWarehouseId: undefined }), 'u1', ctxA);

      expect(result.id).toBe('rct1');
      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData.warehouseId).toBe('wh1');
      expect(movementData.movementType).toBe('PRODUCTION_FG_RECEIPT');
      expect(movementData.status).toBe('DRAFT');
      expect(movementData.sourceType).toBe('PRODUCTION_FINISHED_GOODS_RECEIPT');
      expect(movementData.lines.create[0].direction).toBe('IN');
      expect(movementData.lines.create[0].quantityBase).toBe(10);
    });

    it('rejects a warehouse from another company', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue({ ...warehouse(), companyId: 'c9' });
      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('rejects a run/order context mismatch', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order({ id: 'po-other' }));
      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('rejects a line whose product is not the run final output product', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ id: 'def1', productId: 'prod-other' });
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('rejects a line whose product is not the run final output product', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(receipt());
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ id: 'def1', productId: 'prod-other' });
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      await expect(
        service.update('rct1', { lines: [{ productId: 'prod1', quantity: 8, unit: 'PC' }] }, 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('replaces the DRAFT receipt and movement lines and audits the change', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(receipt());
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ id: 'def1', productId: 'prod1' });
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionFinishedGoodsReceiptLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.productionFinishedGoodsReceiptLine.createMany.mockResolvedValue({ count: 1 });
      prisma.inventoryMovementLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.inventoryMovementLine.createMany.mockResolvedValue({ count: 1 });
      prisma.productionFinishedGoodsReceipt.update.mockResolvedValue(receipt({ notes: 'updated' }));

      const result = await service.update('rct1', { notes: 'updated', lines: [{ productId: 'prod1', quantity: 8, unit: 'PC' }] }, 'u1', ctxA);

      expect(result.notes).toBe('updated');
      expect(prisma.productionFinishedGoodsReceiptLine.deleteMany).toHaveBeenCalledWith({ where: { receiptId: 'rct1' } });
      expect(prisma.inventoryMovementLine.createMany).toHaveBeenCalled();
    });
  });

  describe('post', () => {
    it('posts through the shared movement transaction and marks the receipt POSTED', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(receipt());
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOutputEvent.findMany.mockResolvedValue([
        {
          id: 'ev1',
          eventType: 'PRODUCTION',
          classification: 'FINAL_OUTPUT',
          quantity: new Prisma.Decimal(10),
          goodQuantity: new Prisma.Decimal(10),
          rejectQuantity: new Prisma.Decimal(0),
          correctsEventId: null,
          measurementPointId: 'mp1',
          measurementPoint: { isAuthoritativeFinal: true },
        },
      ]);
      prisma.productionFinishedGoodsReceipt.findMany.mockResolvedValue([]);
      prisma.productionFinishedGoodsReceipt.update.mockResolvedValue(receipt({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('rct1', 'u1', ctxA);

      expect(movements.postMovementWithinTransaction).toHaveBeenCalledWith(prisma, 'mov1', 'u1', ctxA);
      expect(prisma.productionFinishedGoodsReceipt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'POSTED', postedById: 'u1' }) }),
      );
      expect(result.status).toBe('POSTED');
    });

    it('rejects posting when the received quantity exceeds the run eligible output', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(receipt({ lines: [{ id: 'line1', productId: 'prod1', quantity: 10, unit: 'PC' }] }));
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOutputEvent.findMany.mockResolvedValue([
        {
          id: 'ev1',
          eventType: 'PRODUCTION',
          classification: 'FINAL_OUTPUT',
          quantity: new Prisma.Decimal(5),
          goodQuantity: new Prisma.Decimal(5),
          rejectQuantity: new Prisma.Decimal(0),
          correctsEventId: null,
          measurementPointId: 'mp1',
          measurementPoint: { isAuthoritativeFinal: true },
        },
      ]);
      prisma.productionFinishedGoodsReceipt.findMany.mockResolvedValue([]);

      await expect(service.post('rct1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('allows posting when the receipt fits within the remaining eligible output', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(receipt({ lines: [{ id: 'line1', productId: 'prod1', quantity: 10, unit: 'PC' }] }));
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOutputEvent.findMany.mockResolvedValue([
        {
          id: 'ev1',
          eventType: 'PRODUCTION',
          classification: 'FINAL_OUTPUT',
          quantity: new Prisma.Decimal(15),
          goodQuantity: new Prisma.Decimal(15),
          rejectQuantity: new Prisma.Decimal(0),
          correctsEventId: null,
          measurementPointId: 'mp1',
          measurementPoint: { isAuthoritativeFinal: true },
        },
      ]);
      prisma.productionFinishedGoodsReceipt.findMany.mockResolvedValue([
        { lines: [{ productId: 'prod1', quantity: 5 }] },
      ]);
      prisma.productionFinishedGoodsReceipt.update.mockResolvedValue(receipt({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('rct1', 'u1', ctxA);

      expect(result.status).toBe('POSTED');
      expect(movements.postMovementWithinTransaction).toHaveBeenCalledWith(prisma, 'mov1', 'u1', ctxA);
    });

    it('skips the output eligibility check for reversal receipts', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(receipt({ sourceType: 'REVERSE' }));
      prisma.productionFinishedGoodsReceipt.update.mockResolvedValue(receipt({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('rct1', 'u1', ctxA);

      expect(result.status).toBe('POSTED');
      expect(prisma.productionOutputEvent.findMany).not.toHaveBeenCalled();
      expect(movements.postMovementWithinTransaction).toHaveBeenCalledWith(prisma, 'mov1', 'u1', ctxA);
    });

    it('rejects posting a non-DRAFT receipt', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(receipt({ status: 'POSTED' }));
      await expect(service.post('rct1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reverse', () => {
    it('reverses a POSTED receipt with a DRAFT OUT movement', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(receipt({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));
        return Promise.resolve(null); // no existing requestId
      });
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov2', movementNumber: 'IM-000002' });
      prisma.productionFinishedGoodsReceipt.create.mockResolvedValue(receipt({ id: 'rct2', receiptNumber: 'PFR-000002', sourceType: 'REVERSE' }));
      prisma.productionFinishedGoodsReceipt.update.mockResolvedValue(receipt({ id: 'rct2' }));

      const result = await service.reverse('rct1', { requestId: 'req-rev-1' }, 'u1', ctxA);

      expect(result.receiptNumber).toBe('PFR-000002');
      const docData = prisma.productionFinishedGoodsReceipt.create.mock.calls[0][0].data;
      expect(docData.sourceType).toBe('REVERSE');
      expect(docData.lines.create[0].productId).toBe('prod1');
      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData.movementType).toBe('PRODUCTION_FG_RECEIPT_REVERSAL');
      expect(movementData.lines.create[0].direction).toBe('OUT');
    });

    it('rejects reversing a DRAFT receipt', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(receipt({ status: 'DRAFT' }));
        return Promise.resolve(null);
      });
      await expect(service.reverse('rct1', {}, 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('cancels a DRAFT receipt and its DRAFT movement together', async () => {
      const { prisma, service } = makeService();
      prisma.productionFinishedGoodsReceipt.findFirst.mockResolvedValue(receipt());
      prisma.inventoryMovement.findUnique.mockResolvedValue({ id: 'mov1', status: 'DRAFT' });
      prisma.productionFinishedGoodsReceipt.update.mockResolvedValue(receipt({ status: 'CANCELLED', cancelledAt: new Date(), cancelledById: 'u1' }));

      const result = await service.cancel('rct1', { reason: 'Wrong entry' }, 'u1', ctxA);

      expect(prisma.inventoryMovement.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'mov1' }, data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
      expect(result.status).toBe('CANCELLED');
    });
  });
});
