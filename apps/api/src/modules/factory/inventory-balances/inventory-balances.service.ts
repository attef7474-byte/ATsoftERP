import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { InventoryBalanceQueryDto } from './dto/inventory-balance-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { assertRowInContext } from '../../../common/operational-context/tenant-guards';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Injectable()
export class InventoryBalancesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private valuationEngine: InventoryValuationEngineService,
  ) {}

  private balanceWhere(ctx: ActiveOperationalContext): any {
    return {
      warehouse: {
        companyId: ctx.companyId,
        ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
    };
  }

  async findAll(query: InventoryBalanceQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = this.balanceWhere(ctx);
    if (query.search) {
      where.OR = [
        { product: { name: { contains: query.search } } },
        { product: { code: { contains: query.search } } },
      ];
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.productId) where.productId = query.productId;

    const [data, total] = await Promise.all([
      this.prisma.inventoryBalance.findMany({
        where, skip, take: limit, orderBy: { updatedAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          location: { select: { id: true, code: true, name: true } },
          product: { select: { id: true, code: true, name: true, unit: true } },
        },
      }),
      this.prisma.inventoryBalance.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const balance = await this.prisma.inventoryBalance.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true, companyId: true, branchId: true } },
        location: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, code: true, name: true, unit: true } },
      },
    });
    if (!balance) throw new NotFoundException('Balance not found');
    assertRowInContext(balance.warehouse, ctx, 'inventory balance');
    return balance;
  }

  async findByProduct(productId: string, ctx: ActiveOperationalContext) {
    return this.prisma.inventoryBalance.findMany({
      where: { productId, ...this.balanceWhere(ctx) },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async findByLocation(locationId: string, ctx: ActiveOperationalContext) {
    return this.prisma.inventoryBalance.findMany({
      where: { locationId, ...this.balanceWhere(ctx) },
      include: {
        product: { select: { id: true, code: true, name: true, unit: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async recalculate(userId: string, ctx: ActiveOperationalContext) {
    const branchFilter = ctx.branchId ? { branchId: ctx.branchId } : {};
    await this.prisma.$transaction(async (tx) => {
      // VAL-R1C: rebuild-from-history is destructive and would wipe monetary
      // valuation balances; block it when any in-scope warehouse is ACTIVE.
      const activeWarehouses = await this.valuationEngine.findActivePoliciesInScope(tx, ctx.companyId, ctx.branchId ?? undefined);
      if (activeWarehouses.length > 0) {
        throw new BadRequestException({
          messageKey: 'inventoryValuation.unsupportedActiveFlow',
          message: 'Balance recalculation is blocked while an ACTIVE valuation policy exists in scope',
        });
      }
      await tx.inventoryBalance.deleteMany({ where: this.balanceWhere(ctx) });

      const movements = await tx.inventoryMovement.findMany({
        where: {
          status: 'POSTED', deletedAt: null, companyId: ctx.companyId, ...branchFilter,
          warehouse: { companyId: ctx.companyId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) },
        },
        include: { lines: true },
      });

      for (const movement of movements) {
        for (const line of movement.lines) {
          const where: any = {
            warehouseId: movement.warehouseId,
            productId: line.productId,
          };
          if (line.warehouseLocationId) {
            where.locationId = line.warehouseLocationId;
          } else {
            where.locationId = null;
          }

          const delta = line.direction === 'IN' ? line.quantity : -line.quantity;
          const existing = await tx.inventoryBalance.findFirst({ where });
          if (existing) {
            await tx.inventoryBalance.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + delta },
            });
          } else {
            await tx.inventoryBalance.create({
              data: {
                warehouseId: movement.warehouseId,
                locationId: line.warehouseLocationId,
                productId: line.productId,
                quantity: delta,
              },
            });
          }
        }
      }

      const adjustments = await tx.inventoryAdjustment.findMany({
        where: {
          status: 'POSTED', deletedAt: null, companyId: ctx.companyId, ...branchFilter,
          warehouse: { companyId: ctx.companyId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) },
        },
        include: { lines: true },
      });

      for (const adj of adjustments) {
        for (const line of adj.lines) {
          const where: any = {
            warehouseId: adj.warehouseId,
            productId: line.productId,
          };
          if (line.warehouseLocationId) {
            where.locationId = line.warehouseLocationId;
          } else {
            where.locationId = null;
          }

          const existing = await tx.inventoryBalance.findFirst({ where });
          if (existing) {
            await tx.inventoryBalance.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + line.differenceQty },
            });
          } else {
            await tx.inventoryBalance.create({
              data: {
                warehouseId: adj.warehouseId,
                locationId: line.warehouseLocationId,
                productId: line.productId,
                quantity: line.differenceQty,
              },
            });
          }
        }
      }
    });

    await this.audit.log(userId, 'RECALCULATE', 'InventoryBalance', undefined, { companyId: ctx.companyId, branchId: ctx.branchId });
    return { message: 'Inventory balances recalculated successfully' };
  }

  async getBalanceSummary(ctx: ActiveOperationalContext) {
    const [total, totalProducts, totalQty, warehouseDistinct] = await Promise.all([
      this.prisma.inventoryBalance.count({ where: this.balanceWhere(ctx) }),
      this.prisma.inventoryBalance.groupBy({ by: ['productId'], where: this.balanceWhere(ctx), _count: true }),
      this.prisma.inventoryBalance.aggregate({ where: this.balanceWhere(ctx), _sum: { quantity: true } }),
      this.prisma.inventoryBalance.groupBy({ by: ['warehouseId'], where: this.balanceWhere(ctx), _count: true }),
    ]);

    return {
      totalBalances: total,
      totalProducts: totalProducts.length,
      totalQuantity: totalQty._sum.quantity || 0,
      totalWarehouses: warehouseDistinct.length,
      byWarehouse: warehouseDistinct.map((w) => ({ warehouseId: w.warehouseId, count: w._count })),
    };
  }

  async getCountSummary(ctx: ActiveOperationalContext) {
    const branchFilter = ctx.branchId ? { branchId: ctx.branchId } : {};
    const [total, draft, inProgress, completed, cancelled] = await Promise.all([
      this.prisma.inventoryCount.count({ where: { deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryCount.count({ where: { status: 'DRAFT', deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryCount.count({ where: { status: 'IN_PROGRESS', deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryCount.count({ where: { status: 'COMPLETED', deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryCount.count({ where: { status: 'CANCELLED', deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
    ]);
    return { total, draft, inProgress, completed, cancelled };
  }

  async getMovementSummary(ctx: ActiveOperationalContext) {
    const branchFilter = ctx.branchId ? { branchId: ctx.branchId } : {};
    const [total, draft, posted, cancelled, inQty, outQty] = await Promise.all([
      this.prisma.inventoryMovement.count({ where: { deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryMovement.count({ where: { status: 'DRAFT', deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryMovement.count({ where: { status: 'POSTED', deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryMovement.count({ where: { status: 'CANCELLED', deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryMovementLine.aggregate({
        where: { movement: { status: 'POSTED', deletedAt: null, companyId: ctx.companyId, ...branchFilter }, direction: 'IN' },
        _sum: { quantity: true },
      }),
      this.prisma.inventoryMovementLine.aggregate({
        where: { movement: { status: 'POSTED', deletedAt: null, companyId: ctx.companyId, ...branchFilter }, direction: 'OUT' },
        _sum: { quantity: true },
      }),
    ]);
    return {
      total, draft, posted, cancelled,
      totalInQty: inQty._sum.quantity || 0,
      totalOutQty: outQty._sum.quantity || 0,
    };
  }

  async getAdjustmentSummary(ctx: ActiveOperationalContext) {
    const branchFilter = ctx.branchId ? { branchId: ctx.branchId } : {};
    const [total, draft, posted, cancelled, totalPos, totalNeg] = await Promise.all([
      this.prisma.inventoryAdjustment.count({ where: { deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryAdjustment.count({ where: { status: 'DRAFT', deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryAdjustment.count({ where: { status: 'POSTED', deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryAdjustment.count({ where: { status: 'CANCELLED', deletedAt: null, companyId: ctx.companyId, ...branchFilter } }),
      this.prisma.inventoryAdjustmentLine.aggregate({
        where: { adjustment: { status: 'POSTED', deletedAt: null, companyId: ctx.companyId, ...branchFilter }, differenceQty: { gt: 0 } },
        _sum: { differenceQty: true },
      }),
      this.prisma.inventoryAdjustmentLine.aggregate({
        where: { adjustment: { status: 'POSTED', deletedAt: null, companyId: ctx.companyId, ...branchFilter }, differenceQty: { lt: 0 } },
        _sum: { differenceQty: true },
      }),
    ]);
    return {
      total, draft, posted, cancelled,
      totalPositiveAdjustment: totalPos._sum.differenceQty || 0,
      totalNegativeAdjustment: totalNeg._sum.differenceQty || 0,
    };
  }
}
