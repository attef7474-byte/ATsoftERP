import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { CreateMaintenanceScheduleDto } from './dto/create-maintenance-schedule.dto';
import { UpdateMaintenanceScheduleDto } from './dto/update-maintenance-schedule.dto';

@Injectable()
export class MaintenanceSchedulesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
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

  async execute(id: string, requestId: string | undefined, userId: string) {
    const schedule = await this.findOne(id);

    const existingExecution = await this.prisma.maintenanceChecklistExecution.findFirst({
      where: { scheduleId: id, status: 'IN_PROGRESS' },
    });
    if (existingExecution) {
      throw new ConflictException('An execution is already in progress for this schedule. Complete it first.');
    }

    const checklistItems = await this.prisma.maintenanceChecklistItem.findMany({
      where: { scheduleId: id },
      orderBy: { sortOrder: 'asc' },
    });

    const execution = await this.prisma.maintenanceChecklistExecution.create({
      data: {
        scheduleId: id,
        requestId: requestId || undefined,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        completedById: userId,
        items: {
          create: checklistItems.map(item => ({
            checklistItemId: item.id,
            status: 'PENDING',
          })),
        },
      },
      include: { items: true },
    });

    await this.audit.log(userId, 'EXECUTE', 'MaintenanceSchedule', id,
      { executionId: execution.id, requestId });
    return execution;
  }

  async generateRequest(id: string, userId: string) {
    const schedule = await this.findOne(id);
    if (schedule.status !== 'ACTIVE') throw new BadRequestException('Only active schedules can generate requests');

    const existingRequest = await this.prisma.maintenanceRequest.findFirst({
      where: {
        machineId: schedule.machineId,
        type: schedule.type,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        deletedAt: null,
      },
    });
    if (existingRequest) throw new ConflictException('An active request already exists for this schedule. Complete or cancel the existing request before generating a new one.');

    const request = await this.prisma.$transaction(async (tx) => {
      const requestNumber = await this.numberingService.generateNumberAtomic('MAINTENANCE_REQUEST');

      const nextDue = this.calculateNextDueDate(schedule);

      await tx.maintenanceSchedule.update({
        where: { id },
        data: { lastGeneratedAt: new Date(), nextDueDate: nextDue, requestId: null },
      });

      return tx.maintenanceRequest.create({
        data: {
          requestNumber,
          machineId: schedule.machineId,
          type: schedule.type || 'PREVENTIVE',
          priority: 'MEDIUM',
          title: `Preventive: ${schedule.title}`,
          description: `Auto-generated from schedule ${schedule.title}`,
          requestedById: userId,
          status: 'OPEN',
        },
      });
    });

    await this.audit.log(userId, 'GENERATE', 'MaintenanceSchedule', id,
      { requestId: request.id });
    return request;
  }

  private calculateNextDueDate(schedule: { startDate: Date; intervalDays?: number | null; frequency: string; endDate?: Date | null }): Date | null {
    if (schedule.endDate && new Date(schedule.endDate) < new Date()) return null;
    const baseDate = new Date();
    if (schedule.intervalDays && schedule.intervalDays > 0) {
      return new Date(baseDate.getTime() + schedule.intervalDays * 86400000);
    }
    switch (schedule.frequency) {
      case 'DAILY': return new Date(baseDate.getTime() + 86400000);
      case 'WEEKLY': return new Date(baseDate.getTime() + 7 * 86400000);
      case 'MONTHLY': return new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, baseDate.getDate());
      case 'QUARTERLY': return new Date(baseDate.getFullYear(), baseDate.getMonth() + 3, baseDate.getDate());
      case 'YEARLY': return new Date(baseDate.getFullYear() + 1, baseDate.getMonth(), baseDate.getDate());
      default: return schedule.intervalDays ? new Date(baseDate.getTime() + schedule.intervalDays * 86400000) : null;
    }
  }

  async getHistory(id: string, query: { page?: number; limit?: number }) {
    await this.findOne(id);
    const page = query.page || 1;
    const limit = query.limit || 10;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceChecklistExecution.findMany({
        where: { scheduleId: id },
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          request: { select: { id: true, requestNumber: true, title: true } },
          completedBy: { select: { id: true, name: true } },
          items: { include: { checklistItem: { select: { id: true, title: true } } } },
        },
      }),
      this.prisma.maintenanceChecklistExecution.count({ where: { scheduleId: id } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
