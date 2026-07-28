import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { CreateOpeningBalanceDto, CreateOpeningBalanceLineDto } from './dto/create-opening-balance.dto';
import { UpdateOpeningBalanceDto } from './dto/update-opening-balance.dto';
import { OpeningBalanceQueryDto } from './dto/opening-balance-query.dto';

@Injectable()
export class InventoryOpeningBalancesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
  ) {}

  async create(dto: CreateOpeningBalanceDto, userId: string) {
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
      if (line.quantity < 0) throw new BadRequestException('Quantity must be >= 0');
    }

    const doc = await this.prisma.$transaction(async (tx) => {
      const code = await this.numberingService.generateNumberAtomic('OPENING_BALANCE');

      const { lines, ...rest } = dto;
      return tx.inventoryOpeningBalance.create({
        data: {
          ...rest,
          code,
          status: 'DRAFT',
          createdById: userId,
          lines: {
            create: lines.map((l) => ({
              productId: l.productId,
              locationId: l.locationId,
              quantity: l.quantity,
              notes: l.notes,
            })),
          },
        },
        include: { lines: true },
      });
    });

    await this.audit.log(userId, 'CREATE', 'InventoryOpeningBalance', doc.id, { code: doc.code });
    return doc;
  }

  async findAll(query: OpeningBalanceQueryDto) {
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
      this.prisma.inventoryOpeningBalance.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryOpeningBalance.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const doc = await this.prisma.inventoryOpeningBalance.findUnique({
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
    if (!doc || doc.deletedAt) throw new NotFoundException('Opening balance not found');
    return doc;
  }

  async update(id: string, dto: UpdateOpeningBalanceDto, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be updated');

    const { lines, ...rest } = dto;
    const updated = await this.prisma.inventoryOpeningBalance.update({
      where: { id },
      data: rest,
    });
    await this.audit.log(userId, 'UPDATE', 'InventoryOpeningBalance', id, { dto });
    return updated;
  }

  async submit(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be submitted');
    const updated = await this.prisma.inventoryOpeningBalance.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: userId },
    });
    await this.audit.log(userId, 'SUBMIT', 'InventoryOpeningBalance', id, { oldStatus: doc.status, newStatus: 'SUBMITTED' });
    return updated;
  }

  async approve(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be approved');
    const updated = await this.prisma.inventoryOpeningBalance.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: userId },
    });
    await this.audit.log(userId, 'APPROVE', 'InventoryOpeningBalance', id, { oldStatus: doc.status, newStatus: 'APPROVED' });
    return updated;
  }

  async reject(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED documents can be rejected');
    const updated = await this.prisma.inventoryOpeningBalance.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: userId },
    });
    await this.audit.log(userId, 'REJECT', 'InventoryOpeningBalance', id, { oldStatus: doc.status, newStatus: 'REJECTED' });
    return updated;
  }

  async post(id: string, userId: string) {
    const doc = await this.prisma.inventoryOpeningBalance.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!doc || doc.deletedAt) throw new NotFoundException('Opening balance not found');
    if (doc.status !== 'APPROVED') throw new BadRequestException('Only APPROVED documents can be posted');

    const result = await this.prisma.$transaction(async (tx) => {
      const movementNumber = await this.numberingService.generateNumberAtomic('INVENTORY_MOVEMENT');

      const movement = await tx.inventoryMovement.create({
        data: {
          movementNumber,
          companyId: doc.companyId,
          branchId: doc.branchId,
          warehouseId: doc.warehouseId,
          movementType: 'OPENING_BALANCE',
          status: 'POSTED',
          sourceType: 'OPENING_BALANCE',
          sourceId: doc.id,
          movementDate: new Date(),
          postedAt: new Date(),
          postedById: userId,
          createdById: userId,
          notes: doc.reason,
          lines: {
            create: doc.lines.map((l) => ({
              productId: l.productId,
              warehouseLocationId: l.locationId,
              quantity: l.quantity,
              direction: 'IN',
              notes: l.notes,
            })),
          },
        },
      });

      for (const line of doc.lines) {
        const balance = await this.getOrCreateBalance(tx, doc.warehouseId, line.productId, line.locationId);
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: { quantity: balance.quantity + line.quantity },
        });
        await tx.inventoryOpeningBalanceLine.update({
          where: { id: line.id },
          data: { movementId: movement.id },
        });
      }

      await tx.inventoryOpeningBalance.update({
        where: { id },
        data: { status: 'POSTED', postedAt: new Date(), postedById: userId },
      });

      return tx.inventoryOpeningBalance.findUnique({
        where: { id },
        include: { lines: true },
      });
    });

    await this.audit.log(userId, 'POST', 'InventoryOpeningBalance', id, { oldStatus: doc.status, newStatus: 'POSTED' });
    return result;
  }

  async cancel(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT' && doc.status !== 'SUBMITTED') {
      throw new BadRequestException('Only DRAFT or SUBMITTED documents can be cancelled');
    }
    const updated = await this.prisma.inventoryOpeningBalance.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryOpeningBalance', id, { oldStatus: doc.status, newStatus: 'CANCELLED' });
    return updated;
  }

  async remove(id: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be deleted');
    await this.prisma.inventoryOpeningBalanceLine.deleteMany({ where: { openingBalanceId: id } });
    await this.prisma.inventoryOpeningBalance.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'InventoryOpeningBalance', id, {});
    return { message: 'Opening balance deleted successfully' };
  }

  async addLine(id: string, dto: CreateOpeningBalanceLineDto, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.quantity < 0) throw new BadRequestException('Quantity must be >= 0');

    const line = await this.prisma.inventoryOpeningBalanceLine.create({
      data: {
        openingBalanceId: id,
        productId: dto.productId,
        locationId: dto.locationId,
        quantity: dto.quantity,
        notes: dto.notes,
      },
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'ADD_LINE', 'InventoryOpeningBalance', id, { lineId: line.id });
    return line;
  }

  async updateLine(id: string, lineId: string, dto: Partial<CreateOpeningBalanceLineDto>, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const line = await this.prisma.inventoryOpeningBalanceLine.findUnique({ where: { id: lineId } });
    if (!line || line.openingBalanceId !== id) throw new NotFoundException('Line not found');

    const updated = await this.prisma.inventoryOpeningBalanceLine.update({
      where: { id: lineId },
      data: dto,
      include: { product: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log(userId, 'UPDATE_LINE', 'InventoryOpeningBalance', id, { lineId });
    return updated;
  }

  async removeLine(id: string, lineId: string, userId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== 'DRAFT') throw new BadRequestException('Only DRAFT documents can be modified');
    const line = await this.prisma.inventoryOpeningBalanceLine.findUnique({ where: { id: lineId } });
    if (!line || line.openingBalanceId !== id) throw new NotFoundException('Line not found');

    await this.prisma.inventoryOpeningBalanceLine.delete({ where: { id: lineId } });
    await this.audit.log(userId, 'REMOVE_LINE', 'InventoryOpeningBalance', id, { lineId });
    return { message: 'Line removed successfully' };
  }

  async summary(id: string) {
    const doc = await this.findOne(id);
    const lines = await this.prisma.inventoryOpeningBalanceLine.findMany({
      where: { openingBalanceId: id },
      select: { quantity: true },
    });
    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
    return { openingBalanceId: id, code: doc.code, status: doc.status, lineCount: lines.length, totalQty };
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
