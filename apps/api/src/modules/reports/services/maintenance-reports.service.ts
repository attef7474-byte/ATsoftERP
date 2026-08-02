import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MaintenanceReportFilterDto } from '../dto/report-filter.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { buildDateFilter, nowPlusDays, paginate } from './report-query-utils';

@Injectable()
export class MaintenanceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private lineScope(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, branchId: ctx.branchId };
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
      where: { id: productionLineId, ...this.lineScope(ctx) },
      select: { id: true },
    });
    if (!line) throw this.notFound('maintenance.productionLineNotFound', 'Production line not found');
  }

  private applyMachineFilters(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext, where: any) {
    if (filters.productionLineId) where.machine = { ...(where.machine || {}), productionLineId: filters.productionLineId };
    if (filters.operationTypeId) where.machine = { ...(where.machine || {}), operationTypeId: filters.operationTypeId };
    if (filters.costCenterId) where.machine = { ...(where.machine || {}), defaultCostCenterId: filters.costCenterId };
    where.machine = { ...(where.machine || {}), ...this.machineScope(ctx) };
    return where;
  }

  async getMaintenanceRequestsReport(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo) };
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      where.productionLineId = filters.productionLineId;
    }
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      where.machineId = filters.machineId;
    }
    if (filters.machineComponentId) where.machineComponentId = filters.machineComponentId;
    if (!filters.machineComponentId && filters.componentId) where.machineComponentId = filters.componentId;
    if (filters.operationTypeId) where.operationTypeId = filters.operationTypeId;
    if (filters.costCenterId) where.costCenterId = filters.costCenterId;
    if (filters.requestStatus) where.status = filters.requestStatus;
    if (filters.maintenanceType) where.type = filters.maintenanceType;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assigneeId) where.assignedToId = filters.assigneeId;
    if (filters.sparePartId) {
      where.requiredParts = { some: { sparePartId: filters.sparePartId } };
    }
    if (filters.search) where.OR = [
      { title: { contains: filters.search } },
      { requestNumber: { contains: filters.search } },
    ];
    where.machine = this.machineScope(ctx);

    const [total, rows, openCount, inProgressCount, completedCount, cancelledCount] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where }),
      this.prisma.maintenanceRequest.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.maintenanceRequest.count({ where: { ...where, status: 'OPEN' } }),
      this.prisma.maintenanceRequest.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      this.prisma.maintenanceRequest.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.maintenanceRequest.count({ where: { ...where, status: 'CANCELLED' } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalRequests', value: total },
        { label: 'openRequests', value: openCount },
        { label: 'inProgressRequests', value: inProgressCount },
        { label: 'completedRequests', value: completedCount },
        { label: 'cancelledRequests', value: cancelledCount },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  async getMachineDowntimeReport(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'startTime') };
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      where.machineId = filters.machineId;
    }
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      where.request = { productionLineId: filters.productionLineId };
    }
    if (filters.operationTypeId) where.request = { ...where.request, operationTypeId: filters.operationTypeId };
    if (filters.costCenterId) where.request = { ...where.request, costCenterId: filters.costCenterId };
    if (filters.machineComponentId) where.request = { ...where.request, machineComponentId: filters.machineComponentId };
    if (!filters.machineComponentId && filters.componentId) where.request = { ...where.request, machineComponentId: filters.componentId };
    if (filters.search) where.reason = { contains: filters.search };
    where.machine = { ...(where.machine || {}), ...this.machineScope(ctx) };

    const [total, rows, totalDuration, activeCount, avgDuration] = await Promise.all([
      this.prisma.downtimeLog.count({ where }),
      this.prisma.downtimeLog.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { startTime: 'desc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.downtimeLog.aggregate({ where, _sum: { durationMinutes: true } }),
      this.prisma.downtimeLog.count({ where: { ...where, endTime: null, cancelledAt: null } }),
      this.prisma.downtimeLog.aggregate({ where: { ...where, durationMinutes: { not: null } }, _avg: { durationMinutes: true } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalDowntime', value: total },
        { label: 'totalDowntimeMinutes', value: totalDuration._sum.durationMinutes || 0, unit: 'minutes' },
        { label: 'activeDowntime', value: activeCount },
        { label: 'averageDowntime', value: Math.round(avgDuration._avg.durationMinutes || 0), unit: 'minutes' },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  async getMaintenanceCostsReport(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo, 'incurredAt');

    const requestWhere: any = { machine: this.machineScope(ctx) };
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      requestWhere.productionLineId = filters.productionLineId;
    }
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      requestWhere.machineId = filters.machineId;
    }
    if (filters.machineComponentId) requestWhere.machineComponentId = filters.machineComponentId;
    if (!filters.machineComponentId && filters.componentId) requestWhere.machineComponentId = filters.componentId;
    if (filters.operationTypeId) requestWhere.operationTypeId = filters.operationTypeId;
    if (filters.costCenterId) requestWhere.costCenterId = filters.costCenterId;

    const whereCostEntries: any = { ...dateFilter };
    if (Object.keys(requestWhere).length > 0) whereCostEntries.request = requestWhere;

    const whereParts: any = {};
    if (Object.keys(requestWhere).length > 0) whereParts.request = requestWhere;
    if (filters.sparePartId) {
      const sparePart = await this.prisma.sparePart.findFirst({
        where: { id: filters.sparePartId },
        select: { productId: true },
      });
      if (sparePart?.productId) whereParts.productId = sparePart.productId;
      else whereParts.id = '';
    }

    const [costRows, costTotal, partRows, partTotal, costSum, partsCostSum] = await Promise.all([
      this.prisma.maintenanceRequestCostEntry.findMany({
        where: whereCostEntries, ...paginate(filters.page, filters.pageSize),
        orderBy: { incurredAt: 'desc' },
        include: { request: { select: { id: true, requestNumber: true, machineId: true } } },
      }),
      this.prisma.maintenanceRequestCostEntry.count({ where: whereCostEntries }),
      this.prisma.maintenanceRequestPartUsage.findMany({
        where: whereParts, ...paginate(1, 10),
        orderBy: { id: 'desc' },
        include: { request: { select: { id: true, requestNumber: true, machineId: true } }, product: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.maintenanceRequestPartUsage.count({ where: whereParts }),
      this.prisma.maintenanceRequestCostEntry.aggregate({ where: whereCostEntries, _sum: { amount: true } }),
      this.prisma.maintenanceRequestPartUsage.aggregate({ where: whereParts, _sum: { totalCost: true } }),
    ]);

    const totalPages = Math.ceil((costTotal + partTotal) / (filters.pageSize || 20));
    const combinedRows = [
      ...costRows.map(r => ({ ...r, _type: 'cost' })),
      ...partRows.map(r => ({ ...r, _type: 'part' })),
    ];

    return {
      cards: [
        { label: 'totalCost', value: (costSum._sum.amount || 0) + (partsCostSum._sum.totalCost || 0) },
        { label: 'partsUsage', value: partTotal },
        { label: 'partsCost', value: partsCostSum._sum.totalCost || 0 },
        { label: 'otherCost', value: costSum._sum.amount || 0 },
      ],
      rows: combinedRows, total: costTotal + partTotal, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  async getPreventiveSchedulesReport(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    const where: any = {};
    const now = new Date();
    const soon = nowPlusDays(7);

    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      where.machineId = filters.machineId;
    }
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      where.machine = { productionLineId: filters.productionLineId };
    }
    if (filters.operationTypeId) where.machine = { ...(where.machine || {}), operationTypeId: filters.operationTypeId };
    if (filters.costCenterId) where.machine = { ...(where.machine || {}), defaultCostCenterId: filters.costCenterId };
    where.machine = { ...(where.machine || {}), ...this.machineScope(ctx) };
    if (filters.maintenanceType) where.type = filters.maintenanceType;
    if (filters.dueStatus === 'overdue') where.endDate = { lte: now };
    else if (filters.dueStatus === 'dueSoon') where.endDate = { gte: now, lte: soon };
    else if (filters.dueStatus === 'notDue') where.OR = [{ endDate: { gt: now } }, { endDate: null }];
    if (filters.search) where.title = { contains: filters.search };

    const [total, rows, activeCount, inactiveCount, overdueCount, dueSoonCount, notDueCount] = await Promise.all([
      this.prisma.maintenanceSchedule.count({ where }),
      this.prisma.maintenanceSchedule.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { startDate: 'desc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, status: 'INACTIVE' } }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, status: 'ACTIVE', endDate: { lte: now } } }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, status: 'ACTIVE', endDate: { gte: now, lte: soon } } }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, status: 'ACTIVE', OR: [{ endDate: { gt: now } }, { endDate: null }] } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalSchedules', value: total },
        { label: 'overdueSchedules', value: overdueCount },
        { label: 'dueSoonSchedules', value: dueSoonCount },
        { label: 'notDue', value: notDueCount },
        { label: 'inactive', value: inactiveCount },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  async getMachineLogReport(filters: any, ctx: ActiveOperationalContext) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'createdAt') };
    if (filters.productionLineId) {
      if (filters.productionLineId) await this.assertLineAccess(filters.productionLineId, ctx);
      where.productionLineId = filters.productionLineId;
    }
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      where.machineId = filters.machineId;
    }
    if (filters.machineComponentId) where.machineComponentId = filters.machineComponentId;
    if (!filters.machineComponentId && filters.componentId) where.machineComponentId = filters.componentId;
    if (filters.operationTypeId) where.operationTypeId = filters.operationTypeId;
    if (filters.costCenterId) where.costCenterId = filters.costCenterId;
    if (filters.search) where.OR = [{ title: { contains: filters.search } }, { requestNumber: { contains: filters.search } }];
    where.machine = this.machineScope(ctx);

    const [total, rows] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where }),
      this.prisma.maintenanceRequest.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return { rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages };
  }

  async getPartsUsageReport(filters: any, ctx: ActiveOperationalContext) {
    const where: any = { request: { machine: this.machineScope(ctx) }, ...buildDateFilter(filters.dateFrom, filters.dateTo, 'createdAt') };
    if (filters.sparePartId) {
      const sparePart = await this.prisma.sparePart.findFirst({
        where: { id: filters.sparePartId },
        select: { productId: true },
      });
      if (sparePart?.productId) where.productId = sparePart.productId;
      else where.id = '';
    }
    if (filters.productId) where.productId = filters.productId;
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      where.request = { ...(where.request || {}), productionLineId: filters.productionLineId };
    }
    const requestWhere: any = { machine: this.machineScope(ctx) };
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      requestWhere.machineId = filters.machineId;
    }
    if (filters.machineComponentId) requestWhere.machineComponentId = filters.machineComponentId;
    if (!filters.machineComponentId && filters.componentId) requestWhere.machineComponentId = filters.componentId;
    if (filters.operationTypeId) requestWhere.operationTypeId = filters.operationTypeId;
    if (filters.costCenterId) requestWhere.costCenterId = filters.costCenterId;
    where.request = { ...where.request, ...requestWhere };
    if (filters.search) where.product = { OR: [{ code: { contains: filters.search } }, { name: { contains: filters.search } }] };

    const [total, rows, totalQty, totalCost] = await Promise.all([
      this.prisma.maintenanceRequestPartUsage.count({ where }),
      this.prisma.maintenanceRequestPartUsage.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { id: 'desc' },
        include: { product: { select: { id: true, code: true, name: true, unit: true } }, request: { select: { id: true, requestNumber: true, machineId: true } } },
      }),
      this.prisma.maintenanceRequestPartUsage.aggregate({ where, _sum: { quantity: true } }),
      this.prisma.maintenanceRequestPartUsage.aggregate({ where, _sum: { totalCost: true } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalPartsUsageRows', value: total },
        { label: 'totalQty', value: totalQty._sum.quantity || 0 },
        { label: 'totalCost', value: totalCost._sum.totalCost || 0 },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  async getUpcomingPreventiveReport(filters: any, ctx: ActiveOperationalContext) {
    const now = new Date();
    const soon = nowPlusDays(30);
    const where: any = { status: 'ACTIVE', endDate: { gte: now, lte: soon } };
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      where.machineId = filters.machineId;
    }
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      where.machine = { productionLineId: filters.productionLineId };
    }
    if (filters.operationTypeId) where.machine = { ...(where.machine || {}), operationTypeId: filters.operationTypeId };
    if (filters.costCenterId) where.machine = { ...(where.machine || {}), defaultCostCenterId: filters.costCenterId };
    where.machine = { ...(where.machine || {}), ...this.machineScope(ctx) };
    if (filters.search) where.title = { contains: filters.search };

    const [total, rows, dueSoonCount, totalActive] = await Promise.all([
      this.prisma.maintenanceSchedule.count({ where }),
      this.prisma.maintenanceSchedule.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { endDate: 'asc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, endDate: { lte: nowPlusDays(7) } } }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, status: 'ACTIVE' } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'upcomingSchedules', value: total },
        { label: 'dueWithinWeek', value: dueSoonCount },
        { label: 'totalActiveSchedules', value: totalActive },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  async getOverduePreventiveReport(filters: any, ctx: ActiveOperationalContext) {
    const now = new Date();
    const where: any = { status: 'ACTIVE', endDate: { lt: now } };
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      where.machineId = filters.machineId;
    }
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      where.machine = { productionLineId: filters.productionLineId };
    }
    if (filters.operationTypeId) where.machine = { ...(where.machine || {}), operationTypeId: filters.operationTypeId };
    if (filters.costCenterId) where.machine = { ...(where.machine || {}), defaultCostCenterId: filters.costCenterId };
    where.machine = { ...(where.machine || {}), ...this.machineScope(ctx) };
    if (filters.search) where.title = { contains: filters.search };

    const [total, rows, overdueCount, totalActive] = await Promise.all([
      this.prisma.maintenanceSchedule.count({ where }),
      this.prisma.maintenanceSchedule.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { endDate: 'asc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, status: 'ACTIVE' } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'overdueSchedules', value: total },
        { label: 'totalOverdue', value: overdueCount },
        { label: 'totalActiveSchedules', value: totalActive },
        { label: 'complianceRate', value: totalActive > 0 ? Math.round(((totalActive - overdueCount) / totalActive) * 100) : 100, unit: '%' },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  // ─────────────── AF-AG: Enhanced Cost Analysis ───────────────

  async getCostAnalysis(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    const requestWhere: any = { machine: this.machineScope(ctx) };
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      requestWhere.productionLineId = filters.productionLineId;
    }
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      requestWhere.machineId = filters.machineId;
    }
    if (filters.machineComponentId) requestWhere.machineComponentId = filters.machineComponentId;
    if (!filters.machineComponentId && filters.componentId) requestWhere.machineComponentId = filters.componentId;
    if (filters.operationTypeId) requestWhere.operationTypeId = filters.operationTypeId;
    if (filters.costCenterId) requestWhere.costCenterId = filters.costCenterId;

    const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo, 'incurredAt');

    const whereCostEntries: any = { ...dateFilter };
    if (Object.keys(requestWhere).length > 0) whereCostEntries.request = requestWhere;

    const wherePartUsage: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'createdAt'), request: requestWhere };
    if (filters.sparePartId) {
      const sp = await this.prisma.sparePart.findFirst({
        where: { id: filters.sparePartId },
        select: { productId: true },
      });
      if (sp?.productId) wherePartUsage.productId = sp.productId;
      else wherePartUsage.productId = '__NONE__';
    }

    const whereRepairOrders: any = { machine: this.machineScope(ctx) };
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      whereRepairOrders.machineId = filters.machineId;
    }
    if (filters.dateFrom || filters.dateTo) {
      whereRepairOrders.completedAt = {};
      if (filters.dateFrom) whereRepairOrders.completedAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) whereRepairOrders.completedAt.lte = new Date(filters.dateTo);
    }

    const [
      costEntrySum, costEntryCount, partUsageSum, partUsageCount,
      repairCostSum, repairCount,
      costByType, costByReqType, costByMachine,
      monthlyCostTrend, monthlyPartsTrend,
      totalMachines,
    ] = await Promise.all([
      this.prisma.maintenanceRequestCostEntry.aggregate({ where: whereCostEntries, _sum: { amount: true } }),
      this.prisma.maintenanceRequestCostEntry.count({ where: whereCostEntries }),
      this.prisma.maintenanceRequestPartUsage.aggregate({ where: wherePartUsage, _sum: { totalCost: true, quantity: true } }),
      this.prisma.maintenanceRequestPartUsage.count({ where: wherePartUsage }),
      this.prisma.sparePartRepairOrder.aggregate({ where: { ...whereRepairOrders, actualRepairCost: { not: null } }, _sum: { actualRepairCost: true } }),
      this.prisma.sparePartRepairOrder.count({ where: { ...whereRepairOrders, actualRepairCost: { not: null } } }),
      this.prisma.maintenanceRequestCostEntry.groupBy({ by: ['type'], where: whereCostEntries, _sum: { amount: true }, _count: true }),
      this.prisma.maintenanceRequest.groupBy({
        by: ['type'],
        where: { ...requestWhere, ...(filters.dateFrom || filters.dateTo ? buildDateFilter(filters.dateFrom, filters.dateTo) : {}) },
        _count: true,
      }),
      this.prisma.maintenanceRequest.groupBy({
        by: ['machineId'],
        where: { ...requestWhere, ...(filters.dateFrom || filters.dateTo ? buildDateFilter(filters.dateFrom, filters.dateTo) : {}) },
        _count: true,
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
      this.getMonthlyCostTrend(filters.dateFrom, filters.dateTo, requestWhere),
      this.getMonthlyPartsTrend(filters.dateFrom, filters.dateTo, requestWhere),
      this.prisma.machine.count({ where: { status: 'ACTIVE', companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] } }),
    ]);

    const machineCosts = await Promise.all(
      costByMachine.map(async (m) => {
        const machine = await this.prisma.machine.findUnique({
          where: { id: m.machineId },
          select: {
            id: true,
            code: true,
            name: true,
            productionLine: { select: { id: true, code: true, name: true } },
            department: { select: { id: true, code: true, name: true } },
            defaultCostCenter: { select: { id: true, code: true, name: true } },
          },
        });
        const reqWhere = { ...requestWhere, machineId: m.machineId };
        const [entrySum, partSum] = await Promise.all([
          this.prisma.maintenanceRequestCostEntry.aggregate({
            where: { ...dateFilter, request: reqWhere },
            _sum: { amount: true },
          }),
          this.prisma.maintenanceRequestPartUsage.aggregate({
            where: { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'createdAt'), request: reqWhere },
            _sum: { totalCost: true },
          }),
        ]);
        return {
          machineId: m.machineId,
          machine: machine || null,
          requestCount: m._count,
          costEntryTotal: entrySum._sum.amount || 0,
          partCostTotal: partSum._sum.totalCost || 0,
          totalCost: (entrySum._sum.amount || 0) + (partSum._sum.totalCost || 0),
        };
      }),
    );

    const totalCost = (costEntrySum._sum.amount || 0) + (partUsageSum._sum.totalCost || 0);
    const totalRepairCost = repairCostSum._sum.actualRepairCost
      ? Number(repairCostSum._sum.actualRepairCost)
      : 0;
    const grandTotalCost = totalCost + totalRepairCost;
    const costByLine = this.aggregateMachineCosts(machineCosts, 'productionLine');
    const costByDepartment = this.aggregateMachineCosts(machineCosts, 'department');
    const costByCostCenter = this.aggregateMachineCosts(machineCosts, 'defaultCostCenter');

    return {
      cards: [
        { label: 'totalCost', value: grandTotalCost },
        { label: 'partsCost', value: partUsageSum._sum.totalCost || 0 },
        { label: 'otherCost', value: costEntrySum._sum.amount || 0 },
        { label: 'repairCost', value: totalRepairCost },
        { label: 'costPerMachine', value: totalMachines > 0 ? Math.round(grandTotalCost / totalMachines) : 0 },
        { label: 'costEntriesCount', value: costEntryCount },
        { label: 'partUsageCount', value: partUsageCount },
        { label: 'partQtyTotal', value: partUsageSum._sum.quantity || 0 },
        { label: 'repairOrderCount', value: repairCount },
      ],
      costByType: costByType.map(t => ({ type: t.type, total: t._sum.amount || 0, count: t._count })),
      costByRequestType: costByReqType.map(t => ({ type: t.type, count: t._count })),
      costByMachine: machineCosts,
      costByLine,
      costByDepartment,
      costByCostCenter,
      executiveSummary: {
        totalCost: grandTotalCost,
        totalMachines,
        machinesWithCost: machineCosts.filter(m => m.totalCost > 0).length,
        linesWithCost: costByLine.length,
        departmentsWithCost: costByDepartment.length,
        highestCostMachine: [...machineCosts].sort((a, b) => b.totalCost - a.totalCost)[0] || null,
        highestCostLine: costByLine[0] || null,
        highestCostDepartment: costByDepartment[0] || null,
      },
      monthlyCostTrend,
      monthlyPartsTrend,
    };
  }

  private aggregateMachineCosts(machineCosts: any[], relationName: 'productionLine' | 'department' | 'defaultCostCenter') {
    const map = new Map<string, any>();
    for (const row of machineCosts) {
      const entity = row.machine?.[relationName] || null;
      const id = entity?.id || 'unassigned';
      const current = map.get(id) || {
        id,
        code: entity?.code || null,
        name: entity?.name || 'Unassigned',
        requestCount: 0,
        costEntryTotal: 0,
        partCostTotal: 0,
        totalCost: 0,
        machineCount: 0,
      };
      current.requestCount += row.requestCount || 0;
      current.costEntryTotal += row.costEntryTotal || 0;
      current.partCostTotal += row.partCostTotal || 0;
      current.totalCost += row.totalCost || 0;
      current.machineCount += 1;
      map.set(id, current);
    }
    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }

  private async getMonthlyCostTrend(dateFrom?: string, dateTo?: string, requestWhere?: any) {
    const costEntries = await this.prisma.maintenanceRequestCostEntry.findMany({
      where: {
        ...(dateFrom || dateTo ? buildDateFilter(dateFrom, dateTo, 'incurredAt') : {}),
        ...(Object.keys(requestWhere || {}).length > 0 ? { request: requestWhere } : {}),
      },
      select: { amount: true, incurredAt: true },
      orderBy: { incurredAt: 'asc' },
    });

    const monthlyMap = new Map<string, number>();
    costEntries.forEach(e => {
      const key = `${e.incurredAt.getFullYear()}-${String(e.incurredAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + e.amount);
    });

    return Array.from(monthlyMap.entries()).map(([month, total]) => ({ month, total }));
  }

  private async getMonthlyPartsTrend(dateFrom?: string, dateTo?: string, requestWhere?: any) {
    const partUsage = await this.prisma.maintenanceRequestPartUsage.findMany({
      where: {
        ...(dateFrom || dateTo ? buildDateFilter(dateFrom, dateTo, 'createdAt') : {}),
        ...(Object.keys(requestWhere || {}).length > 0 ? { request: requestWhere } : {}),
      },
      select: { totalCost: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const monthlyMap = new Map<string, number>();
    partUsage.forEach(p => {
      const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + (p.totalCost || 0));
    });

    return Array.from(monthlyMap.entries()).map(([month, total]) => ({ month, total }));
  }

  async getCostByMachine(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    const requestWhere: any = { machine: this.machineScope(ctx) };
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      requestWhere.productionLineId = filters.productionLineId;
    }
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      requestWhere.machineId = filters.machineId;
    }
    if (filters.machineComponentId) requestWhere.machineComponentId = filters.machineComponentId;
    if (filters.operationTypeId) requestWhere.operationTypeId = filters.operationTypeId;
    if (filters.costCenterId) requestWhere.costCenterId = filters.costCenterId;

    const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo, 'incurredAt');

    const machines = await this.prisma.machine.findMany({
      where: { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }], deletedAt: null },
      select: { id: true, code: true, name: true, status: true, productionLineId: true },
      orderBy: { name: 'asc' },
    });

    const machineCosts = await Promise.all(
      machines.map(async (machine) => {
        const reqWhere = { ...requestWhere, machineId: machine.id };
        const [entrySum, partSum, reqCount] = await Promise.all([
          this.prisma.maintenanceRequestCostEntry.aggregate({
            where: { ...dateFilter, request: reqWhere },
            _sum: { amount: true },
          }),
          this.prisma.maintenanceRequestPartUsage.aggregate({
            where: { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'createdAt'), request: reqWhere },
            _sum: { totalCost: true, quantity: true },
          }),
          this.prisma.maintenanceRequest.count({ where: { ...reqWhere, ...(filters.dateFrom || filters.dateTo ? buildDateFilter(filters.dateFrom, filters.dateTo) : {}) } }),
        ]);
        return {
          machineId: machine.id,
          machineCode: machine.code,
          machineName: machine.name,
          machineStatus: machine.status,
          requestCount: reqCount,
          costEntryTotal: entrySum._sum.amount || 0,
          partCostTotal: partSum._sum.totalCost || 0,
          partQtyTotal: partSum._sum.quantity || 0,
          totalCost: (entrySum._sum.amount || 0) + (partSum._sum.totalCost || 0),
        };
      }),
    );

    return {
      cards: [
        { label: 'totalMachines', value: machines.length },
        { label: 'machinesWithCost', value: machineCosts.filter(m => m.totalCost > 0).length },
        { label: 'totalCost', value: machineCosts.reduce((s, m) => s + m.totalCost, 0) },
        { label: 'machinesWithRequests', value: machineCosts.filter(m => m.requestCount > 0).length },
      ],
      rows: machineCosts.filter(m => m.totalCost > 0 || m.requestCount > 0).sort((a, b) => b.totalCost - a.totalCost),
    };
  }

  // ─────────────── AF-AG: Schedule Compliance ───────────────

  async getScheduleCompliance(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    const now = new Date();
    const scheduleWhere: any = { machine: this.machineScope(ctx) };
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      scheduleWhere.machineId = filters.machineId;
    }
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      scheduleWhere.machine = { ...(scheduleWhere.machine || {}), productionLineId: filters.productionLineId };
    }
    if (filters.operationTypeId) scheduleWhere.machine = { ...(scheduleWhere.machine || {}), operationTypeId: filters.operationTypeId };
    if (filters.costCenterId) scheduleWhere.machine = { ...(scheduleWhere.machine || {}), defaultCostCenterId: filters.costCenterId };

    const requestWhere: any = { type: 'PREVENTIVE', machine: this.machineScope(ctx) };
    if (filters.machineId) requestWhere.machineId = filters.machineId;
    if (filters.productionLineId) requestWhere.productionLineId = filters.productionLineId;

    const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo, 'endDate');

    const [totalSchedules, activeSchedules, overdueSchedules, completedPreventive, totalPreventiveDue] = await Promise.all([
      this.prisma.maintenanceSchedule.count({ where: scheduleWhere }),
      this.prisma.maintenanceSchedule.count({ where: { ...scheduleWhere, status: 'ACTIVE' } }),
      this.prisma.maintenanceSchedule.count({ where: { ...scheduleWhere, status: 'ACTIVE', endDate: { lt: now } } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, ...dateFilter, status: 'COMPLETED' } }),
      this.prisma.maintenanceSchedule.count({ where: { ...scheduleWhere, ...dateFilter, status: 'ACTIVE' } }),
    ]);

    const complianceRate = totalPreventiveDue > 0
      ? Math.round((completedPreventive / totalPreventiveDue) * 100)
      : null;

    return {
      cards: [
        { label: 'totalSchedules', value: totalSchedules },
        { label: 'activeSchedules', value: activeSchedules },
        { label: 'overdueSchedules', value: overdueSchedules },
        { label: 'completedPreventive', value: completedPreventive },
        { label: 'scheduleComplianceTarget', value: totalPreventiveDue },
        { label: 'complianceRate', value: complianceRate, unit: '%' },
      ],
    };
  }

  // ─────────────── AF-AG: KPI Overview ───────────────

  async getKpiOverview(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    const requestWhere: any = { machine: this.machineScope(ctx) };
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      requestWhere.productionLineId = filters.productionLineId;
    }
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      requestWhere.machineId = filters.machineId;
    }
    if (filters.operationTypeId) requestWhere.operationTypeId = filters.operationTypeId;
    if (filters.costCenterId) requestWhere.costCenterId = filters.costCenterId;

    const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo);
    const costDateFilter = buildDateFilter(filters.dateFrom, filters.dateTo, 'incurredAt');
    const partsDateFilter = buildDateFilter(filters.dateFrom, filters.dateTo, 'createdAt');
    const downtimeDateFilter = buildDateFilter(filters.dateFrom, filters.dateTo, 'startTime');

    const now = new Date();

    const [
      totalRequests, openRequests, inProgressRequests, completedRequests, cancelledRequests,
      totalCost, partsCost,
      correctiveCount, preventiveCount, emergencyCount,
      totalDowntimeEvents, totalDowntimeMinutes, activeDowntime,
      overdueSchedules,
      openBacklog,
      slaOverdueCount, totalSlaCount,
      avgCompletionResult,
    ] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, ...dateFilter } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, status: 'OPEN' } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, status: 'IN_PROGRESS' } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, status: 'COMPLETED', ...dateFilter } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, status: 'CANCELLED', ...dateFilter } }),
      this.prisma.maintenanceRequestCostEntry.aggregate({ where: { ...costDateFilter, request: requestWhere }, _sum: { amount: true } }),
      this.prisma.maintenanceRequestPartUsage.aggregate({ where: { ...partsDateFilter, request: requestWhere }, _sum: { totalCost: true } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, ...dateFilter, type: 'CORRECTIVE' } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, ...dateFilter, type: 'PREVENTIVE' } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, ...dateFilter, isEmergency: true } }),
      this.prisma.downtimeLog.count({ where: { ...downtimeDateFilter, cancelledAt: null, ...(Object.keys(requestWhere).length > 0 ? { machine: requestWhere.machine } : {}) } }),
      this.prisma.downtimeLog.aggregate({ where: { ...downtimeDateFilter, cancelledAt: null, machine: this.machineScope(ctx) }, _sum: { durationMinutes: true } }),
      this.prisma.downtimeLog.count({ where: { endTime: null, cancelledAt: null, machine: this.machineScope(ctx) } }),
      this.prisma.maintenanceSchedule.count({ where: { ...(filters.machineId ? { machineId: filters.machineId } : {}), status: 'ACTIVE', endDate: { lt: now }, machine: this.machineScope(ctx) } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, slaStatus: 'OVERDUE' } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, slaStatus: { not: null } } }),
      this.getAvgCompletionTimeRaw(requestWhere),
    ]);

    const totalCostValue = (totalCost._sum.amount || 0) + (partsCost._sum.totalCost || 0);
    const cmRatio = correctiveCount + preventiveCount > 0
      ? Math.round((preventiveCount / (correctiveCount + preventiveCount)) * 100)
      : null;
    const emergencyPct = totalRequests > 0
      ? Math.round((emergencyCount / totalRequests) * 100)
      : null;
    const slaOverduePct = totalSlaCount > 0
      ? Math.round((slaOverdueCount / totalSlaCount) * 100)
      : null;
    const avgCompletionHours = avgCompletionResult;

    return {
      cards: [
        { label: 'totalRequests', value: totalRequests },
        { label: 'openRequests', value: openRequests },
        { label: 'inProgressRequests', value: inProgressRequests },
        { label: 'completedRequests', value: completedRequests },
        { label: 'cancelledRequests', value: cancelledRequests },
        { label: 'openBacklog', value: openBacklog },
        { label: 'totalCost', value: totalCostValue },
        { label: 'partsCost', value: partsCost._sum.totalCost || 0 },
        { label: 'otherCost', value: totalCost._sum.amount || 0 },
        { label: 'totalDowntime', value: totalDowntimeMinutes._sum.durationMinutes || 0, unit: 'minutes' },
        { label: 'totalDowntimeHours', value: Math.round((totalDowntimeMinutes._sum.durationMinutes || 0) / 60 * 100) / 100, unit: 'hours' },
        { label: 'totalDowntimeEvents', value: totalDowntimeEvents },
        { label: 'activeDowntime', value: activeDowntime },
        { label: 'overdueSchedules', value: overdueSchedules },
        { label: 'pmCmRatio', value: cmRatio, unit: '%' },
        { label: 'emergencyPercentage', value: emergencyPct, unit: '%' },
        { label: 'slaOverduePercentage', value: slaOverduePct, unit: '%' },
        { label: 'avgCompletionTime', value: avgCompletionHours, unit: 'hours' },
      ],
    };
  }

  private async getAvgCompletionTimeRaw(requestWhere: any) {
    const completed = await this.prisma.maintenanceRequest.findMany({
      where: { ...requestWhere, status: 'COMPLETED', startDate: { not: null }, endDate: { not: null }, deletedAt: null },
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

  // ─────────────── AF-AG: Backlog Trend ───────────────

  async getBacklogTrend(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    const requestWhere: any = { machine: this.machineScope(ctx) };
    if (filters.productionLineId) {
      await this.assertLineAccess(filters.productionLineId, ctx);
      requestWhere.productionLineId = filters.productionLineId;
    }
    if (filters.machineId) {
      await this.assertMachineAccess(filters.machineId, ctx);
      requestWhere.machineId = filters.machineId;
    }
    if (filters.operationTypeId) requestWhere.operationTypeId = filters.operationTypeId;

    const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo);

    const openRequests = await this.prisma.maintenanceRequest.findMany({
      where: { ...requestWhere, ...dateFilter, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const monthlyMap = new Map<string, number>();
    openRequests.forEach(r => {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
    });

    return {
      cards: [
        { label: 'openBacklog', value: openRequests.length },
      ],
      backlogByMonth: Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })),
    };
  }
}
