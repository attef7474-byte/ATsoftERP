import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { CreatePhysicalCountDto } from './dto/create-physical-count.dto';
import { UpdatePhysicalCountDto } from './dto/update-physical-count.dto';
import { EnterCountLineDto } from './dto/enter-count-line.dto';
import { RejectPhysicalCountDto } from './dto/reject-physical-count.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { assertRowInContext, assertWarehouseInContext } from '../../../common/operational-context/tenant-guards';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';
import { INVENTORY_VALUATION_PERMISSION_KEYS } from '../inventory-valuation/inventory-valuation.constants';

@Injectable()
export class InventoryPhysicalCountsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
    private valuationEngine: InventoryValuationEngineService,
  ) {}

  async create(dto: CreatePhysicalCountDto, userId: string, ctx: ActiveOperationalContext) {
    await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);

    const result = await this.prisma.$transaction(async (tx) => {
      await assertWarehouseInContext(tx, dto.warehouseId, ctx);
      const countNumber = await this.numberingService.generateNumberAtomicWithClient('PHYSICAL_COUNT', tx);

      const count = await tx.inventoryPhysicalCount.create({
        data: {
          countNumber,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          warehouseId: dto.warehouseId,
          notes: dto.notes,
          status: 'DRAFT',
          createdById: userId,
        },
      });

      if (dto.lines && dto.lines.length > 0) {
        await Promise.all(dto.lines.map(line =>
          this.createLineWithBalance(tx, count, line.productId, line.warehouseLocationId),
        ));
      }

      return tx.inventoryPhysicalCount.findUnique({
        where: { id: count.id },
        include: {
          lines: {
            include: {
              product: { select: { id: true, code: true, name: true, unit: true } },
              warehouseLocation: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });
    });

    await this.audit.log(userId, 'CREATE', 'InventoryPhysicalCount', result!.id, { countNumber: result!.countNumber });
    return result;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    companyId?: string; branchId?: string; warehouseId?: string;
    status?: string; dateFrom?: string; dateTo?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    if (ctx.branchId) where.branchId = ctx.branchId;
    if (query.search) {
      where.OR = [
        { countNumber: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.countDate = {};
      if (query.dateFrom) where.countDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.countDate.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryPhysicalCount.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryPhysicalCount.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const count = await this.prisma.inventoryPhysicalCount.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            product: { select: { id: true, code: true, name: true, unit: true } },
            warehouseLocation: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!count || count.deletedAt) throw new NotFoundException('Physical count not found');
    assertRowInContext(count, ctx, 'physical count');
    return count;
  }

  async update(id: string, dto: UpdatePhysicalCountDto, userId: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    if (count.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT physical counts can be updated');
    }

    if (dto.warehouseId) {
      await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);
    }

    const updated = await this.prisma.inventoryPhysicalCount.update({ where: { id }, data: { ...dto } });
    await this.audit.log(userId, 'UPDATE', 'InventoryPhysicalCount', id, { oldStatus: count.status });
    return updated;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    if (count.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT physical counts can be deleted');
    }

    await this.prisma.inventoryPhysicalCount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log(userId, 'DELETE', 'InventoryPhysicalCount', id);
    return { message: 'Physical count deleted successfully' };
  }

  private async createLineWithBalance(tx: any, count: any, productId: string, warehouseLocationId?: string) {
    if (warehouseLocationId) {
      const loc = await tx.warehouseLocation.findUnique({ where: { id: warehouseLocationId } });
      if (!loc) throw new NotFoundException('Warehouse location not found');
      if (loc.warehouseId !== count.warehouseId) {
        throw new BadRequestException('warehouseLocationId does not belong to the physical count warehouse');
      }
    }
    const balance = await tx.inventoryBalance.findFirst({
      where: { warehouseId: count.warehouseId, productId, locationId: warehouseLocationId ?? null },
      orderBy: { updatedAt: 'desc' },
    });
    const systemQty = balance?.quantity ?? 0;

    return tx.inventoryPhysicalCountLine.create({
      data: { physicalCountId: count.id, productId, warehouseLocationId, systemQty },
    });
  }

  async addLine(physicalCountId: string, productId: string, warehouseLocationId: string | null, userId: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(physicalCountId, ctx);
    if (count.status !== 'DRAFT') {
      throw new BadRequestException('Can only add lines to DRAFT physical counts');
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    if (warehouseLocationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: warehouseLocationId } });
      if (!loc) throw new NotFoundException('Warehouse location not found');
      if (loc.warehouseId !== count.warehouseId) {
        throw new BadRequestException('warehouseLocationId does not belong to the physical count warehouse');
      }
    }

    const existing = await this.prisma.inventoryPhysicalCountLine.findFirst({
      where: { physicalCountId, productId, warehouseLocationId: warehouseLocationId ?? null },
    });
    if (existing) throw new BadRequestException('Line already exists for this product and location');

    const balance = await this.prisma.inventoryBalance.findFirst({
      where: { warehouseId: count.warehouseId, productId, locationId: warehouseLocationId ?? null },
      orderBy: { updatedAt: 'desc' },
    });
    const systemQty = balance?.quantity ?? 0;

    const line = await this.prisma.inventoryPhysicalCountLine.create({
      data: {
        physicalCountId,
        productId,
        warehouseLocationId,
        systemQty,
      },
      include: {
        product: { select: { id: true, code: true, name: true, unit: true } },
        warehouseLocation: { select: { id: true, code: true, name: true } },
      },
    });

    await this.audit.log(userId, 'ADD_LINE', 'InventoryPhysicalCountLine', line.id, { physicalCountId, productId });
    return line;
  }

  async enterCount(physicalCountId: string, lineId: string, dto: EnterCountLineDto, userId: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(physicalCountId, ctx);
    if (count.status !== 'DRAFT' && count.status !== 'SUBMITTED' && count.status !== 'REJECTED') {
      throw new BadRequestException('Can only enter counts for DRAFT/SUBMITTED/REJECTED physical counts');
    }

    const line = await this.prisma.inventoryPhysicalCountLine.findUnique({ where: { id: lineId } });
    if (!line || line.physicalCountId !== physicalCountId) throw new NotFoundException('Count line not found');

    const varianceQty = dto.countedQty - line.systemQty;

    const updated = await this.prisma.inventoryPhysicalCountLine.update({
      where: { id: lineId },
      data: {
        countedQty: dto.countedQty,
        varianceQty,
        unitCost: typeof dto.unitCost === 'number' ? dto.unitCost.toString() : undefined,
        currencyCode: dto.currencyCode || undefined,
        valuationReason: dto.valuationReason || undefined,
        notes: dto.notes,
      },
      include: {
        product: { select: { id: true, code: true, name: true, unit: true } },
        warehouseLocation: { select: { id: true, code: true, name: true } },
      },
    });

    await this.audit.log(userId, 'ENTER_COUNT', 'InventoryPhysicalCountLine', lineId, {
      physicalCountId, productId: line.productId, systemQty: line.systemQty,
      countedQty: dto.countedQty, varianceQty,
    });
    return updated;
  }

  async submit(id: string, userId: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    if (count.status !== 'DRAFT') throw new BadRequestException('Only DRAFT physical counts can be submitted');

    const lines = await this.prisma.inventoryPhysicalCountLine.findMany({ where: { physicalCountId: id } });
    if (lines.length === 0) throw new BadRequestException('Cannot submit a physical count with no lines');

    const updated = await this.prisma.inventoryPhysicalCount.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: userId, frozenAt: new Date() },
    });
    await this.audit.log(userId, 'SUBMIT', 'InventoryPhysicalCount', id, { oldStatus: count.status, newStatus: 'SUBMITTED' });
    return updated;
  }

  async approve(id: string, userId: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    if (count.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED physical counts can be approved');

    const updated = await this.prisma.inventoryPhysicalCount.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId },
    });
    await this.audit.log(userId, 'APPROVE', 'InventoryPhysicalCount', id, { oldStatus: count.status, newStatus: 'APPROVED' });
    return updated;
  }

  async reject(id: string, dto: RejectPhysicalCountDto, userId: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    if (count.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED physical counts can be rejected');

    const updated = await this.prisma.inventoryPhysicalCount.update({
      where: { id },
      data: { status: 'DRAFT', rejectedAt: new Date(), rejectedById: userId, rejectedReason: dto.reason },
    });
    await this.audit.log(userId, 'REJECT', 'InventoryPhysicalCount', id, { oldStatus: count.status, newStatus: 'DRAFT', reason: dto.reason });
    return updated;
  }

  /**
   * VAL-R1D: a count surplus (variance > 0) with an explicit cost into an ACTIVE
   * valuation warehouse requires the dedicated valuation cost-input permission
   * (`inventory-valuation:cost-input`). Mirrors the auth PermissionsGuard logic
   * (SUPER_ADMIN short-circuits to allow). Called BEFORE any movement or balance
   * mutation so a denied user never triggers a side effect.
   */
  private async assertValuationCostInputPermission(userId: string): Promise<void> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    for (const ur of userRoles) {
      if (ur.role.status !== 'ACTIVE') continue;
      if (ur.role.code === 'SUPER_ADMIN') return;
      for (const rp of ur.role.permissions) {
        if (rp.permission.status === 'ACTIVE' && rp.permission.key === INVENTORY_VALUATION_PERMISSION_KEYS.costInput) {
          return;
        }
      }
    }
    throw new ForbiddenException({
      messageKey: 'inventoryValuation.missingPermission',
      message: 'The valuation cost-input permission is required to post a count surplus into an ACTIVE valuation warehouse',
    });
  }

  async post(id: string, userId: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    if (count.status !== 'APPROVED') throw new BadRequestException('Only APPROVED physical counts can be posted');

    const lines = await this.prisma.inventoryPhysicalCountLine.findMany({
      where: { physicalCountId: id },
    });

    if (lines.some(l => l.countedQty === null || l.countedQty === undefined)) {
      throw new BadRequestException('All lines must have counted quantity before posting');
    }

    const varianceLines = lines.filter(l => l.varianceQty !== 0);
    if (varianceLines.length === 0) {
      throw new BadRequestException('No variance to post');
    }

    const inLines = varianceLines.filter(l => (l.varianceQty ?? 0) > 0);
    const outLines = varianceLines.filter(l => (l.varianceQty ?? 0) < 0);

    await this.prisma.$transaction(async (tx) => {
      // VAL-R1D: when the warehouse has an ACTIVE valuation policy, count
      // variance is valued: shortage revalues at the current moving average;
      // surplus requires an explicit cost + policy currency + reason (+ the
      // valuation cost-input permission) and is applied as a weighted-average
      // receipt. When no ACTIVE policy exists, the legacy (unvalued) posting
      // applies as before.
      const activePolicy = await this.valuationEngine.findActivePolicyForWarehouse(tx, count.companyId, count.warehouseId);
      if (activePolicy) {
        for (const l of inLines as { unitCost?: any; currencyCode?: string | null; valuationReason?: string | null }[]) {
          if (l.unitCost === null || l.unitCost === undefined) {
            throw new BadRequestException({
              messageKey: 'inventoryValuation.countSurplusCostRequired',
              message: 'A count surplus into an ACTIVE valuation warehouse requires an explicit unit cost',
            });
          }
          const cost = new Prisma.Decimal(l.unitCost.toString());
          if (cost.isNegative()) {
            throw new BadRequestException({
              messageKey: 'inventoryValuation.countSurplusCostRequired',
              message: 'A count surplus unit cost cannot be negative',
            });
          }
          // A free-of-cost surplus must carry an explicit reason so it is never a
          // silent zero write-off into the ACTIVE valuation balance.
          if (cost.isZero() && !(l.valuationReason || '').trim()) {
            throw new BadRequestException({
              messageKey: 'inventoryValuation.countSurplusCostRequired',
              message: 'A zero-cost count surplus requires an explicit valuation reason',
            });
          }
          if ((l.currencyCode || '').toUpperCase() !== activePolicy.currencyCode.toUpperCase()) {
            throw new BadRequestException({
              messageKey: 'inventoryValuation.currencyMismatch',
              message: 'Count surplus currency must match the ACTIVE valuation policy currency',
            });
          }
          await this.assertValuationCostInputPermission(userId);
        }
      }
      await assertWarehouseInContext(tx, count.warehouseId, ctx);

      if (inLines.length > 0) {
        const movNum = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx);

        const movement = await tx.inventoryMovement.create({
          data: {
            movementNumber: movNum,
            companyId: count.companyId,
            branchId: count.branchId,
            warehouseId: count.warehouseId,
            movementType: 'COUNT_VARIANCE_IN',
            status: 'POSTED',
            sourceType: 'PHYSICAL_COUNT',
            sourceId: id,
            movementDate: new Date(),
            postedAt: new Date(),
            postedById: userId,
            notes: `Count variance in from physical count ${count.countNumber}`,
            createdById: userId,
            lines: { create: [] },
          },
        });

        for (const l of inLines) {
          // Capture authoritative Qold BEFORE any physical mutation.
          const qold = await this.valuationEngine.aggregatePhysicalQuantity(tx, count.warehouseId, l.productId);
          // Create the exact InventoryMovementLine for THIS count line.
          const movementLine = await tx.inventoryMovementLine.create({
            data: {
              movementId: movement.id,
              productId: l.productId,
              warehouseLocationId: l.warehouseLocationId,
              quantity: Math.abs(l.varianceQty ?? 0),
              quantityBase: Math.abs(l.varianceQty ?? 0),
              direction: 'IN',
            },
          });
          // Apply physical delta exactly once (keeps quantityBase in sync).
          await this.applyCountBalanceDelta(tx, count.warehouseId, l.productId, l.warehouseLocationId, Math.abs(l.varianceQty ?? 0), 'IN');
          // Apply the valued receipt exactly once using the pre-mutation Qold.
          if (activePolicy) {
            await this.valuationEngine.applyValuedReceipt(tx, {
              companyId: count.companyId,
              warehouseId: count.warehouseId,
              productId: l.productId,
              qold,
              quantity: new Prisma.Decimal(Math.abs(l.varianceQty ?? 0)),
              unitCost: new Prisma.Decimal((l as any).unitCost.toString()),
              currencyCode: activePolicy.currencyCode,
              lineId: movementLine.id,
              movementId: movement.id,
            });
          }
        }
      }

      if (outLines.length > 0) {
        const outMovNum = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx);
        const movement = await tx.inventoryMovement.create({
          data: {
            movementNumber: outMovNum,
            companyId: count.companyId,
            branchId: count.branchId,
            warehouseId: count.warehouseId,
            movementType: 'COUNT_VARIANCE_OUT',
            status: 'POSTED',
            sourceType: 'PHYSICAL_COUNT',
            sourceId: id,
            movementDate: new Date(),
            postedAt: new Date(),
            postedById: userId,
            notes: `Count variance out from physical count ${count.countNumber}`,
            createdById: userId,
            lines: { create: [] },
          },
        });

        for (const l of outLines) {
          // Stale-count protection: capture the authoritative CURRENT Qold before
          // physical mutation; applyValuedIssue blocks if the shortage exceeds it.
          const qold = await this.valuationEngine.aggregatePhysicalQuantity(tx, count.warehouseId, l.productId);
          const movementLine = await tx.inventoryMovementLine.create({
            data: {
              movementId: movement.id,
              productId: l.productId,
              warehouseLocationId: l.warehouseLocationId,
              quantity: Math.abs(l.varianceQty ?? 0),
              quantityBase: Math.abs(l.varianceQty ?? 0),
              direction: 'OUT',
            },
          });
          await this.applyCountBalanceDelta(tx, count.warehouseId, l.productId, l.warehouseLocationId, Math.abs(l.varianceQty ?? 0), 'OUT');
          if (activePolicy) {
            await this.valuationEngine.applyValuedIssue(tx, {
              companyId: count.companyId,
              warehouseId: count.warehouseId,
              productId: l.productId,
              qold,
              quantity: new Prisma.Decimal(Math.abs(l.varianceQty ?? 0)),
              currencyCode: activePolicy.currencyCode,
              lineId: movementLine.id,
              movementId: movement.id,
            });
          }
        }
      }

      await tx.inventoryPhysicalCount.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return this.findOne(id, ctx);
  }

  async cancel(id: string, userId: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    if (count.status !== 'DRAFT' && count.status !== 'APPROVED') {
      throw new BadRequestException('Only DRAFT or APPROVED physical counts can be cancelled');
    }

    const updated = await this.prisma.inventoryPhysicalCount.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryPhysicalCount', id, { oldStatus: count.status, newStatus: 'CANCELLED' });
    return updated;
  }

  async results(id: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    const lines = count.lines;
    const totalLines = lines.length;
    const countedLines = lines.filter(l => l.countedQty !== null && l.countedQty !== undefined).length;
    const totalVariance = lines.reduce((s, l) => s + (l.varianceQty ?? 0), 0);
    const totalIn = lines.filter(l => (l.varianceQty ?? 0) > 0).reduce((s, l) => s + (l.varianceQty ?? 0), 0);
    const totalOut = lines.filter(l => (l.varianceQty ?? 0) < 0).reduce((s, l) => s + Math.abs(l.varianceQty ?? 0), 0);
    return { count, results: { totalLines, countedLines, totalVariance, totalIn, totalOut }, lines };
  }

  async history(id: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    const auditLogs = await this.prisma.auditLog.findMany({
      where: { entity: 'InventoryPhysicalCount', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { count, auditLogs };
  }

  /**
   * VAL-R1D: applies the count variance to the physical balance exactly ONCE per
   * count line, keeping the Float quantity AND the quantityBase twin in sync so
   * the engine's physical authority (SUM(quantityBase)) never diverges. Creates
   * the balance row if it does not exist.
   */
  private async applyCountBalanceDelta(
    tx: any,
    warehouseId: string,
    productId: string,
    locationId: string | null | undefined,
    quantity: number,
    direction: 'IN' | 'OUT',
  ) {
    const where: any = { warehouseId, productId };
    if (locationId) where.locationId = locationId; else where.locationId = null;
    let bal = await tx.inventoryBalance.findFirst({ where });
    const delta = new Prisma.Decimal(quantity).mul(direction === 'IN' ? 1 : -1);
    if (!bal) {
      bal = await tx.inventoryBalance.create({
        data: { warehouseId, productId, locationId: locationId || null, quantity: 0, quantityBase: 0 },
      });
    }
    const currentBase =
      bal.quantityBase !== null && bal.quantityBase !== undefined
        ? new Prisma.Decimal(bal.quantityBase.toString())
        : new Prisma.Decimal(bal.quantity);
    const nextBase = currentBase.add(delta);
    if (nextBase.isNegative()) {
      throw new BadRequestException(
        `Insufficient stock for product ${productId} during physical count posting. Available: ${currentBase.toString()}, Variance: ${quantity}`,
      );
    }
    await tx.inventoryBalance.update({
      where: { id: bal.id },
      data: { quantity: Number(nextBase.toFixed(4)), quantityBase: nextBase },
    });
  }
}
