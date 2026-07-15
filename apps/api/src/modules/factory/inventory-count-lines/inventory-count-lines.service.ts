import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateInventoryCountLineDto } from './dto/create-inventory-count-line.dto';
import { UpdateInventoryCountLineDto } from './dto/update-inventory-count-line.dto';
import { CountInventoryCountLineDto } from './dto/count-inventory-count-line.dto';

@Injectable()
export class InventoryCountLinesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(countId: string, dto: CreateInventoryCountLineDto, userId: string) {
    const count = await this.prisma.inventoryCount.findUnique({ where: { id: countId } });
    if (!count || count.deletedAt) throw new NotFoundException('Inventory count not found');
    if (count.status !== 'DRAFT' && count.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Lines can only be added to DRAFT or IN_PROGRESS counts');
    }

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.inventoryCountLine.findFirst({
      where: {
        countId,
        productId: dto.productId,
        warehouseLocationId: dto.warehouseLocationId ?? null,
        deletedAt: null,
      },
    });
    if (existing) throw new BadRequestException('A line for this product and location already exists in this count');

    const balance = await this.prisma.inventoryBalance.findFirst({
      where: {
        warehouseId: count.warehouseId,
        productId: dto.productId,
        locationId: dto.warehouseLocationId ?? null,
      },
    });
    const systemQty = dto.systemQty ?? (balance?.quantity ?? 0);

    const line = await this.prisma.inventoryCountLine.create({
      data: {
        countId,
        productId: dto.productId,
        warehouseLocationId: dto.warehouseLocationId,
        systemQty,
        notes: dto.notes,
        status: 'PENDING',
      },
    });

    await this.audit.log(userId, 'CREATE', 'InventoryCountLine', line.id, { countId, productId: dto.productId });
    return line;
  }

  async findByCountId(countId: string) {
    return this.prisma.inventoryCountLine.findMany({
      where: { countId, deletedAt: null },
      include: {
        product: { select: { id: true, code: true, name: true } },
        warehouseLocation: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const line = await this.prisma.inventoryCountLine.findUnique({
      where: { id },
      include: {
        count: true,
        product: { select: { id: true, code: true, name: true } },
        warehouseLocation: { select: { id: true, code: true, name: true } },
      },
    });
    if (!line || line.deletedAt) throw new NotFoundException('Inventory count line not found');
    return line;
  }

  async update(id: string, dto: UpdateInventoryCountLineDto, userId: string) {
    const line = await this.findOne(id);
    if (line.status === 'VERIFIED') {
      throw new BadRequestException('Cannot update verified lines');
    }
    if (line.status !== 'PENDING' && line.status !== 'COUNTED') {
      throw new BadRequestException('Only PENDING or COUNTED lines can be updated');
    }

    const updated = await this.prisma.inventoryCountLine.update({
      where: { id },
      data: {
        ...(dto.systemQty !== undefined && { systemQty: dto.systemQty }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.audit.log(userId, 'UPDATE', 'InventoryCountLine', id,
      { oldStatus: line.status, dto });
    return updated;
  }

  async countLine(id: string, dto: CountInventoryCountLineDto, userId: string) {
    const line = await this.findOne(id);
    if (line.status === 'VERIFIED') {
      throw new BadRequestException('Cannot count a verified line');
    }
    if (line.status !== 'PENDING' && line.status !== 'COUNTED') {
      throw new BadRequestException('Only PENDING or COUNTED lines can be counted');
    }

    const differenceQty = dto.countedQty - line.systemQty;

    const updated = await this.prisma.inventoryCountLine.update({
      where: { id },
      data: {
        status: 'COUNTED',
        countedQty: dto.countedQty,
        differenceQty,
        countedAt: new Date(),
        countedById: userId,
      },
    });

    await this.audit.log(userId, 'COUNT', 'InventoryCountLine', id,
      { oldStatus: line.status, newStatus: 'COUNTED', countedQty: dto.countedQty, systemQty: line.systemQty, differenceQty });
    return updated;
  }

  async verify(id: string, userId: string) {
    const line = await this.findOne(id);
    if (line.status !== 'COUNTED') {
      throw new BadRequestException('Only COUNTED lines can be verified');
    }

    const updated = await this.prisma.inventoryCountLine.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedById: userId,
      },
    });

    await this.audit.log(userId, 'VERIFY', 'InventoryCountLine', id,
      { oldStatus: line.status, newStatus: 'VERIFIED', countId: line.countId });
    return updated;
  }
}
