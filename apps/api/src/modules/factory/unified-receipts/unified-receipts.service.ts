import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { getUserPermissionSnapshot, UserPermissionSnapshot } from '../../../common/permissions/assert-user-permissions';
import { InventoryOperationalReceiptsService } from '../inventory-operational-receipts/inventory-operational-receipts.service';
import { ProductionFinishedGoodsReceiptsService } from '../production-finished-goods-receipts/production-finished-goods-receipts.service';
import {
  isOperationalReceiptType,
  RECEIPT_TYPES,
  RECEIPT_TYPE_TO_ITEM_TYPE,
  ReceiptType,
} from '../inventory-operational-receipts/receipt-type.domain';
import { UNIFIED_RECEIPT_READ_PERMISSIONS } from './unified-receipt-permissions';
import { UnifiedReceiptQueryDto } from './dto/unified-receipt-query.dto';

type ReceiptAuthority = 'OPERATIONAL' | 'PRODUCTION_FG';

interface ReceiptAccess {
  operational: boolean;
  productionFinishedGoods: boolean;
  snapshot: UserPermissionSnapshot;
}

const READ_KEYS = UNIFIED_RECEIPT_READ_PERMISSIONS;

const NATIVE_ACTION_KEYS = {
  operational: {
    create: 'inventory:operational-receipt:create',
    update: 'inventory:operational-receipt:update',
    submit: 'inventory:operational-receipt:submit',
    approve: 'inventory:operational-receipt:approve',
    reject: 'inventory:operational-receipt:reject',
    post: 'inventory:operational-receipt:post',
    cancel: 'inventory:operational-receipt:cancel',
    deleteDraft: 'inventory:operational-receipt:delete-draft',
  },
  finishedGoods: {
    create: 'production-finished-goods-receipt:create',
    update: 'production-finished-goods-receipt:update',
    post: 'production-finished-goods-receipt:post',
    cancel: 'production-finished-goods-receipt:cancel',
    reverse: 'production-finished-goods-receipt:reverse',
  },
} as const;

/**
 * Read-only orchestration over the two authoritative receipt engines.
 *
 * No stock write, number generation, valuation or persistence lives here. This
 * service only normalizes rows for the single "إذن استلام" screen; every write
 * still goes to InventoryOperationalReceiptsService or
 * ProductionFinishedGoodsReceiptsService with its own permission and lifecycle.
 */
@Injectable()
export class UnifiedReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalService: InventoryOperationalReceiptsService,
    private readonly finishedGoodsService: ProductionFinishedGoodsReceiptsService,
  ) {}

  private forbidden(): ForbiddenException {
    return new ForbiddenException({
      messageKey: 'auth.insufficientPermissions',
      message: 'Insufficient permissions',
    });
  }

  private async resolveAccess(userId: string | undefined): Promise<ReceiptAccess> {
    const snapshot = await getUserPermissionSnapshot(this.prisma, userId);
    const operational = snapshot.isSuperAdmin || snapshot.permissions.has(READ_KEYS.operational);
    const productionFinishedGoods =
      snapshot.isSuperAdmin || snapshot.permissions.has(READ_KEYS.productionFinishedGoods);
    if (!operational && !productionFinishedGoods) throw this.forbidden();
    return { operational, productionFinishedGoods, snapshot };
  }

  private has(access: ReceiptAccess, permission: string): boolean {
    return access.snapshot.isSuperAdmin || access.snapshot.permissions.has(permission);
  }

  async capabilities(userId: string | undefined) {
    const access = await this.resolveAccess(userId);
    return {
      canRead: {
        operational: access.operational,
        productionFinishedGoods: access.productionFinishedGoods,
      },
      canWrite: {
        operational: Object.fromEntries(
          Object.entries(NATIVE_ACTION_KEYS.operational).map(([action, key]) => [action, this.has(access, key)]),
        ),
        productionFinishedGoods: Object.fromEntries(
          Object.entries(NATIVE_ACTION_KEYS.finishedGoods).map(([action, key]) => [action, this.has(access, key)]),
        ),
      },
      receiptTypes: [...RECEIPT_TYPES],
    };
  }

  async findAll(query: UnifiedReceiptQueryDto, userId: string | undefined, ctx: ActiveOperationalContext) {
    const access = await this.resolveAccess(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const typeNarrows = query.receiptType
      ? query.receiptType === 'FINISHED_GOOD'
        ? 'FG'
        : isOperationalReceiptType(query.receiptType)
          ? 'OPERATIONAL'
          : 'NONE'
      : null;
    const fgNarrowed = typeNarrows === 'FG' || query.productionOrderId || query.productionRunId;
    const operationalNarrowed =
      typeNarrows === 'OPERATIONAL' || Boolean(query.warehouseId) || Boolean(query.receiptSource);
    const authorityNarrowed = query.authority === 'PRODUCTION_FG' || query.authority === 'OPERATIONAL';

    const includeOperational = access.operational && query.authority !== 'PRODUCTION_FG' && !fgNarrowed;
    const includeFinishedGoods = access.productionFinishedGoods && query.authority !== 'OPERATIONAL' && !operationalNarrowed;

    const rows: any[] = [];
    let operationalTotal = 0;
    let finishedGoodsTotal = 0;

    if (includeOperational) {
      const where: any = {
        deletedAt: null,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
      };
      if (query.status) where.status = query.status;
      if (query.receiptType) where.receiptType = query.receiptType;
      if (query.receiptSource) where.receiptSource = query.receiptSource;
      if (query.warehouseId) where.warehouseId = query.warehouseId;
      if (query.dateFrom || query.dateTo) {
        where.documentDate = {};
        if (query.dateFrom) where.documentDate.gte = new Date(query.dateFrom);
        if (query.dateTo) where.documentDate.lte = new Date(query.dateTo);
      }
      if (query.search) {
        where.OR = [
          { code: { contains: query.search } },
          { reason: { contains: query.search } },
          { notes: { contains: query.search } },
          { supplierName: { contains: query.search } },
          { supplierDoc: { contains: query.search } },
        ];
      }

      const client = this.prisma as any;
      const [found, total] = await Promise.all([
        client.inventoryOperationalReceipt.findMany({
          where,
          // Each authority supplies the full window from the start; the merged,
          // date-sorted union is paginated once below. Applying `skip` per
          // authority and again on the union would skip rows twice.
          skip: 0,
          take: skip + limit,
          orderBy: [{ documentDate: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            code: true,
            companyId: true,
            branchId: true,
            warehouseId: true,
            locationId: true,
            status: true,
            documentDate: true,
            reason: true,
            notes: true,
            supplierName: true,
            supplierDoc: true,
            receiptType: true,
            receiptSource: true,
            postedAt: true,
            cancelledAt: true,
            createdAt: true,
            warehouse: { select: { id: true, code: true, name: true } },
            location: { select: { id: true, code: true, name: true } },
            _count: { select: { lines: true } },
            lines: { select: { quantity: true } },
          },
        }),
        client.inventoryOperationalReceipt.count({ where }),
      ]);
      operationalTotal = total;
      rows.push(...found.map((row: any) => this.normalizeOperational(row)));
    }

    if (includeFinishedGoods) {
      const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
      if (query.status) where.status = query.status;
      if (query.warehouseId) where.receiptWarehouseId = query.warehouseId;
      if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
      if (query.productionRunId) where.productionRunId = query.productionRunId;
      if (query.dateFrom || query.dateTo) {
        where.receiptDate = {};
        if (query.dateFrom) where.receiptDate.gte = new Date(query.dateFrom);
        if (query.dateTo) where.receiptDate.lte = new Date(query.dateTo);
      }
      if (query.search) {
        where.OR = [
          { receiptNumber: { contains: query.search } },
          { movementNumber: { contains: query.search } },
          { notes: { contains: query.search } },
        ];
      }

      const client = this.prisma as any;
      const [found, total] = await Promise.all([
        client.productionFinishedGoodsReceipt.findMany({
          where,
          skip: 0,
          take: skip + limit,
          orderBy: [{ receiptDate: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            companyId: true,
            branchId: true,
            receiptNumber: true,
            productionOrderId: true,
            productionRunId: true,
            receiptWarehouseId: true,
            status: true,
            sourceType: true,
            notes: true,
            receiptDate: true,
            postedAt: true,
            cancelledAt: true,
            createdAt: true,
            movementId: true,
            movementNumber: true,
            receiptWarehouse: { select: { id: true, code: true, name: true } },
            productionOrder: { select: { id: true, orderNumber: true } },
            productionRun: { select: { id: true, runNumber: true } },
            lines: { select: { id: true, quantity: true } },
          },
        }),
        client.productionFinishedGoodsReceipt.count({ where }),
      ]);
      finishedGoodsTotal = total;
      rows.push(...found.map((row: any) => this.normalizeFinishedGoods(row)));
    }

    rows.sort((a, b) => {
      const delta = new Date(b.documentDate).getTime() - new Date(a.documentDate).getTime();
      return delta !== 0 ? delta : String(a.id).localeCompare(String(b.id));
    });

    const total = operationalTotal + finishedGoodsTotal;
    return {
      data: rows.slice(skip, skip + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    authority: string,
    id: string,
    userId: string | undefined,
    ctx: ActiveOperationalContext,
  ) {
    const access = await this.resolveAccess(userId);

    if (authority === 'OPERATIONAL') {
      if (!access.operational) throw this.forbidden();
      const row = await this.operationalService.findOne(id, ctx);
      return {
        ...this.normalizeOperational(row),
        lines: (row.lines ?? []).map((line: any) => ({
          id: line.id,
          productId: line.productId,
          productCode: line.product?.code ?? null,
          productName: line.product?.name ?? null,
          quantity: Number(line.quantity),
          unit: null,
          notes: line.notes ?? null,
          batchNumber: null,
          serialNumber: null,
          expiryDate: null,
        })),
      };
    }

    if (authority === 'PRODUCTION_FG') {
      if (!access.productionFinishedGoods) throw this.forbidden();
      const row = await this.finishedGoodsService.findOne(id, ctx);
      return {
        ...this.normalizeFinishedGoods(row),
        lines: (row.lines ?? []).map((line: any) => ({
          id: line.id,
          productId: line.productId,
          productCode: line.productCodeSnapshot ?? line.product?.code ?? null,
          productName: line.productNameSnapshot ?? line.product?.name ?? null,
          quantity: Number(line.quantity),
          unit: line.unit ?? null,
          notes: line.notes ?? null,
          batchNumber: line.batchNumber ?? null,
          serialNumber: line.serialNumber ?? null,
          expiryDate: line.expiryDate ?? null,
        })),
      };
    }

    throw new NotFoundException('Receipt authority not found');
  }

  private normalizeOperational(row: any) {
    const receiptType = row.receiptType ?? null;
    const lines = row.lines ?? [];
    return {
      id: row.id,
      authority: 'OPERATIONAL' as ReceiptAuthority,
      documentNumber: row.code,
      receiptType,
      itemType: receiptType && isOperationalReceiptType(receiptType)
        ? RECEIPT_TYPE_TO_ITEM_TYPE[receiptType as ReceiptType]
        : null,
      receiptSource: row.receiptSource ?? null,
      sourceDetail: null,
      status: row.status,
      documentDate: row.documentDate,
      warehouseId: row.warehouseId,
      warehouse: row.warehouse ?? null,
      locationId: row.locationId,
      location: row.location ?? null,
      lineCount: row._count?.lines ?? lines.length,
      totalQuantity: lines.reduce((sum: number, line: any) => sum + Number(line.quantity ?? 0), 0),
      productionOrderId: null,
      productionOrderNumber: null,
      productionRunId: null,
      productionRunNumber: null,
      movementId: null,
      movementNumber: null,
      reason: row.reason ?? null,
      notes: row.notes ?? null,
      postedAt: row.postedAt ?? null,
      cancelledAt: row.cancelledAt ?? null,
      deepLink: `/admin/inventory/operational-receipts?receipt=${encodeURIComponent(row.id)}`,
    };
  }

  private normalizeFinishedGoods(row: any) {
    const lines = row.lines ?? [];
    return {
      id: row.id,
      authority: 'PRODUCTION_FG' as ReceiptAuthority,
      documentNumber: row.receiptNumber,
      receiptType: 'FINISHED_GOOD',
      itemType: 'FINISHED_GOOD',
      receiptSource: null,
      sourceDetail: row.sourceType ?? null,
      status: row.status,
      documentDate: row.receiptDate,
      warehouseId: row.receiptWarehouseId,
      warehouse: row.receiptWarehouse ?? null,
      locationId: null,
      location: null,
      lineCount: lines.length,
      totalQuantity: lines.reduce((sum: number, line: any) => sum + Number(line.quantity ?? 0), 0),
      productionOrderId: row.productionOrderId ?? null,
      productionOrderNumber: row.productionOrder?.orderNumber ?? null,
      productionRunId: row.productionRunId ?? null,
      productionRunNumber: row.productionRun?.runNumber ?? null,
      movementId: row.movementId ?? null,
      movementNumber: row.movementNumber ?? null,
      reason: null,
      notes: row.notes ?? null,
      postedAt: row.postedAt ?? null,
      cancelledAt: row.cancelledAt ?? null,
      deepLink: `/admin/production/finished-goods-receipts?receipt=${encodeURIComponent(row.id)}`,
    };
  }
}
