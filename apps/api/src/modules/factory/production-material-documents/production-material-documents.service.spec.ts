import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductionMaterialDocumentsService } from './production-material-documents.service';
import { PRODUCTION_MATERIAL_DOCUMENT_INCLUDE } from './production-material-documents.constants';

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
    productionMaterialDocumentLine: { deleteMany: jest.fn(), createMany: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    inventoryMovement: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    inventoryMovementLine: { deleteMany: jest.fn(), createMany: jest.fn() },
    productionRun: { findFirst: jest.fn() },
    productionOrder: { findFirst: jest.fn() },
    productionMaterialRequirement: { findFirst: jest.fn() },
    warehouse: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
    warehouseLocation: { findUnique: jest.fn() },
    userRole: { findMany: jest.fn() },
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  prisma.$queryRaw = jest.fn().mockResolvedValue([{ result: 0 }]);
  const audit: any = { log: jest.fn(), logWithClient: jest.fn() };
  const numbering: any = {
    generateNumberAtomicWithClient: jest.fn().mockResolvedValue('SEQ-000001'),
  };
  const movements: any = {
    postMovementWithinTransaction: jest.fn().mockResolvedValue({}),
    postProductionMaterialMovementWithinTransaction: jest.fn().mockResolvedValue({}),
  };
  const sourceChanges: any = { recordChange: jest.fn(), summaryForScope: jest.fn(), findByWindow: jest.fn(), findOne: jest.fn() };
  const service = new ProductionMaterialDocumentsService(prisma, audit, numbering, movements, sourceChanges);
  return { prisma, audit, numbering, movements, sourceChanges, service };
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

    it('throws a canonical conflict when the same requestId arrives with a different payload', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValueOnce(
        document({ lines: [{ id: 'line1', productId: 'prod1', quantity: 6, unit: 'KG', substitutedProductId: null }] }),
      );
      const promise = service.create(baseDto(), 'u1', ctxA);
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('productionMaterial.requestPayloadConflict');
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

  describe('create - cost purpose', () => {
    const grantOverride = (p: any) => {
      p.userRole.findMany.mockResolvedValue([
        { role: { status: 'ACTIVE', code: 'COST', permissions: [{ permission: { status: 'ACTIVE', key: 'cost-purpose:override' } }] } },
      ]);
    };

    it('rejects overriding the default PRODUCTION cost purpose without permission', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.userRole.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          baseDto({ lines: [{ productId: 'prod1', quantity: 5, unit: 'KG', costPurpose: 'QUALITY', costPurposeOverrideReason: 'qc' }] }),
          'u1',
          ctxA,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.userRole.findMany).toHaveBeenCalled();
      expect(prisma.productionMaterialDocument.create).not.toHaveBeenCalled();
    });

    it('defaults the Cost Purpose to PRODUCTION when a line specifies none', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', movementNumber: 'IM-000001' });
      prisma.productionMaterialDocument.create.mockResolvedValue(document());
      prisma.productionMaterialDocument.update.mockResolvedValue(document());

      await service.create(baseDto(), 'u1', ctxA);

      const docData = prisma.productionMaterialDocument.create.mock.calls[0][0].data;
      expect(docData.lines.create[0].costPurpose).toBe('PRODUCTION');
      expect(prisma.userRole.findMany).not.toHaveBeenCalled();
    });

    it('persists an authorized override with its reason and audits the override', async () => {
      const { prisma, service, audit } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      grantOverride(prisma);
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', movementNumber: 'IM-000001' });
      prisma.productionMaterialDocument.create.mockResolvedValue(
        document({ lines: [{ id: 'line1', lineNumber: 1, productId: 'prod1', quantity: 5, unit: 'KG', substitutedProductId: null }] }),
      );
      prisma.productionMaterialDocument.update.mockResolvedValue(
        document({ lines: [{ id: 'line1', lineNumber: 1, productId: 'prod1', quantity: 5, unit: 'KG', substitutedProductId: null }] }),
      );

      await service.create(
        baseDto({ lines: [{ productId: 'prod1', quantity: 5, unit: 'KG', costPurpose: 'PROJECT', costPurposeOverrideReason: 'external project' }] }),
        'u1',
        ctxA,
      );

      const docData = prisma.productionMaterialDocument.create.mock.calls[0][0].data;
      expect(docData.lines.create[0].costPurpose).toBe('PROJECT');
      expect(docData.lines.create[0].costPurposeOverrideReason).toBe('external project');
      expect(audit.logWithClient).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'COST_PURPOSE_OVERRIDE', entityId: 'line1', details: expect.objectContaining({ finalPurpose: 'PROJECT' }) }),
      );
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

  describe('update - cost purpose override RBAC', () => {
    it('rejects an override on an edited line without the cost-purpose:override permission', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.userRole.findMany.mockResolvedValue([]);

      await expect(
        service.update('doc1', { lines: [{ productId: 'prod1', quantity: 3, unit: 'KG', costPurpose: 'QUALITY', costPurposeOverrideReason: 'qc' }] }, 'u1', ctxA),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.productionMaterialDocumentLine.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('post', () => {
    it('posts through the shared movement transaction and marks the document POSTED', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionOrder.findFirst.mockResolvedValue(order({ productionLine: { departmentId: 'dept1' }, productionLineId: 'l1', machineId: 'm1', costCenterId: 'cc1' }));
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocumentLine.updateMany.mockResolvedValue({ count: 1 });
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('doc1', 'u1', ctxA);

      expect(movements.postProductionMaterialMovementWithinTransaction).toHaveBeenCalledWith(prisma, 'doc1', 'mov1', 'u1', ctxA);
      expect(prisma.productionMaterialDocumentLine.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentId: 'doc1' },
          data: expect.objectContaining({ productionLineId: 'l1', departmentId: 'dept1', costCenterId: 'cc1', machineId: 'm1' }),
        }),
      );
      expect(prisma.productionMaterialDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'POSTED', postedById: 'u1' }) }),
      );
      expect(result.status).toBe('POSTED');
    });

    it('retries the whole production post transaction after one transient P2034', async () => {
      const { prisma, service, movements } = makeService();
      const transient = new Prisma.PrismaClientKnownRequestError('write conflict', { code: 'P2034', clientVersion: '7.8.0' });
      prisma.$transaction.mockRejectedValueOnce(transient).mockImplementation(async (cb: any) => cb(prisma));
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionOrder.findFirst.mockResolvedValue(order({ productionLine: { departmentId: 'dept1' } }));
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'POSTED' }));

      await expect(service.post('doc1', 'u1', ctxA)).resolves.toMatchObject({ status: 'POSTED' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(movements.postProductionMaterialMovementWithinTransaction).toHaveBeenCalledTimes(1);
    });

    it('bounds P2034 retry at three complete transaction attempts', async () => {
      const { prisma, service, movements } = makeService();
      const transient = new Prisma.PrismaClientKnownRequestError('write conflict', { code: 'P2034', clientVersion: '7.8.0' });
      prisma.$transaction.mockRejectedValue(transient);

      await expect(service.post('doc1', 'u1', ctxA)).rejects.toMatchObject({ code: 'P2034' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
      expect(movements.postProductionMaterialMovementWithinTransaction).not.toHaveBeenCalled();
    });

    it('writes the authoritative attribution snapshot (machine NULL when the parent order has none) at posting time', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionOrder.findFirst.mockResolvedValue(order({ productionLine: { departmentId: 'dept1' }, productionLineId: null, machineId: null, costCenterId: 'cc1' }));
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      await service.post('doc1', 'u1', ctxA);

      expect(movements.postProductionMaterialMovementWithinTransaction).toHaveBeenCalled();
      expect(prisma.productionMaterialDocumentLine.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentId: 'doc1' },
          data: expect.objectContaining({ productionLineId: null, departmentId: 'dept1', costCenterId: 'cc1', machineId: null }),
        }),
      );
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
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('doc1', 'u1', ctxA);
      expect(result.status).toBe('POSTED');
      expect(movements.postProductionMaterialMovementWithinTransaction).toHaveBeenCalled();
    });

    it('allows over-issue within the tolerance percent under the TOLERANCE policy', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(
        document({ lines: [{ id: 'line1', productId: 'prod1', quantity: 10.5, unit: 'KG', substitutedProductId: null }] }),
      );
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(
        frozenRequirement({ lines: [{ id: 'rline1', productId: 'prod1', plannedQuantity: 10, overIssuePolicy: 'TOLERANCE', tolerancePercent: 10 }] }),
      );
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('doc1', 'u1', ctxA);
      expect(result.status).toBe('POSTED');
      expect(movements.postProductionMaterialMovementWithinTransaction).toHaveBeenCalled();
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
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ documentType: 'RETURN', status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      const result = await service.post('doc1', 'u1', ctxA);
      expect(result.status).toBe('POSTED');
      expect(prisma.productionMaterialRequirement.findFirst).not.toHaveBeenCalled();
      expect(movements.postProductionMaterialMovementWithinTransaction).toHaveBeenCalled();
    });

    it('R2: a REVERSE return inherits the ORIGINAL posted line attribution (Line A), not current master data (Line B)', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(
        document({
          documentType: 'RETURN',
          sourceType: 'REVERSE',
          reversesDocumentId: 'issue1',
          status: 'DRAFT',
          lines: [
            {
              id: 'retline1',
              originalIssueLineId: 'origline1',
              productId: 'prod1',
              quantity: 5,
              unit: 'KG',
              substitutedProductId: null,
              costPurpose: 'PRODUCTION',
            },
          ],
        }),
      );
      // The current parent order has been reassigned to Line B since the
      // original issue was posted - the return must NOT pick up B.
      prisma.productionOrder.findFirst.mockResolvedValue(
        order({ productionLineId: 'lineB', productionLine: { departmentId: 'deptB' }, machineId: 'machineB', costCenterId: 'ccB' }),
      );
      // The original POSTED issue line carries the authoritative Line A snapshot.
      prisma.productionMaterialDocumentLine.findMany.mockResolvedValue([
        { id: 'origline1', productionLineId: 'lineA', departmentId: 'deptA', costCenterId: 'ccA', machineId: 'machineA' },
      ]);
      prisma.productionMaterialDocumentLine.update.mockResolvedValue({});
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ documentType: 'RETURN', sourceType: 'REVERSE', status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      await service.post('doc1', 'u1', ctxA);

      expect(prisma.productionOrder.findFirst).not.toHaveBeenCalled();
      expect(prisma.productionMaterialDocumentLine.update).toHaveBeenCalledWith({
        where: { id: 'retline1' },
        data: { productionLineId: 'lineA', departmentId: 'deptA', costCenterId: 'ccA', machineId: 'machineA' },
      });
      expect(movements.postProductionMaterialMovementWithinTransaction).toHaveBeenCalled();
    });

    it('R2: a non-REVERSE RETURN keeps parent-order snapshot resolution (no original reference to inherit)', async () => {
      const { prisma, service, movements } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(
        document({ documentType: 'RETURN', lines: [{ id: 'retline1', originalIssueLineId: null, productId: 'prod1', quantity: 5, unit: 'KG', substitutedProductId: null }] }),
      );
      prisma.productionOrder.findFirst.mockResolvedValue(
        order({ productionLineId: 'lineB', productionLine: { departmentId: 'deptB' }, machineId: 'machineB', costCenterId: 'ccB' }),
      );
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ documentType: 'RETURN', status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));

      await service.post('doc1', 'u1', ctxA);

      expect(prisma.productionOrder.findFirst).toHaveBeenCalled();
      expect(prisma.productionMaterialDocumentLine.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { documentId: 'doc1' },
          data: expect.objectContaining({ productionLineId: 'lineB', departmentId: 'deptB', costCenterId: 'ccB', machineId: 'machineB' }),
        }),
      );
      expect(movements.postProductionMaterialMovementWithinTransaction).toHaveBeenCalled();
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

    it('carries the source line Cost Purpose onto reversal lines (inheritance, no override re-check)', async () => {
      const { prisma, service, audit } = makeService();
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(
          document({
            status: 'POSTED', postedAt: new Date(), postedById: 'u1',
            lines: [{ id: 'line1', productId: 'prod1', quantity: 5, unit: 'KG', substitutedProductId: null, costPurpose: 'PROJECT', costPurposeOverrideReason: 'external project' }],
          }),
        );
        return Promise.resolve(null);
      });
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov2', movementNumber: 'IM-000002' });
      prisma.productionMaterialDocument.create.mockResolvedValue(document({ id: 'doc2', documentNumber: 'PMD-000002', documentType: 'RETURN' }));
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ id: 'doc2', documentType: 'RETURN' }));

      await service.reverse('doc1', { requestId: 'req-rev-inherit' }, 'u1', ctxA);

      const docData = prisma.productionMaterialDocument.create.mock.calls[0][0].data;
      expect(docData.lines.create[0].costPurpose).toBe('PROJECT');
      expect(docData.lines.create[0].costPurposeOverrideReason).toBe('external project');
      expect(prisma.userRole.findMany).not.toHaveBeenCalled();
    });

    it('rejects reversing a DRAFT document', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(document({ status: 'DRAFT' }));
        return Promise.resolve(null);
      });
      await expect(service.reverse('doc1', {}, 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('rejects reversing a reversal document itself', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(document({ status: 'POSTED', sourceType: 'REVERSE', reversesDocumentId: 'doc0' }));
        return Promise.resolve(null);
      });
      const promise = service.reverse('doc1', { requestId: 'req-rev-2' }, 'u1', ctxA);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('productionMaterial.cannotReverseReversal');
    });

    it('blocks a second reversal of the same source even with a different requestId (double reversal prevention)', async () => {
      const { prisma, service } = makeService();
      const source = document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' });
      const existingReversal = document({
        id: 'doc2', documentNumber: 'PMD-000002', documentType: 'RETURN', status: 'DRAFT',
        reversesDocumentId: 'doc1', requestId: 'req-rev-1',
        lines: [{ id: 'l2', productId: 'prod1', quantity: 5, unit: 'KG', substitutedProductId: null }],
      });
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(source);
        if (where.reversesDocumentId) return Promise.resolve(existingReversal);
        return Promise.resolve(null);
      });
      const promise = service.reverse('doc1', { requestId: 'req-rev-OTHER' }, 'u1', ctxA);
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('productionMaterial.alreadyReversed');
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.productionMaterialDocument.create).not.toHaveBeenCalled();
    });

    it('is idempotent: reusing the same reversal requestId returns the committed reversal', async () => {
      const { prisma, service } = makeService();
      const source = document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' });
      const committed = document({
        id: 'doc2', documentNumber: 'PMD-000002', documentType: 'RETURN', status: 'DRAFT',
        reversesDocumentId: 'doc1', requestId: 'req-rev-1',
        lines: [{ id: 'l2', productId: 'prod1', quantity: 5, unit: 'KG', substitutedProductId: null }],
      });
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(source);
        if (where.reversesDocumentId) return Promise.resolve(committed);
        return Promise.resolve(null);
      });
      const result = await service.reverse('doc1', { requestId: 'req-rev-1' }, 'u1', ctxA);
      expect(result.id).toBe('doc2');
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.productionMaterialDocument.create).not.toHaveBeenCalled();
    });

    it('throws a canonical conflict when the same reversal requestId arrives with different notes', async () => {
      const { prisma, service } = makeService();
      const source = document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' });
      const committed = document({
        id: 'doc2', documentNumber: 'PMD-000002', documentType: 'RETURN', status: 'DRAFT',
        reversesDocumentId: 'doc1', requestId: 'req-rev-1', notes: 'Original note',
        lines: [{ id: 'l2', productId: 'prod1', quantity: 5, unit: 'KG', substitutedProductId: null }],
      });
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(source);
        if (where.reversesDocumentId) return Promise.resolve(committed);
        return Promise.resolve(null);
      });
      const promise = service.reverse('doc1', { requestId: 'req-rev-1', notes: 'A different note' }, 'u1', ctxA);
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('productionMaterial.requestPayloadConflict');
    });

    it('revalidates warehouse tenant scope when reversing', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));
        return Promise.resolve(null);
      });
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ companyId: 'c2' }));
      const promise = service.reverse('doc1', { requestId: 'req-rev-3' }, 'u1', ctxA);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('productionMaterial.warehouseTenantMismatch');
      expect(prisma.productionMaterialDocument.create).not.toHaveBeenCalled();
    });

    it('writes a REVERSE audit, creates a new compensating movement, and never mutates the source document', async () => {
      const { prisma, service, audit } = makeService();
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));
        return Promise.resolve(null);
      });
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov2', movementNumber: 'IM-000002' });
      prisma.productionMaterialDocument.create.mockResolvedValue(document({ id: 'doc2', documentNumber: 'PMD-000002', documentType: 'RETURN' }));
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ id: 'doc2', documentType: 'RETURN' }));

      await service.reverse('doc1', { requestId: 'req-rev-4' }, 'u1', ctxA);

      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData.lines.create[0].direction).toBe('IN');
      expect(movementData.sourceType).toBe('PRODUCTION_MATERIAL_DOCUMENT');
      const docData = prisma.productionMaterialDocument.create.mock.calls[0][0].data;
      expect(docData.sourceType).toBe('REVERSE');
      expect(docData.reversesDocumentId).toBe('doc1');
      expect(docData.requestId).toBe('req-rev-4');
      expect(audit.logWithClient).toHaveBeenCalledTimes(1);
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ userId: 'u1', action: 'REVERSE', entityId: 'doc2' }),
      );
      const sourceUpdates = prisma.productionMaterialDocument.update.mock.calls.filter(([args]: any[]) => args?.where?.id === 'doc1');
      expect(sourceUpdates).toHaveLength(0);
    });

    it('resolves a P2002 race on the reversal by returning the concurrently committed reversal', async () => {
      const { prisma, service, audit } = makeService();
      const source = document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' });
      const raced = document({
        id: 'doc2', documentNumber: 'PMD-000002', documentType: 'RETURN', status: 'DRAFT',
        reversesDocumentId: 'doc1', requestId: 'req-rev-5',
        lines: [{ id: 'l2', productId: 'prod1', quantity: 5, unit: 'KG', substitutedProductId: null }],
      });
      prisma.productionMaterialDocument.findFirst.mockImplementation(({ where }: any) => {
        if (where.id) return Promise.resolve(source);
        if (where.reversesDocumentId) return Promise.resolve(null);
        if (where.requestId) return Promise.resolve(raced);
        return Promise.resolve(null);
      });
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov2', movementNumber: 'IM-000002' });
      prisma.productionMaterialDocument.create.mockRejectedValue({ code: 'P2002' });

      const result = await service.reverse('doc1', { requestId: 'req-rev-5' }, 'u1', ctxA);
      expect(result.id).toBe('doc2');
      expect(audit.logWithClient).toHaveBeenCalledTimes(0);
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

  describe('material document include contract (phantom actor relations)', () => {
    it('does not contain the phantom createdBy relation (schema has createdById scalar only)', () => {
      expect(PRODUCTION_MATERIAL_DOCUMENT_INCLUDE).not.toHaveProperty('createdBy');
    });

    it('does not contain the phantom postedBy relation (schema has postedById scalar only)', () => {
      expect(PRODUCTION_MATERIAL_DOCUMENT_INCLUDE).not.toHaveProperty('postedBy');
    });

    it('does not contain the phantom cancelledBy relation (schema has cancelledById scalar only)', () => {
      expect(PRODUCTION_MATERIAL_DOCUMENT_INCLUDE).not.toHaveProperty('cancelledBy');
    });

    it('keeps every legitimate document relation in the include', () => {
      expect(PRODUCTION_MATERIAL_DOCUMENT_INCLUDE).toHaveProperty('productionOrder');
      expect(PRODUCTION_MATERIAL_DOCUMENT_INCLUDE).toHaveProperty('productionRun');
      expect(PRODUCTION_MATERIAL_DOCUMENT_INCLUDE).toHaveProperty('issueWarehouse');
      expect(PRODUCTION_MATERIAL_DOCUMENT_INCLUDE).toHaveProperty('movement');
      expect(PRODUCTION_MATERIAL_DOCUMENT_INCLUDE).toHaveProperty('lines');
      const linesInclude = (PRODUCTION_MATERIAL_DOCUMENT_INCLUDE.lines as any).include;
      expect(linesInclude).toHaveProperty('product');
      expect(linesInclude).toHaveProperty('substitutedProduct');
      expect(linesInclude).toHaveProperty('warehouseLocation');
    });

    it('retains the scalar actor identifier fields on the document record', () => {
      const row = document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1', cancelledById: null });
      expect(row.createdById).toBe('u1');
      expect(row.postedById).toBe('u1');
      expect(row.cancelledById).toBeNull();
    });

    it('findOne sends the corrected include (no phantom actor relations)', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      await service.findOne('doc1', ctxA);
      const arg = prisma.productionMaterialDocument.findFirst.mock.calls[0][0];
      expect(arg.include).toBe(PRODUCTION_MATERIAL_DOCUMENT_INCLUDE);
      expect(arg.include).not.toHaveProperty('createdBy');
      expect(arg.include).not.toHaveProperty('postedBy');
      expect(arg.include).not.toHaveProperty('cancelledBy');
    });

    it('findAll sends the corrected include to the list query', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.count.mockResolvedValue(0);
      await service.findAll({}, ctxA);
      const arg = prisma.productionMaterialDocument.findMany.mock.calls[0][0];
      expect(arg.include).toBe(PRODUCTION_MATERIAL_DOCUMENT_INCLUDE);
      expect(arg.include).not.toHaveProperty('createdBy');
      expect(arg.include).not.toHaveProperty('postedBy');
      expect(arg.include).not.toHaveProperty('cancelledBy');
    });

    it('create stores the scalar createdById actor on the document', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(run());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue(product());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', movementNumber: 'IM-000001' });
      prisma.productionMaterialDocument.create.mockResolvedValue(document());
      prisma.productionMaterialDocument.update.mockResolvedValue(document());
      await service.create(baseDto(), 'u1', ctxA);
      const docData = prisma.productionMaterialDocument.create.mock.calls[0][0].data;
      expect(docData.createdById).toBe('u1');
    });

    it('posting continues to set the scalar postedById actor on the document', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.productionMaterialRequirement.findFirst.mockResolvedValue(frozenRequirement());
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionMaterialDocument.findMany.mockResolvedValue([]);
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'POSTED', postedAt: new Date(), postedById: 'u1' }));
      await service.post('doc1', 'u1', ctxA);
      expect(prisma.productionMaterialDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'POSTED', postedById: 'u1' }) }),
      );
    });

    it('cancelling continues to set the scalar cancelledById actor on the document', async () => {
      const { prisma, service } = makeService();
      prisma.productionMaterialDocument.findFirst.mockResolvedValue(document());
      prisma.inventoryMovement.findUnique.mockResolvedValue({ id: 'mov1', status: 'DRAFT' });
      prisma.productionMaterialDocument.update.mockResolvedValue(document({ status: 'CANCELLED', cancelledAt: new Date(), cancelledById: 'u1' }));
      await service.cancel('doc1', { reason: 'Wrong data' }, 'u1', ctxA);
      expect(prisma.productionMaterialDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED', cancelledById: 'u1' }) }),
      );
    });
  });
});
