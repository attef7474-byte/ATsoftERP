import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
      this.prisma.inventoryBalance.findMany({ where, ...paginate(filters.page, filters.pageSize), orderBy: { updatedAt: 'desc' }, include: { product: { select: { id: true, code: true, name: true } }, warehouse: { select: { id: true, code: true, name: true } }, location: { select: { id: true, code: true, name: true } } } }),
      this.prisma.inventoryBalance.aggregate({ where, _sum: { quantity: true } }),
      this.prisma.inventoryBalance.count({ where: { ...where, quantity: { gt: 0 } } }),
      this.prisma.inventoryBalance.count({ where: { ...where, quantity: 0 } }),
      this.prisma.inventoryBalance.count({ where: { ...where, quantity: { lt: 0 } } }),
      this.prisma.warehouse.count(),
    ]);
    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return { cards: [{ label: 'totalBalanceRows', value: total }, { label: 'totalQuantity', value: totalQty._sum.quantity || 0 }, { label: 'positiveBalance', value: positiveCount }, { label: 'zeroBalance', value: zeroCount }, { label: 'negativeBalance', value: negativeCount }, { label: 'totalWarehouses', value: warehouseCount }], rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages };
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
      this.prisma.inventoryCountLine.findMany({ where, ...paginate(filters.page, filters.pageSize), orderBy: { id: 'desc' }, include: { product: { select: { id: true, code: true, name: true } }, warehouseLocation: { select: { id: true, code: true, name: true } }, count: { select: { id: true, countNumber: true, status: true } } } }),
      this.prisma.inventoryCountLine.count(), this.prisma.inventoryCountLine.count({ where: { differenceQty: { not: 0 } } }), this.prisma.inventoryCountLine.count({ where: { differenceQty: { gt: 0 } } }), this.prisma.inventoryCountLine.count({ where: { differenceQty: { lt: 0 } } }), this.prisma.inventoryCountLine.count({ where: { differenceQty: 0 } }), this.prisma.inventoryCount.count({ where: { status: 'COMPLETED' } }),
    ]);
    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return { cards: [{ label: 'totalCountLines', value: totalLines }, { label: 'varianceLines', value: varianceLines }, { label: 'positiveVariance', value: posVar }, { label: 'negativeVariance', value: negVar }, { label: 'zeroVariance', value: zeroVar }, { label: 'completedCounts', value: completedCountsCount }], rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages };
  }

  async getInventoryMovementsReport(filters: InventoryReportFilterDto) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'movementDate') };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.productId) where.lines = { some: { productId: filters.productId } };
    if (filters.movementType) where.movementType = filters.movementType;
    if (filters.direction) where.lines = { ...where.lines, some: { ...(where.lines?.some || {}), direction: filters.direction } };
    if (filters.sourceType) where.sourceType = filters.sourceType;
    if (filters.status) where.status = filters.status;
    if (filters.search) where.movementNumber = { contains: filters.search };
    const [total, rows, draftCount, postedCount, cancelledCount, totalQtyAgg] = await Promise.all([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({ where, ...paginate(filters.page, filters.pageSize), orderBy: { movementDate: 'desc' }, include: { warehouse: { select: { id: true, code: true, name: true } } } }),
      this.prisma.inventoryMovement.count({ where: { ...where, status: 'DRAFT' } }), this.prisma.inventoryMovement.count({ where: { ...where, status: 'POSTED' } }), this.prisma.inventoryMovement.count({ where: { ...where, status: 'CANCELLED' } }),
      this.prisma.inventoryMovementLine.aggregate({ where: { movement: where }, _sum: { quantity: true } }),
    ]);
    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return { cards: [{ label: 'totalMovements', value: total }, { label: 'postedMovements', value: postedCount }, { label: 'draftMovements', value: draftCount }, { label: 'cancelledMovements', value: cancelledCount }, { label: 'totalMovedQty', value: totalQtyAgg._sum.quantity || 0 }], rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages };
  }

  async getInventoryAdjustmentsReport(filters: InventoryReportFilterDto) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'adjustmentDate') };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.productId) where.lines = { some: { productId: filters.productId } };
    if (filters.status) where.status = filters.status;
    if (filters.search) where.adjustmentNumber = { contains: filters.search };
    const [total, rows, draftCount, postedCount, cancelledCount, posAdjustAgg, negAdjustAgg] = await Promise.all([
      this.prisma.inventoryAdjustment.count({ where }),
      this.prisma.inventoryAdjustment.findMany({ where, ...paginate(filters.page, filters.pageSize), orderBy: { adjustmentDate: 'desc' }, include: { warehouse: { select: { id: true, code: true, name: true } }, inventoryCount: { select: { id: true, countNumber: true } } } }),
      this.prisma.inventoryAdjustment.count({ where: { ...where, status: 'DRAFT' } }), this.prisma.inventoryAdjustment.count({ where: { ...where, status: 'POSTED' } }), this.prisma.inventoryAdjustment.count({ where: { ...where, status: 'CANCELLED' } }),
      this.prisma.inventoryAdjustmentLine.aggregate({ where: { adjustment: where, differenceQty: { gt: 0 } }, _sum: { differenceQty: true } }),
      this.prisma.inventoryAdjustmentLine.aggregate({ where: { adjustment: where, differenceQty: { lt: 0 } }, _sum: { differenceQty: true } }),
    ]);
    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return { cards: [{ label: 'totalAdjustments', value: total }, { label: 'postedAdjustments', value: postedCount }, { label: 'draftAdjustments', value: draftCount }, { label: 'cancelledAdjustments', value: cancelledCount }, { label: 'positiveAdjustments', value: posAdjustAgg._sum.differenceQty || 0 }, { label: 'negativeAdjustments', value: Math.abs(negAdjustAgg._sum.differenceQty || 0) }], rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages };
  }

  async getStockCard(filters: InventoryReportFilterDto & { direction?: string; sourceType?: string }) {
    if (!filters.productId) throw new BadRequestException('productId is required for stock card');
    const where: any = { lines: { some: { productId: filters.productId } }, status: 'POSTED' };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.locationId) where.lines = { some: { ...where.lines.some, warehouseLocationId: filters.locationId } };
    const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo, 'movementDate');
    const beforeDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const allMovements = await this.prisma.inventoryMovement.findMany({
      where: { ...where, ...(dateFilter.movementDate ? { movementDate: dateFilter.movementDate } : {}) },
      orderBy: { movementDate: 'asc' },
      include: { lines: { where: { productId: filters.productId }, include: { product: { select: { id: true, code: true, name: true, unit: true } } } }, warehouse: { select: { id: true, code: true, name: true } } },
    });
    let openingQty = 0;
    if (beforeDate) {
      const openingWhere: any = { lines: { some: { productId: filters.productId } }, status: 'POSTED', movementDate: { lt: beforeDate } };
      if (filters.warehouseId) openingWhere.warehouseId = filters.warehouseId;
      const openingInAgg = await this.prisma.inventoryMovementLine.aggregate({
        where: { movement: openingWhere, direction: 'IN', productId: filters.productId },
        _sum: { quantity: true },
      });
      const openingOutAgg = await this.prisma.inventoryMovementLine.aggregate({
        where: { movement: openingWhere, direction: 'OUT', productId: filters.productId },
        _sum: { quantity: true },
      });
      openingQty = (openingInAgg._sum.quantity || 0) - (openingOutAgg._sum.quantity || 0);
    }
    let runningBalance = openingQty;
    const rows = [];
    for (const mv of allMovements) {
      for (const line of mv.lines) {
        if (line.direction === 'IN') runningBalance += line.quantity;
        else runningBalance -= line.quantity;
        rows.push({
          id: mv.id,
          movementDate: mv.movementDate,
          movementNumber: mv.movementNumber,
          movementType: mv.movementType,
          direction: line.direction,
          quantity: line.quantity,
          unit: line.product?.unit,
          productId: line.productId,
          warehouseId: mv.warehouseId,
          sourceType: mv.sourceType,
          sourceId: mv.sourceId,
          runningBalance,
        });
      }
    }
    const currentBal = await this.prisma.inventoryBalance.findFirst({
      where: { productId: filters.productId, ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}) },
      select: { quantity: true },
    });
    return { openingBalance: openingQty, closingBalance: currentBal?.quantity || runningBalance, rows, total: rows.length, productId: filters.productId };
  }

  async getMovementTypes(filters: InventoryReportFilterDto) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'movementDate') };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    const movements = await this.prisma.inventoryMovement.groupBy({
      by: ['movementType'], where, _count: true,
    });
    const types = [];
    for (const m of movements) {
      const inAgg = await this.prisma.inventoryMovementLine.aggregate({
        where: { movement: { movementType: m.movementType, ...where }, direction: 'IN' },
        _sum: { quantity: true },
      });
      const outAgg = await this.prisma.inventoryMovementLine.aggregate({
        where: { movement: { movementType: m.movementType, ...where }, direction: 'OUT' },
        _sum: { quantity: true },
      });
      types.push({ movementType: m.movementType, count: m._count, totalIn: inAgg._sum.quantity || 0, totalOut: outAgg._sum.quantity || 0, net: (inAgg._sum.quantity || 0) - (outAgg._sum.quantity || 0) });
    }
    const totalCount = types.reduce((s, t) => s + t.count, 0);
    const totalIn = types.reduce((s, t) => s + t.totalIn, 0);
    const totalOut = types.reduce((s, t) => s + t.totalOut, 0);
    return { cards: [{ label: 'totalMovementTypes', value: types.length }, { label: 'totalMovements', value: totalCount }, { label: 'totalInQty', value: totalIn }, { label: 'totalOutQty', value: totalOut }], types };
  }

  async getByWarehouseSummary(filters: InventoryReportFilterDto) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'movementDate'), status: 'POSTED' };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    const warehouses = await this.prisma.inventoryMovement.groupBy({
      by: ['warehouseId'], where, _count: true,
    });
    const rows = [];
    for (const w of warehouses) {
      const wWhere = { ...where, warehouseId: w.warehouseId };
      const inAgg = await this.prisma.inventoryMovementLine.aggregate({ where: { movement: wWhere, direction: 'IN' }, _sum: { quantity: true } });
      const outAgg = await this.prisma.inventoryMovementLine.aggregate({ where: { movement: wWhere, direction: 'OUT' }, _sum: { quantity: true } });
      const wh = await this.prisma.warehouse.findUnique({ where: { id: w.warehouseId }, select: { id: true, code: true, name: true } });
      rows.push({ warehouseId: w.warehouseId, warehouse: wh, movementCount: w._count, totalIn: inAgg._sum.quantity || 0, totalOut: outAgg._sum.quantity || 0, net: (inAgg._sum.quantity || 0) - (outAgg._sum.quantity || 0) });
    }
    return { rows, total: rows.length };
  }

  async getByLocationSummary(filters: InventoryReportFilterDto) {
    const movements = await this.prisma.inventoryMovementLine.groupBy({
      by: ['warehouseLocationId'], where: { movement: { status: 'POSTED', ...buildDateFilter(filters.dateFrom, filters.dateTo, 'movementDate') }, ...(filters.warehouseId ? { movement: { warehouseId: filters.warehouseId } } : {}) },
      _count: true, _sum: { quantity: true },
    });
    const rows = [];
    for (const m of movements) {
      if (!m.warehouseLocationId) continue;
      const loc = await this.prisma.warehouseLocation.findUnique({ where: { id: m.warehouseLocationId }, select: { id: true, code: true, name: true, warehouseId: true } });
      rows.push({ warehouseLocationId: m.warehouseLocationId, location: loc, movementCount: m._count, totalQuantity: m._sum.quantity || 0 });
    }
    return { rows, total: rows.length };
  }

  async getByProduct(productId: string, filters: InventoryReportFilterDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, code: true, name: true, unit: true } });
    if (!product) throw new NotFoundException('Product not found');
    const where: any = { lines: { some: { productId } }, status: 'POSTED', ...buildDateFilter(filters.dateFrom, filters.dateTo, 'movementDate') };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    const [movements, balance] = await Promise.all([
      this.prisma.inventoryMovement.findMany({ where, orderBy: { movementDate: 'desc' }, ...paginate(filters.page, filters.pageSize), include: { warehouse: { select: { id: true, code: true, name: true } } } }),
      this.prisma.inventoryBalance.findFirst({ where: { productId, ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}) }, select: { quantity: true } }),
    ]);
    const total = await this.prisma.inventoryMovement.count({ where });
    const inAgg = await this.prisma.inventoryMovementLine.aggregate({ where: { movement: where, direction: 'IN', productId }, _sum: { quantity: true } });
    const outAgg = await this.prisma.inventoryMovementLine.aggregate({ where: { movement: where, direction: 'OUT', productId }, _sum: { quantity: true } });
    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return { product, currentBalance: balance?.quantity || 0, totalIn: inAgg._sum.quantity || 0, totalOut: outAgg._sum.quantity || 0, rows: movements, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages };
  }

  async getBySource(sourceType: string, sourceId: string) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { sourceType, sourceId },
      orderBy: { movementDate: 'desc' },
      include: { lines: { include: { product: { select: { id: true, code: true, name: true } } } }, warehouse: { select: { id: true, code: true, name: true } } },
    });
    const sourceDoc = await this.resolveSourceDocument(sourceType, sourceId);
    return { sourceType, sourceId, sourceDocument: sourceDoc, movements, total: movements.length };
  }

  async getMovementTraceability(id: string) {
    const movement = await this.prisma.inventoryMovement.findUnique({
      where: { id }, include: { lines: { include: { product: { select: { id: true, code: true, name: true } } } }, warehouse: { select: { id: true, code: true, name: true } } },
    });
    if (!movement) throw new NotFoundException('Movement not found');
    let sourceDocument = null;
    if (movement.sourceType && movement.sourceId) {
      sourceDocument = await this.resolveSourceDocument(movement.sourceType, movement.sourceId);
    }
    return { ...movement, sourceDocument, traceResolved: !!sourceDocument || !movement.sourceType };
  }

  async getExceptions(filters: InventoryReportFilterDto) {
    const where: any = { ...buildDateFilter(filters.dateFrom, filters.dateTo, 'movementDate') };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    const [noSourceMovements, negativeBalances, orphanMovements, reconciliationDiffCount] = await Promise.all([
      this.prisma.inventoryMovement.findMany({ where: { ...where, sourceType: null, sourceId: null }, orderBy: { movementDate: 'desc' }, include: { warehouse: { select: { id: true, code: true, name: true } } }, take: 100 }),
      this.prisma.inventoryBalance.count({ where: { quantity: { lt: 0 } } }),
      this.prisma.inventoryMovement.findMany({ where: { ...where, OR: [{ sourceType: null }, { sourceId: null }] }, select: { id: true, movementNumber: true, sourceType: true, sourceId: true }, take: 100 }),
      this.getReconciliationDifferenceCount(),
    ]);
    return { exceptions: { noSourceMovements: noSourceMovements.length, negativeBalances, orphanMovements: orphanMovements.length, reconciliationDifferences: reconciliationDiffCount }, noSourceMovements, orphanMovements, negativeBalanceCount: negativeBalances, reconciliationDifferenceCount: reconciliationDiffCount };
  }

  async getTopMovingItems(filters: InventoryReportFilterDto) {
    const where: any = { movement: { status: 'POSTED', ...buildDateFilter(filters.dateFrom, filters.dateTo, 'movementDate') } };
    if (filters.warehouseId) where.movement.warehouseId = filters.warehouseId;
    const top = await this.prisma.inventoryMovementLine.groupBy({
      by: ['productId'], where, _sum: { quantity: true }, _count: true, orderBy: { _sum: { quantity: 'desc' } }, take: 20,
    });
    const rows = [];
    for (const t of top) {
      const product = await this.prisma.product.findUnique({ where: { id: t.productId }, select: { id: true, code: true, name: true } });
      rows.push({ productId: t.productId, product, totalQuantity: t._sum.quantity || 0, movementCount: t._count });
    }
    return { rows, total: rows.length };
  }

  async getDashboardCards() {
    const [totalProducts, totalWarehouses, totalBalanceQty, postedMovements, totalInQty, totalOutQty, negativeBalanceCount, movementTypeCount] = await Promise.all([
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.warehouse.count({ where: { status: 'ACTIVE' } }),
      this.prisma.inventoryBalance.aggregate({ _sum: { quantity: true } }),
      this.prisma.inventoryMovement.count({ where: { status: 'POSTED' } }),
      this.prisma.inventoryMovementLine.aggregate({ where: { direction: 'IN', movement: { status: 'POSTED' } }, _sum: { quantity: true } }),
      this.prisma.inventoryMovementLine.aggregate({ where: { direction: 'OUT', movement: { status: 'POSTED' } }, _sum: { quantity: true } }),
      this.prisma.inventoryBalance.count({ where: { quantity: { lt: 0 } } }),
      (await this.prisma.inventoryMovement.groupBy({ by: ['movementType'], where: { status: 'POSTED' }, _count: true })).length,
    ]);
    const reconciliationDiffCount = await this.getReconciliationDifferenceCount();
    return { cards: [{ label: 'totalProducts', value: totalProducts }, { label: 'totalWarehouses', value: totalWarehouses }, { label: 'totalStockQty', value: totalBalanceQty._sum.quantity || 0 }, { label: 'postedMovements', value: postedMovements }, { label: 'totalInQty', value: totalInQty._sum.quantity || 0 }, { label: 'totalOutQty', value: totalOutQty._sum.quantity || 0 }, { label: 'negativeBalances', value: negativeBalanceCount }, { label: 'movementTypes', value: movementTypeCount }, { label: 'reconciliationDifferences', value: reconciliationDiffCount }] };
  }

  async getNegativeBalances(filters: InventoryReportFilterDto) {
    const where: any = { quantity: { lt: 0 } };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.productId) where.productId = filters.productId;
    const [total, rows] = await Promise.all([
      this.prisma.inventoryBalance.count({ where }),
      this.prisma.inventoryBalance.findMany({ where, ...paginate(filters.page, filters.pageSize), orderBy: { quantity: 'asc' }, include: { product: { select: { id: true, code: true, name: true } }, warehouse: { select: { id: true, code: true, name: true } } } }),
    ]);
    const totalPages = Math.ceil(total / (filters.pageSize || 20));
    return { rows, total, page: filters.page || 1, pageSize: filters.pageSize || 20, totalPages };
  }

  async getReconciliationDifferences(filters: InventoryReportFilterDto) {
    const differences = await this.prisma.inventoryBalance.findMany({
      where: { ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}), ...(filters.productId ? { productId: filters.productId } : {}) },
      select: { id: true, productId: true, warehouseId: true, quantity: true, product: { select: { id: true, code: true, name: true } }, warehouse: { select: { id: true, code: true, name: true } } },
    });
    const rows = [];
    for (const bal of differences) {
      const expectedIn = await this.prisma.inventoryMovementLine.aggregate({ where: { movement: { status: 'POSTED', warehouseId: bal.warehouseId }, direction: 'IN', productId: bal.productId }, _sum: { quantity: true } });
      const expectedOut = await this.prisma.inventoryMovementLine.aggregate({ where: { movement: { status: 'POSTED', warehouseId: bal.warehouseId }, direction: 'OUT', productId: bal.productId }, _sum: { quantity: true } });
      const expected = (expectedIn._sum.quantity || 0) - (expectedOut._sum.quantity || 0);
      const diff = bal.quantity - expected;
      if (diff !== 0) rows.push({ productId: bal.productId, product: bal.product, warehouseId: bal.warehouseId, warehouse: bal.warehouse, currentBalance: bal.quantity, expectedBalance: expected, difference: diff });
    }
    return { rows, total: rows.length };
  }

  private async getReconciliationDifferenceCount(): Promise<number> {
    const balances = await this.prisma.inventoryBalance.findMany({ select: { id: true, productId: true, warehouseId: true, quantity: true } });
    let diffCount = 0;
    for (const bal of balances) {
      const inAgg = await this.prisma.inventoryMovementLine.aggregate({ where: { movement: { status: 'POSTED', warehouseId: bal.warehouseId }, direction: 'IN', productId: bal.productId }, _sum: { quantity: true } });
      const outAgg = await this.prisma.inventoryMovementLine.aggregate({ where: { movement: { status: 'POSTED', warehouseId: bal.warehouseId }, direction: 'OUT', productId: bal.productId }, _sum: { quantity: true } });
      const expected = (inAgg._sum.quantity || 0) - (outAgg._sum.quantity || 0);
      if (bal.quantity !== expected) diffCount++;
    }
    return diffCount;
  }

  private async resolveSourceDocument(sourceType: string, sourceId: string): Promise<any> {
    try {
      switch (sourceType) {
        case 'OPENING_BALANCE': {
          const doc = await this.prisma.inventoryOpeningBalance.findUnique({ where: { id: sourceId }, select: { id: true, code: true, status: true, createdAt: true } });
          return doc ? { ...doc, documentType: 'OPENING_BALANCE', route: '/admin/inventory/opening-balances' } : null;
        }
        case 'STOCK_ADJUSTMENT_IN':
        case 'STOCK_ADJUSTMENT_OUT': {
          const doc = await this.prisma.inventoryStockAdjustment.findUnique({ where: { id: sourceId }, select: { id: true, code: true, status: true, createdAt: true } });
          return doc ? { ...doc, documentType: sourceType, route: '/admin/inventory/stock-adjustments' } : null;
        }
        case 'STOCK_TRANSFER_IN':
        case 'STOCK_TRANSFER_OUT': {
          const doc = await this.prisma.inventoryStockTransfer.findUnique({ where: { id: sourceId }, select: { id: true, code: true, status: true, createdAt: true } });
          return doc ? { ...doc, documentType: sourceType, route: '/admin/inventory/transfers' } : null;
        }
        case 'STOCK_RECEIVING': {
          const doc = await this.prisma.inventoryOperationalReceipt.findUnique({ where: { id: sourceId }, select: { id: true, code: true, status: true, createdAt: true } });
          return doc ? { ...doc, documentType: 'STOCK_RECEIVING', route: '/admin/inventory/operational-receipts' } : null;
        }
        case 'COUNT_VARIANCE_IN':
        case 'COUNT_VARIANCE_OUT': {
          const doc = await this.prisma.inventoryPhysicalCount.findUnique({ where: { id: sourceId }, select: { id: true, countNumber: true, status: true, createdAt: true } });
          return doc ? { ...doc, documentType: sourceType, route: '/admin/inventory/physical-counts', code: doc.countNumber } : null;
        }
        case 'MAINTENANCE_ISSUE':
        case 'MAINTENANCE_RETURN': {
          const doc = await this.prisma.maintenanceRequest.findUnique({ where: { id: sourceId }, select: { id: true, requestNumber: true, status: true, createdAt: true } });
          return doc ? { ...doc, documentType: sourceType, route: '/admin/maintenance/requests', code: doc.requestNumber } : null;
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}
