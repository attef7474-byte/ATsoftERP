import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { SparePartConditionService } from '../spare-part-conditions/spare-part-conditions.service';
import {
  QueryRepairOrderDto, CreateRepairOrderDto, CreateRepairOrderFromReplacementDto,
  CompleteServiceableDto, CompletePartialDto, CompleteNotRepairableDto, ScrapRepairOrderDto,
  CancelRepairOrderDto, CreateRepairActionDto, QueryRepairablePartsDto, UpdateRepairStatusDto,
  OpenRepairOrderDto, RecordInspectionResultDto, WaitForPartsDto, ResumeFromPartsWaitDto,
} from './dto/repair-order.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const VALID_SOURCE_CONDITIONS = ['USED_REPAIRABLE', 'DAMAGED_REPAIRABLE'];
const VALID_TARGET_CONDITIONS = ['USED_SERVICEABLE', 'USED_REPAIRABLE'];
const FORBIDDEN_SOURCE_CONDITIONS = ['NEW'];

/**
 * R2-F — the complete modelled repair-order lifecycle. Recovered from the real
 * schema (SparePartRepairOrder.status) and the pre-R2-F transition map; both
 * agree on exactly these thirteen values.
 */
export const REPAIR_ORDER_STATUSES = [
  'DRAFT', 'OPEN', 'IN_INSPECTION', 'INSPECTION_FAILED', 'APPROVED_FOR_REPAIR',
  'UNDER_REPAIR', 'WAITING_PARTS', 'UNDER_TEST', 'COMPLETED_SERVICEABLE',
  'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE', 'SCRAPPED', 'CANCELLED',
] as const;

/** Terminal states admit no further transition and admit no further repair action. */
export const TERMINAL_REPAIR_STATUSES = [
  'COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE',
  'SCRAPPED', 'CANCELLED',
] as const;

/**
 * R2-F — canonical transition map. Every status mutation in this service is
 * validated against this single map by assertTransition(); no method may write
 * `status` without passing that guard.
 *
 * Before R2-F this map declared four edges that no code path could ever
 * produce (DRAFT->OPEN, IN_INSPECTION->INSPECTION_FAILED,
 * UNDER_REPAIR->WAITING_PARTS, UNDER_TEST->COMPLETED_NOT_REPAIRABLE), while
 * completeServiceable/completePartial/scrap bypassed the map entirely and
 * therefore accepted illegal source states.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['IN_INSPECTION', 'CANCELLED'],
  IN_INSPECTION: ['INSPECTION_FAILED', 'APPROVED_FOR_REPAIR', 'DRAFT'],
  INSPECTION_FAILED: ['SCRAPPED', 'CANCELLED'],
  APPROVED_FOR_REPAIR: ['UNDER_REPAIR', 'CANCELLED'],
  UNDER_REPAIR: ['UNDER_TEST', 'WAITING_PARTS', 'SCRAPPED', 'CANCELLED'],
  WAITING_PARTS: ['UNDER_REPAIR', 'CANCELLED'],
  UNDER_TEST: ['COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE', 'UNDER_REPAIR'],
  COMPLETED_SERVICEABLE: [],
  COMPLETED_PARTIAL: [],
  COMPLETED_NOT_REPAIRABLE: [],
  SCRAPPED: [],
  CANCELLED: [],
};

/** Statuses in which an order still holds a claim on its source condition stock. */
const ACTIVE_REPAIR_STATUSES = REPAIR_ORDER_STATUSES.filter(
  (s) => !TERMINAL_REPAIR_STATUSES.includes(s as any),
);

@Injectable()
export class RepairOrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
    private conditionService: SparePartConditionService,
  ) {}

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private badRequest(key: string, message: string, params?: Record<string, string>): BadRequestException {
    return new BadRequestException({ messageKey: key, message, ...(params ? { params } : {}) });
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

  private warehouseOwns(warehouse: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return warehouse.companyId === ctx.companyId
      && (warehouse.branchId === null || warehouse.branchId === ctx.branchId);
  }

  private orderScopeWhere(ctx: ActiveOperationalContext) {
    return {
      OR: [
        { machineId: { not: null }, machine: this.machineScope(ctx) },
        { machineId: null, warehouse: { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] } },
      ],
    };
  }

  private async orderAccess(id: string, ctx: ActiveOperationalContext) {
    const order = await this.prisma.sparePartRepairOrder.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, companyId: true, branchId: true } },
        warehouse: { select: { id: true, companyId: true, branchId: true } },
      },
    });
    if (!order) throw this.notFound('maintenance.repairOrderNotFound', 'Repair order not found');
    const owned = order.machine
      ? this.machineOwns(order.machine, ctx)
      : this.warehouseOwns(order.warehouse, ctx);
    if (!owned) throw this.notFound('maintenance.repairOrderNotFound', 'Repair order not found');
    return order;
  }

  private async machineAccess(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
    return machine;
  }

  private async warehouseAccess(warehouseId: string, ctx: ActiveOperationalContext) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw this.notFound('inventory.warehouseNotFound', 'Warehouse not found');
    if (!this.warehouseOwns(warehouse, ctx)) throw this.notFound('inventory.warehouseNotFound', 'Warehouse not found');
    return warehouse;
  }

  private async requestAccess(maintenanceRequestId: string, ctx: ActiveOperationalContext) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: maintenanceRequestId },
      include: { machine: { select: { id: true, companyId: true, branchId: true } } },
    });
    if (!request || !this.machineOwns(request.machine, ctx)) throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
    return request;
  }

  private async replacementHistoryAccess(replacementHistoryId: string, ctx: ActiveOperationalContext) {
    const history = await this.prisma.sparePartReplacementHistory.findUnique({
      where: { id: replacementHistoryId },
      include: { machine: { select: { id: true, companyId: true, branchId: true } } },
    });
    if (!history || !this.machineOwns(history.machine, ctx)) {
      throw this.notFound('maintenance.repairSourceNotFound', 'Replacement history not found');
    }
    return history;
  }

  /**
   * R2-F — repair orders have no companyId/branchId column: tenancy is derived
   * from the machine when one is set, otherwise from the warehouse. For every
   * action that moves condition stock, the warehouse must ALSO be inside the
   * active context, otherwise a machine-scoped order could drain a foreign
   * company's condition balance.
   */
  private async assertSourceWarehouseInContext(
    order: { warehouseId: string; warehouse?: { id: string; companyId: string | null; branchId: string | null } | null },
    ctx: ActiveOperationalContext,
  ) {
    const warehouse = order.warehouse ?? await this.prisma.warehouse.findUnique({
      where: { id: order.warehouseId },
      select: { id: true, companyId: true, branchId: true },
    });
    if (!warehouse) throw this.notFound('inventory.warehouseNotFound', 'Warehouse not found');
    if (!this.warehouseOwns(warehouse, ctx)) {
      throw this.notFound('inventory.warehouseNotFound', 'Warehouse not found');
    }
  }

  // ── READ ─────────────────────────────────────────────────────

  async findAll(query: QueryRepairOrderDto, ctx: ActiveOperationalContext) {
    const where: any = { ...this.orderScopeWhere(ctx) };
    if (query.status) where.status = query.status;
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.warehouseId) {
      await this.warehouseAccess(query.warehouseId, ctx);
      where.warehouseId = query.warehouseId;
    }
    if (query.sourceCondition) where.sourceCondition = query.sourceCondition;
    if (query.maintenanceRequestId) {
      await this.requestAccess(query.maintenanceRequestId, ctx);
      where.maintenanceRequestId = query.maintenanceRequestId;
    }
    if (query.replacementHistoryId) where.replacementHistoryId = query.replacementHistoryId;
    if (query.machineId) {
      await this.machineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    if (query.machineComponentId) where.machineComponentId = query.machineComponentId;

    return this.prisma.sparePartRepairOrder.findMany({
      where,
      include: {
        sparePart: { select: { id: true, code: true, name: true, unit: true, productId: true } },
        warehouse: { select: { id: true, code: true, name: true, warehouseType: true } },
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        actions: { orderBy: { performedAt: 'asc' } },
      },
      orderBy: { openedAt: 'desc' },
      take: query.limit || 50,
    });
  }

  async findById(id: string, ctx: ActiveOperationalContext) {
    await this.orderAccess(id, ctx);
    const order = await this.prisma.sparePartRepairOrder.findUnique({
      where: { id },
      include: {
        sparePart: { select: { id: true, code: true, name: true, unit: true, productId: true,
          technicalClassification: true, usageType: true, nature: true } },
        warehouse: { select: { id: true, code: true, name: true, warehouseType: true } },
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true, status: true } },
        actions: { orderBy: { performedAt: 'asc' } },
      },
    });
    if (!order) throw this.notFound('maintenance.repairOrderNotFound', 'Repair order not found');
    return order;
  }

  /**
   * R2-E — resolve the EXACT return evidence for a replacement event. The
   * condition IN movement is the strongest proof of where the removed part
   * physically came back, so it is resolved by id and verified against the
   * replacement identity instead of guessing a warehouse.
   *
   * When no exact movement exists (legacy historical rows) the caller is told so
   * and may fall back to a condition-balance scan; a warehouse is never invented.
   */
  private async resolveExactReturnSource(history: {
    id: string;
    oldSparePartId: string | null;
    removedCondition: string | null;
    conditionInMovementId: string | null;
  }, ctx: ActiveOperationalContext) {
    if (!history.conditionInMovementId) return null;
    const movement = await this.prisma.sparePartConditionMovement.findUnique({
      where: { id: history.conditionInMovementId },
      include: { warehouse: { select: { id: true, code: true, name: true, warehouseType: true, companyId: true, branchId: true } } },
    });
    if (!movement) {
      throw this.badRequest(
        'maintenance.repairSourceReturnMovementNotFound',
        'The recorded returned-part condition movement for this replacement no longer exists',
      );
    }
    if (movement.direction !== 'IN') {
      throw this.badRequest(
        'maintenance.repairSourceReturnMovementMismatch',
        'The recorded returned-part condition movement is not a stock IN movement',
      );
    }
    if (history.oldSparePartId && movement.sparePartId !== history.oldSparePartId) {
      throw this.badRequest(
        'maintenance.repairSourceReturnMovementMismatch',
        'The recorded returned-part condition movement does not belong to the removed part',
      );
    }
    if (history.removedCondition && movement.condition !== history.removedCondition) {
      throw this.badRequest(
        'maintenance.repairSourceReturnMovementMismatch',
        'The recorded returned-part condition movement condition does not match the removed part condition',
      );
    }
    if (!this.warehouseOwns(movement.warehouse, ctx)) {
      throw this.notFound(
        'maintenance.repairSourceNotFound',
        'The returned part warehouse does not belong to the active company and branch',
      );
    }
    return movement;
  }

  async findRepairableQueue(query: QueryRepairablePartsDto, ctx: ActiveOperationalContext) {
    const where: any = { removedReturnedToStock: true, machine: this.machineScope(ctx) };
    if (query.condition) where.removedCondition = query.condition;
    if (query.machineId) {
      await this.machineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    // R2-E: the repairable source is the REMOVED part, so the queue filter is keyed
    // on the old spare part identity, never the newly installed one.
    if (query.sparePartId) { where.oldSparePartId = query.sparePartId; }

    const histories = await this.prisma.sparePartReplacementHistory.findMany({
      where,
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        oldSparePart: { select: { id: true, code: true, name: true, productId: true, unit: true } },
        newSparePart: { select: { id: true, code: true, name: true, productId: true, unit: true } },
        oldInstalledPart: {
          select: {
            id: true,
            status: true,
            installedQuantity: true,
            installedCondition: true,
            installedAt: true,
            removedAt: true,
            removedCondition: true,
            removedQuantity: true,
            serialNumber: true,
            batchNumber: true,
            sparePart: { select: { id: true, code: true, name: true } },
          },
        },
        newInstalledPart: {
          select: {
            id: true,
            status: true,
            installedQuantity: true,
            installedCondition: true,
            installedAt: true,
            sparePart: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { replacedAt: 'desc' },
      take: query.limit || 50,
    });

    const repairableConditions = ['USED_REPAIRABLE', 'DAMAGED_REPAIRABLE'];
    const filtered = histories.filter(h => h.removedCondition && repairableConditions.includes(h.removedCondition));

    const results = [];
    for (const h of filtered) {
      const existingOrder = await this.prisma.sparePartRepairOrder.findFirst({
        where: { replacementHistoryId: h.id, status: { notIn: ['CANCELLED', 'SCRAPPED', 'COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE'] } },
        select: { id: true, status: true, repairOrderNumber: true },
      });

      // R2-E: the exact return warehouse is resolved by movement id first and
      // reported as the authoritative source. Condition balances for the REMOVED
      // spare part are listed as supporting evidence only, with the exact return
      // warehouse first — the queue never promotes an arbitrary warehouse merely
      // because it also holds condition stock of the removed part.
      const exactReturn = await this.resolveExactReturnSource(
        { id: h.id, oldSparePartId: h.oldSparePartId, removedCondition: h.removedCondition, conditionInMovementId: h.conditionInMovementId },
        ctx,
      );

      const conditionBalances = h.oldSparePartId
        ? await this.prisma.sparePartConditionBalance.findMany({
          where: {
            sparePartKey: h.oldSparePartId,
            condition: h.removedCondition || undefined,
            quantity: { gt: 0 },
            warehouse: { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] },
          },
          select: { id: true, warehouseId: true, condition: true, quantity: true, availableQuantity: true, warehouse: { select: { id: true, code: true, name: true, warehouseType: true } } },
        })
        : [];

      const orderedBalances = exactReturn
        ? [...conditionBalances].sort((left, right) => {
          if (left.warehouseId === exactReturn.warehouseId) return -1;
          if (right.warehouseId === exactReturn.warehouseId) return 1;
          return 0;
        })
        : conditionBalances;

      results.push({
        replacementHistoryId: h.id,
        replacementNumber: h.replacementNumber,
        replacedAt: h.replacedAt,
        replacementAction: h.replacementAction,
        // The repairable identity is the ACTUAL REMOVED part.
        sparePart: h.oldSparePart,
        installedPart: h.oldInstalledPart,
        removedCondition: h.removedCondition,
        removedQuantity: h.removedQuantity,
        conditionInMovementId: h.conditionInMovementId,
        exactReturnSource: exactReturn
          ? {
            movementId: exactReturn.id,
            movementNumber: exactReturn.movementNumber,
            sparePartId: exactReturn.sparePartId,
            productId: exactReturn.productId,
            warehouseId: exactReturn.warehouseId,
            warehouse: exactReturn.warehouse,
            condition: exactReturn.condition,
            direction: exactReturn.direction,
            quantity: exactReturn.quantity,
          }
          : null,
        // Replacement context only — never the repair source.
        newSparePart: h.newSparePart,
        newInstalledPart: h.newInstalledPart,
        machine: h.machine,
        machineComponent: h.machineComponent,
        maintenanceRequest: h.maintenanceRequest,
        availableBalances: orderedBalances,
        existingRepairOrder: existingOrder || null,
      });
    }
    return results;
  }

  // ── CREATE ───────────────────────────────────────────────────

  async create(dto: CreateRepairOrderDto, userId: string, ctx: ActiveOperationalContext) {
    await this.validateRepairableSource(dto.sparePartId, dto.warehouseId, dto.sourceCondition, dto.sourceQuantity, ctx);

    if (dto.replacementHistoryId) {
      await this.replacementHistoryAccess(dto.replacementHistoryId, ctx);
      const existing = await this.prisma.sparePartRepairOrder.findFirst({
        where: { replacementHistoryId: dto.replacementHistoryId, status: { notIn: ['CANCELLED', 'SCRAPPED', 'COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE'] } },
      });
      if (existing) throw this.badRequest('maintenance.repairOrderAlreadyExists', 'An active repair order already exists for this source');
    }

    if (dto.sourceType && dto.sourceId) {
      const existingSameSource = await this.prisma.sparePartRepairOrder.findFirst({
        where: { sourceType: dto.sourceType, sourceId: dto.sourceId, status: { notIn: ['CANCELLED', 'SCRAPPED', 'COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE'] } },
      });
      if (existingSameSource) throw this.badRequest('maintenance.repairOrderAlreadyExists', 'An active repair order already exists for this source');
    }

    if (dto.sourceCondition === 'NEW') {
      throw this.badRequest('maintenance.repairSourceNotRepairable', 'NEW parts are not repairable sources');
    }

    const sparePart = await this.prisma.sparePart.findUnique({ where: { id: dto.sparePartId } });
    if (!sparePart) throw this.notFound('maintenance.sparePartNotFound', 'Spare part not found');

    const warehouse = await this.warehouseAccess(dto.warehouseId, ctx);
    if ((warehouse.warehouseType || '') !== 'SPARE_PART') {
      throw this.badRequest('stock.sparePartWarehouseRequired', 'Repair orders require a spare-part warehouse');
    }

    // ── R2-F reservation / claim invariant ────────────────────────
    // `SparePartConditionBalance.availableQuantity` is NOT on-hand-minus-reserved
    // anywhere in this codebase: every module moves `quantity` and
    // `availableQuantity` by the same delta, so the column is a mirror of on-hand
    // stock and has no reserved concept. Reducing `availableQuantity` at order
    // creation would therefore invent balance semantics and break the invariant
    // every other module relies on.
    //
    // The enforceable invariant with the existing model is: the stock claimed by
    // all ACTIVE repair orders over one (spare part, warehouse, condition) key
    // must never exceed that condition balance's on-hand quantity. An order's own
    // `sourceQuantity` is its claim, and reaching a terminal state releases it.
    //
    // The aggregate is re-read inside the create transaction so the claim is
    // measured against committed state at write time. It cannot be made a hard
    // serialisation point without isolation-level or raw-locking infrastructure
    // this codebase does not use anywhere, so the authoritative protection
    // against consuming the same physical stock twice remains the atomic
    // compare-and-set balance guard in recordConditionMovementInTx, which
    // fails the operation loudly rather than allowing a negative balance.
    if (dto.machineId) await this.machineAccess(dto.machineId, ctx);
    if (dto.machineComponentId && dto.machineId) {
      const comp = await this.prisma.machineComponent.findUnique({ where: { id: dto.machineComponentId } });
      if (!comp) throw this.notFound('maintenance.componentNotFound', 'Machine component not found');
      if (comp.machineId !== dto.machineId) {
        throw this.badRequest('maintenance.componentMachineMismatch', 'Component does not belong to the selected machine');
      }
    }
    if (dto.maintenanceRequestId) await this.requestAccess(dto.maintenanceRequestId, ctx);

    const repairOrderNumber = await this.numberingService.generateNumberAtomic('SPARE_PART_REPAIR_ORDER');

    const order = await this.prisma.$transaction(async (tx: any) => {
      const claimed = await tx.sparePartRepairOrder.aggregate({
        where: {
          sparePartId: dto.sparePartId,
          warehouseId: dto.warehouseId,
          sourceCondition: dto.sourceCondition,
          status: { in: ACTIVE_REPAIR_STATUSES as unknown as string[] },
        },
        _sum: { sourceQuantity: true },
      });
      const alreadyClaimed = claimed?._sum?.sourceQuantity ?? 0;
      const onHand = await this.conditionService.getBalanceByKey(dto.sparePartId, dto.warehouseId, dto.sourceCondition);
      if (alreadyClaimed + dto.sourceQuantity > (onHand.quantity ?? 0)) {
        throw this.badRequest(
          'maintenance.repairSourceQuantityExceedsClaim',
          `Active repair orders already claim ${alreadyClaimed} of the ${onHand.quantity ?? 0} available in condition ${dto.sourceCondition}`,
        );
      }

      return tx.sparePartRepairOrder.create({
        data: {
          repairOrderNumber,
          sparePartId: dto.sparePartId,
          productId: dto.productId || sparePart.productId || null,
          warehouseId: dto.warehouseId,
          sourceCondition: dto.sourceCondition,
          sourceQuantity: dto.sourceQuantity,
          reservedQuantity: dto.sourceQuantity,
          remainingQuantity: dto.sourceQuantity,
          targetCondition: dto.targetCondition || null,
          status: 'DRAFT',
          sourceType: dto.sourceType || 'MANUAL_REPAIR_INTAKE',
          sourceId: dto.sourceId || null,
          maintenanceRequestId: dto.maintenanceRequestId || null,
          requiredPartId: dto.requiredPartId || null,
          replacementHistoryId: dto.replacementHistoryId || null,
          installedPartId: dto.installedPartId || null,
          conditionInMovementId: dto.conditionInMovementId || null,
          machineId: dto.machineId || null,
          machineComponentId: dto.machineComponentId || null,
          failureDescription: dto.failureDescription || null,
          externalRepair: dto.externalRepair || false,
          externalRepairProviderName: dto.externalRepairProviderName || null,
          estimatedRepairCost: dto.estimatedRepairCost ?? null,
          notes: dto.notes || null,
          openedByUserId: userId,
          openedAt: new Date(),
        },
      });
    });

    await this.audit.log(userId, 'SPARE_PART_REPAIR_ORDER_CREATED', 'SparePartRepairOrder', order.id, {
      repairOrderNumber: order.repairOrderNumber, sparePartId: dto.sparePartId, sourceCondition: dto.sourceCondition, sourceQuantity: dto.sourceQuantity,
    });

    return this.findById(order.id, ctx);
  }

  async createFromReplacementHistory(dto: CreateRepairOrderFromReplacementDto, userId: string, ctx: ActiveOperationalContext) {
    const history = await this.replacementHistoryAccess(dto.replacementHistoryId, ctx);

    const fullHistory = await this.prisma.sparePartReplacementHistory.findUnique({
      where: { id: dto.replacementHistoryId },
      include: {
        newSparePart: { select: { id: true, productId: true } },
        oldSparePart: { select: { id: true, code: true, name: true, productId: true } },
        oldInstalledPart: { select: { id: true, productId: true, status: true } },
        machine: { select: { id: true, name: true } },
        machineComponent: { select: { id: true, name: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
    });
    if (!fullHistory) throw this.notFound('maintenance.repairSourceNotFound', 'Replacement history not found');
    if (!fullHistory.removedReturnedToStock) throw this.badRequest('maintenance.repairSourceNotRepairable', 'Removed part was not returned to stock');
    if (!fullHistory.removedCondition || !VALID_SOURCE_CONDITIONS.includes(fullHistory.removedCondition)) {
      throw this.badRequest('maintenance.repairSourceNotRepairable', 'Removed part condition is not repairable');
    }

    // R2-E — the repair source is the ACTUAL REMOVED part. When the historical
    // event carries no provable old identity the operation fails closed rather
    // than silently consuming the NEWLY INSTALLED part as the repair source.
    if (!fullHistory.oldSparePartId) {
      throw this.badRequest(
        'maintenance.repairSourceOldIdentityMissing',
        'This replacement event has no provable removed-part identity, so it cannot be used as a repair source',
      );
    }
    const sparePartId = fullHistory.oldSparePartId;
    // Canonical product identity of the removed part: the installed record's linked
    // product when present, otherwise the old spare part's catalog product.
    const productId = fullHistory.oldInstalledPart?.productId
      ?? fullHistory.oldSparePart?.productId
      ?? null;

    const existing = await this.prisma.sparePartRepairOrder.findFirst({
      where: { replacementHistoryId: history.id, status: { notIn: ['CANCELLED', 'SCRAPPED', 'COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE'] } },
    });
    if (existing) throw this.badRequest('maintenance.repairOrderAlreadyExists', 'An active repair order already exists for this source');

    // R2-E — resolve the EXACT return warehouse from the recorded condition IN
    // movement. A warehouse that merely happens to hold condition stock of the
    // removed part is never substituted for the recorded return location.
    const exactReturn = await this.resolveExactReturnSource(
      { id: history.id, oldSparePartId: fullHistory.oldSparePartId, removedCondition: fullHistory.removedCondition, conditionInMovementId: fullHistory.conditionInMovementId },
      ctx,
    );

    let warehouseId: string;
    let availableQuantity: number;
    if (exactReturn) {
      const balance = await this.conditionService.getBalanceByKey(sparePartId, exactReturn.warehouseId, fullHistory.removedCondition!);
      availableQuantity = balance.availableQuantity;
      if (availableQuantity < (fullHistory.removedQuantity || 0)) {
        throw this.badRequest(
          'stock.insufficientConditionBalance',
          'The returned part stock at its recorded return warehouse does not support the requested repair source quantity',
        );
      }
      warehouseId = exactReturn.warehouseId;
    } else {
      // Legacy historical event without a recorded return movement: fall back to
      // the condition-balance scan rather than inventing a warehouse.
      const conditionBalances = await this.prisma.sparePartConditionBalance.findMany({
        where: { sparePartKey: sparePartId, condition: fullHistory.removedCondition, availableQuantity: { gt: 0 }, warehouse: { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] } },
        select: { warehouseId: true, quantity: true, availableQuantity: true },
        orderBy: { availableQuantity: 'desc' },
      });
      if (conditionBalances.length === 0) throw this.badRequest('stock.insufficientConditionBalance', 'No available condition balance for the removed part');
      warehouseId = conditionBalances[0].warehouseId;
      availableQuantity = conditionBalances[0].availableQuantity;
    }

    const sourceQuantity = fullHistory.removedQuantity || availableQuantity;

    await this.warehouseAccess(warehouseId, ctx);
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || (warehouse.warehouseType || '') !== 'SPARE_PART') {
      throw this.badRequest('stock.sparePartWarehouseRequired', 'Repair orders require a spare-part warehouse');
    }

    return this.create({
      sparePartId,
      productId: productId || undefined,
      warehouseId,
      sourceCondition: fullHistory.removedCondition,
      sourceQuantity: Math.min(sourceQuantity, availableQuantity),
      sourceType: 'REPLACEMENT_HISTORY',
      sourceId: history.id,
      maintenanceRequestId: fullHistory.maintenanceRequestId || undefined,
      requiredPartId: fullHistory.requiredPartId || undefined,
      replacementHistoryId: history.id,
      // R2-E: the removed installed part is the repair source. The newly installed
      // part is a different physical record on the machine and is never the source.
      installedPartId: fullHistory.oldInstalledPartId || undefined,
      conditionInMovementId: fullHistory.conditionInMovementId || undefined,
      machineId: fullHistory.machineId,
      machineComponentId: fullHistory.machineComponentId || undefined,
      notes: dto.notes || `Auto-created from replacement history ${fullHistory.replacementNumber || fullHistory.id}`,
    }, userId, ctx);
  }

  private async validateRepairableSource(sparePartId: string, warehouseId: string, condition: string, quantity: number, ctx: ActiveOperationalContext) {
    if (quantity <= 0) throw this.badRequest('validation.invalidQuantity', 'Quantity must be greater than zero');
    if (FORBIDDEN_SOURCE_CONDITIONS.includes(condition)) {
      throw this.badRequest('maintenance.repairSourceNotRepairable', 'NEW parts are not repairable sources');
    }
    if (!VALID_SOURCE_CONDITIONS.includes(condition)) {
      throw this.badRequest('maintenance.repairSourceNotRepairable', 'Source condition is not repairable');
    }

    try {
      const balance = await this.conditionService.getBalanceByKey(sparePartId, warehouseId, condition);
      if (balance.availableQuantity < quantity) {
        throw this.badRequest('stock.insufficientConditionBalance', 'Insufficient available condition balance');
      }
    } catch (e: any) {
      if (e instanceof BadRequestException || e instanceof NotFoundException) throw e;
      throw this.badRequest('stock.conditionBalanceNotFound', 'Condition balance not found');
    }
  }

  // ── STATUS TRANSITIONS ───────────────────────────────────────

  /**
   * R2-F — the one canonical transition guard. Every status mutation funnels
   * through here, so there is no second status authority anywhere in the
   * service. It is deliberately fail-closed:
   *  - an unknown target status is rejected;
   *  - a terminal current status rejects everything (terminal immutability);
   *  - an unknown/unmapped current status rejects everything;
   *  - a repeat of the current status is rejected as a no-op rather than
   *    silently re-applied.
   */
  private assertTransition(current: string, next: string) {
    if (!REPAIR_ORDER_STATUSES.includes(next as any)) {
      throw this.badRequest('maintenance.invalidRepairTransition', `Unknown repair order status ${next}`);
    }
    if (TERMINAL_REPAIR_STATUSES.includes(current as any)) {
      throw this.badRequest(
        'maintenance.repairAlreadyCompleted',
        `Repair order is already ${current} and cannot change status`,
      );
    }
    if (current === next) {
      throw this.badRequest('maintenance.repairAlreadyInStatus', `Repair order is already in status ${next}`);
    }
    const allowed = ALLOWED_TRANSITIONS[current];
    if (!allowed || !allowed.includes(next)) {
      throw this.badRequest(
        'maintenance.invalidRepairTransition',
        `A repair order in status ${current} cannot move to ${next}`,
      );
    }
  }

  /**
   * R2-F — some target states are reachable through more than one edge in the
   * canonical map, which would let a misleadingly named action perform it. The
   * map alone cannot express "resume only after a parts wait", so the actions
   * that name a specific situation also pin their allowed source states.
   */
  private assertSourceStatus(order: { status: string }, allowed: string[]) {
    if (!allowed.includes(order.status)) {
      throw this.badRequest(
        'maintenance.invalidRepairTransition',
        `This action is not available while the repair order is ${order.status}`,
      );
    }
  }

  /**
   * R2-F — load an order for a state-changing action: tenant/branch access is
   * enforced first, then the canonical guard. Returns the order so callers never
   * re-read it outside the guard.
   */
  private async loadForAction(id: string, next: string, ctx: ActiveOperationalContext) {
    const order = await this.orderAccess(id, ctx);
    this.assertTransition(order.status, next);
    return order;
  }

  /**
   * R2-F — claim the transition atomically. A plain `update({ where: { id } })`
   * lets two concurrent callers both read UNDER_TEST and both commit, which
   * would double-consume the condition balance. Matching on the current status
   * makes the second writer's update affect zero rows and roll the transaction
   * back instead.
   */
  private async claimStatusInTx(tx: any, id: string, expectedStatus: string, data: Record<string, any>) {
    const claimed = await tx.sparePartRepairOrder.updateMany({
      where: { id, status: expectedStatus },
      data,
    });
    if (claimed.count !== 1) {
      throw this.badRequest(
        'maintenance.repairTransitionConflict',
        'This repair order was changed by another user. Reload it and try again.',
      );
    }
  }

  private async transition(id: string, newStatus: string, userId: string, ctx: ActiveOperationalContext, extra?: Record<string, any>) {
    const order = await this.loadForAction(id, newStatus, ctx);

    const data: any = { status: newStatus, ...(extra || {}) };
    if (newStatus === 'CANCELLED') {
      if (!extra?.cancelReason) throw this.badRequest('maintenance.repairCancelReasonRequired', 'Cancel reason is required');
      data.cancelledAt = new Date();
      data.reservedQuantity = 0;
    }
    if (newStatus === 'OPEN') {
      data.openedByUserId = userId;
      data.openedAt = new Date();
    }
    if (newStatus === 'IN_INSPECTION') {
      data.inspectionStartedAt = new Date();
      data.inspectedByUserId = userId;
    }
    if (newStatus === 'INSPECTION_FAILED') data.inspectedByUserId = userId;
    if (newStatus === 'APPROVED_FOR_REPAIR') data.inspectedByUserId = userId;
    if (newStatus === 'UNDER_REPAIR') {
      data.repairStartedAt = new Date();
      data.repairedByUserId = userId;
    }
    if (newStatus === 'WAITING_PARTS') data.repairedByUserId = order.repairedByUserId || userId;
    if (newStatus === 'UNDER_TEST') {
      data.testStartedAt = new Date();
      data.testedByUserId = userId;
    }
    if (TERMINAL_REPAIR_STATUSES.includes(newStatus as any)) {
      data.completedAt = new Date();
      data.closedByUserId = userId;
      // R2-F: a terminal order no longer holds a claim on its source stock.
      data.reservedQuantity = 0;
    }

    const updated = await this.prisma.$transaction(async (tx: any) => {
      await this.claimStatusInTx(tx, id, order.status, data);
      return tx.sparePartRepairOrder.findUnique({ where: { id } });
    });

    await this.audit.log(userId, `SPARE_PART_REPAIR_${newStatus}`, 'SparePartRepairOrder', id, {
      previousStatus: order.status, newStatus, ...extra,
    });

    return updated;
  }

  // ── LIFECYCLE ACTIONS ────────────────────────────────────────

  /** R2-F — DRAFT -> OPEN. Before R2-F no code path could produce OPEN. */
  async open(id: string, dto: OpenRepairOrderDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'OPEN', userId, ctx, {
      notes: dto?.notes || undefined,
      failureDescription: dto?.failureDescription || undefined,
    });
  }

  async startInspection(id: string, dto: UpdateRepairStatusDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'IN_INSPECTION', userId, ctx, {
      notes: dto?.notes || undefined,
    });
  }

  /**
   * R2-F — the canonical inspection decision. Before R2-F the verdict was never
   * persisted: approve-repair moved the status but wrote no inspectionResult, and
   * there was no way at all to reach INSPECTION_FAILED.
   */
  async recordInspectionResult(id: string, dto: RecordInspectionResultDto, userId: string, ctx: ActiveOperationalContext) {
    if (!dto.inspectionResult || !dto.inspectionResult.trim()) {
      throw this.badRequest('validation.required', 'An inspection result is required');
    }
    if (dto.outcome === 'NOT_REPAIRABLE' && !(dto.failureDescription || '').trim()) {
      throw this.badRequest('validation.required', 'A failure description is required when the part is not repairable');
    }
    const next = dto.outcome === 'REPAIRABLE' ? 'APPROVED_FOR_REPAIR' : 'INSPECTION_FAILED';
    return this.transition(id, next, userId, ctx, {
      inspectionResult: dto.inspectionResult.trim(),
      failureDescription: dto.outcome === 'REPAIRABLE' ? (dto.failureDescription || null) : dto.failureDescription!.trim(),
      notes: dto.notes || undefined,
    });
  }

  /**
   * Backward-compatible alias for the pre-R2-F `approve-repair` route. It now
   * shares the single inspection code path instead of transitioning blindly, so
   * the inspection verdict is always recorded.
   */
  async approveRepair(id: string, dto: UpdateRepairStatusDto, userId: string, ctx: ActiveOperationalContext) {
    return this.recordInspectionResult(id, {
      outcome: 'REPAIRABLE',
      inspectionResult: 'REPAIRABLE',
      notes: dto?.notes,
    } as RecordInspectionResultDto, userId, ctx);
  }

  /** R2-F — UNDER_REPAIR -> WAITING_PARTS, with a mandatory reason. */
  async waitForParts(id: string, dto: WaitForPartsDto, userId: string, ctx: ActiveOperationalContext) {
    if (!(dto?.reason || '').trim()) {
      throw this.badRequest('validation.required', 'A reason is required when waiting for parts');
    }
    const reason = dto.reason.trim();
    const order = await this.transition(id, 'WAITING_PARTS', userId, ctx, {
      notes: dto.notes || reason,
    });
    await this.recordAction(id, {
      actionType: 'NOTE',
      actionStatus: 'DONE',
      description: reason,
      notes: `Waiting for parts: ${reason}`,
    }, userId, ctx);
    return order;
  }

  /** R2-F — WAITING_PARTS -> UNDER_REPAIR (parts arrived). */
  async resumeFromPartsWait(id: string, dto: ResumeFromPartsWaitDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.orderAccess(id, ctx);
    this.assertSourceStatus(order, ['WAITING_PARTS']);
    return this.transition(id, 'UNDER_REPAIR', userId, ctx, {
      notes: dto?.notes || undefined,
    });
  }

  /**
   * R2-F — begins a repair (from an approved inspection) or returns a tested
   * order to repair. It is deliberately NOT a way to resume a parts wait: that
   * is `resumeFromPartsWait`, and WAITING_PARTS is excluded here so the audit
   * trail cannot show a resume as an ordinary repair start.
   */
  async startRepair(id: string, dto: UpdateRepairStatusDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.orderAccess(id, ctx);
    this.assertSourceStatus(order, ['APPROVED_FOR_REPAIR', 'UNDER_TEST']);
    return this.transition(id, 'UNDER_REPAIR', userId, ctx, {
      repairDescription: dto?.repairDescription || undefined,
      notes: dto?.notes || undefined,
    });
  }

  async startTest(id: string, dto: UpdateRepairStatusDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'UNDER_TEST', userId, ctx, {
      notes: dto?.notes || undefined,
    });
  }

  // ── COMPLETE SERVICEABLE ─────────────────────────────────────

  async completeServiceable(id: string, dto: CompleteServiceableDto, userId: string, ctx: ActiveOperationalContext) {
    // R2-F: the guard is now the only authority on the source state. Previously
    // this method only rejected the two completed states, so an order in DRAFT,
    // OPEN, IN_INSPECTION, INSPECTION_FAILED, APPROVED_FOR_REPAIR, WAITING_PARTS,
    // SCRAPPED, CANCELLED or COMPLETED_NOT_REPAIRABLE could be completed here.
    const order = await this.loadForAction(id, 'COMPLETED_SERVICEABLE', ctx);
    await this.assertSourceWarehouseInContext(order, ctx);

    if (dto.repairedQuantity <= 0) throw this.badRequest('validation.invalidQuantity', 'Quantity must be greater than zero');
    if (dto.repairedQuantity > order.remainingQuantity) {
      throw this.badRequest('maintenance.repairQuantityInvalid', 'Repaired quantity exceeds remaining quantity');
    }
    if (!VALID_TARGET_CONDITIONS.includes(dto.targetCondition)) {
      throw this.badRequest('stock.invalidCondition', 'Invalid target condition');
    }

    const sourceDecreaseQty = dto.repairedQuantity;
    const oldBalance = await this.conditionService.getBalanceByKey(
      order.sparePartId, order.warehouseId, order.sourceCondition,
    );
    if (oldBalance.availableQuantity < sourceDecreaseQty) {
      throw this.badRequest('stock.insufficientConditionBalance', 'Insufficient available condition balance');
    }

    await this.prisma.$transaction(async (tx: any) => {
      const outMovement = await this.recordConditionMovementInTx(tx, {
        sparePartId: order.sparePartId,
        productId: order.productId || '',
        warehouseId: order.warehouseId,
        condition: order.sourceCondition,
        direction: 'OUT',
        quantity: sourceDecreaseQty,
        sourceType: 'REPAIR_COMPLETE',
        sourceId: id,
        maintenanceRequestId: order.maintenanceRequestId || null,
        notes: `Repair complete - condition conversion from ${order.sourceCondition} to ${dto.targetCondition}`,
      }, userId);

      const inMovement = await this.recordConditionMovementInTx(tx, {
        sparePartId: order.sparePartId,
        productId: order.productId || '',
        warehouseId: order.warehouseId,
        condition: dto.targetCondition,
        direction: 'IN',
        quantity: sourceDecreaseQty,
        sourceType: 'REPAIR_COMPLETE',
        sourceId: id,
        maintenanceRequestId: order.maintenanceRequestId || null,
        notes: `Repair complete - returned as ${dto.targetCondition}`,
      }, userId);

      const newRemaining = order.remainingQuantity - sourceDecreaseQty;
      await this.claimStatusInTx(tx, id, order.status, {
        status: 'COMPLETED_SERVICEABLE',
        repairedQuantity: (order.repairedQuantity || 0) + sourceDecreaseQty,
        remainingQuantity: newRemaining,
        targetCondition: dto.targetCondition,
        conditionOutMovementId: outMovement.id,
        conditionInMovementId: inMovement.id,
        testResult: dto.testResult || null,
        testNotes: dto.testNotes || null,
        repairDescription: dto.repairDescription || null,
        notes: dto.notes || null,
        completedAt: new Date(),
        closedByUserId: userId,
        reservedQuantity: 0,
      });
    });

    await this.audit.log(userId, 'SPARE_PART_REPAIR_COMPLETED_SERVICEABLE', 'SparePartRepairOrder', id, {
      repairedQuantity: dto.repairedQuantity, targetCondition: dto.targetCondition,
    });

    return this.findById(id, ctx);
  }

  // ── COMPLETE PARTIAL ─────────────────────────────────────────

  async completePartial(id: string, dto: CompletePartialDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.loadForAction(id, 'COMPLETED_PARTIAL', ctx);
    await this.assertSourceWarehouseInContext(order, ctx);

    const totalQty = dto.repairedQuantity + dto.scrappedQuantity;
    if (totalQty <= 0) throw this.badRequest('validation.invalidQuantity', 'Quantity must be greater than zero');
    if (dto.repairedQuantity < 0 || dto.scrappedQuantity < 0) {
      throw this.badRequest('validation.invalidQuantity', 'Quantities cannot be negative');
    }
    if (totalQty > order.remainingQuantity) {
      throw this.badRequest('maintenance.repairQuantityInvalid', 'Total quantity exceeds remaining quantity');
    }
    if (!VALID_TARGET_CONDITIONS.includes(dto.targetCondition)) {
      throw this.badRequest('stock.invalidCondition', 'Invalid target condition');
    }

    const oldBalance = await this.conditionService.getBalanceByKey(order.sparePartId, order.warehouseId, order.sourceCondition);
    if (oldBalance.availableQuantity < totalQty) {
      throw this.badRequest('stock.insufficientConditionBalance', 'Insufficient available condition balance');
    }

    await this.prisma.$transaction(async (tx: any) => {
      if (dto.repairedQuantity > 0) {
        await this.recordConditionMovementInTx(tx, {
          sparePartId: order.sparePartId,
          productId: order.productId || '',
          warehouseId: order.warehouseId,
          condition: order.sourceCondition,
          direction: 'OUT',
          quantity: dto.repairedQuantity,
          sourceType: 'REPAIR_COMPLETE_PARTIAL',
          sourceId: id,
          maintenanceRequestId: order.maintenanceRequestId || null,
          notes: `Partial repair - condition conversion from ${order.sourceCondition} to ${dto.targetCondition}`,
        }, userId);

        await this.recordConditionMovementInTx(tx, {
          sparePartId: order.sparePartId,
          productId: order.productId || '',
          warehouseId: order.warehouseId,
          condition: dto.targetCondition,
          direction: 'IN',
          quantity: dto.repairedQuantity,
          sourceType: 'REPAIR_COMPLETE_PARTIAL',
          sourceId: id,
          maintenanceRequestId: order.maintenanceRequestId || null,
          notes: `Partial repair - returned as ${dto.targetCondition}`,
        }, userId);
      }

      if (dto.scrappedQuantity > 0) {
        await this.recordConditionMovementInTx(tx, {
          sparePartId: order.sparePartId,
          productId: order.productId || '',
          warehouseId: order.warehouseId,
          condition: order.sourceCondition,
          direction: 'OUT',
          quantity: dto.scrappedQuantity,
          sourceType: 'REPAIR_SCRAPPED',
          sourceId: id,
          maintenanceRequestId: order.maintenanceRequestId || null,
          notes: `Scrapped during partial repair`,
        }, userId);
      }

      const newRemaining = order.remainingQuantity - totalQty;
      await this.claimStatusInTx(tx, id, order.status, {
        status: 'COMPLETED_PARTIAL',
        repairedQuantity: (order.repairedQuantity || 0) + dto.repairedQuantity,
        scrappedQuantity: (order.scrappedQuantity || 0) + dto.scrappedQuantity,
        remainingQuantity: newRemaining,
        targetCondition: dto.targetCondition,
        notes: dto.notes || null,
        completedAt: new Date(),
        closedByUserId: userId,
        reservedQuantity: 0,
      });
    });

    await this.audit.log(userId, 'SPARE_PART_REPAIR_COMPLETED_PARTIAL', 'SparePartRepairOrder', id, {
      repairedQuantity: dto.repairedQuantity, scrappedQuantity: dto.scrappedQuantity,
    });

    return this.findById(id, ctx);
  }

  // ── COMPLETE NOT REPAIRABLE ──────────────────────────────────

  /**
   * R2-F — UNDER_TEST -> COMPLETED_NOT_REPAIRABLE. This terminal outcome had no
   * producer at all before R2-F.
   *
   * Inventory semantics: the tested quantity leaves the source condition pool
   * permanently — one OUT movement and no IN movement. It is deliberately NOT
   * returned to any condition, because a part that is not repairable is not
   * serviceable stock, and leaving it in USED_REPAIRABLE would keep an unusable
   * part reservable forever. The existing model has no other quantity bucket for
   * it, so it is accounted in scrappedQuantity, which is the same treatment
   * completePartial already gives to its scrapped leg.
   */
  async completeNotRepairable(id: string, dto: CompleteNotRepairableDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.loadForAction(id, 'COMPLETED_NOT_REPAIRABLE', ctx);
    await this.assertSourceWarehouseInContext(order, ctx);

    if (dto.notRepairableQuantity <= 0) {
      throw this.badRequest('validation.invalidQuantity', 'Quantity must be greater than zero');
    }
    if (dto.notRepairableQuantity > order.remainingQuantity) {
      throw this.badRequest('maintenance.repairQuantityInvalid', 'Not-repairable quantity exceeds remaining quantity');
    }
    if (!(dto.reason || '').trim()) {
      throw this.badRequest('validation.required', 'A reason is required when completing as not repairable');
    }

    const oldBalance = await this.conditionService.getBalanceByKey(order.sparePartId, order.warehouseId, order.sourceCondition);
    if (oldBalance.availableQuantity < dto.notRepairableQuantity) {
      throw this.badRequest('stock.insufficientConditionBalance', 'Insufficient available condition balance');
    }

    await this.prisma.$transaction(async (tx: any) => {
      const outMovement = await this.recordConditionMovementInTx(tx, {
        sparePartId: order.sparePartId,
        productId: order.productId || '',
        warehouseId: order.warehouseId,
        condition: order.sourceCondition,
        direction: 'OUT',
        quantity: dto.notRepairableQuantity,
        sourceType: 'REPAIR_NOT_REPAIRABLE',
        sourceId: id,
        maintenanceRequestId: order.maintenanceRequestId || null,
        notes: `Not repairable after test: ${dto.reason}`,
      }, userId);

      await this.claimStatusInTx(tx, id, order.status, {
        status: 'COMPLETED_NOT_REPAIRABLE',
        scrappedQuantity: (order.scrappedQuantity || 0) + dto.notRepairableQuantity,
        remainingQuantity: order.remainingQuantity - dto.notRepairableQuantity,
        // R2-F — the reason belongs with the failure evidence, NOT on top of
        // inspectionResult. The inspection verdict recorded at the inspection
        // step is the first thing a reader needs, so it is never overwritten;
        // the test outcome is appended to the failure description instead.
        failureDescription: order.failureDescription
          ? `${order.failureDescription} | Not repairable after test: ${dto.reason}`
          : `Not repairable after test: ${dto.reason}`,
        conditionOutMovementId: outMovement.id,
        notes: dto.notes || null,
        completedAt: new Date(),
        closedByUserId: userId,
        reservedQuantity: 0,
      });
    });

    await this.audit.log(userId, 'SPARE_PART_REPAIR_COMPLETED_NOT_REPAIRABLE', 'SparePartRepairOrder', id, {
      notRepairableQuantity: dto.notRepairableQuantity, reason: dto.reason,
    });

    return this.findById(id, ctx);
  }

  // ── SCRAP ────────────────────────────────────────────────────

  async scrap(id: string, dto: ScrapRepairOrderDto, userId: string, ctx: ActiveOperationalContext) {
    // R2-F: the guard restricts scrap to the states the canonical map allows
    // (INSPECTION_FAILED, UNDER_REPAIR). Previously only already-finished orders
    // were rejected, so scrap was accepted from DRAFT/OPEN/IN_INSPECTION/
    // APPROVED_FOR_REPAIR/WAITING_PARTS/UNDER_TEST.
    const order = await this.loadForAction(id, 'SCRAPPED', ctx);
    await this.assertSourceWarehouseInContext(order, ctx);

    if (dto.scrappedQuantity <= 0) throw this.badRequest('validation.invalidQuantity', 'Quantity must be greater than zero');
    if (dto.scrappedQuantity > order.remainingQuantity) {
      throw this.badRequest('maintenance.repairQuantityInvalid', 'Scrapped quantity exceeds remaining quantity');
    }

    const oldBalance = await this.conditionService.getBalanceByKey(order.sparePartId, order.warehouseId, order.sourceCondition);
    if (oldBalance.availableQuantity < dto.scrappedQuantity) {
      throw this.badRequest('stock.insufficientConditionBalance', 'Insufficient available condition balance');
    }

    await this.prisma.$transaction(async (tx: any) => {
      await this.recordConditionMovementInTx(tx, {
        sparePartId: order.sparePartId,
        productId: order.productId || '',
        warehouseId: order.warehouseId,
        condition: order.sourceCondition,
        direction: 'OUT',
        quantity: dto.scrappedQuantity,
        sourceType: 'REPAIR_SCRAPPED',
        sourceId: id,
        maintenanceRequestId: order.maintenanceRequestId || null,
        notes: dto.reason || `Spare part scrapped - not repairable`,
      }, userId);

      await this.claimStatusInTx(tx, id, order.status, {
        status: 'SCRAPPED',
        scrappedQuantity: (order.scrappedQuantity || 0) + dto.scrappedQuantity,
        remainingQuantity: order.remainingQuantity - dto.scrappedQuantity,
        completedAt: new Date(),
        closedByUserId: userId,
        notes: dto.notes || order.notes,
        reservedQuantity: 0,
      });
    });

    await this.audit.log(userId, 'SPARE_PART_REPAIR_SCRAPPED', 'SparePartRepairOrder', id, {
      scrappedQuantity: dto.scrappedQuantity, reason: dto.reason,
    });

    return this.findById(id, ctx);
  }

  // ── CANCEL ───────────────────────────────────────────────────

  async cancel(id: string, dto: CancelRepairOrderDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.loadForAction(id, 'CANCELLED', ctx);
    if (!(dto.reason || '').trim()) {
      throw this.badRequest('maintenance.repairCancelReasonRequired', 'Cancel reason is required');
    }

    const updated = await this.prisma.$transaction(async (tx: any) => {
      await this.claimStatusInTx(tx, id, order.status, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.reason,
        notes: dto.notes || order.notes,
        reservedQuantity: 0,
        closedByUserId: userId,
      });
      return tx.sparePartRepairOrder.findUnique({ where: { id } });
    });

    await this.audit.log(userId, 'SPARE_PART_REPAIR_CANCELLED', 'SparePartRepairOrder', id, {
      reason: dto.reason,
    });

    return updated;
  }

  // ── ACTIONS ───────────────────────────────────────────────────

  async getActions(repairOrderId: string, ctx: ActiveOperationalContext) {
    await this.orderAccess(repairOrderId, ctx);

    return this.prisma.sparePartRepairAction.findMany({
      where: { repairOrderId },
      orderBy: { performedAt: 'asc' },
    });
  }

  /**
   * R2-F — single writer for repair actions, so an action recorded by a state
   * transition and one recorded by the user go through identical evidence and
   * identical terminal-state rules.
   */
  private async recordAction(repairOrderId: string, dto: CreateRepairActionDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.orderAccess(repairOrderId, ctx);
    if (TERMINAL_REPAIR_STATUSES.includes(order.status as any)) {
      throw this.badRequest('maintenance.repairAlreadyCompleted', 'Repair order already completed or cancelled');
    }

    const action = await this.prisma.sparePartRepairAction.create({
      data: {
        repairOrderId,
        actionType: dto.actionType,
        actionStatus: dto.actionStatus || 'DONE',
        description: dto.description || null,
        result: dto.result || null,
        performedByUserId: dto.performedByUserId || userId,
        performedAt: dto.performedAt ? new Date(dto.performedAt) : new Date(),
        durationMinutes: dto.durationMinutes || null,
        notes: dto.notes || null,
      },
    });

    await this.audit.log(userId, 'SPARE_PART_REPAIR_ACTION_ADDED', 'SparePartRepairAction', action.id, {
      repairOrderId, actionType: dto.actionType,
    });

    return action;
  }

  async addAction(repairOrderId: string, dto: CreateRepairActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.recordAction(repairOrderId, dto, userId, ctx);
  }

  // ── INTERNAL HELPERS ─────────────────────────────────────────

  private async recordConditionMovementInTx(tx: any, data: {
    sparePartId: string; productId: string; warehouseId: string; condition: string;
    direction: string; quantity: number; sourceType: string; sourceId: string;
    maintenanceRequestId: string | null; notes: string;
  }, userId: string) {
    const balanceKey = { sparePartId: data.sparePartId, warehouseId: data.warehouseId, condition: data.condition };
    let balance = await tx.sparePartConditionBalance.findFirst({
      where: { sparePartKey: balanceKey.sparePartId, warehouseKey: balanceKey.warehouseId, condition: balanceKey.condition },
    });
    if (!balance) {
      balance = await tx.sparePartConditionBalance.create({
        data: {
          sparePartId: balanceKey.sparePartId,
          sparePartKey: balanceKey.sparePartId,
          productId: data.productId || null,
          warehouseId: balanceKey.warehouseId,
          warehouseKey: balanceKey.warehouseId,
          condition: balanceKey.condition,
          quantity: 0,
          availableQuantity: 0,
        },
      });
    }

    // R2-F — the balance is mutated with a conditional (compare-and-set) update
    // rather than a read-modify-write. Two concurrent completions that both read
    // the same `quantity` would each compute their own new value and the last
    // writer would win, letting a condition balance go negative. Putting the
    // sufficiency precondition in the `where` clause makes the check and the
    // write a single atomic row operation, so the guard cannot be raced past.
    const isIn = data.direction === 'IN';
    const updated = await tx.sparePartConditionBalance.updateMany({
      where: isIn
        ? { id: balance.id }
        : { id: balance.id, quantity: { gte: data.quantity }, availableQuantity: { gte: data.quantity } },
      data: {
        quantity: isIn ? { increment: data.quantity } : { decrement: data.quantity },
        availableQuantity: isIn ? { increment: data.quantity } : { decrement: data.quantity },
        lastMovementAt: new Date(),
        ...(data.productId ? { productId: data.productId } : {}),
      },
    });

    if (updated.count !== 1) {
      throw this.badRequest('stock.insufficientConditionBalance', 'Insufficient available condition balance');
    }

    const movementNumber = await this.numberingService.generateNumberAtomicWithClient('SPARE_PART_CONDITION_MOVEMENT', tx);

    return tx.sparePartConditionMovement.create({
      data: {
        movementNumber,
        sparePartId: data.sparePartId,
        productId: data.productId || null,
        warehouseId: data.warehouseId,
        condition: data.condition,
        direction: data.direction,
        quantity: data.quantity,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        maintenanceRequestId: data.maintenanceRequestId || null,
        notes: data.notes || null,
        createdByUserId: userId,
      },
    });
  }
}
