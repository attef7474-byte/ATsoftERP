import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MaintenanceReportFilterDto, InventoryReportFilterDto, BarcodeReportFilterDto } from './dto/report-filter.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private buildDateFilter(dateFrom?: string, dateTo?: string, field = 'createdAt'): any {
    const filter: any = {};
    if (dateFrom || dateTo) {
      filter[field] = {};
      if (dateFrom) filter[field].gte = new Date(dateFrom);
      if (dateTo) filter[field].lte = new Date(dateTo);
    }
    return filter;
  }

  private paginate(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    return { skip, take: pageSize };
  }

  private nowPlusDays(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  // ────────────────────── MAINTENANCE OVERVIEW ───────────────────────

  async getMaintenanceOverview(filters: MaintenanceReportFilterDto) {
    const dateFilter = this.buildDateFilter(filters.dateFrom, filters.dateTo);
    const now = new Date();
    const soon = this.nowPlusDays(7);

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

  // ───────────────────── MAINTENANCE REQUESTS REPORT ──────────────────

  async getMaintenanceRequestsReport(filters: MaintenanceReportFilterDto) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo) };
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
        where, ...this.paginate(filters.page, filters.pageSize),
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

  // ────────────────────── MACHINE DOWNTIME REPORT ─────────────────────

  async getMachineDowntimeReport(filters: MaintenanceReportFilterDto) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo, 'startTime') };
    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.search) where.reason = { contains: filters.search };

    const [total, rows, totalDuration, activeCount, avgDuration] = await Promise.all([
      this.prisma.downtimeLog.count({ where }),
      this.prisma.downtimeLog.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
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

  // ──────────────────── MAINTENANCE COSTS REPORT ─────────────────────

  async getMaintenanceCostsReport(filters: MaintenanceReportFilterDto) {
    const dateFilter = this.buildDateFilter(filters.dateFrom, filters.dateTo, 'incurredAt');

    const whereCostEntries: any = { ...dateFilter };
    if (filters.machineId) whereCostEntries.request = { machineId: filters.machineId };

    const whereParts: any = {};
    if (filters.machineId) whereParts.request = { machineId: filters.machineId };

    const [costRows, costTotal, partRows, partTotal, costSum, partsCostSum] = await Promise.all([
      this.prisma.maintenanceRequestCostEntry.findMany({
        where: whereCostEntries, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { incurredAt: 'desc' },
        include: { request: { select: { id: true, requestNumber: true, machineId: true } } },
      }),
      this.prisma.maintenanceRequestCostEntry.count({ where: whereCostEntries }),
      this.prisma.maintenanceRequestPartUsage.findMany({
        where: whereParts, ...this.paginate(1, 10),
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

  // ─────────────────── PREVENTIVE SCHEDULE REPORT ────────────────────

  async getPreventiveSchedulesReport(filters: MaintenanceReportFilterDto) {
    const where: any = {};
    const now = new Date();
    const soon = this.nowPlusDays(7);

    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.maintenanceType) where.type = filters.maintenanceType;
    if (filters.dueStatus === 'overdue') where.endDate = { lte: now };
    else if (filters.dueStatus === 'dueSoon') where.endDate = { gte: now, lte: soon };
    else if (filters.dueStatus === 'notDue') where.OR = [{ endDate: { gt: now } }, { endDate: null }];
    if (filters.search) where.title = { contains: filters.search };

    const [total, rows, activeCount, inactiveCount, overdueCount, dueSoonCount, notDueCount] = await Promise.all([
      this.prisma.maintenanceSchedule.count({ where }),
      this.prisma.maintenanceSchedule.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
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

  // ────────────────────── INVENTORY OVERVIEW ─────────────────────────

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

  // ───────────────────── INVENTORY BALANCE REPORT ────────────────────

  async getInventoryBalanceReport(filters: InventoryReportFilterDto) {
    const where: any = {};
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.productId) where.productId = filters.productId;
    if (filters.productCategoryId) where.product = { categoryId: filters.productCategoryId };
    if (filters.search) where.product = { ...where.product, OR: [{ code: { contains: filters.search } }, { name: { contains: filters.search } }] };

    const [total, rows, totalQty, positiveCount, zeroCount, negativeCount, warehouseCount] = await Promise.all([
      this.prisma.inventoryBalance.count({ where }),
      this.prisma.inventoryBalance.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { updatedAt: 'desc' },
        include: { product: { select: { id: true, code: true, name: true } }, warehouse: { select: { id: true, code: true, name: true } }, location: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.inventoryBalance.aggregate({ where, _sum: { quantity: true } }),
      this.prisma.inventoryBalance.count({ where: { ...where, quantity: { gt: 0 } } }),
      this.prisma.inventoryBalance.count({ where: { ...where, quantity: 0 } }),
      this.prisma.inventoryBalance.count({ where: { ...where, quantity: { lt: 0 } } }),
      this.prisma.warehouse.count(),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalBalanceRows', value: total },
        { label: 'totalQuantity', value: totalQty._sum.quantity || 0 },
        { label: 'positiveBalance', value: positiveCount },
        { label: 'zeroBalance', value: zeroCount },
        { label: 'negativeBalance', value: negativeCount },
        { label: 'totalWarehouses', value: warehouseCount },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  // ────────────────── INVENTORY COUNT VARIANCE REPORT ────────────────

  async getInventoryCountVarianceReport(filters: InventoryReportFilterDto) {
    const where: any = {};
    if (filters.countStatus) where.count = { status: filters.countStatus };
    if (filters.warehouseId) where.count = { ...where.count, warehouseId: filters.warehouseId };
    if (filters.productId) where.productId = filters.productId;
    if (filters.locationId) where.warehouseLocationId = filters.locationId;
    if (filters.varianceOnly) where.differenceQty = { not: 0 };

    const [total, rows, totalLines, varianceLines, posVar, negVar, zeroVar, completedCountsCount] = await Promise.all([
      this.prisma.inventoryCountLine.count({ where }),
      this.prisma.inventoryCountLine.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { id: 'desc' },
        include: {
          product: { select: { id: true, code: true, name: true } },
          warehouseLocation: { select: { id: true, code: true, name: true } },
          count: { select: { id: true, countNumber: true, status: true } },
        },
      }),
      this.prisma.inventoryCountLine.count(),
      this.prisma.inventoryCountLine.count({ where: { differenceQty: { not: 0 } } }),
      this.prisma.inventoryCountLine.count({ where: { differenceQty: { gt: 0 } } }),
      this.prisma.inventoryCountLine.count({ where: { differenceQty: { lt: 0 } } }),
      this.prisma.inventoryCountLine.count({ where: { differenceQty: 0 } }),
      this.prisma.inventoryCount.count({ where: { status: 'COMPLETED' } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalCountLines', value: totalLines },
        { label: 'varianceLines', value: varianceLines },
        { label: 'positiveVariance', value: posVar },
        { label: 'negativeVariance', value: negVar },
        { label: 'zeroVariance', value: zeroVar },
        { label: 'completedCounts', value: completedCountsCount },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  // ──────────────────── INVENTORY MOVEMENTS REPORT ───────────────────

  async getInventoryMovementsReport(filters: InventoryReportFilterDto) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo, 'movementDate') };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.productId) where.lines = { some: { productId: filters.productId } };
    if (filters.movementType) where.movementType = filters.movementType;
    if (filters.countStatus) where.status = filters.countStatus;
    if (filters.search) where.movementNumber = { contains: filters.search };

    const [total, rows, draftCount, postedCount, cancelledCount, totalQtyAgg] = await Promise.all([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { movementDate: 'desc' },
        include: { warehouse: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.inventoryMovement.count({ where: { ...where, status: 'DRAFT' } }),
      this.prisma.inventoryMovement.count({ where: { ...where, status: 'POSTED' } }),
      this.prisma.inventoryMovement.count({ where: { ...where, status: 'CANCELLED' } }),
      this.prisma.inventoryMovementLine.aggregate({ where: { movement: where }, _sum: { quantity: true } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalMovements', value: total },
        { label: 'postedMovements', value: postedCount },
        { label: 'draftMovements', value: draftCount },
        { label: 'cancelledMovements', value: cancelledCount },
        { label: 'totalMovedQty', value: totalQtyAgg._sum.quantity || 0 },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  // ─────────────────── INVENTORY ADJUSTMENTS REPORT ──────────────────

  async getInventoryAdjustmentsReport(filters: InventoryReportFilterDto) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo, 'adjustmentDate') };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.productId) where.lines = { some: { productId: filters.productId } };
    if (filters.countStatus) where.status = filters.countStatus;
    if (filters.search) where.adjustmentNumber = { contains: filters.search };

    const [total, rows, draftCount, postedCount, cancelledCount, posAdjustAgg, negAdjustAgg] = await Promise.all([
      this.prisma.inventoryAdjustment.count({ where }),
      this.prisma.inventoryAdjustment.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { adjustmentDate: 'desc' },
        include: { warehouse: { select: { id: true, code: true, name: true } }, inventoryCount: { select: { id: true, countNumber: true } } },
      }),
      this.prisma.inventoryAdjustment.count({ where: { ...where, status: 'DRAFT' } }),
      this.prisma.inventoryAdjustment.count({ where: { ...where, status: 'POSTED' } }),
      this.prisma.inventoryAdjustment.count({ where: { ...where, status: 'CANCELLED' } }),
      this.prisma.inventoryAdjustmentLine.aggregate({ where: { adjustment: where, differenceQty: { gt: 0 } }, _sum: { differenceQty: true } }),
      this.prisma.inventoryAdjustmentLine.aggregate({ where: { adjustment: where, differenceQty: { lt: 0 } }, _sum: { differenceQty: true } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalAdjustments', value: total },
        { label: 'postedAdjustments', value: postedCount },
        { label: 'draftAdjustments', value: draftCount },
        { label: 'cancelledAdjustments', value: cancelledCount },
        { label: 'positiveAdjustments', value: posAdjustAgg._sum.differenceQty || 0 },
        { label: 'negativeAdjustments', value: Math.abs(negAdjustAgg._sum.differenceQty || 0) },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  // ──────────────────────── BARCODE SCANS REPORT ─────────────────────

  async getBarcodeScansReport(filters: BarcodeReportFilterDto) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo, 'scannedAt') };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.scanPurpose) where.purpose = filters.scanPurpose;
    if (filters.result) where.result = filters.result;
    if (filters.scannedById) where.scannedById = filters.scannedById;

    const [total, rows, successCount, failCount, notFoundCount, byPurpose, byEntity] = await Promise.all([
      this.prisma.barcodeScanEvent.count({ where }),
      this.prisma.barcodeScanEvent.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { scannedAt: 'desc' },
        include: { label: { select: { id: true, code: true } } },
      }),
      this.prisma.barcodeScanEvent.count({ where: { ...where, result: 'SUCCESS' } }),
      this.prisma.barcodeScanEvent.count({ where: { ...where, result: 'FAIL' } }),
      this.prisma.barcodeScanEvent.count({ where: { ...where, result: 'NOT_FOUND' } }),
      this.prisma.barcodeScanEvent.groupBy({ by: ['purpose'], where, _count: true }),
      this.prisma.barcodeScanEvent.groupBy({ by: ['entityType'], where, _count: true }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalScans', value: total },
        { label: 'successfulScans', value: successCount },
        { label: 'failedScans', value: failCount },
        { label: 'notFoundScans', value: notFoundCount },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byPurpose: byPurpose.map(p => ({ purpose: p.purpose, count: p._count })),
      byEntity: byEntity.map(e => ({ entityType: e.entityType, count: e._count })),
    };
  }

  // ═════════════════════════ NEW BATCH 33 REPORTS ═════════════════════

  // ──────────────────────── ASSETS REGISTER REPORT ───────────────────

  async getAssetsRegisterReport(filters: any) {
    const where: any = {};
    if (filters.search) where.OR = [{ code: { contains: filters.search } }, { name: { contains: filters.search } }];
    if (filters.machineCategoryId) where.categoryId = filters.machineCategoryId;
    if (filters.status) where.status = filters.status;
    if (filters.location) where.location = { contains: filters.location };

    const [total, rows, byStatus, byCategory, activeCount, inactiveCount] = await Promise.all([
      this.prisma.machine.count({ where }),
      this.prisma.machine.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.machine.groupBy({ by: ['status'], _count: true }),
      this.prisma.machine.groupBy({ by: ['categoryId'], _count: true }),
      this.prisma.machine.count({ where: { status: 'ACTIVE' } }),
      this.prisma.machine.count({ where: { status: 'INACTIVE' } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalMachines', value: total },
        { label: 'activeMachines', value: activeCount },
        { label: 'inactiveMachines', value: inactiveCount },
        { label: 'totalCategories', value: byCategory.length },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
      byCategory: byCategory.map(c => ({ categoryId: c.categoryId, count: c._count })),
    };
  }

  // ──────────────────────── PARTS INVENTORY REPORT ──────────────────

  async getPartsReport(filters: any) {
    const where: any = {};
    if (filters.search) where.OR = [{ code: { contains: filters.search } }, { name: { contains: filters.search } }];

    const [total, rows, highStock, lowStock] = await Promise.all([
      this.prisma.machinePart.count({ where }),
      this.prisma.machinePart.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { id: 'desc' },
      }),
      this.prisma.machinePart.count({ where: { quantity: { gte: 10 } } }),
      this.prisma.machinePart.count({ where: { quantity: { lt: 10 } } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalParts', value: total },
        { label: 'activeParts', value: highStock },
        { label: 'inactiveParts', value: lowStock },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  // ──────────────────────── BUSINESS PARTNERS REPORT ────────────────

  async getPartnersReport(filters: any) {
    const where: any = {};
    if (filters.search) where.OR = [{ code: { contains: filters.search } }, { name: { contains: filters.search } }, { email: { contains: filters.search } }];
    if (filters.type) where.type = filters.type;

    const [total, rows, byType, blockedCount, supplierCount, customerCount] = await Promise.all([
      this.prisma.businessPartner.count({ where }),
      this.prisma.businessPartner.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.businessPartner.groupBy({ by: ['type'], _count: true }),
      this.prisma.businessPartner.count({ where: { isBlocked: true } }),
      this.prisma.businessPartner.count({ where: { isSupplier: true, isBlocked: false } }),
      this.prisma.businessPartner.count({ where: { isCustomer: true, isBlocked: false } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalPartners', value: total },
        { label: 'activeSuppliers', value: supplierCount },
        { label: 'activeCustomers', value: customerCount },
        { label: 'blockedPartners', value: blockedCount },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byType: byType.map(t => ({ type: t.type, count: t._count })),
    };
  }

  // ──────────────────────── ATTACHMENTS / DOCUMENTS REPORT ──────────

  async getAttachmentsReport(filters: any) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo) };
    if (filters.entityName) where.entityName = filters.entityName;
    if (filters.search) where.originalName = { contains: filters.search };

    const [total, rows, byEntityName, totalSize] = await Promise.all([
      this.prisma.attachment.count({ where }),
      this.prisma.attachment.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      }),
      this.prisma.attachment.groupBy({ by: ['entityName'], _count: true }),
      this.prisma.attachment.aggregate({ where, _sum: { size: true } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalAttachments', value: total },
        { label: 'totalAttachmentsSize', value: totalSize._sum?.size || 0, unit: 'bytes' },
        { label: 'entityTypes', value: byEntityName.length },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byEntityType: byEntityName.map(e => ({ entityName: e.entityName, count: e._count })),
    };
  }

  // ──────────────────────── AUDIT TRAIL REPORT ──────────────────────

  async getAuditTrailReport(filters: any) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo) };
    if (filters.entity) where.entity = filters.entity;
    if (filters.action) where.action = filters.action;
    if (filters.userId) where.userId = filters.userId;
    if (filters.search) where.details = { contains: filters.search };

    const [total, rows, byAction, byEntity, byUser] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.auditLog.groupBy({ by: ['action'], where, _count: true }),
      this.prisma.auditLog.groupBy({ by: ['entity'], where, _count: true }),
      this.prisma.auditLog.groupBy({ by: ['userId'], where, _count: true, orderBy: { _count: { id: 'desc' } }, take: 10 }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalAuditEntries', value: total },
        { label: 'uniqueActions', value: byAction.length },
        { label: 'uniqueEntities', value: byEntity.length },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byAction: byAction.map(a => ({ action: a.action, count: a._count })),
      byEntity: byEntity.map(e => ({ entity: e.entity, count: e._count })),
      topUsers: byUser.map(u => ({ userId: u.userId, count: u._count })),
    };
  }

  // ──────────────────────── USER ACTIVITY REPORT ────────────────────

  async getUserActivityReport(filters: any) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo, 'lastLoginAt') };
    if (filters.search) where.OR = [{ name: { contains: filters.search } }, { email: { contains: filters.search } }];
    if (filters.status) where.status = filters.status;

    const [total, rows, activeCount, inactiveCount] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { lastLoginAt: 'desc' },
        select: { id: true, name: true, email: true, status: true, lastLoginAt: true, createdAt: true },
      }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'INACTIVE' } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalUsers', value: total },
        { label: 'activeUsers', value: activeCount },
        { label: 'inactiveUsers', value: inactiveCount },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  // ──────────────────────── NOTIFICATIONS REPORT ────────────────────

  async getNotificationsReport(filters: any) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo) };
    if (filters.search) where.title = { contains: filters.search };

    const [total, rows, byType, unreadCount] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.groupBy({ by: ['type'], where, _count: true }),
      this.prisma.notification.count({ where: { read: false } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'totalNotifications', value: total },
        { label: 'unreadNotifications', value: unreadCount },
        { label: 'notificationCategories', value: byType.length },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
      byType: byType.map(t => ({ type: t.type, count: t._count })),
    };
  }

  // ═══════════════════════ BATCH 33 CORRECTIVE REPORTS ════════════════

  // ──────────────────────── MACHINE LOG REPORT ──────────────────────

  async getMachineLogReport(filters: any) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo, 'createdAt') };
    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.search) where.OR = [{ title: { contains: filters.search } }, { requestNumber: { contains: filters.search } }];

    const [total, rows] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where }),
      this.prisma.maintenanceRequest.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { createdAt: 'desc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return { rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages };
  }

  // ──────────────────────── PARTS USAGE REPORT ──────────────────────

  async getPartsUsageReport(filters: any) {
    const where: any = { ...this.buildDateFilter(filters.dateFrom, filters.dateTo, 'createdAt') };
    if (filters.machineId) where.request = { machineId: filters.machineId };
    if (filters.productId) where.productId = filters.productId;
    if (filters.search) where.product = { OR: [{ code: { contains: filters.search } }, { name: { contains: filters.search } }] };

    const [total, rows, totalQty, totalCost] = await Promise.all([
      this.prisma.maintenanceRequestPartUsage.count({ where }),
      this.prisma.maintenanceRequestPartUsage.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
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

  // ──────────────────── UPCOMING PREVENTIVE REPORT ──────────────────

  async getUpcomingPreventiveReport(filters: any) {
    const now = new Date();
    const soon = this.nowPlusDays(30);
    const where: any = { status: 'ACTIVE', endDate: { gte: now, lte: soon } };
    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.search) where.title = { contains: filters.search };

    const [total, rows, dueSoonCount, totalActive] = await Promise.all([
      this.prisma.maintenanceSchedule.count({ where }),
      this.prisma.maintenanceSchedule.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { endDate: 'asc' },
        include: { machine: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.maintenanceSchedule.count({ where: { ...where, endDate: { lte: this.nowPlusDays(7) } } }),
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

  // ──────────────────── OVERDUE PREVENTIVE REPORT ───────────────────

  async getOverduePreventiveReport(filters: any) {
    const now = new Date();
    const where: any = { status: 'ACTIVE', endDate: { lt: now } };
    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.search) where.title = { contains: filters.search };

    const [total, rows, overdueCount, totalActive] = await Promise.all([
      this.prisma.maintenanceSchedule.count({ where }),
      this.prisma.maintenanceSchedule.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
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

  // ──────────────────────── LOW STOCK REPORT ────────────────────────

  async getLowStockReport(filters: any) {
    const where: any = { quantity: { lt: 10 } };
    if (filters.search) where.OR = [{ code: { contains: filters.search } }, { name: { contains: filters.search } }];

    const [total, rows, totalProducts, totalLowQty] = await Promise.all([
      this.prisma.machinePart.count({ where }),
      this.prisma.machinePart.findMany({
        where, ...this.paginate(filters.page, filters.pageSize),
        orderBy: { quantity: 'asc' },
      }),
      this.prisma.machinePart.count(),
      this.prisma.machinePart.aggregate({ where, _sum: { quantity: true } }),
    ]);

    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return {
      cards: [
        { label: 'lowStockItems', value: total },
        { label: 'totalProductCount', value: totalProducts },
        { label: 'totalLowStockQty', value: totalLowQty._sum.quantity || 0 },
      ],
      rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages,
    };
  }

  // ──────────────────────── EXPORT / PRINT HELPERS ──────────────────

  async exportCsv(endpoint: string, filters: any): Promise<string> {
    let data: any;
    switch (endpoint) {
      case 'maintenance/overview': data = await this.getMaintenanceOverview(filters); break;
      case 'maintenance/requests': data = await this.getMaintenanceRequestsReport(filters); break;
      case 'maintenance/downtime': data = await this.getMachineDowntimeReport(filters); break;
      case 'maintenance/costs': data = await this.getMaintenanceCostsReport(filters); break;
      case 'maintenance/schedules': data = await this.getPreventiveSchedulesReport(filters); break;
      case 'inventory/overview': data = await this.getInventoryOverview(filters); break;
      case 'inventory/balances': data = await this.getInventoryBalanceReport(filters); break;
      case 'inventory/count-variance': data = await this.getInventoryCountVarianceReport(filters); break;
      case 'inventory/movements': data = await this.getInventoryMovementsReport(filters); break;
      case 'inventory/adjustments': data = await this.getInventoryAdjustmentsReport(filters); break;
      case 'barcodes/scans': data = await this.getBarcodeScansReport(filters); break;
      case 'assets': data = await this.getAssetsRegisterReport(filters); break;
      case 'parts': data = await this.getPartsReport(filters); break;
      case 'partners': data = await this.getPartnersReport(filters); break;
      case 'attachments': data = await this.getAttachmentsReport(filters); break;
      case 'audit': data = await this.getAuditTrailReport(filters); break;
      case 'user-activity': data = await this.getUserActivityReport(filters); break;
      case 'notifications': data = await this.getNotificationsReport(filters); break;
      case 'machine-log': data = await this.getMachineLogReport(filters); break;
      case 'parts-usage': data = await this.getPartsUsageReport(filters); break;
      case 'upcoming-preventive': data = await this.getUpcomingPreventiveReport(filters); break;
      case 'overdue-preventive': data = await this.getOverduePreventiveReport(filters); break;
      case 'low-stock': data = await this.getLowStockReport(filters); break;
      default: return '';
    }
    const rows: any[] = data?.rows || [];
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
    const csv = [
      headers.join(','),
      ...rows.map((r: any) => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    return '\uFEFF' + csv;
  }

  async exportExcel(endpoint: string, filters: any): Promise<Buffer | null> {
    let data: any;
    const dispatch = async (ep: string) => {
      switch (ep) {
        case 'maintenance/overview': return await this.getMaintenanceOverview(filters);
        case 'maintenance/requests': return await this.getMaintenanceRequestsReport(filters);
        case 'maintenance/downtime': return await this.getMachineDowntimeReport(filters);
        case 'maintenance/costs': return await this.getMaintenanceCostsReport(filters);
        case 'maintenance/schedules': return await this.getPreventiveSchedulesReport(filters);
        case 'inventory/overview': return await this.getInventoryOverview(filters);
        case 'inventory/balances': return await this.getInventoryBalanceReport(filters);
        case 'inventory/count-variance': return await this.getInventoryCountVarianceReport(filters);
        case 'inventory/movements': return await this.getInventoryMovementsReport(filters);
        case 'inventory/adjustments': return await this.getInventoryAdjustmentsReport(filters);
        case 'barcodes/scans': return await this.getBarcodeScansReport(filters);
        case 'assets': return await this.getAssetsRegisterReport(filters);
        case 'parts': return await this.getPartsReport(filters);
        case 'partners': return await this.getPartnersReport(filters);
        case 'attachments': return await this.getAttachmentsReport(filters);
        case 'audit': return await this.getAuditTrailReport(filters);
        case 'user-activity': return await this.getUserActivityReport(filters);
        case 'notifications': return await this.getNotificationsReport(filters);
        case 'machine-log': return await this.getMachineLogReport(filters);
        case 'parts-usage': return await this.getPartsUsageReport(filters);
        case 'upcoming-preventive': return await this.getUpcomingPreventiveReport(filters);
        case 'overdue-preventive': return await this.getOverduePreventiveReport(filters);
        case 'low-stock': return await this.getLowStockReport(filters);
        default: return null;
      }
    };
    data = await dispatch(endpoint);
    if (!data) return null;
    const rows: any[] = data?.rows || [];
    if (!rows.length) return null;
    const headers = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');
    sheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
    rows.forEach(r => sheet.addRow(Object.fromEntries(headers.map(h => [h, r[h] ?? '']))));
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
