import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class PreventiveMaintenanceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
  ) {}

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private scheduleScope(ctx: ActiveOperationalContext) {
    return { machine: this.machineScope(ctx) };
  }

  async getUpcoming(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
    const where = { ...this.scheduleScope(ctx), status: 'ACTIVE', startDate: { gte: now, lte: thirtyDaysFromNow } };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceSchedule.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { startDate: 'asc' },
        include: {
          machine: { select: { id: true, code: true, name: true, status: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.maintenanceSchedule.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getOverdue(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const now = new Date();
    const where = { ...this.scheduleScope(ctx), status: 'ACTIVE', startDate: { lt: now } };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceSchedule.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { startDate: 'asc' },
        include: {
          machine: { select: { id: true, code: true, name: true, status: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.maintenanceSchedule.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCalendar(query: { year?: number; month?: number }, ctx: ActiveOperationalContext) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const schedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        ...this.scheduleScope(ctx),
        status: 'ACTIVE',
        startDate: { gte: startOfMonth, lt: startOfNextMonth },
      },
      include: {
        machine: { select: { id: true, code: true, name: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    const calendar: Record<string, any[]> = {};
    for (const s of schedules) {
      const dateKey = s.startDate.toISOString().split('T')[0];
      if (!calendar[dateKey]) calendar[dateKey] = [];
      calendar[dateKey].push(s);
    }

    return { year, month, total: schedules.length, calendar };
  }

  async getExecutionHistory(query: { page?: number; limit?: number; scheduleId?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = { schedule: { machine: this.machineScope(ctx) } };
    if (query.scheduleId) {
      const schedule = await this.prisma.maintenanceSchedule.findUnique({
        where: { id: query.scheduleId },
        include: { machine: { select: { companyId: true, branchId: true } } },
      });
      if (!schedule || schedule.machine.companyId !== ctx.companyId
        || (schedule.machine.branchId !== null && schedule.machine.branchId !== ctx.branchId)) {
        throw this.notFound('maintenance.scheduleNotFound', 'Maintenance schedule not found');
      }
      where.scheduleId = query.scheduleId;
    }

    const [data, total] = await Promise.all([
      this.prisma.maintenanceChecklistExecution.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          schedule: { select: { id: true, title: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
          completedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.maintenanceChecklistExecution.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async generateDueTasks(userId: string, ctx: ActiveOperationalContext) {
    const now = new Date();
    const dueSchedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        ...this.scheduleScope(ctx),
        status: 'ACTIVE',
        OR: [
          { startDate: { lte: now } },
          { nextDueDate: { not: null, lte: now } },
        ],
      },
      include: { machine: true },
    });

    const created: any[] = [];
    for (const schedule of dueSchedules) {
      const existingRequest = await this.prisma.maintenanceRequest.findFirst({
        where: {
          machineId: schedule.machineId,
          type: schedule.type,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          deletedAt: null,
        },
      });

      if (existingRequest) continue;

      const request = await this.prisma.$transaction(async (tx) => {
        const requestNumber = await this.numberingService.generateNumberAtomic('MAINTENANCE_REQUEST');

        const nextDue = this.calculateNextDueDate(schedule, now);

        await tx.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: { lastGeneratedAt: now, nextDueDate: nextDue, requestId: null },
        });

        return tx.maintenanceRequest.create({
          data: {
            requestNumber,
            machineId: schedule.machineId,
            type: schedule.type || 'PREVENTIVE',
            priority: 'MEDIUM',
            title: `Preventive: ${schedule.title}`,
            description: `Auto-generated from preventive schedule ${schedule.title}`,
            requestedById: userId,
            status: 'OPEN',
          },
        });
      });

      await this.audit.log(userId, 'GENERATE', 'MaintenanceRequest', request.id,
        { scheduleId: schedule.id, machineId: schedule.machineId });
      created.push(request);
    }

    return { created: created.length, requests: created };
  }

  private calculateNextDueDate(schedule: { startDate: Date; intervalDays?: number | null; frequency: string; endDate?: Date | null }, from: Date): Date | null {
    const base = from;
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
}
