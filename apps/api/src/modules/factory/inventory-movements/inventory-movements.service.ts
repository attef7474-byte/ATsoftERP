import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateInventoryMovementDto, CreateInventoryMovementLineDto } from './dto/create-inventory-movement.dto';
import { UpdateInventoryMovementDto } from './dto/update-inventory-movement.dto';
import { InventoryMovementQueryDto } from './dto/inventory-movement-query.dto';

@Injectable()
export class InventoryMovementsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateInventoryMovementDto, userId: string) {
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
      if (line.quantity <= 0) throw new BadRequestException('Quantity must be greater than 0');
      if (!['IN', 'OUT'].includes(line.direction)) {
        throw new BadRequestException(`Invalid direction "${line.direction}". Must be IN or OUT`);
      }
    }

    const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'INVENTORY_MOVEMENT' } });
    if (!seq) throw new NotFoundException('Number sequence INVENTORY_MOVEMENT not configured');

    const movement = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const movementNumber = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

      const { lines, ...rest } = dto;

      return tx.inventoryMovement.create({
        data: {
          ...rest,
          movementNumber,
          status: 'DRAFT',
          createdById: userId,
          lines: {
            create: lines.map((l) => ({
              productId: l.productId,
              warehouseLocationId: l.warehouseLocationId,
              quantity: l.quantity,
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

  async findAll(query: InventoryMovementQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { movementNumber: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    if (query.companyId) where.companyId = query.companyId;
    if (query.branchId) where.branchId = query.branchId;
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

  async findOne(id: string) {
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
    if (!movement || movement.deletedAt) throw new NotFoundException('Inventory movement not found');
    return movement;
  }

  async update(id: string, dto: UpdateInventoryMovementDto, userId: string) {
    const movement = await this.findOne(id);
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be updated');

    const updated = await this.prisma.inventoryMovement.update({
      where: { id },
      data: { notes: dto.notes },
    });
    await this.audit.log(userId, 'UPDATE', 'InventoryMovement', id, { dto });
    return updated;
  }

  async post(id: string, userId: string) {
    const movement = await this.prisma.inventoryMovement.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!movement || movement.deletedAt) throw new NotFoundException('Inventory movement not found');
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be posted');

    const posted = await this.prisma.$transaction(async (tx) => {
      for (const line of movement.lines) {
        const balance = await this.getOrCreateBalance(tx, movement.warehouseId, line.productId, line.warehouseLocationId);

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
          data: { quantity: newQuantity },
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
    });

    await this.audit.log(userId, 'POST', 'InventoryMovement', id,
      { oldStatus: 'DRAFT', newStatus: 'POSTED', warehouseId: movement.warehouseId, lineCount: movement.lines.length });
    return posted;
  }

  async cancel(id: string, userId: string) {
    const movement = await this.prisma.inventoryMovement.findUnique({ where: { id } });
    if (!movement || movement.deletedAt) throw new NotFoundException('Inventory movement not found');
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be cancelled');

    const updated = await this.prisma.inventoryMovement.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryMovement', id,
      { oldStatus: movement.status, newStatus: 'CANCELLED' });
    return updated;
  }

  async addLine(id: string, dto: CreateInventoryMovementLineDto, userId: string) {
    const movement = await this.findOne(id);
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be modified');
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.quantity <= 0) throw new BadRequestException('Quantity must be greater than 0');
    if (!['IN', 'OUT'].includes(dto.direction)) throw new BadRequestException('Direction must be IN or OUT');

    const line = await this.prisma.inventoryMovementLine.create({
      data: { movementId: id, productId: dto.productId, warehouseLocationId: dto.warehouseLocationId, quantity: dto.quantity, unit: dto.unit, direction: dto.direction, notes: dto.notes },
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'ADD_LINE', 'InventoryMovement', id, { lineId: line.id, productId: dto.productId, quantity: dto.quantity });
    return line;
  }

  async updateLine(id: string, lineId: string, dto: Partial<CreateInventoryMovementLineDto>, userId: string) {
    const movement = await this.findOne(id);
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be modified');
    const line = await this.prisma.inventoryMovementLine.findUnique({ where: { id: lineId } });
    if (!line || line.movementId !== id) throw new NotFoundException('Movement line not found');

    const updated = await this.prisma.inventoryMovementLine.update({
      where: { id: lineId },
      data: dto,
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'UPDATE_LINE', 'InventoryMovement', id, { lineId });
    return updated;
  }

  async removeLine(id: string, lineId: string, userId: string) {
    const movement = await this.findOne(id);
    if (movement.status !== 'DRAFT') throw new BadRequestException('Only DRAFT movements can be modified');
    const line = await this.prisma.inventoryMovementLine.findUnique({ where: { id: lineId } });
    if (!line || line.movementId !== id) throw new NotFoundException('Movement line not found');

    await this.prisma.inventoryMovementLine.delete({ where: { id: lineId } });
    await this.audit.log(userId, 'REMOVE_LINE', 'InventoryMovement', id, { lineId });
    return { message: 'Line removed successfully' };
  }

  async summary(id: string) {
    const movement = await this.findOne(id);
    const lines = await this.prisma.inventoryMovementLine.findMany({
      where: { movementId: id },
      select: { direction: true, quantity: true },
    });
    const totalInQty = lines.filter(l => l.direction === 'IN').reduce((s, l) => s + l.quantity, 0);
    const totalOutQty = lines.filter(l => l.direction === 'OUT').reduce((s, l) => s + l.quantity, 0);
    return { movementId: id, movementNumber: movement.movementNumber, status: movement.status, lineCount: lines.length, totalInQty, totalOutQty };
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
