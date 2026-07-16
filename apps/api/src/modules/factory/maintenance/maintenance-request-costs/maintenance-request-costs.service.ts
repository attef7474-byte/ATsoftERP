import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceRequestCostDto } from './dto/create-maintenance-request-cost.dto';
import { UpdateMaintenanceRequestCostDto } from './dto/update-maintenance-request-cost.dto';

@Injectable()
export class MaintenanceRequestCostsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateMaintenanceRequestCostDto, userId: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: dto.requestId } });
    if (!request) throw new NotFoundException('Maintenance request not found');

    const data: any = { ...dto };
    if (dto.incurredAt) data.incurredAt = new Date(dto.incurredAt);

    const entry = await this.prisma.maintenanceRequestCostEntry.create({ data });
    await this.audit.log(userId, 'CREATE', 'MaintenanceRequestCostEntry', entry.id,
      { requestId: dto.requestId, type: dto.type, amount: dto.amount });
    return entry;
  }

  async findAll(query: { requestId?: string; type?: string }) {
    const where: any = {};
    if (query.requestId) where.requestId = query.requestId;
    if (query.type) where.type = query.type;

    return this.prisma.maintenanceRequestCostEntry.findMany({
      where,
      include: {
        request: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { incurredAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const entry = await this.prisma.maintenanceRequestCostEntry.findUnique({
      where: { id },
      include: {
        request: { select: { id: true, requestNumber: true, title: true } },
      },
    });
    if (!entry) throw new NotFoundException('Cost entry not found');
    return entry;
  }

  async update(id: string, dto: UpdateMaintenanceRequestCostDto, userId: string) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.incurredAt) data.incurredAt = new Date(dto.incurredAt);

    const updated = await this.prisma.maintenanceRequestCostEntry.update({ where: { id }, data });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequestCostEntry', id, { dto });
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.maintenanceRequestCostEntry.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceRequestCostEntry', id, {});
    return { message: 'Cost entry deleted successfully' };
  }
}
