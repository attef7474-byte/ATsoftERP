import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductionCostService } from './production-cost.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const rate = (overrides: Record<string, any> = {}) => ({
  id: 'r1', companyId: 'c1', branchId: 'b1', code: 'LABOR-HR', nameAr: 'أجر ساعة', nameEn: 'Hourly Labor',
  description: null, costType: 'LABOR', unit: 'HOUR', rate: new Prisma.Decimal('25.0000'),
  currencyCode: 'USD', productionLineId: null, machineId: null, costCenterId: null,
  effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: null, status: 'ACTIVE',
  createdById: 'maker', updatedById: 'maker', createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  ...overrides,
});

const snapshot = (overrides: Record<string, any> = {}) => ({
  id: 'snap1', companyId: 'c1', branchId: 'b1', code: 'STD-LABOR', revision: 1,
  productionProductDefinitionId: 'pd1', productionVersionId: null, productionPackagingId: null,
  productionLineId: null, machineId: null, costCenterId: null, costType: 'LABOR', unit: 'HOUR',
  quantity: new Prisma.Decimal('10.0000'), rate: new Prisma.Decimal('25.0000'), amount: new Prisma.Decimal('250.0000'),
  currencyCode: 'USD', effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: null, status: 'DRAFT',
  frozenById: null, frozenAt: null, supersededById: null, supersededAt: null, notes: null,
  createdById: 'maker', createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  ...overrides,
});

const tx = (overrides: Record<string, any> = {}) => ({
  id: 'tx1', companyId: 'c1', branchId: 'b1', eventType: 'LABOR', sourceType: 'MANUAL', sourceId: 'src1',
  sourceNumberSnapshot: null, clientRequestId: 'req-tx-1', productionOrderId: null, productionRunId: null,
  productId: null, productCodeSnapshot: null, productNameSnapshot: null,
  productionVersionId: null, productionPackagingId: null, productionLineId: null, machineId: null,
  shiftId: null, costCenterId: null, standardCostSnapshotId: null, outputEventId: null,
  quantity: new Prisma.Decimal('100'), unit: 'HOUR', rate: new Prisma.Decimal('5'), amount: new Prisma.Decimal('500'),
  currencyCode: 'USD', standardAmount: null, varianceAmount: null, occurredAt: new Date('2026-02-01T08:00:00Z'),
  status: 'POSTED', reversalOfId: null, reversalReason: null, notes: null, createdById: 'maker',
  reversedById: null, reversedAt: null, createdAt: new Date(),
  ...overrides,
});

describe('ProductionCostService', () => {
  let prisma: any;
  let audit: any;
  let service: ProductionCostService;

  beforeEach(() => {
    prisma = {
      operationalCostRate: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      operationalStandardCostSnapshot: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), aggregate: jest.fn(), findUnique: jest.fn() },
      operationalCostTransaction: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      productionProductDefinition: { findFirst: jest.fn().mockResolvedValue({ id: 'pd1' }) },
      productionVersion: { findUnique: jest.fn() }, productionPackaging: { findUnique: jest.fn() },
      productionLine: { findUnique: jest.fn() }, machine: { findUnique: jest.fn() }, costCenter: { findUnique: jest.fn() },
      productionOrder: { findUnique: jest.fn() }, productionRun: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() }, productionShift: { findUnique: jest.fn() }, productionOutputEvent: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { logWithClient: jest.fn().mockResolvedValue({}) };
    service = new ProductionCostService(prisma, audit);
  });

  describe('cost rates', () => {
    const rateDto: any = {
      code: 'LABOR-HR', nameAr: 'أجر ساعة', nameEn: 'Hourly Labor', costType: 'LABOR', unit: 'HOUR',
      rate: 25, effectiveFrom: '2026-01-01T00:00:00Z',
    };

    it('creates a tenant-owned ACTIVE rate, ignores client tenant fields and audits it', async () => {
      prisma.operationalCostRate.create.mockImplementation(({ data }: any) => Promise.resolve(rate({ id: 'created', ...data })));
      const result = await service.createRate({ ...rateDto, companyId: 'evil', branchId: 'evil' }, 'maker', ctxA);
      expect(result.status).toBe('ACTIVE');
      expect(prisma.operationalCostRate.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', code: 'LABOR-HR', currencyCode: 'USD' }),
      }));
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        userId: 'maker', action: 'RATE_CREATE', entity: 'OperationalCostRate', entityId: 'created',
        details: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }),
      }));
    });

    it('rejects an invalid effective range and cross-tenant links', async () => {
      await expect(service.createRate({ ...rateDto, effectiveTo: '2025-12-31T00:00:00Z' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      prisma.productionLine.findUnique.mockResolvedValue(null);
      await expect(service.createRate({ ...rateDto, productionLineId: 'line-other' }, 'maker', ctxA)).rejects.toBeInstanceOf(NotFoundException);
      prisma.productionLine.findUnique.mockResolvedValue({ id: 'l1', companyId: 'c2', branchId: 'b2' });
      await expect(service.createRate({ ...rateDto, productionLineId: 'l1' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps a duplicate code constraint to a conflict error', async () => {
      prisma.operationalCostRate.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '7.8.0' }));
      await expect(service.createRate(rateDto, 'maker', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('scopes reads and updates by tenant and audits them', async () => {
      prisma.operationalCostRate.findFirst.mockResolvedValue(null);
      await expect(service.findOneRate('r1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.operationalCostRate.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'r1', companyId: 'c2', branchId: 'b2' }) }));

      prisma.operationalCostRate.findFirst.mockResolvedValue(rate());
      prisma.operationalCostRate.update.mockResolvedValue(rate({ rate: new Prisma.Decimal('30') }));
      const updated = await service.updateRate('r1', { rate: 30 }, 'maker', ctxA);
      expect(updated.rate.toString()).toBe('30');
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'RATE_UPDATE' }));

      await service.deleteRate('r1', 'maker', ctxA);
      expect(prisma.operationalCostRate.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), status: 'INACTIVE' }) }));
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'RATE_DELETE' }));
    });
  });

  describe('standard-cost snapshots', () => {
    const snapshotDto: any = {
      code: 'STD-LABOR', productionProductDefinitionId: 'pd1', costType: 'LABOR', unit: 'HOUR',
      quantity: 10, rate: 25, effectiveFrom: '2026-01-01T00:00:00Z',
    };

    it('creates a DRAFT snapshot with the next revision and computed amount', async () => {
      prisma.operationalStandardCostSnapshot.aggregate.mockResolvedValue({ _max: { revision: 2 } });
      prisma.operationalStandardCostSnapshot.create.mockImplementation(({ data }: any) => Promise.resolve(snapshot({ id: 'created', ...data })));
      const result = await service.createSnapshot(snapshotDto, 'maker', ctxA);
      expect(result.revision).toBe(3);
      expect(result.status).toBe('DRAFT');
      expect(prisma.operationalStandardCostSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', revision: 3, amount: expect.any(Prisma.Decimal) }),
      }));
      const createdData = prisma.operationalStandardCostSnapshot.create.mock.calls[0][0].data;
      expect(createdData.amount.toString()).toBe('250');
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'SNAPSHOT_CREATE' }));
    });

    it('rejects a product definition outside the tenant and invalid ranges', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(null);
      await expect(service.createSnapshot(snapshotDto, 'maker', ctxA)).rejects.toBeInstanceOf(NotFoundException);
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ id: 'pd1' });
      await expect(service.createSnapshot({ ...snapshotDto, effectiveTo: '2025-12-31T00:00:00Z' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('scopes reads and only updates DRAFT snapshots', async () => {
      prisma.operationalStandardCostSnapshot.findFirst.mockResolvedValue(null);
      await expect(service.findOneSnapshot('snap1', ctxB)).rejects.toBeInstanceOf(NotFoundException);

      prisma.operationalStandardCostSnapshot.findFirst.mockResolvedValue(snapshot({ status: 'FROZEN' }));
      await expect(service.updateSnapshot('snap1', { notes: 'n' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);

      prisma.operationalStandardCostSnapshot.findFirst.mockResolvedValue(snapshot());
      prisma.operationalStandardCostSnapshot.update.mockResolvedValue(snapshot({ quantity: new Prisma.Decimal('20'), amount: new Prisma.Decimal('500') }));
      const updated = await service.updateSnapshot('snap1', { quantity: 20 }, 'maker', ctxA);
      expect(updated.amount.toString()).toBe('500');
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'SNAPSHOT_UPDATE' }));
    });

    it('freezes only DRAFT and supersedes only FROZEN snapshots', async () => {
      prisma.operationalStandardCostSnapshot.findFirst.mockResolvedValue(snapshot({ status: 'FROZEN' }));
      await expect(service.freezeSnapshot('snap1', {}, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);

      prisma.operationalStandardCostSnapshot.findFirst.mockResolvedValue(snapshot());
      prisma.operationalStandardCostSnapshot.update.mockResolvedValue(snapshot({ status: 'FROZEN', frozenById: 'maker' }));
      await service.freezeSnapshot('snap1', {}, 'maker', ctxA);
      expect(prisma.operationalStandardCostSnapshot.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FROZEN' }) }));
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'SNAPSHOT_FREEZE' }));

      prisma.operationalStandardCostSnapshot.findFirst.mockResolvedValue(snapshot());
      await expect(service.supersedeSnapshot('snap1', {}, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      prisma.operationalStandardCostSnapshot.findFirst.mockResolvedValue(snapshot({ status: 'FROZEN' }));
      prisma.operationalStandardCostSnapshot.update.mockResolvedValue(snapshot({ status: 'SUPERSEDED' }));
      await service.supersedeSnapshot('snap1', {}, 'maker', ctxA);
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'SNAPSHOT_SUPERSEDE' }));
    });

    it('deletes only DRAFT snapshots', async () => {
      prisma.operationalStandardCostSnapshot.findFirst.mockResolvedValue(snapshot({ status: 'FROZEN' }));
      await expect(service.deleteSnapshot('snap1', 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      prisma.operationalStandardCostSnapshot.findFirst.mockResolvedValue(snapshot());
      prisma.operationalStandardCostSnapshot.update.mockResolvedValue(snapshot({ deletedAt: new Date() }));
      await service.deleteSnapshot('snap1', 'maker', ctxA);
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'SNAPSHOT_DELETE' }));
    });
  });

  describe('cost transactions', () => {
    const txDto: any = {
      clientRequestId: 'req-tx-1', eventType: 'LABOR', sourceType: 'MANUAL', sourceId: 'src1',
      quantity: 100, unit: 'HOUR', rate: 5, occurredAt: '2026-02-01T08:00:00Z',
    };

    it('posts a tenant-owned transaction with computed amount and audits it', async () => {
      prisma.operationalCostTransaction.create.mockImplementation(({ data }: any) => Promise.resolve(tx({ id: 'created', ...data })));
      const result = await service.postTransaction(txDto, 'maker', ctxA);
      expect(result.status).toBe('POSTED');
      expect(prisma.operationalCostTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', amount: expect.any(Prisma.Decimal) }),
      }));
      const createdData = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(createdData.amount.toString()).toBe('500');
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        userId: 'maker', action: 'TRANSACTION_POST', entity: 'OperationalCostTransaction', entityId: 'created',
      }));
    });

    it('uses an explicit FROZEN standard snapshot to compute variance', async () => {
      prisma.operationalStandardCostSnapshot.findUnique.mockResolvedValue(snapshot({ status: 'FROZEN', rate: new Prisma.Decimal('4') }));
      prisma.operationalCostTransaction.create.mockImplementation(({ data }: any) => Promise.resolve(tx({ id: 'created', ...data })));
      await service.postTransaction({ ...txDto, standardCostSnapshotId: 'snap1' }, 'maker', ctxA);
      const createdData = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(createdData.standardCostSnapshotId).toBe('snap1');
      expect(createdData.standardAmount.toString()).toBe('400');
      expect(createdData.varianceAmount.toString()).toBe('100');
    });

    it('rejects a non-frozen explicit snapshot and a run that does not match its order', async () => {
      prisma.operationalStandardCostSnapshot.findUnique.mockResolvedValue(snapshot({ status: 'DRAFT' }));
      await expect(service.postTransaction({ ...txDto, standardCostSnapshotId: 'snap1' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);

      prisma.productionOrder.findUnique.mockResolvedValue({ id: 'po1', companyId: 'c1', branchId: 'b1', productionProductDefinitionId: 'pd1' });
      prisma.productionRun.findUnique.mockResolvedValue({ id: 'run1', companyId: 'c1', branchId: 'b1', productionOrderId: 'po-other' });
      await expect(service.postTransaction({ ...txDto, productionOrderId: 'po1', productionRunId: 'run1' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('selects the best standard snapshot for the order definition and fills product snapshots', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue({ id: 'po1', companyId: 'c1', branchId: 'b1', productionProductDefinitionId: 'pd1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'pr1', companyId: 'c1', branchId: 'b1', code: 'PROD-1', name: 'Product 1' });
      prisma.operationalStandardCostSnapshot.findMany.mockResolvedValue([snapshot({ status: 'FROZEN', revision: 2, rate: new Prisma.Decimal('4') })]);
      prisma.operationalCostTransaction.create.mockImplementation(({ data }: any) => Promise.resolve(tx({ id: 'created', ...data })));
      await service.postTransaction({ ...txDto, productionOrderId: 'po1', productId: 'pr1' }, 'maker', ctxA);
      expect(prisma.operationalStandardCostSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ productionProductDefinitionId: 'pd1', status: 'FROZEN' }),
      }));
      const createdData = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(createdData.productCodeSnapshot).toBe('PROD-1');
      expect(createdData.varianceAmount.toString()).toBe('100');
    });

    it('is idempotent by clientRequestId within the tenant', async () => {
      prisma.operationalCostTransaction.findFirst.mockResolvedValue(tx());
      const result = await service.postTransaction(txDto, 'maker', ctxA);
      expect(result.id).toBe('tx1');
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('scopes transaction reads by company and branch', async () => {
      prisma.operationalCostTransaction.findFirst.mockResolvedValue(null);
      await expect(service.findOneTransaction('tx1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.operationalCostTransaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'tx1', companyId: 'c2', branchId: 'b2' }) }));
    });

    it('reverses only POSTED non-reversed transactions, negating every amount and marking the original', async () => {
      const original = tx({ id: 'tx1', clientRequestId: 'req-orig' });
      prisma.operationalCostTransaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(original);
      prisma.operationalCostTransaction.create.mockImplementation(({ data }: any) => Promise.resolve(tx({ id: 'rev1', ...data })));
      prisma.operationalCostTransaction.update.mockResolvedValue({ ...original, reversedById: 'maker', reversedAt: new Date() });
      const result = await service.reverseTransaction('tx1', { clientRequestId: 'req-rev-1', reason: 'wrong entry' }, 'maker', ctxA);
      expect(result.reversal.status).toBe('REVERSED');
      expect(result.reversal.reversalOfId).toBe('tx1');
      expect(result.reversal.sourceType).toBe('REVERSAL');
      const reversalData = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(reversalData.quantity.toString()).toBe('-100');
      expect(reversalData.amount.toString()).toBe('-500');
      expect(prisma.operationalCostTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'tx1' }, data: expect.objectContaining({ reversedById: 'maker', reversedAt: expect.any(Date) }),
      }));
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'TRANSACTION_REVERSE' }));
    });

    it('rejects reversing an already reversed transaction', async () => {
      prisma.operationalCostTransaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(tx({ status: 'REVERSED', reversalOfId: 'orig' }));
      await expect(service.reverseTransaction('tx1', { clientRequestId: 'req-rev-2', reason: 'no' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
