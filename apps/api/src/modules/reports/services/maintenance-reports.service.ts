import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MaintenanceReportFilterDto } from '../dto/report-filter.dto';
import { buildDateFilter, nowPlusDays, paginate } from './report-query-utils';

@Injectable()
export class MaintenanceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMaintenanceRequestsReport(filters: MaintenanceReportFilterDto) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo) };
    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.requestStatus) where.status = filters.requestStatus;
    if (filters.maintenanceType) where.type = filters.maintenanceType;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assigneeId) where.assignedToId = filters.assigneeId;
    if (filters.search) where.OR = [
      { title: { contains: filters.search } },
      { requestNumber: { contains: filters.search } },
    ];

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

  async getMachineDowntimeReport(filters: MaintenanceReportFilterDto) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'startTime') };
    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.search) where.reason = { contains: filters.search };

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

  async getMaintenanceCostsReport(filters: MaintenanceReportFilterDto) {
    const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo, 'incurredAt');

    const whereCostEntries: any = { ...dateFilter };
    if (filters.machineId) whereCostEntries.request = { machineId: filters.machineId };

    const whereParts: any = {};
    if (filters.machineId) whereParts.request = { machineId: filters.machineId };

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

  async getPreventiveSchedulesReport(filters: MaintenanceReportFilterDto) {
    const where: any = {};
    const now = new Date();
    const soon = nowPlusDays(7);

    if (filters.machineId) where.machineId = filters.machineId;
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
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE' } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'INACTIVE' } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', endDate: { lte: now } } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', endDate: { gte: now, lte: soon } } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', OR: [{ endDate: { gt: now } }, { endDate: null }] } }),
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

  async getMachineLogReport(filters: any) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'createdAt') };
    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.search) where.OR = [{ title: { contains: filters.search } }, { requestNumber: { contains: filters.search } }];

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

  async getPartsUsageReport(filters: any) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'createdAt') };
    if (filters.machineId) where.request = { machineId: filters.machineId };
    if (filters.productId) where.productId = filters.productId;
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

  async getUpcomingPreventiveReport(filters: any) {
    const now = new Date();
    const soon = nowPlusDays(30);
    const where: any = { status: 'ACTIVE', endDate: { gte: now, lte: soon } };
    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.search) where.title = { contains: filters.search };

    const [total, rows, dueSoonCount, totalActive] = await Promise.all([
      this.prisma.maintenanceSchedule.count({ where }),
      this.prisma.maintenanceSchedule.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { endDate: 'asc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, endDate: { lte: nowPlusDays(7) } } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE' } }),
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

  async getOverduePreventiveReport(filters: any) {
    const now = new Date();
    const where: any = { status: 'ACTIVE', endDate: { lt: now } };
    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.search) where.title = { contains: filters.search };

    const [total, rows, overdueCount, totalActive] = await Promise.all([
      this.prisma.maintenanceSchedule.count({ where }),
      this.prisma.maintenanceSchedule.findMany({
        where, ...paginate(filters.page, filters.pageSize),
        orderBy: { endDate: 'asc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', endDate: { lt: now } } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE' } }),
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
}
