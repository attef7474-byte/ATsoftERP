import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { DowntimeLogsService } from '../downtime-logs/downtime-logs.service';

@Injectable()
export class MaintenanceReliabilityService {
  constructor(
    private prisma: PrismaService,
    private downtimeLogsService: DowntimeLogsService,
  ) {}

  async getMttr(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getMttr(query);
  }

  async getMtbf(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getMtbf(query);
  }

  async getTotalDowntime(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getTotalDowntime(query);
  }

  async getDowntimeByMachine(query: { dateFrom?: string; dateTo?: string; limit?: number }) {
    return this.downtimeLogsService.getDowntimeByMachine(query);
  }

  async getDowntimeByProductionLine(query: { dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getDowntimeByProductionLine(query);
  }

  async getDowntimeByCause(query: { dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getDowntimeByCause(query);
  }

  async getRepeatFailures(query: { dateFrom?: string; dateTo?: string; limit?: number }) {
    return this.downtimeLogsService.getRepeatFailures(query);
  }

  async getEmergencyResponseTime(query: { dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getEmergencyResponseTime(query);
  }

  async getTopMachines(query: { dateFrom?: string; dateTo?: string; limit?: number }) {
    return this.downtimeLogsService.getTopMachines(query);
  }

  async getTopCauses(query: { dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getTopCauses(query);
  }

  // ─────────────── AF-AG: New Reliability KPIs ───────────────

  async getRepeatFailureRate(query: { dateFrom?: string; dateTo?: string; machineId?: string; productionLineId?: string }) {
    const where: any = { cancelledAt: null };
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionLineId) {
      const machines = await this.prisma.machine.findMany({
        where: { productionLineId: query.productionLineId },
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

  async getAvailability(query: { dateFrom?: string; dateTo?: string; machineId?: string; productionLineId?: string }) {
    const where: any = { cancelledAt: null };
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionLineId) {
      const machines = await this.prisma.machine.findMany({
        where: { productionLineId: query.productionLineId },
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

  async getSlaTimes(query: { dateFrom?: string; dateTo?: string; machineId?: string; productionLineId?: string }) {
    const where: any = { deletedAt: null };
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
