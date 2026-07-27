import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateStockAdjustmentDto, CreateStockAdjustmentLineDto } from './dto/create-stock-adjustment.dto';
import { UpdateStockAdjustmentDto } from './dto/update-stock-adjustment.dto';
import { StockAdjustmentQueryDto } from './dto/stock-adjustment-query.dto';

@Injectable()
export class InventoryStockAdjustmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateStockAdjustmentDto, userId: string) {
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
      if (line.quantity <= 0) throw new BadRequestException('Quantity must be > 0');
      if (!['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'].includes(line.adjustmentType)) {
        throw new BadRequestException('adjustmentType must be ADJUSTMENT_IN or ADJUSTMENT_OUT');
      }
    }

    const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'STOCK_ADJUSTMENT' } });
    if (!seq) throw new NotFoundException('Number sequence STOCK_ADJUSTMENT not configured');

    const doc = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const code = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

      const { lines, ...rest } = dto;
      return tx.inventoryStockAdjustment.create({
        data: {
          ...rest,
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
    });

    await this.audit.log(userId, 'CREATE', 'InventoryStockAdjustment', doc.id, { code: doc.code });
    return doc;
  }

  async findAll(query: StockAdjustmentQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { reason: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    if (query.companyId) where.companyId = query.companyId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

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

  async findOne(id: string) {
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
    if (!doc || doc.deletedAt) throw new NotFoundException('Stock adjustment not found');
    return doc;
  }

  async update(id: string, dto: UpdateStockAdjustmentDto, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be updated');
    const { lines, ...rest } = dto;
    const updated = await this.prisma.inventoryStockAdjustment.update({
      where: { id },
      data: rest,
    });
    await this.audit.log(userId, 'UPDATE', 'InventoryStockAdjustment', id, { dto });
    return updated;
  }

  async submit(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be submitted');
    const updated = await this.prisma.inventoryStockAdjustment.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: userId },
    });
    await this.audit.log(userId, 'SUBMIT', 'InventoryStockAdjustment', id, { oldStatus: doc.status, newStatus: 'SUBMITTED' });
    return updated;
  }

  async approve(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be approved');
    const updated = await this.prisma.inventoryStockAdjustment.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId },
    });
    await this.audit.log(userId, 'APPROVE', 'InventoryStockAdjustment', id, { oldStatus: doc.status, newStatus: 'APPROVED' });
    return updated;
  }

  async reject(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be rejected');
    const updated = await this.prisma.inventoryStockAdjustment.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId },
    });
    await this.audit.log(userId, 'REJECT', 'InventoryStockAdjustment', id, { oldStatus: doc.status, newStatus: 'REJECTED' });
    return updated;
  }

  async post(id: string, userId: string) {
    const doc = await this.prisma.inventoryStockAdjustment.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!doc || doc.deletedAt) throw new NotFoundException('Stock adjustment not found');
    if (doc.status !== 'APPROVED') throw new BadRequestException('Only APPROVED documents can be posted');

    const movementSeq = await this.prisma.numberSequence.findUnique({ where: { code: 'INVENTORY_MOVEMENT' } });
    if (!movementSeq) throw new NotFoundException('Number sequence INVENTORY_MOVEMENT not configured');

    const inLines = doc.lines.filter(l => l.adjustmentType === 'ADJUSTMENT_IN');
    const outLines = doc.lines.filter(l => l.adjustmentType === 'ADJUSTMENT_OUT');

    const result = await this.prisma.$transaction(async (tx) => {
      if (inLines.length > 0) {
        const updatedSeq = await tx.numberSequence.update({
          where: { id: movementSeq.id },
          data: { currentNumber: { increment: 1 } },
        });
        const movementNumber = `${updatedSeq.prefix}${String(updatedSeq.currentNumber).padStart(updatedSeq.padding, '0')}`;

        const movement = await tx.inventoryMovement.create({
          data: {
            movementNumber,
            companyId: doc.companyId,
            branchId: doc.branchId,
            warehouseId: doc.warehouseId,
            movementType: 'STOCK_ADJUSTMENT_IN',
            status: 'POSTED',
            sourceType: 'STOCK_ADJUSTMENT',
            sourceId: doc.id,
            movementDate: new Date(),
            postedAt: new Date(),
            postedById: userId,
            createdById: userId,
            notes: doc.reason,
            lines: { create: inLines.map(l => ({ productId: l.productId, warehouseLocationId: l.locationId, quantity: l.quantity, direction: 'IN', notes: l.notes })) },
          },
        });

        for (const line of inLines) {
          const balance = await this.getOrCreateBalance(tx, doc.warehouseId, line.productId, line.locationId);
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { quantity: balance.quantity + line.quantity },
          });
          await tx.inventoryStockAdjustmentLine.update({
            where: { id: line.id },
            data: { movementId: movement.id },
          });
        }
      }

      if (outLines.length > 0) {
        for (const line of outLines) {
          const balance = await this.getOrCreateBalance(tx, doc.warehouseId, line.productId, line.locationId);
          if (balance.quantity < line.quantity) {
            const product = await tx.product.findUnique({ where: { id: line.productId } });
            throw new BadRequestException(
              `Insufficient stock for product ${product?.name || line.productId}. Available: ${balance.quantity}, Requested: ${line.quantity}`,
            );
          }
        }

        const updatedSeq = await tx.numberSequence.update({
          where: { id: movementSeq.id },
          data: { currentNumber: { increment: 1 } },
        });
        const movementNumber = `${updatedSeq.prefix}${String(updatedSeq.currentNumber).padStart(updatedSeq.padding, '0')}`;

        const movement = await tx.inventoryMovement.create({
          data: {
            movementNumber,
            companyId: doc.companyId,
            branchId: doc.branchId,
            warehouseId: doc.warehouseId,
            movementType: 'STOCK_ADJUSTMENT_OUT',
            status: 'POSTED',
            sourceType: 'STOCK_ADJUSTMENT',
            sourceId: doc.id,
            movementDate: new Date(),
            postedAt: new Date(),
            postedById: userId,
            createdById: userId,
            notes: doc.reason,
            lines: { create: outLines.map(l => ({ productId: l.productId, warehouseLocationId: l.locationId, quantity: l.quantity, direction: 'OUT', notes: l.notes })) },
          },
        });

        for (const line of outLines) {
          const balance = await this.getOrCreateBalance(tx, doc.warehouseId, line.productId, line.locationId);
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { quantity: balance.quantity - line.quantity },
          });
          await tx.inventoryStockAdjustmentLine.update({
            where: { id: line.id },
            data: { movementId: movement.id },
          });
        }
      }

      await tx.inventoryStockAdjustment.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
      });

      return tx.inventoryStockAdjustment.findUnique({
        where: { id },
        include: { lines: true },
      });
    });

    await this.audit.log(userId, 'POST', 'InventoryStockAdjustment', id, { oldStatus: doc.status, newStatus: 'POSTED', inCount: inLines.length, outCount: outLines.length });
    return result;
  }

  async cancel(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT' && doc.status !== 'SUBMITTED') {
      throw new BadRequestException('Only DRAFT or SUBMITTED documents can be cancelled');
    }
    const updated = await this.prisma.inventoryStockAdjustment.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryStockAdjustment', id, { oldStatus: doc.status, newStatus: 'CANCELLED' });
    return updated;
  }

  async remove(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be deleted');
    await this.prisma.inventoryStockAdjustmentLine.deleteMany({ where: { adjustmentId: id } });
    await this.prisma.inventoryStockAdjustment.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'InventoryStockAdjustment', id, {});
    return { message: 'Stock adjustment deleted successfully' };
  }

  async addLine(id: string, dto: CreateStockAdjustmentLineDto, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.quantity <= 0) throw new BadRequestException('Quantity must be > 0');
    if (!['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'].includes(dto.adjustmentType)) {
      throw new BadRequestException('adjustmentType must be ADJUSTMENT_IN or ADJUSTMENT_OUT');
    }

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

  async updateLine(id: string, lineId: string, dto: Partial<CreateStockAdjustmentLineDto>, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const line = await this.prisma.inventoryStockAdjustmentLine.findUnique({ where: { id: lineId } });
    if (!line || line.adjustmentId !== id) throw new NotFoundException('Line not found');

    const updated = await this.prisma.inventoryStockAdjustmentLine.update({
      where: { id: lineId },
      data: dto,
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'UPDATE_LINE', 'InventoryStockAdjustment', id, { lineId });
    return updated;
  }

  async removeLine(id: string, lineId: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const line = await this.prisma.inventoryStockAdjustmentLine.findUnique({ where: { id: lineId } });
    if (!line || line.adjustmentId !== id) throw new NotFoundException('Line not found');

    await this.prisma.inventoryStockAdjustmentLine.delete({ where: { id: lineId } });
    await this.audit.log(userId, 'REMOVE_LINE', 'InventoryStockAdjustment', id, { lineId });
    return { message: 'Line removed successfully' };
  }

  async summary(id: string) {
    const doc = await this.findOne(id);
    const lines = await this.prisma.inventoryStockAdjustmentLine.findMany({
      where: { adjustmentId: id },
      select: { adjustmentType: true, quantity: true },
    });
    const totalIn = lines.filter(l => l.adjustmentType === 'ADJUSTMENT_IN').reduce((s, l) => s + l.quantity, 0);
    const totalOut = lines.filter(l => l.adjustmentType === 'ADJUSTMENT_OUT').reduce((s, l) => s + l.quantity, 0);
    return { stockAdjustmentId: id, code: doc.code, status: doc.status, lineCount: lines.length, totalIn, totalOut };
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
