import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductionQualityService } from './production-quality.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const plan = (overrides: Record<string, any> = {}) => ({
  id: 'qp1', code: 'PQP-000001', revision: 1, companyId: 'c1', branchId: 'b1',
  productionProductDefinitionId: 'pd1', productionVersionId: null, productionPackagingId: null,
  productionLineId: null, machineId: null, costCenterId: null,
  effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: null,
  status: 'DRAFT', approvedById: null, approvedAt: null, rejectedById: null, rejectedAt: null,
  rejectionReason: null, deactivatedById: null, deactivatedAt: null, deactivationReason: null,
  notes: null, createdById: 'maker', updatedById: 'maker',
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  characteristics: [], samplingPoints: [],
  ...overrides,
});

const characteristic = (overrides: Record<string, any> = {}) => ({
  id: 'ch1', companyId: 'c1', branchId: 'b1', planId: 'qp1', sequence: 1,
  nameAr: 'طول', nameEn: 'Length', characteristicType: 'NUMERIC', unit: 'MM',
  productionUnitId: null, lowerLimit: '0.0000', targetValue: '50.0000', upperLimit: '100.0000',
  criticality: 'MAJOR', samplingRule: null, isRequired: true, status: 'ACTIVE',
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  ...overrides,
});

const inspection = (overrides: Record<string, any> = {}) => ({
  id: 'ins1', inspectionNumber: 'PIN-000001', clientRequestId: 'req-ins-1', companyId: 'c1', branchId: 'b1',
  planId: 'qp1', planCodeSnapshot: 'PQP-000001', planRevisionSnapshot: 1,
  productionOrderId: null, productionRunId: null, outputEventId: null,
  finishedGoodsReceiptId: null, finishedGoodsReceiptLineId: null, samplingPointId: null,
  productId: 'pr1', productCodeSnapshot: 'PROD-1', productNameSnapshot: 'Product 1',
  productionLineId: null, machineId: null, shiftId: null, costCenterId: null,
  sampledQuantity: '10.0000', unit: 'UNIT', inspectedAt: new Date('2026-02-01T08:00:00Z'),
  status: 'OPEN', inspectedById: null, inspectedAtConfirmed: null,
  notes: null, createdById: 'maker', createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  plan: { id: 'qp1', code: 'PQP-000001', revision: 1, status: 'APPROVED' },
  results: [], dispositions: [], nonconformances: [],
  ...overrides,
});

const ncr = (overrides: Record<string, any> = {}) => ({
  id: 'ncr1', ncrNumber: 'NCR-000001', clientRequestId: 'req-ncr-1', companyId: 'c1', branchId: 'b1',
  inspectionId: null, dispositionId: null, severity: 'MAJOR', status: 'OPEN',
  description: 'Defect found', rootCause: null, correctiveAction: null, ownerUserId: null,
  detectionDate: new Date('2026-02-01T08:00:00Z'), targetDate: null,
  verifiedAt: null, verifiedById: null, closedAt: null, closedById: null,
  createdById: 'maker', createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  ...overrides,
});

describe('ProductionQualityService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: ProductionQualityService;

  beforeEach(() => {
    prisma = {
      productionQualityPlan: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      qualityCharacteristic: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      qualitySamplingPoint: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      productionInspection: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      productionQualityDisposition: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      productionInspectionResult: { findFirst: jest.fn(), create: jest.fn() },
      productionNonconformance: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      productionNonconformanceTransition: { findUnique: jest.fn(), create: jest.fn() },
      productionNonconformanceAttachment: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
      productionProductDefinition: { findFirst: jest.fn().mockResolvedValue({ id: 'pd1' }) },
      productionVersion: { findUnique: jest.fn() }, productionPackaging: { findUnique: jest.fn() },
      productionLine: { findUnique: jest.fn() }, machine: { findUnique: jest.fn() }, costCenter: { findUnique: jest.fn() },
      productionUnit: { findUnique: jest.fn() }, productionMeasurementPoint: { findUnique: jest.fn() },
      productionOrder: { findFirst: jest.fn() }, productionRun: { findFirst: jest.fn() },
      product: { findUnique: jest.fn() }, productionOutputEvent: { findUnique: jest.fn() },
      productionFinishedGoodsReceipt: { findUnique: jest.fn() }, productionFinishedGoodsReceiptLine: { findUnique: jest.fn() },
      productionShift: { findUnique: jest.fn() }, user: { findUnique: jest.fn() },
      attachment: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { logWithClient: jest.fn().mockResolvedValue({}) };
    numbering = { generateNumberAtomicWithClient: jest.fn().mockResolvedValue('PQP-000001') };
    service = new ProductionQualityService(prisma, audit, numbering);
  });

  const planDto: any = { productionProductDefinitionId: 'pd1', effectiveFrom: '2026-01-01T00:00:00Z' };

  describe('quality plans', () => {
    it('creates a tenant-owned DRAFT plan, ignores client tenant fields, generates a code and audits', async () => {
      prisma.productionQualityPlan.create.mockImplementation(({ data }: any) => Promise.resolve(plan({ id: 'created', ...data })));
      const result = await service.createPlan({ ...planDto, companyId: 'evil', branchId: 'evil' }, 'maker', ctxA);
      expect(result.status).toBe('DRAFT');
      expect(prisma.productionQualityPlan.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', code: 'PQP-000001', revision: 1 }),
      }));
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('PRODUCTION_QUALITY_PLAN', expect.anything());
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        userId: 'maker', action: 'PLAN_CREATE', entity: 'ProductionQualityPlan', entityId: 'created',
        details: expect.objectContaining({ companyId: 'c1', branchId: 'b1', code: 'PQP-000001' }),
      }));
    });

    it('rejects a product definition outside the active company and branch', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(null);
      await expect(service.createPlan(planDto, 'maker', ctxA)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.productionProductDefinition.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ id: 'pd1', companyId: 'c1', branchId: 'b1' }) });
      expect(prisma.productionQualityPlan.create).not.toHaveBeenCalled();
    });

    it('rejects optional links that belong to another tenant', async () => {
      prisma.productionLine.findUnique.mockResolvedValue(null);
      await expect(service.createPlan({ ...planDto, productionLineId: 'line-other' }, 'maker', ctxA)).rejects.toBeInstanceOf(NotFoundException);
      prisma.productionLine.findUnique.mockResolvedValue({ id: 'line1', companyId: 'c2', branchId: 'b2' });
      await expect(service.createPlan({ ...planDto, productionLineId: 'line1' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('scopes direct reads by company and branch and returns not found across tenants', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(null);
      await expect(service.findOnePlan('qp1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.productionQualityPlan.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'qp1', companyId: 'c2', branchId: 'b2' }) }));
    });

    it('updates only DRAFT plans', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'APPROVED' }));
      await expect(service.updatePlan('qp1', { notes: 'n' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan());
      prisma.productionQualityPlan.update.mockResolvedValue(plan({ notes: 'n' }));
      await service.updatePlan('qp1', { notes: 'n' }, 'maker', ctxA);
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'PLAN_UPDATE' }));
    });

    it('submits only DRAFT, approves only PENDING with at least one active characteristic', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'PENDING' }));
      await expect(service.submitPlan('qp1', 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);

      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan());
      await expect(service.approvePlan('qp1', 'checker', ctxA)).rejects.toBeInstanceOf(BadRequestException);

      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'PENDING', characteristics: [characteristic()] }));
      prisma.productionQualityPlan.update.mockResolvedValue(plan({ status: 'APPROVED', characteristics: [characteristic()] }));
      const approved = await service.approvePlan('qp1', 'checker', ctxA);
      expect(approved.status).toBe('APPROVED');
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'PLAN_APPROVE', userId: 'checker' }));
    });

    it('rejects only PENDING, deactivates only APPROVED, deletes only DRAFT', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'DRAFT' }));
      await expect(service.rejectPlan('qp1', { reason: 'no' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.deactivatePlan('qp1', { reason: 'no' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);

      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'DRAFT' }));
      prisma.productionQualityPlan.update.mockResolvedValue(plan({ status: 'DRAFT', deletedAt: new Date() }));
      await service.deletePlan('qp1', 'maker', ctxA);
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'PLAN_DELETE' }));
    });
  });

  describe('characteristics and sampling points', () => {
    it('creates a tenant-scoped characteristic with the next sequence and audits it', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan());
      prisma.qualityCharacteristic.findFirst.mockResolvedValue({ sequence: 2 });
      prisma.qualityCharacteristic.create.mockImplementation(({ data }: any) => Promise.resolve(characteristic({ ...data, sequence: 3 })));
      const result = await service.createCharacteristic('qp1', { nameAr: 'وزن', nameEn: 'Weight', lowerLimit: 0, upperLimit: 10 }, 'maker', ctxA);
      expect(result.sequence).toBe(3);
      expect(prisma.qualityCharacteristic.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', planId: 'qp1', sequence: 3 }),
      }));
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'CHARACTERISTIC_CREATE' }));
    });

    it('rejects characteristics and sampling points on approved or later plans', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'APPROVED' }));
      await expect(service.createCharacteristic('qp1', { nameAr: 'x', nameEn: 'x' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.createSamplingPoint('qp1', {}, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('tenant-scopes the unit reference of a characteristic', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan());
      prisma.productionUnit.findUnique.mockResolvedValue(null);
      await expect(service.createCharacteristic('qp1', { nameAr: 'x', nameEn: 'x', productionUnitId: 'u1' }, 'maker', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates a sampling point defaulting to FINAL_OUTPUT and scopes line/machine links', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan());
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.qualitySamplingPoint.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'sp1', ...data }));
      const result = await service.createSamplingPoint('qp1', { machineId: 'm1' }, 'maker', ctxA);
      expect(result.stage).toBe('FINAL_OUTPUT');
      expect(prisma.machine.findUnique).toHaveBeenCalledWith({ where: { id: 'm1' } });
      prisma.productionLine.findUnique.mockResolvedValue({ id: 'l1', companyId: 'c2', branchId: 'b2' });
      await expect(service.createSamplingPoint('qp1', { productionLineId: 'l1' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('inspections', () => {
    const inspectionDto: any = {
      planId: 'qp1', clientRequestId: 'req-ins-1', productId: 'pr1',
      sampledQuantity: 10, unit: 'UNIT', inspectedAt: '2026-02-01T08:00:00Z',
    };

    it('creates a tenant-owned inspection against an APPROVED plan with a generated number', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'APPROVED' }));
      prisma.product.findUnique.mockResolvedValue({ id: 'pr1', code: 'PROD-1', name: 'Product 1', companyId: 'c1', branchId: 'b1' });
      numbering.generateNumberAtomicWithClient.mockResolvedValue('PIN-000001');
      prisma.productionInspection.create.mockImplementation(({ data }: any) => Promise.resolve(inspection({ id: 'created', ...data })));
      const result = await service.createInspection(inspectionDto, 'maker', ctxA);
      expect(result.inspectionNumber).toBe('PIN-000001');
      expect(prisma.productionInspection.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', planCodeSnapshot: 'PQP-000001', status: 'OPEN' }),
      }));
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('PRODUCTION_INSPECTION', expect.anything());
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'INSPECTION_CREATE' }));
    });

    it('requires an APPROVED plan and a resolvable product', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'DRAFT' }));
      await expect(service.createInspection(inspectionDto, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'APPROVED' }));
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.createInspection({ ...inspectionDto, productId: 'ghost' }, 'maker', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a run that does not belong to the given order', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'APPROVED' }));
      prisma.productionOrder.findFirst.mockResolvedValue({ id: 'po1' });
      prisma.productionRun.findFirst.mockResolvedValue({ id: 'run1', productionOrderId: 'po-other' });
      await expect(service.createInspection({ ...inspectionDto, productionOrderId: 'po1', productionRunId: 'run1' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('derives the product from the run order when not provided', async () => {
      prisma.productionQualityPlan.findFirst.mockResolvedValue(plan({ status: 'APPROVED' }));
      prisma.productionRun.findFirst.mockResolvedValue({ id: 'run1', productionOrderId: 'po1' });
      prisma.productionOrder.findFirst.mockResolvedValue({ id: 'po1', productionProductDefinitionId: 'pd1' });
      prisma.productionProductDefinition.findFirst.mockResolvedValue({ id: 'pd1', productId: 'pr1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'pr1', code: 'PROD-1', name: 'Product 1', companyId: 'c1', branchId: 'b1' });
      prisma.productionInspection.create.mockImplementation(({ data }: any) => Promise.resolve(inspection({ id: 'created', ...data })));
      const result = await service.createInspection({ ...inspectionDto, productId: undefined, productionRunId: 'run1' }, 'maker', ctxA);
      expect(result.productCodeSnapshot).toBe('PROD-1');
    });

    it('is idempotent by clientRequestId within the tenant', async () => {
      prisma.productionInspection.findFirst.mockResolvedValue(inspection());
      const first = await service.createInspection(inspectionDto, 'maker', ctxA);
      const second = await service.createInspection(inspectionDto, 'maker', ctxA);
      expect(first.id).toBe('ins1');
      expect(second.id).toBe('ins1');
      expect(prisma.productionInspection.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', clientRequestId: 'req-ins-1' }) });
    });

    it('scopes inspection reads to the active company and branch', async () => {
      prisma.productionInspection.findFirst.mockResolvedValue(null);
      await expect(service.findOneInspection('ins1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.productionInspection.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'ins1', companyId: 'c2', branchId: 'b2' }) }));
    });

    it('records numeric results with pass derived from limits and requires exactly one value type', async () => {
      prisma.productionInspection.findFirst.mockResolvedValue(inspection({ status: 'OPEN' }));
      prisma.qualityCharacteristic.findFirst.mockResolvedValue(characteristic());
      prisma.productionInspectionResult.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data }));
      const pass = await service.recordResults('ins1', { results: [{ characteristicId: 'ch1', valueNumeric: 50 }] }, 'maker', ctxA);
      expect(pass[0].pass).toBe(true);
      prisma.productionInspectionResult.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'r2', ...data }));
      const fail = await service.recordResults('ins1', { results: [{ characteristicId: 'ch1', valueNumeric: 150 }] }, 'maker', ctxA);
      expect(fail[0].pass).toBe(false);

      await expect(service.recordResults('ins1', { results: [{ characteristicId: 'ch1', valueNumeric: 50, valueBoolean: true }] }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.recordResults('ins1', { results: [{ characteristicId: 'ch1', valueText: 'abc' }] }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects results for characteristics that are not in the inspection plan', async () => {
      prisma.productionInspection.findFirst.mockResolvedValue(inspection({ status: 'OPEN' }));
      prisma.qualityCharacteristic.findFirst.mockResolvedValue(null);
      await expect(service.recordResults('ins1', { results: [{ characteristicId: 'other' }] }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('completes to COMPLETED when all results pass and required characteristics are recorded', async () => {
      prisma.productionInspection.findFirst.mockResolvedValue(inspection({
        status: 'OPEN',
        plan: { id: 'qp1', characteristics: [characteristic({ id: 'ch1', isRequired: true })] },
        results: [{ characteristicId: 'ch1', pass: true }],
      }));
      prisma.productionInspection.update.mockResolvedValue(inspection({ status: 'COMPLETED' }));
      const completed = await service.completeInspection('ins1', 'maker', ctxA);
      expect(completed.status).toBe('COMPLETED');
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        action: 'INSPECTION_COMPLETE', details: expect.objectContaining({ resultStatus: 'COMPLETED' }),
      }));
    });

    it('holds the inspection when a required characteristic is missing or any result failed', async () => {
      prisma.productionInspection.findFirst.mockResolvedValueOnce(inspection({
        status: 'OPEN', plan: { id: 'qp1', characteristics: [characteristic({ id: 'ch1', isRequired: true })] }, results: [],
      }));
      prisma.productionInspection.update.mockResolvedValue(inspection({ status: 'HELD' }));
      await service.completeInspection('ins1', 'maker', ctxA);
      expect(prisma.productionInspection.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'HELD' }) }));

      prisma.productionInspection.findFirst.mockResolvedValueOnce(inspection({
        status: 'OPEN', plan: { id: 'qp1', characteristics: [characteristic({ id: 'ch1', isRequired: false })] },
        results: [{ characteristicId: 'ch1', pass: false }],
      }));
      await service.completeInspection('ins1', 'maker', ctxA);
      expect(prisma.productionInspection.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'HELD' }) }));
    });

    it('only completes OPEN inspections', async () => {
      prisma.productionInspection.findFirst.mockResolvedValue(inspection({ status: 'COMPLETED' }));
      await expect(service.completeInspection('ins1', 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('dispositions', () => {
    it('creates a PENDING disposition only for COMPLETED/HELD inspections without an approved disposition', async () => {
      prisma.productionInspection.findFirst.mockResolvedValue(inspection({ status: 'OPEN', dispositions: [] }));
      await expect(service.createDisposition('ins1', { action: 'REJECT', quantity: 5, unit: 'UNIT', reason: 'bad' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);

      prisma.productionInspection.findFirst.mockResolvedValue(inspection({ status: 'HELD', dispositions: [{ id: 'd1', status: 'APPROVED' }] }));
      await expect(service.createDisposition('ins1', { action: 'REJECT', quantity: 5, unit: 'UNIT', reason: 'bad' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);

      prisma.productionInspection.findFirst.mockResolvedValue(inspection({ status: 'HELD', dispositions: [] }));
      prisma.productionQualityDisposition.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'd1', ...data }));
      const disposition = await service.createDisposition('ins1', { action: 'REJECT', quantity: 5, unit: 'UNIT', reason: 'bad' }, 'maker', ctxA);
      expect(disposition.status).toBe('PENDING');
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'DISPOSITION_CREATE' }));
    });

    it('approves a PENDING disposition and marks the inspection DISPOSITIONED', async () => {
      prisma.productionQualityDisposition.findFirst.mockResolvedValue({ id: 'd1', inspectionId: 'ins1', action: 'SCRAP', status: 'PENDING', companyId: 'c1', branchId: 'b1' });
      prisma.productionQualityDisposition.update.mockResolvedValue({ id: 'd1', status: 'APPROVED' });
      prisma.productionInspection.findFirst.mockResolvedValue(inspection({ status: 'HELD' }));
      prisma.productionInspection.update.mockResolvedValue(inspection({ status: 'DISPOSITIONED' }));
      await service.approveDisposition('ins1', 'd1', {}, 'approver', ctxA);
      expect(prisma.productionInspection.update).toHaveBeenCalledWith({ where: { id: 'ins1' }, data: { status: 'DISPOSITIONED' } });
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'DISPOSITION_APPROVE', userId: 'approver' }));
    });

    it('rejects only PENDING dispositions and scopes the lookup by inspection and tenant', async () => {
      prisma.productionQualityDisposition.findFirst.mockResolvedValue({ id: 'd1', inspectionId: 'ins1', status: 'APPROVED', companyId: 'c1', branchId: 'b1' });
      await expect(service.rejectDisposition('ins1', 'd1', { reason: 'no' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      prisma.productionQualityDisposition.findFirst.mockResolvedValue(null);
      await expect(service.rejectDisposition('ins1', 'd1', { reason: 'no' }, 'maker', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('nonconformances', () => {
    const ncrDto: any = { clientRequestId: 'req-ncr-1', description: 'Defect found' };

    it('creates a tenant-owned OPEN NCR with a generated number and audits it', async () => {
      numbering.generateNumberAtomicWithClient.mockResolvedValue('NCR-000001');
      prisma.productionNonconformance.create.mockImplementation(({ data }: any) => Promise.resolve(ncr({ id: 'created', ...data })));
      const result = await service.createNcr(ncrDto, 'maker', ctxA);
      expect(result.ncrNumber).toBe('NCR-000001');
      expect(prisma.productionNonconformance.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'OPEN' }),
      }));
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('PRODUCTION_NCR', expect.anything());
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'NCR_CREATE' }));
    });

    it('tenant-scopes the referenced inspection, disposition and owner', async () => {
      prisma.productionInspection.findUnique.mockResolvedValue(null);
      await expect(service.createNcr({ ...ncrDto, inspectionId: 'ins-other' }, 'maker', ctxA)).rejects.toBeInstanceOf(NotFoundException);
      prisma.productionInspection.findUnique.mockResolvedValue({ id: 'ins1', companyId: 'c2', branchId: 'b2' });
      await expect(service.createNcr({ ...ncrDto, inspectionId: 'ins1' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.createNcr({ ...ncrDto, ownerUserId: 'u1' }, 'maker', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('is idempotent by clientRequestId within the tenant', async () => {
      prisma.productionNonconformance.findFirst.mockResolvedValue(ncr());
      const result = await service.createNcr(ncrDto, 'maker', ctxA);
      expect(result.id).toBe('ncr1');
    });

    it('enforces the NCR transition rules and marks VERIFIED/CLOSED owners', async () => {
      prisma.productionNonconformance.findFirst.mockResolvedValue(ncr({ status: 'OPEN' }));
      prisma.productionNonconformanceTransition.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 't1', ...data }));
      await service.transitionNcr('ncr1', { toStatus: 'INVESTIGATING', action: 'investigate', requestId: 'req-t1' }, 'maker', ctxA);
      expect(prisma.productionNonconformance.update).toHaveBeenCalledWith({ where: { id: 'ncr1' }, data: { status: 'INVESTIGATING' } });

      prisma.productionNonconformance.findFirst.mockResolvedValue(ncr({ status: 'ACTION_REQUIRED' }));
      await service.transitionNcr('ncr1', { toStatus: 'VERIFIED', action: 'verify', requestId: 'req-t2' }, 'verifier', ctxA);
      expect(prisma.productionNonconformance.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'VERIFIED', verifiedById: 'verifier' }) }));

      prisma.productionNonconformance.findFirst.mockResolvedValue(ncr({ status: 'VERIFIED' }));
      await service.transitionNcr('ncr1', { toStatus: 'CLOSED', action: 'close', requestId: 'req-t3' }, 'closer', ctxA);
      expect(prisma.productionNonconformance.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED', closedById: 'closer' }) }));
    });

    it('rejects invalid transitions and is idempotent by requestId', async () => {
      prisma.productionNonconformance.findFirst.mockResolvedValue(ncr({ status: 'OPEN' }));
      await expect(service.transitionNcr('ncr1', { toStatus: 'CLOSED', action: 'close', requestId: 'req-x' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);

      prisma.productionNonconformanceTransition.findUnique.mockResolvedValue({ id: 't1', toStatus: 'INVESTIGATING' });
      const result = await service.transitionNcr('ncr1', { toStatus: 'INVESTIGATING', action: 'investigate', requestId: 'req-t1' }, 'maker', ctxA);
      expect(result.id).toBe('t1');
      expect(prisma.productionNonconformance.update).not.toHaveBeenCalled();
    });

    it('links and unlinks attachments with tenant scoping', async () => {
      prisma.productionNonconformance.findFirst.mockResolvedValue(ncr());
      prisma.attachment.findUnique.mockResolvedValue({ id: 'att1' });
      prisma.productionNonconformanceAttachment.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'link1', ...data }));
      await service.attachToNcr('ncr1', { attachmentId: 'att1' }, 'maker', ctxA);
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'NCR_ATTACH' }));

      prisma.productionNonconformanceAttachment.findFirst.mockResolvedValue({ id: 'link1', attachmentId: 'att1', nonconformanceId: 'ncr1', companyId: 'c1', branchId: 'b1' });
      prisma.productionNonconformance.findFirst.mockResolvedValue(ncr());
      const detached = await service.detachFromNcr('ncr1', 'link1', 'maker', ctxA);
      expect(detached.detached).toBe(true);
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'NCR_DETACH' }));
    });
  });
});
