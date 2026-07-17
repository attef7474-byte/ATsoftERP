import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';

@Injectable()
export class PreventiveMaintenanceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async getUpcoming(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
    const where = { status: 'ACTIVE', startDate: { gte: now, lte: thirtyDaysFromNow } };

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

  async getOverdue(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const now = new Date();
    const where = { status: 'ACTIVE', startDate: { lt: now } };

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

  async getCalendar(query: { year?: number; month?: number }) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const schedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
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

  async getExecutionHistory(query: { page?: number; limit?: number; scheduleId?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = {};
    if (query.scheduleId) where.scheduleId = query.scheduleId;

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

  async generateDueTasks(userId: string) {
    const now = new Date();
    const dueSchedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: now },
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

      const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'MAINTENANCE_REQUEST' } });
      if (!seq) continue;

      const request = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.numberSequence.update({
          where: { id: seq.id },
          data: { currentNumber: { increment: 1 } },
        });
        const requestNumber = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

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
}
