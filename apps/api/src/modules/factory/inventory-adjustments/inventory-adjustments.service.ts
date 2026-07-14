import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { UpdateInventoryAdjustmentDto } from './dto/update-inventory-adjustment.dto';
import { InventoryAdjustmentQueryDto } from './dto/inventory-adjustment-query.dto';

@Injectable()
export class InventoryAdjustmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private toUndefined(val: string | null | undefined): string | undefined {
    return val ?? undefined;
  }

  async create(dto: CreateInventoryAdjustmentDto, userId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new NotFoundException(`Product ${line.productId} not found`);
    }

    const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'INVENTORY_ADJUSTMENT' } });
    if (!seq) throw new NotFoundException('Number sequence INVENTORY_ADJUSTMENT not configured');

    const adjustment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const adjustmentNumber = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

      const { lines, ...rest } = dto;

      return tx.inventoryAdjustment.create({
        data: {
          ...rest,
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

  async findAll(query: InventoryAdjustmentQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { adjustmentNumber: { contains: query.search } },
        { notes: { contains: query.search } },
        { reason: { contains: query.search } },
      ];
    }
    if (query.companyId) where.companyId = query.companyId;
    if (query.branchId) where.branchId = query.branchId;
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

  async findOne(id: string) {
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
    return adjustment;
  }

  async update(id: string, dto: UpdateInventoryAdjustmentDto, userId: string) {
    const adjustment = await this.findOne(id);
    if (adjustment.status !== 'DRAFT') throw new BadRequestException('Only DRAFT adjustments can be updated');

    const updated = await this.prisma.inventoryAdjustment.update({
      where: { id },
      data: { reason: dto.reason, notes: dto.notes },
    });
    await this.audit.log(userId, 'UPDATE', 'InventoryAdjustment', id, { dto });
    return updated;
  }

  async generateFromCount(countId: string, userId: string) {
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

    const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'INVENTORY_ADJUSTMENT' } });
    if (!seq) throw new NotFoundException('Number sequence INVENTORY_ADJUSTMENT not configured');

    const adjustment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const adjustmentNumber = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

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

  async post(id: string, userId: string) {
    const adjustment = await this.prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!adjustment || adjustment.deletedAt) throw new NotFoundException('Inventory adjustment not found');
    if (adjustment.status !== 'DRAFT') throw new BadRequestException('Only DRAFT adjustments can be posted');

    const posted = await this.prisma.$transaction(async (tx) => {
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

    await this.audit.log(userId, 'POST', 'InventoryAdjustment', id);
    return posted;
  }

  async cancel(id: string, userId: string) {
    const adjustment = await this.prisma.inventoryAdjustment.findUnique({ where: { id } });
    if (!adjustment || adjustment.deletedAt) throw new NotFoundException('Inventory adjustment not found');
    if (adjustment.status !== 'DRAFT') throw new BadRequestException('Only DRAFT adjustments can be cancelled');

    const updated = await this.prisma.inventoryAdjustment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryAdjustment', id);
    return updated;
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
