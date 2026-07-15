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

  private computeDueStatus(schedule: { status: string; startDate: Date; endDate?: Date | null }): string {
    const now = new Date();
    const daysUntilDue = schedule.startDate
      ? Math.ceil((new Date(schedule.startDate).getTime() - now.getTime()) / 86400000)
      : null;

    if (schedule.status !== 'ACTIVE') return 'inactive';
    if (schedule.endDate && new Date(schedule.endDate) < now) return 'expired';
    if (new Date(schedule.startDate) > now && daysUntilDue !== null && daysUntilDue <= 7) return 'dueSoon';
    if (new Date(schedule.startDate) > now) return 'notDue';
    return 'overdue';
  }

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
    await this.audit.log(userId, 'CREATE', 'MaintenanceSchedule', schedule.id,
      { machineId: dto.machineId });
    return schedule;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    machineId?: string; status?: string; type?: string;
    dueBefore?: string; dueStatus?: string;
  }) {
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
    if (query.dueBefore) {
      where.startDate = { ...where.startDate, lte: new Date(query.dueBefore) };
    }

    const [data, total] = await Promise.all([
      this.prisma.maintenanceSchedule.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true, status: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.maintenanceSchedule.count({ where }),
    ]);

    const enriched = data.map((item: any) => ({
      ...item,
      dueStatus: this.computeDueStatus(item),
    }));

    if (query.dueStatus) {
      const filtered = enriched.filter((item: any) => item.dueStatus === query.dueStatus);
      return { data: filtered, meta: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) } };
    }

    return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true, status: true } },
        request: { select: { id: true, requestNumber: true, title: true } },
        checklistItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!schedule) throw new NotFoundException('Maintenance schedule not found');
    return { ...schedule, dueStatus: this.computeDueStatus(schedule) };
  }

  async update(id: string, dto: UpdateMaintenanceScheduleDto, userId: string) {
    const schedule = await this.findOne(id);
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    const updated = await this.prisma.maintenanceSchedule.update({ where: { id }, data });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceSchedule', id,
      { oldStatus: schedule.status, dto });
    return updated;
  }

  async activate(id: string, userId: string) {
    const schedule = await this.findOne(id);
    await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'MaintenanceSchedule', id,
      { oldStatus: schedule.status, newStatus: 'ACTIVE' });
    return this.findOne(id);
  }

  async deactivate(id: string, userId: string) {
    const schedule = await this.findOne(id);
    await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'MaintenanceSchedule', id,
      { oldStatus: schedule.status, newStatus: 'INACTIVE' });
    return this.findOne(id);
  }

  async remove(id: string, userId: string) {
    const schedule = await this.findOne(id);
    await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceSchedule', id,
      { status: schedule.status });
    return { message: 'Maintenance schedule deactivated successfully' };
  }
}
