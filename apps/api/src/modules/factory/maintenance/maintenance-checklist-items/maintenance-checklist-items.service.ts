import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceChecklistItemDto } from './dto/create-maintenance-checklist-item.dto';
import { UpdateMaintenanceChecklistItemDto } from './dto/update-maintenance-checklist-item.dto';

@Injectable()
export class MaintenanceChecklistItemsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateMaintenanceChecklistItemDto, userId: string) {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({ where: { id: dto.scheduleId } });
    if (!schedule) throw new NotFoundException('Maintenance schedule not found');
    const item = await this.prisma.maintenanceChecklistItem.create({ data: dto });
    await this.audit.log(userId, 'create', 'MaintenanceChecklistItem', item.id, { dto });
    return item;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; scheduleId?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    if (query.scheduleId) where.scheduleId = query.scheduleId;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceChecklistItem.findMany({
        where, skip, take: limit, orderBy: { sortOrder: 'asc' },
        include: { schedule: { select: { id: true, title: true } } },
      }),
      this.prisma.maintenanceChecklistItem.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const item = await this.prisma.maintenanceChecklistItem.findUnique({
      where: { id },
      include: { schedule: { select: { id: true, title: true } } },
    });
    if (!item) throw new NotFoundException('Checklist item not found');
    return item;
  }

  async update(id: string, dto: UpdateMaintenanceChecklistItemDto, userId: string) {
    await this.findOne(id);
    const item = await this.prisma.maintenanceChecklistItem.update({ where: { id }, data: dto });
    await this.audit.log(userId, 'update', 'MaintenanceChecklistItem', id, { dto });
    return item;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.maintenanceChecklistItem.delete({ where: { id } });
    await this.audit.log(userId, 'delete', 'MaintenanceChecklistItem', id, {});
    return { message: 'Checklist item deleted successfully' };
  }
}
