import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceRequestPartDto } from './dto/create-maintenance-request-part.dto';
import { UpdateMaintenanceRequestPartDto } from './dto/update-maintenance-request-part.dto';

@Injectable()
export class MaintenanceRequestPartsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateMaintenanceRequestPartDto, userId: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: dto.requestId } });
    if (!request) throw new NotFoundException('Maintenance request not found');

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const data: any = { ...dto };
    if (dto.unitCost && dto.quantity) {
      data.totalCost = dto.unitCost * dto.quantity;
    }

    const part = await this.prisma.maintenanceRequestPartUsage.create({ data });
    await this.audit.log(userId, 'CREATE', 'MaintenanceRequestPartUsage', part.id,
      { requestId: dto.requestId, productId: dto.productId, quantity: dto.quantity });
    return part;
  }

  async findAll(query: { requestId?: string; productId?: string }) {
    const where: any = {};
    if (query.requestId) where.requestId = query.requestId;
    if (query.productId) where.productId = query.productId;

    return this.prisma.maintenanceRequestPartUsage.findMany({
      where,
      include: {
        request: { select: { id: true, requestNumber: true, title: true } },
        product: { select: { id: true, name: true, code: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const part = await this.prisma.maintenanceRequestPartUsage.findUnique({
      where: { id },
      include: {
        request: { select: { id: true, requestNumber: true, title: true } },
        product: { select: { id: true, name: true, code: true, unit: true } },
      },
    });
    if (!part) throw new NotFoundException('Part usage not found');
    return part;
  }

  async update(id: string, dto: UpdateMaintenanceRequestPartDto, userId: string) {
    await this.findOne(id);
    const data: any = { ...dto };
    const qty = dto.quantity ?? undefined;
    const cost = dto.unitCost ?? undefined;
    if (cost !== undefined && qty !== undefined) {
      data.totalCost = cost * qty;
    } else if (cost !== undefined && qty === undefined) {
      const existing = await this.prisma.maintenanceRequestPartUsage.findUnique({ where: { id } });
      if (existing) data.totalCost = cost * existing.quantity;
    }

    const updated = await this.prisma.maintenanceRequestPartUsage.update({ where: { id }, data });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequestPartUsage', id, { dto });
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.maintenanceRequestPartUsage.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceRequestPartUsage', id, {});
    return { message: 'Part usage deleted successfully' };
  }
}
