import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { CreateInventoryMovementDto, CreateInventoryMovementLineDto } from './dto/create-inventory-movement.dto';
import { UpdateInventoryMovementDto } from './dto/update-inventory-movement.dto';
import { InventoryMovementQueryDto } from './dto/inventory-movement-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class InventoryMovementsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ messageKey: 'inventory.movementNotFound', message });
  }

  private isInContext(
    movement: { companyId: string; branchId: string | null },
    ctx: ActiveOperationalContext,
  ): boolean {
    return movement.companyId === ctx.companyId &&
      (movement.branchId === null || movement.branchId === ctx.branchId);
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const movement = await this.prisma.inventoryMovement.findUnique({
      where: { id },
      include: {
        company: true,
        branch: true,
        warehouse: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!movement || movement.deletedAt || !this.isInContext(movement, ctx)) {
      throw this.notFound('Inventory movement not found');
    }
    return movement;
  }

  async create(dto: CreateInventoryMovementDto, userId: string, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw new NotFoundException({ messageKey: 'organization.companyNotFound', message: 'Company not found' });

    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse not found');
    }
    if (warehouse.companyId !== ctx.companyId) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse belongs to another company');
    }
    if (warehouse.branchId && warehouse.branchId !== (dto.branchId || ctx.branchId)) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse belongs to another branch');
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch) throw this.notFound('Branch not found');
    }

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new NotFoundException(`Product ${line.productId} not found`);
      if (line.quantity <= 0) throw new BadRequestException('Quantity must be greater than 0');
      if (!['IN', 'OUT'].includes(line.direction)) {
        throw new BadRequestException(`Invalid direction "${line.direction}". Must be IN or OUT`);
      }
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      const movementNumber = await this.numberingService.generateNumberAtomic('INVENTORY_MOVEMENT');

      const { lines, companyId: _ignoredCompanyId, ...rest } = dto;

      return tx.inventoryMovement.create({
        data: {
          ...rest,
          companyId: ctx.companyId,
          movementNumber,
          status: 'DRAFT',
          createdById: userId,
          lines: {
            create: lines.map((l) => ({
              productId: l.productId,
              warehouseLocationId: l.warehouseLocationId,
              quantity: l.quantity,
              quantityBase: l.quantityBase ?? l.quantity,
              batchNumber: l.batchNumber,
              serialNumber: l.serialNumber,
              expiryDate: l.expiryDate ? new Date(l.expiryDate) : undefined,
              unit: l.unit,
              direction: l.direction,
              notes: l.notes,
            })),
          },
        },
        include: { lines: true },
      });
    });

    await this.audit.log(userId, 'CREATE', 'InventoryMovement', movement.id, { movementNumber: movement.movementNumber });
    return movement;
  }

  async findAll(query: InventoryMovementQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    where.branchId = { in: [ctx.branchId, null] };
    if (query.search) {
      where.OR = [
        { movementNumber: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.movementType) where.movementType = query.movementType;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  async update(id: string, dto: UpdateInventoryMovementDto, userId: string, ctx: ActiveOperationalContext) {
    const movement = await this.findOwned(id, ctx);
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be updated');

    const updated = await this.prisma.inventoryMovement.update({
      where: { id },
      data: { notes: dto.notes },
    });
    await this.audit.log(userId, 'UPDATE', 'InventoryMovement', id, { dto });
    return updated;
  }

  async post(id: string, userId: string, ctx: ActiveOperationalContext) {
    const movement = await this.findOwned(id, ctx);
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be posted');

    const posted = await this.prisma.$transaction(async (tx) => {
      return this.postMovementWithinTransaction(tx, id, userId, ctx);
    });

    await this.audit.log(userId, 'POST', 'InventoryMovement', id,
      { oldStatus: 'DRAFT', newStatus: 'POSTED', warehouseId: movement.warehouseId, lineCount: movement.lines.length });
    return posted;
  }

  /**
   * Phase 1.7 — Posts a DRAFT inventory movement and applies its balance effects inside an
   * existing transaction. Production inventory documents call this inside their own atomic
   * transaction so that the production source record, its linked InventoryMovement, and the
   * resulting inventory_balances are committed or rolled back together.
   *
   * Writes both the legacy Float `quantity` and the phase 1.7 Decimal shadow `quantityBase`
   * to keep the balance dual-compatible during the precision migration.
   */
  async postMovementWithinTransaction(tx: any, id: string, userId: string, ctx: ActiveOperationalContext) {
    const movement = await tx.inventoryMovement.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!movement || movement.deletedAt || !this.isInContext(movement, ctx)) {
      throw this.notFound('Inventory movement not found');
    }
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be posted');

    for (const line of movement.lines) {
      const balance = await this.getOrCreateBalance(
        tx,
        movement.warehouseId,
        line.productId,
        line.warehouseLocationId,
        line.batchNumber,
        line.serialNumber,
        line.expiryDate,
      );

      const delta = line.direction === 'IN' ? line.quantity : -line.quantity;
      const newQuantity = balance.quantity + delta;

      if (newQuantity < 0) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        throw new BadRequestException(
          `Insufficient stock for product ${product?.name || line.productId}. Available: ${balance.quantity}, Requested: ${line.quantity}`,
        );
      }

      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { quantity: newQuantity, quantityBase: newQuantity },
      });
    }

    return tx.inventoryMovement.update({
      where: { id },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedById: userId,
      },
      include: { lines: true },
    });
  }

  async cancel(id: string, userId: string, ctx: ActiveOperationalContext) {
    const movement = await this.findOwned(id, ctx);
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be cancelled');

    const updated = await this.prisma.inventoryMovement.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryMovement', id,
      { oldStatus: movement.status, newStatus: 'CANCELLED' });
    return updated;
  }

  async addLine(id: string, dto: CreateInventoryMovementLineDto, userId: string, ctx: ActiveOperationalContext) {
    const movement = await this.findOwned(id, ctx);
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be modified');
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.quantity <= 0) throw new BadRequestException('Quantity must be greater than 0');
    if (!['IN', 'OUT'].includes(dto.direction)) throw new BadRequestException('Direction must be IN or OUT');

    const line = await this.prisma.inventoryMovementLine.create({
      data: {
        movementId: id,
        productId: dto.productId,
        warehouseLocationId: dto.warehouseLocationId,
        quantity: dto.quantity,
        quantityBase: dto.quantityBase ?? dto.quantity,
        batchNumber: dto.batchNumber,
        serialNumber: dto.serialNumber,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        unit: dto.unit,
        direction: dto.direction,
        notes: dto.notes,
      },
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'ADD_LINE', 'InventoryMovement', id, { lineId: line.id, productId: dto.productId, quantity: dto.quantity });
    return line;
  }

  async updateLine(id: string, lineId: string, dto: Partial<CreateInventoryMovementLineDto>, userId: string, ctx: ActiveOperationalContext) {
    const movement = await this.findOwned(id, ctx);
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be modified');
    const line = await this.prisma.inventoryMovementLine.findUnique({ where: { id: lineId } });
    if (!line || line.movementId !== id) throw this.notFound('Movement line not found');

    const updated = await this.prisma.inventoryMovementLine.update({
      where: { id: lineId },
      data: dto,
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'UPDATE_LINE', 'InventoryMovement', id, { lineId });
    return updated;
  }

  async removeLine(id: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    const movement = await this.findOwned(id, ctx);
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be modified');
    const line = await this.prisma.inventoryMovementLine.findUnique({ where: { id: lineId } });
    if (!line || line.movementId !== id) throw this.notFound('Movement line not found');

    await this.prisma.inventoryMovementLine.delete({ where: { id: lineId } });
    await this.audit.log(userId, 'REMOVE_LINE', 'InventoryMovement', id, { lineId });
    return { message: 'Line removed successfully' };
  }

  async summary(id: string, ctx: ActiveOperationalContext) {
    const movement = await this.findOwned(id, ctx);
    const lines = await this.prisma.inventoryMovementLine.findMany({
      where: { movementId: id },
      select: { direction: true, quantity: true },
    });
    const totalInQty = lines.filter(l => l.direction === 'IN').reduce((s, l) => s + l.quantity, 0);
    const totalOutQty = lines.filter(l => l.direction === 'OUT').reduce((s, l) => s + l.quantity, 0);
    return { movementId: id, movementNumber: movement.movementNumber, status: movement.status, lineCount: lines.length, totalInQty, totalOutQty };
  }

  private async getOrCreateBalance(
    tx: any,
    warehouseId: string,
    productId: string,
    locationId: string | null | undefined,
    batchNumber?: string | null,
    serialNumber?: string | null,
    expiryDate?: Date | null,
  ) {
    const where: any = { warehouseId, productId };
    if (locationId) where.locationId = locationId; else where.locationId = null;
    if (batchNumber) where.batchNumber = batchNumber; else where.batchNumber = null;
    if (serialNumber) where.serialNumber = serialNumber; else where.serialNumber = null;
    let balance = await tx.inventoryBalance.findFirst({ where });
    if (!balance) {
      balance = await tx.inventoryBalance.create({
        data: {
          warehouseId,
          productId,
          locationId: locationId || null,
          quantity: 0,
          quantityBase: 0,
          batchNumber: batchNumber || null,
          serialNumber: serialNumber || null,
          expiryDate: expiryDate || null,
        },
      });
    }
    return balance;
  }
}
