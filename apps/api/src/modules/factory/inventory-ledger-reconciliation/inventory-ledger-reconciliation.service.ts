import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

type PagingQuery = { page?: number; limit?: number };

@Injectable()
export class InventoryLedgerReconciliationService {
  constructor(private prisma: PrismaService) {}

  private branchScope(ctx: ActiveOperationalContext) {
    return {
      OR: [{ branchId: null }, { branchId: ctx.branchId }],
    };
  }

  private warehouseScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      deletedAt: null,
      AND: [this.branchScope(ctx)],
    };
  }

  private movementScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      deletedAt: null,
      warehouse: this.warehouseScope(ctx),
      AND: [this.branchScope(ctx)],
    };
  }

  private balanceScope(ctx: ActiveOperationalContext) {
    return {
      warehouse: this.warehouseScope(ctx),
      AND: [
        {
          OR: [
            { locationId: null },
            { location: { warehouse: this.warehouseScope(ctx) } },
          ],
        },
      ],
    };
  }

  private movementLineLocationScope(ctx: ActiveOperationalContext) {
    return {
      OR: [
        { warehouseLocationId: null },
        {
          warehouseLocation: {
            warehouse: this.warehouseScope(ctx),
          },
        },
      ],
    };
  }

  private paging(query: PagingQuery) {
    const requestedPage = Number(query.page);
    const requestedLimit = Number(query.limit);
    const page = Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), 100)
      : 20;
    return { page, limit, skip: (page - 1) * limit };
  }

  private async requireWarehouse(
    warehouseId: string,
    ctx: ActiveOperationalContext,
  ) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, ...this.warehouseScope(ctx) },
      select: { id: true },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  private async requireLocation(
    locationId: string,
    ctx: ActiveOperationalContext,
    expectedWarehouseId?: string,
  ) {
    const location = await this.prisma.warehouseLocation.findFirst({
      where: {
        id: locationId,
        warehouse: this.warehouseScope(ctx),
      },
      select: { id: true, warehouseId: true },
    });
    if (!location) throw new NotFoundException('Warehouse location not found');
    if (
      expectedWarehouseId &&
      location.warehouseId !== expectedWarehouseId
    ) {
      throw new BadRequestException(
        'Warehouse location does not belong to the requested warehouse',
      );
    }
    return location;
  }

  // ── Ledger ──────────────────────────────────────────────────────

  async findAllLedgerMovements(
    query: {
      page?: number;
      limit?: number;
      search?: string;
      companyId?: string;
      branchId?: string;
      warehouseId?: string;
      movementType?: string;
      status?: string;
      direction?: string;
      productId?: string;
      sourceType?: string;
      sourceId?: string;
      locationId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    ctx: ActiveOperationalContext,
  ) {
    const { page, limit, skip } = this.paging(query);
    const where: any = { ...this.movementScope(ctx) };
    const additionalAnd: any[] = [...where.AND];

    if (query.search) {
      additionalAnd.push({
        OR: [
          { movementNumber: { contains: query.search } },
          { notes: { contains: query.search } },
        ],
      });
    }
    where.AND = additionalAnd;

    let requestedWarehouseId = query.warehouseId;
    if (requestedWarehouseId) {
      await this.requireWarehouse(requestedWarehouseId, ctx);
    }
    if (query.locationId) {
      const location = await this.requireLocation(
        query.locationId,
        ctx,
        requestedWarehouseId,
      );
      requestedWarehouseId = requestedWarehouseId || location.warehouseId;
    }
    if (requestedWarehouseId) where.warehouseId = requestedWarehouseId;
    if (query.movementType) where.movementType = query.movementType;
    if (query.status) where.status = query.status;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.sourceId) where.sourceId = query.sourceId;

    const lineSome: any = {};
    if (query.productId) lineSome.productId = query.productId;
    if (query.locationId) {
      lineSome.warehouseLocationId = query.locationId;
    }
    if (query.direction) lineSome.direction = query.direction;
    if (Object.keys(lineSome).length > 0) where.lines = { some: lineSome };

    if (query.dateFrom || query.dateTo) {
      where.movementDate = {};
      if (query.dateFrom) where.movementDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.movementDate.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { movementDate: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          company: { select: { id: true, name: true } },
          lines: {
            include: {
              product: {
                select: { id: true, code: true, name: true, unit: true },
              },
            },
          },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findLedgerMovement(id: string, ctx: ActiveOperationalContext) {
    const movement = await this.prisma.inventoryMovement.findFirst({
      where: { id, ...this.movementScope(ctx) },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        company: { select: { id: true, name: true } },
        lines: {
          where: this.movementLineLocationScope(ctx),
          include: {
            product: {
              select: { id: true, code: true, name: true, unit: true },
            },
            warehouseLocation: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });
    if (!movement) throw new NotFoundException('Movement not found');
    return movement;
  }

  async findByProduct(
    productId: string,
    query: PagingQuery,
    ctx: ActiveOperationalContext,
  ) {
    const { page, limit, skip } = this.paging(query);
    const where = {
      ...this.movementScope(ctx),
      lines: { some: { productId } },
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { movementDate: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: {
            where: { productId },
            include: {
              product: {
                select: { id: true, code: true, name: true, unit: true },
              },
            },
          },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByWarehouse(
    warehouseId: string,
    query: PagingQuery,
    ctx: ActiveOperationalContext,
  ) {
    await this.requireWarehouse(warehouseId, ctx);
    const { page, limit, skip } = this.paging(query);
    const where = { ...this.movementScope(ctx), warehouseId };

    const [data, total, typeGroups, statusGroups, quantityGroups] =
      await Promise.all([
        this.prisma.inventoryMovement.findMany({
          where,
          skip,
          take: limit,
          orderBy: { movementDate: 'desc' },
          include: {
            lines: {
              include: {
                product: {
                  select: { id: true, code: true, name: true, unit: true },
                },
              },
            },
          },
        }),
        this.prisma.inventoryMovement.count({ where }),
        this.prisma.inventoryMovement.groupBy({
          by: ['movementType'],
          where,
          _count: { _all: true },
        }),
        this.prisma.inventoryMovement.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.inventoryMovementLine.groupBy({
          by: ['direction'],
          where: { movement: where },
          _sum: { quantity: true },
        }),
      ]);

    const byType: Record<string, number> = {};
    for (const row of typeGroups as any[]) {
      byType[row.movementType] = row._count._all;
    }
    const byStatus: Record<string, number> = {};
    for (const row of statusGroups as any[]) {
      byStatus[row.status] = row._count._all;
    }
    let totalInQty = 0;
    let totalOutQty = 0;
    for (const row of quantityGroups as any[]) {
      if (row.direction === 'IN') totalInQty = row._sum.quantity || 0;
      if (row.direction === 'OUT') totalOutQty = row._sum.quantity || 0;
    }

    return {
      data,
      summary: { totalMovements: total, totalInQty, totalOutQty, byType, byStatus },
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByLocation(
    locationId: string,
    ctx: ActiveOperationalContext,
  ) {
    const location = await this.requireLocation(locationId, ctx);
    const where = {
      ...this.movementScope(ctx),
      warehouseId: location.warehouseId,
      lines: { some: { warehouseLocationId: locationId } },
    };
    const movements = await this.prisma.inventoryMovement.findMany({
      where,
      orderBy: { movementDate: 'desc' },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          where: { warehouseLocationId: locationId },
          include: {
            product: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
        },
      },
    });
    return { data: movements, total: movements.length };
  }

  async findBySource(
    sourceType: string,
    sourceId: string,
    ctx: ActiveOperationalContext,
  ) {
    const where = {
      ...this.movementScope(ctx),
      sourceType,
      sourceId,
    };
    const movements = await this.prisma.inventoryMovement.findMany({
      where,
      orderBy: { movementDate: 'desc' },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            product: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
        },
      },
    });
    return { data: movements, total: movements.length };
  }

  // ── Reconciliation ──────────────────────────────────────────────

  private async computeExpectedBalance(
    productId: string,
    warehouseId: string,
    locationId: string | null | undefined,
    ctx: ActiveOperationalContext,
  ) {
    const lineWhere: any = {
      productId,
      warehouseLocationId: locationId || null,
      movement: {
        ...this.movementScope(ctx),
        status: 'POSTED',
        warehouseId,
      },
    };
    const [inSum, outSum] = await Promise.all([
      this.prisma.inventoryMovementLine.aggregate({
        where: { ...lineWhere, direction: 'IN' },
        _sum: { quantity: true },
      }),
      this.prisma.inventoryMovementLine.aggregate({
        where: { ...lineWhere, direction: 'OUT' },
        _sum: { quantity: true },
      }),
    ]);
    return (inSum._sum.quantity || 0) - (outSum._sum.quantity || 0);
  }

  private async buildReconciliationLines(
    where: any,
    ctx: ActiveOperationalContext,
  ) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where,
      include: {
        product: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });
    const lines: any[] = [];
    for (const balance of balances) {
      const expectedBalance = await this.computeExpectedBalance(
        balance.productId,
        balance.warehouseId,
        balance.locationId,
        ctx,
      );
      const difference = balance.quantity - expectedBalance;
      const status = balance.quantity < 0
        ? 'NEGATIVE_BALANCE'
        : difference === 0
          ? 'MATCHED'
          : 'DIFFERENCE';
      lines.push({
        productId: balance.productId,
        productName: balance.product?.name,
        productCode: balance.product?.code,
        warehouseId: balance.warehouseId,
        warehouseName: balance.warehouse?.name,
        locationId: balance.locationId,
        currentBalance: balance.quantity,
        expectedBalance,
        difference,
        status,
      });
    }
    return lines;
  }

  async reconciliationSummary(ctx: ActiveOperationalContext) {
    const lines = await this.buildReconciliationLines(
      this.balanceScope(ctx),
      ctx,
    );
    let matched = 0;
    let differences = 0;
    let negativeBalances = 0;
    let totalCurrentQty = 0;
    let totalExpectedQty = 0;

    for (const line of lines) {
      if (line.status === 'MATCHED') matched += 1;
      else if (line.status === 'NEGATIVE_BALANCE') negativeBalances += 1;
      else differences += 1;
      totalCurrentQty += line.currentBalance;
      totalExpectedQty += line.expectedBalance;
    }

    const totalMovements = await this.prisma.inventoryMovement.count({
      where: { ...this.movementScope(ctx), status: 'POSTED' },
    });
    return {
      summary: {
        totalBalances: lines.length,
        totalMovements,
        matched,
        differences,
        negativeBalances,
        totalCurrentQty,
        totalExpectedQty,
        totalDifference: totalCurrentQty - totalExpectedQty,
      },
      detail: lines,
    };
  }

  async reconciliationDetails(
    query: PagingQuery & {
      status?: string;
      warehouseId?: string;
      productId?: string;
    },
    ctx: ActiveOperationalContext,
  ) {
    if (query.warehouseId) {
      await this.requireWarehouse(query.warehouseId, ctx);
    }
    const where: any = { ...this.balanceScope(ctx) };
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.productId) where.productId = query.productId;

    let lines = await this.buildReconciliationLines(where, ctx);
    if (query.status) {
      lines = lines.filter((line) => line.status === query.status);
    }
    const { page, limit, skip } = this.paging(query);
    const total = lines.length;
    return {
      data: lines.slice(skip, skip + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async reconciliationByProduct(
    productId: string,
    ctx: ActiveOperationalContext,
  ) {
    const lines = await this.buildReconciliationLines(
      { ...this.balanceScope(ctx), productId },
      ctx,
    );
    const totalCurrent = lines.reduce(
      (sum, line) => sum + line.currentBalance,
      0,
    );
    const totalExpected = lines.reduce(
      (sum, line) => sum + line.expectedBalance,
      0,
    );
    return {
      productId,
      productName: lines[0]?.productName,
      warehouses: lines.map((line) => ({
        warehouseId: line.warehouseId,
        warehouseName: line.warehouseName,
        locationId: line.locationId,
        currentBalance: line.currentBalance,
        expectedBalance: line.expectedBalance,
        difference: line.difference,
        status: line.status,
      })),
      totalCurrentBalance: totalCurrent,
      totalExpectedBalance: totalExpected,
      totalDifference: totalCurrent - totalExpected,
    };
  }

  async reconciliationByWarehouse(
    warehouseId: string,
    ctx: ActiveOperationalContext,
  ) {
    await this.requireWarehouse(warehouseId, ctx);
    const lines = await this.buildReconciliationLines(
      { ...this.balanceScope(ctx), warehouseId },
      ctx,
    );
    const totalCurrent = lines.reduce(
      (sum, line) => sum + line.currentBalance,
      0,
    );
    const totalExpected = lines.reduce(
      (sum, line) => sum + line.expectedBalance,
      0,
    );
    return {
      warehouseId,
      products: lines.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        locationId: line.locationId,
        currentBalance: line.currentBalance,
        expectedBalance: line.expectedBalance,
        difference: line.difference,
        status: line.status,
      })),
      totalCurrentBalance: totalCurrent,
      totalExpectedBalance: totalExpected,
      totalDifference: totalCurrent - totalExpected,
    };
  }

  async reconciliationDifferences(
    query: PagingQuery & { warehouseId?: string },
    ctx: ActiveOperationalContext,
  ) {
    if (query.warehouseId) {
      await this.requireWarehouse(query.warehouseId, ctx);
    }
    const where: any = { ...this.balanceScope(ctx) };
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    const lines = await this.buildReconciliationLines(where, ctx);
    const differences = lines.filter((line) => line.status !== 'MATCHED');
    const { page, limit, skip } = this.paging(query);
    return {
      data: differences.slice(skip, skip + limit),
      meta: {
        page,
        limit,
        total: differences.length,
        totalPages: Math.ceil(differences.length / limit),
      },
    };
  }

  async reconciliationOrphans(ctx: ActiveOperationalContext) {
    const balanceScope = this.balanceScope(ctx);
    const movementScope = this.movementScope(ctx);
    const balanceProductWarehouses =
      await this.prisma.inventoryBalance.findMany({
        where: balanceScope,
        select: { productId: true, warehouseId: true },
        distinct: ['productId', 'warehouseId'],
      });

    const orphanBalances: any[] = [];
    for (const pair of balanceProductWarehouses) {
      const movementCount = await this.prisma.inventoryMovement.count({
        where: {
          ...movementScope,
          status: 'POSTED',
          warehouseId: pair.warehouseId,
          lines: { some: { productId: pair.productId } },
        },
      });
      if (movementCount !== 0) continue;

      const balance = await this.prisma.inventoryBalance.findFirst({
        where: {
          ...balanceScope,
          productId: pair.productId,
          warehouseId: pair.warehouseId,
        },
        include: {
          product: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
      });
      if (balance && balance.quantity !== 0) {
        orphanBalances.push({
          productId: pair.productId,
          productName: balance.product?.name,
          warehouseId: pair.warehouseId,
          warehouseName: balance.warehouse?.name,
          currentBalance: balance.quantity,
          status: 'ORPHAN_BALANCE',
        });
      }
    }

    const movementProductWarehouses =
      await this.prisma.inventoryMovement.findMany({
        where: { ...movementScope, status: 'POSTED' },
        select: {
          warehouseId: true,
          lines: { select: { productId: true } },
        },
      });
    const movementPairs = new Set<string>();
    for (const movement of movementProductWarehouses) {
      for (const line of movement.lines) {
        movementPairs.add(`${movement.warehouseId}:${line.productId}`);
      }
    }

    const orphanMovements: any[] = [];
    for (const pair of movementPairs) {
      const [warehouseId, productId] = pair.split(':');
      const balance = await this.prisma.inventoryBalance.findFirst({
        where: { ...balanceScope, warehouseId, productId },
        select: { id: true },
      });
      if (!balance) {
        orphanMovements.push({
          warehouseId,
          productId,
          status: 'ORPHAN_MOVEMENT',
        });
      }
    }

    return {
      orphanBalances,
      orphanMovements,
      totalOrphanBalances: orphanBalances.length,
      totalOrphanMovements: orphanMovements.length,
    };
  }

  async reconciliationNegativeBalances(ctx: ActiveOperationalContext) {
    const lines = await this.buildReconciliationLines(
      { ...this.balanceScope(ctx), quantity: { lt: 0 } },
      ctx,
    );
    lines.sort((left, right) => left.currentBalance - right.currentBalance);
    return {
      data: lines.map((line) => ({ ...line, status: 'NEGATIVE_BALANCE' })),
      total: lines.length,
    };
  }
}
