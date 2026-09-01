import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { CreateOperationalReceiptDto } from './dto/create-operational-receipt.dto';
import { UpdateOperationalReceiptDto } from './dto/update-operational-receipt.dto';
import { OperationalReceiptQueryDto } from './dto/operational-receipt-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { assertRowInContext, assertWarehouseInContext } from '../../../common/operational-context/tenant-guards';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

@Injectable()
export class InventoryOperationalReceiptsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
    private valuationEngine: InventoryValuationEngineService,
  ) {}

  async create(dto: CreateOperationalReceiptDto, userId: string, ctx: ActiveOperationalContext) {
    await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);

    if (dto.locationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: dto.locationId } });
      if (!loc || loc.warehouseId !== dto.warehouseId) throw new NotFoundException('Location not found for this warehouse');
    }

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new NotFoundException(`Product ${line.productId} not found`);
      if (line.quantity <= 0) throw new BadRequestException('Quantity must be > 0');
    }

    const doc = await this.prisma.$transaction(async (tx) => {
      await assertWarehouseInContext(tx, dto.warehouseId, ctx);
      const code = await this.numberingService.generateNumberAtomicWithClient('OPERATIONAL_RECEIPT', tx);

      const { lines, ...rest } = dto;
      return tx.inventoryOperationalReceipt.create({
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

    await this.audit.log(userId, 'CREATE', 'InventoryOperationalReceipt', doc.id, { code: doc.code });
    return doc;
  }

  async findAll(query: OperationalReceiptQueryDto, ctx: ActiveOperationalContext) {
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

  async findOne(id: string, ctx: ActiveOperationalContext) {
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
    assertRowInContext(doc, ctx, 'operational receipt');
    return doc;
  }

  async update(id: string, dto: UpdateOperationalReceiptDto, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be updated');
    const { lines, companyId: _companyId, branchId: _branchId, warehouseId, locationId, ...rest } = dto;

    const effectiveWarehouseId = warehouseId ?? doc.warehouseId;
    if (warehouseId) {
      await assertWarehouseInContext(this.prisma, warehouseId, ctx);
    }
    if (locationId) {
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: locationId } });
      if (!loc || loc.warehouseId !== effectiveWarehouseId) {
        throw new BadRequestException('warehouseLocationId does not belong to the selected warehouse');
      }
    }

    const data: any = { ...rest };
    if (warehouseId) data.warehouseId = warehouseId;
    if (locationId) data.locationId = locationId;

    const updated = await this.prisma.inventoryOperationalReceipt.update({
      where: { id },
      data,
    });
    await this.audit.log(userId, 'UPDATE', 'InventoryOperationalReceipt', id, { dto });
    return updated;
  }

  async submit(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be submitted');
    const updated = await this.prisma.inventoryOperationalReceipt.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: userId },
    });
    await this.audit.log(userId, 'SUBMIT', 'InventoryOperationalReceipt', id, { oldStatus: doc.status, newStatus: 'SUBMITTED' });
    return updated;
  }

  async approve(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be approved');
    const updated = await this.prisma.inventoryOperationalReceipt.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId },
    });
    await this.audit.log(userId, 'APPROVE', 'InventoryOperationalReceipt', id, { oldStatus: doc.status, newStatus: 'APPROVED' });
    return updated;
  }

  async reject(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be rejected');
    const updated = await this.prisma.inventoryOperationalReceipt.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId },
    });
    await this.audit.log(userId, 'REJECT', 'InventoryOperationalReceipt', id, { oldStatus: doc.status, newStatus: 'REJECTED' });
    return updated;
  }

  async post(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.prisma.inventoryOperationalReceipt.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!doc || doc.deletedAt) throw new NotFoundException('Operational receipt not found');
    assertRowInContext(doc, ctx, 'operational receipt');
    if (doc.status !== 'APPROVED') throw new BadRequestException('Only APPROVED documents can be posted');

    const result = await this.prisma.$transaction(async (tx) => {
      await assertWarehouseInContext(tx, doc.warehouseId, ctx);
      if (doc.locationId) {
        const loc = await tx.warehouseLocation.findUnique({ where: { id: doc.locationId } });
        if (!loc || loc.warehouseId !== doc.warehouseId) {
          throw new BadRequestException('warehouseLocationId does not belong to the document warehouse');
        }
      }
      const movementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx);

      // VAL-R1C: if the warehouse has an ACTIVE valuation policy, every line must
      // carry a trusted R1B receipt cost + the policy currency, else the receipt
      // is blocked (VALUATION_COST_REQUIRED / VALUATION_CURRENCY_MISMATCH) BEFORE
      // any physical stock change. The valued receipt is applied atomically with
      // the physical balance update in this same transaction.
      const activePolicy = await this.valuationEngine.findActivePolicyForWarehouse(tx, ctx.companyId, doc.warehouseId);
      if (activePolicy) {
        for (const l of doc.lines as { productId: string; quantity: number; unitCost?: any; currencyCode?: string | null }[]) {
          if (l.unitCost === null || l.unitCost === undefined) {
            throw new BadRequestException({
              messageKey: 'inventoryValuation.costRequired',
              message: 'An operational receipt posted into an ACTIVE valuation warehouse requires an explicit unit cost',
            });
          }
          if ((l.currencyCode || '').toUpperCase() !== activePolicy.currencyCode.toUpperCase()) {
            throw new BadRequestException({
              messageKey: 'inventoryValuation.currencyMismatch',
              message: 'Receipt currency must match the ACTIVE valuation policy currency',
            });
          }
        }
      }

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
              quantityBase: l.quantity,
              direction: 'IN',
              notes: l.notes,
            })),
          },
        },
        include: { lines: true },
      });

      for (let i = 0; i < doc.lines.length; i++) {
        const line = doc.lines[i] as { productId: string; quantity: number; unitCost?: any; currencyCode?: string | null };
        const movLine = movement.lines[i];

        // VAL-R1C: apply the weighted moving-average receipt atomically with the
        // physical balance update below (same transaction).
        if (activePolicy) {
          const qold = await this.valuationEngine.aggregatePhysicalQuantity(tx, doc.warehouseId, line.productId);
          await this.valuationEngine.applyValuedReceipt(tx, {
            companyId: ctx.companyId,
            warehouseId: doc.warehouseId,
            productId: line.productId,
            qold,
            quantity: new Prisma.Decimal(line.quantity),
            unitCost: new Prisma.Decimal(line.unitCost),
            currencyCode: activePolicy.currencyCode,
            lineId: movLine.id,
            movementId: movement.id,
          });
        }

        // VAL-R1C: keep the legacy physical twin (quantityBase) in sync with the
        // Float quantity so the engine's physical authority (SUM(quantityBase),
        // falling back to quantity when null) never diverges from on-hand. Mirror
        // the movement-post semantics: prefer quantityBase when present.
        const balance = await this.getOrCreateBalance(tx, doc.warehouseId, line.productId, doc.locationId || null);
        const quantityBase =
          balance.quantityBase !== null && balance.quantityBase !== undefined
            ? new Prisma.Decimal(balance.quantityBase.toString())
            : new Prisma.Decimal(balance.quantity);
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            quantity: balance.quantity + line.quantity,
            quantityBase: quantityBase.plus(line.quantity),
          },
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await this.audit.log(userId, 'POST', 'InventoryOperationalReceipt', id, {
      oldStatus: doc.status, newStatus: 'POSTED', linesCount: doc.lines.length,
    });
    return result;
  }

  async cancel(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
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

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be deleted');
    await this.prisma.inventoryOperationalReceiptLine.deleteMany({ where: { receiptId: id } });
    await this.prisma.inventoryOperationalReceipt.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'InventoryOperationalReceipt', id, {});
    return { message: 'Operational receipt deleted successfully' };
  }

  async addLine(id: string, dto: { productId: string; quantity: number; notes?: string }, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
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

  async updateLine(id: string, lineId: string, dto: { productId?: string; quantity?: number; notes?: string }, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
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

  async removeLine(id: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const line = await this.prisma.inventoryOperationalReceiptLine.findUnique({ where: { id: lineId } });
    if (!line || line.receiptId !== id) throw new NotFoundException('Line not found');

    await this.prisma.inventoryOperationalReceiptLine.delete({ where: { id: lineId } });
    await this.audit.log(userId, 'REMOVE_LINE', 'InventoryOperationalReceipt', id, { lineId });
    return { message: 'Line removed successfully' };
  }

  async summary(id: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
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
