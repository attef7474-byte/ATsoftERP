import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { SparePartConditionService } from '../spare-part-conditions/spare-part-conditions.service';
import {
  QueryRepairOrderDto, CreateRepairOrderDto, CreateRepairOrderFromReplacementDto,
  CompleteServiceableDto, CompletePartialDto, ScrapRepairOrderDto,
  CancelRepairOrderDto, CreateRepairActionDto, QueryRepairablePartsDto,
} from './dto/repair-order.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const VALID_SOURCE_CONDITIONS = ['USED_REPAIRABLE', 'DAMAGED_REPAIRABLE'];
const VALID_TARGET_CONDITIONS = ['USED_SERVICEABLE', 'USED_REPAIRABLE'];
const FORBIDDEN_SOURCE_CONDITIONS = ['NEW'];

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

  async findRepairableQueue(query: QueryRepairablePartsDto, ctx: ActiveOperationalContext) {
    const where: any = { removedReturnedToStock: true, machine: this.machineScope(ctx) };
    if (query.condition) where.removedCondition = query.condition;
    if (query.machineId) {
      await this.machineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    if (query.sparePartId) { where.newSparePartId = query.sparePartId; }

    const histories = await this.prisma.sparePartReplacementHistory.findMany({
      where,
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        newSparePart: { select: { id: true, code: true, name: true, productId: true, unit: true } },
        oldSparePart: { select: { id: true, code: true, name: true } },
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

      const conditionBalances = await this.prisma.sparePartConditionBalance.findMany({
        where: {
          sparePartId: h.newSparePartId,
          condition: h.removedCondition || undefined,
          quantity: { gt: 0 },
        },
        select: { id: true, warehouseId: true, condition: true, quantity: true, availableQuantity: true, warehouse: { select: { id: true, code: true, name: true, warehouseType: true } } },
      });

      results.push({
        replacementHistoryId: h.id,
        replacedAt: h.replacedAt,
        sparePart: h.newSparePart,
        oldSparePart: h.oldSparePart,
        machine: h.machine,
        machineComponent: h.machineComponent,
        maintenanceRequest: h.maintenanceRequest,
        removedCondition: h.removedCondition,
        removedQuantity: h.removedQuantity,
        conditionInMovementId: h.conditionInMovementId,
        availableBalances: conditionBalances,
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

    const sparePartId = fullHistory.newSparePartId;
    const productId = fullHistory.newSparePart.productId;

    const existing = await this.prisma.sparePartRepairOrder.findFirst({
      where: { replacementHistoryId: history.id, status: { notIn: ['CANCELLED', 'SCRAPPED', 'COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE'] } },
    });
    if (existing) throw this.badRequest('maintenance.repairOrderAlreadyExists', 'An active repair order already exists for this source');

    const conditionBalances = await this.prisma.sparePartConditionBalance.findMany({
      where: { sparePartId, condition: fullHistory.removedCondition, availableQuantity: { gt: 0 } },
      select: { warehouseId: true, quantity: true, availableQuantity: true },
      orderBy: { availableQuantity: 'desc' },
    });
    if (conditionBalances.length === 0) throw this.badRequest('stock.insufficientConditionBalance', 'No available condition balance for the removed part');

    const warehouseId = conditionBalances[0].warehouseId;
    const sourceQuantity = fullHistory.removedQuantity || conditionBalances[0].availableQuantity;

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
      sourceQuantity: Math.min(sourceQuantity, conditionBalances[0].availableQuantity),
      sourceType: 'REPLACEMENT_HISTORY',
      sourceId: history.id,
      maintenanceRequestId: fullHistory.maintenanceRequestId || undefined,
      requiredPartId: fullHistory.requiredPartId || undefined,
      replacementHistoryId: history.id,
      installedPartId: fullHistory.newInstalledPartId || undefined,
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

  private async transition(id: string, newStatus: string, userId: string, ctx: ActiveOperationalContext, extra?: Record<string, any>) {
    const order = await this.orderAccess(id, ctx);

    if (order.status === newStatus) {
      throw this.badRequest('maintenance.repairAlreadyInStatus', `Repair order is already in status ${newStatus}`);
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(newStatus)) {
      throw this.badRequest('maintenance.invalidRepairTransition', 'Invalid status transition for this repair order');
    }

    const data: any = { status: newStatus, ...(extra || {}) };
    if (newStatus === 'CANCELLED') {
      if (!extra?.cancelReason) throw this.badRequest('maintenance.repairCancelReasonRequired', 'Cancel reason is required');
      data.cancelledAt = new Date();
    }
    if (newStatus === 'IN_INSPECTION') data.inspectionStartedAt = new Date();
    if (newStatus === 'UNDER_REPAIR') data.repairStartedAt = new Date();
    if (newStatus === 'UNDER_TEST') data.testStartedAt = new Date();
    if (['COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE', 'SCRAPPED'].includes(newStatus)) {
      data.completedAt = new Date();
      data.closedByUserId = userId;
    }

    const updated = await this.prisma.sparePartRepairOrder.update({ where: { id }, data });

    await this.audit.log(userId, `SPARE_PART_REPAIR_${newStatus}`, 'SparePartRepairOrder', id, {
      previousStatus: order.status, newStatus, ...extra,
    });

    return updated;
  }

  async startInspection(id: string, dto: any, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'IN_INSPECTION', userId, ctx, { inspectedByUserId: userId });
  }

  async approveRepair(id: string, dto: any, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'APPROVED_FOR_REPAIR', userId, ctx);
  }

  async startRepair(id: string, dto: any, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'UNDER_REPAIR', userId, ctx, { repairedByUserId: userId });
  }

  async startTest(id: string, dto: any, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'UNDER_TEST', userId, ctx, { testedByUserId: userId });
  }

  // ── COMPLETE SERVICEABLE ─────────────────────────────────────

  async completeServiceable(id: string, dto: CompleteServiceableDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.orderAccess(id, ctx);

    if (order.status === 'COMPLETED_SERVICEABLE' || order.status === 'COMPLETED_PARTIAL') {
      throw this.badRequest('maintenance.repairAlreadyCompleted', 'Repair order already completed');
    }

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
      await tx.sparePartRepairOrder.update({
        where: { id },
        data: {
          status: 'COMPLETED_SERVICEABLE',
          repairedQuantity: (order.repairedQuantity || 0) + sourceDecreaseQty,
          remainingQuantity: newRemaining,
          targetCondition: dto.targetCondition,
          conditionOutMovementId: outMovement.id,
          conditionInMovementId: inMovement.id,
          testResult: dto.testResult || null,
          testNotes: dto.testNotes || null,
          repairDescription: dto.repairDescription || null,
          completedAt: new Date(),
          closedByUserId: userId,
        },
      });
    });

    await this.audit.log(userId, 'SPARE_PART_REPAIR_COMPLETED_SERVICEABLE', 'SparePartRepairOrder', id, {
      repairedQuantity: dto.repairedQuantity, targetCondition: dto.targetCondition,
    });

    return this.findById(id, ctx);
  }

  // ── COMPLETE PARTIAL ─────────────────────────────────────────

  async completePartial(id: string, dto: CompletePartialDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.orderAccess(id, ctx);
    if (order.status === 'COMPLETED_SERVICEABLE' || order.status === 'COMPLETED_PARTIAL') {
      throw this.badRequest('maintenance.repairAlreadyCompleted', 'Repair order already completed');
    }

    const totalQty = dto.repairedQuantity + dto.scrappedQuantity;
    if (totalQty <= 0) throw this.badRequest('validation.invalidQuantity', 'Quantity must be greater than zero');
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
      await tx.sparePartRepairOrder.update({
        where: { id },
        data: {
          status: 'COMPLETED_PARTIAL',
          repairedQuantity: (order.repairedQuantity || 0) + dto.repairedQuantity,
          scrappedQuantity: (order.scrappedQuantity || 0) + dto.scrappedQuantity,
          remainingQuantity: newRemaining,
          targetCondition: dto.targetCondition,
          completedAt: new Date(),
          closedByUserId: userId,
        },
      });
    });

    await this.audit.log(userId, 'SPARE_PART_REPAIR_COMPLETED_PARTIAL', 'SparePartRepairOrder', id, {
      repairedQuantity: dto.repairedQuantity, scrappedQuantity: dto.scrappedQuantity,
    });

    return this.findById(id, ctx);
  }

  // ── SCRAP ────────────────────────────────────────────────────

  async scrap(id: string, dto: ScrapRepairOrderDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.orderAccess(id, ctx);
    if (['COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'SCRAPPED', 'CANCELLED'].includes(order.status)) {
      throw this.badRequest('maintenance.repairAlreadyCompleted', 'Repair order already completed or cancelled');
    }

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

      await tx.sparePartRepairOrder.update({
        where: { id },
        data: {
          status: 'SCRAPPED',
          scrappedQuantity: (order.scrappedQuantity || 0) + dto.scrappedQuantity,
          remainingQuantity: order.remainingQuantity - dto.scrappedQuantity,
          completedAt: new Date(),
          closedByUserId: userId,
          notes: dto.notes || order.notes,
        },
      });
    });

    await this.audit.log(userId, 'SPARE_PART_REPAIR_SCRAPPED', 'SparePartRepairOrder', id, {
      scrappedQuantity: dto.scrappedQuantity, reason: dto.reason,
    });

    return this.findById(id, ctx);
  }

  // ── CANCEL ───────────────────────────────────────────────────

  async cancel(id: string, dto: CancelRepairOrderDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.orderAccess(id, ctx);
    if (['COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'SCRAPPED'].includes(order.status)) {
      throw this.badRequest('maintenance.repairAlreadyCompleted', 'Repair order already completed');
    }
    if (order.status === 'CANCELLED') {
      throw this.badRequest('maintenance.repairAlreadyInStatus', 'Repair order is already cancelled');
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes('CANCELLED')) {
      throw this.badRequest('maintenance.invalidRepairTransition', 'Invalid status transition for this repair order');
    }

    const updated = await this.prisma.sparePartRepairOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.reason,
        notes: dto.notes || order.notes,
        reservedQuantity: 0,
      },
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

  async addAction(repairOrderId: string, dto: CreateRepairActionDto, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.orderAccess(repairOrderId, ctx);
    if (['COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'SCRAPPED', 'CANCELLED'].includes(order.status)) {
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

  // ── INTERNAL HELPERS ─────────────────────────────────────────

  private async recordConditionMovementInTx(tx: any, data: {
    sparePartId: string; productId: string; warehouseId: string; condition: string;
    direction: string; quantity: number; sourceType: string; sourceId: string;
    maintenanceRequestId: string | null; notes: string;
  }, userId: string) {
    const balanceKey = { sparePartId: data.sparePartId, warehouseId: data.warehouseId, condition: data.condition };
    let balance = await tx.sparePartConditionBalance.findFirst({
      where: { sparePartId: balanceKey.sparePartId, warehouseId: balanceKey.warehouseId, condition: balanceKey.condition },
    });
    if (!balance) {
      balance = await tx.sparePartConditionBalance.create({
        data: {
          sparePartId: balanceKey.sparePartId,
          productId: data.productId || null,
          warehouseId: balanceKey.warehouseId,
          condition: balanceKey.condition,
          quantity: 0,
          availableQuantity: 0,
        },
      });
    }

    const delta = data.direction === 'IN' ? data.quantity : -data.quantity;
    const newQuantity = balance.quantity + delta;
    const newAvailable = balance.availableQuantity + delta;

    if (newQuantity < 0 || newAvailable < 0) {
      throw this.badRequest('stock.insufficientConditionBalance', 'Insufficient available condition balance');
    }

    await tx.sparePartConditionBalance.update({
      where: { id: balance.id },
      data: {
        quantity: newQuantity,
        availableQuantity: newAvailable,
        lastMovementAt: new Date(),
        productId: data.productId || balance.productId,
      },
    });

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
