import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { CreateStockTransferDto, CreateStockTransferLineDto } from './dto/create-stock-transfer.dto';
import { UpdateStockTransferDto } from './dto/update-stock-transfer.dto';
import { StockTransferQueryDto } from './dto/stock-transfer-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { assertRowInContext, assertWarehouseInContext } from '../../../common/operational-context/tenant-guards';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Injectable()
export class InventoryStockTransfersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
    private valuationEngine: InventoryValuationEngineService,
  ) {}

  async create(dto: CreateStockTransferDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.sourceWarehouseId === dto.destinationWarehouseId &&
        (dto.sourceLocationId || null) === (dto.destinationLocationId || null)) {
      throw new BadRequestException('Source and destination warehouse/location cannot be the same');
    }

    await assertWarehouseInContext(this.prisma, dto.sourceWarehouseId, ctx);
    await assertWarehouseInContext(this.prisma, dto.destinationWarehouseId, ctx);

    if (dto.sourceLocationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: dto.sourceLocationId } });
      if (!loc || loc.warehouseId !== dto.sourceWarehouseId) throw new NotFoundException('Source location not found');
    }
    if (dto.destinationLocationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: dto.destinationLocationId } });
      if (!loc || loc.warehouseId !== dto.destinationWarehouseId) throw new NotFoundException('Destination location not found');
    }

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new NotFoundException(`Product ${line.productId} not found`);
      if (line.quantity <= 0) throw new BadRequestException('Quantity must be > 0');
    }

    const doc = await this.prisma.$transaction(async (tx) => {
      await assertWarehouseInContext(tx, dto.sourceWarehouseId, ctx);
      await assertWarehouseInContext(tx, dto.destinationWarehouseId, ctx);
      if (dto.sourceLocationId) {
        const loc = await tx.warehouseLocation.findUnique({ where: { id: dto.sourceLocationId } });
        if (!loc || loc.warehouseId !== dto.sourceWarehouseId) throw new NotFoundException('Source location not found');
      }
      if (dto.destinationLocationId) {
        const loc = await tx.warehouseLocation.findUnique({ where: { id: dto.destinationLocationId } });
        if (!loc || loc.warehouseId !== dto.destinationWarehouseId) throw new NotFoundException('Destination location not found');
      }
      const code = await this.numberingService.generateNumberAtomicWithClient('STOCK_TRANSFER', tx);

      const { lines, ...rest } = dto;
      return tx.inventoryStockTransfer.create({
        data: {
          ...rest,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
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

  async findAll(query: StockTransferQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    if (ctx.branchId) where.branchId = ctx.branchId;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { reason: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
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

  async findOne(id: string, ctx: ActiveOperationalContext) {
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
    assertRowInContext(doc, ctx, 'stock transfer');
    return doc;
  }

  async update(id: string, dto: UpdateStockTransferDto, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be updated');
    const {
      lines, companyId: _companyId, branchId: _branchId,
      sourceWarehouseId, destinationWarehouseId,
      sourceLocationId, destinationLocationId, ...rest
    } = dto;

    const effectiveSourceWarehouseId = sourceWarehouseId ?? doc.sourceWarehouseId;
    const effectiveDestinationWarehouseId = destinationWarehouseId ?? doc.destinationWarehouseId;
    if (sourceWarehouseId) {
      await assertWarehouseInContext(this.prisma, sourceWarehouseId, ctx);
    }
    if (destinationWarehouseId) {
      await assertWarehouseInContext(this.prisma, destinationWarehouseId, ctx);
    }
    if (sourceLocationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: sourceLocationId } });
      if (!loc || loc.warehouseId !== effectiveSourceWarehouseId) {
        throw new BadRequestException('warehouseLocationId does not belong to the source warehouse');
      }
    }
    if (destinationLocationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: destinationLocationId } });
      if (!loc || loc.warehouseId !== effectiveDestinationWarehouseId) {
        throw new BadRequestException('warehouseLocationId does not belong to the destination warehouse');
      }
    }
    if (effectiveSourceWarehouseId === effectiveDestinationWarehouseId &&
        (sourceLocationId ?? doc.sourceLocationId ?? null) === (destinationLocationId ?? doc.destinationLocationId ?? null)) {
      throw new BadRequestException('Source and destination warehouse/location cannot be the same');
    }

    const data: any = { ...rest };
    if (sourceWarehouseId) data.sourceWarehouseId = sourceWarehouseId;
    if (destinationWarehouseId) data.destinationWarehouseId = destinationWarehouseId;
    if (sourceLocationId) data.sourceLocationId = sourceLocationId;
    if (destinationLocationId) data.destinationLocationId = destinationLocationId;

    const updated = await this.prisma.inventoryStockTransfer.update({
      where: { id },
      data,
    });
    await this.audit.log(userId, 'UPDATE', 'InventoryStockTransfer', id, { dto });
    return updated;
  }

  async submit(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be submitted');
    const updated = await this.prisma.inventoryStockTransfer.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: userId },
    });
    await this.audit.log(userId, 'SUBMIT', 'InventoryStockTransfer', id, { oldStatus: doc.status, newStatus: 'SUBMITTED' });
    return updated;
  }

  async approve(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be approved');
    const updated = await this.prisma.inventoryStockTransfer.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId },
    });
    await this.audit.log(userId, 'APPROVE', 'InventoryStockTransfer', id, { oldStatus: doc.status, newStatus: 'APPROVED' });
    return updated;
  }

  async reject(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be rejected');
    const updated = await this.prisma.inventoryStockTransfer.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId },
    });
    await this.audit.log(userId, 'REJECT', 'InventoryStockTransfer', id, { oldStatus: doc.status, newStatus: 'REJECTED' });
    return updated;
  }

  async post(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.prisma.inventoryStockTransfer.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!doc || doc.deletedAt) throw new NotFoundException('Stock transfer not found');
    assertRowInContext(doc, ctx, 'stock transfer');
    if (doc.status !== 'APPROVED') throw new BadRequestException('Only APPROVED documents can be posted');

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
      // VAL-R1C: warehouse transfer is blocked while either the source or the
      // destination warehouse has an ACTIVE valuation policy (deferred to VAL-R1D).
      for (const wh of [doc.sourceWarehouseId, doc.destinationWarehouseId]) {
        const activePolicy = await this.valuationEngine.findActivePolicyForWarehouse(tx, ctx.companyId, wh);
        if (activePolicy) {
          throw new BadRequestException({
            messageKey: 'inventoryValuation.unsupportedActiveFlow',
            message: 'Stock transfer is blocked while an ACTIVE valuation policy exists for either warehouse',
          });
        }
      }
      await assertWarehouseInContext(tx, doc.sourceWarehouseId, ctx);
      await assertWarehouseInContext(tx, doc.destinationWarehouseId, ctx);
      if (doc.sourceLocationId) {
        const loc = await tx.warehouseLocation.findUnique({ where: { id: doc.sourceLocationId } });
        if (!loc || loc.warehouseId !== doc.sourceWarehouseId) {
          throw new BadRequestException('warehouseLocationId does not belong to the source warehouse');
        }
      }
      if (doc.destinationLocationId) {
        const loc = await tx.warehouseLocation.findUnique({ where: { id: doc.destinationLocationId } });
        if (!loc || loc.warehouseId !== doc.destinationWarehouseId) {
          throw new BadRequestException('warehouseLocationId does not belong to the destination warehouse');
        }
      }
      const outMovementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx);

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

      const inMovementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx);

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

  async cancel(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
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

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be deleted');
    await this.prisma.inventoryStockTransferLine.deleteMany({ where: { transferId: id } });
    await this.prisma.inventoryStockTransfer.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'InventoryStockTransfer', id, {});
    return { message: 'Stock transfer deleted successfully' };
  }

  async addLine(id: string, dto: CreateStockTransferLineDto, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
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

  async updateLine(id: string, lineId: string, dto: Partial<CreateStockTransferLineDto>, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
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

  async removeLine(id: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const line = await this.prisma.inventoryStockTransferLine.findUnique({ where: { id: lineId } });
    if (!line || line.transferId !== id) throw new NotFoundException('Line not found');

    await this.prisma.inventoryStockTransferLine.delete({ where: { id: lineId } });
    await this.audit.log(userId, 'REMOVE_LINE', 'InventoryStockTransfer', id, { lineId });
    return { message: 'Line removed successfully' };
  }

  async summary(id: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
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

  async getAvailability(productId: string, warehouseId: string, ctx: ActiveOperationalContext) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    await assertWarehouseInContext(this.prisma, warehouseId, ctx);

    const balance = await this.prisma.inventoryBalance.findFirst({
      where: { warehouseId, productId },
    });
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    return {
      productId,
      warehouseId,
      warehouseName: warehouse?.name,
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
