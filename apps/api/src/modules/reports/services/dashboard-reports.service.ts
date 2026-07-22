import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InventoryReportFilterDto, MaintenanceReportFilterDto } from '../dto/report-filter.dto';
import { buildDateFilter, nowPlusDays } from './report-query-utils';

@Injectable()
export class DashboardReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMaintenanceOverview(filters: MaintenanceReportFilterDto) {
    const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo);
    const now = new Date();
    const soon = nowPlusDays(7);

    const [
      totalRequests, openRequests, inProgressRequests, completedRequests, cancelledRequests,
      overdueSchedules, downtimeAgg, activeDowntime, costAgg, partsCount,
      requestsByStatus, requestsByPriority, requestsByType,
      topMachinesByReq, topMachinesByDowntime, dueSchedules, recentRequests,
    ] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where: dateFilter }),
      this.prisma.maintenanceRequest.count({ where: { ...dateFilter, status: 'OPEN' } }),
      this.prisma.maintenanceRequest.count({ where: { ...dateFilter, status: 'IN_PROGRESS' } }),
      this.prisma.maintenanceRequest.count({ where: { ...dateFilter, status: 'COMPLETED' } }),
      this.prisma.maintenanceRequest.count({ where: { ...dateFilter, status: 'CANCELLED' } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', endDate: { lte: now } } }),
      this.prisma.downtimeLog.aggregate({ where: { ...dateFilter, cancelledAt: null }, _sum: { durationMinutes: true } }),
      this.prisma.downtimeLog.count({ where: { endTime: null, cancelledAt: null } }),
      this.prisma.maintenanceRequestCostEntry.aggregate({ _sum: { amount: true } }),
      this.prisma.maintenanceRequestPartUsage.count(),
      this.prisma.maintenanceRequest.groupBy({ by: ['status'], where: dateFilter, _count: true }),
      this.prisma.maintenanceRequest.groupBy({ by: ['priority'], where: dateFilter, _count: true }),
      this.prisma.maintenanceRequest.groupBy({ by: ['type'], where: dateFilter, _count: true }),
      this.prisma.maintenanceRequest.groupBy({ by: ['machineId'], where: dateFilter, _count: true, orderBy: { _count: { id: 'desc' } }, take: 10 }),
      this.prisma.downtimeLog.groupBy({ by: ['machineId'], where: { ...dateFilter, cancelledAt: null }, _sum: { durationMinutes: true }, orderBy: { _sum: { durationMinutes: 'desc' } }, take: 10 }),
      this.prisma.maintenanceSchedule.findMany({ where: { status: 'ACTIVE', endDate: { lte: soon } }, take: 10, include: { machine: { select: { id: true, code: true, name: true } } }, orderBy: { endDate: 'asc' } }),
      this.prisma.maintenanceRequest.findMany({ where: dateFilter, take: 10, orderBy: { createdAt: 'desc' }, include: { machine: { select: { id: true, code: true, name: true } } } }),
    ]);

    return {
      cards: [
        { label: 'totalRequests', value: totalRequests },
        { label: 'openRequests', value: openRequests },
        { label: 'completedRequests', value: completedRequests },
        { label: 'totalDowntime', value: downtimeAgg._sum.durationMinutes || 0, unit: 'minutes' },
        { label: 'activeDowntime', value: activeDowntime },
        { label: 'overdueSchedules', value: overdueSchedules },
        { label: 'totalCost', value: costAgg._sum.amount || 0 },
        { label: 'partsUsage', value: partsCount },
      ],
      totalRequests, openRequests, inProgressRequests, completedRequests, cancelledRequests,
      overdueSchedules,
      totalDowntimeMinutes: downtimeAgg._sum.durationMinutes || 0,
      activeDowntime,
      totalCost: costAgg._sum.amount || 0,
      partsUsageCount: partsCount,
      requestsByStatus: requestsByStatus.map(r => ({ status: r.status, count: r._count })),
      requestsByPriority: requestsByPriority.map(r => ({ priority: r.priority, count: r._count })),
      requestsByType: requestsByType.map(r => ({ type: r.type, count: r._count })),
      topMachinesByRequestCount: topMachinesByReq.map(r => ({ machineId: r.machineId, count: r._count })),
      topMachinesByDowntime: topMachinesByDowntime.map(r => ({ machineId: r.machineId, totalMinutes: r._sum.durationMinutes || 0 })),
      dueSchedules,
      recentRequests,
    };
  }

  async getInventoryOverview(filters: InventoryReportFilterDto) {
    const [
      totalProducts, activeProducts, totalWarehouses, totalLocations,
      positiveBal, zeroBal, negativeBal,
      openCounts, completedCounts,
      postedMovements, postedAdjustments,
      balancesByWarehouse,
      recentCounts, recentMovements, recentAdjustments,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.warehouse.count(),
      this.prisma.warehouseLocation.count(),
      this.prisma.inventoryBalance.count({ where: { quantity: { gt: 0 } } }),
      this.prisma.inventoryBalance.count({ where: { quantity: 0 } }),
      this.prisma.inventoryBalance.count({ where: { quantity: { lt: 0 } } }),
      this.prisma.inventoryCount.count({ where: { status: { in: ['DRAFT', 'IN_PROGRESS'] } } }),
      this.prisma.inventoryCount.count({ where: { status: 'COMPLETED' } }),
      this.prisma.inventoryMovement.count({ where: { status: 'POSTED' } }),
      this.prisma.inventoryAdjustment.count({ where: { status: 'POSTED' } }),
      this.prisma.inventoryBalance.groupBy({ by: ['warehouseId'], _sum: { quantity: true }, _count: true }),
      this.prisma.inventoryCount.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { warehouse: { select: { id: true, code: true, name: true } } } }),
      this.prisma.inventoryMovement.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { warehouse: { select: { id: true, code: true, name: true } } } }),
      this.prisma.inventoryAdjustment.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { warehouse: { select: { id: true, code: true, name: true } } } }),
    ]);

    return {
      cards: [
        { label: 'totalProducts', value: totalProducts },
        { label: 'activeProducts', value: activeProducts },
        { label: 'totalWarehouses', value: totalWarehouses },
        { label: 'totalLocations', value: totalLocations },
        { label: 'positiveBalance', value: positiveBal },
        { label: 'zeroBalance', value: zeroBal },
        { label: 'negativeBalance', value: negativeBal },
        { label: 'openCounts', value: openCounts },
        { label: 'completedCounts', value: completedCounts },
        { label: 'postedMovements', value: postedMovements },
        { label: 'postedAdjustments', value: postedAdjustments },
      ],
      totalProducts, activeProducts, totalWarehouses, totalLocations,
      positiveBalanceProducts: positiveBal, zeroBalanceProducts: zeroBal, negativeBalanceProducts: negativeBal,
      openCounts, completedCounts, postedMovements, postedAdjustments,
      balancesByWarehouse: balancesByWarehouse.map(b => ({ warehouseId: b.warehouseId, totalQuantity: b._sum.quantity || 0, count: b._count })),
      recentCounts, recentMovements, recentAdjustments,
    };
  }
}
