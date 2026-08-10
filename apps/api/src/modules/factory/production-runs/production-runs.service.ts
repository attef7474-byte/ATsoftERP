import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { ProductionOrdersService } from '../production-orders/production-orders.service';
import { CreateProductionRunDto } from './dto/create-production-run.dto';
import { RunActionDto } from './dto/run-action.dto';
import { RecordOutputDto } from './dto/record-output.dto';
import { CorrectOutputDto } from './dto/correct-output.dto';
import { RunQueryDto } from './dto/run-query.dto';
import { normalizeCounterDelta as counterDelta, deriveRunTotals, progressPercent } from './production-runs.util';
import { ResolvedRunAssignments } from './types';
import {
  PRODUCTION_OUTPUT_EVENT_AUDIT_ENTITY,
  PRODUCTION_OUTPUT_EVENT_INCLUDE,
  PRODUCTION_RUN_ACTIONABLE_STATUSES,
  PRODUCTION_RUN_ACTIVE_STATUSES,
  PRODUCTION_RUN_AUDIT_ENTITY,
  PRODUCTION_RUN_INCLUDE,
  PRODUCTION_RUN_NUMBER_SEQUENCE,
} from './production-runs.constants';

const emptyAssignments: ResolvedRunAssignments = {
  shiftId: null,
  shiftCodeSnapshot: null,
  shiftNameSnapshot: null,
  shiftStartTimeSnapshot: null,
  shiftEndTimeSnapshot: null,
  shiftAssignmentId: null,
  shiftAssignmentCodeSnapshot: null,
  operationalAssignmentId: null,
  operationalAssignmentCodeSnapshot: null,
  operationalPersonId: null,
  operationalPersonCodeSnapshot: null,
  operationalPersonNameSnapshot: null,
  assignmentResolutionSource: 'RESOURCE',
  assignmentResolutionNote: null,
};

@Injectable()
export class ProductionRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly orders: ProductionOrdersService,
  ) {}

  async findAll(query: RunQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.dateFrom || query.dateTo) {
      where.startedAt = {};
      if (query.dateFrom) where.startedAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startedAt.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [
        { runNumber: { contains: query.search } },
        { orderNumberSnapshot: { contains: query.search } },
        { productionOrder: { orderNumber: { contains: query.search } } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).productionRun.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ createdAt: 'desc' }], include: PRODUCTION_RUN_INCLUDE }),
      (this.prisma as any).productionRun.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwnedRun(id, ctx);
  }

  async live(id: string, ctx: ActiveOperationalContext) {
    const run = await this.findOwnedRun(id, ctx);
    const [sessions, allEvents] = await Promise.all([
      (this.prisma as any).productionRunSession.findMany({ where: { productionRunId: id, companyId: ctx.companyId, branchId: ctx.branchId }, orderBy: { startedAt: 'asc' } }),
      (this.prisma as any).productionOutputEvent.findMany({
        where: { productionRunId: id, companyId: ctx.companyId, branchId: ctx.branchId },
        orderBy: { occurredAt: 'asc' },
        include: PRODUCTION_OUTPUT_EVENT_INCLUDE,
      }),
    ]);
    const totalsInput = allEvents.map((e: any) => ({
      id: e.id,
      eventType: e.eventType,
      classification: e.classification,
      quantity: e.quantity,
      goodQuantity: e.goodQuantity,
      rejectQuantity: e.rejectQuantity,
      correctsEventId: e.correctsEventId,
      measurementPointId: e.measurementPointId,
      measurementPoint: e.measurementPoint,
    }));
    const totals = deriveRunTotals(totalsInput);
    const recentEvents = [...allEvents].reverse().slice(0, 50);
    const openSession = sessions.find((s: any) => !s.closedAt) || null;
    return {
      run: { ...run, sessions, openSession },
      recentEvents,
      totals: { ...totals, progressPercent: progressPercent(totals.finalOutputTotal, run.plannedQuantitySnapshot) },
    };
  }

  async history(id: string, ctx: ActiveOperationalContext) {
    const run = await this.findOwnedRun(id, ctx);
    const [transitions, audits] = await Promise.all([
      (this.prisma as any).productionRunTransition.findMany({ where: { productionRunId: id, companyId: ctx.companyId, branchId: ctx.branchId }, orderBy: { createdAt: 'asc' } }),
      (this.prisma as any).auditLog.findMany({ where: { entity: PRODUCTION_RUN_AUDIT_ENTITY, entityId: id }, orderBy: { createdAt: 'asc' }, select: { id: true, userId: true, action: true, details: true, createdAt: true } }),
    ]);
    return { runId: run.id, runNumber: run.runNumber, transitions, audits };
  }

  async ledger(id: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const run = await this.findOwnedRun(id, ctx);
    const page = query.page || 1;
    const limit = query.limit || 50;
    const where = { productionRunId: id, companyId: ctx.companyId, branchId: ctx.branchId };
    const [data, total] = await Promise.all([
      (this.prisma as any).productionOutputEvent.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ occurredAt: 'desc' }], include: PRODUCTION_OUTPUT_EVENT_INCLUDE }),
      (this.prisma as any).productionOutputEvent.count({ where }),
    ]);
    return { runId: run.id, runNumber: run.runNumber, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async start(dto: CreateProductionRunDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findByRequestId(dto.clientRequestId, ctx);
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = await this.findByRequestId(dto.clientRequestId, ctx, tx);
        if (raced) return raced;

        const order = await tx.productionOrder.findFirst({ where: { id: dto.productionOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
        if (!order) throw new NotFoundException({ messageKey: 'productionRun.orderNotFound' });
        if (order.status !== 'RELEASED') throw new ConflictException({ messageKey: 'productionRun.orderNotReleased' });

        const activeOnOrder = await tx.productionRun.findFirst({ where: { companyId: ctx.companyId, branchId: ctx.branchId, productionOrderId: order.id, status: { in: [...PRODUCTION_RUN_ACTIVE_STATUSES] }, deletedAt: null } });
        if (activeOnOrder) throw new ConflictException({ messageKey: 'productionRun.orderHasActiveRun' });
        const activeOnLine = await tx.productionRun.findFirst({ where: { companyId: ctx.companyId, branchId: ctx.branchId, productionLineId: order.productionLineId, status: { in: [...PRODUCTION_RUN_ACTIVE_STATUSES] }, deletedAt: null } });
        if (activeOnLine) throw new ConflictException({ messageKey: 'productionRun.lineHasActiveRun' });

        const assignments = await this.resolveAssignments(dto, order, tx, ctx);
        const runNumber = await this.numbering.generateNumberAtomicWithClient(PRODUCTION_RUN_NUMBER_SEQUENCE, tx);
        const now = new Date();

        const created = await tx.productionRun.create({
          data: {
            runNumber,
            clientRequestId: dto.clientRequestId,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            productionOrderId: order.id,
            status: 'RUNNING',
            lockVersion: 0,
            notes: dto.notes || null,
            ...assignments,
            productionUnitId: order.productionUnitId,
            productionLineId: order.productionLineId,
            machineId: order.machineId || null,
            productionProductDefinitionId: order.productionProductDefinitionId,
            productionVersionId: order.productionVersionId,
            productionPackagingId: order.productionPackagingId || null,
            costCenterId: order.costCenterId,
            issueWarehouseId: order.issueWarehouseId || null,
            receiptWarehouseId: order.receiptWarehouseId || null,
            orderNumberSnapshot: order.orderNumber,
            plannedQuantitySnapshot: order.plannedQuantity,
            quantityUnitSnapshot: order.quantityUnit,
            capacityStandardCodeSnapshot: order.capacityStandardCodeSnapshot,
            capacityStandardRevisionSnapshot: order.capacityStandardRevisionSnapshot,
            standardRateSnapshot: order.standardRateSnapshot,
            outputUnitSnapshot: order.outputUnitSnapshot,
            timeBasisSnapshot: order.timeBasisSnapshot,
            targetEfficiencyPercentSnapshot: order.targetEfficiencyPercentSnapshot,
            expectedYieldPercentSnapshot: order.expectedYieldPercentSnapshot,
            snapshotFrozenAtSnapshot: order.snapshotFrozenAt,
            startedById: userId,
            startedAt: now,
            createdById: userId,
            updatedById: userId,
          },
          include: PRODUCTION_RUN_INCLUDE,
        });

        await tx.productionRunSession.create({
          data: { companyId: ctx.companyId, branchId: ctx.branchId, productionRunId: created.id, startedAt: now, startedById: userId },
        });

        const orderUpdated = await tx.productionOrder.updateMany({
          where: { id: order.id, companyId: ctx.companyId, branchId: ctx.branchId, status: 'RELEASED', deletedAt: null },
          data: { status: 'IN_PROGRESS', updatedById: userId, lockVersion: { increment: 1 } },
        });
        if (orderUpdated.count !== 1) throw new ConflictException({ messageKey: 'productionRun.orderStateChanged' });

        await tx.productionOrderTransition.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            productionOrderId: order.id,
            fromStatus: 'RELEASED',
            toStatus: 'IN_PROGRESS',
            action: 'RUN_START',
            actorId: userId,
            requestId: dto.clientRequestId,
            reason: assignments.assignmentResolutionNote || 'Run started',
            readinessEvidence: JSON.stringify({ runId: created.id, runNumber: created.runNumber, assignmentResolutionSource: assignments.assignmentResolutionSource }),
          },
        });

        await this.writeRunTransition(tx, created, 'NONE', 'READY', 'CREATE', userId, dto.clientRequestId);
        await this.writeRunTransition(tx, created, 'READY', 'RUNNING', 'START', userId, `${dto.clientRequestId}:start`);
        await this.writeAudit(tx, userId, 'START', PRODUCTION_RUN_AUDIT_ENTITY, created.id, ctx, {
          runNumber: created.runNumber,
          orderNumber: order.orderNumber,
          orderId: order.id,
          assignmentResolutionSource: assignments.assignmentResolutionSource,
          snapshot: this.snapshotEvidence(created),
        });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await this.findByRequestId(dto.clientRequestId, ctx);
        if (raced) return raced;
        throw new ConflictException({ messageKey: 'productionRun.duplicate' });
      }
      throw error;
    }
  }
  async pause(id: string, dto: RunActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'PAUSE', dto, userId, ctx);
  }

  async resume(id: string, dto: RunActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'RESUME', dto, userId, ctx);
  }

  async complete(id: string, dto: RunActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'COMPLETE', dto, userId, ctx);
  }

  async abort(id: string, dto: RunActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.transition(id, 'ABORT', dto, userId, ctx);
  }

  async recordOutput(id: string, dto: RecordOutputDto, userId: string, ctx: ActiveOperationalContext) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const run = await this.findOwnedRun(id, ctx, tx);
        if (run.status !== 'RUNNING') throw new ConflictException({ messageKey: 'productionRun.outputRequiresRunning' });
        const existing = await this.findEventByRequestId(dto.requestId, ctx, tx);
        if (existing) return existing;

        const point = await tx.productionMeasurementPoint.findFirst({
          where: { id: dto.measurementPointId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null },
        });
        if (!point) throw new BadRequestException({ messageKey: 'productionRun.pointInvalid' });
        if (point.productionLineId !== run.productionLineId) throw new BadRequestException({ messageKey: 'productionRun.pointLineMismatch' });
        if (point.machineId && point.machineId !== run.machineId) throw new BadRequestException({ messageKey: 'productionRun.pointMachineMismatch' });

        const now = new Date();
        const effectiveFrom = new Date(point.effectiveFrom);
        const effectiveTo = point.effectiveTo ? new Date(point.effectiveTo) : null;
        if (effectiveFrom > now) throw new BadRequestException({ messageKey: 'productionRun.pointNotEffectiveYet' });
        if (effectiveTo && effectiveTo <= now) throw new BadRequestException({ messageKey: 'productionRun.pointExpired' });

        const occurredAt = this.resolveOccurredAt(dto.occurredAt, run, dto.reason, now);
        const event = await this.buildOutputEvent(tx, run, point, dto, occurredAt, userId, ctx);
        await this.writeAudit(tx, userId, event.eventType === 'RESET' ? 'OUTPUT_RESET' : 'OUTPUT_CREATE', PRODUCTION_OUTPUT_EVENT_AUDIT_ENTITY, event.id, ctx, {
          runId: run.id,
          runNumber: run.runNumber,
          pointCode: point.code,
          classification: event.classification,
          sourceType: event.sourceType,
          eventType: event.eventType,
          quantity: event.quantity.toString(),
          goodQuantity: event.goodQuantity.toString(),
          rejectQuantity: event.rejectQuantity.toString(),
          rawCount: event.rawCount?.toString() ?? null,
          previousRawCount: event.previousRawCount?.toString() ?? null,
          resetValue: event.resetValue?.toString() ?? null,
          requestId: dto.requestId,
          occurredAt: event.occurredAt.toISOString(),
        });
        return event;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await this.findEventByRequestId(dto.requestId, ctx);
        if (raced) return raced;
        throw error;
      }
      throw error;
    }
  }

  async correctOutput(eventId: string, dto: CorrectOutputDto, userId: string, ctx: ActiveOperationalContext) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const original = await tx.productionOutputEvent.findFirst({ where: { id: eventId, companyId: ctx.companyId, branchId: ctx.branchId } });
        if (!original) throw new NotFoundException({ messageKey: 'productionRun.eventNotFound' });
        if (original.eventType !== 'PRODUCTION') throw new BadRequestException({ messageKey: 'productionRun.correctProductionOnly' });
        const run = await this.findOwnedRun(original.productionRunId, ctx, tx);
        if (run.status !== 'RUNNING') throw new ConflictException({ messageKey: 'productionRun.outputRequiresRunning' });
        const existing = await this.findEventByRequestId(dto.requestId, ctx, tx);
        if (existing) return existing;

        const now = new Date();
        const occurredAt = this.resolveOccurredAt(dto.occurredAt, run, dto.reason, now);
        const quantity = new Prisma.Decimal(dto.quantity);
        if (quantity.lessThanOrEqualTo(0)) throw new BadRequestException({ messageKey: 'productionRun.correctionPositive' });

        const applied = await tx.productionOutputEvent.findMany({ where: { companyId: ctx.companyId, branchId: ctx.branchId, correctsEventId: original.id } });
        const appliedQuantity = applied.reduce((acc, c) => acc.plus(new Prisma.Decimal(c.quantity)), new Prisma.Decimal(0));
        const remainingQuantity = new Prisma.Decimal(original.quantity).minus(appliedQuantity);
        if (quantity.greaterThan(remainingQuantity)) throw new BadRequestException({ messageKey: 'productionRun.correctionExceeds' });

        let goodQuantity = new Prisma.Decimal(0);
        let rejectQuantity = new Prisma.Decimal(0);
        if (original.classification === 'FINAL_OUTPUT') {
          goodQuantity = dto.goodQuantity !== undefined ? new Prisma.Decimal(dto.goodQuantity) : quantity;
          rejectQuantity = dto.rejectQuantity !== undefined ? new Prisma.Decimal(dto.rejectQuantity) : new Prisma.Decimal(0);
          if (goodQuantity.lessThan(0) || rejectQuantity.lessThan(0)) throw new BadRequestException({ messageKey: 'productionRun.goodRejectNegative' });
          if (goodQuantity.plus(rejectQuantity).greaterThan(quantity)) throw new BadRequestException({ messageKey: 'productionRun.goodRejectExceeds' });
          const remainingGood = new Prisma.Decimal(original.goodQuantity).minus(applied.reduce((acc, c) => acc.plus(new Prisma.Decimal(c.goodQuantity)), new Prisma.Decimal(0)));
          const remainingReject = new Prisma.Decimal(original.rejectQuantity).minus(applied.reduce((acc, c) => acc.plus(new Prisma.Decimal(c.rejectQuantity)), new Prisma.Decimal(0)));
          if (goodQuantity.greaterThan(remainingGood)) goodQuantity = remainingGood;
          if (rejectQuantity.greaterThan(remainingReject)) rejectQuantity = remainingReject;
        }

        const correction = await tx.productionOutputEvent.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            productionRunId: original.productionRunId,
            measurementPointId: original.measurementPointId,
            eventType: 'CORRECTION',
            classification: original.classification,
            sourceType: original.sourceType,
            quantity,
            goodQuantity,
            rejectQuantity,
            unit: original.unit,
            occurredAt,
            requestId: dto.requestId,
            previousRawCount: null,
            rawCount: null,
            resetValue: null,
            correctsEventId: original.id,
            reason: dto.reason,
            notes: dto.notes || null,
            createdById: userId,
          },
          include: PRODUCTION_OUTPUT_EVENT_INCLUDE,
        });
        await this.writeAudit(tx, userId, 'OUTPUT_CORRECT', PRODUCTION_OUTPUT_EVENT_AUDIT_ENTITY, correction.id, ctx, {
          runId: run.id,
          runNumber: run.runNumber,
          correctedEventId: original.id,
          classification: original.classification,
          quantity: quantity.toString(),
          goodQuantity: goodQuantity.toString(),
          rejectQuantity: rejectQuantity.toString(),
          reason: dto.reason,
          requestId: dto.requestId,
          occurredAt: occurredAt.toISOString(),
        });
        return correction;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await this.findEventByRequestId(dto.requestId, ctx);
        if (raced) return raced;
        throw error;
      }
      throw error;
    }
  }
  private async buildOutputEvent(client: any, run: any, point: any, dto: RecordOutputDto, occurredAt: Date, userId: string, ctx: ActiveOperationalContext) {
    const sourceType = point.source;
    const classification = point.role;
    const previous = await this.latestCounterEvent(client, run.id, point.id, ctx);

    let quantity = new Prisma.Decimal(0);
    let goodQuantity = new Prisma.Decimal(0);
    let rejectQuantity = new Prisma.Decimal(0);
    let rawCount: Prisma.Decimal | null = null;
    let previousRawCount: Prisma.Decimal | null = null;
    let resetValue: Prisma.Decimal | null = null;

    if (dto.eventType === 'RESET') {
      if (sourceType !== 'COUNTER') throw new BadRequestException({ messageKey: 'productionRun.resetRequiresCounter' });
      if (dto.rawCount === undefined) throw new BadRequestException({ messageKey: 'productionRun.rawCountRequired' });
      if (dto.resetValue === undefined) throw new BadRequestException({ messageKey: 'productionRun.resetValueRequired' });
      rawCount = new Prisma.Decimal(dto.rawCount);
      resetValue = new Prisma.Decimal(dto.resetValue);
      if (rawCount.lessThan(0)) throw new BadRequestException({ messageKey: 'productionRun.rawCountNegative' });
      if (resetValue.lessThan(0)) throw new BadRequestException({ messageKey: 'productionRun.resetValueNegative' });
    } else {
      if (sourceType === 'COUNTER') {
        if (dto.rawCount === undefined) throw new BadRequestException({ messageKey: 'productionRun.rawCountRequired' });
        rawCount = new Prisma.Decimal(dto.rawCount);
        if (rawCount.lessThan(0)) throw new BadRequestException({ messageKey: 'productionRun.rawCountNegative' });
        const baseline = previous ? (previous.resetValue ?? previous.rawCount) : null;
        const modulus = point.counterModulus ? new Prisma.Decimal(point.counterModulus) : null;
        const normalized = counterDelta(baseline, rawCount, modulus, null);
        if (normalized.errorCode || !normalized.delta) {
          throw new BadRequestException({ messageKey: `productionRun.${normalized.errorCode}` });
        }
        quantity = normalized.delta;
        previousRawCount = baseline ?? new Prisma.Decimal(0);
      } else {
        if (dto.quantity === undefined) throw new BadRequestException({ messageKey: 'productionRun.quantityRequired' });
        quantity = new Prisma.Decimal(dto.quantity);
        if (quantity.lessThan(0)) throw new BadRequestException({ messageKey: 'productionRun.quantityNegative' });
      }
      if (classification === 'FINAL_OUTPUT') {
        goodQuantity = dto.goodQuantity !== undefined ? new Prisma.Decimal(dto.goodQuantity) : quantity;
        rejectQuantity = dto.rejectQuantity !== undefined ? new Prisma.Decimal(dto.rejectQuantity) : new Prisma.Decimal(0);
        if (goodQuantity.lessThan(0) || rejectQuantity.lessThan(0)) throw new BadRequestException({ messageKey: 'productionRun.goodRejectNegative' });
        if (goodQuantity.plus(rejectQuantity).greaterThan(quantity)) throw new BadRequestException({ messageKey: 'productionRun.goodRejectExceeds' });
      } else if (dto.goodQuantity !== undefined || dto.rejectQuantity !== undefined) {
        throw new BadRequestException({ messageKey: 'productionRun.goodRejectFinalOnly' });
      }
    }

    return client.productionOutputEvent.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        productionRunId: run.id,
        measurementPointId: point.id,
        eventType: dto.eventType,
        classification,
        sourceType,
        quantity,
        goodQuantity,
        rejectQuantity,
        unit: point.unit,
        occurredAt,
        requestId: dto.requestId,
        previousRawCount,
        rawCount,
        resetValue,
        correctsEventId: null,
        reason: dto.reason || null,
        notes: dto.notes || null,
        createdById: userId,
      },
      include: PRODUCTION_OUTPUT_EVENT_INCLUDE,
    });
  }

  private async transition(id: string, action: 'PAUSE' | 'RESUME' | 'COMPLETE' | 'ABORT', dto: RunActionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await this.findDuplicateRunAction(tx, id, dto.requestId, action, ctx);
      if (duplicate) return duplicate;
      const current = await this.findOwnedRun(id, ctx, tx, true);
      const allowed = PRODUCTION_RUN_ACTIONABLE_STATUSES[action];
      if (!allowed.includes(current.status)) throw new ConflictException({ messageKey: `productionRun.${action.toLowerCase()}StateInvalid` });
      const reason = (dto as any).reason;
      if (action === 'ABORT' && !reason) throw new BadRequestException({ messageKey: 'productionRun.abortReasonRequired' });

      const now = new Date();
      let targetStatus = current.status;
      const data: any = { updatedById: userId, lockVersion: { increment: 1 } };
      switch (action) {
        case 'PAUSE':
          targetStatus = 'PAUSED';
          data.pausedById = userId;
          data.pausedAt = now;
          data.pauseReason = reason || null;
          break;
        case 'RESUME':
          targetStatus = 'RUNNING';
          data.pausedById = null;
          data.pausedAt = null;
          data.pauseReason = null;
          data.startedById = userId;
          if (!current.startedAt) data.startedAt = now;
          break;
        case 'COMPLETE':
          targetStatus = 'COMPLETED';
          data.endedById = userId;
          data.endedAt = now;
          break;
        case 'ABORT':
          targetStatus = 'ABORTED';
          data.endedById = userId;
          data.endedAt = now;
          data.abortReason = reason || null;
          break;
      }

      data.status = targetStatus;
      const count = await tx.productionRun.updateMany({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, status: current.status, lockVersion: dto.lockVersion, deletedAt: null },
        data,
      });
      if (count.count !== 1) throw new ConflictException({ messageKey: 'productionRun.staleVersion' });

      if (action === 'RESUME') {
        await tx.productionRunSession.create({ data: { companyId: ctx.companyId, branchId: ctx.branchId, productionRunId: id, startedAt: now, startedById: userId } });
      } else {
        await tx.productionRunSession.updateMany({ where: { productionRunId: id, closedAt: null }, data: { closedAt: now, closedById: userId } });
      }

      const updated = await this.findOwnedRun(id, ctx, tx, true);
      await this.writeRunTransition(tx, updated, current.status, targetStatus, action, userId, dto.requestId, reason || null);
      await this.writeAudit(tx, userId, action, PRODUCTION_RUN_AUDIT_ENTITY, updated.id, ctx, {
        runNumber: updated.runNumber,
        fromStatus: current.status,
        toStatus: targetStatus,
        reason: reason || null,
      });
      if (action === 'COMPLETE' || action === 'ABORT') {
        await this.orders.finalizeOrderAfterLastRun(
          updated.productionOrderId,
          `${dto.requestId}:order-end`,
          userId,
          ctx,
          tx,
          { runId: updated.id, runNumber: updated.runNumber, action },
        );
      }
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  private async resolveAssignments(dto: CreateProductionRunDto, order: any, client: any, ctx: ActiveOperationalContext): Promise<ResolvedRunAssignments> {
    const now = new Date();
    if (dto.operationalAssignmentId) {
      if (!dto.assignmentReason) throw new BadRequestException({ messageKey: 'productionRun.assignmentOverrideReasonRequired' });
      const op = await client.productionOperationalAssignment.findFirst({ where: { id: dto.operationalAssignmentId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
      if (!op) throw new BadRequestException({ messageKey: 'productionRun.assignmentInvalid' });
      const shift = op.shiftId ? await this.liftShift(op.shiftId, ctx, client) : null;
      const person = await this.resolvePersonForShift(op.shiftId, ctx, client);
      return {
        ...emptyAssignments,
        ...(op.shiftId ? { shiftId: op.shiftId } : {}),
        ...(shift ? { shiftCodeSnapshot: shift.code, shiftNameSnapshot: shift.name, shiftStartTimeSnapshot: shift.startTime, shiftEndTimeSnapshot: shift.endTime } : {}),
        operationalAssignmentId: op.id,
        operationalAssignmentCodeSnapshot: op.code,
        ...(person ? { operationalPersonId: person.operationalPersonId, operationalPersonCodeSnapshot: person.operationalPersonCodeSnapshot, operationalPersonNameSnapshot: person.operationalPersonNameSnapshot, shiftAssignmentId: person.shiftAssignmentId, shiftAssignmentCodeSnapshot: person.shiftAssignmentCodeSnapshot } : {}),
        assignmentResolutionSource: 'EXPLICIT',
        assignmentResolutionNote: dto.assignmentReason,
      };
    }

    if (dto.shiftAssignmentId) {
      if (!dto.assignmentReason) throw new BadRequestException({ messageKey: 'productionRun.assignmentOverrideReasonRequired' });
      const sa = await client.productionShiftAssignment.findFirst({ where: { id: dto.shiftAssignmentId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
      if (!sa) throw new BadRequestException({ messageKey: 'productionRun.assignmentInvalid' });
      const shift = sa.shiftId ? await this.liftShift(sa.shiftId, ctx, client) : null;
      const person = sa.operationalPersonId ? await this.liftPerson(sa.operationalPersonId, client) : null;
      return {
        ...emptyAssignments,
        ...(sa.shiftId ? { shiftId: sa.shiftId } : {}),
        ...(shift ? { shiftCodeSnapshot: shift.code, shiftNameSnapshot: shift.name, shiftStartTimeSnapshot: shift.startTime, shiftEndTimeSnapshot: shift.endTime } : {}),
        shiftAssignmentId: sa.id,
        shiftAssignmentCodeSnapshot: sa.code,
        ...(person ? { operationalPersonId: person.id, operationalPersonCodeSnapshot: person.code, operationalPersonNameSnapshot: person.name } : {}),
        assignmentResolutionSource: 'EXPLICIT',
        assignmentResolutionNote: dto.assignmentReason,
      };
    }

    const where: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      status: 'ACTIVE',
      deletedAt: null,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    };
    if (order.machineId) {
      where.machineId = order.machineId;
    } else {
      where.productionLineId = order.productionLineId;
    }
    const candidates = await client.productionOperationalAssignment.findMany({ where, orderBy: [{ isPrimary: 'desc' }, { effectiveFrom: 'desc' }], take: 2 });
    if (candidates.length > 1 && !(candidates[0].isPrimary && !candidates[1].isPrimary)) {
      throw new ConflictException({ messageKey: 'productionRun.assignmentAmbiguous', details: { assignmentCodes: candidates.map((c: any) => c.code) } });
    }
    if (candidates.length === 0) return emptyAssignments;
    const op = candidates[0];
    const shift = op.shiftId ? await this.liftShift(op.shiftId, ctx, client) : null;
    const person = await this.resolvePersonForShift(op.shiftId, ctx, client);
    return {
      ...emptyAssignments,
      ...(op.shiftId ? { shiftId: op.shiftId } : {}),
      ...(shift ? { shiftCodeSnapshot: shift.code, shiftNameSnapshot: shift.name, shiftStartTimeSnapshot: shift.startTime, shiftEndTimeSnapshot: shift.endTime } : {}),
      operationalAssignmentId: op.id,
      operationalAssignmentCodeSnapshot: op.code,
      ...(person ? { operationalPersonId: person.operationalPersonId, operationalPersonCodeSnapshot: person.operationalPersonCodeSnapshot, operationalPersonNameSnapshot: person.operationalPersonNameSnapshot, shiftAssignmentId: person.shiftAssignmentId, shiftAssignmentCodeSnapshot: person.shiftAssignmentCodeSnapshot } : {}),
      assignmentResolutionSource: 'RESOURCE',
      assignmentResolutionNote: null,
    };
  }

  private async resolvePersonForShift(shiftId: string | null, ctx: ActiveOperationalContext, client: any) {
    if (!shiftId) return null;
    const now = new Date();
    const sa = await client.productionShiftAssignment.findFirst({
      where: {
        shiftId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'ACTIVE',
        deletedAt: null,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: [{ isPrimary: 'desc' }, { effectiveFrom: 'desc' }],
      include: { operationalPerson: { select: { id: true, code: true, name: true } } },
    });
    if (!sa) return null;
    return {
      operationalPersonId: sa.operationalPerson?.id ?? null,
      operationalPersonCodeSnapshot: sa.operationalPerson?.code ?? null,
      operationalPersonNameSnapshot: sa.operationalPerson?.name ?? null,
      shiftAssignmentId: sa.id,
      shiftAssignmentCodeSnapshot: sa.code,
    };
  }

  private async liftShift(shiftId: string, ctx: ActiveOperationalContext, client: any) {
    return client.productionShift.findFirst({ where: { id: shiftId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
  }

  private async liftPerson(operationalPersonId: string, client: any) {
    return client.operationalPerson.findFirst({ where: { id: operationalPersonId, isActive: true } });
  }

  private async latestCounterEvent(client: any, runId: string, pointId: string, ctx: ActiveOperationalContext) {
    return client.productionOutputEvent.findFirst({
      where: { productionRunId: runId, measurementPointId: pointId, companyId: ctx.companyId, branchId: ctx.branchId, eventType: { in: ['PRODUCTION', 'RESET'] } },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async findOwnedRun(id: string, ctx: ActiveOperationalContext, client: any = this.prisma, include = false) {
    const record = await client.productionRun.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      ...(include ? { include: PRODUCTION_RUN_INCLUDE } : {}),
    });
    if (!record) throw new NotFoundException({ messageKey: 'productionRun.notFound' });
    return record;
  }

  private async findByRequestId(requestId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.productionRun.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: requestId, deletedAt: null },
      include: PRODUCTION_RUN_INCLUDE,
    });
  }

  private async findEventByRequestId(requestId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.productionOutputEvent.findFirst({ where: { companyId: ctx.companyId, requestId }, include: PRODUCTION_OUTPUT_EVENT_INCLUDE });
  }

  private async findDuplicateRunAction(client: any, runId: string, requestId: string, action: string, ctx: ActiveOperationalContext) {
    const existing = await client.productionRunTransition.findFirst({ where: { productionRunId: runId, requestId, companyId: ctx.companyId, branchId: ctx.branchId } });
    if (!existing) return null;
    if (existing.action !== action) throw new ConflictException({ messageKey: 'productionRun.idempotencyConflict' });
    return this.findOwnedRun(runId, ctx, client, true);
  }

  private resolveOccurredAt(input: string | undefined, run: any, reason: string | undefined, now: Date): Date {
    const occurredAt = input ? new Date(input) : now;
    if (!Number.isFinite(occurredAt.getTime())) throw new BadRequestException({ messageKey: 'productionRun.invalidOccurredAt' });
    if (occurredAt.getTime() > now.getTime() + 60000) throw new BadRequestException({ messageKey: 'productionRun.occurredAtFuture' });
    if (run.startedAt && occurredAt.getTime() < new Date(run.startedAt).getTime()) throw new BadRequestException({ messageKey: 'productionRun.occurredAtBeforeStart' });
    const backdated = now.getTime() - occurredAt.getTime() > 60000;
    if (backdated && !reason) throw new BadRequestException({ messageKey: 'productionRun.backdateReasonRequired' });
    return occurredAt;
  }

  private writeRunTransition(client: any, run: any, fromStatus: string, toStatus: string, action: string, actorId: string, requestId: string, reason?: string) {
    return client.productionRunTransition.create({
      data: {
        companyId: run.companyId,
        branchId: run.branchId,
        productionRunId: run.id,
        fromStatus,
        toStatus,
        action,
        actorId,
        requestId,
        reason: reason || null,
        readinessEvidence: null,
      },
    });
  }

  private writeAudit(client: any, userId: string, action: string, entity: string, entityId: string, ctx: ActiveOperationalContext, details: Record<string, any>) {
    return this.audit.logWithClient(client, {
      userId,
      action,
      entity,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }

  private snapshotEvidence(run: any) {
    return {
      orderNumber: run.orderNumberSnapshot,
      plannedQuantity: run.plannedQuantitySnapshot?.toString(),
      quantityUnit: run.quantityUnitSnapshot,
      capacityStandardCode: run.capacityStandardCodeSnapshot,
      capacityStandardRevision: run.capacityStandardRevisionSnapshot,
      standardRate: run.standardRateSnapshot?.toString(),
      outputUnit: run.outputUnitSnapshot,
      timeBasis: run.timeBasisSnapshot,
      targetEfficiencyPercent: run.targetEfficiencyPercentSnapshot?.toString(),
      expectedYieldPercent: run.expectedYieldPercentSnapshot?.toString(),
      snapshotFrozenAt: run.snapshotFrozenAtSnapshot,
    };
  }
}