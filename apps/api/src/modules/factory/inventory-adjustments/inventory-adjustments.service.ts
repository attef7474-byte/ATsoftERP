import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { CreateInventoryAdjustmentDto, CreateInventoryAdjustmentLineDto } from './dto/create-inventory-adjustment.dto';
import { UpdateInventoryAdjustmentDto } from './dto/update-inventory-adjustment.dto';
import { InventoryAdjustmentQueryDto } from './dto/inventory-adjustment-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  assertRowInContext,
  assertWarehouseInContext,
  assertInventoryCountInContext,
} from '../../../common/operational-context/tenant-guards';

@Injectable()
export class InventoryAdjustmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
  ) {}

  private toUndefined(val: string | null | undefined): string | undefined {
    return val ?? undefined;
  }

  async create(dto: CreateInventoryAdjustmentDto, userId: string, ctx: ActiveOperationalContext) {
    await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);
    if (dto.inventoryCountId) {
      await assertInventoryCountInContext(this.prisma, dto.inventoryCountId, ctx);
    }

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new NotFoundException(`Product ${line.productId} not found`);
      if (line.warehouseLocationId) {
        const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: line.warehouseLocationId } });
        if (!loc || loc.warehouseId !== dto.warehouseId) {
          throw new BadRequestException('warehouseLocationId does not belong to the selected warehouse');
        }
      }
    }

    const adjustment = await this.prisma.$transaction(async (tx) => {
      await assertWarehouseInContext(tx, dto.warehouseId, ctx);
      if (dto.inventoryCountId) {
        await assertInventoryCountInContext(tx, dto.inventoryCountId, ctx);
      }
      const adjustmentNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_ADJUSTMENT', tx);

      const { lines, ...rest } = dto;

      return tx.inventoryAdjustment.create({
        data: {
          ...rest,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          adjustmentNumber,
          status: 'DRAFT',
          createdById: userId,
          lines: {
            create: lines.map((l) => ({
              productId: l.productId,
              warehouseLocationId: l.warehouseLocationId,
              systemQty: l.systemQty,
              countedQty: l.countedQty,
              differenceQty: l.countedQty - l.systemQty,
              notes: l.notes,
            })),
          },
        },
        include: { lines: true },
      });
    });

    await this.audit.log(userId, 'CREATE', 'InventoryAdjustment', adjustment.id, { adjustmentNumber: adjustment.adjustmentNumber });
    return adjustment;
  }

  async findAll(query: InventoryAdjustmentQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    if (ctx.branchId) where.branchId = ctx.branchId;
    if (query.search) {
      where.OR = [
        { adjustmentNumber: { contains: query.search } },
        { notes: { contains: query.search } },
        { reason: { contains: query.search } },
      ];
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.inventoryCountId) where.inventoryCountId = query.inventoryCountId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryAdjustment.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryAdjustment.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const adjustment = await this.prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        company: true,
        branch: true,
        warehouse: true,
        inventoryCount: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        },

      },
    });
    if (!adjustment || adjustment.deletedAt) throw new NotFoundException('Inventory adjustment not found');
    assertRowInContext(adjustment, ctx, 'inventory adjustment');
    return adjustment;
  }

  async update(id: string, dto: UpdateInventoryAdjustmentDto, userId: string, ctx: ActiveOperationalContext) {
    const adjustment = await this.findOne(id, ctx);
    if (adjustment.status !== 'DRAFT') throw new BadRequestException('Only DRAFT adjustments can be updated');

    const updated = await this.prisma.inventoryAdjustment.update({
      where: { id },
      data: { reason: dto.reason, notes: dto.notes },
    });
    await this.audit.log(userId, 'UPDATE', 'InventoryAdjustment', id, { dto });
    return updated;
  }

  async generateFromCount(countId: string, userId: string, ctx: ActiveOperationalContext) {
    await assertInventoryCountInContext(this.prisma, countId, ctx);

    const count = await this.prisma.inventoryCount.findUnique({
      where: { id: countId },
      include: {
        lines: {
          include: { product: { select: { id: true, name: true, code: true } } },
        },
      },
    });
    if (!count) throw new NotFoundException('Inventory count not found');
    if (count.status !== 'COMPLETED') throw new BadRequestException('Only COMPLETED counts can generate adjustments');
    await assertWarehouseInContext(this.prisma, count.warehouseId, ctx);

    const existing = await this.prisma.inventoryAdjustment.findFirst({
      where: { inventoryCountId: countId, deletedAt: null },
    });
    if (existing) throw new BadRequestException('Adjustment already exists for this count');

    const lines = count.lines
      .filter((l) => l.differenceQty !== 0)
      .map((l) => ({
        productId: l.productId,
        warehouseLocationId: l.warehouseLocationId || undefined,
        systemQty: l.systemQty,
        countedQty: l.countedQty ?? 0,
        differenceQty: l.differenceQty ?? 0,
        notes: `Generated from count ${count.countNumber || countId}`,
      }));

    if (lines.length === 0) throw new BadRequestException('No lines with non-zero difference to adjust');

    for (const l of lines) {
      if (l.warehouseLocationId) {
        const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: l.warehouseLocationId } });
        if (!loc || loc.warehouseId !== count.warehouseId) {
          throw new BadRequestException('warehouseLocationId does not belong to the count warehouse');
        }
      }
    }

    const adjustment = await this.prisma.$transaction(async (tx) => {
      const adjustmentNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_ADJUSTMENT', tx);

      return tx.inventoryAdjustment.create({
        data: {
          companyId: count.companyId,
          branchId: count.branchId,
          warehouseId: count.warehouseId,
          adjustmentNumber,
          inventoryCountId: countId,
          reason: 'Auto-generated from inventory count',
          status: 'DRAFT',
          createdById: userId,
          lines: {
            create: lines,
          },
        },
        include: { lines: true },
      });
    });

    await this.audit.log(userId, 'GENERATE_FROM_COUNT', 'InventoryAdjustment', adjustment.id, { countId });
    return adjustment;
  }

  async post(id: string, userId: string, ctx: ActiveOperationalContext) {
    const adjustment = await this.prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!adjustment || adjustment.deletedAt) throw new NotFoundException('Inventory adjustment not found');
    assertRowInContext(adjustment, ctx, 'inventory adjustment');
    if (adjustment.status !== 'DRAFT') throw new BadRequestException('Only DRAFT adjustments can be posted');

    const posted = await this.prisma.$transaction(async (tx) => {
      await assertWarehouseInContext(tx, adjustment.warehouseId, ctx);
      for (const line of adjustment.lines) {
        const balance = await this.getOrCreateBalance(tx, adjustment.warehouseId, line.productId, line.warehouseLocationId);

        const newQuantity = balance.quantity + line.differenceQty;

        if (newQuantity < 0) {
          const product = await tx.product.findUnique({ where: { id: line.productId } });
          throw new BadRequestException(
            `Insufficient stock for product ${product?.name || line.productId}. Available: ${balance.quantity}, Adjustment: ${line.differenceQty}`,
          );
        }

        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: { quantity: newQuantity },
        });
      }

      return tx.inventoryAdjustment.update({
        where: { id },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedById: userId,
        },
        include: { lines: true },
      });
    });

    await this.audit.log(userId, 'POST', 'InventoryAdjustment', id,
      { oldStatus: 'DRAFT', newStatus: 'POSTED', warehouseId: adjustment.warehouseId, lineCount: adjustment.lines.length });
    return posted;
  }

  async cancel(id: string, userId: string, ctx: ActiveOperationalContext) {
    const adjustment = await this.prisma.inventoryAdjustment.findUnique({ where: { id } });
    if (!adjustment || adjustment.deletedAt) throw new NotFoundException('Inventory adjustment not found');
    assertRowInContext(adjustment, ctx, 'inventory adjustment');
    if (adjustment.status !== 'DRAFT') throw new BadRequestException('Only DRAFT adjustments can be cancelled');

    const updated = await this.prisma.inventoryAdjustment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryAdjustment', id,
      { oldStatus: adjustment.status, newStatus: 'CANCELLED' });
    return updated;
  }

  async addLine(id: string, dto: CreateInventoryAdjustmentLineDto, userId: string, ctx: ActiveOperationalContext) {
    const adj = await this.findOne(id, ctx);
    if (adj.status !== 'DRAFT') throw new BadRequestException('Only DRAFT adjustments can be modified');
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.warehouseLocationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: dto.warehouseLocationId } });
      if (!loc || loc.warehouseId !== adj.warehouseId) {
        throw new BadRequestException('warehouseLocationId does not belong to the adjustment warehouse');
      }
    }

    const line = await this.prisma.inventoryAdjustmentLine.create({
      data: {
        adjustmentId: id, productId: dto.productId, warehouseLocationId: dto.warehouseLocationId,
        systemQty: dto.systemQty, countedQty: dto.countedQty, differenceQty: dto.countedQty - dto.systemQty, notes: dto.notes,
      },
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'ADD_LINE', 'InventoryAdjustment', id, { lineId: line.id, productId: dto.productId });
    return line;
  }

  async updateLine(id: string, lineId: string, dto: Partial<CreateInventoryAdjustmentLineDto>, userId: string, ctx: ActiveOperationalContext) {
    const adj = await this.findOne(id, ctx);
    if (adj.status !== 'DRAFT') throw new BadRequestException('Only DRAFT adjustments can be modified');
    const line = await this.prisma.inventoryAdjustmentLine.findUnique({ where: { id: lineId } });
    if (!line || line.adjustmentId !== id) throw new NotFoundException('Adjustment line not found');

    if (dto.warehouseLocationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: dto.warehouseLocationId } });
      if (!loc || loc.warehouseId !== adj.warehouseId) {
        throw new BadRequestException('warehouseLocationId does not belong to the adjustment warehouse');
      }
    }

    const updateData: any = { ...dto };
    if (dto.countedQty !== undefined || dto.systemQty !== undefined) {
      const sysQty = dto.systemQty ?? line.systemQty;
      const cntQty = dto.countedQty ?? line.countedQty;
      updateData.differenceQty = cntQty - sysQty;
    }

    const updated = await this.prisma.inventoryAdjustmentLine.update({
      where: { id: lineId }, data: updateData,
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'UPDATE_LINE', 'InventoryAdjustment', id, { lineId });
    return updated;
  }

  async removeLine(id: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    const adj = await this.findOne(id, ctx);
    if (adj.status !== 'DRAFT') throw new BadRequestException('Only DRAFT adjustments can be modified');
    const line = await this.prisma.inventoryAdjustmentLine.findUnique({ where: { id: lineId } });
    if (!line || line.adjustmentId !== id) throw new NotFoundException('Adjustment line not found');

    await this.prisma.inventoryAdjustmentLine.delete({ where: { id: lineId } });
    await this.audit.log(userId, 'REMOVE_LINE', 'InventoryAdjustment', id, { lineId });
    return { message: 'Line removed successfully' };
  }

  async summary(id: string, ctx: ActiveOperationalContext) {
    const adj = await this.findOne(id, ctx);
    const lines = await this.prisma.inventoryAdjustmentLine.findMany({
      where: { adjustmentId: id },
      select: { systemQty: true, countedQty: true, differenceQty: true },
    });
    const totalPosDiff = lines.filter(l => l.differenceQty > 0).reduce((s, l) => s + l.differenceQty, 0);
    const totalNegDiff = lines.filter(l => l.differenceQty < 0).reduce((s, l) => s + l.differenceQty, 0);
    return {
      adjustmentId: id, adjustmentNumber: adj.adjustmentNumber, status: adj.status,
      lineCount: lines.length, totalPositiveDifference: totalPosDiff, totalNegativeDifference: totalNegDiff,
    };
  }

  private async getOrCreateBalance(tx: any, warehouseId: string, productId: string, locationId: string | null | undefined) {
    const where: any = { warehouseId, productId };
    if (locationId) where.locationId = locationId; else where.locationId = null;
    let balance = await tx.inventoryBalance.findFirst({ where });
    if (!balance) {
      balance = await tx.inventoryBalance.create({
        data: { warehouseId, productId, locationId: locationId || null, quantity: 0 },
      });
    }
    return balance;
  }
}
