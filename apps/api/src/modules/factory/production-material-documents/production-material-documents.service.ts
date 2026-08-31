import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { InventoryMovementsService } from '../inventory-movements/inventory-movements.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import { OperationalSourceChangesService } from '../operational-source-changes/operational-source-changes.service';
import {
  PRODUCTION_MATERIAL_DOCUMENT_AUDIT_ENTITY,
  PRODUCTION_MATERIAL_DOCUMENT_INCLUDE,
} from './production-material-documents.constants';
import {
  isProductionMaterialDocumentType,
  materialDocumentDirection,
  materialDocumentRequiresWarehouse,
  materialMovementType,
  materialReverseType,
} from './material-document-domain.util';
import { isWithinTolerance } from '../production-material-requirements/production-material-requirements.domain.util';
import { PRODUCTION_COST_PURPOSE, isCostPurpose } from '../../../common/cost-purpose/cost-purpose.constants';
import { assertCostPurposeOverrideAllowed } from '../../../common/cost-purpose/cost-purpose-permission';
import {
  CancelMaterialDocumentDto,
  CreateMaterialDocumentDto,
  CreateMaterialDocumentLineDto,
  MaterialDocumentQueryDto,
  ReverseMaterialDocumentDto,
  UpdateMaterialDocumentDto,
} from './dto/production-material-document.dto';

const MATERIAL_SOURCE_TYPE = 'PRODUCTION_MATERIAL_DOCUMENT';

@Injectable()
export class ProductionMaterialDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberingService: NumberingService,
    private readonly movementsService: InventoryMovementsService,
    private readonly sourceChangesService: OperationalSourceChangesService,
  ) {}

  private notFound(key: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message: key });
  }

  private badRequest(key: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message: key });
  }

  private conflict(key: string): ConflictException {
    return new ConflictException({ messageKey: key, message: key });
  }

  private writeAudit(client: any, userId: string, action: string, entityId: string, ctx: ActiveOperationalContext, details: Record<string, any>) {
    return this.audit.logWithClient(client, {
      userId,
      action,
      entity: PRODUCTION_MATERIAL_DOCUMENT_AUDIT_ENTITY,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }

  private async findDocument(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const doc = await client.productionMaterialDocument.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: PRODUCTION_MATERIAL_DOCUMENT_INCLUDE,
    });
    if (!doc) throw this.notFound('productionMaterial.notFound');
    return doc;
  }

  private async findDocumentByRequestId(requestId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.productionMaterialDocument.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId },
      include: PRODUCTION_MATERIAL_DOCUMENT_INCLUDE,
    });
  }

  /**
   * Canonical fingerprint of an incoming create payload. Only business-relevant
   * fields participate so a retry of the same submission is stable.
   */
  private fingerprintCreatePayload(dto: CreateMaterialDocumentDto): string {
    const lines = dto.lines
      .map((l) =>
        [
          l.productId,
          l.substitutedProductId ?? '',
          new Prisma.Decimal(l.quantity).toFixed(4),
          l.unit ?? '',
          l.warehouseLocationId ?? '',
          l.batchNumber ?? '',
          l.serialNumber ?? '',
          l.substitutionReason ?? '',
          l.originalIssueLineId ?? '',
          l.costPurpose ?? '',
          l.costPurposeOverrideReason ?? '',
        ].join(':'),
      )
      .sort()
      .join('~');
    return [dto.documentType, dto.productionOrderId, dto.productionRunId, dto.issueWarehouseId ?? '', lines].join('|');
  }

  private fingerprintStoredDocument(doc: any): string {
    const lines = doc.lines
      .map((l: any) =>
        [
          l.productId,
          l.substitutedProductId ?? '',
          new Prisma.Decimal(l.quantity).toFixed(4),
          l.unit ?? '',
          l.warehouseLocationId ?? '',
          l.batchNumber ?? '',
          l.serialNumber ?? '',
          l.substitutionReason ?? '',
          l.originalIssueLineId ?? '',
          l.costPurpose ?? '',
          l.costPurposeOverrideReason ?? '',
        ].join(':'),
      )
      .sort()
      .join('~');
    return [doc.documentType, doc.productionOrderId, doc.productionRunId, doc.issueWarehouseId ?? '', lines].join('|');
  }

  private resolveIdempotentCreate(existing: any, dto: CreateMaterialDocumentDto) {
    if (this.fingerprintStoredDocument(existing) !== this.fingerprintCreatePayload(dto)) {
      throw this.conflict('productionMaterial.requestPayloadConflict');
    }
    return existing;
  }

  /** Canonical fingerprint of a reversal derived from the POSTED source document. */
  private fingerprintReversePayload(source: any, dto: ReverseMaterialDocumentDto): string {
    const reverseType = materialReverseType(source.documentType as any);
    const lines = source.lines
      .map((line: any) => {
        const productId = reverseType === 'SUBSTITUTION' && line.substitutedProductId ? line.substitutedProductId : line.productId;
        const substitutedProductId = reverseType === 'SUBSTITUTION' && line.substitutedProductId ? line.productId : null;
        return [
          productId,
          substitutedProductId ?? '',
          new Prisma.Decimal(line.quantity).toFixed(4),
          line.unit ?? '',
          line.warehouseLocationId ?? '',
          line.batchNumber ?? '',
          line.serialNumber ?? '',
          line.costPurpose ?? '',
          line.costPurposeOverrideReason ?? '',
        ].join(':');
      })
      .sort()
      .join('~');
    return [source.id, reverseType, lines].join('|');
  }

  private fingerprintStoredReversal(doc: any): string {
    const lines = doc.lines
      .map((l: any) =>
        [
          l.productId,
          l.substitutedProductId ?? '',
          new Prisma.Decimal(l.quantity).toFixed(4),
          l.unit ?? '',
          l.warehouseLocationId ?? '',
          l.batchNumber ?? '',
          l.serialNumber ?? '',
          l.costPurpose ?? '',
          l.costPurposeOverrideReason ?? '',
        ].join(':'),
      )
      .sort()
      .join('~');
    return [doc.reversesDocumentId ?? '', doc.documentType, lines].join('|');
  }

  private resolveIdempotentReverse(existing: any, source: any, dto: ReverseMaterialDocumentDto) {
    const sameFingerprint = this.fingerprintStoredReversal(existing) === this.fingerprintReversePayload(source, dto);
    const sameNotes = !dto.notes || existing.notes === dto.notes;
    const sameDate = !dto.documentDate || existing.documentDate.toISOString() === new Date(dto.documentDate).toISOString();
    if (!sameFingerprint || !sameNotes || !sameDate) {
      throw this.conflict('productionMaterial.requestPayloadConflict');
    }
    return existing;
  }

  /** Resolves the run + order context, the issue warehouse, and all line products in one place. */
  private async resolveContext(dto: CreateMaterialDocumentDto, ctx: ActiveOperationalContext, client: any) {
    if (!isProductionMaterialDocumentType(dto.documentType)) throw this.badRequest('productionMaterial.invalidType');

    const run = await client.productionRun.findFirst({
      where: { id: dto.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) throw this.notFound('productionMaterial.runNotFound');

    const order = await client.productionOrder.findFirst({
      where: { id: dto.productionOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!order) throw this.notFound('productionMaterial.orderNotFound');
    if (run.productionOrderId !== order.id) throw this.badRequest('productionMaterial.orderContextMismatch');

    let warehouse: any = null;
    if (dto.issueWarehouseId) {
      warehouse = await client.warehouse.findUnique({ where: { id: dto.issueWarehouseId } });
      if (!warehouse) throw this.notFound('productionMaterial.warehouseNotFound');
      if (warehouse.companyId !== ctx.companyId) throw this.badRequest('productionMaterial.warehouseTenantMismatch');
      if (warehouse.branchId && warehouse.branchId !== ctx.branchId) throw this.badRequest('productionMaterial.warehouseBranchMismatch');
    } else if (materialDocumentRequiresWarehouse(dto.documentType as any)) {
      throw this.badRequest('productionMaterial.warehouseRequired');
    }

    const products = new Map<string, any>();
    for (const line of dto.lines) {
      const product = await client.product.findUnique({ where: { id: line.productId } });
      if (!product) throw this.notFound('productionMaterial.productNotFound');
      if (product.companyId && product.companyId !== ctx.companyId) throw this.badRequest('productionMaterial.productTenantMismatch');
      products.set(line.productId, product);
      if (line.substitutedProductId) {
        const substitute = await client.product.findUnique({ where: { id: line.substitutedProductId } });
        if (!substitute) throw this.notFound('productionMaterial.substituteProductNotFound');
        if (substitute.companyId && substitute.companyId !== ctx.companyId) throw this.badRequest('productionMaterial.productTenantMismatch');
        products.set(line.substitutedProductId, substitute);
      }
      if (line.warehouseLocationId) {
        const location = await client.warehouseLocation.findUnique({ where: { id: line.warehouseLocationId } });
        if (!location) throw this.notFound('productionMaterial.locationNotFound');
        if (warehouse && location.warehouseId !== warehouse.id) throw this.badRequest('productionMaterial.locationWarehouseMismatch');
      }
    }

    return { run, order, warehouse, products };
  }

  /**
   * Resolves the canonical line-level Cost Purpose for an incoming OUT-side set
   * of lines. Default is PRODUCTION. Any line requesting a non-default purpose
   * is an override: it requires the canonical cost-purpose:override permission
   * and a mandatory reason. Returns the resolved overrides (for audit) and throws
   * before any persistence when a line is invalid/unauthorized.
   */
  private async resolveLineCostPurposes(
    client: any,
    userId: string,
    lines: CreateMaterialDocumentLineDto[],
  ): Promise<Array<{ lineNumber: number; productId: string; sourceDefaultPurpose: string; finalPurpose: string; overrideReason: string }>> {
    const overrides: Array<{ lineNumber: number; productId: string; sourceDefaultPurpose: string; finalPurpose: string; overrideReason: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.costPurpose == null) continue;
      if (!isCostPurpose(line.costPurpose)) throw this.badRequest('productionMaterial.costPurposeInvalid');
      if (line.costPurpose !== PRODUCTION_COST_PURPOSE) {
        overrides.push({
          lineNumber: i + 1,
          productId: line.productId,
          sourceDefaultPurpose: PRODUCTION_COST_PURPOSE,
          finalPurpose: line.costPurpose,
          overrideReason: line.costPurposeOverrideReason ?? '',
        });
      }
    }
    if (overrides.length > 0) {
      await assertCostPurposeOverrideAllowed(client, userId);
      for (const o of overrides) {
        if (!o.overrideReason) throw this.badRequest('productionMaterial.costPurposeOverrideReasonRequired');
      }
    }
    return overrides;
  }

  /**
   * Resolves the authoritative historical attribution snapshot from the parent
   * ProductionOrder context (productionLineId, departmentId, costCenterId,
   * machineId). machineId is only copied when a reliable parent Machine exists;
   * otherwise NULL — never inferred/fabricated. Used at POST time and never
   * rewritten afterwards.
   */
  private async resolveProductionSnapshot(client: any, orderId: string, ctx: ActiveOperationalContext) {
    const order = await client.productionOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      include: { productionLine: { select: { departmentId: true } } },
    });
    if (!order) throw this.notFound('productionMaterial.orderNotFound');
    return {
      productionLineId: order.productionLineId,
      departmentId: order.productionLine?.departmentId ?? null,
      costCenterId: order.costCenterId,
      machineId: order.machineId ?? null,
    };
  }

  private auditPurposeOverrides(
    client: any,
    userId: string,
    doc: any,
    overrides: Array<{ lineNumber: number; productId: string; sourceDefaultPurpose: string; finalPurpose: string; overrideReason: string }>,
    ctx: ActiveOperationalContext,
  ) {
    const linesByNumber = new Map<number, any>(doc.lines.map((l: any) => [l.lineNumber, l]));
    for (const o of overrides) {
      const line = linesByNumber.get(o.lineNumber);
      if (!line) continue;
      this.audit.logWithClient(client, {
        userId,
        action: 'COST_PURPOSE_OVERRIDE',
        entity: 'ProductionMaterialDocumentLine',
        entityId: line.id,
        details: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          sourceDefaultPurpose: o.sourceDefaultPurpose,
          finalPurpose: o.finalPurpose,
          overrideReason: o.overrideReason,
          sourceDocument: 'PRODUCTION_MATERIAL_DOCUMENT',
          sourceDocumentId: doc.id,
          documentNumber: doc.documentNumber,
          productId: o.productId,
          lineNumber: o.lineNumber,
          productionOrderId: doc.productionOrderId,
          productionRunId: doc.productionRunId,
        },
      });
    }
  }

  private documentLinesToMovementLines(documentType: string, dtoLines: CreateMaterialDocumentLineDto[]) {
    const movementLines: Array<{
      productId: string;
      warehouseLocationId: string | null;
      quantity: number;
      quantityBase: number;
      batchNumber: string | null;
      serialNumber: string | null;
      expiryDate: Date | null;
      unit: string | null;
      direction: string;
      notes: string | null;
    }> = [];
    for (const line of dtoLines) {
      const direction = materialDocumentDirection(documentType as any);
      movementLines.push({
        productId: line.productId,
        warehouseLocationId: line.warehouseLocationId ?? null,
        quantity: line.quantity,
        quantityBase: line.quantity,
        batchNumber: line.batchNumber ?? null,
        serialNumber: line.serialNumber ?? null,
        expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
        unit: line.unit,
        direction,
        notes: line.notes ?? null,
      });
      if (documentType === 'SUBSTITUTION' && line.substitutedProductId) {
        movementLines.push({
          productId: line.substitutedProductId,
          warehouseLocationId: line.warehouseLocationId ?? null,
          quantity: line.quantity,
          quantityBase: line.quantity,
          batchNumber: line.batchNumber ?? null,
          serialNumber: line.serialNumber ?? null,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
          unit: line.unit,
          direction: 'IN',
          notes: `Substitutes ${line.substitutedProductId} for ${line.productId}`,
        });
      }
    }
    return movementLines;
  }

  /**
   * Validates optional return-to-issue references. A RETURN line may reference
   * the original POSTED ISSUE line (same order, product, company, branch) so
   * returns are traceable back to the exact issue they offset. Any other
   * reference is rejected; references are never silently fabricated.
   */
  private async validateReturnReferences(client: any, ctx: ActiveOperationalContext, lines: CreateMaterialDocumentLineDto[], orderId: string) {
    for (const line of lines) {
      if (!line.originalIssueLineId) continue;
      const original = await client.productionMaterialDocumentLine.findFirst({
        where: {
          id: line.originalIssueLineId,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          productId: line.productId,
          document: { productionOrderId: orderId, status: 'POSTED' },
        },
      });
      if (!original) throw this.badRequest('productionMaterial.originalIssueLineInvalid');
    }
  }

  /**
   * Snapshot gate for OUT documents (ISSUE / CONSUMPTION / SUBSTITUTION). Posting
   * inventory requires an approved (FROZEN) material snapshot: without one the
   * canonical readiness error is raised. Every line must belong to the frozen
   * snapshot and the cumulative net issued quantity (this document included) must
   * respect the line over-issue policy: NOT_ALLOWED blocks any excess, WITH_REASON
   * requires an explicit reason, TOLERANCE allows up to planned + tolerance.
   */
  private async validateSnapshotForPosting(client: any, doc: any, ctx: ActiveOperationalContext) {
    if (materialDocumentDirection(doc.documentType as any) !== 'OUT') return;

    const frozen = await client.productionMaterialRequirement.findFirst({
      where: {
        productionOrderId: doc.productionOrderId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'FROZEN',
      },
      include: { lines: true },
    });
    if (!frozen) throw this.badRequest('productionMaterialRequirement.missingFrozenSnapshot');

    const plannedByProduct = new Map<string, any>(frozen.lines.map((l: any) => [l.productId, l]));
    const net = new Map<string, Prisma.Decimal>();
    const addNet = (productId: string, qty: Prisma.Decimal.Value, sign: 1 | -1) => {
      const delta = new Prisma.Decimal(qty).mul(sign);
      net.set(productId, (net.get(productId) ?? new Prisma.Decimal(0)).plus(delta));
    };

    const docs = await client.productionMaterialDocument.findMany({
      where: {
        productionOrderId: doc.productionOrderId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'POSTED',
        id: { not: doc.id },
      },
      select: {
        documentType: true,
        lines: { select: { productId: true, quantity: true, substitutedProductId: true } },
      },
    });
    for (const d of docs) {
      const isOut = materialDocumentDirection(d.documentType) === 'OUT';
      for (const line of d.lines) {
        addNet(line.productId, line.quantity, isOut ? 1 : -1);
        if (d.documentType === 'SUBSTITUTION' && line.substitutedProductId) addNet(line.substitutedProductId, line.quantity, -1);
      }
    }

    for (const line of doc.lines) {
      if (doc.documentType === 'SUBSTITUTION' && line.substitutedProductId) {
        if (!plannedByProduct.has(line.productId)) throw this.badRequest('productionMaterialRequirement.lineNotInFrozenSnapshot');
        continue;
      }
      const reqLine = plannedByProduct.get(line.productId);
      if (!reqLine) throw this.badRequest('productionMaterialRequirement.lineNotInFrozenSnapshot');
      const total = (net.get(line.productId) ?? new Prisma.Decimal(0)).plus(new Prisma.Decimal(line.quantity));
      const planned = new Prisma.Decimal(reqLine.plannedQuantity);
      if (total.lessThanOrEqualTo(planned)) continue;
      if (reqLine.overIssuePolicy === 'NOT_ALLOWED') throw this.badRequest('productionMaterialRequirement.overIssueNotAllowed');
      if (reqLine.overIssuePolicy === 'WITH_REASON' && !(line.substitutionReason || line.notes || doc.notes)) {
        throw this.badRequest('productionMaterialRequirement.overIssueReasonRequired');
      }
      if (reqLine.overIssuePolicy === 'TOLERANCE' && !isWithinTolerance(total, planned, reqLine.tolerancePercent)) {
        throw this.badRequest('productionMaterialRequirement.overIssueBeyondTolerance');
      }
    }
  }

  private async createDocumentWithMovement(
    client: any,
    ctx: ActiveOperationalContext,
    userId: string,
    documentType: string,
    run: any,
    order: any,
    warehouse: any,
    dto: CreateMaterialDocumentDto | { documentDate?: string; notes?: string; lines: CreateMaterialDocumentLineDto[]; requestId?: string },
    sourceDocId: string | null,
    sourceDocNumber: string | null,
    reversesDocumentId: string | null = null,
  ) {
    const documentNumber = await this.numberingService.generateNumberAtomicWithClient('PRODUCTION_MATERIAL_DOCUMENT', client);
    const movementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', client);
    const documentDate = dto.documentDate ? new Date(dto.documentDate) : new Date();

    if (!warehouse) throw this.badRequest('productionMaterial.warehouseRequired');

    const movementLines = this.documentLinesToMovementLines(documentType, dto.lines);
    const movement = await client.inventoryMovement.create({
      data: {
        movementNumber,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        warehouseId: warehouse.id,
        movementType: materialMovementType(documentType as any),
        status: 'DRAFT',
        sourceType: MATERIAL_SOURCE_TYPE,
        sourceId: sourceDocId,
        movementDate: documentDate,
        notes: dto.notes ?? null,
        createdById: userId,
        lines: { create: movementLines },
      },
    });

    const doc = await client.productionMaterialDocument.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        documentNumber,
        productionOrderId: order.id,
        productionRunId: run.id,
        documentType,
        issueWarehouseId: warehouse?.id ?? null,
        status: 'DRAFT',
        movementId: movement.id,
        movementNumber: movement.movementNumber,
        sourceType: sourceDocId ? 'REVERSE' : 'MANUAL',
        requestId: dto.requestId ?? null,
        reversesDocumentId,
        notes: dto.notes ?? null,
        documentDate,
        createdById: userId,
        lines: {
          create: dto.lines.map((line, index) => ({
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            productId: line.productId,
            productCodeSnapshot: '',
            productNameSnapshot: '',
            unit: line.unit,
            quantity: new Prisma.Decimal(line.quantity.toFixed(4)),
            substitutedProductId: line.substitutedProductId ?? null,
            substitutionReason: line.substitutionReason ?? null,
            originalIssueLineId: line.originalIssueLineId ?? null,
            warehouseLocationId: line.warehouseLocationId ?? null,
            batchNumber: line.batchNumber ?? null,
            serialNumber: line.serialNumber ?? null,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            lineNumber: index + 1,
            notes: line.notes ?? null,
            costPurpose: line.costPurpose ?? PRODUCTION_COST_PURPOSE,
            costPurposeOverrideReason: line.costPurposeOverrideReason ?? null,
          })),
        },
      },
      include: PRODUCTION_MATERIAL_DOCUMENT_INCLUDE,
    });

    // Backfill the product snapshots after creation (products are resolved in create()).
    await client.productionMaterialDocument.update({
      where: { id: doc.id },
      data: {
        lines: {
          update: doc.lines.map((line: any) => ({
            where: { id: line.id },
            data: {
              productCodeSnapshot: line.product?.code ?? '',
              productNameSnapshot: line.product?.name ?? '',
            },
          })),
        },
      },
    });

    return doc;
  }

  async create(dto: CreateMaterialDocumentDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.requestId) {
      const existing = await this.findDocumentByRequestId(dto.requestId, ctx);
      if (existing) return this.resolveIdempotentCreate(existing, dto);
    }
    if (dto.documentType === 'SUBSTITUTION' && dto.lines.some((l) => !l.substitutedProductId)) {
      throw this.badRequest('productionMaterial.substitutionRequiresSubstitute');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = dto.requestId ? await this.findDocumentByRequestId(dto.requestId, ctx, tx) : null;
        if (raced) return this.resolveIdempotentCreate(raced, dto);

        const context = await this.resolveContext(dto, ctx, tx);
        await this.validateReturnReferences(tx, ctx, dto.lines, context.order.id);
        const purposeOverrides = await this.resolveLineCostPurposes(tx, userId, dto.lines);
        const doc = await this.createDocumentWithMovement(tx, ctx, userId, dto.documentType, context.run, context.order, context.warehouse, dto, null, null);

        await this.writeAudit(tx, userId, 'CREATE', doc.id, ctx, {
          documentNumber: doc.documentNumber,
          documentType: dto.documentType,
          productionOrderId: context.order.id,
          productionRunId: context.run.id,
          movementId: doc.movementId,
          lineCount: dto.lines.length,
        });
        this.auditPurposeOverrides(tx, userId, doc, purposeOverrides, ctx);
        return doc;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = dto.requestId ? await this.findDocumentByRequestId(dto.requestId, ctx) : null;
        if (raced) return this.resolveIdempotentCreate(raced, dto);
        throw this.conflict('productionMaterial.duplicateRequest');
      }
      throw error;
    }
  }

  async findAll(query: MaterialDocumentQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.documentType) {
      if (!isProductionMaterialDocumentType(query.documentType)) throw this.badRequest('productionMaterial.invalidType');
      where.documentType = query.documentType;
    }
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.documentDate = {};
      if (query.dateFrom) where.documentDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.documentDate.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [
        { documentNumber: { contains: query.search } },
        { movementNumber: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).productionMaterialDocument.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ documentDate: 'desc' }],
        include: PRODUCTION_MATERIAL_DOCUMENT_INCLUDE,
      }),
      (this.prisma as any).productionMaterialDocument.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findDocument(id, ctx);
  }

  async update(id: string, dto: UpdateMaterialDocumentDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const doc = await this.findDocument(id, ctx, tx);
      if (doc.status !== 'DRAFT') throw this.badRequest('productionMaterial.notDraft');

      let purposeOverrides: Awaited<ReturnType<typeof this.resolveLineCostPurposes>> = [];
      if (dto.lines && dto.lines.length > 0) {
        for (const line of dto.lines) {
          const product = await tx.product.findUnique({ where: { id: line.productId } });
          if (!product) throw this.notFound('productionMaterial.productNotFound');
          if (line.substitutedProductId) {
            const substitute = await tx.product.findUnique({ where: { id: line.substitutedProductId } });
            if (!substitute) throw this.notFound('productionMaterial.substituteProductNotFound');
          }
          if (line.warehouseLocationId) {
            const location = await tx.warehouseLocation.findUnique({ where: { id: line.warehouseLocationId } });
            if (!location) throw this.notFound('productionMaterial.locationNotFound');
            if (doc.issueWarehouseId && location.warehouseId !== doc.issueWarehouseId) throw this.badRequest('productionMaterial.locationWarehouseMismatch');
          }
        }

        purposeOverrides = await this.resolveLineCostPurposes(tx, userId, dto.lines);

        await tx.productionMaterialDocumentLine.deleteMany({ where: { documentId: id } });
        await tx.productionMaterialDocumentLine.createMany({
          data: dto.lines.map((line, index) => ({
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            documentId: id,
            productId: line.productId,
            productCodeSnapshot: '',
            productNameSnapshot: '',
            unit: line.unit,
            quantity: new Prisma.Decimal(line.quantity.toFixed(4)),
            substitutedProductId: line.substitutedProductId ?? null,
            substitutionReason: line.substitutionReason ?? null,
            originalIssueLineId: line.originalIssueLineId ?? null,
            warehouseLocationId: line.warehouseLocationId ?? null,
            batchNumber: line.batchNumber ?? null,
            serialNumber: line.serialNumber ?? null,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            lineNumber: index + 1,
            notes: line.notes ?? null,
            costPurpose: line.costPurpose ?? PRODUCTION_COST_PURPOSE,
            costPurposeOverrideReason: line.costPurposeOverrideReason ?? null,
          })),
        });

        // Rebuild the linked DRAFT movement lines to stay in sync with the document.
        await tx.inventoryMovementLine.deleteMany({ where: { movementId: doc.movementId! } });
        await tx.inventoryMovementLine.createMany({
          data: this.documentLinesToMovementLines(doc.documentType, dto.lines).map((l) => ({
            ...l,
            movementId: doc.movementId!,
          })),
        });
      }

      const updated = await tx.productionMaterialDocument.update({
        where: { id },
        data: {
          notes: dto.notes ?? doc.notes,
          documentDate: dto.documentDate ? new Date(dto.documentDate) : doc.documentDate,
        },
        include: PRODUCTION_MATERIAL_DOCUMENT_INCLUDE,
      });

      await this.writeAudit(tx, userId, 'UPDATE', id, ctx, { documentNumber: doc.documentNumber });
      this.auditPurposeOverrides(tx, userId, updated, purposeOverrides, ctx);
      return updated;
    });
  }

  async post(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const doc = await this.findDocument(id, ctx, tx);
      if (doc.status !== 'DRAFT') throw this.badRequest('productionMaterial.notDraft');
      if (!doc.movementId) throw this.badRequest('productionMaterial.movementMissing');

      await this.validateSnapshotForPosting(tx, doc, ctx);
      await this.movementsService.postMovementWithinTransaction(tx, doc.movementId, userId, ctx);

      // Cost Purpose R1 — write the authoritative historical attribution snapshot
      // onto every line AT POSTING TIME from the parent ProductionOrder context.
      // Immutable afterwards; never derived dynamically from current master data.
      const snapshot = await this.resolveProductionSnapshot(tx, doc.productionOrderId, ctx);
      await tx.productionMaterialDocumentLine.updateMany({
        where: { documentId: id },
        data: {
          productionLineId: snapshot.productionLineId,
          departmentId: snapshot.departmentId,
          costCenterId: snapshot.costCenterId,
          machineId: snapshot.machineId,
        },
      });

      const posted = await tx.productionMaterialDocument.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
        include: PRODUCTION_MATERIAL_DOCUMENT_INCLUDE,
      });

      if (doc.sourceType === 'REVERSE') {
        await this.sourceChangesService.recordChange(
          tx,
          ctx,
          {
            scopeType: 'ORDER',
            scopeId: doc.productionOrderId,
            entityType: 'PRODUCTION_MATERIAL_DOCUMENT',
            entityId: doc.id,
            changeType: 'REVERSAL',
            reason: `Material reversal document ${doc.documentNumber}`,
          },
          userId,
        );
      }

      await this.writeAudit(tx, userId, 'POST', id, ctx, {
        documentNumber: doc.documentNumber,
        movementId: doc.movementId,
        movementNumber: doc.movementNumber,
      });
      return posted;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async cancel(id: string, dto: CancelMaterialDocumentDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const doc = await this.findDocument(id, ctx, tx);
      if (doc.status !== 'DRAFT') throw this.badRequest('productionMaterial.notDraft');

      if (doc.movementId) {
        const movement = await tx.inventoryMovement.findUnique({ where: { id: doc.movementId } });
        if (!movement) throw this.notFound('productionMaterial.movementMissing');
        if (movement.status === 'DRAFT') {
          await tx.inventoryMovement.update({
            where: { id: doc.movementId },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
          });
        }
      }

      const cancelled = await tx.productionMaterialDocument.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId, notes: dto.reason },
        include: PRODUCTION_MATERIAL_DOCUMENT_INCLUDE,
      });

      await this.writeAudit(tx, userId, 'CANCEL', id, ctx, {
        documentNumber: doc.documentNumber,
        reason: dto.reason,
      });
      return cancelled;
    });
  }

  /**
   * Reverses a POSTED document by creating a new DRAFT document of the complementary
   * type whose linked DRAFT movement carries the inverted ledger effect. Posting the
   * reversal returns the exact quantities previously consumed/returned.
   *
   * Phase 2 hardening: the reversal is immutable-linked to its source via
   * `reversesDocumentId`; a source can only ever be reversed once (double reversal is
   * blocked even with a different requestId); a reversal can never itself be reversed;
   * warehouse tenant/branch scope is re-validated; reversal quantities reconcile with
   * the source to the exact Decimal; and requestId idempotency now compares the
   * canonical payload fingerprint (same requestId + different payload is a conflict).
   */
  async reverse(id: string, dto: ReverseMaterialDocumentDto, userId: string, ctx: ActiveOperationalContext) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const source = await this.findDocument(id, ctx, tx);
        if (source.status !== 'POSTED') throw this.badRequest('productionMaterial.reverseOnlyPosted');
        if (source.sourceType === 'REVERSE' || source.reversesDocumentId) throw this.badRequest('productionMaterial.cannotReverseReversal');

        const existingReversal = await tx.productionMaterialDocument.findFirst({
          where: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            reversesDocumentId: source.id,
            status: { not: 'CANCELLED' },
          },
          include: PRODUCTION_MATERIAL_DOCUMENT_INCLUDE,
        });
        if (existingReversal) {
          if (dto.requestId && existingReversal.requestId === dto.requestId) {
            return this.resolveIdempotentReverse(existingReversal, source, dto);
          }
          throw this.conflict('productionMaterial.alreadyReversed');
        }

        const raced = dto.requestId ? await this.findDocumentByRequestId(dto.requestId, ctx, tx) : null;
        if (raced) return this.resolveIdempotentReverse(raced, source, dto);

        const reverseType = materialReverseType(source.documentType as any);
        const reverseLines: CreateMaterialDocumentLineDto[] = source.lines.map((line: any) => {
          const base: CreateMaterialDocumentLineDto = {
            productId: reverseType === 'SUBSTITUTION' && line.substitutedProductId ? line.substitutedProductId : line.productId,
            quantity: Number(line.quantity),
            unit: line.unit,
            warehouseLocationId: line.warehouseLocationId ?? undefined,
            batchNumber: line.batchNumber ?? undefined,
            serialNumber: line.serialNumber ?? undefined,
            expiryDate: line.expiryDate ? line.expiryDate.toISOString() : undefined,
            originalIssueLineId: line.id,
            // Reversal inherits the source line's canonical Cost Purpose (never
            // an override): a MAINTENANCE/PRODUCTION source cannot silently flip.
            costPurpose: line.costPurpose ?? PRODUCTION_COST_PURPOSE,
            costPurposeOverrideReason: line.costPurposeOverrideReason ?? undefined,
          };
          if (reverseType === 'SUBSTITUTION' && line.substitutedProductId) {
            base.substitutedProductId = line.productId;
            base.substitutionReason = line.substitutionReason ?? 'Reverse substitution';
          }
          return base;
        });

        const originalTotal = source.lines.reduce((sum: Prisma.Decimal, l: any) => sum.plus(new Prisma.Decimal(l.quantity)), new Prisma.Decimal(0));
        const reversalTotal = reverseLines.reduce((sum: Prisma.Decimal, l: any) => sum.plus(new Prisma.Decimal(l.quantity)), new Prisma.Decimal(0));
        if (!originalTotal.equals(reversalTotal)) throw this.badRequest('productionMaterial.reversalReconciliationMismatch');

        const run = await tx.productionRun.findFirst({ where: { id: source.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
        const order = await tx.productionOrder.findFirst({ where: { id: source.productionOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
        if (!run) throw this.notFound('productionMaterial.runNotFound');
        if (!order) throw this.notFound('productionMaterial.orderNotFound');

        let warehouse: any = null;
        if (source.issueWarehouseId) {
          warehouse = await tx.warehouse.findUnique({ where: { id: source.issueWarehouseId } });
          if (!warehouse) throw this.notFound('productionMaterial.warehouseNotFound');
          if (warehouse.companyId !== ctx.companyId) throw this.badRequest('productionMaterial.warehouseTenantMismatch');
          if (warehouse.branchId && warehouse.branchId !== ctx.branchId) throw this.badRequest('productionMaterial.warehouseBranchMismatch');
        }

        const reversal = await this.createDocumentWithMovement(
          tx,
          ctx,
          userId,
          reverseType,
          run,
          order,
          warehouse,
          { documentDate: dto.documentDate, notes: dto.notes ?? `Reverses document ${source.documentNumber}`, lines: reverseLines, requestId: dto.requestId },
          source.id,
          source.documentNumber,
          source.id,
        );

        await this.writeAudit(tx, userId, 'REVERSE', reversal.id, ctx, {
          documentNumber: reversal.documentNumber,
          reverseOf: source.documentNumber,
          documentType: reverseType,
          movementId: reversal.movementId,
        });
        return reversal;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = dto.requestId ? await this.findDocumentByRequestId(dto.requestId, ctx) : null;
        if (raced) return this.resolveIdempotentReverse(raced, (await this.findDocument(id, ctx)), dto);
        throw this.conflict('productionMaterial.duplicateRequest');
      }
      throw error;
    }
  }

  async getRunDocuments(runId: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const run = await (this.prisma as any).productionRun.findFirst({
      where: { id: runId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) throw this.notFound('productionMaterial.runNotFound');
    const page = query.page || 1;
    const limit = query.limit || 50;
    const where = { companyId: ctx.companyId, branchId: ctx.branchId, productionRunId: runId };
    const [data, total] = await Promise.all([
      (this.prisma as any).productionMaterialDocument.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ documentDate: 'desc' }],
        include: PRODUCTION_MATERIAL_DOCUMENT_INCLUDE,
      }),
      (this.prisma as any).productionMaterialDocument.count({ where }),
    ]);
    return { runId, runNumber: run.runNumber, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
