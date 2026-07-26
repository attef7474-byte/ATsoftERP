import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { DowntimeLogsService } from '../downtime-logs/downtime-logs.service';

@Injectable()
export class MaintenanceDashboardService {
  constructor(
    private prisma: PrismaService,
    private downtimeLogsService: DowntimeLogsService,
  ) {}

  async getSummary() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const [openRequests, criticalRequests, overdueItems, machinesUnderMaintenance, currentDowntime, upcomingPreventive, totalCost, totalRequests, completedRequests, avgCompletionTime, totalPersonnel, activeAssignments, totalPartAccountabilities, pendingPartReports, preventiveDueCount, preventiveOverdueCount, preventiveCompletedCount, emergencyOpenCount, emergencyCompletedCount] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where: { status: 'OPEN', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { priority: { in: ['HIGH', 'URGENT'] }, status: { in: ['OPEN', 'IN_PROGRESS'] }, deletedAt: null } }),
      this.getOverdueCount(),
      this.prisma.machine.count({ where: { status: 'UNDER_MAINTENANCE', deletedAt: null } }),
      this.prisma.downtimeLog.count({ where: { endTime: null, cancelledAt: null } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', startDate: { gte: now }, endDate: null } }),
      this.prisma.maintenanceRequestCostEntry.aggregate({ _sum: { amount: true } }),
      this.prisma.maintenanceRequest.count({ where: { deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { status: 'COMPLETED', deletedAt: null } }),
      this.getAvgCompletionTime(),
      this.prisma.maintenancePersonnel.count({ where: { isActive: true } }),
      this.prisma.maintenanceRequestAssignment.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      this.prisma.maintenancePartAccountability.count(),
      this.prisma.maintenancePartAccountability.count({ where: { status: 'ASSIGNED' } }),
      // --- Preventive / Emergency KPIs ---
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', startDate: { lte: now } } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', startDate: { lt: now } } }),
      this.prisma.maintenanceRequest.count({ where: { type: 'PREVENTIVE', status: 'COMPLETED', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { isEmergency: true, status: 'OPEN', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { isEmergency: true, status: 'COMPLETED', deletedAt: null } }),
    ]);

    const totalCostThisMonth = await this.prisma.maintenanceRequestCostEntry.aggregate({
      _sum: { amount: true },
      where: { incurredAt: { gte: thirtyDaysAgo } },
    });

    const [mttr, mtbf, totalDowntime, topMachines, topCauses] = await Promise.all([
      this.downtimeLogsService.getMttr({}),
      this.downtimeLogsService.getMtbf({}),
      this.downtimeLogsService.getTotalDowntime({}),
      this.downtimeLogsService.getTopMachines({ limit: 5 }),
      this.downtimeLogsService.getTopCauses({}),
    ]);

    return {
      openRequests,
      criticalRequests,
      overdueItems,
      machinesUnderMaintenance,
      currentDowntime,
      upcomingPreventive,
      totalCost: totalCost._sum.amount || 0,
      totalCostThisMonth: totalCostThisMonth._sum.amount || 0,
      totalRequests,
      completedRequests,
      avgCompletionTimeHours: avgCompletionTime,
      completionRate: totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0,
      totalPersonnel,
      activeAssignments,
      totalPartAccountabilities,
      pendingPartReports,
      preventiveDueCount,
      preventiveOverdueCount,
      preventiveCompletedCount,
      emergencyOpenCount,
      emergencyCompletedCount,
      reliability: {
        mttr: mttr.mttrHours,
        mtbf: mtbf.mtbfHours,
        totalDowntimeHours: totalDowntime.totalHours,
        totalDowntimeEvents: totalDowntime.totalEvents,
        topMachines,
        topCauses,
      },
    };
  }

  private async getOverdueCount() {
    const now = new Date();
    const [overdueRequests, overdueSchedules] = await Promise.all([
      this.prisma.maintenanceRequest.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, endDate: { lt: now }, deletedAt: null },
      }),
      this.prisma.maintenanceSchedule.count({
        where: { status: 'ACTIVE', startDate: { lt: now }, endDate: null },
      }),
    ]);
    return overdueRequests + overdueSchedules;
  }

  private async getAvgCompletionTime() {
    const completed = await this.prisma.maintenanceRequest.findMany({
      where: { status: 'COMPLETED', startDate: { not: null }, endDate: { not: null }, deletedAt: null },
      select: { startDate: true, endDate: true },
    });
    if (completed.length === 0) return 0;
    const totalHours = completed.reduce((sum, r) => {
      const diff = r.endDate!.getTime() - r.startDate!.getTime();
      return sum + diff / 3600000;
    }, 0);
    return Math.round((totalHours / completed.length) * 100) / 100;
  }

  async getOpenRequests(query: { page?: number; limit?: number; priority?: string; machineId?: string; assignedToId?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = { status: 'OPEN', deletedAt: null };
    if (query.priority) where.priority = query.priority;
    if (query.machineId) where.machineId = query.machineId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          requestedBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCritical(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = { priority: { in: ['HIGH', 'URGENT'] }, status: { in: ['OPEN', 'IN_PROGRESS'] }, deletedAt: null };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          requestedBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getOverdue(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const now = new Date();

    const [overdueRequests, overdueSchedules] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, endDate: { lt: now }, deletedAt: null },
        skip: (page - 1) * limit, take: limit, orderBy: { endDate: 'asc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.maintenanceSchedule.findMany({
        where: { status: 'ACTIVE', startDate: { lt: now } },
        skip: (page - 1) * limit, take: limit, orderBy: { startDate: 'asc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    const total = overdueRequests.length + overdueSchedules.length;
    return {
      data: {
        requests: overdueRequests,
        schedules: overdueSchedules,
      },
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getMachinesUnderMaintenance(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = { status: 'UNDER_MAINTENANCE', deletedAt: null };

    const [data, total] = await Promise.all([
      this.prisma.machine.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { maintenanceReqs: { where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } } } },
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.machine.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCurrentDowntime(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = { endTime: null, cancelledAt: null };

    const [data, total] = await Promise.all([
      this.prisma.downtimeLog.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { startTime: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.downtimeLog.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getUpcomingPreventive(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
    const where = { status: 'ACTIVE', startDate: { gte: now, lte: thirtyDaysFromNow } };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceSchedule.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { startDate: 'asc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.maintenanceSchedule.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getAccountabilityKpis() {
    const [personnelByRole, topAssignees, machinesWithResponsibilityCount, activeResponsibilities, partAccountabilityByStatus, topPersonnelPartAccountability] = await Promise.all([
      this.prisma.maintenancePersonnel.groupBy({ by: ['role'], _count: true, where: { isActive: true } }),
      this.prisma.maintenanceRequestAssignment.groupBy({
        by: ['maintenancePersonnelId'],
        _count: true,
        where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        orderBy: { _count: { maintenancePersonnelId: 'desc' } },
        take: 10,
      }),
      this.prisma.machineResponsibilityAssignment.groupBy({
        by: ['machineId'],
        _count: true,
        where: { status: 'ACTIVE' },
        orderBy: { _count: { machineId: 'desc' } },
        take: 10,
      }),
      this.prisma.machineResponsibilityAssignment.count({ where: { status: 'ACTIVE' } }),
      this.prisma.maintenancePartAccountability.groupBy({ by: ['status'], _count: true }),
      this.prisma.maintenancePartAccountability.groupBy({
        by: ['maintenancePersonnelId'],
        _count: true,
        _sum: { quantity: true },
        where: { status: { notIn: ['CANCELLED'] } },
        orderBy: { _count: { maintenancePersonnelId: 'desc' } },
        take: 10,
      }),
    ]);

    const topAssigneesWithPersonnel = await Promise.all(
      topAssignees.map(async (a) => {
        const p = await this.prisma.maintenancePersonnel.findUnique({
          where: { id: a.maintenancePersonnelId },
          select: {
            id: true,
            role: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        });
        return { personnel: this.flattenPersonnel(p), activeAssignmentCount: a._count };
      }),
    );

    const machinesWithResponsibility = await Promise.all(
      machinesWithResponsibilityCount.map(async (a) => {
        const m = await this.prisma.machine.findUnique({
          where: { id: a.machineId },
          select: { id: true, code: true, name: true },
        });
        return { machine: m, responsibilityCount: a._count };
      }),
    );

    return {
      personnelByRole: personnelByRole.map(r => ({ role: r.role, count: r._count })),
      activeResponsibilities,
      topAssignees: topAssigneesWithPersonnel,
      machinesWithMostResponsibilities: machinesWithResponsibility,
      partAccountabilityByStatus: partAccountabilityByStatus.map(s => ({ status: s.status, count: s._count })),
      topPersonnelPartAccountability: await Promise.all(
        topPersonnelPartAccountability.map(async (a) => {
          const p = await this.prisma.maintenancePersonnel.findUnique({
            where: { id: a.maintenancePersonnelId },
            select: {
              id: true,
              role: true,
              operationalPerson: { select: { id: true, code: true, name: true } },
            },
          });
          return { personnel: this.flattenPersonnel(p), recordCount: a._count, totalQuantity: a._sum.quantity || 0 };
        }),
      ),
    };
  }

  async getCostKpis(query: { year?: number; month?: number }) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;

    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const [totalCost, monthlyCost, byType, byRequest] = await Promise.all([
      this.prisma.maintenanceRequestCostEntry.aggregate({ _sum: { amount: true } }),
      this.prisma.maintenanceRequestCostEntry.aggregate({
        _sum: { amount: true },
        where: { incurredAt: { gte: startOfMonth, lt: startOfNextMonth } },
      }),
      this.prisma.maintenanceRequestCostEntry.groupBy({
        by: ['type'],
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.maintenanceRequestCostEntry.groupBy({
        by: ['requestId'],
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalCost: totalCost._sum.amount || 0,
      monthlyCost: monthlyCost._sum.amount || 0,
      byType: byType.map(t => ({ type: t.type, total: t._sum.amount || 0, count: t._count })),
      topRequestsByCost: byRequest.map(r => ({ requestId: r.requestId, total: r._sum.amount || 0 })),
    };
  }

  async getRecentGeneratedPreventive(limit = 5) {
    return this.prisma.maintenanceRequest.findMany({
      where: { type: 'PREVENTIVE', description: { contains: 'Auto-generated' }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, requestNumber: true, title: true, status: true, createdAt: true,
        machine: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async getRecentEmergencyRequests(limit = 5) {
    return this.prisma.maintenanceRequest.findMany({
      where: { isEmergency: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, requestNumber: true, title: true, status: true, priority: true, createdAt: true,
        machine: { select: { id: true, name: true, code: true } },
      },
    });
  }

  private flattenPersonnel(p: any) {
    if (!p) return null;
    return {
      id: p.id,
      code: p.operationalPerson?.code ?? null,
      name: p.operationalPerson?.name ?? null,
      role: p.role,
    };
  }
}
