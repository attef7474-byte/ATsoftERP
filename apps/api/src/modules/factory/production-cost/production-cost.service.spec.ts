import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductionCostService } from './production-cost.service';
import { OPERATIONAL_COST_SNAPSHOT_INCLUDE, OPERATIONAL_COST_TRANSACTION_INCLUDE } from './production-cost.constants';

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
  sourceNumberSnapshot: null, sourceFingerprint: null, requestPayloadFingerprint: null, clientRequestId: 'req-tx-1',
  productionOrderId: null, productionRunId: null, calculationId: null,
  productId: null, productCodeSnapshot: null, productNameSnapshot: null,
  productionVersionId: null, productionPackagingId: null, productionLineId: null, machineId: null,
  shiftId: null, costCenterId: null, standardCostSnapshotId: null, outputEventId: null,
  quantity: new Prisma.Decimal('100'), unit: 'HOUR', rate: new Prisma.Decimal('5'), amount: new Prisma.Decimal('500'),
  currencyCode: 'USD', standardAmount: null, varianceAmount: null, occurredAt: new Date('2026-02-01T08:00:00Z'),
  status: 'POSTED', reversalOfId: null, reversalReason: null, notes: null, createdById: 'maker',
  reversedById: null, reversedAt: null, createdAt: new Date(),
  ...overrides,
});

const calculation = (overrides: Record<string, any> = {}) => ({
  id: 'calc1', companyId: 'c1', branchId: 'b1', code: 'OCC-000001', revision: 1,
  scopeType: 'ORDER', scopeId: 'po1', productionOrderId: 'po1', productionRunId: null,
  periodFrom: new Date('2026-02-01T00:00:00Z'), periodTo: new Date('2026-02-28T00:00:00Z'),
  status: 'DRAFT', currencyCode: 'USD', reviewedById: null, reviewedAt: null,
  finalizedById: null, finalizedAt: null, supersedesId: null, reason: null, notes: null,
  createdById: 'maker', createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  ...overrides,
});

const downtimeLog = (overrides: Record<string, any> = {}) => ({
  id: 'dl1', machineId: 'm1', requestId: null, startTime: new Date('2026-02-01T08:00:00Z'),
  endTime: new Date('2026-02-01T10:00:00Z'), durationMinutes: 120,
  reason: null, failureCause: null, failureCategory: null, rootCause: null, correctiveAction: null,
  preventiveAction: null, detectedAt: null, responseStartedAt: null, repairStartedAt: null,
  repairCompletedAt: null, isRepeatFailure: false, repeatedFailureGroupId: null, machineStopped: true,
  productionImpact: null, rcaStatus: 'PENDING', rcaCompletedByUserId: null, rcaCompletedAt: null,
  notes: null, cancelledAt: null, companyId: 'c1', branchId: 'b1', productionRunId: null,
  productionOrderId: null, productionLineId: 'l1', shiftId: null, occurrenceType: null,
  severity: null, sourceType: 'PRODUCTION', status: 'CLOSED',
  ...overrides,
});

const downtimeMachine = (overrides: Record<string, any> = {}) => ({
  id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: 'l1', ...overrides,
});

const downtimeRate = (overrides: Record<string, any> = {}) => rate({
  id: 'dtr1', code: 'DT-MACH', costType: 'DOWNTIME', unit: 'MINUTE', rate: new Prisma.Decimal('10'),
  machineId: 'm1', productionLineId: null, costCenterId: 'cc1',
  effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const downtimeSnapshot = (overrides: Record<string, any> = {}) => ({
  id: 'snap-dt', companyId: 'c1', branchId: 'b1', code: 'STD-DT', revision: 1,
  productionProductDefinitionId: null, productionVersionId: null, productionPackagingId: null,
  productionLineId: null, machineId: 'm1', costCenterId: 'cc1', costType: 'DOWNTIME', unit: 'MINUTE',
  quantity: new Prisma.Decimal('120'), rate: new Prisma.Decimal('8'), amount: new Prisma.Decimal('960'),
  currencyCode: 'USD', effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: null, status: 'FROZEN',
  frozenById: 'maker', frozenAt: new Date(), supersededById: null, supersededAt: null, notes: null,
  createdById: 'maker', createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  ...overrides,
});

describe('ProductionCostService', () => {
  let prisma: any;
  let audit: any;
  let sourceChanges: any;
  let numbering: any;
  let costCenterResolver: any;
  let service: ProductionCostService;

  beforeEach(() => {
    prisma = {
      operationalCostRate: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      operationalStandardCostSnapshot: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), aggregate: jest.fn(), findUnique: jest.fn() },
      operationalCostTransaction: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      operationalCostCalculation: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      productionProductDefinition: { findFirst: jest.fn().mockResolvedValue({ id: 'pd1' }), findMany: jest.fn().mockResolvedValue([]) },
      productionVersion: { findUnique: jest.fn() }, productionPackaging: { findUnique: jest.fn() },
      productionLine: { findUnique: jest.fn() }, machine: { findUnique: jest.fn(), findFirst: jest.fn() }, costCenter: { findUnique: jest.fn() },
      productionOrder: { findUnique: jest.fn(), findFirst: jest.fn() }, productionRun: { findUnique: jest.fn(), findFirst: jest.fn() },
      product: { findUnique: jest.fn() }, productionShift: { findUnique: jest.fn() }, productionOutputEvent: { findUnique: jest.fn() },
      productionFinishedGoodsReceipt: { findUnique: jest.fn() }, productionMaterialDocument: { findUnique: jest.fn(), findFirst: jest.fn() },
      productionQualityDisposition: { findUnique: jest.fn() },
      downtimeLog: { findUnique: jest.fn(), findFirst: jest.fn() },
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', operationalCurrencyCode: 'USD' }) },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { logWithClient: jest.fn().mockResolvedValue({}) };
    sourceChanges = { recordChange: jest.fn().mockResolvedValue({ id: 'change1' }) };
    numbering = { generateNumberAtomicWithClient: jest.fn().mockResolvedValue('OCC-000001') };
    costCenterResolver = {
      resolveWithClient: jest.fn().mockResolvedValue({
        costCenterId: 'cc1',
        costCenter: { id: 'cc1', code: 'CC-1', name: 'CC1', isPrimary: true },
        matchedAssignment: { id: 'a1', resourceType: 'MACHINE', resourceId: 'm1' },
        tenant: { companyId: 'c1', branchId: 'b1' },
      }),
    };
    service = new ProductionCostService(prisma, audit, sourceChanges, numbering, costCenterResolver);
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

    it('accepts version and packaging references through their tenant-owned product-definition parent', async () => {
      prisma.productionVersion.findUnique.mockResolvedValue({ id: 'v1', productionProductId: 'pd1', versionNumber: 1 });
      prisma.productionPackaging.findUnique.mockResolvedValue({ id: 'pk1', productionProductId: 'pd1', packagingType: 'BOX' });
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ id: 'pd1', companyId: 'c1', branchId: 'b1' });
      prisma.operationalStandardCostSnapshot.aggregate.mockResolvedValue({ _max: { revision: 0 } });
      prisma.operationalStandardCostSnapshot.create.mockImplementation(({ data }: any) => Promise.resolve(snapshot({ id: 'created', ...data })));

      const result = await service.createSnapshot(
        { ...snapshotDto, productionVersionId: 'v1', productionPackagingId: 'pk1' },
        'maker',
        ctxA,
      );

      expect(result.productionVersionId).toBe('v1');
      expect(result.productionPackagingId).toBe('pk1');
      expect(prisma.operationalStandardCostSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ productionVersionId: 'v1', productionPackagingId: 'pk1' }),
      }));
    });

    it('rejects a derived catalog reference from another tenant', async () => {
      prisma.productionVersion.findUnique.mockResolvedValue({ id: 'v-foreign', productionProductId: 'pd-foreign' });
      prisma.productionProductDefinition.findFirst
        .mockResolvedValueOnce({ id: 'pd1', companyId: 'c1', branchId: 'b1' })
        .mockResolvedValueOnce(null);

      await expect(service.createSnapshot(
        { ...snapshotDto, productionVersionId: 'v-foreign' },
        'maker',
        ctxA,
      )).rejects.toMatchObject({ response: { messageKey: 'productionCostSnapshot.versionNotFound' } });
      expect(prisma.operationalStandardCostSnapshot.create).not.toHaveBeenCalled();
    });

    it('rejects a version linked to a different product definition', async () => {
      prisma.productionVersion.findUnique.mockResolvedValue({ id: 'v-other', productionProductId: 'pd2' });
      prisma.productionProductDefinition.findFirst
        .mockResolvedValueOnce({ id: 'pd1', companyId: 'c1', branchId: 'b1' })
        .mockResolvedValueOnce({ id: 'pd2', companyId: 'c1', branchId: 'b1' });

      await expect(service.createSnapshot(
        { ...snapshotDto, productionVersionId: 'v-other' },
        'maker',
        ctxA,
      )).rejects.toMatchObject({ response: { messageKey: 'productionCostSnapshot.versionNotFound' } });
      expect(prisma.operationalStandardCostSnapshot.create).not.toHaveBeenCalled();
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

    it('selects real ProductionVersion fields (versionNumber/versionLabel) for the snapshot include, never stale code/name', () => {
      const versionSelect = OPERATIONAL_COST_SNAPSHOT_INCLUDE.productionVersion?.select ?? {};
      expect(versionSelect).toEqual(expect.objectContaining({ id: true, versionNumber: true, versionLabel: true }));
      expect(versionSelect).not.toHaveProperty('code');
      expect(versionSelect).not.toHaveProperty('name');
    });

    it('selects real ProductionPackaging fields (packagingType/packQuantity) for the snapshot include, never stale code/name', () => {
      const packagingSelect = OPERATIONAL_COST_SNAPSHOT_INCLUDE.productionPackaging?.select ?? {};
      expect(packagingSelect).toEqual(expect.objectContaining({ id: true, packagingType: true, packQuantity: true }));
      expect(packagingSelect).not.toHaveProperty('code');
      expect(packagingSelect).not.toHaveProperty('name');
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
      prisma.product.findUnique.mockResolvedValue({ id: 'pr1', code: 'PROD-1', name: 'Product 1', deletedAt: null });
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ id: 'pd1', productId: 'pr1', companyId: 'c1', branchId: 'b1' });
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

    it('accepts a valid global product catalog reference without tenant columns', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'pr1', code: 'PROD-1', name: 'Shared Product', deletedAt: null });
      prisma.operationalCostTransaction.create.mockImplementation(({ data }: any) => Promise.resolve(tx({ id: 'created', ...data })));

      const result = await service.postTransaction({ ...txDto, productId: 'pr1' }, 'maker', ctxA);

      expect(result.productId).toBe('pr1');
      expect(prisma.operationalCostTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', productId: 'pr1', productNameSnapshot: 'Shared Product' }),
      }));
    });

    it('rejects a missing or deleted global product catalog reference', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(null);
      await expect(service.postTransaction({ ...txDto, productId: 'missing' }, 'maker', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'productionCostTransaction.productNotFound' },
      });

      prisma.product.findUnique.mockResolvedValueOnce({ id: 'pr1', deletedAt: new Date() });
      await expect(service.postTransaction({ ...txDto, productId: 'pr1' }, 'maker', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'productionCostTransaction.productNotFound' },
      });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects a derived version reference outside the active tenant', async () => {
      prisma.productionVersion.findUnique.mockResolvedValue({ id: 'v-foreign', productionProductId: 'pd-foreign' });
      prisma.productionProductDefinition.findFirst.mockResolvedValue(null);

      await expect(service.postTransaction(
        { ...txDto, productionVersionId: 'v-foreign' },
        'maker',
        ctxA,
      )).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.versionNotFound' } });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects incompatible version and product catalog references', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'pr1', code: 'P1', name: 'Product 1', deletedAt: null });
      prisma.productionVersion.findUnique.mockResolvedValue({ id: 'v2', productionProductId: 'pd2' });
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ id: 'pd2', productId: 'pr2', companyId: 'c1', branchId: 'b1' });

      await expect(service.postTransaction(
        { ...txDto, productId: 'pr1', productionVersionId: 'v2' },
        'maker',
        ctxA,
      )).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.productNotFound' } });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
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

    it('selects real ProductionVersion fields (versionNumber/versionLabel) for the transaction include, never stale code/name', () => {
      const versionSelect = OPERATIONAL_COST_TRANSACTION_INCLUDE.productionVersion?.select ?? {};
      expect(versionSelect).toEqual(expect.objectContaining({ id: true, versionNumber: true, versionLabel: true }));
      expect(versionSelect).not.toHaveProperty('code');
      expect(versionSelect).not.toHaveProperty('name');
    });

    it('selects real ProductionPackaging fields (packagingType/packQuantity) for the transaction include, never stale code/name', () => {
      const packagingSelect = OPERATIONAL_COST_TRANSACTION_INCLUDE.productionPackaging?.select ?? {};
      expect(packagingSelect).toEqual(expect.objectContaining({ id: true, packagingType: true, packQuantity: true }));
      expect(packagingSelect).not.toHaveProperty('code');
      expect(packagingSelect).not.toHaveProperty('name');
    });

    it('reverses only POSTED non-reversed transactions, negating every amount and marking the original', async () => {
      const original = tx({ id: 'tx1', clientRequestId: 'req-orig', standardAmount: new Prisma.Decimal('400'), varianceAmount: new Prisma.Decimal('100') });
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
      expect(reversalData.sourceFingerprint).toBeNull();
      expect(reversalData.standardAmount.toString()).toBe('400');
      expect(reversalData.varianceAmount.toString()).toBe('-100');
      expect(prisma.operationalCostTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'tx1' }, data: expect.objectContaining({ reversedById: 'maker', reversedAt: expect.any(Date) }),
      }));
      expect(sourceChanges.recordChange).toHaveBeenCalledWith(prisma, expect.anything(), expect.objectContaining({
        scopeType: 'BRANCH', scopeId: 'b1', entityType: 'OPERATIONAL_COST_TRANSACTION', changeType: 'REVERSAL',
      }), 'maker');
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'TRANSACTION_REVERSE' }));
    });

    it('rejects reversing an already reversed transaction', async () => {
      prisma.operationalCostTransaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(tx({ status: 'REVERSED', reversalOfId: 'orig' }));
      await expect(service.reverseTransaction('tx1', { clientRequestId: 'req-rev-2', reason: 'no' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('treats a same requestId with a different payload as a conflict', async () => {
      prisma.operationalCostTransaction.findFirst.mockResolvedValue(tx({ quantity: new Prisma.Decimal('999') }));
      await expect(service.postTransaction({ ...txDto, clientRequestId: 'req-tx-1' }, 'maker', ctxA)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects a second live valuation of the same authoritative source and event', async () => {
      prisma.productionOutputEvent.findUnique.mockResolvedValue({ id: 'evt1', companyId: 'c1', branchId: 'b1' });
      prisma.operationalCostTransaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(tx({ id: 'other', sourceFingerprint: 'OUTPUT_EVENT:evt1:LABOR' }));
      await expect(service.postTransaction(
        { ...txDto, clientRequestId: 'req-2', sourceType: 'OUTPUT_EVENT', sourceId: 'evt1' },
        'maker',
        ctxA,
      )).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects a missing source record for a real operational source', async () => {
      prisma.productionOutputEvent.findUnique.mockResolvedValue(null);
      await expect(service.postTransaction(
        { ...txDto, clientRequestId: 'req-3', sourceType: 'OUTPUT_EVENT', sourceId: 'evt-missing' },
        'maker',
        ctxA,
      )).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a cross-tenant source record', async () => {
      prisma.productionOutputEvent.findUnique.mockResolvedValue({ id: 'evt2', companyId: 'c2', branchId: 'b2' });
      await expect(service.postTransaction(
        { ...txDto, clientRequestId: 'req-4', sourceType: 'OUTPUT_EVENT', sourceId: 'evt2' },
        'maker',
        ctxA,
      )).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks an ambiguous standard snapshot (two equal-revision candidates)', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue({ id: 'po1', companyId: 'c1', branchId: 'b1', productionProductDefinitionId: 'pd1' });
      prisma.operationalStandardCostSnapshot.findMany.mockResolvedValue([
        snapshot({ id: 's1', status: 'FROZEN', revision: 3, rate: new Prisma.Decimal('4') }),
        snapshot({ id: 's2', status: 'FROZEN', revision: 3, rate: new Prisma.Decimal('9') }),
      ]);
      await expect(service.postTransaction({ ...txDto, productionOrderId: 'po1' }, 'maker', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('blocks a missing standard snapshot when a product definition is resolvable', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue({ id: 'po1', companyId: 'c1', branchId: 'b1', productionProductDefinitionId: 'pd1' });
      prisma.operationalStandardCostSnapshot.findMany.mockResolvedValue([]);
      await expect(service.postTransaction({ ...txDto, productionOrderId: 'po1' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('writes the canonical payload fingerprint and the source fingerprint for real sources', async () => {
      prisma.productionOutputEvent.findUnique.mockResolvedValue({ id: 'evt3', companyId: 'c1', branchId: 'b1' });
      prisma.operationalCostTransaction.create.mockImplementation(({ data }: any) => Promise.resolve(tx({ id: 'created', ...data })));
      await service.postTransaction(
        { ...txDto, clientRequestId: 'req-5', sourceType: 'OUTPUT_EVENT', sourceId: 'evt3' },
        'maker',
        ctxA,
      );
      const createdData = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(createdData.sourceFingerprint).toBe('OUTPUT_EVENT:evt3:LABOR');
      expect(createdData.requestPayloadFingerprint).toBeTruthy();
    });
  });

  describe('downtime cost transactions (Batch 2B)', () => {
    const dtDto: any = {
      clientRequestId: 'req-dt-1', eventType: 'DOWNTIME', sourceType: 'DOWNTIME', sourceId: 'dl1',
      machineId: 'm1', quantity: 120, unit: 'MINUTE', rate: 10, occurredAt: '2026-02-01T08:00:00Z',
    };

    const mountClosedLog = () => {
      prisma.downtimeLog.findUnique.mockResolvedValue(downtimeLog());
      prisma.downtimeLog.findFirst.mockResolvedValue(null);
      prisma.machine.findFirst.mockResolvedValue(downtimeMachine());
      prisma.operationalCostTransaction.findFirst.mockResolvedValue(null);
      prisma.operationalStandardCostSnapshot.findMany.mockResolvedValue([]);
    };

    const mountRate = () => {
      prisma.operationalCostRate.findMany.mockResolvedValueOnce([downtimeRate()]);
    };

    const mountCreate = () => {
      prisma.operationalCostTransaction.create.mockImplementation(({ data }: any) => Promise.resolve(tx({ id: 'created', ...data })));
    };

    it('posts a server-authoritative DOWNTIME transaction: MINUTE quantity from durationMinutes, tenant from machine, rate/center/occurredAt server-resolved', async () => {
      mountClosedLog();
      mountRate();
      mountCreate();
      const result = await service.postTransaction(dtDto, 'maker', ctxA);
      expect(result.status).toBe('POSTED');
      const createdData = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(createdData.companyId).toBe('c1');
      expect(createdData.branchId).toBe('b1');
      expect(createdData.eventType).toBe('DOWNTIME');
      expect(createdData.sourceType).toBe('DOWNTIME');
      expect(createdData.quantity.toString()).toBe('120');
      expect(createdData.unit).toBe('MINUTE');
      expect(createdData.rate.toString()).toBe('10');
      expect(createdData.amount.toString()).toBe('1200');
      expect(createdData.machineId).toBe('m1');
      expect(createdData.productionLineId).toBe('l1');
      expect(createdData.costCenterId).toBe('cc1');
      expect(createdData.occurredAt.toISOString()).toBe('2026-02-01T08:00:00.000Z');
      expect(createdData.sourceFingerprint).toBe('DOWNTIME:dl1:DOWNTIME');
      expect(createdData.standardAmount).toBeNull();
      expect(createdData.standardCostSnapshotId).toBeNull();
      expect(costCenterResolver.resolveWithClient).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2026-02-01T08:00:00.000Z' }),
        ctxA,
      );
      expect(sourceChanges.recordChange).toHaveBeenCalledWith(
        prisma,
        ctxA,
        expect.objectContaining({
          scopeType: 'BRANCH', scopeId: 'b1', entityType: 'OPERATIONAL_COST_TRANSACTION', changeType: 'SOURCE_UPDATE',
        }),
        'maker',
      );
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        action: 'TRANSACTION_POST',
        details: expect.objectContaining({
          companyId: 'c1', branchId: 'b1',
          downtimeLogId: 'dl1', downtimeDurationMinutes: '120', rate: '10', rateTier: 'MACHINE',
          costCenterCode: 'CC-1', sourceFingerprint: 'DOWNTIME:dl1:DOWNTIME', amount: '1200',
        }),
      }));
    });

    it('blocks not-complete, cancelled, missing-duration, and superseded logs', async () => {
      mountClosedLog();
      prisma.downtimeLog.findUnique.mockResolvedValue(downtimeLog({ endTime: null, status: 'OPEN' }));
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceNotComplete' } });

      mountClosedLog();
      prisma.downtimeLog.findUnique.mockResolvedValue(downtimeLog({ cancelledAt: new Date() }));
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceCancelled' } });

      mountClosedLog();
      prisma.downtimeLog.findUnique.mockResolvedValue(downtimeLog({ durationMinutes: null }));
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceMissingDuration' } });

      mountClosedLog();
      prisma.downtimeLog.findFirst.mockResolvedValue({ id: 'dl-correcting' });
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceSuperseded' } });
    });

    it('rejects a non-production-loss downtime log and a missing log', async () => {
      prisma.downtimeLog.findUnique.mockResolvedValue(downtimeLog({ sourceType: 'MAINTENANCE' }));
      prisma.machine.findFirst.mockResolvedValue(downtimeMachine());
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.downtimeNotProductionLoss' } });

      prisma.downtimeLog.findUnique.mockResolvedValue(null);
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceDowntimeNotFound' } });
    });

    it('rejects a missing, foreign-company, or foreign-branch machine and a mismatched log tenant', async () => {
      prisma.downtimeLog.findUnique.mockResolvedValue(downtimeLog());
      prisma.machine.findFirst.mockResolvedValue(null);
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.downtimeMachineNotFound' } });

      prisma.downtimeLog.findUnique.mockResolvedValue(downtimeLog());
      prisma.machine.findFirst.mockResolvedValue(downtimeMachine({ companyId: 'c2', branchId: 'b2' }));
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.downtimeMachineNotFound' } });

      prisma.downtimeLog.findUnique.mockResolvedValue(downtimeLog());
      prisma.machine.findFirst.mockResolvedValue(downtimeMachine({ companyId: 'c1', branchId: 'b2' }));
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'common.branchMismatch' } });

      prisma.downtimeLog.findUnique.mockResolvedValue(downtimeLog({ companyId: 'c2' }));
      prisma.machine.findFirst.mockResolvedValue(downtimeMachine());
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'common.tenantMismatch' } });
    });

    it('rejects conflicting eventType, unit, quantity, occurredAt, and rate (all server-authoritative)', async () => {
      mountClosedLog();
      await expect(service.postTransaction({ ...dtDto, eventType: 'LABOR' }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceValuationConflict' } });
      await expect(service.postTransaction({ ...dtDto, unit: 'HOUR' }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceValuationConflict' } });
      await expect(service.postTransaction({ ...dtDto, quantity: 121 }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceValuationConflict' } });
      await expect(service.postTransaction({ ...dtDto, occurredAt: '2026-02-02T08:00:00Z' }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceValuationConflict' } });

      mountClosedLog();
      mountRate();
      await expect(service.postTransaction({ ...dtDto, rate: 999 }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceValuationConflict' } });
    });

    it('persists the server-resolved cost center (referenceDate = log.startTime) and rejects a conflicting client center', async () => {
      mountClosedLog();
      mountRate();
      mountCreate();
      await service.postTransaction(dtDto, 'maker', ctxA);
      expect(prisma.operationalCostTransaction.create.mock.calls[0][0].data.costCenterId).toBe('cc1');
      expect(costCenterResolver.resolveWithClient).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ resourceType: 'MACHINE', machineId: 'm1', referenceDate: '2026-02-01T08:00:00.000Z' }),
        ctxA,
      );

      mountClosedLog();
      mountRate();
      await expect(service.postTransaction({ ...dtDto, costCenterId: 'cc-other' }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.costCenterMismatch' } });
    });

    it('propagates cost-center resolver failures and never creates a transaction', async () => {
      mountClosedLog();
      costCenterResolver.resolveWithClient.mockRejectedValueOnce(new NotFoundException({ messageKey: 'costCenter.resolve.missing', message: 'missing' }));
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'costCenter.resolve.missing' } });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();

      mountClosedLog();
      costCenterResolver.resolveWithClient.mockRejectedValueOnce(new ConflictException({ messageKey: 'costCenter.resolve.ambiguity', message: 'ambiguity' }));
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'costCenter.resolve.ambiguity' } });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('resolves the machine-tier rate and records the MACHINE tier trace', async () => {
      mountClosedLog();
      mountRate();
      mountCreate();
      await service.postTransaction(dtDto, 'maker', ctxA);
      expect(prisma.operationalCostTransaction.create.mock.calls[0][0].data.rate.toString()).toBe('10');
      expect(prisma.operationalCostRate.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ machineId: 'm1', costType: 'DOWNTIME', unit: 'MINUTE', costCenterId: 'cc1', status: 'ACTIVE' }),
      }));
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ details: expect.objectContaining({ rateTier: 'MACHINE', rateCode: 'DT-MACH' }) }));
    });

    it('falls back from the machine tier to the line tier when the machine has no applicable rate', async () => {
      mountClosedLog();
      prisma.operationalCostRate.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValue([downtimeRate({ id: 'dtr-line', code: 'DT-LINE', machineId: null, productionLineId: 'l1' })]);
      mountCreate();
      await service.postTransaction(dtDto, 'maker', ctxA);
      expect(prisma.operationalCostTransaction.create.mock.calls[0][0].data.rate.toString()).toBe('10');
      expect(prisma.operationalCostRate.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: expect.objectContaining({ productionLineId: 'l1', machineId: null }),
      }));
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ details: expect.objectContaining({ rateTier: 'LINE', rateCode: 'DT-LINE' }) }));
    });

    it('scopes rate candidates to the tenant, DOWNTIME type, MINUTE unit, cost center, and effective window', async () => {
      mountClosedLog();
      mountRate();
      mountCreate();
      await service.postTransaction(dtDto, 'maker', ctxA);
      const machineQuery = prisma.operationalCostRate.findMany.mock.calls[0][0];
      expect(machineQuery.where).toMatchObject({
        companyId: 'c1', branchId: 'b1', deletedAt: null, status: 'ACTIVE', costType: 'DOWNTIME', unit: 'MINUTE',
        costCenterId: 'cc1', machineId: 'm1', effectiveFrom: { lte: new Date('2026-02-01T08:00:00Z') },
      });
      expect(machineQuery.orderBy).toEqual([{ effectiveFrom: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }]);
    });

    it('blocks a missing rate and ambiguous machine-tier / line-tier rates', async () => {
      mountClosedLog();
      prisma.operationalCostRate.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.rateResolutionMissing' } });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();

      mountClosedLog();
      prisma.operationalCostRate.findMany.mockResolvedValueOnce([
        downtimeRate({ id: 'r-a', createdAt: new Date('2026-01-01T00:00:00Z') }),
        downtimeRate({ id: 'r-b', createdAt: new Date('2026-01-01T00:00:00Z') }),
      ]);
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.rateAmbiguous' } });

      mountClosedLog();
      prisma.operationalCostRate.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValue([
          downtimeRate({ id: 'r-a', machineId: null, productionLineId: 'l1', createdAt: new Date('2026-01-01T00:00:00Z') }),
          downtimeRate({ id: 'r-b', machineId: null, productionLineId: 'l1', createdAt: new Date('2026-01-01T00:00:00Z') }),
        ]);
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.rateAmbiguous' } });
    });

    it('applies the server-resolved FROZEN DOWNTIME snapshot and computes standard/variance amounts', async () => {
      mountClosedLog();
      mountRate();
      prisma.operationalStandardCostSnapshot.findMany.mockResolvedValue([
        downtimeSnapshot({ id: 'snap-dt', status: 'FROZEN', rate: new Prisma.Decimal('8') }),
      ]);
      mountCreate();
      await service.postTransaction(dtDto, 'maker', ctxA);
      const createdData = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(createdData.standardCostSnapshotId).toBe('snap-dt');
      expect(createdData.standardAmount.toString()).toBe('960');
      expect(createdData.varianceAmount.toString()).toBe('240');
    });

    it('allows no DOWNTIME snapshot (standardAmount null) and scopes candidates to tenant/resource/cost center', async () => {
      mountClosedLog();
      mountRate();
      mountCreate();
      await service.postTransaction(dtDto, 'maker', ctxA);
      const createdData = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(createdData.standardCostSnapshotId).toBeNull();
      expect(createdData.standardAmount).toBeNull();
      const snapshotQuery = prisma.operationalStandardCostSnapshot.findMany.mock.calls[0][0];
      expect(snapshotQuery.where).toMatchObject({
        companyId: 'c1', branchId: 'b1', deletedAt: null, status: 'FROZEN', costType: 'DOWNTIME', unit: 'MINUTE', costCenterId: 'cc1',
      });
      expect(snapshotQuery.where.OR).toEqual([{ machineId: 'm1' }, { productionLineId: 'l1', machineId: null }]);
      expect(snapshotQuery.orderBy).toEqual([{ revision: 'desc' }]);
    });

    it('blocks an ambiguous snapshot (tied revisions)', async () => {
      mountClosedLog();
      mountRate();
      prisma.operationalStandardCostSnapshot.findMany.mockResolvedValue([
        downtimeSnapshot({ id: 'snap-a', revision: 3 }),
        downtimeSnapshot({ id: 'snap-b', revision: 3 }),
      ]);
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.snapshotAmbiguous' } });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('enforces the client snapshot assertion: matching passes, none/mismatch conflicts', async () => {
      mountClosedLog();
      mountRate();
      await expect(service.postTransaction({ ...dtDto, standardCostSnapshotId: 'snap-dt' }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceValuationConflict' } });

      mountClosedLog();
      mountRate();
      prisma.operationalStandardCostSnapshot.findMany.mockResolvedValue([downtimeSnapshot({ id: 'snap-dt', status: 'FROZEN' })]);
      await expect(service.postTransaction({ ...dtDto, standardCostSnapshotId: 'snap-other' }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceValuationConflict' } });

      mountClosedLog();
      mountRate();
      prisma.operationalStandardCostSnapshot.findMany.mockResolvedValue([downtimeSnapshot({ id: 'snap-dt', status: 'FROZEN' })]);
      mountCreate();
      await service.postTransaction({ ...dtDto, standardCostSnapshotId: 'snap-dt' }, 'maker', ctxA);
      expect(prisma.operationalCostTransaction.create.mock.calls[0][0].data.standardCostSnapshotId).toBe('snap-dt');
    });

    it('is idempotent by clientRequestId and treats server-derived field drift as the same intent', async () => {
      mountClosedLog();
      const samePayload = tx({
        id: 'tx-dt', clientRequestId: 'req-dt-1', sourceType: 'DOWNTIME', sourceId: 'dl1',
        requestPayloadFingerprint: (service as any).downtimePayloadFingerprint(dtDto),
      });
      prisma.operationalCostTransaction.findFirst.mockResolvedValue(samePayload);
      const result = await service.postTransaction(dtDto, 'maker', ctxA);
      expect(result.id).toBe('tx-dt');
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();

      const drifted = await service.postTransaction({
        ...dtDto, quantity: 99, unit: 'HOUR', rate: 999, occurredAt: '2026-02-02T00:00:00Z', costCenterId: 'ccX',
      }, 'maker', ctxA);
      expect(drifted.id).toBe('tx-dt');
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('conflicts when the same requestId targets a different source (real intent change)', async () => {
      mountClosedLog();
      const otherIntent = tx({
        id: 'tx-dt', clientRequestId: 'req-dt-1', sourceType: 'DOWNTIME', sourceId: 'dl-other',
        requestPayloadFingerprint: (service as any).downtimePayloadFingerprint({ ...dtDto, sourceId: 'dl-other' }),
      });
      prisma.operationalCostTransaction.findFirst.mockResolvedValue(otherIntent);
      await expect(service.postTransaction(dtDto, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.requestPayloadConflict' } });
    });

    it('rejects a second live valuation of the same downtime source and event', async () => {
      mountClosedLog();
      mountRate();
      prisma.operationalCostTransaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(tx({ id: 'other', sourceFingerprint: 'DOWNTIME:dl1:DOWNTIME' }));
      await expect(service.postTransaction({ ...dtDto, clientRequestId: 'req-dt-2' }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceAlreadyValued' } });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('maps a sourceFingerprint P2002 race to sourceAlreadyValued', async () => {
      mountClosedLog();
      mountRate();
      prisma.operationalCostTransaction.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5', meta: { target: ['sourceFingerprint'] } }),
      );
      await expect(service.postTransaction({ ...dtDto, clientRequestId: 'req-dt-3' }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceAlreadyValued' } });
    });

    it('blocks a correcting log while the original has a live valuation, and allows it after reversal', async () => {
      const correctingLog = downtimeLog({
        id: 'dl-correcting', correctsLogId: 'dl-original', durationMinutes: 60,
        startTime: new Date('2026-02-03T08:00:00Z'), endTime: new Date('2026-02-03T09:00:00Z'),
      });

      mountClosedLog();
      prisma.downtimeLog.findUnique.mockResolvedValue(correctingLog);
      mountRate();
      prisma.operationalCostTransaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ id: 'tx-original' });
      await expect(service.postTransaction({
        ...dtDto, clientRequestId: 'req-dt-corr-1', sourceId: 'dl-correcting', quantity: 60, occurredAt: '2026-02-03T08:00:00Z',
      }, 'maker', ctxA)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceCorrectionConflict' } });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();

      mountClosedLog();
      prisma.downtimeLog.findUnique.mockResolvedValue(correctingLog);
      mountRate();
      mountCreate();
      const result = await service.postTransaction({
        ...dtDto, clientRequestId: 'req-dt-corr-2', sourceId: 'dl-correcting', quantity: 60, occurredAt: '2026-02-03T08:00:00Z',
      }, 'maker', ctxA);
      expect(result.status).toBe('POSTED');
      const createdData = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(createdData.sourceFingerprint).toBe('DOWNTIME:dl-correcting:DOWNTIME');
      expect(createdData.quantity.toString()).toBe('60');
      expect(createdData.amount.toString()).toBe('600');
    });

    it('reverses a DOWNTIME transaction: tenant scoped, no source fingerprint, negated amounts', async () => {
      const original = tx({
        id: 'tx-orig', eventType: 'DOWNTIME', sourceType: 'DOWNTIME', sourceId: 'dl1',
        sourceFingerprint: 'DOWNTIME:dl1:DOWNTIME', clientRequestId: 'req-dt-1',
        quantity: new Prisma.Decimal('120'), unit: 'MINUTE', rate: new Prisma.Decimal('10'), amount: new Prisma.Decimal('1200'),
        machineId: 'm1', costCenterId: 'cc1', occurredAt: new Date('2026-02-01T08:00:00Z'),
      });
      prisma.operationalCostTransaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(original);
      prisma.operationalCostTransaction.create.mockImplementation(({ data }: any) => Promise.resolve(tx({ id: 'tx-rev', ...data })));
      const { reversal } = await service.reverseTransaction('tx-orig', { clientRequestId: 'req-rev-1', reason: 'correction' }, 'maker', ctxA);
      const reversalData = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(reversal.id).toBe('tx-rev');
      expect(reversalData.sourceType).toBe('REVERSAL');
      expect(reversalData.sourceFingerprint).toBeNull();
      expect(reversalData.sourceId).toBe('tx-orig');
      expect(reversalData.eventType).toBe('DOWNTIME');
      expect(reversalData.machineId).toBe('m1');
      expect(reversalData.costCenterId).toBe('cc1');
      expect(reversalData.reversalOfId).toBe('tx-orig');
      expect(reversalData.quantity.toString()).toBe('-120');
      expect(reversalData.amount.toString()).toBe('-1200');
      expect(reversalData.status).toBe('REVERSED');
      expect(prisma.operationalCostTransaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-orig' },
        data: expect.objectContaining({ reversedById: 'maker' }),
      });
      expect(sourceChanges.recordChange).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ changeType: 'REVERSAL' }), 'maker');
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'TRANSACTION_REVERSE' }));
    });
  });

  describe('cost calculations', () => {
    it('creates a DRAFT calculation with the numbering code and audits it', async () => {
      prisma.operationalCostCalculation.create.mockImplementation(({ data }: any) => Promise.resolve(calculation({ id: 'created', ...data })));
      prisma.productionOrder.findFirst.mockResolvedValue({ id: 'po1', companyId: 'c1', branchId: 'b1' });
      const result = await service.createCalculation(
        { scopeType: 'ORDER', scopeId: 'po1', periodFrom: '2026-02-01T00:00:00Z', periodTo: '2026-02-28T00:00:00Z' },
        'maker',
        ctxA,
      );
      expect(result.status).toBe('DRAFT');
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('PRODUCTION_COST_CALCULATION', prisma);
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'CALCULATION_CREATE' }));
    });

    it('B. creates a DRAFT ORDER-scoped calculation persisting the order scope ref', async () => {
      prisma.operationalCostCalculation.create.mockImplementation(({ data }: any) => Promise.resolve(calculation({ id: 'created', ...data })));
      prisma.productionOrder.findFirst.mockResolvedValue({ id: 'po1', companyId: 'c1', branchId: 'b1' });
      const result = await service.createCalculation(
        { scopeType: 'ORDER', scopeId: 'po1', periodFrom: '2026-02-01T00:00:00Z', periodTo: '2026-02-28T00:00:00Z' },
        'maker',
        ctxA,
      );
      const data = prisma.operationalCostCalculation.create.mock.calls[0][0].data;
      expect(result.status).toBe('DRAFT');
      expect(data.scopeType).toBe('ORDER');
      expect(data.scopeId).toBe('po1');
      expect(data.productionOrderId).toBe('po1');
      expect(data.productionRunId).toBeUndefined();
    });

    it('A. creates a DRAFT BRANCH-scoped calculation with no order/run scope ref', async () => {
      prisma.operationalCostCalculation.create.mockImplementation(({ data }: any) => Promise.resolve(calculation({ id: 'created', ...data })));
      const result = await service.createCalculation(
        { scopeType: 'BRANCH', scopeId: 'b1', periodFrom: '2026-02-01T00:00:00Z', periodTo: '2026-02-28T00:00:00Z' },
        'maker',
        ctxA,
      );
      const data = prisma.operationalCostCalculation.create.mock.calls[0][0].data;
      expect(result.status).toBe('DRAFT');
      expect(data.scopeType).toBe('BRANCH');
      expect(data.scopeId).toBe('b1');
      expect(data.productionOrderId).toBeUndefined();
      expect(data.productionRunId).toBeUndefined();
    });

    it('rejects a BRANCH calculation whose scopeId is not the active branch', async () => {
      await expect(service.createCalculation(
        { scopeType: 'BRANCH', scopeId: 'other-branch', periodFrom: '2026-02-01T00:00:00Z', periodTo: '2026-02-28T00:00:00Z' },
        'maker',
        ctxA,
      )).rejects.toMatchObject({ response: { messageKey: 'productionCostCalculation.branchScopeMismatch' } });
    });

    it('C. creates a DRAFT RUN-scoped calculation persisting the run scope ref', async () => {
      prisma.operationalCostCalculation.create.mockImplementation(({ data }: any) => Promise.resolve(calculation({ id: 'created', ...data })));
      prisma.productionRun.findFirst.mockResolvedValue({ id: 'run1', companyId: 'c1', branchId: 'b1' });
      const result = await service.createCalculation(
        { scopeType: 'RUN', scopeId: 'run1', periodFrom: '2026-02-01T00:00:00Z', periodTo: '2026-02-28T00:00:00Z' },
        'maker',
        ctxA,
      );
      const data = prisma.operationalCostCalculation.create.mock.calls[0][0].data;
      expect(result.status).toBe('DRAFT');
      expect(data.scopeType).toBe('RUN');
      expect(data.scopeId).toBe('run1');
      expect(data.productionRunId).toBe('run1');
      expect(data.productionOrderId).toBeUndefined();
    });

    it('walks the lifecycle DRAFT → REVIEW → FINALIZED and audits each transition', async () => {
      prisma.operationalCostCalculation.findFirst
        .mockResolvedValueOnce(calculation({ status: 'DRAFT' }))
        .mockResolvedValueOnce(calculation({ status: 'REVIEW' }));
      prisma.operationalCostCalculation.update.mockImplementation(({ data }: any) => Promise.resolve(calculation({ ...data })));
      prisma.operationalCostTransaction.count.mockResolvedValue(2);
      await service.reviewCalculation('calc1', { reason: 'ok' }, 'maker', ctxA);
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'CALCULATION_REVIEW' }));
      await service.finalizeCalculation('calc1', { reason: 'good' }, 'maker', ctxA);
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'CALCULATION_FINALIZE' }));
    });

    it('rejects finalizing a calculation that is not in REVIEW and reopening a non-finalized one', async () => {
      prisma.operationalCostCalculation.findFirst.mockResolvedValue(calculation({ status: 'DRAFT' }));
      await expect(service.finalizeCalculation('calc1', {}, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.reopenCalculation('calc1', {}, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reopens a FINALIZED calculation as a new DRAFT revision preserving the code', async () => {
      prisma.operationalCostCalculation.findFirst.mockResolvedValue(calculation({ status: 'FINALIZED' }));
      prisma.operationalCostCalculation.create.mockImplementation(({ data }: any) => Promise.resolve(calculation({ id: 'reopened', ...data })));
      const result = await service.reopenCalculation('calc1', { reason: 'recalculate' }, 'maker', ctxA);
      expect(result.status).toBe('DRAFT');
      expect(result.code).toBe('OCC-000001');
      expect(result.revision).toBe(2);
      expect(result.supersedesId).toBe('calc1');
    });

    it('links only POSTED transactions that belong to the calculation scope', async () => {
      prisma.operationalCostCalculation.findFirst.mockResolvedValue(calculation({ status: 'DRAFT' }));
      prisma.operationalCostTransaction.findFirst.mockResolvedValue(tx({ id: 'tx9', productionOrderId: 'po1', status: 'POSTED' }));
      prisma.operationalCostTransaction.update.mockImplementation(({ data }: any) => Promise.resolve(tx({ id: 'tx9', ...data })));
      await service.attachTransactionToCalculation('calc1', { transactionId: 'tx9' }, 'maker', ctxA);
      expect(prisma.operationalCostTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ calculationId: 'calc1' }),
      }));
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'CALCULATION_LINK' }));
    });

    it('keeps a finalized calculation immutable: link and review are rejected', async () => {
      prisma.operationalCostCalculation.findFirst.mockResolvedValue(calculation({ status: 'FINALIZED' }));
      await expect(service.attachTransactionToCalculation('calc1', { transactionId: 'tx9' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.reviewCalculation('calc1', {}, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.operationalCostTransaction.update).not.toHaveBeenCalled();
      expect(prisma.operationalCostCalculation.update).not.toHaveBeenCalled();
    });
  });

  describe('COST-R1B Unified Cost Ledger (canonical posting service)', () => {
    const ctxC3: any = { companyId: 'c3', branchId: 'b3' };

    beforeEach(() => {
      jest.clearAllMocks();
      prisma.operationalCostTransaction.findFirst.mockResolvedValue(null);
      prisma.company.findUnique.mockResolvedValue({ id: 'c3', operationalCurrencyCode: 'SAR' });
      prisma.operationalCostTransaction.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'ledger-1', ...data,
          currencyCode: data.currencyCode ?? 'SAR', status: 'POSTED',
          reversedById: null, reversedAt: null, reversalOfId: null,
          amount: new Prisma.Decimal(data.amount), quantity: new Prisma.Decimal(data.quantity),
          rate: new Prisma.Decimal(data.rate ?? 0), standardAmount: data.standardAmount ?? null, varianceAmount: data.varianceAmount ?? null,
        }));
      prisma.operationalCostTransaction.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'orig-1', ...data }));
    });

    it('POST: PRIMARY_COST inventory movement line stamps all canonical dimensions and company currency', async () => {
      const opts = {
        eventType: 'MATERIAL', sourceType: 'INVENTORY_MOVEMENT_LINE', sourceId: 'inv-1', sourceLineId: 'mvl-1',
        costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST',
        amount: '100.0000', quantity: '10', unit: 'UNIT', rate: '10',
        occurredAt: new Date('2026-02-01T08:00:00Z'),
        clientRequestId: 'r1b-p-1', requestPayloadFingerprint: 'fp-p-1', sourceFingerprint: 'sf-p-1',
        refs: { productionOrderId: 'po1', productionRunId: 'run1', costCenterId: 'cc1', departmentId: 'dep1', maintenanceWorkOrderId: 'wo1', maintenanceRequestId: 'mr1' },
        createdById: 'maker', ctx: ctxC3,
      };
      const { transaction } = await service.postLedgerEntryWithinTransaction(prisma, opts as any);
      const data = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(data.companyId).toBe('c3');
      expect(data.costNature).toBe('ACTUAL');
      expect(data.costPurpose).toBe('PRODUCTION');
      expect(data.entryRole).toBe('PRIMARY_COST');
      expect(data.sourceLineId).toBe('mvl-1');
      expect(data.currencyCode).toBe('SAR');
      expect(data.departmentId).toBe('dep1');
      expect(data.maintenanceWorkOrderId).toBe('wo1');
      expect(data.maintenanceRequestId).toBe('mr1');
      expect(data.postedAt).toBeInstanceOf(Date);
      expect(transaction.amount.toString()).toBe('100');
    });

    it('POST: idempotent replay of the same clientRequestId + fingerprint returns the existing row', async () => {
      const existing = { id: 'ledger-dup', clientRequestId: 'r1b-p-2', requestPayloadFingerprint: 'fp-p-2' };
      prisma.operationalCostTransaction.findFirst.mockResolvedValue(existing);
      const result = await service.postLedgerEntryWithinTransaction(prisma, {
        eventType: 'MATERIAL', sourceType: 'INVENTORY_MOVEMENT_LINE', sourceId: 'inv-2', sourceLineId: 'mvl-2',
        costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST',
        amount: '50', quantity: '5', unit: 'UNIT', occurredAt: new Date(),
        clientRequestId: 'r1b-p-2', requestPayloadFingerprint: 'fp-p-2',
        createdById: 'maker', ctx: ctxC3,
      } as any);
      expect(result.id).toBe('ledger-dup');
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('POST: same clientRequestId with a different fingerprint is a payload conflict', async () => {
      const existing = { id: 'ledger-dup', clientRequestId: 'r1b-p-3', requestPayloadFingerprint: 'fp-p-3' };
      prisma.operationalCostTransaction.findFirst.mockResolvedValue(existing);
      await expect(service.postLedgerEntryWithinTransaction(prisma, {
        eventType: 'MATERIAL', sourceType: 'INVENTORY_MOVEMENT_LINE', sourceId: 'inv-3', sourceLineId: 'mvl-3',
        costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST',
        amount: '50', quantity: '5', unit: 'UNIT', occurredAt: new Date(),
        clientRequestId: 'r1b-p-3', requestPayloadFingerprint: 'fp-DIFFERENT', createdById: 'maker', ctx: ctxC3,
      } as any)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.requestPayloadConflict' } });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('POST: duplicate live PRIMARY_COST for the same source fingerprint is blocked', async () => {
      prisma.operationalCostTransaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'dup', status: 'POSTED', reversedAt: null, sourceFingerprint: 'sf-dup' });
      await expect(service.postLedgerEntryWithinTransaction(prisma, {
        eventType: 'MATERIAL', sourceType: 'INVENTORY_MOVEMENT_LINE', sourceId: 'inv-4', sourceLineId: 'mvl-4',
        costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST',
        amount: '50', quantity: '5', unit: 'UNIT', occurredAt: new Date(),
        clientRequestId: 'r1b-p-4', sourceFingerprint: 'sf-dup', createdById: 'maker', ctx: ctxC3,
      } as any)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.sourceAlreadyValued' } });
    });

    it('POST: an uncontrolled source type is rejected (FG_RECEIPT is not canonical)', async () => {
      await expect(service.postLedgerEntryWithinTransaction(prisma, {
        eventType: 'MATERIAL', sourceType: 'FG_RECEIPT', sourceId: 'fg-1', sourceLineId: 'mvl-5',
        costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST',
        amount: '50', quantity: '5', unit: 'UNIT', occurredAt: new Date(),
        clientRequestId: 'r1b-p-5', createdById: 'maker', ctx: ctxC3,
      } as any)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.unsupportedCanonicalSource' } });
    });

    it('POST: a company with no operational currency blocks a PRIMARY_COST entry (no fallback)', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c3', operationalCurrencyCode: null });
      await expect(service.postLedgerEntryWithinTransaction(prisma, {
        eventType: 'MATERIAL', sourceType: 'MANUAL', sourceId: 'm-1',
        costNature: 'MANUAL_ASSERTED_ACTUAL', costPurpose: 'MAINTENANCE', entryRole: 'PRIMARY_COST',
        amount: '50', quantity: '5', unit: 'UNIT', occurredAt: new Date(),
        clientRequestId: 'r1b-p-6', createdById: 'maker', ctx: ctxC3,
      } as any)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.operationalCurrencyRequired' } });
      expect(prisma.operationalCostTransaction.create).not.toHaveBeenCalled();
    });

    it('POST: a MANUAL asserted actual honors an explicit inventory currency authority', async () => {
      const { transaction } = await service.postLedgerEntryWithinTransaction(prisma, {
        eventType: 'MATERIAL', sourceType: 'MANUAL', sourceId: 'm-2', sourceLineId: 'mvl-7',
        costNature: 'MANUAL_ASSERTED_ACTUAL', costPurpose: 'ADMIN', entryRole: 'PRIMARY_COST',
        amount: '25', quantity: '1', unit: 'UNIT', occurredAt: new Date(),
        clientRequestId: 'r1b-p-7', refs: { _currencyCodeFromInventory: 'SAR' }, createdById: 'maker', ctx: ctxC3,
      } as any);
      expect(transaction.currencyCode).toBe('SAR');
    });

    it('POST: computes variance amount when a standard amount is provided', async () => {
      const { transaction } = await service.postLedgerEntryWithinTransaction(prisma, {
        eventType: 'MATERIAL', sourceType: 'INVENTORY_MOVEMENT_LINE', sourceId: 'inv-6', sourceLineId: 'mvl-8',
        costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST',
        amount: '120', quantity: '12', unit: 'UNIT', rate: '10', standardAmount: '96',
        occurredAt: new Date(), clientRequestId: 'r1b-p-8', createdById: 'maker', ctx: ctxC3,
      } as any);
      expect(transaction.varianceAmount.toString()).toBe('24');
    });

    it('REVERSAL: negates the original amount, links reversalOfId, marks the original reversed', async () => {
      const original = {
        id: 'orig-1', companyId: 'c3', branchId: 'b3', eventType: 'MATERIAL',
        sourceType: 'INVENTORY_MOVEMENT_LINE', sourceId: 'inv-7', sourceLineId: 'mvl-9',
        costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST',
        amount: new Prisma.Decimal('100'), quantity: new Prisma.Decimal('10'), unit: 'UNIT', rate: new Prisma.Decimal('10'),
        currencyCode: 'SAR', standardAmount: null, varianceAmount: null, reversalOfId: null, reversedAt: null,
      };
      const { transaction, updatedOriginal } = await service.reverseLedgerEntry(prisma, original, {
        reason: 'wrong quantity', notes: null, clientRequestId: 'r1b-r-1', createdById: 'maker', ctx: ctxC3,
      });
      const data = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(data.entryRole).toBe('REVERSAL');
      expect(data.reversalOfId).toBe('orig-1');
      expect(data.sourceType).toBe('INVENTORY_MOVEMENT_LINE');
      expect(data.sourceLineId).toBe('mvl-9');
      expect(data.status).toBe('REVERSED');
      expect(data.currencyCode).toBe('SAR');
      expect(transaction.amount.toString()).toBe('-100');
      expect(data.amount.toString()).toBe('-100');
      expect(prisma.operationalCostTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'orig-1' }, data: expect.objectContaining({ reversedAt: expect.any(Date) }),
      }));
    });

    it('REVERSAL: double reversal of an already-reversed original is blocked', async () => {
      const original = {
        id: 'orig-1', companyId: 'c3', branchId: 'b3', eventType: 'MATERIAL', sourceType: 'INVENTORY_MOVEMENT_LINE', sourceId: 'inv-8', sourceLineId: 'mvl-10',
        costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST',
        amount: new Prisma.Decimal('100'), quantity: new Prisma.Decimal('10'), unit: 'UNIT', rate: new Prisma.Decimal('10'),
        currencyCode: 'SAR', standardAmount: null, varianceAmount: null, reversalOfId: null, reversedAt: new Date(),
      };
      await expect(service.reverseLedgerEntry(prisma, original, {
        reason: 'x', notes: null, clientRequestId: 'r1b-r-2', createdById: 'maker', ctx: ctxC3,
      })).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.alreadyReversed' } });
    });

    it('COST-R2B LABOR reversal uses and copies the immutable original ledger event', async () => {
      const original = {
        id: 'labor-primary-1', companyId: 'c3', branchId: 'b3', eventType: 'LABOR',
        sourceType: 'MAINTENANCE_WORK_ORDER_COST_ENTRY', sourceId: 'labor-source-1', sourceLineId: 'labor-source-1',
        costNature: 'MANUAL_ASSERTED_ACTUAL', costPurpose: 'MAINTENANCE', entryRole: 'PRIMARY_COST',
        amount: new Prisma.Decimal('125.75'), quantity: new Prisma.Decimal(0), unit: 'AMOUNT', rate: new Prisma.Decimal(0),
        currencyCode: 'SAR', standardAmount: null, varianceAmount: null, reversalOfId: null, reversedAt: null,
        costCenterId: 'cc-maint', departmentId: 'dep-maint', machineId: 'machine-1', productionLineId: 'line-1',
        maintenanceWorkOrderId: 'wo-1', maintenanceRequestId: 'mr-1',
      };
      const { transaction } = await service.reverseLedgerEntry(prisma, original, {
        reason: 'correct asserted labor amount', notes: null, clientRequestId: 'labor-reversal-request-1', createdById: 'maker', ctx: ctxC3,
      });
      const data = prisma.operationalCostTransaction.create.mock.calls[0][0].data;
      expect(transaction.amount.toString()).toBe('-125.75');
      expect(data).toMatchObject({
        eventType: 'LABOR', sourceType: 'MAINTENANCE_WORK_ORDER_COST_ENTRY', sourceId: 'labor-source-1',
        sourceLineId: 'labor-source-1', costNature: 'MANUAL_ASSERTED_ACTUAL', costPurpose: 'MAINTENANCE',
        entryRole: 'REVERSAL', reversalOfId: 'labor-primary-1', currencyCode: 'SAR', unit: 'AMOUNT',
        costCenterId: 'cc-maint', departmentId: 'dep-maint', machineId: 'machine-1', productionLineId: 'line-1',
        maintenanceWorkOrderId: 'wo-1', maintenanceRequestId: 'mr-1',
      });
      expect(data.quantity.toString()).toBe('0');
      expect(data.rate.toString()).toBe('0');
    });

    it('COST-R2B public reversal path delegates a canonical labor row to the canonical writer', async () => {
      const original = {
        id: 'labor-primary-public', companyId: 'c3', branchId: 'b3', eventType: 'LABOR',
        sourceType: 'MAINTENANCE_WORK_ORDER_COST_ENTRY', sourceId: 'labor-source-public', sourceLineId: 'labor-source-public',
        costNature: 'MANUAL_ASSERTED_ACTUAL', costPurpose: 'MAINTENANCE', entryRole: 'PRIMARY_COST',
        amount: new Prisma.Decimal('80'), quantity: new Prisma.Decimal(0), unit: 'AMOUNT', rate: new Prisma.Decimal(0),
        currencyCode: 'SAR', standardAmount: null, varianceAmount: null, reversalOfId: null, reversedAt: null,
        costCenterId: 'cc-maint', departmentId: 'dep-maint', machineId: 'machine-1', productionLineId: null,
        maintenanceWorkOrderId: 'wo-1', maintenanceRequestId: null, status: 'POSTED',
      };
      prisma.operationalCostTransaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(null);
      const result = await service.reverseTransaction(
        original.id,
        { clientRequestId: 'labor-public-reversal', reason: 'manual labor correction' },
        'maker',
        ctxC3,
      );
      expect(result.reversal.sourceType).toBe('MAINTENANCE_WORK_ORDER_COST_ENTRY');
      expect(result.reversal.sourceId).toBe('labor-source-public');
      expect(result.reversal.amount.toString()).toBe('-80');
      expect(prisma.operationalCostTransaction.create.mock.calls[0][0].data.reversalOfId).toBe('labor-primary-public');
    });

    it('REVERSAL: reversing a reversal is blocked', async () => {
      const original = {
        id: 'rev-1', companyId: 'c3', branchId: 'b3', eventType: 'MATERIAL', sourceType: 'INVENTORY_MOVEMENT_LINE', sourceId: 'inv-9',
        costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'REVERSAL',
        amount: new Prisma.Decimal('-100'), quantity: new Prisma.Decimal('-10'), unit: 'UNIT', rate: new Prisma.Decimal('10'),
        currencyCode: 'SAR', standardAmount: null, varianceAmount: null, reversalOfId: 'orig-1', reversedAt: null,
      };
      await expect(service.reverseLedgerEntry(prisma, original, {
        reason: 'x', notes: null, clientRequestId: 'r1b-r-3', createdById: 'maker', ctx: ctxC3,
      })).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.cannotReverseReversal' } });
    });

    it('DOWNTIME: rate currency matching company operational currency passes (BLOCK only on mismatch)', async () => {
      prisma.downtimeLog.findFirst.mockResolvedValue(downtimeLog());
      prisma.operationalCostRate.findMany.mockResolvedValue([downtimeRate({ currencyCode: 'SAR', machineId: 'm1' })]);
      prisma.operationalStandardCostSnapshot.findMany.mockResolvedValue([]);
      prisma.company.findUnique.mockResolvedValue({ id: 'c3', operationalCurrencyCode: 'SAR' });
      const { transaction } = await service.postLedgerEntryWithinTransaction(prisma, {
        eventType: 'DOWNTIME', sourceType: 'DOWNTIME_EVENT', sourceId: 'dl1',
        costNature: 'RATE_DERIVED', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST',
        amount: '1200', quantity: '120', unit: 'MINUTE', rate: '10', occurredAt: new Date('2026-02-01T08:00:00Z'),
        clientRequestId: 'r1b-dt-1', createdById: 'maker', ctx: ctxC3,
      } as any);
      expect(transaction.currencyCode).toBe('SAR');
    });

    it('findLedgerEntries filters by canonical dimensions and excludes legacy (entryRole null) rows', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        { id: 'l1', entryRole: 'PRIMARY_COST', costNature: 'ACTUAL', costPurpose: 'PRODUCTION', currencyCode: 'SAR' },
      ]);
      prisma.operationalCostTransaction.count.mockResolvedValue(1);
      await service.findLedgerEntries({ costPurpose: 'PRODUCTION' } as any, ctxC3);
      const where = prisma.operationalCostTransaction.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('c3');
      expect(where.entryRole).toEqual({ not: null });
      expect(where.costPurpose).toBe('PRODUCTION');
    });

    it('getLedgerTotals nets PRIMARY_COST against REVERSAL (stored negated) grouped by purpose', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        { id: 'l1', amount: new Prisma.Decimal('100'), currencyCode: 'SAR', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST', status: 'POSTED' },
        { id: 'l2', amount: new Prisma.Decimal('-40'), currencyCode: 'SAR', costPurpose: 'PRODUCTION', entryRole: 'REVERSAL', status: 'REVERSED' },
        { id: 'l3', amount: new Prisma.Decimal('30'), currencyCode: 'SAR', costPurpose: 'MAINTENANCE', entryRole: 'PRIMARY_COST', status: 'POSTED' },
      ]);
      const result = await service.getLedgerTotals({} as any, ctxC3);
      const production = result.totals.find((t: any) => t.purpose === 'PRODUCTION')!;
      const maintenance = result.totals.find((t: any) => t.purpose === 'MAINTENANCE')!;
      expect(production.amount).toBe('60');
      expect(maintenance.amount).toBe('30');
      expect(result.netTotal).toBe('90');
    });
  });

  describe('COST-R1B ledger reads (tenant isolation + filters)', () => {
    const ctxC4: any = { companyId: 'c4', branchId: 'b4' };

    beforeEach(() => {
      jest.clearAllMocks();
      prisma.operationalCostTransaction.findMany.mockResolvedValue([]);
      prisma.operationalCostTransaction.count.mockResolvedValue(0);
    });

    it('findLedgerEntries always scopes the where clause to the active company and branch from ctx, never a client companyId', async () => {
      await service.findLedgerEntries({ companyId: 'evil', branchId: 'evil' } as any, ctxC4);
      expect(prisma.operationalCostTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'c4', branchId: 'b4' }),
      }));
      const where = prisma.operationalCostTransaction.findMany.mock.calls[0][0].where;
      expect(where.companyId).not.toBe('evil');
      expect(where.branchId).not.toBe('evil');
      // the count query is scoped identically
      expect(prisma.operationalCostTransaction.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'c4', branchId: 'b4' }),
      }));
    });

    it('findLedgerEntries applies costNature/costPurpose/entryRole filters only when provided and always excludes legacy (entryRole null) rows', async () => {
      await service.findLedgerEntries({ costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'REVERSAL' } as any, ctxC4);
      const where = prisma.operationalCostTransaction.findMany.mock.calls[0][0].where;
      expect(where.costNature).toBe('ACTUAL');
      expect(where.costPurpose).toBe('PRODUCTION');
      expect(where.entryRole).toBe('REVERSAL');

      prisma.operationalCostTransaction.findMany.mockClear();
      await service.findLedgerEntries({} as any, ctxC4);
      const whereEmpty = prisma.operationalCostTransaction.findMany.mock.calls[0][0].where;
      expect(whereEmpty.costNature).toBeUndefined();
      expect(whereEmpty.costPurpose).toBeUndefined();
      // legacy rows (entryRole null) are always excluded
      expect(whereEmpty.entryRole).toEqual({ not: null });
    });

    it('Company B cannot read Company A ledger rows: the query is always scoped by the active ctx company', async () => {
      prisma.operationalCostTransaction.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve([
          { id: 'lB', companyId: where.companyId, branchId: where.branchId, entryRole: 'PRIMARY_COST', costPurpose: 'PRODUCTION', amount: new Prisma.Decimal('10'), currencyCode: 'SAR' },
        ]),
      );
      // ctxB is the "other" tenant from the top-level suite (company c2), independent of ctxC4
      const ctxOther: any = { companyId: 'company-b-isolated', branchId: 'branch-b-isolated' };
      await service.findLedgerEntries({} as any, ctxOther);
      const where = prisma.operationalCostTransaction.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('company-b-isolated');
      expect(where.companyId).not.toBe(ctxC4.companyId);
      // the service delegates to the ctx-scoped query result, never a company A id
      expect(prisma.operationalCostTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-b-isolated', branchId: 'branch-b-isolated' }),
      }));
    });

    it('getLedgerTotals scopes the query by the active ctx company and groups net amounts by costPurpose', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        { id: 't1', amount: new Prisma.Decimal('80'), currencyCode: 'SAR', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST', status: 'POSTED' },
        { id: 't2', amount: new Prisma.Decimal('-20'), currencyCode: 'SAR', costPurpose: 'PRODUCTION', entryRole: 'REVERSAL', status: 'REVERSED' },
        { id: 't3', amount: new Prisma.Decimal('50'), currencyCode: 'SAR', costPurpose: 'MAINTENANCE', entryRole: 'PRIMARY_COST', status: 'POSTED' },
      ]);
      const result = await service.getLedgerTotals({ costPurpose: 'PRODUCTION' } as any, ctxC4);
      expect(prisma.operationalCostTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'c4', branchId: 'b4', costPurpose: 'PRODUCTION', entryRole: { not: null } }),
      }));
      expect(result.totals.map((t: any) => t.purpose).sort()).toEqual(['MAINTENANCE', 'PRODUCTION']);
      expect(result.totals.find((t: any) => t.purpose === 'PRODUCTION')!.amount).toBe('60');
      expect(result.totals.find((t: any) => t.purpose === 'MAINTENANCE')!.amount).toBe('50');
      expect(result.netTotal).toBe('110');
    });
  });
});
