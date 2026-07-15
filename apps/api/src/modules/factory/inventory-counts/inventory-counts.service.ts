import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateInventoryCountDto } from './dto/create-inventory-count.dto';
import { UpdateInventoryCountDto } from './dto/update-inventory-count.dto';

@Injectable()
export class InventoryCountsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateInventoryCountDto, userId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'INVENTORY_COUNT' } });
    if (!seq) throw new NotFoundException('Number sequence INVENTORY_COUNT not configured');

    const count = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const countNumber = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

      return tx.inventoryCount.create({
        data: {
          countNumber,
          companyId: dto.companyId,
          branchId: dto.branchId,
          warehouseId: dto.warehouseId,
          notes: dto.notes,
          status: 'DRAFT',
          createdById: userId,
        },
      });
    });

    await this.audit.log(userId, 'CREATE', 'InventoryCount', count.id, { countNumber: count.countNumber });
    return count;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    companyId?: string; branchId?: string; warehouseId?: string;
    status?: string; dateFrom?: string; dateTo?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { countNumber: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    if (query.companyId) where.companyId = query.companyId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.countDate = {};
      if (query.dateFrom) where.countDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.countDate.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryCount.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          branch: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.inventoryCount.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
      include: {
        company: true,
        branch: true,
        warehouse: true,
        lines: {
          include: {
            product: { select: { id: true, code: true, name: true } },
            warehouseLocation: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!count || count.deletedAt) throw new NotFoundException('Inventory count not found');
    return count;
  }

  async update(id: string, dto: UpdateInventoryCountDto, userId: string) {
    const count = await this.findOne(id);
    if (count.status === 'COMPLETED' || count.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update completed or cancelled counts');
    }

    if (dto.warehouseId) {
      const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
      if (!warehouse) throw new NotFoundException('Warehouse not found');
    }

    const updated = await this.prisma.inventoryCount.update({ where: { id }, data: { ...dto } });
    await this.audit.log(userId, 'UPDATE', 'InventoryCount', id,
      { oldStatus: count.status, dto });
    return updated;
  }

  async start(id: string, userId: string) {
    const count = await this.findOne(id);
    if (count.status !== 'DRAFT') throw new BadRequestException('Only DRAFT counts can be started');
    const updated = await this.prisma.inventoryCount.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date(), startedById: userId },
    });
    await this.audit.log(userId, 'START', 'InventoryCount', id,
      { oldStatus: count.status, newStatus: 'IN_PROGRESS', warehouseId: count.warehouseId });
    return updated;
  }

  async complete(id: string, userId: string) {
    const count = await this.findOne(id);
    if (count.status !== 'IN_PROGRESS') throw new BadRequestException('Only IN_PROGRESS counts can be completed');
    const updated = await this.prisma.inventoryCount.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), completedById: userId },
    });
    await this.audit.log(userId, 'COMPLETE', 'InventoryCount', id,
      { oldStatus: count.status, newStatus: 'COMPLETED', warehouseId: count.warehouseId });
    return updated;
  }

  async cancel(id: string, userId: string) {
    const count = await this.findOne(id);
    if (count.status !== 'DRAFT' && count.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only DRAFT or IN_PROGRESS counts can be cancelled');
    }
    const updated = await this.prisma.inventoryCount.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
    });
    await this.audit.log(userId, 'CANCEL', 'InventoryCount', id,
      { oldStatus: count.status, newStatus: 'CANCELLED', warehouseId: count.warehouseId });
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.inventoryCount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log(userId, 'DELETE', 'InventoryCount', id);
    return { message: 'Inventory count deleted successfully' };
  }
}
