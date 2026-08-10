import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductionLossQuantityEventsService } from './production-loss-quantity-events.service';
import { PRODUCTION_LOSS_EVENT_INCLUDE } from './production-loss-quantity-events.constants';

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
  productionVersionId: 'v1',
  productionPackagingId: 'pkg1',
  startedAt: new Date('2026-03-01T08:00:00Z'),
  ...overrides,
});

const lossEvent = (overrides: Record<string, any> = {}) => ({
  id: 'ev1',
  companyId: 'c1',
  branchId: 'b1',
  productionRunId: 'run1',
  productionOrderId: 'po1',
  outputEventId: null,
  type: 'WASTE',
  stage: null,
  productionLineId: 'l1',
  machineId: 'm1',
  measurementPointId: null,
  productId: null,
  productCodeSnapshot: 'DEF-1',
  productNameSnapshot: 'Product',
  versionLabelSnapshot: 'V1',
  packagingLabelSnapshot: 'PKG',
  unit: 'KG',
  quantity: new Prisma.Decimal('12.5'),
  reason: null,
  reasonId: null,
  sourceType: 'MANUAL',
  requestId: 'req-loss-1',
  sourceEventId: null,
  correctsEventId: null,
  correctionReason: null,
  notes: null,
  recordedById: 'u1',
  occurredAt: new Date('2026-03-01T09:00:00Z'),
  createdAt: new Date('2026-03-01T09:00:00Z'),
  updatedAt: new Date('2026-03-01T09:00:00Z'),
  ...overrides,
});

function makeService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    productionLossQuantityEvent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    productionRun: { findFirst: jest.fn() },
    productionOrder: { findFirst: jest.fn() },
    productionProductDefinition: { findFirst: jest.fn() },
    productionVersion: { findUnique: jest.fn() },
    productionPackaging: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
    machine: { findFirst: jest.fn() },
    productionLine: { findFirst: jest.fn() },
    productionMeasurementPoint: { findFirst: jest.fn() },
    productionOutputEvent: { findFirst: jest.fn() },
    operationalLossReason: { findFirst: jest.fn() },
    downtimeSegment: { findMany: jest.fn() },
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  const audit: any = { log: jest.fn(), logWithClient: jest.fn() };
  const service = new ProductionLossQuantityEventsService(prisma, audit);
  return { prisma, audit, service };
}

const baseRecord = (overrides: Record<string, any> = {}) => ({
  requestId: 'req-loss-1',
  type: 'WASTE',
  quantity: 12.5,
  unit: 'KG',
  productionRunId: 'run1',
  ...overrides,
});

describe('ProductionLossQuantityEventsService', () => {
  describe('record', () => {
    it('returns the existing event when the requestId already produced one', async () => {
      const { prisma, service } = makeService();
      prisma.productionLossQuantityEvent.findFirst.mockResolvedValueOnce(lossEvent());
      const result = await service.record(baseRecord(), 'u1', ctxA);
      expect(result.id).toBe('ev1');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('records a waste event with tenant scope and product snapshots from the run', async () => {
      const { prisma, audit, service } = makeService();
      prisma.productionLossQuantityEvent.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ code: 'DEF-1', name: 'Product', productId: 'prod1' });
      prisma.productionVersion.findUnique.mockResolvedValue({ versionLabel: 'V1' });
      prisma.productionPackaging.findUnique.mockResolvedValue({ packagingType: 'PKG' });
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      prisma.productionOutputEvent.findFirst.mockResolvedValue(null);
      prisma.productionLossQuantityEvent.create.mockResolvedValue(lossEvent());

      const result = await service.record(baseRecord(), 'u1', ctxA);

      expect(result.id).toBe('ev1');
      const data = prisma.productionLossQuantityEvent.create.mock.calls[0][0].data;
      expect(data.companyId).toBe('c1');
      expect(data.branchId).toBe('b1');
      expect(data.productionRunId).toBe('run1');
      expect(data.productionOrderId).toBe('po1');
      expect(data.productCodeSnapshot).toBe('DEF-1');
      expect(data.versionLabelSnapshot).toBe('V1');
      expect(data.packagingLabelSnapshot).toBe('PKG');
      expect(prisma.productionPackaging.findUnique).toHaveBeenCalledWith({
        where: { id: 'pkg1' },
        select: { packagingType: true },
      });
      expect(data.type).toBe('WASTE');
      expect(data.quantity.toString()).toBe('12.5');
      expect(audit.logWithClient).toHaveBeenCalled();
    });

    it('records a product-only event using Product.code/name snapshots', async () => {
      const { prisma, audit, service } = makeService();
      prisma.productionLossQuantityEvent.findFirst.mockResolvedValue(null);
      prisma.product.findUnique.mockResolvedValue({ id: 'prod1', code: 'PROD-1', name: 'Widget' });
      prisma.productionLossQuantityEvent.create.mockResolvedValue(lossEvent());

      const result = await service.record(
        baseRecord({ requestId: 'req-prod-1', productionRunId: undefined, productId: 'prod1' }),
        'u1',
        ctxA,
      );

      expect(result.id).toBe('ev1');
      const data = prisma.productionLossQuantityEvent.create.mock.calls[0][0].data;
      expect(data.productionRunId).toBeNull();
      expect(data.productId).toBe('prod1');
      expect(data.productCodeSnapshot).toBe('PROD-1');
      expect(data.productNameSnapshot).toBe('Widget');
      expect(data.versionLabelSnapshot).toBeNull();
      expect(data.packagingLabelSnapshot).toBeNull();
      expect(prisma.product.findUnique).toHaveBeenCalledWith({ where: { id: 'prod1' } });
      expect(audit.logWithClient).toHaveBeenCalled();
    });

    it('rejects a recovery that exceeds the outstanding rework sent quantity', async () => {
      const { prisma, service } = makeService();
      prisma.productionLossQuantityEvent.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'sent1', type: 'REWORK_SENT', quantity: new Prisma.Decimal('10') });
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ code: 'DEF-1', name: 'Product', productId: 'prod1' });
      prisma.productionVersion.findUnique.mockResolvedValue({ versionLabel: 'V1' });
      prisma.productionPackaging.findUnique.mockResolvedValue({ packagingType: 'PKG' });
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      prisma.productionOutputEvent.findFirst.mockResolvedValue(null);
      prisma.productionLossQuantityEvent.count.mockResolvedValue(0);
      prisma.productionLossQuantityEvent.findMany.mockResolvedValue([
        { id: 'rec1', quantity: new Prisma.Decimal('9'), correctsEventId: null },
      ]);

      await expect(
        service.record(baseRecord({ requestId: 'req-rec-1', type: 'REWORK_RECOVERED', quantity: 2, sourceEventId: 'sent1' }), 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a recovery within the outstanding quantity', async () => {
      const { prisma, service } = makeService();
      prisma.productionLossQuantityEvent.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'sent1', type: 'REWORK_SENT', quantity: new Prisma.Decimal('10') });
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ code: 'DEF-1', name: 'Product', productId: 'prod1' });
      prisma.productionVersion.findUnique.mockResolvedValue({ versionLabel: 'V1' });
      prisma.productionPackaging.findUnique.mockResolvedValue({ packagingType: 'PKG' });
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      prisma.productionOutputEvent.findFirst.mockResolvedValue(null);
      prisma.productionLossQuantityEvent.count.mockResolvedValue(0);
      prisma.productionLossQuantityEvent.findMany.mockResolvedValue([
        { id: 'rec1', quantity: new Prisma.Decimal('8'), correctsEventId: null },
      ]);
      prisma.productionLossQuantityEvent.create.mockResolvedValue(lossEvent({ id: 'rec2', type: 'REWORK_RECOVERED' }));

      const result = await service.record(baseRecord({ requestId: 'req-rec-2', type: 'REWORK_RECOVERED', quantity: 2, sourceEventId: 'sent1' }), 'u1', ctxA);

      expect(result.id).toBe('rec2');
    });

    it('rejects a non-recovery event that carries a sourceEventId', async () => {
      const { service } = makeService();
      await expect(
        service.record(baseRecord({ requestId: 'req-x', sourceEventId: 'sent1' }), 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a governed reason whose category does not match the loss type', async () => {
      const { prisma, service } = makeService();
      prisma.productionLossQuantityEvent.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ code: 'DEF-1', name: 'Product', productId: 'prod1' });
      prisma.productionVersion.findUnique.mockResolvedValue({ versionLabel: 'V1' });
      prisma.productionPackaging.findUnique.mockResolvedValue({ packagingType: 'PKG' });
      prisma.operationalLossReason.findFirst.mockResolvedValue({ id: 'r1', lossCategory: 'SCRAP' });
      await expect(
        service.record(baseRecord({ requestId: 'req-cat-1', reasonId: 'r1' }), 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a run that is outside the active context', async () => {
      const { prisma, service } = makeService();
      prisma.productionLossQuantityEvent.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(null);
      await expect(service.record(baseRecord({ productionRunId: 'run-foreign' }), 'u1', ctxB)).rejects.toThrow(NotFoundException);
    });
  });

  describe('correct', () => {
    it('creates a compensating correction and rejects double correction', async () => {
      const { prisma, audit, service } = makeService();
      prisma.productionLossQuantityEvent.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(lossEvent());
      prisma.productionLossQuantityEvent.count.mockResolvedValue(0);
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      prisma.productionLossQuantityEvent.create.mockResolvedValue(lossEvent({ id: 'corr1', correctsEventId: 'ev1' }));

      const result = await service.correct('ev1', { requestId: 'req-corr-1', reason: 'Wrong quantity' }, 'u1', ctxA);

      expect(result.id).toBe('corr1');
      expect(prisma.productionLossQuantityEvent.create.mock.calls[0][0].data.correctsEventId).toBe('ev1');
      expect(prisma.productionLossQuantityEvent.create.mock.calls[0][0].data.correctionReason).toBe('Wrong quantity');
      expect(audit.logWithClient).toHaveBeenCalled();
    });

    it('rejects correcting an event that was already corrected', async () => {
      const { prisma, service } = makeService();
      prisma.productionLossQuantityEvent.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(lossEvent());
      prisma.productionLossQuantityEvent.count.mockResolvedValue(1);
      await expect(
        service.correct('ev1', { requestId: 'req-corr-2', reason: 'x' }, 'u1', ctxA),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects correcting a foreign event', async () => {
      const { prisma, service } = makeService();
      prisma.productionLossQuantityEvent.findFirst.mockResolvedValue(null);
      await expect(
        service.correct('ev-foreign', { requestId: 'req-corr-3', reason: 'x' }, 'u1', ctxB),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll tenant isolation', () => {
    it('scopes by company and branch and validates the type filter', async () => {
      const { prisma, service } = makeService();
      prisma.productionLossQuantityEvent.findMany.mockResolvedValue([]);
      prisma.productionLossQuantityEvent.count.mockResolvedValue(0);
      await service.findAll({ type: 'WASTE' }, ctxA);
      const where = prisma.productionLossQuantityEvent.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('c1');
      expect(where.branchId).toBe('b1');
      expect(where.type).toBe('WASTE');
    });

    it('rejects an unknown type filter', async () => {
      const { service } = makeService();
      await expect(service.findAll({ type: 'BOGUS' } as any, ctxA)).rejects.toThrow(BadRequestException);
    });
  });

  describe('include contract regression', () => {
    it('references only real schema relations and fields', () => {
      const inc = PRODUCTION_LOSS_EVENT_INCLUDE;
      expect(inc).not.toHaveProperty('recordedBy');
      expect((inc.productionRun as any).select).not.toHaveProperty('product');
      expect((inc.machine as any).select).toHaveProperty('code');
      expect((inc.machine as any).select).not.toHaveProperty('machineCode');
      expect((inc.measurementPoint as any).select).toHaveProperty('unit');
      expect((inc.reasonRef as any).select).toHaveProperty('lossCategory');
      expect((inc.productionOrder as any).select).toHaveProperty('orderNumber');
      expect((inc.outputEvent as any).select).toHaveProperty('eventType');
    });
  });

  describe('getRunLosses', () => {
    it('returns run losses with segments using machine.code selection', async () => {
      const { prisma, service } = makeService();
      prisma.productionRun.findFirst.mockResolvedValue({ id: 'run1', runNumber: 'RN-1' });
      prisma.downtimeSegment.findMany.mockResolvedValue([]);
      prisma.productionLossQuantityEvent.findMany.mockResolvedValue([]);
      prisma.productionLossQuantityEvent.count.mockResolvedValue(0);

      const result = await service.getRunLosses('run1', {}, ctxA);

      expect(result.runNumber).toBe('RN-1');
      const segArgs = prisma.downtimeSegment.findMany.mock.calls[0][0];
      expect(segArgs.select.machine.select).toEqual({ id: true, code: true, name: true });
      expect(segArgs.select.machine.select).not.toHaveProperty('machineCode');
    });
  });
});
