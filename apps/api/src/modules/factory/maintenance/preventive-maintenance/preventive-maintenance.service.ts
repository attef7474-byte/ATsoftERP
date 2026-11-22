import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { activeNotExpired, calculateNextDueDate, effectiveDueBetween, effectiveDueCompare, generationClaimWhere, getEffectiveDueDate, overdueWhere, upcomingWhere, withDueAuthority } from '../maintenance-schedules/schedule-due-authority';

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
    const where = { ...this.scheduleScope(ctx), ...upcomingWhere(now, 30) };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceSchedule.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: [{ nextDueDate: 'asc' }, { startDate: 'asc' }],
        include: {
          machine: { select: { id: true, code: true, name: true, status: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.maintenanceSchedule.count({ where }),
    ]);
    const enriched = data.map((item: any) => withDueAuthority(item, now))
      .sort((a: any, b: any) => a.effectiveDueDate.getTime() - b.effectiveDueDate.getTime());
    return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getOverdue(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const now = new Date();
    const where = { ...this.scheduleScope(ctx), ...overdueWhere(now) };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceSchedule.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: [{ nextDueDate: 'asc' }, { startDate: 'asc' }],
        include: {
          machine: { select: { id: true, code: true, name: true, status: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.maintenanceSchedule.count({ where }),
    ]);
    const enriched = data.map((item: any) => withDueAuthority(item, now))
      .sort((a: any, b: any) => a.effectiveDueDate.getTime() - b.effectiveDueDate.getTime());
    return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCalendar(query: { year?: number; month?: number }, ctx: ActiveOperationalContext) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const range = effectiveDueBetween(startOfMonth, new Date(startOfNextMonth.getTime() - 1));
    const active = activeNotExpired(now);
    const schedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        ...this.scheduleScope(ctx),
        ...active,
        AND: [...active.AND, ...range.AND],
      },
      include: {
        machine: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ nextDueDate: 'asc' }, { startDate: 'asc' }],
    });

    const enriched = schedules.map((s: any) => withDueAuthority(s, now))
      .sort((a: any, b: any) => a.effectiveDueDate.getTime() - b.effectiveDueDate.getTime());
    const calendar: Record<string, any[]> = {};
    for (const s of enriched) {
      const dateKey = s.effectiveDueDate.toISOString().split('T')[0];
      if (!calendar[dateKey]) calendar[dateKey] = [];
      calendar[dateKey].push(s);
    }

    return { year, month, total: enriched.length, calendar };
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
    const active = activeNotExpired(now);
    const due = effectiveDueCompare('lte', now);
    const dueSchedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        ...this.scheduleScope(ctx),
        ...active,
        AND: [...active.AND, due],
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

      const effectiveDueDate = getEffectiveDueDate(schedule);
      const generatedAt = new Date();
      let advancedNextDue: Date | null = null;
      const request = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.maintenanceSchedule.updateMany({
          where: generationClaimWhere(schedule),
          data: { lastGeneratedAt: generatedAt },
        });
        if (claim.count !== 1) return null;

        const requestNumber = await this.numberingService.generateNumberAtomicWithClient('MAINTENANCE_REQUEST', tx);
        const nextDue = calculateNextDueDate(schedule, generatedAt);
        advancedNextDue = nextDue;

        await tx.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: { lastGeneratedAt: generatedAt, nextDueDate: nextDue, requestId: null },
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

      if (!request) continue;
      await this.audit.log(userId, 'GENERATE', 'MaintenanceRequest', request.id, {
        scheduleId: schedule.id,
        machineId: schedule.machineId,
        previousEffectiveDueDate: effectiveDueDate,
        previousNextDueDate: schedule.nextDueDate ?? null,
        nextDueDate: advancedNextDue,
        lastGeneratedAt: generatedAt,
      });
      created.push(request);
    }

    return { created: created.length, requests: created };
  }

}
