import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { InventoryMovementsService } from '../inventory-movements/inventory-movements.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import {
  PRODUCTION_FG_RECEIPT_AUDIT_ENTITY,
  PRODUCTION_FG_RECEIPT_INCLUDE,
} from './production-finished-goods-receipts.constants';
import {
  CancelFgReceiptDto,
  CreateFgReceiptDto,
  CreateFgReceiptLineDto,
  FgReceiptQueryDto,
  ReverseFgReceiptDto,
  UpdateFgReceiptDto,
} from './dto/production-finished-goods-receipt.dto';
import { deriveRunTotals } from '../production-runs/production-runs.util';
import { ProductionRunsService } from '../production-runs/production-runs.service';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

const FG_SOURCE_TYPE = 'PRODUCTION_FINISHED_GOODS_RECEIPT';

@Injectable()
export class ProductionFinishedGoodsReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberingService: NumberingService,
    private readonly movementsService: InventoryMovementsService,
    private readonly productionRunsService: ProductionRunsService,
    private readonly valuationEngine: InventoryValuationEngineService,
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
      entity: PRODUCTION_FG_RECEIPT_AUDIT_ENTITY,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }

  private async findReceipt(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const receipt = await client.productionFinishedGoodsReceipt.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: PRODUCTION_FG_RECEIPT_INCLUDE,
    });
    if (!receipt) throw this.notFound('productionFgReceipt.notFound');
    return receipt;
  }

  private async findReceiptByRequestId(requestId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.productionFinishedGoodsReceipt.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId },
      include: PRODUCTION_FG_RECEIPT_INCLUDE,
    });
  }

  /**
   * Over-receipt prevention: a POSTED receipt may not move into the warehouse more good
   * output than the run recorded as authoritative final output (FINAL_OUTPUT events on an
   * authoritative measurement point, net of corrections) minus what is already received.
   * Reversal receipts bypass this because they only return stock OUT of the warehouse.
   */
  private async assertWithinEligibleOutput(client: any, receipt: any, ctx: ActiveOperationalContext) {
    const run = await client.productionRun.findFirst({
      where: { id: receipt.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) throw this.notFound('productionFgReceipt.runNotFound');

    const events: any[] = await client.productionOutputEvent.findMany({
      where: { productionRunId: run.id, companyId: ctx.companyId, branchId: ctx.branchId },
      select: {
        id: true,
        eventType: true,
        classification: true,
        quantity: true,
        goodQuantity: true,
        rejectQuantity: true,
        correctsEventId: true,
        measurementPointId: true,
        measurementPoint: { select: { isAuthoritativeFinal: true } },
      },
    });
    const totals = deriveRunTotals(
      events.map((e: any) => ({
        id: e.id,
        eventType: e.eventType,
        classification: e.classification,
        quantity: e.quantity,
        goodQuantity: e.goodQuantity,
        rejectQuantity: e.rejectQuantity,
        correctsEventId: e.correctsEventId,
        measurementPointId: e.measurementPointId,
        measurementPoint: e.measurementPoint,
      })),
    );
    const eligibleGood = new Prisma.Decimal(totals.finalOutputGood);

    const posted = await client.productionFinishedGoodsReceipt.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, productionRunId: run.id, status: 'POSTED' },
      select: { lines: { select: { productId: true, quantity: true } } },
    });

    const receivedByProduct = new Map<string, Prisma.Decimal>();
    for (const r of posted) {
      for (const line of r.lines) {
        const current = receivedByProduct.get(line.productId) ?? new Prisma.Decimal(0);
        receivedByProduct.set(line.productId, current.plus(new Prisma.Decimal(line.quantity)));
      }
    }

    for (const line of receipt.lines) {
      const alreadyReceived = receivedByProduct.get(line.productId) ?? new Prisma.Decimal(0);
      const incoming = new Prisma.Decimal(line.quantity);
      if (alreadyReceived.plus(incoming).greaterThan(eligibleGood)) {
        throw this.badRequest('productionFgReceipt.exceedsEligibleOutput');
      }
    }
  }

  private async resolveContext(dto: CreateFgReceiptDto, ctx: ActiveOperationalContext, client: any) {
    const run = await client.productionRun.findFirst({
      where: { id: dto.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) throw this.notFound('productionFgReceipt.runNotFound');

    const order = await client.productionOrder.findFirst({
      where: { id: dto.productionOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!order) throw this.notFound('productionFgReceipt.orderNotFound');
    if (run.productionOrderId !== order.id) throw this.badRequest('productionFgReceipt.orderContextMismatch');

    let warehouse: any = null;
    if (dto.receiptWarehouseId) {
      warehouse = await client.warehouse.findUnique({ where: { id: dto.receiptWarehouseId } });
      if (!warehouse) throw this.notFound('productionFgReceipt.warehouseNotFound');
      if (warehouse.companyId !== ctx.companyId) throw this.badRequest('productionFgReceipt.warehouseTenantMismatch');
      if (warehouse.branchId && warehouse.branchId !== ctx.branchId) throw this.badRequest('productionFgReceipt.warehouseBranchMismatch');
    } else {
      warehouse = await client.warehouse.findUnique({ where: { id: order.receiptWarehouseId ?? '' } });
      if (!warehouse) throw this.badRequest('productionFgReceipt.warehouseRequired');
      if (warehouse.companyId !== ctx.companyId) throw this.badRequest('productionFgReceipt.warehouseTenantMismatch');
      if (warehouse.branchId && warehouse.branchId !== ctx.branchId) throw this.badRequest('productionFgReceipt.warehouseBranchMismatch');
    }

    const definition = await client.productionProductDefinition.findFirst({
      where: { id: order.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      select: { productId: true },
    });
    if (!definition) throw this.notFound('productionFgReceipt.productDefinitionNotFound');
    const finalProductId = definition.productId;

    for (const line of dto.lines) {
      const product = await client.product.findUnique({ where: { id: line.productId } });
      if (!product) throw this.notFound('productionFgReceipt.productNotFound');
      if (line.productId !== finalProductId) throw this.badRequest('productionFgReceipt.productNotFinalOutput');
      if (line.warehouseLocationId) {
        const location = await client.warehouseLocation.findUnique({ where: { id: line.warehouseLocationId } });
        if (!location) throw this.notFound('productionFgReceipt.locationNotFound');
        if (location.warehouseId !== warehouse.id) throw this.badRequest('productionFgReceipt.locationWarehouseMismatch');
      }
    }

    return { run, order, warehouse, finalProductId };
  }

  private lineToMovementLines(direction: 'IN' | 'OUT', dtoLines: CreateFgReceiptLineDto[]) {
    return dtoLines.map((line) => ({
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
    }));
  }

  private async createReceiptWithMovement(
    client: any,
    ctx: ActiveOperationalContext,
    userId: string,
    run: any,
    order: any,
    warehouse: any,
    dto: CreateFgReceiptDto | { receiptDate?: string; notes?: string; lines: CreateFgReceiptLineDto[]; requestId?: string },
    direction: 'IN' | 'OUT',
    sourceReceiptId: string | null,
  ) {
    const receiptNumber = await this.numberingService.generateNumberAtomicWithClient('PRODUCTION_FINISHED_GOODS_RECEIPT', client);
    const movementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', client);
    const receiptDate = dto.receiptDate ? new Date(dto.receiptDate) : new Date();

    const movementLines = this.lineToMovementLines(direction, dto.lines);
    const movement = await client.inventoryMovement.create({
      data: {
        movementNumber,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        warehouseId: warehouse.id,
        movementType: direction === 'IN' ? 'PRODUCTION_FG_RECEIPT' : 'PRODUCTION_FG_RECEIPT_REVERSAL',
        status: 'DRAFT',
        sourceType: FG_SOURCE_TYPE,
        sourceId: sourceReceiptId,
        movementDate: receiptDate,
        notes: dto.notes ?? null,
        createdById: userId,
        lines: { create: movementLines },
      },
    });

    const receipt = await client.productionFinishedGoodsReceipt.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        receiptNumber,
        productionOrderId: order.id,
        productionRunId: run.id,
        receiptWarehouseId: warehouse.id,
        status: 'DRAFT',
        movementId: movement.id,
        movementNumber: movement.movementNumber,
        sourceType: sourceReceiptId ? 'REVERSE' : 'MANUAL',
        requestId: dto.requestId ?? null,
        notes: dto.notes ?? null,
        receiptDate,
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
            warehouseLocationId: line.warehouseLocationId ?? null,
            batchNumber: line.batchNumber ?? null,
            serialNumber: line.serialNumber ?? null,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            lineNumber: index + 1,
            notes: line.notes ?? null,
          })),
        },
      },
      include: PRODUCTION_FG_RECEIPT_INCLUDE,
    });

    await client.productionFinishedGoodsReceipt.update({
      where: { id: receipt.id },
      data: {
        lines: {
          update: receipt.lines.map((line: any) => ({
            where: { id: line.id },
            data: {
              productCodeSnapshot: line.product?.code ?? '',
              productNameSnapshot: line.product?.name ?? '',
            },
          })),
        },
      },
    });

    return receipt;
  }

  async create(dto: CreateFgReceiptDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.requestId) {
      const existing = await this.findReceiptByRequestId(dto.requestId, ctx);
      if (existing) return existing;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = dto.requestId ? await this.findReceiptByRequestId(dto.requestId, ctx, tx) : null;
        if (raced) return raced;

        const context = await this.resolveContext(dto, ctx, tx);
        const receipt = await this.createReceiptWithMovement(tx, ctx, userId, context.run, context.order, context.warehouse, dto, 'IN', null);

        await this.writeAudit(tx, userId, 'CREATE', receipt.id, ctx, {
          receiptNumber: receipt.receiptNumber,
          productionOrderId: context.order.id,
          productionRunId: context.run.id,
          movementId: receipt.movementId,
          lineCount: dto.lines.length,
        });
        return receipt;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = dto.requestId ? await this.findReceiptByRequestId(dto.requestId, ctx) : null;
        if (raced) return raced;
        throw this.conflict('productionFgReceipt.duplicateRequest');
      }
      throw error;
    }
  }

  async findAll(query: FgReceiptQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.receiptDate = {};
      if (query.dateFrom) where.receiptDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.receiptDate.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [
        { receiptNumber: { contains: query.search } },
        { movementNumber: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).productionFinishedGoodsReceipt.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ receiptDate: 'desc' }],
        include: PRODUCTION_FG_RECEIPT_INCLUDE,
      }),
      (this.prisma as any).productionFinishedGoodsReceipt.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findReceipt(id, ctx);
  }

  async update(id: string, dto: UpdateFgReceiptDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await this.findReceipt(id, ctx, tx);
      if (receipt.status !== 'DRAFT') throw this.badRequest('productionFgReceipt.notDraft');

      if (dto.lines && dto.lines.length > 0) {
        const run = await tx.productionRun.findFirst({
          where: { id: receipt.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        });
        if (!run) throw this.notFound('productionFgReceipt.runNotFound');
        const order = await tx.productionOrder.findFirst({
          where: { id: receipt.productionOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        });
        if (!order) throw this.notFound('productionFgReceipt.orderNotFound');
        const definition = await tx.productionProductDefinition.findFirst({
          where: { id: order.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
          select: { productId: true },
        });
        if (!definition) throw this.notFound('productionFgReceipt.productDefinitionNotFound');
        const receiptWarehouse = await tx.warehouse.findUnique({ where: { id: receipt.receiptWarehouseId } });
        if (!receiptWarehouse) throw this.notFound('productionFgReceipt.warehouseNotFound');
        for (const line of dto.lines) {
          const product = await tx.product.findUnique({ where: { id: line.productId } });
          if (!product) throw this.notFound('productionFgReceipt.productNotFound');
          if (line.productId !== definition.productId) throw this.badRequest('productionFgReceipt.productNotFinalOutput');
          if (line.warehouseLocationId) {
            const location = await tx.warehouseLocation.findUnique({ where: { id: line.warehouseLocationId } });
            if (!location) throw this.notFound('productionFgReceipt.locationNotFound');
            if (location.warehouseId !== receiptWarehouse.id) throw this.badRequest('productionFgReceipt.locationWarehouseMismatch');
          }
        }

        await tx.productionFinishedGoodsReceiptLine.deleteMany({ where: { receiptId: id } });
        await tx.productionFinishedGoodsReceiptLine.createMany({
          data: dto.lines.map((line, index) => ({
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            receiptId: id,
            productId: line.productId,
            productCodeSnapshot: '',
            productNameSnapshot: '',
            unit: line.unit,
            quantity: new Prisma.Decimal(line.quantity.toFixed(4)),
            warehouseLocationId: line.warehouseLocationId ?? null,
            batchNumber: line.batchNumber ?? null,
            serialNumber: line.serialNumber ?? null,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            lineNumber: index + 1,
            notes: line.notes ?? null,
          })),
        });
        await tx.inventoryMovementLine.deleteMany({ where: { movementId: receipt.movementId! } });
        await tx.inventoryMovementLine.createMany({
          data: this.lineToMovementLines('IN', dto.lines).map((l) => ({ ...l, movementId: receipt.movementId! })),
        });
      }

      const updated = await tx.productionFinishedGoodsReceipt.update({
        where: { id },
        data: {
          notes: dto.notes ?? receipt.notes,
          receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : receipt.receiptDate,
        },
        include: PRODUCTION_FG_RECEIPT_INCLUDE,
      });

      await this.writeAudit(tx, userId, 'UPDATE', id, ctx, { receiptNumber: receipt.receiptNumber });
      return updated;
    });
  }

  async post(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.withTransientTransactionRetry(() => this.prisma.$transaction(async (tx) => {
      const receipt = await this.findReceipt(id, ctx, tx);
      if (receipt.status !== 'DRAFT') throw this.badRequest('productionFgReceipt.notDraft');
      if (!receipt.movementId) throw this.badRequest('productionFgReceipt.movementMissing');

      // Shared R1G production-run boundary serializes close, all FG receipts,
      // and trusted reversals before any remaining-capacity calculation.
      await this.productionRunsService.acquireRunCostBoundaryLock(tx, receipt.productionRunId);

      const activePolicy = await this.valuationEngine.findActivePolicyForWarehouse(
        tx,
        ctx.companyId,
        receipt.receiptWarehouseId ?? '',
      );
      // Preserve the exact pre-R1G-B live-output eligibility behavior for
      // warehouses without ACTIVE valuation. ACTIVE valuation instead uses the
      // frozen ProductionRunCostSnapshot quantity inside the dedicated movement
      // posting contract and never reprices from live output/loss events.
      if (!activePolicy && receipt.sourceType !== 'REVERSE') {
        await this.assertWithinEligibleOutput(tx, receipt, ctx);
      }

      await this.movementsService.postProductionFinishedGoodsMovementWithinTransaction(
        tx,
        receipt.id,
        receipt.movementId,
        userId,
        ctx,
      );

      const posted = await tx.productionFinishedGoodsReceipt.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
        include: PRODUCTION_FG_RECEIPT_INCLUDE,
      });

      await this.writeAudit(tx, userId, 'POST', id, ctx, {
        receiptNumber: receipt.receiptNumber,
        movementId: receipt.movementId,
        movementNumber: receipt.movementNumber,
      });
      return posted;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  }

  private async withTransientTransactionRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const isTransient = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!isTransient || attempt === maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
      }
    }
    throw new Error('withTransientTransactionRetry exhausted attempts');
  }

  async cancel(id: string, dto: CancelFgReceiptDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await this.findReceipt(id, ctx, tx);
      if (receipt.status !== 'DRAFT') throw this.badRequest('productionFgReceipt.notDraft');

      if (receipt.movementId) {
        const movement = await tx.inventoryMovement.findUnique({ where: { id: receipt.movementId } });
        if (movement && movement.status === 'DRAFT') {
          await tx.inventoryMovement.update({
            where: { id: receipt.movementId },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
          });
        }
      }

      const cancelled = await tx.productionFinishedGoodsReceipt.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId, notes: dto.reason },
        include: PRODUCTION_FG_RECEIPT_INCLUDE,
      });

      await this.writeAudit(tx, userId, 'CANCEL', id, ctx, { receiptNumber: receipt.receiptNumber, reason: dto.reason });
      return cancelled;
    });
  }

  /**
   * Reverses a POSTED finished-goods receipt by creating a new DRAFT receipt whose
   * linked DRAFT movement carries an OUT effect for the exact received quantities.
   */
  async reverse(id: string, dto: ReverseFgReceiptDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.requestId) {
      const existing = await this.findReceiptByRequestId(dto.requestId, ctx);
      if (existing) return existing;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = dto.requestId ? await this.findReceiptByRequestId(dto.requestId, ctx, tx) : null;
        if (raced) return raced;

        const source = await this.findReceipt(id, ctx, tx);
        if (source.status !== 'POSTED') throw this.badRequest('productionFgReceipt.reverseOnlyPosted');
        if (source.sourceType === 'REVERSE') throw this.badRequest('productionFgReceipt.cannotReverseReversal');

        const reverseLines: CreateFgReceiptLineDto[] = source.lines.map((line: any) => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          unit: line.unit,
          warehouseLocationId: line.warehouseLocationId ?? undefined,
          batchNumber: line.batchNumber ?? undefined,
          serialNumber: line.serialNumber ?? undefined,
          expiryDate: line.expiryDate ? line.expiryDate.toISOString() : undefined,
        }));

        const run = await tx.productionRun.findFirst({ where: { id: source.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
        const order = await tx.productionOrder.findFirst({ where: { id: source.productionOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
        if (!run) throw this.notFound('productionFgReceipt.runNotFound');
        if (!order) throw this.notFound('productionFgReceipt.orderNotFound');

        const warehouse = source.receiptWarehouseId
          ? await tx.warehouse.findUnique({ where: { id: source.receiptWarehouseId } })
          : null;
        if (!warehouse) throw this.notFound('productionFgReceipt.warehouseNotFound');

        const reversal = await this.createReceiptWithMovement(
          tx,
          ctx,
          userId,
          run,
          order,
          warehouse,
          { receiptDate: dto.receiptDate, notes: dto.notes ?? `Reverses receipt ${source.receiptNumber}`, lines: reverseLines, requestId: dto.requestId },
          'OUT',
          source.id,
        );

        await this.writeAudit(tx, userId, 'REVERSE', reversal.id, ctx, {
          receiptNumber: reversal.receiptNumber,
          reverseOf: source.receiptNumber,
          movementId: reversal.movementId,
        });
        return reversal;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = dto.requestId ? await this.findReceiptByRequestId(dto.requestId, ctx) : null;
        if (raced) return raced;
        throw this.conflict('productionFgReceipt.duplicateRequest');
      }
      throw error;
    }
  }

  async getRunReceipts(runId: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const run = await (this.prisma as any).productionRun.findFirst({
      where: { id: runId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) throw this.notFound('productionFgReceipt.runNotFound');
    const page = query.page || 1;
    const limit = query.limit || 50;
    const where = { companyId: ctx.companyId, branchId: ctx.branchId, productionRunId: runId };
    const [data, total] = await Promise.all([
      (this.prisma as any).productionFinishedGoodsReceipt.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ receiptDate: 'desc' }],
        include: PRODUCTION_FG_RECEIPT_INCLUDE,
      }),
      (this.prisma as any).productionFinishedGoodsReceipt.count({ where }),
    ]);
    return { runId, runNumber: run.runNumber, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
