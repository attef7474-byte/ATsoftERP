import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InventoryReportFilterDto, MaintenanceReportFilterDto } from '../dto/report-filter.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { buildDateFilter, nowPlusDays } from './report-query-utils';

@Injectable()
export class DashboardReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  async getMaintenanceOverview(filters: MaintenanceReportFilterDto, ctx: ActiveOperationalContext) {
    const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo);
    const now = new Date();
    const soon = nowPlusDays(7);
    const machine = this.machineScope(ctx);

    const requestWhere: any = { ...dateFilter, machine };
    if (filters.productionLineId) requestWhere.productionLineId = filters.productionLineId;
    if (filters.machineId) requestWhere.machineId = filters.machineId;
    if (filters.machineComponentId) requestWhere.machineComponentId = filters.machineComponentId;
    if (!filters.machineComponentId && filters.componentId) requestWhere.machineComponentId = filters.componentId;
    if (filters.operationTypeId) requestWhere.operationTypeId = filters.operationTypeId;
    if (filters.costCenterId) requestWhere.costCenterId = filters.costCenterId;
    if (filters.requestStatus) requestWhere.status = filters.requestStatus;
    if (filters.maintenanceType) requestWhere.type = filters.maintenanceType;
    if (filters.priority) requestWhere.priority = filters.priority;

    const scheduleMachineWhere: any = { ...machine };
    if (filters.productionLineId) scheduleMachineWhere.productionLineId = filters.productionLineId;
    if (filters.operationTypeId) scheduleMachineWhere.operationTypeId = filters.operationTypeId;
    if (filters.costCenterId) scheduleMachineWhere.defaultCostCenterId = filters.costCenterId;

    const scheduleBaseWhere: any = { machine: scheduleMachineWhere, status: 'ACTIVE' };
    if (filters.machineId) scheduleBaseWhere.machineId = filters.machineId;

    const [
      totalRequests, openRequests, inProgressRequests, completedRequests, cancelledRequests,
      overdueSchedules, downtimeAgg, activeDowntime, costAgg, partsCount,
      requestsByStatus, requestsByPriority, requestsByType,
      topMachinesByReq, topMachinesByDowntime, dueSchedules, recentRequests,
    ] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where: requestWhere }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, status: 'OPEN' } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, status: 'IN_PROGRESS' } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, status: 'COMPLETED' } }),
      this.prisma.maintenanceRequest.count({ where: { ...requestWhere, status: 'CANCELLED' } }),
      this.prisma.maintenanceSchedule.count({ where: { ...scheduleBaseWhere, endDate: { lte: now } } }),
      this.prisma.downtimeLog.aggregate({ where: { ...dateFilter, ...(filters.machineId ? { machineId: filters.machineId } : {}), cancelledAt: null, machine }, _sum: { durationMinutes: true } }),
      this.prisma.downtimeLog.count({ where: { endTime: null, cancelledAt: null, machine } }),
      this.prisma.maintenanceRequestCostEntry.aggregate({ where: { request: { machine } }, _sum: { amount: true } }),
      this.prisma.maintenanceRequestPartUsage.count({ where: { request: { machine } } }),
      this.prisma.maintenanceRequest.groupBy({ by: ['status'], where: requestWhere, _count: true }),
      this.prisma.maintenanceRequest.groupBy({ by: ['priority'], where: requestWhere, _count: true }),
      this.prisma.maintenanceRequest.groupBy({ by: ['type'], where: requestWhere, _count: true }),
      this.prisma.maintenanceRequest.groupBy({ by: ['machineId'], where: requestWhere, _count: true, orderBy: { _count: { id: 'desc' } }, take: 10 }),
      this.prisma.downtimeLog.groupBy({ by: ['machineId'], where: { ...dateFilter, ...(filters.machineId ? { machineId: filters.machineId } : {}), cancelledAt: null, machine }, _sum: { durationMinutes: true }, orderBy: { _sum: { durationMinutes: 'desc' } }, take: 10 }),
      this.prisma.maintenanceSchedule.findMany({ where: { ...scheduleBaseWhere, endDate: { lte: soon } }, take: 10, include: { machine: { select: { id: true, code: true, name: true } } }, orderBy: { endDate: 'asc' } }),
      this.prisma.maintenanceRequest.findMany({ where: requestWhere, take: 10, orderBy: { createdAt: 'desc' }, include: { machine: { select: { id: true, code: true, name: true } } } }),
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

  async getInventoryOverview(filters: InventoryReportFilterDto, ctx: ActiveOperationalContext) {
    const tenantRows = { companyId: ctx.companyId, deletedAt: null, OR: [{ branchId: ctx.branchId }, { branchId: null }] };
    const warehouses = {
      companyId: ctx.companyId,
      deletedAt: null,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
    const balances = { warehouse: warehouses };
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
      this.prisma.warehouse.count({ where: warehouses }),
      this.prisma.warehouseLocation.count({ where: { warehouse: warehouses } }),
      this.prisma.inventoryBalance.count({ where: { ...balances, quantity: { gt: 0 } } }),
      this.prisma.inventoryBalance.count({ where: { ...balances, quantity: 0 } }),
      this.prisma.inventoryBalance.count({ where: { ...balances, quantity: { lt: 0 } } }),
      this.prisma.inventoryCount.count({ where: { ...tenantRows, status: { in: ['DRAFT', 'IN_PROGRESS'] } } }),
      this.prisma.inventoryCount.count({ where: { ...tenantRows, status: 'COMPLETED' } }),
      this.prisma.inventoryMovement.count({ where: { ...tenantRows, status: 'POSTED' } }),
      this.prisma.inventoryAdjustment.count({ where: { ...tenantRows, status: 'POSTED' } }),
      this.prisma.inventoryBalance.groupBy({ by: ['warehouseId'], where: balances, _sum: { quantity: true }, _count: true }),
      this.prisma.inventoryCount.findMany({ where: tenantRows, take: 10, orderBy: { createdAt: 'desc' }, include: { warehouse: { select: { id: true, code: true, name: true } } } }),
      this.prisma.inventoryMovement.findMany({ where: tenantRows, take: 10, orderBy: { createdAt: 'desc' }, include: { warehouse: { select: { id: true, code: true, name: true } } } }),
      this.prisma.inventoryAdjustment.findMany({ where: tenantRows, take: 10, orderBy: { createdAt: 'desc' }, include: { warehouse: { select: { id: true, code: true, name: true } } } }),
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
