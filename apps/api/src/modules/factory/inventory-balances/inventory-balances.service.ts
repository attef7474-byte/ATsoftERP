import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { InventoryBalanceQueryDto } from './dto/inventory-balance-query.dto';

@Injectable()
export class InventoryBalancesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(query: InventoryBalanceQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
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

  async findByProduct(productId: string) {
    return this.prisma.inventoryBalance.findMany({
      where: { productId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async recalculate(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryBalance.deleteMany({});

      const movements = await tx.inventoryMovement.findMany({
        where: { status: 'POSTED', deletedAt: null },
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
        where: { status: 'POSTED', deletedAt: null },
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

    await this.audit.log(userId, 'RECALCULATE', 'InventoryBalance', undefined);
    return { message: 'Inventory balances recalculated successfully' };
  }
}
