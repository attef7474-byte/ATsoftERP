import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { CreateStockAdjustmentDto, CreateStockAdjustmentLineDto } from './dto/create-stock-adjustment.dto';
import { UpdateStockAdjustmentDto } from './dto/update-stock-adjustment.dto';
import { StockAdjustmentQueryDto } from './dto/stock-adjustment-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class InventoryStockAdjustmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ messageKey: 'inventory.stockAdjustmentNotFound', message });
  }

  private badRequest(messageKey: string): BadRequestException {
    return new BadRequestException({ messageKey, message: messageKey });
  }

  private isInContext(
    doc: { companyId: string; branchId: string | null },
    ctx: ActiveOperationalContext,
  ): boolean {
    // Stock Adjustments are branch-owned documents: the active context is
    // always branch-scoped (the interceptor requires both headers), and the
    // create path always stores ctx.branchId. A company-level (branchId null)
    // adjustment is legacy/unassigned and is not visible or mutable through
    // the API, so only an exact branch match is in-context.
    return doc.companyId === ctx.companyId && doc.branchId === ctx.branchId;
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const doc = await this.prisma.inventoryStockAdjustment.findUnique({
      where: { id },
      include: {
        company: true,
        branch: true,
        warehouse: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });
    if (!doc || doc.deletedAt || !this.isInContext(doc, ctx)) {
      throw this.notFound('Stock adjustment not found');
    }
    return doc;
  }

  private async assertWarehouseInContext(warehouseId: string, ctx: ActiveOperationalContext) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse not found');
    }
    if (warehouse.companyId !== ctx.companyId) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse belongs to another company');
    }
    if (warehouse.branchId && warehouse.branchId !== ctx.branchId) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse belongs to another branch');
    }
    return warehouse;
  }

  private async assertLocationInWarehouse(locationId: string, warehouseId: string, field = 'locationId') {
    const location = await this.prisma.warehouseLocation.findUnique({ where: { id: locationId } });
    if (!location || location.warehouseId !== warehouseId) {
      throw this.validationError(field, 'validation.invalidReference', 'Location does not belong to the adjustment warehouse');
    }
    return location;
  }

  async create(dto: CreateStockAdjustmentDto, userId: string, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw new NotFoundException({ messageKey: 'organization.companyNotFound', message: 'Company not found' });

    const warehouse = await this.assertWarehouseInContext(dto.warehouseId, ctx);
    if (dto.locationId) await this.assertLocationInWarehouse(dto.locationId, warehouse.id);

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new NotFoundException(`Product ${line.productId} not found`);
      if (line.quantity <= 0) throw this.badRequest('inventory.stockAdjustmentQuantityMustBePositive');
      if (!['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'].includes(line.adjustmentType)) {
        throw this.badRequest('inventory.stockAdjustmentInvalidType');
      }
      if (line.locationId) await this.assertLocationInWarehouse(line.locationId, warehouse.id, 'lines.locationId');
    }

    return this.prisma.$transaction(async (tx) => {
      const code = await this.numberingService.generateNumberAtomic('STOCK_ADJUSTMENT');

      const { lines, companyId: _ignoredCompanyId, branchId: _ignoredBranchId, ...rest } = dto;
      const doc = await tx.inventoryStockAdjustment.create({
        data: {
          ...rest,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          code,
          status: 'DRAFT',
          createdById: userId,
          lines: {
            create: lines.map((l) => ({
              productId: l.productId,
              locationId: l.locationId,
              adjustmentType: l.adjustmentType,
              quantity: l.quantity,
              notes: l.notes,
            })),
          },
        },
        include: { lines: true },
      });

      await this.audit.logWithClient(tx, {
        userId,
        action: 'CREATE',
        entity: 'InventoryStockAdjustment',
        entityId: doc.id,
        details: { companyId: ctx.companyId, branchId: ctx.branchId, code: doc.code },
      });
      return doc;
    });
  }

  async findAll(query: StockAdjustmentQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { reason: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }
    // Client-supplied query.companyId / query.branchId are deliberately ignored:
    // the authoritative scope is always the active operational context.

    const [data, total] = await Promise.all([
      this.prisma.inventoryStockAdjustment.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryStockAdjustment.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  async update(id: string, dto: UpdateStockAdjustmentDto, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    if (doc.status !== 'DRAFT') throw this.badRequest('inventory.stockAdjustmentOnlyDraftCanUpdate');

    const { lines: _ignoredLines, companyId: _ignoredCompanyId, branchId: _ignoredBranchId, warehouseId, locationId, ...rest } = dto;

    const data: any = { ...rest };
    if (warehouseId !== undefined) {
      const warehouse = await this.assertWarehouseInContext(warehouseId, ctx);
      data.warehouseId = warehouse.id;
    }
    if (locationId !== undefined) {
      await this.assertLocationInWarehouse(locationId, data.warehouseId ?? doc.warehouseId);
      data.locationId = locationId;
    }

    const updated = await this.prisma.inventoryStockAdjustment.update({ where: { id }, data });
    await this.audit.log(userId, 'UPDATE', 'InventoryStockAdjustment', id, { dto });
    return updated;
  }

  async submit(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    if (doc.status !== 'DRAFT') throw this.badRequest('inventory.stockAdjustmentOnlyDraftCanSubmit');
    const updated = await this.prisma.inventoryStockAdjustment.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: userId },
    });
    await this.audit.log(userId, 'SUBMIT', 'InventoryStockAdjustment', id, { oldStatus: doc.status, newStatus: 'SUBMITTED' });
    return updated;
  }

  async approve(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    if (doc.status !== 'SUBMITTED') throw this.badRequest('inventory.stockAdjustmentOnlySubmittedCanApprove');
    const updated = await this.prisma.inventoryStockAdjustment.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId },
    });
    await this.audit.log(userId, 'APPROVE', 'InventoryStockAdjustment', id, { oldStatus: doc.status, newStatus: 'APPROVED' });
    return updated;
  }

  async reject(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    if (doc.status !== 'SUBMITTED') throw this.badRequest('inventory.stockAdjustmentOnlySubmittedCanReject');
    const updated = await this.prisma.inventoryStockAdjustment.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId },
    });
    await this.audit.log(userId, 'REJECT', 'InventoryStockAdjustment', id, { oldStatus: doc.status, newStatus: 'REJECTED' });
    return updated;
  }

  async post(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    // Pre-existing state-transition semantics: only APPROVED can be posted.
    // A second post on an already POSTED document is rejected here, before
    // any movement/balance side effect can occur.
    if (doc.status !== 'APPROVED') throw this.badRequest('inventory.stockAdjustmentOnlyApprovedCanPost');

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryStockAdjustment.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!current || current.deletedAt || !this.isInContext(current, ctx)) {
        throw this.notFound('Stock adjustment not found');
      }
      if (current.status !== 'APPROVED') throw this.badRequest('inventory.stockAdjustmentOnlyApprovedCanPost');

      const inLines = current.lines.filter(l => l.adjustmentType === 'ADJUSTMENT_IN');
      const outLines = current.lines.filter(l => l.adjustmentType === 'ADJUSTMENT_OUT');

      if (inLines.length > 0) {
        const movementNumber = await this.numberingService.generateNumberAtomic('INVENTORY_MOVEMENT');

        const movement = await tx.inventoryMovement.create({
          data: {
            movementNumber,
            companyId: current.companyId,
            branchId: current.branchId,
            warehouseId: current.warehouseId,
            movementType: 'STOCK_ADJUSTMENT_IN',
            status: 'POSTED',
            sourceType: 'STOCK_ADJUSTMENT',
            sourceId: current.id,
            movementDate: new Date(),
            postedAt: new Date(),
            postedById: userId,
            createdById: userId,
            notes: current.reason,
            lines: { create: inLines.map(l => ({ productId: l.productId, warehouseLocationId: l.locationId, quantity: l.quantity, direction: 'IN', notes: l.notes })) },
          },
        });

        for (const line of inLines) {
          await this.applyBalanceDelta(tx, current.warehouseId, line.productId, line.locationId, line.quantity, 'IN');
          await tx.inventoryStockAdjustmentLine.update({
            where: { id: line.id },
            data: { movementId: movement.id },
          });
        }
      }

      if (outLines.length > 0) {
        const movementNumber = await this.numberingService.generateNumberAtomic('INVENTORY_MOVEMENT');

        const movement = await tx.inventoryMovement.create({
          data: {
            movementNumber,
            companyId: current.companyId,
            branchId: current.branchId,
            warehouseId: current.warehouseId,
            movementType: 'STOCK_ADJUSTMENT_OUT',
            status: 'POSTED',
            sourceType: 'STOCK_ADJUSTMENT',
            sourceId: current.id,
            movementDate: new Date(),
            postedAt: new Date(),
            postedById: userId,
            createdById: userId,
            notes: current.reason,
            lines: { create: outLines.map(l => ({ productId: l.productId, warehouseLocationId: l.locationId, quantity: l.quantity, direction: 'OUT', notes: l.notes })) },
          },
        });

        for (const line of outLines) {
          await this.applyBalanceDelta(tx, current.warehouseId, line.productId, line.locationId, line.quantity, 'OUT');
          await tx.inventoryStockAdjustmentLine.update({
            where: { id: line.id },
            data: { movementId: movement.id },
          });
        }
      }

      const posted = await tx.inventoryStockAdjustment.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
        include: { lines: true },
      });

      await this.audit.logWithClient(tx, {
        userId,
        action: 'POST',
        entity: 'InventoryStockAdjustment',
        entityId: id,
        details: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          oldStatus: current.status,
          newStatus: 'POSTED',
          inCount: inLines.length,
          outCount: outLines.length,
        },
      });
      return posted;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return result;
  }

  async cancel(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    if (doc.status !== 'DRAFT' && doc.status !== 'SUBMITTED') {
      throw this.badRequest('inventory.stockAdjustmentOnlyDraftOrSubmittedCanCancel');
    }

    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.inventoryStockAdjustment.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
      });
      await this.audit.logWithClient(tx, {
        userId,
        action: 'CANCEL',
        entity: 'InventoryStockAdjustment',
        entityId: id,
        details: { companyId: ctx.companyId, branchId: ctx.branchId, oldStatus: doc.status, newStatus: 'CANCELLED' },
      });
      return cancelled;
    });
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    if (doc.status !== 'DRAFT') throw this.badRequest('inventory.stockAdjustmentOnlyDraftCanDelete');

    // Deletion is atomic: the ownership re-check, status re-check, line
    // deletion, document deletion, and audit all commit or roll back together.
    // A failure on any step leaves the document fully intact.
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryStockAdjustment.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!current || current.deletedAt || !this.isInContext(current, ctx)) {
        throw this.notFound('Stock adjustment not found');
      }
      if (current.status !== 'DRAFT') throw this.badRequest('inventory.stockAdjustmentOnlyDraftCanDelete');

      await tx.inventoryStockAdjustmentLine.deleteMany({ where: { adjustmentId: id } });
      await tx.inventoryStockAdjustment.delete({ where: { id } });
      await this.audit.logWithClient(tx, {
        userId,
        action: 'DELETE',
        entity: 'InventoryStockAdjustment',
        entityId: id,
        details: { companyId: ctx.companyId, branchId: ctx.branchId },
      });
      return { message: 'Stock adjustment deleted successfully' };
    });
  }

  async addLine(id: string, dto: CreateStockAdjustmentLineDto, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    if (doc.status !== 'DRAFT') throw this.badRequest('inventory.stockAdjustmentOnlyDraftCanModify');
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.quantity <= 0) throw this.badRequest('inventory.stockAdjustmentQuantityMustBePositive');
    if (!['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'].includes(dto.adjustmentType)) {
      throw this.badRequest('inventory.stockAdjustmentInvalidType');
    }
    if (dto.locationId) await this.assertLocationInWarehouse(dto.locationId, doc.warehouseId, 'lines.locationId');

    const line = await this.prisma.inventoryStockAdjustmentLine.create({
      data: {
        adjustmentId: id,
        productId: dto.productId,
        locationId: dto.locationId,
        adjustmentType: dto.adjustmentType,
        quantity: dto.quantity,
        notes: dto.notes,
      },
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'ADD_LINE', 'InventoryStockAdjustment', id, { lineId: line.id });
    return line;
  }

  async updateLine(id: string, lineId: string, dto: Partial<CreateStockAdjustmentLineDto>, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    if (doc.status !== 'DRAFT') throw this.badRequest('inventory.stockAdjustmentOnlyDraftCanModify');
    const line = await this.prisma.inventoryStockAdjustmentLine.findUnique({ where: { id: lineId } });
    if (!line || line.adjustmentId !== id) throw this.notFound('Stock adjustment line not found');
    if (dto.locationId) await this.assertLocationInWarehouse(dto.locationId, doc.warehouseId, 'lines.locationId');

    const updated = await this.prisma.inventoryStockAdjustmentLine.update({
      where: { id: lineId },
      data: dto,
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'UPDATE_LINE', 'InventoryStockAdjustment', id, { lineId });
    return updated;
  }

  async removeLine(id: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    if (doc.status !== 'DRAFT') throw this.badRequest('inventory.stockAdjustmentOnlyDraftCanModify');
    const line = await this.prisma.inventoryStockAdjustmentLine.findUnique({ where: { id: lineId } });
    if (!line || line.adjustmentId !== id) throw this.notFound('Stock adjustment line not found');

    await this.prisma.inventoryStockAdjustmentLine.delete({ where: { id: lineId } });
    await this.audit.log(userId, 'REMOVE_LINE', 'InventoryStockAdjustment', id, { lineId });
    return { message: 'Line removed successfully' };
  }

  async summary(id: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOwned(id, ctx);
    const lines = await this.prisma.inventoryStockAdjustmentLine.findMany({
      where: { adjustmentId: id },
      select: { adjustmentType: true, quantity: true },
    });
    const totalIn = lines.filter(l => l.adjustmentType === 'ADJUSTMENT_IN').reduce((s, l) => s + l.quantity, 0);
    const totalOut = lines.filter(l => l.adjustmentType === 'ADJUSTMENT_OUT').reduce((s, l) => s + l.quantity, 0);
    return { stockAdjustmentId: id, code: doc.code, status: doc.status, lineCount: lines.length, totalIn, totalOut };
  }

  private async applyBalanceDelta(
    tx: any,
    warehouseId: string,
    productId: string,
    locationId: string | null | undefined,
    quantity: number,
    direction: 'IN' | 'OUT',
  ) {
    const balance = await this.getOrCreateBalance(tx, warehouseId, productId, locationId);
    const delta = new Prisma.Decimal(quantity).mul(direction === 'IN' ? 1 : -1);
    const currentBase = new Prisma.Decimal(balance.quantityBase ?? balance.quantity);
    const nextBase = currentBase.add(delta);

    if (nextBase.isNegative()) {
      const product = await tx.product.findUnique({ where: { id: productId } });
      throw new BadRequestException(
        `Insufficient stock for product ${product?.name || productId}. Available: ${currentBase.toString()}, Requested: ${quantity}`,
      );
    }

    const nextQuantity = Number(nextBase.toFixed(4));
    await tx.inventoryBalance.update({
      where: { id: balance.id },
      data: { quantity: nextQuantity, quantityBase: nextBase },
    });
  }

  private async getOrCreateBalance(tx: any, warehouseId: string, productId: string, locationId: string | null | undefined) {
    const where: any = { warehouseId, productId };
    if (locationId) where.locationId = locationId; else where.locationId = null;
    let balance = await tx.inventoryBalance.findFirst({ where });
    if (!balance) {
      balance = await tx.inventoryBalance.create({
        data: { warehouseId, productId, locationId: locationId || null, quantity: 0, quantityBase: 0 },
      });
    }
    return balance;
  }
}
