import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InventoryReportFilterDto } from '../dto/report-filter.dto';
import { buildDateFilter, paginate } from './report-query-utils';

@Injectable()
export class InventoryReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
        where, ...paginate(filters.page, filters.pageSize),
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
        where, ...paginate(filters.page, filters.pageSize),
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

  async getInventoryMovementsReport(filters: InventoryReportFilterDto) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'movementDate') };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.productId) where.lines = { some: { productId: filters.productId } };
    if (filters.movementType) where.movementType = filters.movementType;
    if (filters.countStatus) where.status = filters.countStatus;
    if (filters.search) where.movementNumber = { contains: filters.search };

    const [total, rows, draftCount, postedCount, cancelledCount, totalQtyAgg] = await Promise.all([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where, ...paginate(filters.page, filters.pageSize),
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

  async getInventoryAdjustmentsReport(filters: InventoryReportFilterDto) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'adjustmentDate') };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.productId) where.lines = { some: { productId: filters.productId } };
    if (filters.countStatus) where.status = filters.countStatus;
    if (filters.search) where.adjustmentNumber = { contains: filters.search };

    const [total, rows, draftCount, postedCount, cancelledCount, posAdjustAgg, negAdjustAgg] = await Promise.all([
      this.prisma.inventoryAdjustment.count({ where }),
      this.prisma.inventoryAdjustment.findMany({
        where, ...paginate(filters.page, filters.pageSize),
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
}
