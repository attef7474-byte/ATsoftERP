import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductionMaterialRequirementsService } from './production-material-requirements.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const order = (overrides: Record<string, any> = {}) => ({
  id: 'po1',
  companyId: 'c1',
  branchId: 'b1',
  orderNumber: 'PO-000001',
  status: 'PLANNED',
  plannedQuantity: 100,
  quantityUnit: 'KG',
  productionProductDefinitionId: 'def1',
  productionVersionId: null,
  productionPackagingId: null,
  deletedAt: null,
  ...overrides,
});

const product = (overrides: Record<string, any> = {}) => ({
  id: 'prod1',
  code: 'P1',
  name: 'Material',
  unit: 'KG',
  ...overrides,
});

const frozenLine = (overrides: Record<string, any> = {}) => ({
  id: 'rline1',
  lineNumber: 1,
  productId: 'prod1',
  productCodeSnapshot: 'P1',
  productNameSnapshot: 'Material',
  componentRole: 'RAW_MATERIAL',
  plannedQuantityPerUnit: 2.5,
  plannedQuantity: 250,
  baseUnit: 'KG',
  issueUnit: 'KG',
  conversionFactor: 1,
  warehouseId: null,
  overIssuePolicy: 'NOT_ALLOWED',
  tolerancePercent: null,
  ...overrides,
});

const frozenRequirement = (overrides: Record<string, any> = {}) => ({
  id: 'req1',
  companyId: 'c1',
  branchId: 'b1',
  productionOrderId: 'po1',
  revision: 1,
  status: 'FROZEN',
  sourceType: 'MANUAL',
  productDefinitionCodeSnapshot: 'DEF1',
  productVersionLabelSnapshot: null,
  productPackagingLabelSnapshot: null,
  preparedById: 'u1',
  preparedAt: new Date('2026-03-01T08:00:00Z'),
  frozenById: 'u1',
  frozenAt: new Date('2026-03-01T09:00:00Z'),
  requestId: null,
  lines: [frozenLine()],
  materialDocuments: [],
  productionOrder: { id: 'po1', orderNumber: 'PO-000001', status: 'RELEASED', plannedQuantity: 100, quantityUnit: 'KG' },
  ...overrides,
});

const draftRequirement = (overrides: Record<string, any> = {}) =>
  frozenRequirement({ status: 'DRAFT', frozenById: null, frozenAt: null, ...overrides });

const run = (overrides: Record<string, any> = {}) => ({
  id: 'run1',
  companyId: 'c1',
  branchId: 'b1',
  productionOrderId: 'po1',
  runNumber: 'RUN-000001',
  status: 'RUNNING',
  deletedAt: null,
  ...overrides,
});

const consumptionRecord = (overrides: Record<string, any> = {}) => ({
  id: 'cons1',
  companyId: 'c1',
  branchId: 'b1',
  productionOrderId: 'po1',
  productionRunId: 'run1',
  requirementId: 'req1',
  requirementLineId: 'rline1',
  productId: 'prod1',
  productCodeSnapshot: 'P1',
  productNameSnapshot: 'Material',
  unit: 'KG',
  quantity: 50,
  method: 'EXPLICIT',
  sourceType: 'MANUAL',
  sourceDocumentId: null,
  sourceDocumentNumber: null,
  sourceDocumentType: null,
  recordedById: 'u1',
  recordedAt: new Date('2026-03-02T10:00:00Z'),
  requestId: 'req-cons-1',
  notes: null,
  corrections: [],
  product: { id: 'prod1', code: 'P1', name: 'Material' },
  productionOrder: { id: 'po1', orderNumber: 'PO-000001' },
  productionRun: { id: 'run1', runNumber: 'RUN-000001' },
  requirementLine: { id: 'rline1', lineNumber: 1, plannedQuantity: 250, plannedQuantityPerUnit: 2.5 },
  recordedBy: { id: 'u1', name: 'User' },
  ...overrides,
});

const prepareDto = (overrides: Record<string, any> = {}) => ({
  requestId: 'req-prepare-1',
  lines: [{ productId: 'prod1', plannedQuantityPerUnit: 2.5, baseUnit: 'KG', issueUnit: 'KG' }],
  ...overrides,
});

const recordConsumptionDto = (overrides: Record<string, any> = {}) => ({
  productionOrderId: 'po1',
  productionRunId: 'run1',
  requirementLineId: 'rline1',
  productId: 'prod1',
  unit: 'KG',
  quantity: 50,
  requestId: 'req-cons-1',
  ...overrides,
});

function makeService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    productionOrder: { findFirst: jest.fn() },
    productionRun: { findFirst: jest.fn() },
    product: { findUnique: jest.fn() },
    warehouse: { findUnique: jest.fn() },
    productionProductDefinition: { findUnique: jest.fn() },
    productionVersion: { findUnique: jest.fn() },
    productionPackaging: { findUnique: jest.fn() },
    productionMaterialRequirement: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    productionMaterialRequirementLine: { deleteMany: jest.fn(), createMany: jest.fn() },
    productionMaterialConsumption: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    productionMaterialConsumptionCorrection: { create: jest.fn() },
    productionMaterialDocument: { findMany: jest.fn(), count: jest.fn() },
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  const audit: any = { log: jest.fn(), logWithClient: jest.fn() };
  const service = new ProductionMaterialRequirementsService(prisma, audit);
  return { prisma, audit, service };
}

describe('ProductionMaterialRequirementsService', () => {
  describe('prepare', () => {
    it('creates a DRAFT snapshot with computed planned quantities', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionProductDefinition.findUnique.mockResolvedValue({ id: 'def1', code: 'DEF1', name: 'Def' });
      prisma.productionMaterialRequirement.create.mockResolvedValue(draftRequirement());

      const result = await service.prepare('po1', prepareDto(), 'u1', ctxA);

      expect(result.id).toBe('req1');
      const data = prisma.productionMaterialRequirement.create.mock.calls[0][0].data;
      expect(data.companyId).toBe('c1');
      expect(data.branchId).toBe('b1');
      expect(data.productionOrderId).toBe('po1');
      expect(data.revision).toBe(1);
      expect(data.status).toBe('DRAFT');
      expect(data.sourceType).toBe('MANUAL');
      expect(data.productDefinitionCodeSnapshot).toBe('DEF1');
      expect(data.lines.create[0].plannedQuantity.toString()).toBe('250');
      expect(data.lines.create[0].componentRole).toBe('RAW_MATERIAL');
      expect(data.lines.create[0].overIssuePolicy).toBe('NOT_ALLOWED');
    });

    it('snapshots the real packagingType when the order has a packaging (no stale packaging.label access)', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order({ productionPackagingId: 'pkg1', productionVersionId: 'ver1' }));
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionProductDefinition.findUnique.mockResolvedValue({ id: 'def1', code: 'DEF1', name: 'Def' });
      prisma.productionVersion.findUnique.mockResolvedValue({ id: 'ver1', versionLabel: 'V2.0' });
      prisma.productionPackaging.findUnique.mockResolvedValue({ packagingType: 'CARTON' });
      prisma.productionMaterialRequirement.create.mockResolvedValue(draftRequirement());

      await service.prepare('po1', prepareDto(), 'u1', ctxA);

      expect(prisma.productionPackaging.findUnique).toHaveBeenCalledWith({
        where: { id: 'pkg1' },
        select: { packagingType: true },
      });
      const data = prisma.productionMaterialRequirement.create.mock.calls[0][0].data;
      expect(data.productPackagingLabelSnapshot).toBe('CARTON');
      expect(data.productVersionLabelSnapshot).toBe('V2.0');
      expect(data.productDefinitionCodeSnapshot).toBe('DEF1');
      expect(data.lines.create[0].plannedQuantity.toString()).toBe('250');
    });

    it('leaves the packaging snapshot null when the order has no packaging', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order({ productionPackagingId: null }));
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionProductDefinition.findUnique.mockResolvedValue({ id: 'def1', code: 'DEF1', name: 'Def' });
      prisma.productionMaterialRequirement.create.mockResolvedValue(draftRequirement());

      await service.prepare('po1', prepareDto(), 'u1', ctxA);

      expect(prisma.productionPackaging.findUnique).not.toHaveBeenCalled();
      const data = prisma.productionMaterialRequirement.create.mock.calls[0][0].data;
      expect(data.productPackagingLabelSnapshot).toBeNull();
    });

    it('leaves the packaging snapshot null when the packaging row does not exist', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order({ productionPackagingId: 'pkg-missing' }));
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionProductDefinition.findUnique.mockResolvedValue({ id: 'def1', code: 'DEF1', name: 'Def' });
      prisma.productionPackaging.findUnique.mockResolvedValue(null);
      prisma.productionMaterialRequirement.create.mockResolvedValue(draftRequirement());

      await service.prepare('po1', prepareDto(), 'u1', ctxA);

      const data = prisma.productionMaterialRequirement.create.mock.calls[0][0].data;
      expect(data.productPackagingLabelSnapshot).toBeNull();
    });

    it('returns the existing snapshot when the requestId already produced one (idempotency)', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(draftRequirement());
      const result = await service.prepare('po1', prepareDto(), 'u1', ctxA);
      expect(result.id).toBe('req1');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('replaces an existing DRAFT snapshot instead of creating a second one', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(draftRequirement());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionProductDefinition.findUnique.mockResolvedValue({ id: 'def1', code: 'DEF1', name: 'Def' });
      prisma.productionMaterialRequirementLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.productionMaterialRequirement.update.mockResolvedValue(draftRequirement());

      await service.prepare('po1', prepareDto(), 'u1', ctxA);

      expect(prisma.productionMaterialRequirement.create).not.toHaveBeenCalled();
      expect(prisma.productionMaterialRequirement.update).toHaveBeenCalled();
      expect(prisma.productionMaterialRequirementLine.deleteMany).toHaveBeenCalledWith({ where: { requirementId: 'req1' } });
    });

    it('blocks preparation when a FROZEN snapshot already exists (immutability)', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(frozenRequirement());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      await expect(service.prepare('po1', prepareDto(), 'u1', ctxA)).rejects.toThrow(ConflictException);
      expect(prisma.productionMaterialRequirement.create).not.toHaveBeenCalled();
    });

    it('blocks preparation when the order is not DRAFT/PLANNED', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order({ status: 'RELEASED' }));
      await expect(service.prepare('po1', prepareDto(), 'u1', ctxA)).rejects.toThrow(ConflictException);
    });

    it('rejects a duplicate product across lines', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.product.findUnique.mockResolvedValue(product());
      await expect(
        service.prepare('po1', prepareDto({ lines: [
          { productId: 'prod1', plannedQuantityPerUnit: 1, baseUnit: 'KG', issueUnit: 'KG' },
          { productId: 'prod1', plannedQuantityPerUnit: 1, baseUnit: 'KG', issueUnit: 'KG' },
        ] }), 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('freeze', () => {
    it('freezes a DRAFT snapshot with actor and timestamp', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(draftRequirement());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.update.mockResolvedValue(frozenRequirement());

      const result = await service.freeze('req1', 'u1', ctxA);

      expect(result.status).toBe('FROZEN');
      expect(prisma.productionMaterialRequirement.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FROZEN', frozenById: 'u1', frozenAt: expect.any(Date) }) }),
      );
    });

    it('rejects freezing a non-DRAFT snapshot', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      await expect(service.freeze('req1', 'u1', ctxA)).rejects.toThrow(ConflictException);
    });

    it('rejects freezing for a cancelled order', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(draftRequirement());
      prisma.productionOrder.findFirst.mockResolvedValue(order({ status: 'CANCELLED' }));
      await expect(service.freeze('req1', 'u1', ctxA)).rejects.toThrow(ConflictException);
    });

    it('rejects access from another company', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(null);
      await expect(service.freeze('req1', 'u1', ctxB)).rejects.toThrow(NotFoundException);
      expect(prisma.productionMaterialRequirement.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'c2', branchId: 'b2' }) }),
      );
    });
  });

  describe('cancel', () => {
    it('cancels a DRAFT snapshot', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(draftRequirement());
      prisma.productionMaterialRequirement.update.mockResolvedValue(draftRequirement({ status: 'CANCELLED' }));

      const result = await service.cancel('req1', { reason: 'Recipe changed' }, 'u1', ctxA);
      expect(result.status).toBe('CANCELLED');
    });

    it('blocks cancelling a FROZEN snapshot once posting has started', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialDocument.count.mockResolvedValue(1);
      await expect(service.cancel('req1', { reason: 'Wrong' }, 'u1', ctxA)).rejects.toThrow(ConflictException);
    });
  });

  describe('getByOrder (tenant isolation)', () => {
    it('returns the latest snapshot for the owning context', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      await expect(service.getByOrder('po1', ctxA)).resolves.toMatchObject({ id: 'req1' });
    });

    it('rejects access from another company', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(null);
      await expect(service.getByOrder('po1', ctxB)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrderReadiness', () => {
    it('reports NOT_READY with the canonical missing-snapshot blocker when no FROZEN snapshot exists', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(null);

      const result = await service.getOrderReadiness('po1', ctxA);
      expect(result.status).toBe('NOT_READY');
      expect(result.blockers).toContain('productionMaterialRequirement.missingFrozenSnapshot');
      expect(result.lines).toEqual([]);
    });

    it('reports READY when issued quantity matches the planned snapshot', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 250, substitutedProductId: null }] },
      ]);

      const result = await service.getOrderReadiness('po1', ctxA);
      expect(result.status).toBe('READY');
      expect(result.blockers).toEqual([]);
      expect(result.lines[0].status).toBe('OK');
      expect(result.lines[0].netIssued.toString()).toBe('250');
    });

    it('reports a shortage warning when issued quantity is below planned', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 100, substitutedProductId: null }] },
      ]);

      const result = await service.getOrderReadiness('po1', ctxA);
      expect(result.status).toBe('NOT_READY');
      expect(result.lines[0].status).toBe('SHORT');
      expect(result.lines[0].shortage.toString()).toBe('150');
    });

    it('reports an over-issue warning beyond tolerance', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(
        frozenRequirement({ lines: [frozenLine({ overIssuePolicy: 'TOLERANCE', tolerancePercent: 10 })] }),
      );
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 300, substitutedProductId: null }] },
      ]);

      const result = await service.getOrderReadiness('po1', ctxA);
      expect(result.status).toBe('NOT_READY');
      expect(result.lines[0].status).toBe('OVER_ISSUE');
      expect(result.warnings).toContain('productionMaterialRequirement.overIssueWarning');
    });
  });

  describe('getOrderConsumptionSummary', () => {
    it('uses explicit consumption records as the authoritative source when present', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([consumptionRecord()]);

      const result = await service.getOrderConsumptionSummary('po1', ctxA);
      expect(result.source).toBe('EXPLICIT');
      expect(result.lines[0].consumedQuantity.toString()).toBe('50');
    });

    it('applies the last correction when computing explicit consumption totals', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([
        consumptionRecord({ corrections: [
          { id: 'c1', previousQuantity: 50, newQuantity: 60 },
          { id: 'c2', previousQuantity: 60, newQuantity: 55 },
        ] }),
      ]);

      const result = await service.getOrderConsumptionSummary('po1', ctxA);
      expect(result.lines[0].consumedQuantity.toString()).toBe('55');
    });

    it('derives consumption as net issued when no explicit records exist', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 100, substitutedProductId: null }] },
        { id: 'doc2', documentType: 'RETURN', lines: [{ productId: 'prod1', quantity: 20, substitutedProductId: null }] },
      ]);

      const result = await service.getOrderConsumptionSummary('po1', ctxA);
      expect(result.source).toBe('DERIVED_NET_ISSUE');
      expect(result.lines[0].consumedQuantity.toString()).toBe('80');
      expect(result.lines[0].requirementLineId).toBe('rline1');
    });

    it('flags consumed products that are not in the frozen snapshot', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod-other', quantity: 5, substitutedProductId: null }] },
      ]);

      const result = await service.getOrderConsumptionSummary('po1', ctxA);
      expect(result.unlistedConsumed!.length).toBe(1);
      expect(result.warnings).toContain('productionMaterialRequirement.unlistedConsumedWarning');
    });
  });

  describe('getRunMaterialsSummary / getRunConsumptionSummary', () => {
    it('rejects a run from another company', async () => {
      const { prisma, service } = makeService();
      prisma.productionRun.findFirst.mockResolvedValue(null);
      await expect(service.getRunMaterialsSummary('run1', ctxB)).rejects.toThrow(NotFoundException);
      await expect(service.getRunConsumptionSummary('run1', ctxB)).rejects.toThrow(NotFoundException);
    });

    it('computes issued, returned and net quantities per product for a run', async () => {
      const { prisma, service } = makeService();
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 40, substitutedProductId: null }] },
        { id: 'doc2', documentType: 'RETURN', lines: [{ productId: 'prod1', quantity: 10, substitutedProductId: null }] },
      ]);

      const result = await service.getRunMaterialsSummary('run1', ctxA);
      expect(result.lines[0].netIssued.toString()).toBe('30');
    });

    it('falls back to derived net issue for a run without explicit consumption', async () => {
      const { prisma, service } = makeService();
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([]);
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 40, substitutedProductId: null }] },
      ]);

      const result = await service.getRunConsumptionSummary('run1', ctxA);
      expect(result.source).toBe('DERIVED_NET_ISSUE');
      expect(result.lines[0].consumedQuantity.toString()).toBe('40');
    });
  });

  describe('recordConsumption', () => {
    it('returns the existing record for a repeated requestId (idempotency)', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialConsumption.findFirst.mockResolvedValue(consumptionRecord());
      const result = await service.recordConsumption(recordConsumptionDto(), 'u1', ctxA);
      expect(result.id).toBe('cons1');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('blocks consumption without an approved (FROZEN) snapshot', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialConsumption.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(null);
      await expect(service.recordConsumption(recordConsumptionDto(), 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('blocks a requirement line that is not in the frozen snapshot', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialConsumption.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement({ lines: [frozenLine({ id: 'rline-other' })] }));
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.product.findUnique.mockResolvedValue(product());
      await expect(
        service.recordConsumption(recordConsumptionDto({ requirementLineId: 'rline-missing' }), 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('records an explicit consumption fact within the issued availability', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialConsumption.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 100, substitutedProductId: null }] },
      ]);
      prisma.productionMaterialConsumption.create.mockResolvedValue(consumptionRecord());

      const result = await service.recordConsumption(recordConsumptionDto(), 'u1', ctxA);
      expect(result.id).toBe('cons1');
      const data = prisma.productionMaterialConsumption.create.mock.calls[0][0].data;
      expect(data.method).toBe('EXPLICIT');
      expect(data.requirementId).toBe('req1');
      expect(data.requirementLineId).toBe('rline1');
      expect(data.recordedById).toBe('u1');
    });

    it('rejects consumption that would exceed the net issued quantity', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialConsumption.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([consumptionRecord({ quantity: 80 })]);
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 100, substitutedProductId: null }] },
      ]);

      await expect(
        service.recordConsumption(recordConsumptionDto({ quantity: 30, requestId: 'req-cons-2' }), 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks a run that does not belong to the order', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialConsumption.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionRun.findFirst.mockResolvedValue(run({ productionOrderId: 'po-other' }));
      await expect(service.recordConsumption(recordConsumptionDto(), 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });
  });

  describe('correctConsumption', () => {
    it('creates an audited correction and updates the consumption quantity', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialConsumption.findFirst.mockResolvedValue(consumptionRecord());
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 100, substitutedProductId: null }] },
      ]);
      prisma.productionMaterialConsumptionCorrection.create.mockResolvedValue({ id: 'corr1' });
      prisma.productionMaterialConsumption.update.mockResolvedValue(consumptionRecord({ quantity: 40 }));

      const result = await service.correctConsumption('cons1', { newQuantity: 40, reason: 'Weighing error' }, 'u1', ctxA);

      expect(result.quantity).toBe(40);
      const correctionData = prisma.productionMaterialConsumptionCorrection.create.mock.calls[0][0].data;
      expect(correctionData.previousQuantity.toString()).toBe('50');
      expect(correctionData.newQuantity.toString()).toBe('40');
      expect(correctionData.reason).toBe('Weighing error');
      expect(correctionData.correctedById).toBe('u1');
    });

    it('rejects a correction that would push the effective consumption beyond the net issued quantity', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialConsumption.findFirst.mockResolvedValue(consumptionRecord({ quantity: 10 }));
      // Another consumption record on the same line already consumes 90 (net issued is 100).
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([
        consumptionRecord({ id: 'cons-other', quantity: 90 }),
      ]);
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 100, substitutedProductId: null }] },
      ]);

      const promise = service.correctConsumption('cons1', { newQuantity: 15, reason: 'recount' }, 'u1', ctxA);
      await expect(promise).rejects.toThrow(BadRequestException);
      expect(prisma.productionMaterialConsumptionCorrection.create).not.toHaveBeenCalled();
      expect(prisma.productionMaterialConsumption.update).not.toHaveBeenCalled();
    });

    it('allows a correction that stays within the ceiling and accounts for earlier corrections of sibling records', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialConsumption.findFirst.mockResolvedValue(consumptionRecord({ quantity: 10 }));
      // The sibling record was corrected from 100 down to 60, so its effective quantity is 60.
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([
        consumptionRecord({
          id: 'cons-other',
          quantity: 100,
          corrections: [{ id: 'corr-1', newQuantity: 60 }],
        }),
      ]);
      prisma.productionMaterialDocument.findMany.mockResolvedValue([
        { id: 'doc1', documentType: 'ISSUE', lines: [{ productId: 'prod1', quantity: 100, substitutedProductId: null }] },
      ]);
      prisma.productionMaterialConsumptionCorrection.create.mockResolvedValue({ id: 'corr1' });
      prisma.productionMaterialConsumption.update.mockResolvedValue(consumptionRecord({ quantity: 40 }));

      const result = await service.correctConsumption('cons1', { newQuantity: 40, reason: 'recount' }, 'u1', ctxA);

      expect(result.quantity).toBe(40);
      expect(prisma.productionMaterialConsumptionCorrection.create).toHaveBeenCalled();
    });

    it('rejects correcting a consumption from another company', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialConsumption.findFirst.mockResolvedValue(null);
      await expect(service.correctConsumption('cons1', { newQuantity: 40, reason: 'x' }, 'u1', ctxB)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConsumptionHistory', () => {
    it('paginates consumption records scoped to the context', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([consumptionRecord()]);
      prisma.productionMaterialConsumption.count.mockResolvedValue(1);

      const result = await service.getConsumptionHistory('po1', { page: 1, limit: 50 }, ctxA);
      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
      expect(prisma.productionMaterialConsumption.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', productionOrderId: 'po1' }) }),
      );
    });
  });

  describe('getOrderTraceability', () => {
    it('returns the frozen snapshot, posted documents and consumption records', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionMaterialConsumption.findMany.mockResolvedValue([consumptionRecord()]);

      const result = await service.getOrderTraceability('po1', ctxA);
      expect(result.snapshot!.id).toBe('req1');
      expect(result.documents).toEqual([]);
      expect(result.consumptionRecords.length).toBe(1);
    });

    it('rejects traceability access from another company', async () => {
      const { prisma, service } = makeService();
      prisma.productionOrder.findFirst.mockResolvedValue(null);
      await expect(service.getOrderTraceability('po1', ctxB)).rejects.toThrow(NotFoundException);
    });
  });
});
