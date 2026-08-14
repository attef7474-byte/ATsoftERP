import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateInventoryCountLineDto } from './dto/create-inventory-count-line.dto';
import { UpdateInventoryCountLineDto } from './dto/update-inventory-count-line.dto';
import { CountInventoryCountLineDto } from './dto/count-inventory-count-line.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { assertWarehouseInContext } from '../../../common/operational-context/tenant-guards';

@Injectable()
export class InventoryCountLinesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private branchScope(ctx: ActiveOperationalContext) {
    return {
      OR: [{ branchId: null }, { branchId: ctx.branchId }],
    };
  }

  private warehouseScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      deletedAt: null,
      AND: [this.branchScope(ctx)],
    };
  }

  private countScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      deletedAt: null,
      warehouse: this.warehouseScope(ctx),
    };
  }

  private async findOwnedCount(
    client: any,
    countId: string,
    ctx: ActiveOperationalContext,
  ) {
    const count = await client.inventoryCount.findFirst({
      where: {
        id: countId,
        ...this.countScope(ctx),
      },
    });
    if (!count) {
      throw new NotFoundException('Inventory count not found');
    }
    return count;
  }

  private async assertLocationInWarehouse(
    client: any,
    warehouseLocationId: string | undefined,
    warehouseId: string,
  ) {
    if (!warehouseLocationId) return;
    const location = await client.warehouseLocation.findFirst({
      where: {
        id: warehouseLocationId,
        warehouseId,
        status: 'ACTIVE',
      },
    });
    if (!location) {
      throw new BadRequestException(
        'warehouseLocationId does not belong to the inventory count warehouse',
      );
    }
  }

  async create(
    countId: string,
    dto: CreateInventoryCountLineDto,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const count = await this.findOwnedCount(this.prisma, countId, ctx);
    if (count.status !== 'DRAFT' && count.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Lines can only be added to DRAFT or IN_PROGRESS counts',
      );
    }
    await assertWarehouseInContext(this.prisma, count.warehouseId, ctx);
    await this.assertLocationInWarehouse(
      this.prisma,
      dto.warehouseLocationId,
      count.warehouseId,
    );

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const line = await this.prisma.$transaction(async (tx) => {
      const currentCount = await this.findOwnedCount(tx, countId, ctx);
      if (
        currentCount.status !== 'DRAFT' &&
        currentCount.status !== 'IN_PROGRESS'
      ) {
        throw new BadRequestException(
          'Lines can only be added to DRAFT or IN_PROGRESS counts',
        );
      }
      await assertWarehouseInContext(tx, currentCount.warehouseId, ctx);
      await this.assertLocationInWarehouse(
        tx,
        dto.warehouseLocationId,
        currentCount.warehouseId,
      );

      const currentProduct = await tx.product.findFirst({
        where: { id: dto.productId, deletedAt: null },
      });
      if (!currentProduct) {
        throw new NotFoundException('Product not found');
      }

      const existing = await tx.inventoryCountLine.findFirst({
        where: {
          countId,
          productId: dto.productId,
          warehouseLocationId: dto.warehouseLocationId ?? null,
          deletedAt: null,
          count: this.countScope(ctx),
        },
      });
      if (existing) {
        throw new BadRequestException(
          'A line for this product and location already exists in this count',
        );
      }

      const balance = await tx.inventoryBalance.findFirst({
        where: {
          warehouseId: currentCount.warehouseId,
          productId: dto.productId,
          locationId: dto.warehouseLocationId ?? null,
          warehouse: this.warehouseScope(ctx),
        },
      });
      const systemQty = dto.systemQty ?? (balance?.quantity ?? 0);

      return tx.inventoryCountLine.create({
        data: {
          countId,
          productId: dto.productId,
          warehouseLocationId: dto.warehouseLocationId,
          systemQty,
          notes: dto.notes,
          status: 'PENDING',
        },
      });
    });

    await this.audit.log(
      userId,
      'CREATE',
      'InventoryCountLine',
      line.id,
      { countId, productId: dto.productId },
    );
    return line;
  }

  async findByCountId(
    countId: string,
    ctx: ActiveOperationalContext,
  ) {
    await this.findOwnedCount(this.prisma, countId, ctx);
    return this.prisma.inventoryCountLine.findMany({
      where: {
        countId,
        deletedAt: null,
        count: this.countScope(ctx),
      },
      include: {
        product: { select: { id: true, code: true, name: true } },
        warehouseLocation: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const line = await this.prisma.inventoryCountLine.findFirst({
      where: {
        id,
        deletedAt: null,
        count: this.countScope(ctx),
      },
      include: {
        count: true,
        product: { select: { id: true, code: true, name: true } },
        warehouseLocation: {
          select: { id: true, code: true, name: true },
        },
      },
    });
    if (!line) {
      throw new NotFoundException('Inventory count line not found');
    }
    return line;
  }

  async update(
    id: string,
    dto: UpdateInventoryCountLineDto,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const line = await this.findOne(id, ctx);
    if (line.status === 'VERIFIED') {
      throw new BadRequestException('Cannot update verified lines');
    }
    if (line.status !== 'PENDING' && line.status !== 'COUNTED') {
      throw new BadRequestException(
        'Only PENDING or COUNTED lines can be updated',
      );
    }

    const updated = await this.prisma.inventoryCountLine.update({
      where: { id },
      data: {
        ...(dto.systemQty !== undefined && {
          systemQty: dto.systemQty,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.audit.log(userId, 'UPDATE', 'InventoryCountLine', id, {
      oldStatus: line.status,
      dto,
    });
    return updated;
  }

  async countLine(
    id: string,
    dto: CountInventoryCountLineDto,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const line = await this.findOne(id, ctx);
    if (line.status === 'VERIFIED') {
      throw new BadRequestException('Cannot count a verified line');
    }
    if (line.status !== 'PENDING' && line.status !== 'COUNTED') {
      throw new BadRequestException(
        'Only PENDING or COUNTED lines can be counted',
      );
    }

    const differenceQty = dto.countedQty - line.systemQty;

    const updated = await this.prisma.inventoryCountLine.update({
      where: { id },
      data: {
        status: 'COUNTED',
        countedQty: dto.countedQty,
        differenceQty,
        countedAt: new Date(),
        countedById: userId,
      },
    });

    await this.audit.log(userId, 'COUNT', 'InventoryCountLine', id, {
      oldStatus: line.status,
      newStatus: 'COUNTED',
      countedQty: dto.countedQty,
      systemQty: line.systemQty,
      differenceQty,
    });
    return updated;
  }

  async verify(
    id: string,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const line = await this.findOne(id, ctx);
    if (line.status !== 'COUNTED') {
      throw new BadRequestException(
        'Only COUNTED lines can be verified',
      );
    }

    const updated = await this.prisma.inventoryCountLine.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedById: userId,
      },
    });

    await this.audit.log(userId, 'VERIFY', 'InventoryCountLine', id, {
      oldStatus: line.status,
      newStatus: 'VERIFIED',
      countId: line.countId,
    });
    return updated;
  }
}
