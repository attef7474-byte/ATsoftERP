import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { DowntimeLogsService } from '../downtime-logs/downtime-logs.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class MaintenanceReliabilityService {
  constructor(
    private prisma: PrismaService,
    private downtimeLogsService: DowntimeLogsService,
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

  private async assertMachineAccess(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findFirst({
      where: { id: machineId, ...this.machineScope(ctx) },
      select: { id: true },
    });
    if (!machine) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
  }

  private async assertLineAccess(productionLineId: string, ctx: ActiveOperationalContext) {
    const line = await this.prisma.productionLine.findFirst({
      where: { id: productionLineId, companyId: ctx.companyId, branchId: ctx.branchId },
      select: { id: true },
    });
    if (!line) throw this.notFound('maintenance.productionLineNotFound', 'Production line not found');
  }

  async getMttr(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }, ctx: ActiveOperationalContext) {
    return this.downtimeLogsService.getMttr(query, ctx);
  }

  async getMtbf(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }, ctx: ActiveOperationalContext) {
    return this.downtimeLogsService.getMtbf(query, ctx);
  }

  async getTotalDowntime(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }, ctx: ActiveOperationalContext) {
    return this.downtimeLogsService.getTotalDowntime(query, ctx);
  }

  async getDowntimeByMachine(query: { dateFrom?: string; dateTo?: string; limit?: number }, ctx: ActiveOperationalContext) {
    return this.downtimeLogsService.getDowntimeByMachine(query, ctx);
  }

  async getDowntimeByProductionLine(query: { dateFrom?: string; dateTo?: string }, ctx: ActiveOperationalContext) {
    return this.downtimeLogsService.getDowntimeByProductionLine(query, ctx);
  }

  async getDowntimeByCause(query: { dateFrom?: string; dateTo?: string }, ctx: ActiveOperationalContext) {
    return this.downtimeLogsService.getDowntimeByCause(query, ctx);
  }

  async getRepeatFailures(query: { dateFrom?: string; dateTo?: string; limit?: number }, ctx: ActiveOperationalContext) {
    return this.downtimeLogsService.getRepeatFailures(query, ctx);
  }

  async getEmergencyResponseTime(query: { dateFrom?: string; dateTo?: string }, ctx: ActiveOperationalContext) {
    return this.downtimeLogsService.getEmergencyResponseTime(query, ctx);
  }

  async getTopMachines(query: { dateFrom?: string; dateTo?: string; limit?: number }, ctx: ActiveOperationalContext) {
    return this.downtimeLogsService.getTopMachines(query, ctx);
  }

  async getTopCauses(query: { dateFrom?: string; dateTo?: string }, ctx: ActiveOperationalContext) {
    return this.downtimeLogsService.getTopCauses(query, ctx);
  }

  // ─────────────── AF-AG: New Reliability KPIs ───────────────

  async getRepeatFailureRate(query: { dateFrom?: string; dateTo?: string; machineId?: string; productionLineId?: string; operationTypeId?: string; costCenterId?: string }, ctx: ActiveOperationalContext) {
    const machineFilter: any = this.machineScope(ctx);
    if (query.operationTypeId) machineFilter.operationTypeId = query.operationTypeId;
    if (query.costCenterId) machineFilter.defaultCostCenterId = query.costCenterId;
    const where: any = { cancelledAt: null, machine: machineFilter };
    if (query.machineId) {
      await this.assertMachineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    if (query.productionLineId) {
      await this.assertLineAccess(query.productionLineId, ctx);
      const machines = await this.prisma.machine.findMany({
        where: { productionLineId: query.productionLineId, ...this.machineScope(ctx) },
        select: { id: true },
      });
      where.machineId = { in: machines.map(m => m.id) };
    }
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const [total, repeatCount] = await Promise.all([
      this.prisma.downtimeLog.count({ where }),
      this.prisma.downtimeLog.count({ where: { ...where, isRepeatFailure: true } }),
    ]);

    return {
      totalEvents: total,
      repeatEvents: repeatCount,
      repeatFailureRate: total > 0 ? Math.round((repeatCount / total) * 100 * 100) / 100 : 0,
    };
  }

  async getAvailability(query: { dateFrom?: string; dateTo?: string; machineId?: string; productionLineId?: string; operationTypeId?: string; costCenterId?: string }, ctx: ActiveOperationalContext) {
    const machineFilter: any = this.machineScope(ctx);
    if (query.operationTypeId) machineFilter.operationTypeId = query.operationTypeId;
    if (query.costCenterId) machineFilter.defaultCostCenterId = query.costCenterId;
    const where: any = { cancelledAt: null, machine: machineFilter };
    if (query.machineId) {
      await this.assertMachineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    if (query.productionLineId) {
      await this.assertLineAccess(query.productionLineId, ctx);
      const machines = await this.prisma.machine.findMany({
        where: { productionLineId: query.productionLineId, ...this.machineScope(ctx) },
        select: { id: true },
      });
      where.machineId = { in: machines.map(m => m.id) };
    }
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const downtimeResult = await this.prisma.downtimeLog.aggregate({
      where,
      _sum: { durationMinutes: true },
    });

    let periodHours = 0;
    if (query.dateFrom && query.dateTo) {
      const from = new Date(query.dateFrom);
      const to = new Date(query.dateTo);
      periodHours = (to.getTime() - from.getTime()) / 3600000;
    } else {
      const [firstEvent, lastEvent] = await Promise.all([
        this.prisma.downtimeLog.findFirst({ where, orderBy: { startTime: 'asc' }, select: { startTime: true } }),
        this.prisma.downtimeLog.findFirst({ where, orderBy: { startTime: 'desc' }, select: { startTime: true } }),
      ]);
      if (firstEvent && lastEvent) {
        periodHours = (lastEvent.startTime.getTime() - firstEvent.startTime.getTime()) / 3600000;
      }
    }

    const downtimeHours = (downtimeResult._sum.durationMinutes || 0) / 60;

    return {
      periodHours: Math.round(periodHours * 100) / 100,
      downtimeHours: Math.round(downtimeHours * 100) / 100,
      uptimeHours: Math.round(Math.max(0, periodHours - downtimeHours) * 100) / 100,
      availabilityPercent: periodHours > 0
        ? Math.round(Math.max(0, (periodHours - downtimeHours) / periodHours * 100) * 100) / 100
        : null,
      note: periodHours === 0 ? 'Insufficient data to calculate period' : 'Approximate — assumes 24/7 operations',
    };
  }

  async getSlaTimes(query: { dateFrom?: string; dateTo?: string; machineId?: string; productionLineId?: string; operationTypeId?: string; costCenterId?: string }, ctx: ActiveOperationalContext) {
    if (query.machineId) await this.assertMachineAccess(query.machineId, ctx);
    if (query.productionLineId) await this.assertLineAccess(query.productionLineId, ctx);

    const machineFilter: any = this.machineScope(ctx);
    if (query.operationTypeId) machineFilter.operationTypeId = query.operationTypeId;
    if (query.costCenterId) machineFilter.defaultCostCenterId = query.costCenterId;
    const where: any = { deletedAt: null, machine: machineFilter };
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const requests = await this.prisma.maintenanceRequest.findMany({
      where: {
        ...where,
        responseDueAt: { not: null },
        startDueAt: { not: null },
        completeDueAt: { not: null },
      },
      select: { createdAt: true, responseDueAt: true, startDueAt: true, completeDueAt: true, startDate: true, endDate: true },
      take: 1000,
    });

    const responseTimes: number[] = [];
    const repairTimes: number[] = [];
    const completionTimes: number[] = [];

    requests.forEach(r => {
      if (r.createdAt && r.responseDueAt) {
        responseTimes.push((r.responseDueAt.getTime() - r.createdAt.getTime()) / 3600000);
      }
      if (r.startDueAt && r.completeDueAt) {
        repairTimes.push((r.completeDueAt.getTime() - r.startDueAt.getTime()) / 3600000);
      }
      if (r.startDate && r.endDate) {
        completionTimes.push((r.endDate.getTime() - r.startDate.getTime()) / 3600000);
      }
    });

    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100 : null;

    return {
      avgResponseTimeHours: avg(responseTimes),
      avgRepairTimeHours: avg(repairTimes),
      avgCompletionTimeHours: avg(completionTimes),
      samplesResponse: responseTimes.length,
      samplesRepair: repairTimes.length,
      samplesCompletion: completionTimes.length,
    };
  }
}