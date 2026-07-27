import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateStockTransferDto, CreateStockTransferLineDto } from './dto/create-stock-transfer.dto';
import { UpdateStockTransferDto } from './dto/update-stock-transfer.dto';
import { StockTransferQueryDto } from './dto/stock-transfer-query.dto';

@Injectable()
export class InventoryStockTransfersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateStockTransferDto, userId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException('Company not found');

    if (dto.sourceWarehouseId === dto.destinationWarehouseId &&
        (dto.sourceLocationId || null) === (dto.destinationLocationId || null)) {
      throw new BadRequestException('Source and destination warehouse/location cannot be the same');
    }

    const srcWh = await this.prisma.warehouse.findUnique({ where: { id: dto.sourceWarehouseId } });
    if (!srcWh) throw new NotFoundException('Source warehouse not found');

    const dstWh = await this.prisma.warehouse.findUnique({ where: { id: dto.destinationWarehouseId } });
    if (!dstWh) throw new NotFoundException('Destination warehouse not found');

    if (dto.sourceLocationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: dto.sourceLocationId } });
      if (!loc || loc.warehouseId !== dto.sourceWarehouseId) throw new NotFoundException('Source location not found');
    }
    if (dto.destinationLocationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: dto.destinationLocationId } });
      if (!loc || loc.warehouseId !== dto.destinationWarehouseId) throw new NotFoundException('Destination location not found');
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

    const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'STOCK_TRANSFER' } });
    if (!seq) throw new NotFoundException('Number sequence STOCK_TRANSFER not configured');

    const doc = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const code = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

      const { lines, ...rest } = dto;
      return tx.inventoryStockTransfer.create({
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

    await this.audit.log(userId, 'CREATE', 'InventoryStockTransfer', doc.id, { code: doc.code });
    return doc;
  }

  async findAll(query: StockTransferQueryDto) {
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
    if (query.sourceWarehouseId) where.sourceWarehouseId = query.sourceWarehouseId;
    if (query.destinationWarehouseId) where.destinationWarehouseId = query.destinationWarehouseId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryStockTransfer.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          sourceWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryStockTransfer.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const doc = await this.prisma.inventoryStockTransfer.findUnique({
      where: { id },
      include: {
        company: true,
        branch: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        sourceLocation: true,
        destinationLocation: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });
    if (!doc || doc.deletedAt) throw new NotFoundException('Stock transfer not found');
    return doc;
  }

  async update(id: string, dto: UpdateStockTransferDto, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be updated');
    const { lines, ...rest } = dto;
    const updated = await this.prisma.inventoryStockTransfer.update({
      where: { id },
      data: rest,
    });
    await this.audit.log(userId, 'UPDATE', 'InventoryStockTransfer', id, { dto });
    return updated;
  }

  async submit(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be submitted');
    const updated = await this.prisma.inventoryStockTransfer.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: userId },
    });
    await this.audit.log(userId, 'SUBMIT', 'InventoryStockTransfer', id, { oldStatus: doc.status, newStatus: 'SUBMITTED' });
    return updated;
  }

  async approve(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be approved');
    const updated = await this.prisma.inventoryStockTransfer.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId },
    });
    await this.audit.log(userId, 'APPROVE', 'InventoryStockTransfer', id, { oldStatus: doc.status, newStatus: 'APPROVED' });
    return updated;
  }

  async reject(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be rejected');
    const updated = await this.prisma.inventoryStockTransfer.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId },
    });
    await this.audit.log(userId, 'REJECT', 'InventoryStockTransfer', id, { oldStatus: doc.status, newStatus: 'REJECTED' });
    return updated;
  }

  async post(id: string, userId: string) {
    const doc = await this.prisma.inventoryStockTransfer.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!doc || doc.deletedAt) throw new NotFoundException('Stock transfer not found');
    if (doc.status !== 'APPROVED') throw new BadRequestException('Only APPROVED documents can be posted');

    const movementSeq = await this.prisma.numberSequence.findUnique({ where: { code: 'INVENTORY_MOVEMENT' } });
    if (!movementSeq) throw new NotFoundException('Number sequence INVENTORY_MOVEMENT not configured');

    for (const line of doc.lines) {
      const srcBalance = await this.prisma.inventoryBalance.findFirst({
        where: {
          warehouseId: doc.sourceWarehouseId,
          productId: line.productId,
          locationId: doc.sourceLocationId || null,
        },
      });
      const available = srcBalance?.quantity || 0;
      if (available < line.quantity) {
        const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
        throw new BadRequestException(
          `Insufficient stock for product ${product?.name || line.productId} at source. Available: ${available}, Requested: ${line.quantity}`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const outSeq = await tx.numberSequence.update({
        where: { id: movementSeq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const outMovementNumber = `${outSeq.prefix}${String(outSeq.currentNumber).padStart(outSeq.padding, '0')}`;

      const outMovement = await tx.inventoryMovement.create({
        data: {
          movementNumber: outMovementNumber,
          companyId: doc.companyId,
          branchId: doc.branchId,
          warehouseId: doc.sourceWarehouseId,
          movementType: 'STOCK_TRANSFER_OUT',
          status: 'POSTED',
          sourceType: 'STOCK_TRANSFER',
          sourceId: doc.id,
          movementDate: new Date(),
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          notes: doc.reason,
          lines: {
            create: doc.lines.map(l => ({
              productId: l.productId,
              warehouseLocationId: doc.sourceLocationId || undefined,
              quantity: l.quantity,
              direction: 'OUT',
              notes: l.notes,
            })),
          },
        },
      });

      for (const line of doc.lines) {
        const srcBalance = await this.getOrCreateBalance(tx, doc.sourceWarehouseId, line.productId, doc.sourceLocationId || null);
        await tx.inventoryBalance.update({
          where: { id: srcBalance.id },
          data: { quantity: srcBalance.quantity - line.quantity },
        });
        await tx.inventoryStockTransferLine.update({
          where: { id: line.id },
          data: { transferOutMovementId: outMovement.id },
        });
      }

      const inSeq = await tx.numberSequence.update({
        where: { id: movementSeq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const inMovementNumber = `${inSeq.prefix}${String(inSeq.currentNumber).padStart(inSeq.padding, '0')}`;

      const inMovement = await tx.inventoryMovement.create({
        data: {
          movementNumber: inMovementNumber,
          companyId: doc.companyId,
          branchId: doc.branchId,
          warehouseId: doc.destinationWarehouseId,
          movementType: 'STOCK_TRANSFER_IN',
          status: 'POSTED',
          sourceType: 'STOCK_TRANSFER',
          sourceId: doc.id,
          movementDate: new Date(),
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          notes: doc.reason,
          lines: {
            create: doc.lines.map(l => ({
              productId: l.productId,
              warehouseLocationId: doc.destinationLocationId || undefined,
              quantity: l.quantity,
              direction: 'IN',
              notes: l.notes,
            })),
          },
        },
      });

      for (const line of doc.lines) {
        const dstBalance = await this.getOrCreateBalance(tx, doc.destinationWarehouseId, line.productId, doc.destinationLocationId || null);
        await tx.inventoryBalance.update({
          where: { id: dstBalance.id },
          data: { quantity: dstBalance.quantity + line.quantity },
        });
        await tx.inventoryStockTransferLine.update({
          where: { id: line.id },
          data: { transferInMovementId: inMovement.id },
        });
      }

      await tx.inventoryStockTransfer.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
      });

      return tx.inventoryStockTransfer.findUnique({
        where: { id },
        include: { lines: true },
      });
    });

    await this.audit.log(userId, 'POST', 'InventoryStockTransfer', id, {
      oldStatus: doc.status, newStatus: 'POSTED', linesCount: doc.lines.length,
    });
    return result;
  }

  async cancel(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT' && doc.status !== 'SUBMITTED') {
      throw new BadRequestException('Only DRAFT or SUBMITTED documents can be cancelled');
    }
    const updated = await this.prisma.inventoryStockTransfer.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryStockTransfer', id, { oldStatus: doc.status, newStatus: 'CANCELLED' });
    return updated;
  }

  async remove(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be deleted');
    await this.prisma.inventoryStockTransferLine.deleteMany({ where: { transferId: id } });
    await this.prisma.inventoryStockTransfer.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'InventoryStockTransfer', id, {});
    return { message: 'Stock transfer deleted successfully' };
  }

  async addLine(id: string, dto: CreateStockTransferLineDto, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.quantity <= 0) throw new BadRequestException('Quantity must be > 0');

    const line = await this.prisma.inventoryStockTransferLine.create({
      data: {
        transferId: id,
        productId: dto.productId,
        quantity: dto.quantity,
        notes: dto.notes,
      },
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'ADD_LINE', 'InventoryStockTransfer', id, { lineId: line.id });
    return line;
  }

  async updateLine(id: string, lineId: string, dto: Partial<CreateStockTransferLineDto>, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const line = await this.prisma.inventoryStockTransferLine.findUnique({ where: { id: lineId } });
    if (!line || line.transferId !== id) throw new NotFoundException('Line not found');

    const updated = await this.prisma.inventoryStockTransferLine.update({
      where: { id: lineId },
      data: dto,
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'UPDATE_LINE', 'InventoryStockTransfer', id, { lineId });
    return updated;
  }

  async removeLine(id: string, lineId: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const line = await this.prisma.inventoryStockTransferLine.findUnique({ where: { id: lineId } });
    if (!line || line.transferId !== id) throw new NotFoundException('Line not found');

    await this.prisma.inventoryStockTransferLine.delete({ where: { id: lineId } });
    await this.audit.log(userId, 'REMOVE_LINE', 'InventoryStockTransfer', id, { lineId });
    return { message: 'Line removed successfully' };
  }

  async summary(id: string) {
    const doc = await this.findOne(id);
    const lines = await this.prisma.inventoryStockTransferLine.findMany({
      where: { transferId: id },
      select: { quantity: true, transferOutMovementId: true, transferInMovementId: true },
    });
    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
    const outMovements = lines.filter(l => l.transferOutMovementId).length;
    const inMovements = lines.filter(l => l.transferInMovementId).length;
    return {
      transferId: id, code: doc.code, status: doc.status,
      lineCount: lines.length, totalQuantity: totalQty,
      outMovementsLinked: outMovements, inMovementsLinked: inMovements,
    };
  }

  async getAvailability(productId: string, warehouseId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const balance = await this.prisma.inventoryBalance.findFirst({
      where: { warehouseId, productId },
    });
    return {
      productId,
      warehouseId,
      warehouseName: warehouse.name,
      availableQuantity: balance?.quantity || 0,
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
