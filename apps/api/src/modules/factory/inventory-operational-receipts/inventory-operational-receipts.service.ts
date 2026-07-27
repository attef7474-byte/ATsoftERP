import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateOperationalReceiptDto } from './dto/create-operational-receipt.dto';
import { UpdateOperationalReceiptDto } from './dto/update-operational-receipt.dto';
import { OperationalReceiptQueryDto } from './dto/operational-receipt-query.dto';

@Injectable()
export class InventoryOperationalReceiptsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateOperationalReceiptDto, userId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const wh = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!wh) throw new NotFoundException('Warehouse not found');

    if (dto.locationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: dto.locationId } });
      if (!loc || loc.warehouseId !== dto.warehouseId) throw new NotFoundException('Location not found for this warehouse');
    }
    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new NotFoundException(`Product ${line.productId} not found`);
      if (line.quantity <= 0) throw new BadRequestException('Quantity must be > 0');
    }

    const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'OPERATIONAL_RECEIPT' } });
    if (!seq) throw new NotFoundException('Number sequence OPERATIONAL_RECEIPT not configured');

    const doc = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const code = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

      const { lines, ...rest } = dto;
      return tx.inventoryOperationalReceipt.create({
        data: {
          ...rest,
          code,
          status: 'DRAFT',
          createdById: userId,
          lines: {
            create: lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              notes: l.notes,
            })),
          },
        },
        include: { lines: true },
      });
    });

    await this.audit.log(userId, 'CREATE', 'InventoryOperationalReceipt', doc.id, { code: doc.code });
    return doc;
  }

  async findAll(query: OperationalReceiptQueryDto) {
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
      this.prisma.inventoryOperationalReceipt.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryOperationalReceipt.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const doc = await this.prisma.inventoryOperationalReceipt.findUnique({
      where: { id },
      include: {
        company: true,
        branch: true,
        warehouse: true,
        location: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });
    if (!doc || doc.deletedAt) throw new NotFoundException('Operational receipt not found');
    return doc;
  }

  async update(id: string, dto: UpdateOperationalReceiptDto, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be updated');
    const { lines, ...rest } = dto;
    const updated = await this.prisma.inventoryOperationalReceipt.update({
      where: { id },
      data: rest,
    });
    await this.audit.log(userId, 'UPDATE', 'InventoryOperationalReceipt', id, { dto });
    return updated;
  }

  async submit(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be submitted');
    const updated = await this.prisma.inventoryOperationalReceipt.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: userId },
    });
    await this.audit.log(userId, 'SUBMIT', 'InventoryOperationalReceipt', id, { oldStatus: doc.status, newStatus: 'SUBMITTED' });
    return updated;
  }

  async approve(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be approved');
    const updated = await this.prisma.inventoryOperationalReceipt.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId },
    });
    await this.audit.log(userId, 'APPROVE', 'InventoryOperationalReceipt', id, { oldStatus: doc.status, newStatus: 'APPROVED' });
    return updated;
  }

  async reject(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be rejected');
    const updated = await this.prisma.inventoryOperationalReceipt.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId },
    });
    await this.audit.log(userId, 'REJECT', 'InventoryOperationalReceipt', id, { oldStatus: doc.status, newStatus: 'REJECTED' });
    return updated;
  }

  async post(id: string, userId: string) {
    const doc = await this.prisma.inventoryOperationalReceipt.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!doc || doc.deletedAt) throw new NotFoundException('Operational receipt not found');
    if (doc.status !== 'APPROVED') throw new BadRequestException('Only APPROVED documents can be posted');

    const movementSeq = await this.prisma.numberSequence.findUnique({ where: { code: 'INVENTORY_MOVEMENT' } });
    if (!movementSeq) throw new NotFoundException('Number sequence INVENTORY_MOVEMENT not configured');

    const result = await this.prisma.$transaction(async (tx) => {
      const mvtSeq = await tx.numberSequence.update({
        where: { id: movementSeq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const movementNumber = `${mvtSeq.prefix}${String(mvtSeq.currentNumber).padStart(mvtSeq.padding, '0')}`;

      const movement = await tx.inventoryMovement.create({
        data: {
          movementNumber,
          companyId: doc.companyId,
          branchId: doc.branchId,
          warehouseId: doc.warehouseId,
          movementType: 'STOCK_RECEIVING',
          status: 'POSTED',
          sourceType: 'OPERATIONAL_RECEIPT',
          sourceId: doc.id,
          movementDate: new Date(),
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          notes: doc.reason,
          lines: {
            create: doc.lines.map((l: { productId: string; quantity: number; notes?: string | null }) => ({
              productId: l.productId,
              warehouseLocationId: doc.locationId || undefined,
              quantity: l.quantity,
              direction: 'IN',
              notes: l.notes,
            })),
          },
        },
      });

      for (const line of doc.lines) {
        const balance = await this.getOrCreateBalance(tx, doc.warehouseId, line.productId, doc.locationId || null);
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: { quantity: balance.quantity + line.quantity },
        });
      }

      await tx.inventoryOperationalReceipt.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
      });

      return tx.inventoryOperationalReceipt.findUnique({
        where: { id },
        include: { lines: true },
      });
    });

    await this.audit.log(userId, 'POST', 'InventoryOperationalReceipt', id, {
      oldStatus: doc.status, newStatus: 'POSTED', linesCount: doc.lines.length,
    });
    return result;
  }

  async cancel(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT' && doc.status !== 'SUBMITTED') {
      throw new BadRequestException('Only DRAFT or SUBMITTED documents can be cancelled');
    }
    const updated = await this.prisma.inventoryOperationalReceipt.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryOperationalReceipt', id, { oldStatus: doc.status, newStatus: 'CANCELLED' });
    return updated;
  }

  async remove(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be deleted');
    await this.prisma.inventoryOperationalReceiptLine.deleteMany({ where: { receiptId: id } });
    await this.prisma.inventoryOperationalReceipt.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'InventoryOperationalReceipt', id, {});
    return { message: 'Operational receipt deleted successfully' };
  }

  async addLine(id: string, dto: { productId: string; quantity: number; notes?: string }, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.quantity <= 0) throw new BadRequestException('Quantity must be > 0');

    const line = await this.prisma.inventoryOperationalReceiptLine.create({
      data: {
        receiptId: id,
        productId: dto.productId,
        quantity: dto.quantity,
        notes: dto.notes,
      },
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'ADD_LINE', 'InventoryOperationalReceipt', id, { lineId: line.id });
    return line;
  }

  async updateLine(id: string, lineId: string, dto: { productId?: string; quantity?: number; notes?: string }, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const line = await this.prisma.inventoryOperationalReceiptLine.findUnique({ where: { id: lineId } });
    if (!line || line.receiptId !== id) throw new NotFoundException('Line not found');

    const updated = await this.prisma.inventoryOperationalReceiptLine.update({
      where: { id: lineId },
      data: dto,
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'UPDATE_LINE', 'InventoryOperationalReceipt', id, { lineId });
    return updated;
  }

  async removeLine(id: string, lineId: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const line = await this.prisma.inventoryOperationalReceiptLine.findUnique({ where: { id: lineId } });
    if (!line || line.receiptId !== id) throw new NotFoundException('Line not found');

    await this.prisma.inventoryOperationalReceiptLine.delete({ where: { id: lineId } });
    await this.audit.log(userId, 'REMOVE_LINE', 'InventoryOperationalReceipt', id, { lineId });
    return { message: 'Line removed successfully' };
  }

  async summary(id: string) {
    const doc = await this.findOne(id);
    const lines = await this.prisma.inventoryOperationalReceiptLine.findMany({
      where: { receiptId: id },
      select: { quantity: true },
    });
    const totalQty = lines.reduce((s: number, l: { quantity: number }) => s + l.quantity, 0);
    return {
      receiptId: id, code: doc.code, status: doc.status,
      lineCount: lines.length, totalQuantity: totalQty,
    };
  }

  private async getOrCreateBalance(tx: any, warehouseId: string, productId: string, locationId: string | null) {
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
