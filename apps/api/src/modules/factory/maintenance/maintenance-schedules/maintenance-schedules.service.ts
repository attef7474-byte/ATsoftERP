import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { CreateMaintenanceScheduleDto } from './dto/create-maintenance-schedule.dto';
import { UpdateMaintenanceScheduleDto } from './dto/update-maintenance-schedule.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class MaintenanceSchedulesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
  ) {}

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private badRequest(key: string, message: string, params?: Record<string, string>): BadRequestException {
    return new BadRequestException({ messageKey: key, message, ...(params ? { params } : {}) });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async validateScheduleMachine(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
    return machine;
  }

  private async validateRequest(requestId: string | undefined, machineId: string, ctx: ActiveOperationalContext) {
    if (!requestId) return;
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
    if (!request) throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
    if (request.machineId !== machineId) {
      throw this.badRequest('maintenance.requestMachineMismatch', 'Maintenance request does not belong to the selected machine');
    }
    const machine = await this.prisma.machine.findUnique({ where: { id: request.machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
  }

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

  async create(dto: CreateMaintenanceScheduleDto, userId: string, ctx: ActiveOperationalContext) {
    await this.validateScheduleMachine(dto.machineId, ctx);
    await this.validateRequest(dto.requestId, dto.machineId, ctx);
    const data: any = { ...dto };
    data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    data.nextDueDate = data.startDate;
    const schedule = await this.prisma.maintenanceSchedule.create({ data });
    await this.audit.log(userId, 'CREATE', 'MaintenanceSchedule', schedule.id,
      { machineId: dto.machineId });
    return schedule;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    machineId?: string; status?: string; type?: string;
    dueBefore?: string; dueStatus?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { machine: this.machineScope(ctx) };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    if (query.machineId) {
      await this.validateScheduleMachine(query.machineId, ctx);
      where.machineId = query.machineId;
    }
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

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true, status: true, companyId: true, branchId: true } },
        request: { select: { id: true, requestNumber: true, title: true } },
        checklistItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!schedule) throw this.notFound('maintenance.scheduleNotFound', 'Maintenance schedule not found');
    if (!this.machineOwns(schedule.machine, ctx)) throw this.notFound('maintenance.scheduleNotFound', 'Maintenance schedule not found');
    return { ...schedule, dueStatus: this.computeDueStatus(schedule) };
  }

  async update(id: string, dto: UpdateMaintenanceScheduleDto, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
    if (dto.machineId && dto.machineId !== schedule.machineId) {
      await this.validateScheduleMachine(dto.machineId, ctx);
      await this.validateRequest(dto.requestId, dto.machineId, ctx);
    } else if (dto.requestId) {
      await this.validateRequest(dto.requestId, schedule.machineId, ctx);
    }
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    const updated = await this.prisma.maintenanceSchedule.update({ where: { id }, data });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceSchedule', id,
      { oldStatus: schedule.status, dto });
    return updated;
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
    await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'MaintenanceSchedule', id,
      { oldStatus: schedule.status, newStatus: 'ACTIVE' });
    return this.findOne(id, ctx);
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
    await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'MaintenanceSchedule', id,
      { oldStatus: schedule.status, newStatus: 'INACTIVE' });
    return this.findOne(id, ctx);
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
    await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceSchedule', id,
      { status: schedule.status });
    return { message: 'Maintenance schedule deactivated successfully' };
  }

  async execute(id: string, requestId: string | undefined, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);

    if (requestId) await this.validateRequest(requestId, schedule.machineId, ctx);

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
            itemTitleSnapshot: item.title,
            itemSortOrderSnapshot: item.sortOrder,
            itemMandatorySnapshot: item.isMandatory,
            resultTypeSnapshot: item.resultType,
            minValueSnapshot: item.minValue ?? null,
            maxValueSnapshot: item.maxValue ?? null,
          })),
        },
      },
      include: { items: true },
    });

    await this.audit.log(userId, 'EXECUTE', 'MaintenanceSchedule', id,
      { executionId: execution.id, requestId });
    return execution;
  }

  async generateRequest(id: string, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
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
      const requestNumber = await this.numberingService.generateNumberAtomicWithClient('MAINTENANCE_REQUEST', tx);

      const nextDue = this.calculateNextDueDate(schedule, new Date());

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

  private calculateNextDueDate(schedule: { startDate: Date; intervalDays?: number | null; frequency: string; endDate?: Date | null }, from?: Date): Date | null {
    const base = from || new Date();
    if (schedule.endDate && new Date(schedule.endDate) < base) return null;
    if (schedule.intervalDays && schedule.intervalDays > 0) {
      return new Date(base.getTime() + schedule.intervalDays * 86400000);
    }
    switch (schedule.frequency) {
      case 'DAILY': return new Date(base.getTime() + 86400000);
      case 'WEEKLY': return new Date(base.getTime() + 7 * 86400000);
      case 'MONTHLY': return new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());
      case 'QUARTERLY': return new Date(base.getFullYear(), base.getMonth() + 3, base.getDate());
      case 'YEARLY': return new Date(base.getFullYear() + 1, base.getMonth(), base.getDate());
      default: return schedule.intervalDays ? new Date(base.getTime() + schedule.intervalDays * 86400000) : null;
    }
  }

  async getHistory(id: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
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
