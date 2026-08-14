import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { CreateInventoryCountDto } from './dto/create-inventory-count.dto';
import { UpdateInventoryCountDto } from './dto/update-inventory-count.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { assertWarehouseInContext } from '../../../common/operational-context/tenant-guards';

@Injectable()
export class InventoryCountsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
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

  private countByIdScope(id: string, ctx: ActiveOperationalContext) {
    return {
      id,
      ...this.countScope(ctx),
    };
  }

  private async assertWarehouseChangeHasNoLines(
    client: any,
    countId: string,
    currentWarehouseId: string,
    targetWarehouseId: string,
  ) {
    if (currentWarehouseId === targetWarehouseId) return;
    const existingLine = await client.inventoryCountLine.findFirst({
      where: { countId, deletedAt: null },
      select: { id: true },
    });
    if (existingLine) {
      throw new BadRequestException(
        'Cannot change the inventory count warehouse after count lines exist',
      );
    }
  }

  async create(
    dto: CreateInventoryCountDto,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);

    const count = await this.prisma.$transaction(async (tx) => {
      await assertWarehouseInContext(tx, dto.warehouseId, ctx);
      const countNumber =
        await this.numberingService.generateNumberAtomicWithClient(
          'INVENTORY_COUNT',
          tx,
        );

      return tx.inventoryCount.create({
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
    });

    await this.audit.log(
      userId,
      'CREATE',
      'InventoryCount',
      count.id,
      { countNumber: count.countNumber },
    );
    return count;
  }

  async findAll(
    query: {
      page?: number;
      limit?: number;
      search?: string;
      warehouseId?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    ctx: ActiveOperationalContext,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    if (query.warehouseId) {
      await assertWarehouseInContext(this.prisma, query.warehouseId, ctx);
    }

    const where: any = {
      ...this.countScope(ctx),
    };
    if (query.search) {
      where.AND = [{
        OR: [
          { countNumber: { contains: query.search } },
          { notes: { contains: query.search } },
        ],
      }];
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.countDate = {};
      if (query.dateFrom) where.countDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.countDate.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryCount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryCount.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const count = await this.prisma.inventoryCount.findFirst({
      where: this.countByIdScope(id, ctx),
      include: {
        company: true,
        branch: true,
        warehouse: true,
        lines: {
          where: { deletedAt: null },
          include: {
            product: { select: { id: true, code: true, name: true } },
            warehouseLocation: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });
    if (!count) {
      throw new NotFoundException('Inventory count not found');
    }
    return count;
  }

  async update(
    id: string,
    dto: UpdateInventoryCountDto,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const count = await this.findOne(id, ctx);
    if (count.status === 'COMPLETED' || count.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot update completed or cancelled counts',
      );
    }

    if (dto.warehouseId) {
      await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);
      await this.assertWarehouseChangeHasNoLines(
        this.prisma,
        id,
        count.warehouseId,
        dto.warehouseId,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryCount.findFirst({
        where: this.countByIdScope(id, ctx),
      });
      if (!current) {
        throw new NotFoundException('Inventory count not found');
      }
      const warehouseId = dto.warehouseId ?? current.warehouseId;
      await assertWarehouseInContext(tx, warehouseId, ctx);
      await this.assertWarehouseChangeHasNoLines(
        tx,
        id,
        current.warehouseId,
        warehouseId,
      );

      return tx.inventoryCount.update({
        where: { id },
        data: {
          ...(dto.warehouseId !== undefined && {
            warehouseId: dto.warehouseId,
          }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      });
    });

    await this.audit.log(userId, 'UPDATE', 'InventoryCount', id, {
      oldStatus: count.status,
      dto,
    });
    return updated;
  }

  async start(
    id: string,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const count = await this.findOne(id, ctx);
    if (count.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT counts can be started');
    }
    const updated = await this.prisma.inventoryCount.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        startedById: userId,
      },
    });
    await this.audit.log(userId, 'START', 'InventoryCount', id, {
      oldStatus: count.status,
      newStatus: 'IN_PROGRESS',
      warehouseId: count.warehouseId,
    });
    return updated;
  }

  async complete(
    id: string,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const count = await this.findOne(id, ctx);
    if (count.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Only IN_PROGRESS counts can be completed',
      );
    }
    const updated = await this.prisma.inventoryCount.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedById: userId,
      },
    });
    await this.audit.log(userId, 'COMPLETE', 'InventoryCount', id, {
      oldStatus: count.status,
      newStatus: 'COMPLETED',
      warehouseId: count.warehouseId,
    });
    return updated;
  }

  async cancel(
    id: string,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const count = await this.findOne(id, ctx);
    if (count.status !== 'DRAFT' && count.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Only DRAFT or IN_PROGRESS counts can be cancelled',
      );
    }
    const updated = await this.prisma.inventoryCount.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: userId,
      },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryCount', id, {
      oldStatus: count.status,
      newStatus: 'CANCELLED',
      warehouseId: count.warehouseId,
    });
    return updated;
  }

  async remove(
    id: string,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    await this.findOne(id, ctx);
    await this.prisma.inventoryCount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log(userId, 'DELETE', 'InventoryCount', id);
    return { message: 'Inventory count deleted successfully' };
  }

  async results(id: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    const lines = await this.prisma.inventoryCountLine.findMany({
      where: {
        countId: id,
        deletedAt: null,
        count: this.countScope(ctx),
      },
      include: {
        product: {
          select: { id: true, code: true, name: true, unit: true },
        },
        warehouseLocation: {
          select: { id: true, code: true, name: true },
        },
      },
    });
    const totalLines = lines.length;
    const countedLines = lines.filter(
      (line) => line.status !== 'PENDING',
    ).length;
    const verifiedLines = lines.filter(
      (line) => line.status === 'VERIFIED',
    ).length;
    const totalDifference = lines
      .filter((line) => line.differenceQty)
      .reduce(
        (sum, line) => sum + (line.differenceQty || 0),
        0,
      );
    return {
      count,
      results: {
        totalLines,
        countedLines,
        verifiedLines,
        totalDifference,
      },
      lines,
    };
  }

  async history(id: string, ctx: ActiveOperationalContext) {
    const count = await this.findOne(id, ctx);
    const auditLogs = await this.prisma.auditLog.findMany({
      where: { entity: 'InventoryCount', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const adjustments = await this.prisma.inventoryAdjustment.findMany({
      where: {
        inventoryCountId: id,
        ...this.countScope(ctx),
      },
      select: {
        id: true,
        adjustmentNumber: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { count, auditLogs, adjustments };
  }
}
