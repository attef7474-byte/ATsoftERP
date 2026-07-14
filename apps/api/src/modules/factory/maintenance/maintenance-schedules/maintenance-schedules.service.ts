import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceScheduleDto } from './dto/create-maintenance-schedule.dto';
import { UpdateMaintenanceScheduleDto } from './dto/update-maintenance-schedule.dto';

@Injectable()
export class MaintenanceSchedulesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateMaintenanceScheduleDto, userId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine) throw new NotFoundException('Machine not found');
    if (dto.requestId) {
      const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: dto.requestId } });
      if (!request) throw new NotFoundException('Maintenance request not found');
    }
    const data: any = { ...dto };
    data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    const schedule = await this.prisma.maintenanceSchedule.create({ data });
    await this.audit.log(userId, 'create', 'MaintenanceSchedule', schedule.id, { dto });
    return schedule;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; machineId?: string; status?: string; type?: string }) {
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
    if (query.machineId) where.machineId = query.machineId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceSchedule.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.maintenanceSchedule.count({ where }),
    ]);

    const now = new Date();
    const enriched = data.map((item: any) => {
      let dueStatus = 'active';
      if (item.status !== 'ACTIVE') {
        dueStatus = 'inactive';
      } else if (item.endDate && item.endDate < now) {
        dueStatus = 'expired';
      } else if (item.startDate > now) {
        dueStatus = 'notDue';
      } else {
        dueStatus = 'overdue';
      }
      return { ...item, dueStatus };
    });

    return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        request: { select: { id: true, requestNumber: true, title: true } },
        checklistItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!schedule) throw new NotFoundException('Maintenance schedule not found');
    return schedule;
  }

  async update(id: string, dto: UpdateMaintenanceScheduleDto, userId: string) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    const schedule = await this.prisma.maintenanceSchedule.update({ where: { id }, data });
    await this.audit.log(userId, 'update', 'MaintenanceSchedule', id, { dto });
    return schedule;
  }

  async activate(id: string, userId: string) {
    await this.findOne(id);
    const schedule = await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'activate', 'MaintenanceSchedule', id, {});
    return schedule;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const schedule = await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'deactivate', 'MaintenanceSchedule', id, {});
    return schedule;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'delete', 'MaintenanceSchedule', id, {});
    return { message: 'Maintenance schedule deactivated successfully' };
  }
}
