import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { InventoryStockTransfersService } from './inventory-stock-transfers.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
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

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'w1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'WH1',
  name: 'Main Warehouse',
  ...overrides,
});

const line = (overrides: Record<string, any> = {}) => ({
  id: 'l1',
  transferId: 't1',
  productId: 'prd1',
  quantity: 10,
  transferOutMovementId: null,
  transferInMovementId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const doc = (overrides: Record<string, any> = {}) => ({
  id: 't1',
  code: 'ST-0001',
  companyId: 'c1',
  branchId: 'b1',
  sourceWarehouseId: 'w1',
  destinationWarehouseId: 'w2',
  sourceLocationId: null,
  destinationLocationId: null,
  reason: 'Transfer stock',
  notes: null,
  status: 'DRAFT',
  createdById: 'u1',
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  lines: [line()],
  ...overrides,
});

describe('InventoryStockTransfersService tenant isolation', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: InventoryStockTransfersService;

  beforeEach(() => {
    prisma = {
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      inventoryStockTransfer: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      inventoryStockTransferLine: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      inventoryMovementLine: { create: jest.fn() },
      inventoryBalance: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('ST-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('ST-0001'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new InventoryStockTransfersService(prisma as unknown as PrismaService, audit as unknown as AuditService, numbering as unknown as NumberingService, { findActivePolicyForWarehouse: jest.fn().mockResolvedValue(null), aggregatePhysicalQuantity: jest.fn().mockResolvedValue(new (require('@prisma/client').Prisma).Decimal(100)) } as any);
  });

  describe('update', () => {
    it('rejects source warehouse re-pointing to a foreign company warehouse', async () => {
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(
        service.update('t1', { sourceWarehouseId: 'w-foreign' } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryStockTransfer.update).not.toHaveBeenCalled();
    });

    it('rejects destination warehouse re-pointing to a foreign company warehouse', async () => {
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(
        service.update('t1', { destinationWarehouseId: 'w-foreign' } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryStockTransfer.update).not.toHaveBeenCalled();
    });

    it('never writes tenant fields from the DTO', async () => {
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc());
      prisma.inventoryStockTransfer.update.mockResolvedValue(doc());
      prisma.warehouseLocation.findUnique.mockResolvedValue(null);

      await service.update('t1', {
        companyId: 'c2',
        branchId: 'b2',
        reason: 'updated',
      } as any, 'u1', ctx);

      const updateCall = prisma.inventoryStockTransfer.update.mock.calls[0][0];
      expect(updateCall.data.companyId).toBeUndefined();
      expect(updateCall.data.branchId).toBeUndefined();
      expect(updateCall.data.reason).toBe('updated');
    });

    it('rejects source location that does not belong to the source warehouse', async () => {
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc());
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'other', code: 'L2', name: 'L2',
      });

      await expect(
        service.update('t1', { sourceLocationId: 'loc2' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects making source and destination identical', async () => {
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc({ destinationWarehouseId: 'w1' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());

      await expect(
        service.update('t1', { destinationWarehouseId: 'w1' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows same-company warehouse re-pointing', async () => {
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w3' }));
      prisma.inventoryStockTransfer.update.mockResolvedValue(doc({ destinationWarehouseId: 'w3' }));

      const result = await service.update('t1', { destinationWarehouseId: 'w3' } as any, 'u1', ctx);
      expect(result.destinationWarehouseId).toBe('w3');
    });
  });

  describe('post', () => {
    it('revalidates both warehouses in-transaction and uses in-tx numbering for both movements', async () => {
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 100 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryMovement.create
        .mockResolvedValueOnce({ id: 'out1' })
        .mockResolvedValueOnce({ id: 'in1' });
      prisma.inventoryStockTransferLine.update.mockResolvedValue({});
      prisma.inventoryStockTransfer.update.mockResolvedValue(doc({ status: 'POSTED' }));

      await service.post('t1', 'u1', ctx);

      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledTimes(2);
      const outCreated = prisma.inventoryMovement.create.mock.calls[0][0];
      const inCreated = prisma.inventoryMovement.create.mock.calls[1][0];
      expect(outCreated.data.warehouseId).toBe('w1');
      expect(outCreated.data.movementType).toBe('STOCK_TRANSFER_OUT');
      expect(inCreated.data.warehouseId).toBe('w2');
      expect(inCreated.data.movementType).toBe('STOCK_TRANSFER_IN');
    });

    it('rejects posting when source warehouse belongs to another company', async () => {
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc({ status: 'APPROVED', sourceWarehouseId: 'w-foreign' }));
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 100 });
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(service.post('t1', 'u1', ctx)).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects posting when destination warehouse belongs to another company', async () => {
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc({ status: 'APPROVED', destinationWarehouseId: 'w-foreign' }));
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 100 });
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(service.post('t1', 'u1', ctx)).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('post with ACTIVE valuation policy (VAL-R1D)', () => {
    const D = require('@prisma/client').Prisma;
    const active = { id: 'pol-1', method: 'WEIGHTED_AVERAGE', currencyCode: 'USD' };

    it('TRANSFER_NOT_BOTH_ACTIVE: blocks a half-valued transfer (only one warehouse ACTIVE) before any movement', async () => {
      const findPolicy = jest.fn()
        .mockResolvedValueOnce(active)
        .mockResolvedValueOnce(null);
      service = new InventoryStockTransfersService(prisma as unknown as PrismaService, audit as unknown as AuditService, numbering as unknown as NumberingService, { findActivePolicyForWarehouse: findPolicy, aggregatePhysicalQuantity: jest.fn().mockResolvedValue(new D.Decimal(100)) } as any);
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc({ status: 'APPROVED' }));
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 100, quantityBase: 100 });

      const promise = service.post('t1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventoryValuation.transferNotBothActive');
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('TRANSFER_CURRENCY_MISMATCH: blocks a transfer whose warehouses have different ACTIVE-valuation currencies', async () => {
      const findPolicy = jest.fn()
        .mockResolvedValueOnce({ ...active, currencyCode: 'USD' })
        .mockResolvedValueOnce({ ...active, currencyCode: 'EUR' });
      service = new InventoryStockTransfersService(prisma as unknown as PrismaService, audit as unknown as AuditService, numbering as unknown as NumberingService, { findActivePolicyForWarehouse: findPolicy, aggregatePhysicalQuantity: jest.fn().mockResolvedValue(new D.Decimal(100)) } as any);
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc({ status: 'APPROVED' }));
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 100, quantityBase: 100 });

      const promise = service.post('t1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventoryValuation.transferCurrencyMismatch');
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('TRANSFER_NAME: values the transfer when both warehouses are ACTIVE WEIGHTED_AVERAGE with one currency', async () => {
      const applyValuedTransfer = jest.fn().mockResolvedValue({ transferTotalValue: new D.Decimal(200) });
      service = new InventoryStockTransfersService(prisma as unknown as PrismaService, audit as unknown as AuditService, numbering as unknown as NumberingService, {
        findActivePolicyForWarehouse: jest.fn().mockResolvedValue(active),
        aggregatePhysicalQuantity: jest.fn().mockResolvedValue(new D.Decimal(100)),
        applyValuedTransfer,
      } as any);
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 100, quantityBase: 100 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryMovement.create
        .mockResolvedValueOnce({ id: 'out1' })
        .mockResolvedValueOnce({ id: 'in1' });
      prisma.inventoryMovementLine.create
        .mockResolvedValueOnce({ id: 'out-line' })
        .mockResolvedValueOnce({ id: 'in-line' });
      prisma.inventoryStockTransferLine.update.mockResolvedValue({});

      await service.post('t1', 'u1', ctx);

      expect(applyValuedTransfer).toHaveBeenCalledTimes(1);
      const input = applyValuedTransfer.mock.calls[0][1];
      expect(input.source.lineId).toBe('out-line');
      expect(input.source.movementId).toBe('out1');
      expect(input.destination.lineId).toBe('in-line');
      expect(input.destination.movementId).toBe('in1');
      expect(input.quantity.toNumber()).toBe(10);
      // conservation figure is persisted back onto the transfer line
      const lineUpdate = prisma.inventoryStockTransferLine.update.mock.calls[0][0];
      expect(lineUpdate.data.transferTotalValue).toBe('200');
      expect(lineUpdate.data.transferOutMovementId).toBe('out1');
      expect(lineUpdate.data.transferInMovementId).toBe('in1');
    });
  });

  describe('post concurrent numbering (transient P2034/INVENTORY_MOVEMENT counter) regression', () => {
    const Prisma = require('@prisma/client').Prisma;
    const p2034 = () =>
      new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict or deadlock', { code: 'P2034', clientVersion: '7.8.0' });

    const setupPostSuccess = () => {
      prisma.inventoryStockTransfer.findUnique.mockResolvedValue(doc({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 100, quantityBase: 100 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryMovementLine.create
        .mockResolvedValueOnce({ id: 'out-line' })
        .mockResolvedValueOnce({ id: 'in-line' });
      prisma.inventoryStockTransferLine.update.mockResolvedValue({});
      prisma.inventoryStockTransfer.update.mockResolvedValue(doc({ status: 'POSTED' }));
    };

    it('retries ONLY the transient P2034 numbering write-conflict and returns one successful result (no HTTP 500)', async () => {
      setupPostSuccess();
      // The observed failure: the shared INVENTORY_MOVEMENT counter bump inside
      // the first Serializable attempt raises a P2034 write-conflict BEFORE any
      // movement is created, so the failed attempt cannot leave a duplicate.
      numbering.generateNumberAtomicWithClient
        .mockRejectedValueOnce(p2034())          // first attempt: counter write-conflict
        .mockResolvedValueOnce('IM-0001')         // OUT on retry
        .mockResolvedValueOnce('IM-0002');        // IN on retry
      prisma.inventoryMovement.create
        .mockResolvedValueOnce({ id: 'out1' })
        .mockResolvedValueOnce({ id: 'in1' });

      const result = await service.post('t1', 'u1', ctx);
      expect(result).toBeTruthy();

      // Bounded automatic retry re-ran the whole Serializable posting tx; the
      // caller receives ONE successful response (never a surfaced 500).
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledTimes(3); // 1 failed + 2 on retry
      // no transient 500 surfaced: post resolved rather than rejected
      expect(result).not.toBeNull();
      expect(prisma.inventoryMovement.create).toHaveBeenCalledTimes(2);
      const out = prisma.inventoryMovement.create.mock.calls[0][0].data;
      const inM = prisma.inventoryMovement.create.mock.calls[1][0].data;
      // both eventually succeed with UNIQUE movement numbers
      expect(out.movementNumber).toBe('IM-0001');
      expect(inM.movementNumber).toBe('IM-0002');
      expect(out.movementNumber).not.toBe(inM.movementNumber);
      // OUT(-qty) + IN(+qty) in-tx => no lost inventory update across the retry
      expect(out.movementType).toBe('STOCK_TRANSFER_OUT');
      expect(inM.movementType).toBe('STOCK_TRANSFER_IN');
    });

    it('does NOT retry domain failures (BadRequest) when the transaction is NOT transient', async () => {
      setupPostSuccess();
      numbering.generateNumberAtomicWithClient.mockRejectedValueOnce(
        new BadRequestException({ messageKey: 'inventoryValuation.transferNotBothActive' }),
      );

      await expect(service.post('t1', 'u1', ctx)).rejects.toThrow(BadRequestException);
      // no retry happened for a domain error
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledTimes(1);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rethrows P2034 after the retry bound is exhausted (bounded retry does not loop forever)', async () => {
      setupPostSuccess();
      numbering.generateNumberAtomicWithClient.mockRejectedValue(p2034());

      await expect(service.post('t1', 'u1', ctx)).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
      // bounded: one $transaction invocation per attempt, never loops forever
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledTimes(3);
    });
  });
});
