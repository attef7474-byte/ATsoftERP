import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { AttachmentsService } from '../../documents/attachments/attachments.service';
import { ProductionCapacityStandardsService } from '../production-capacity-standards/production-capacity-standards.service';
import { ProductionMaterialRequirementsService } from '../production-material-requirements/production-material-requirements.service';
import { CAPACITY_OUTPUT_UNITS, CAPACITY_TIME_BASES } from '../production-capacity-standards/production-capacity.constants';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { ProductionOrderQueryDto } from './dto/production-order-query.dto';
import { ProductionOrderActionDto, ProductionOrderReasonActionDto } from './dto/production-order-action.dto';
import { calculatePlannedDuration } from './production-order-duration';
import {
  PRODUCTION_ORDER_ARCHIVABLE_STATUSES,
  PRODUCTION_ORDER_ATTACHMENT_ENTITY,
  PRODUCTION_ORDER_AUDIT_ENTITY,
  PRODUCTION_ORDER_CANCELLABLE_STATUSES,
  PRODUCTION_ORDER_EDITABLE_STATUSES,
  PRODUCTION_ORDER_NUMBER_SEQUENCE,
} from './production-order.constants';

const orderInclude = {
  productionProductDefinition: { select: { id: true, code: true, name: true } },
  productionVersion: { select: { id: true, versionNumber: true, versionLabel: true } },
  productionPackaging: { select: { id: true, packagingType: true, packQuantity: true } },
  productionUnit: { select: { id: true, code: true, name: true, abbreviation: true } },
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
  costCenter: { select: { id: true, code: true, name: true } },
  issueWarehouse: { select: { id: true, code: true, name: true } },
  receiptWarehouse: { select: { id: true, code: true, name: true } },
  capacityStandard: { select: { id: true, code: true, revision: true, status: true } },
};

@Injectable()
export class ProductionOrdersService {
  private readonly model: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly capacityStandards: ProductionCapacityStandardsService,
    private readonly attachments: AttachmentsService,
    private readonly materialRequirements: ProductionMaterialRequirementsService,
  ) {
    this.model = (prisma as any).productionOrder;
  }

  async create(dto: CreateProductionOrderDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.model.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId, deletedAt: null },
      include: orderInclude,
    });
    if (existing) {
      if (!this.sameCreateIntent(existing, dto)) throw new ConflictException({ messageKey: 'productionOrder.idempotencyConflict' });
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const txModel = (tx as any).productionOrder;
        const raced = await txModel.findFirst({
          where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId, deletedAt: null },
          include: orderInclude,
        });
        if (raced) return raced;

        const planning = await this.buildPlanningData(dto, ctx, tx);
        const orderNumber = await this.numbering.generateNumberAtomicWithClient(PRODUCTION_ORDER_NUMBER_SEQUENCE, tx);
        const created = await txModel.create({
          data: {
            ...planning,
            orderNumber,
            clientRequestId: dto.clientRequestId,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            priority: dto.priority || 'NORMAL',
            sourceType: dto.sourceType || 'MANUAL',
            sourceReference: dto.sourceReference || null,
            notes: dto.notes || null,
            status: 'DRAFT',
            createdById: userId,
            updatedById: userId,
          },
          include: orderInclude,
        });
        await this.writeTransition(tx, created, 'NONE', 'DRAFT', 'CREATE', userId, dto.clientRequestId);
        await this.writeAudit(tx, userId, 'CREATE', created, ctx, { snapshot: this.snapshotEvidence(created) });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await this.model.findFirst({
          where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId, deletedAt: null },
          include: orderInclude,
        });
        if (raced && this.sameCreateIntent(raced, dto)) return raced;
        throw new ConflictException({ messageKey: 'productionOrder.duplicate' });
      }
      throw error;
    }
  }

  async findAll(query: ProductionOrderQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.productionProductDefinitionId) where.productionProductDefinitionId = query.productionProductDefinitionId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.dateFrom || query.dateTo) {
      where.plannedStartAt = {};
      if (query.dateFrom) where.plannedStartAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.plannedStartAt.lte = new Date(query.dateTo);
    }
    if (query.search) where.OR = [
      { orderNumber: { contains: query.search } },
      { sourceReference: { contains: query.search } },
      { productionProductDefinition: { name: { contains: query.search } } },
    ];
    const [data, total] = await Promise.all([
      this.model.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ plannedStartAt: 'desc' }, { createdAt: 'desc' }], include: orderInclude }),
      this.model.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx, this.prisma, true);
  }

  async preview(dto: CreateProductionOrderDto, ctx: ActiveOperationalContext) {
    const planningData = await this.buildPlanningData(dto, ctx, this.prisma);
    return {
      snapshot: this.snapshotEvidence(planningData),
      capacityStandardId: planningData.capacityStandardId,
      capacityStandardCode: planningData.capacityStandardCodeSnapshot,
      capacityStandardRevision: planningData.capacityStandardRevisionSnapshot,
      matchedMachineId: planningData.capacityMachineIdSnapshot,
      plannedGrossQuantity: planningData.plannedGrossQuantity.toString(),
      plannedRunMinutes: planningData.plannedRunMinutes.toString(),
      plannedAllowanceMinutes: planningData.plannedAllowanceMinutes.toString(),
      plannedDurationMinutes: planningData.plannedDurationMinutes.toString(),
    };
  }

  async update(id: string, dto: UpdateProductionOrderDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOwned(id, ctx, tx);
      this.assertEditable(current);
      this.assertLock(current, dto.lockVersion);
      const input = { ...this.materialInput(current), ...dto } as any;
      delete input.lockVersion;
      const planning = await this.buildPlanningData(input, ctx, tx);
      const count = await (tx as any).productionOrder.updateMany({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, lockVersion: dto.lockVersion, deletedAt: null },
        data: {
          ...planning,
          priority: dto.priority ?? current.priority,
          sourceType: dto.sourceType ?? current.sourceType,
          sourceReference: dto.sourceReference === undefined ? current.sourceReference : dto.sourceReference,
          notes: dto.notes === undefined ? current.notes : dto.notes,
          updatedById: userId,
          lockVersion: { increment: 1 },
        },
      });
      if (count.count !== 1) throw new ConflictException({ messageKey: 'productionOrder.staleVersion' });
      const updated = await this.findOwned(id, ctx, tx, true);
      await this.writeAudit(tx, userId, 'UPDATE', updated, ctx, { before: this.auditMaterial(current), after: this.auditMaterial(updated) });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async recalculate(id: string, dto: ProductionOrderActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await this.findDuplicateAction(tx, id, dto.requestId, 'RECALCULATE', ctx);
      if (duplicate) return duplicate;
      const current = await this.findOwned(id, ctx, tx);
      this.assertEditable(current);
      this.assertLock(current, dto.lockVersion);
      const planning = await this.buildPlanningData(this.materialInput(current), ctx, tx);
      const count = await (tx as any).productionOrder.updateMany({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, lockVersion: dto.lockVersion, deletedAt: null },
        data: { ...planning, updatedById: userId, lockVersion: { increment: 1 } },
      });
      if (count.count !== 1) throw new ConflictException({ messageKey: 'productionOrder.staleVersion' });
      const updated = await this.findOwned(id, ctx, tx, true);
      await this.writeTransition(tx, updated, current.status, current.status, 'RECALCULATE', userId, dto.requestId, undefined, JSON.stringify(this.snapshotEvidence(updated)));
      await this.writeAudit(tx, userId, 'RECALCULATE', updated, ctx, { before: this.snapshotEvidence(current), after: this.snapshotEvidence(updated) });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async plan(id: string, dto: ProductionOrderActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await this.findDuplicateAction(tx, id, dto.requestId, 'PLAN', ctx);
      if (duplicate) return duplicate;
      const current = await this.findOwned(id, ctx, tx);
      if (current.status !== 'DRAFT') throw new ConflictException({ messageKey: 'productionOrder.planStateInvalid' });
      this.assertLock(current, dto.lockVersion);
      const planning = await this.buildPlanningData(this.materialInput(current), ctx, tx);
      const now = new Date();
      const count = await (tx as any).productionOrder.updateMany({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, status: 'DRAFT', lockVersion: dto.lockVersion, deletedAt: null },
        data: { ...planning, status: 'PLANNED', plannedById: userId, plannedAt: now, updatedById: userId, lockVersion: { increment: 1 } },
      });
      if (count.count !== 1) throw new ConflictException({ messageKey: 'productionOrder.staleVersion' });
      const updated = await this.findOwned(id, ctx, tx, true);
      await this.writeTransition(tx, updated, 'DRAFT', 'PLANNED', 'PLAN', userId, dto.requestId, undefined, JSON.stringify(this.snapshotEvidence(updated)));
      await this.writeAudit(tx, userId, 'PLAN', updated, ctx, { snapshot: this.snapshotEvidence(updated) });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async readiness(id: string, ctx: ActiveOperationalContext) {
    const order = await this.findOwned(id, ctx);
    return this.evaluateReadiness(order, ctx, this.prisma);
  }

  async release(id: string, dto: ProductionOrderActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await this.findDuplicateAction(tx, id, dto.requestId, 'RELEASE', ctx);
      if (duplicate) return duplicate;
      const current = await this.findOwned(id, ctx, tx);
      if (current.status !== 'PLANNED') throw new ConflictException({ messageKey: 'productionOrder.releaseStateInvalid' });
      this.assertLock(current, dto.lockVersion);
      const readiness = await this.evaluateReadiness(current, ctx, tx);
      if (!readiness.ready) throw new BadRequestException({ messageKey: 'productionOrder.notReady', details: readiness });
      const now = new Date();
      const count = await (tx as any).productionOrder.updateMany({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, status: 'PLANNED', lockVersion: dto.lockVersion, deletedAt: null },
        data: {
          ...readiness.planningData,
          status: 'RELEASED',
          releasedById: userId,
          releasedAt: now,
          snapshotFrozenAt: now,
          updatedById: userId,
          lockVersion: { increment: 1 },
        },
      });
      if (count.count !== 1) throw new ConflictException({ messageKey: 'productionOrder.staleVersion' });
      const updated = await this.findOwned(id, ctx, tx, true);
      await this.materialRequirements.freezeForRelease(id, userId, ctx, tx);
      const evidence = JSON.stringify({ blockers: readiness.blockers, warnings: readiness.warnings, snapshot: this.snapshotEvidence(updated) });
      await this.writeTransition(tx, updated, 'PLANNED', 'RELEASED', 'RELEASE', userId, dto.requestId, undefined, evidence);
      await this.writeAudit(tx, userId, 'RELEASE', updated, ctx, { readiness: { blockers: readiness.blockers, warnings: readiness.warnings }, snapshot: this.snapshotEvidence(updated) });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async cancel(id: string, dto: ProductionOrderReasonActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.reasonTransition(id, dto, userId, ctx, 'CANCEL', 'CANCELLED', PRODUCTION_ORDER_CANCELLABLE_STATUSES, {
      cancelledById: userId,
      cancelledAt: new Date(),
      cancellationReason: dto.reason,
    });
  }

  async archive(id: string, dto: ProductionOrderReasonActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.reasonTransition(id, dto, userId, ctx, 'ARCHIVE', 'ARCHIVED', PRODUCTION_ORDER_ARCHIVABLE_STATUSES, {
      archivedById: userId,
      archivedAt: new Date(),
      archiveReason: dto.reason,
    });
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOwned(id, ctx, tx);
      if (current.status !== 'DRAFT') throw new ConflictException({ messageKey: 'productionOrder.deleteDraftOnly' });
      const updated = await (tx as any).productionOrder.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById: userId, lockVersion: { increment: 1 } },
      });
      await this.writeAudit(tx, userId, 'DELETE_DRAFT', current, ctx, { orderNumber: current.orderNumber });
      return updated;
    });
  }

  async history(id: string, ctx: ActiveOperationalContext) {
    const order = await this.findOwned(id, ctx);
    const [transitions, audits] = await Promise.all([
      (this.prisma as any).productionOrderTransition.findMany({
        where: { productionOrderId: id, companyId: ctx.companyId, branchId: ctx.branchId },
        orderBy: { createdAt: 'asc' },
      }),
      (this.prisma as any).auditLog.findMany({
        where: { entity: PRODUCTION_ORDER_AUDIT_ENTITY, entityId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, userId: true, action: true, details: true, createdAt: true },
      }),
    ]);
    return { orderId: order.id, orderNumber: order.orderNumber, transitions, audits };
  }

  async addAttachment(id: string, file: Express.Multer.File, description: string | undefined, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.findOwned(id, ctx);
    if (order.status === 'ARCHIVED') throw new ConflictException({ messageKey: 'productionOrder.archivedReadOnly' });
    const attachment = await this.attachments.create(file, PRODUCTION_ORDER_ATTACHMENT_ENTITY, id, description, userId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const link = await (tx as any).productionOrderAttachment.create({
          data: { companyId: ctx.companyId, branchId: ctx.branchId, productionOrderId: id, attachmentId: attachment.id, uploadedById: userId },
          include: { attachment: true },
        });
        await this.writeAudit(tx, userId, 'ATTACH', order, ctx, { attachmentId: attachment.id, originalName: attachment.originalName });
        return link;
      });
    } catch (error) {
      await this.attachments.remove(attachment.id);
      throw error;
    }
  }

  async listAttachments(id: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    return (this.prisma as any).productionOrderAttachment.findMany({
      where: { productionOrderId: id, companyId: ctx.companyId, branchId: ctx.branchId },
      orderBy: { createdAt: 'desc' },
      include: { attachment: true },
    });
  }

  async getOwnedAttachment(id: string, attachmentId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const link = await (this.prisma as any).productionOrderAttachment.findFirst({
      where: { productionOrderId: id, attachmentId, companyId: ctx.companyId, branchId: ctx.branchId },
      include: { attachment: true },
    });
    if (!link) throw new NotFoundException({ messageKey: 'productionOrder.attachmentNotFound' });
    return { ...link, filePath: this.attachments.getFilePath(link.attachment) };
  }

  async removeAttachment(id: string, attachmentId: string, userId: string, ctx: ActiveOperationalContext) {
    const order = await this.findOwned(id, ctx);
    const link = await this.getOwnedAttachment(id, attachmentId, ctx);
    await this.prisma.$transaction(async (tx) => {
      await (tx as any).productionOrderAttachment.delete({ where: { id: link.id } });
      await this.writeAudit(tx, userId, 'DETACH', order, ctx, { attachmentId });
    });
    await this.attachments.remove(attachmentId);
    return { removed: true };
  }

  private async reasonTransition(
    id: string,
    dto: ProductionOrderReasonActionDto,
    userId: string,
    ctx: ActiveOperationalContext,
    action: string,
    targetStatus: string,
    allowedStatuses: readonly string[],
    extraData: Record<string, any>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await this.findDuplicateAction(tx, id, dto.requestId, action, ctx);
      if (duplicate) return duplicate;
      const current = await this.findOwned(id, ctx, tx);
      if (!allowedStatuses.includes(current.status)) throw new ConflictException({ messageKey: `productionOrder.${action.toLowerCase()}StateInvalid` });
      this.assertLock(current, dto.lockVersion);
      const count = await (tx as any).productionOrder.updateMany({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, status: current.status, lockVersion: dto.lockVersion, deletedAt: null },
        data: { status: targetStatus, ...extraData, updatedById: userId, lockVersion: { increment: 1 } },
      });
      if (count.count !== 1) throw new ConflictException({ messageKey: 'productionOrder.staleVersion' });
      const updated = await this.findOwned(id, ctx, tx, true);
      await this.writeTransition(tx, updated, current.status, targetStatus, action, userId, dto.requestId, dto.reason);
      await this.writeAudit(tx, userId, action, updated, ctx, { fromStatus: current.status, toStatus: targetStatus, reason: dto.reason });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async evaluateReadiness(order: any, ctx: ActiveOperationalContext, client: any) {
    const blockers: Array<{ code: string; field?: string }> = [];
    const warnings: Array<{ code: string; details?: Record<string, any> }> = [];
    let planningData: any = null;
    if (order.status !== 'PLANNED') blockers.push({ code: 'productionOrder.readiness.statusNotPlanned', field: 'status' });
    try {
      planningData = await this.buildPlanningData(this.materialInput(order), ctx, client);
    } catch (error: any) {
      const payload = error?.response || error?.getResponse?.() || {};
      blockers.push({ code: payload.messageKey || payload.errors?.[0]?.code || 'productionOrder.readiness.invalidReferences' });
    }
    if (planningData) {
      const availableMinutes = new Prisma.Decimal(new Date(order.plannedEndAt).getTime() - new Date(order.plannedStartAt).getTime()).div(60000);
      if (availableMinutes.lessThan(planningData.plannedDurationMinutes)) {
        warnings.push({ code: 'productionOrder.readiness.windowShorterThanDuration', details: { availableMinutes: availableMinutes.toDecimalPlaces(4).toString(), requiredMinutes: planningData.plannedDurationMinutes.toString() } });
      }
      const overlaps = await client.productionOrder.findMany({
        where: {
          id: { not: order.id },
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          productionLineId: order.productionLineId,
          status: 'RELEASED',
          deletedAt: null,
          plannedStartAt: { lt: new Date(order.plannedEndAt) },
          plannedEndAt: { gt: new Date(order.plannedStartAt) },
        },
        select: { id: true, orderNumber: true, machineId: true, plannedStartAt: true, plannedEndAt: true },
        take: 5,
      });
      if (overlaps.length) warnings.push({ code: 'productionOrder.readiness.overlapDetected', details: { orders: overlaps } });
    }
    return { ready: blockers.length === 0, blockers, warnings, planningData, snapshotPreview: planningData ? this.snapshotEvidence(planningData) : null };
  }

  private async buildPlanningData(input: any, ctx: ActiveOperationalContext, client: any) {
    const plannedQuantity = this.positiveDecimal(input.plannedQuantity, 'plannedQuantity');
    const plannedStartAt = new Date(input.plannedStartAt);
    const plannedEndAt = new Date(input.plannedEndAt);
    if (!Number.isFinite(plannedStartAt.getTime())) this.invalid('plannedStartAt', 'productionOrder.invalidStartDate');
    if (!Number.isFinite(plannedEndAt.getTime()) || plannedEndAt <= plannedStartAt) this.invalid('plannedEndAt', 'productionOrder.invalidDateRange');
    const refs = await this.validateReferences(input, ctx, client);
    const quantityUnit = String(refs.unit.code).toUpperCase();
    if (!(CAPACITY_OUTPUT_UNITS as readonly string[]).includes(quantityUnit)) this.invalid('productionUnitId', 'productionOrder.incompatibleUnit');
    if (!(CAPACITY_TIME_BASES as readonly string[]).includes(input.capacityTimeBasis)) this.invalid('capacityTimeBasis', 'productionOrder.invalidTimeBasis');

    const capacity = await this.capacityStandards.resolveWithClient({
      productionProductId: input.productionProductDefinitionId,
      productionVersionId: input.productionVersionId,
      productionPackagingId: input.productionPackagingId || undefined,
      productionLineId: input.productionLineId,
      machineId: input.machineId || undefined,
      outputUnit: quantityUnit,
      timeBasis: input.capacityTimeBasis,
      requestedAt: plannedStartAt.toISOString(),
    } as any, ctx, client);

    const duration = calculatePlannedDuration({
      plannedQuantity,
      standardRate: capacity.standardRate,
      timeBasis: capacity.timeBasis,
      targetEfficiencyPercent: capacity.targetEfficiencyPercent,
      expectedYieldPercent: capacity.expectedYieldPercent,
      setupMinutes: capacity.setupMinutes,
      changeoverMinutes: capacity.changeoverMinutes,
      cleaningMinutes: capacity.cleaningMinutes,
      startupAllowanceMinutes: capacity.startupAllowanceMinutes,
      shutdownAllowanceMinutes: capacity.shutdownAllowanceMinutes,
    });

    return {
      productionProductDefinitionId: input.productionProductDefinitionId,
      productionVersionId: input.productionVersionId,
      productionPackagingId: input.productionPackagingId || null,
      productionUnitId: input.productionUnitId,
      productionLineId: input.productionLineId,
      machineId: input.machineId || null,
      plannedQuantity,
      quantityUnit,
      capacityTimeBasis: input.capacityTimeBasis,
      plannedStartAt,
      plannedEndAt,
      costCenterId: input.costCenterId,
      issueWarehouseId: input.issueWarehouseId || null,
      receiptWarehouseId: input.receiptWarehouseId || null,
      capacityStandardId: capacity.id,
      capacityStandardCodeSnapshot: capacity.code,
      capacityStandardRevisionSnapshot: capacity.revision,
      standardRateSnapshot: new Prisma.Decimal(capacity.standardRate),
      outputUnitSnapshot: capacity.outputUnit,
      timeBasisSnapshot: capacity.timeBasis,
      standardCycleTimeMinutesSnapshot: capacity.standardCycleTimeMinutes ? new Prisma.Decimal(capacity.standardCycleTimeMinutes) : null,
      setupMinutesSnapshot: new Prisma.Decimal(capacity.setupMinutes),
      changeoverMinutesSnapshot: new Prisma.Decimal(capacity.changeoverMinutes),
      cleaningMinutesSnapshot: new Prisma.Decimal(capacity.cleaningMinutes),
      startupAllowanceMinutesSnapshot: new Prisma.Decimal(capacity.startupAllowanceMinutes),
      shutdownAllowanceMinutesSnapshot: new Prisma.Decimal(capacity.shutdownAllowanceMinutes),
      targetEfficiencyPercentSnapshot: new Prisma.Decimal(capacity.targetEfficiencyPercent),
      expectedYieldPercentSnapshot: new Prisma.Decimal(capacity.expectedYieldPercent),
      capacityEffectiveFromSnapshot: new Date(capacity.effectiveFrom),
      capacityEffectiveToSnapshot: capacity.effectiveTo ? new Date(capacity.effectiveTo) : null,
      capacityProductIdSnapshot: capacity.productionProductId,
      capacityVersionIdSnapshot: capacity.productionVersionId || null,
      capacityPackagingIdSnapshot: capacity.productionPackagingId || null,
      capacityLineIdSnapshot: capacity.productionLineId,
      capacityMachineIdSnapshot: capacity.machineId || null,
      plannedGrossQuantity: duration.plannedGrossQuantity,
      plannedRunMinutes: duration.plannedRunMinutes,
      plannedAllowanceMinutes: duration.plannedAllowanceMinutes,
      plannedDurationMinutes: duration.plannedDurationMinutes,
      durationCalculationVersion: duration.calculationVersion,
    };
  }

  private async validateReferences(input: any, ctx: ActiveOperationalContext, client: any) {
    const product = await client.productionProductDefinition.findFirst({
      where: { id: input.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null },
    });
    if (!product) this.invalid('productionProductDefinitionId', 'productionOrder.productInvalid');
    const version = await client.productionVersion.findFirst({ where: { id: input.productionVersionId, productionProductId: input.productionProductDefinitionId, status: 'ACTIVE' } });
    if (!version) this.invalid('productionVersionId', 'productionOrder.versionInvalid');
    if (input.productionPackagingId) {
      const packaging = await client.productionPackaging.findFirst({ where: { id: input.productionPackagingId, productionProductId: input.productionProductDefinitionId, status: 'ACTIVE' } });
      if (!packaging) this.invalid('productionPackagingId', 'productionOrder.packagingInvalid');
    }
    const unit = await client.productionUnit.findFirst({ where: { id: input.productionUnitId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
    if (!unit) this.invalid('productionUnitId', 'productionOrder.unitInvalid');
    const line = await client.productionLine.findFirst({ where: { id: input.productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
    if (!line) this.invalid('productionLineId', 'productionOrder.lineInvalid');
    if (input.machineId) {
      const machine = await client.machine.findFirst({ where: { id: input.machineId, companyId: ctx.companyId, branchId: ctx.branchId, productionLineId: input.productionLineId, status: 'ACTIVE', deletedAt: null } });
      if (!machine) this.invalid('machineId', 'productionOrder.machineInvalid');
    }
    const eligibility = await client.productionEligibility.findFirst({
      where: input.machineId
        ? { productionProductId: input.productionProductDefinitionId, resourceType: 'MACHINE', machineId: input.machineId, status: 'ACTIVE' }
        : { productionProductId: input.productionProductDefinitionId, resourceType: 'LINE', productionLineId: input.productionLineId, status: 'ACTIVE' },
    });
    if (!eligibility) this.invalid(input.machineId ? 'machineId' : 'productionLineId', 'productionOrder.eligibilityRequired');
    const costCenter = await client.costCenter.findFirst({ where: { id: input.costCenterId, companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }], status: 'ACTIVE', deletedAt: null } });
    if (!costCenter) this.invalid('costCenterId', 'productionOrder.costCenterInvalid');
    for (const field of ['issueWarehouseId', 'receiptWarehouseId']) {
      if (!input[field]) continue;
      const warehouse = await client.warehouse.findFirst({ where: { id: input[field], companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }], status: 'ACTIVE', deletedAt: null } });
      if (!warehouse) this.invalid(field, 'productionOrder.warehouseInvalid');
    }
    return { product, version, unit, line, costCenter };
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext, client: any = this.prisma, include = false) {
    const record = await client.productionOrder.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      ...(include ? { include: orderInclude } : {}),
    });
    if (!record) throw new NotFoundException({ messageKey: 'productionOrder.notFound' });
    return record;
  }

  private async findDuplicateAction(client: any, id: string, requestId: string, action: string, ctx: ActiveOperationalContext) {
    const existing = await client.productionOrderTransition.findFirst({ where: { productionOrderId: id, requestId, companyId: ctx.companyId, branchId: ctx.branchId } });
    if (!existing) return null;
    if (existing.action !== action) throw new ConflictException({ messageKey: 'productionOrder.idempotencyConflict' });
    return this.findOwned(id, ctx, client, true);
  }

  private writeTransition(client: any, order: any, fromStatus: string, toStatus: string, action: string, actorId: string, requestId: string, reason?: string, readinessEvidence?: string) {
    return client.productionOrderTransition.create({
      data: { companyId: order.companyId, branchId: order.branchId, productionOrderId: order.id, fromStatus, toStatus, action, actorId, requestId, reason: reason || null, readinessEvidence: readinessEvidence || null },
    });
  }

  private writeAudit(client: any, userId: string, action: string, order: any, ctx: ActiveOperationalContext, details: Record<string, any>) {
    return this.audit.logWithClient(client, {
      userId,
      action,
      entity: PRODUCTION_ORDER_AUDIT_ENTITY,
      entityId: order.id,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, orderNumber: order.orderNumber, ...details },
    });
  }

  private assertEditable(order: any) {
    if (!(PRODUCTION_ORDER_EDITABLE_STATUSES as readonly string[]).includes(order.status) || order.snapshotFrozenAt) {
      throw new ConflictException({ messageKey: 'productionOrder.notEditable' });
    }
  }

  private assertLock(order: any, lockVersion: number) {
    if (order.lockVersion !== lockVersion) throw new ConflictException({ messageKey: 'productionOrder.staleVersion' });
  }

  private positiveDecimal(value: Prisma.Decimal.Value, field: string) {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.greaterThan(0)) this.invalid(field, 'productionOrder.mustBePositive');
    return decimal;
  }

  private invalid(field: string, code: string): never {
    throw new BadRequestException({ messageKey: 'common.validationFailed', errors: [{ field, code }] });
  }

  private materialInput(order: any) {
    return {
      productionProductDefinitionId: order.productionProductDefinitionId,
      productionVersionId: order.productionVersionId,
      productionPackagingId: order.productionPackagingId,
      productionUnitId: order.productionUnitId,
      productionLineId: order.productionLineId,
      machineId: order.machineId,
      plannedQuantity: order.plannedQuantity.toString(),
      capacityTimeBasis: order.capacityTimeBasis,
      plannedStartAt: new Date(order.plannedStartAt).toISOString(),
      plannedEndAt: new Date(order.plannedEndAt).toISOString(),
      costCenterId: order.costCenterId,
      issueWarehouseId: order.issueWarehouseId,
      receiptWarehouseId: order.receiptWarehouseId,
    };
  }

  private auditMaterial(order: any) {
    return {
      productionProductDefinitionId: order.productionProductDefinitionId,
      productionVersionId: order.productionVersionId,
      productionPackagingId: order.productionPackagingId,
      productionUnitId: order.productionUnitId,
      productionLineId: order.productionLineId,
      machineId: order.machineId,
      plannedQuantity: order.plannedQuantity?.toString(),
      plannedStartAt: order.plannedStartAt,
      plannedEndAt: order.plannedEndAt,
      costCenterId: order.costCenterId,
      issueWarehouseId: order.issueWarehouseId,
      receiptWarehouseId: order.receiptWarehouseId,
      priority: order.priority,
      sourceType: order.sourceType,
      sourceReference: order.sourceReference,
      notes: order.notes,
    };
  }

  private snapshotEvidence(value: any) {
    return {
      capacityStandardId: value.capacityStandardId,
      capacityStandardCode: value.capacityStandardCodeSnapshot,
      capacityStandardRevision: value.capacityStandardRevisionSnapshot,
      standardRate: value.standardRateSnapshot?.toString(),
      outputUnit: value.outputUnitSnapshot,
      timeBasis: value.timeBasisSnapshot,
      targetEfficiencyPercent: value.targetEfficiencyPercentSnapshot?.toString(),
      expectedYieldPercent: value.expectedYieldPercentSnapshot?.toString(),
      plannedGrossQuantity: value.plannedGrossQuantity?.toString(),
      plannedRunMinutes: value.plannedRunMinutes?.toString(),
      plannedAllowanceMinutes: value.plannedAllowanceMinutes?.toString(),
      plannedDurationMinutes: value.plannedDurationMinutes?.toString(),
      calculationVersion: value.durationCalculationVersion,
    };
  }

  private sameCreateIntent(existing: any, dto: CreateProductionOrderDto) {
    return existing.productionProductDefinitionId === dto.productionProductDefinitionId
      && existing.productionVersionId === dto.productionVersionId
      && (existing.productionPackagingId || undefined) === dto.productionPackagingId
      && existing.productionUnitId === dto.productionUnitId
      && existing.productionLineId === dto.productionLineId
      && (existing.machineId || undefined) === dto.machineId
      && new Prisma.Decimal(existing.plannedQuantity).equals(new Prisma.Decimal(dto.plannedQuantity))
      && existing.capacityTimeBasis === dto.capacityTimeBasis
      && new Date(existing.plannedStartAt).getTime() === new Date(dto.plannedStartAt).getTime()
      && new Date(existing.plannedEndAt).getTime() === new Date(dto.plannedEndAt).getTime()
      && existing.costCenterId === dto.costCenterId
      && (existing.issueWarehouseId || undefined) === dto.issueWarehouseId
      && (existing.receiptWarehouseId || undefined) === dto.receiptWarehouseId;
  }
}
