import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductionMaterialDocumentsService } from './production-material-documents.service';

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
  name: 'Main',
  ...overrides,
});

const product = (overrides: Record<string, any> = {}) => ({
  id: 'prod1',
  companyId: 'c1',
  code: 'P1',
  name: 'Material',
  ...overrides,
});

const document = (overrides: Record<string, any> = {}) => ({
  id: 'doc1',
  companyId: 'c1',
  branchId: 'b1',
  documentNumber: 'PMD-000001',
  productionOrderId: 'po1',
  productionRunId: 'run1',
  documentType: 'ISSUE',
  issueWarehouseId: 'wh1',
  status: 'DRAFT',
  movementId: 'mov1',
  movementNumber: 'IM-000001',
  sourceType: 'MANUAL',
  requestId: 'req-doc-1',
  notes: null,
  documentDate: new Date('2026-03-01T09:00:00Z'),
  postedAt: null,
  cancelledAt: null,
  createdById: 'u1',
  postedById: null,
  cancelledById: null,
  lines: [{ id: 'line1', productId: 'prod1', quantity: 5, unit: 'KG', substitutedProductId: null }],
  ...overrides,
});

const frozenRequirement = (overrides: Record<string, any> = {}) => ({
  id: 'req1',
  productionOrderId: 'po1',
  status: 'FROZEN',
  lines: [
    {
      id: 'rline1',
      productId: 'prod1',
      plannedQuantity: 10,
      overIssuePolicy: 'NOT_ALLOWED',
      tolerancePercent: null,
    },
  ],
  ...overrides,
});

const baseDto = (overrides: Record<string, any> = {}) => ({
  documentType: 'ISSUE',
  productionOrderId: 'po1',
  productionRunId: 'run1',
  issueWarehouseId: 'wh1',
  requestId: 'req-doc-1',
  lines: [{ productId: 'prod1', quantity: 5, unit: 'KG' }],
  ...overrides,
});

function makeService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    productionMaterialDocument: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    productionMaterialDocumentLine: { deleteMany: jest.fn(), createMany: jest.fn(), findFirst: jest.fn() },
    inventoryMovement: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    inventoryMovementLine: { deleteMany: jest.fn(), createMany: jest.fn() },
    productionRun: { findFirst: jest.fn() },
    productionOrder: { findFirst: jest.fn() },
    productionMaterialRequirement: { findFirst: jest.fn() },
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
  const service = new ProductionMaterialDocumentsService(prisma, audit, numbering, movements);
  return { prisma, audit, numbering, movements, service };
}

describe('ProductionMaterialDocumentsService', () => {
  describe('findOne (tenant isolation)', () => {
    it('rejects access from another company or branch', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(null);
      await expect(service.findOne('doc1', ctxB)).rejects.toThrow(NotFoundException);
      expect(prisma.productionMaterialDocument.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'doc1', companyId: 'c2', branchId: 'b2' } }),
      );
    });

    it('returns the document for the owning context', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      await expect(service.findOne('doc1', ctxA)).resolves.toMatchObject({ id: 'doc1' });
    });
  });

  describe('create', () => {
    it('returns the existing document when the requestId already produced one (idempotency)', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValueOnce(document());
      const result = await service.create(baseDto(), 'u1', ctxA);
      expect(result.id).toBe('doc1');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a DRAFT document with a linked DRAFT inventory movement', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', movementNumber: 'IM-000001' });
      prisma.productionMaterialDocument.create.mockResolvedValue(document());
      prisma.productionMaterialDocument.update.mockResolvedValue(document());

      const result = await service.create(baseDto(), 'u1', ctxA);

      expect(result.id).toBe('doc1');
      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData.warehouseId).toBe('wh1');
      expect(movementData.movementType).toBe('PRODUCTION_ISSUE');
      expect(movementData.status).toBe('DRAFT');
      expect(movementData.sourceType).toBe('PRODUCTION_MATERIAL_DOCUMENT');
      expect(movementData.lines.create[0].direction).toBe('OUT');
      expect(movementData.lines.create[0].quantityBase).toBe(5);
      const docData = prisma.productionMaterialDocument.create.mock.calls[0][0].data;
      expect(docData.status).toBe('DRAFT');
      expect(docData.movementId).toBe('mov1');
      expect(docData.movementNumber).toBe('IM-000001');
    });

    it('creates an IN movement for a RETURN document', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', movementNumber: 'IM-000001' });
      prisma.productionMaterialDocument.create.mockResolvedValue(document({ documentType: 'RETURN' }));
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ documentType: 'RETURN' }));

      await service.create(baseDto({ documentType: 'RETURN' }), 'u1', ctxA);

      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData.movementType).toBe('PRODUCTION_RETURN');
      expect(movementData.lines.create[0].direction).toBe('IN');
    });

    it('rejects a substitution line without a substitute product', async () => {
      const { service } = makeService();
      await expect(
        service.create(baseDto({ documentType: 'SUBSTITUTION', lines: [{ productId: 'prod1', quantity: 1, unit: 'KG' }] }), 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a warehouse from another company', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue({ ...warehouse(), companyId: 'c9' });
      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('rejects a RETURN line whose original issue line reference is invalid', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionMaterialDocumentLine.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          baseDto({ documentType: 'RETURN', lines: [{ productId: 'prod1', quantity: 2, unit: 'KG', originalIssueLineId: 'line-issue-1' }] }),
          'u1',
          ctxA,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists a valid original issue line reference on RETURN document lines', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionMaterialDocumentLine.findFirst.mockResolvedValue({ id: 'line-issue-1', productId: 'prod1' });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', movementNumber: 'IM-000001' });
      prisma.productionMaterialDocument.create.mockResolvedValue(document({ documentType: 'RETURN' }));
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ documentType: 'RETURN' }));

      await service.create(
        baseDto({ documentType: 'RETURN', lines: [{ productId: 'prod1', quantity: 2, unit: 'KG', originalIssueLineId: 'line-issue-1' }] }),
        'u1',
        ctxA,
      );

      const docData = prisma.productionMaterialDocument.create.mock.calls[0][0].data;
      expect(docData.lines.create[0].originalIssueLineId).toBe('line-issue-1');
    });
  });

  describe('update', () => {
    it('rejects a line that references a product that does not exist', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.update('doc1', { lines: [{ productId: 'prod-missing', quantity: 3, unit: 'KG' }] }, 'u1', ctxA),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a line whose warehouse location belongs to a different warehouse', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'loc1', warehouseId: 'wh-other' });
      await expect(
        service.update('doc1', { lines: [{ productId: 'prod1', quantity: 3, unit: 'KG', warehouseLocationId: 'loc1' }] }, 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('replaces the DRAFT document and movement lines and audits the change', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.productionMaterialDocumentLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.productionMaterialDocumentLine.createMany.mockResolvedValue({ count: 1 });
      prisma.inventoryMovementLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.inventoryMovementLine.createMany.mockResolvedValue({ count: 1 });
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ notes: 'updated' }));

      const result = await service.update('doc1', { notes: 'updated', lines: [{ productId: 'prod1', quantity: 4, unit: 'KG' }] }, 'u1', ctxA);

      expect(result.notes).toBe('updated');
      expect(prisma.productionMaterialDocumentLine.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc1' } });
      expect(prisma.inventoryMovementLine.createMany).toHaveBeenCalled();
    });
  });

  describe('post', () => {
    it('posts through the shared movement transaction and marks the document POSTED', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('doc1', 'u1', ctxA);

      expect(movements.postMovementWithinTransaction).toHaveBeenCalledWith(prisma, 'mov1', 'u1', ctxA);
      expect(prisma.productionMaterialDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'POSTED', postedById: 'u1' }) }),
      );
      expect(result.status).toBe('POSTED');
    });

    it('rejects posting a non-DRAFT document', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document({ status: 'POSTED' }));
      await expect(service.post('doc1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('blocks posting an OUT document when the order has no approved (FROZEN) material snapshot', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(null);
      await expect(service.post('doc1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
      expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
    });

    it('blocks posting a line that is not in the frozen material snapshot', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(
        document({ lines: [{ id: 'line1', productId: 'prod-other', quantity: 5, unit: 'KG', substitutedProductId: null }] }),
      );
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      await expect(service.post('doc1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('blocks over-issue beyond the planned quantity under the NOT_ALLOWED policy', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(
        document({ lines: [{ id: 'line1', productId: 'prod1', quantity: 11, unit: 'KG', substitutedProductId: null }] }),
      );
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      await expect(service.post('doc1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('allows over-issue with a reason under the WITH_REASON policy', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(
        document({
          lines: [{ id: 'line1', productId: 'prod1', quantity: 12, unit: 'KG', substitutedProductId: null, notes: 'Scrap during setup' }],
        }),
      );
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(
        frozenRequirement({ lines: [{ id: 'rline1', productId: 'prod1', plannedQuantity: 10, overIssuePolicy: 'WITH_REASON', tolerancePercent: null }] }),
      );
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('doc1', 'u1', ctxA);
      expect(result.status).toBe('POSTED');
      expect(movements.postMovementWithinTransaction).toHaveBeenCalled();
    });

    it('allows over-issue within the tolerance percent under the TOLERANCE policy', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(
        document({ lines: [{ id: 'line1', productId: 'prod1', quantity: 10.5, unit: 'KG', substitutedProductId: null }] }),
      );
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(
        frozenRequirement({ lines: [{ id: 'rline1', productId: 'prod1', plannedQuantity: 10, overIssuePolicy: 'TOLERANCE', tolerancePercent: 10 }] }),
      );
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('doc1', 'u1', ctxA);
      expect(result.status).toBe('POSTED');
      expect(movements.postMovementWithinTransaction).toHaveBeenCalled();
    });

    it('blocks over-issue beyond the tolerance percent under the TOLERANCE policy', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(
        document({ lines: [{ id: 'line1', productId: 'prod1', quantity: 11.5, unit: 'KG', substitutedProductId: null }] }),
      );
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(
        frozenRequirement({ lines: [{ id: 'rline1', productId: 'prod1', plannedQuantity: 10, overIssuePolicy: 'TOLERANCE', tolerancePercent: 10 }] }),
      );
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      await expect(service.post('doc1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('allows posting a RETURN document without a frozen snapshot (returns are IN, no consumption)', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document({ documentType: 'RETURN' }));
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ documentType: 'RETURN', status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('doc1', 'u1', ctxA);
      expect(result.status).toBe('POSTED');
      expect(prisma.productionMaterialRequirement.findFirst).not.toHaveBeenCalled();
      expect(movements.postMovementWithinTransaction).toHaveBeenCalled();
    });
  });

  describe('reverse', () => {
    it('reverses an ISSUE with a DRAFT RETURN document carrying IN lines', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));
        return Promise.resolve(null); // no existing requestId
      });
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov2', movementNumber: 'IM-000002' });
      prisma.productionMaterialDocument.create.mockResolvedValue(document({ id: 'doc2', documentNumber: 'PMD-000002', documentType: 'RETURN' }));
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ id: 'doc2', documentType: 'RETURN' }));

      const result = await service.reverse('doc1', { requestId: 'req-rev-1' }, 'u1', ctxA);

      expect(result.documentType).toBe('RETURN');
      const docData = prisma.productionMaterialDocument.create.mock.calls[0][0].data;
      expect(docData.sourceType).toBe('REVERSE');
      expect(docData.lines.create[0].productId).toBe('prod1');
      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData.lines.create[0].direction).toBe('IN');
    });

    it('rejects reversing a DRAFT document', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(document({ status: 'DRAFT' }));
        return Promise.resolve(null);
      });
      await expect(service.reverse('doc1', {}, 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('cancels a DRAFT document and its DRAFT movement together', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.inventoryMovement.findUnique.mockResolvedValue({ id: 'mov1', status: 'DRAFT' });
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'CANCELLED', cancelledAt: new Date(), cancelledById: 'u1' }));

      const result = await service.cancel('doc1', { reason: 'Wrong data' }, 'u1', ctxA);

      expect(prisma.inventoryMovement.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'mov1' }, data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
      expect(result.status).toBe('CANCELLED');
    });
  });
});
