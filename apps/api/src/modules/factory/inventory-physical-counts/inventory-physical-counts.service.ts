import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { CreatePhysicalCountDto } from './dto/create-physical-count.dto';
import { UpdatePhysicalCountDto } from './dto/update-physical-count.dto';
import { EnterCountLineDto } from './dto/enter-count-line.dto';
import { RejectPhysicalCountDto } from './dto/reject-physical-count.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { assertRowInContext, assertWarehouseInContext } from '../../../common/operational-context/tenant-guards';

@Injectable()
export class InventoryPhysicalCountsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
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
      data: { countedQty: dto.countedQty, varianceQty, notes: dto.notes },
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

    try {
    await this.prisma.$transaction(async (tx) => {
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
            lines: {
              create: inLines.map(l => ({
                productId: l.productId,
                warehouseLocationId: l.warehouseLocationId,
                quantity: Math.abs(l.varianceQty ?? 0),
                direction: 'IN',
              })),
            },
          },
        });

        for (const l of inLines) {
          const bal = await tx.inventoryBalance.findFirst({
            where: { warehouseId: count.warehouseId, productId: l.productId, locationId: l.warehouseLocationId ?? null },
          });
          if (bal) {
            await tx.inventoryBalance.update({
              where: { id: bal.id },
              data: { quantity: { increment: Math.abs(l.varianceQty ?? 0) } },
            });
          } else {
            await tx.inventoryBalance.create({
              data: {
                warehouseId: count.warehouseId,
                locationId: l.warehouseLocationId,
                productId: l.productId,
                quantity: Math.abs(l.varianceQty ?? 0),
              },
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
            lines: {
              create: outLines.map(l => ({
                productId: l.productId,
                warehouseLocationId: l.warehouseLocationId,
                quantity: Math.abs(l.varianceQty ?? 0),
                direction: 'OUT',
              })),
            },
          },
        });

        for (const l of outLines) {
          const bal = await tx.inventoryBalance.findFirst({
            where: { warehouseId: count.warehouseId, productId: l.productId, locationId: l.warehouseLocationId ?? null },
          });
          if (bal) {
            await tx.inventoryBalance.update({
              where: { id: bal.id },
              data: { quantity: { decrement: Math.abs(l.varianceQty ?? 0) } },
            });
          }
        }
      }

      await tx.inventoryPhysicalCount.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
      });
    });
    } catch (error) {
      console.error('Post error:', error);
      throw error;
    }

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
}
