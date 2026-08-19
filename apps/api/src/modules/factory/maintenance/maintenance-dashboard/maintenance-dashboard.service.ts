import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { DowntimeLogsService } from '../downtime-logs/downtime-logs.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class MaintenanceDashboardService {
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

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private personnelTenantScope(ctx: ActiveOperationalContext) {
    const machine = this.machineScope(ctx);
    return [
      { requestAssignments: { some: { maintenanceRequest: { machine } } } },
      { machineResponsibilities: { some: { machine } } },
      { partAccountabilities: { some: { maintenanceRequest: { machine } } } },
    ];
  }

  async getSummary(ctx: ActiveOperationalContext) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const machine = this.machineScope(ctx);

    const [openRequests, criticalRequests, overdueItems, machinesUnderMaintenance, currentDowntime, upcomingPreventive, totalCost, totalRequests, completedRequests, avgCompletionTime, totalPersonnel, activeAssignments, totalPartAccountabilities, pendingPartReports, preventiveDueCount, preventiveOverdueCount, preventiveCompletedCount, emergencyOpenCount, emergencyCompletedCount, slaOverdue, slaEscalated, unreadNotifications] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where: { status: 'OPEN', deletedAt: null, machine } }),
      this.prisma.maintenanceRequest.count({ where: { priority: { in: ['HIGH', 'URGENT'] }, status: { in: ['OPEN', 'IN_PROGRESS'] }, deletedAt: null, machine } }),
      this.getOverdueCount(ctx),
      this.prisma.machine.count({ where: { status: 'UNDER_MAINTENANCE', deletedAt: null, companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] } }),
      this.prisma.downtimeLog.count({ where: { endTime: null, cancelledAt: null, machine } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', startDate: { gte: now }, endDate: null, machine } }),
      this.prisma.maintenanceRequestCostEntry.aggregate({ where: { request: { machine } }, _sum: { amount: true } }),
      this.prisma.maintenanceRequest.count({ where: { deletedAt: null, machine } }),
      this.prisma.maintenanceRequest.count({ where: { status: 'COMPLETED', deletedAt: null, machine } }),
      this.getAvgCompletionTime(ctx),
      this.prisma.maintenancePersonnel.count({ where: { isActive: true, OR: this.personnelTenantScope(ctx) } }),
      this.prisma.maintenanceRequestAssignment.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] }, maintenanceRequest: { machine } } }),
      this.prisma.maintenancePartAccountability.count({ where: { maintenanceRequest: { machine } } }),
      this.prisma.maintenancePartAccountability.count({ where: { status: 'ASSIGNED', maintenanceRequest: { machine } } }),
      // --- Preventive / Emergency KPIs ---
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', startDate: { lte: now }, machine } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', startDate: { lt: now }, endDate: null, machine } }),
      this.prisma.maintenanceRequest.count({ where: { type: 'PREVENTIVE', status: 'COMPLETED', deletedAt: null, machine } }),
      this.prisma.maintenanceRequest.count({ where: { isEmergency: true, status: 'OPEN', deletedAt: null, machine } }),
      this.prisma.maintenanceRequest.count({ where: { isEmergency: true, status: 'COMPLETED', deletedAt: null, machine } }),
      this.prisma.maintenanceRequest.count({ where: { deletedAt: null, slaStatus: 'OVERDUE', machine } }),
      this.prisma.maintenanceRequest.count({ where: { deletedAt: null, escalationLevel: { not: 'NONE' }, machine } }),
      this.prisma.notification.count({ where: { read: false } }),
    ]);

    const totalCostThisMonth = await this.prisma.maintenanceRequestCostEntry.aggregate({
      _sum: { amount: true },
      where: { incurredAt: { gte: thirtyDaysAgo }, request: { machine } },
    });

    const [mttr, mtbf, totalDowntime, topMachines, topCauses] = await Promise.all([
      this.downtimeLogsService.getMttr({}, ctx),
      this.downtimeLogsService.getMtbf({}, ctx),
      this.downtimeLogsService.getTotalDowntime({}, ctx),
      this.downtimeLogsService.getTopMachines({ limit: 5 }, ctx),
      this.downtimeLogsService.getTopCauses({}, ctx),
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
      slaOverdue,
      slaEscalated,
      unreadNotifications,
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

  private async getOverdueCount(ctx: ActiveOperationalContext) {
    const now = new Date();
    const machine = this.machineScope(ctx);
    const [overdueRequests, overdueSchedules] = await Promise.all([
      this.prisma.maintenanceRequest.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, endDate: { lt: now }, deletedAt: null, machine },
      }),
      this.prisma.maintenanceSchedule.count({
        where: { status: 'ACTIVE', startDate: { lt: now }, endDate: null, machine },
      }),
    ]);
    return overdueRequests + overdueSchedules;
  }

  private async getAvgCompletionTime(ctx: ActiveOperationalContext) {
    const completed = await this.prisma.maintenanceRequest.findMany({
      where: { status: 'COMPLETED', startDate: { not: null }, endDate: { not: null }, deletedAt: null, machine: this.machineScope(ctx) },
      select: { startDate: true, endDate: true },
      take: 1000,
    });
    if (completed.length === 0) return 0;
    const totalHours = completed.reduce((sum, r) => {
      const diff = r.endDate!.getTime() - r.startDate!.getTime();
      return sum + diff / 3600000;
    }, 0);
    return Math.round((totalHours / completed.length) * 100) / 100;
  }

  async getOpenRequests(query: { page?: number; limit?: number; priority?: string; machineId?: string; assignedToId?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = { status: 'OPEN', deletedAt: null, machine: this.machineScope(ctx) };
    if (query.priority) where.priority = query.priority;
    if (query.machineId) {
      await this.assertMachineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
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

  async getCritical(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = { priority: { in: ['HIGH', 'URGENT'] }, status: { in: ['OPEN', 'IN_PROGRESS'] }, deletedAt: null, machine: this.machineScope(ctx) };

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

  async getOverdue(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const now = new Date();
    const machine = this.machineScope(ctx);

    const overdueRequestsQuery = { where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, endDate: { lt: now }, deletedAt: null, machine }, skip: (page - 1) * limit, take: limit, orderBy: { endDate: 'asc' as 'asc' } };
    const overdueSchedulesQuery = { where: { status: 'ACTIVE', startDate: { lt: now }, endDate: null, machine }, skip: (page - 1) * limit, take: limit, orderBy: { startDate: 'asc' as 'asc' } };

    const [overdueRequestsList, overdueSchedulesList] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        ...overdueRequestsQuery,
        include: {
          machine: { select: { id: true, code: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.maintenanceSchedule.findMany({
        ...overdueSchedulesQuery,
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    const total = overdueRequestsList.length + overdueSchedulesList.length;
    return {
      data: {
        requests: overdueRequestsList,
        schedules: overdueSchedulesList,
      },
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getMachinesUnderMaintenance(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = { status: 'UNDER_MAINTENANCE', deletedAt: null, companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] };

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
    const enriched = data.map((m: any) => ({
      ...m,
      activeRequests: m._count?.maintenanceReqs ?? 0,
    }));
    return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCurrentDowntime(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = { endTime: null, cancelledAt: null, machine: this.machineScope(ctx) };

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

  async getUpcomingPreventive(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
    const where = { status: 'ACTIVE', startDate: { gte: now, lte: thirtyDaysFromNow }, machine: this.machineScope(ctx) };

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

  async getAccountabilityKpis(ctx: ActiveOperationalContext) {
    const machine = this.machineScope(ctx);
    const personnelScope = { OR: this.personnelTenantScope(ctx) };

    const [personnelByRole, topAssignees, machinesWithResponsibilityCount, activeResponsibilities, partAccountabilityByStatus, topPersonnelPartAccountability] = await Promise.all([
      this.prisma.maintenancePersonnel.groupBy({ by: ['role'], _count: true, where: { isActive: true, ...personnelScope } }),
      this.prisma.maintenanceRequestAssignment.groupBy({
        by: ['maintenancePersonnelId'],
        _count: true,
        where: { status: { notIn: ['COMPLETED', 'CANCELLED'] }, maintenanceRequest: { machine } },
        orderBy: { _count: { maintenancePersonnelId: 'desc' } },
        take: 10,
      }),
      this.prisma.machineResponsibilityAssignment.groupBy({
        by: ['machineId'],
        _count: true,
        where: { status: 'ACTIVE', machine },
        orderBy: { _count: { machineId: 'desc' } },
        take: 10,
      }),
      this.prisma.machineResponsibilityAssignment.count({ where: { status: 'ACTIVE', machine } }),
      this.prisma.maintenancePartAccountability.groupBy({ by: ['status'], _count: true, where: { maintenanceRequest: { machine } } }),
      this.prisma.maintenancePartAccountability.groupBy({
        by: ['maintenancePersonnelId'],
        _count: true,
        _sum: { quantity: true },
        where: { status: { notIn: ['CANCELLED'] }, maintenanceRequest: { machine } },
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
      machinesWithResponsibilityCount.filter(a => a.machineId !== null).map(async (a) => {
        const m = await this.prisma.machine.findUnique({
          where: { id: a.machineId! },
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

  async getCostKpis(query: { year?: number; month?: number }, ctx: ActiveOperationalContext) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    const machine = this.machineScope(ctx);

    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const [totalCost, monthlyCost, byType, byRequest] = await Promise.all([
      this.prisma.maintenanceRequestCostEntry.aggregate({ where: { request: { machine } }, _sum: { amount: true } }),
      this.prisma.maintenanceRequestCostEntry.aggregate({
        where: { incurredAt: { gte: startOfMonth, lt: startOfNextMonth }, request: { machine } },
        _sum: { amount: true },
      }),
      this.prisma.maintenanceRequestCostEntry.groupBy({
        by: ['type'],
        where: { request: { machine } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.maintenanceRequestCostEntry.groupBy({
        by: ['requestId'],
        where: { request: { machine } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
    ]);

    const requestIds = byRequest.map(r => r.requestId);
    const requests = requestIds.length > 0
      ? await this.prisma.maintenanceRequest.findMany({
          where: { id: { in: requestIds }, machine },
          select: { id: true, requestNumber: true, title: true, machine: { select: { id: true, code: true, name: true } } },
        })
      : [];
    const requestMap = new Map(requests.map(r => [r.id, r]));

    return {
      totalCost: totalCost._sum.amount || 0,
      monthlyCost: monthlyCost._sum.amount || 0,
      byType: byType.map(t => ({ type: t.type, total: t._sum.amount || 0, count: t._count })),
      topRequestsByCost: byRequest.map(r => {
        const req = requestMap.get(r.requestId);
        return {
          requestId: r.requestId,
          requestNumber: req?.requestNumber ?? null,
          title: req?.title ?? null,
          machineName: req?.machine?.name ?? null,
          total: r._sum.amount || 0,
        };
      }),
    };
  }

  async getRecentGeneratedPreventive(limit = 5, ctx: ActiveOperationalContext) {
    return this.prisma.maintenanceRequest.findMany({
      where: { type: 'PREVENTIVE', description: { contains: 'Auto-generated' }, deletedAt: null, machine: this.machineScope(ctx) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, requestNumber: true, title: true, status: true, createdAt: true,
        machine: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async getRecentEmergencyRequests(limit = 5, ctx: ActiveOperationalContext) {
    return this.prisma.maintenanceRequest.findMany({
      where: { isEmergency: true, deletedAt: null, machine: this.machineScope(ctx) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, requestNumber: true, title: true, status: true, priority: true, createdAt: true,
        machine: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async getSlaOverdue(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = { deletedAt: null, slaStatus: 'OVERDUE', machine: this.machineScope(ctx) };
    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { updatedAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getSlaEscalated(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = { deletedAt: null, escalationLevel: { not: 'NONE' }, machine: this.machineScope(ctx) };
    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { lastEscalatedAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async assertMachineAccess(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findFirst({
      where: { id: machineId, ...this.machineScope(ctx) },
      select: { id: true },
    });
    if (!machine) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
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