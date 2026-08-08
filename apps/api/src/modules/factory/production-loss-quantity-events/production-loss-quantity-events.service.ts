import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import {
  PRODUCTION_LOSS_EVENT_AUDIT_ENTITY,
  PRODUCTION_LOSS_EVENT_INCLUDE,
} from './production-loss-quantity-events.constants';
import {
  categoryCompatible,
  computeOutstandingRecoverable,
  isProductionLossType,
  isPositiveQuantity,
} from './loss-domain.util';
import { CorrectLossDto, LossQueryDto, RecordLossDto } from './dto/production-loss-quantity-event.dto';

@Injectable()
export class ProductionLossQuantityEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private notFound(key: string): NotFoundException {
    return new NotFoundException({ messageKey: key });
  }

  private badRequest(key: string): BadRequestException {
    return new BadRequestException({ messageKey: key });
  }

  private conflict(key: string): ConflictException {
    return new ConflictException({ messageKey: key });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] };
  }

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async findEvent(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const event = await client.productionLossQuantityEvent.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: PRODUCTION_LOSS_EVENT_INCLUDE,
    });
    if (!event) throw this.notFound('productionLoss.notFound');
    return event;
  }

  private async findByRequestId(requestId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.productionLossQuantityEvent.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId },
      include: PRODUCTION_LOSS_EVENT_INCLUDE,
    });
  }

  private async resolveRunContext(dto: RecordLossDto, ctx: ActiveOperationalContext, client: any = this.prisma) {
    let run: any = null;
    if (dto.productionRunId) {
      run = await client.productionRun.findFirst({
        where: { id: dto.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!run) throw this.notFound('productionLoss.runNotFound');
    }
    if (dto.productionOrderId) {
      const order = await client.productionOrder.findFirst({ where: { id: dto.productionOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
      if (!order) throw this.notFound('productionLoss.orderNotFound');
      if (run && run.productionOrderId !== order.id) throw this.badRequest('productionLoss.orderContextMismatch');
    }
    const productionOrderId = dto.productionOrderId ?? run?.productionOrderId ?? null;
    const productionLineId = dto.productionLineId ?? run?.productionLineId ?? null;
    const machineId = dto.machineId ?? run?.machineId ?? null;
    if (run) {
      if (dto.productionLineId && run.productionLineId && dto.productionLineId !== run.productionLineId) {
        throw this.badRequest('productionLoss.orderContextMismatch');
      }
      if (dto.machineId && run.machineId && dto.machineId !== run.machineId) {
        throw this.badRequest('productionLoss.orderContextMismatch');
      }
    }

    if (machineId) {
      const machine = await client.machine.findFirst({ where: { id: machineId, ...this.machineScope(ctx), deletedAt: null } });
      if (!machine) throw this.notFound('productionLoss.machineNotFound');
    }
    if (productionLineId) {
      const line = await client.productionLine.findFirst({ where: { id: productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
      if (!line) throw this.notFound('productionLoss.productionLineNotFound');
    }
    if (dto.measurementPointId) {
      const point = await client.productionMeasurementPoint.findFirst({ where: { id: dto.measurementPointId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
      if (!point) throw this.notFound('productionLoss.pointNotFound');
      if (machineId && point.machineId && point.machineId !== machineId) throw this.badRequest('productionLoss.pointRunMismatch');
    }

    let snapshots: { productId: string | null; productCodeSnapshot: string | null; productNameSnapshot: string | null; versionLabelSnapshot: string | null; packagingLabelSnapshot: string | null } = {
      productId: null,
      productCodeSnapshot: null,
      productNameSnapshot: null,
      versionLabelSnapshot: null,
      packagingLabelSnapshot: null,
    };
    if (run) {
      const definition = await client.productionProductDefinition.findFirst({
        where: { id: run.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        select: { code: true, name: true, productId: true },
      });
      const version = run.productionVersionId
        ? await client.productionVersion.findUnique({ where: { id: run.productionVersionId }, select: { versionLabel: true } })
        : null;
      const packaging = run.productionPackagingId
        ? await client.productionPackaging.findUnique({ where: { id: run.productionPackagingId }, select: { label: true } })
        : null;
      snapshots = {
        productId: definition?.productId ?? null,
        productCodeSnapshot: definition?.code ?? null,
        productNameSnapshot: definition?.name ?? null,
        versionLabelSnapshot: version?.versionLabel ?? null,
        packagingLabelSnapshot: packaging?.label ?? null,
      };
    } else if (dto.productId) {
      const product = await client.product.findFirst({ where: { id: dto.productId, companyId: ctx.companyId } });
      if (!product) throw this.notFound('productionLoss.productNotFound');
      snapshots = {
        productId: product.id,
        productCodeSnapshot: product.productCode ?? null,
        productNameSnapshot: product.nameAr ?? product.nameEn ?? null,
        versionLabelSnapshot: null,
        packagingLabelSnapshot: null,
      };
    }

    return { run, productionOrderId, productionLineId, machineId, snapshots };
  }

  private async resolveReason(reasonId: string | null | undefined, type: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    if (!reasonId) return null;
    const now = new Date();
    const reason = await client.operationalLossReason.findFirst({
      where: {
        id: reasonId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'ACTIVE',
        deletedAt: null,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
    });
    if (!reason) throw this.notFound('productionLoss.reasonNotFound');
    if (!categoryCompatible(type, reason.lossCategory)) throw this.badRequest('productionLoss.reasonCategoryMismatch');
    return reason;
  }

  private async resolveOutputEvent(outputEventId: string | null | undefined, run: any, ctx: ActiveOperationalContext, client: any = this.prisma) {
    if (!outputEventId) return null;
    const event = await client.productionOutputEvent.findFirst({
      where: { id: outputEventId, companyId: ctx.companyId, branchId: ctx.branchId },
    });
    if (!event) throw this.notFound('productionLoss.outputEventNotFound');
    if (run && event.productionRunId !== run.id) throw this.badRequest('productionLoss.orderContextMismatch');
    return event;
  }

  private isSuperseded(candidates: Array<{ correctsEventId: string | null }>, id: string): boolean {
    return candidates.some((c) => c.correctsEventId === id);
  }

  private async assertRecoverableCapacity(client: any, sourceEventId: string, type: string, quantity: Prisma.Decimal, ctx: ActiveOperationalContext, excludeEventId?: string) {
    if (type !== 'REWORK_RECOVERED') return;
    const source = await client.productionLossQuantityEvent.findFirst({
      where: { id: sourceEventId, companyId: ctx.companyId, branchId: ctx.branchId },
    });
    if (!source) throw this.notFound('productionLoss.recoverySourceInvalid');
    if (source.type !== 'REWORK_SENT') throw this.badRequest('productionLoss.recoverySourceNotRework');
    const hasCorrection = await client.productionLossQuantityEvent.count({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, correctsEventId: source.id, ...(excludeEventId ? { id: { not: excludeEventId } } : {}) },
    });
    if (hasCorrection > 0) throw this.conflict('productionLoss.sourceSuperseded');
    const recoveries = await client.productionLossQuantityEvent.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, type: 'REWORK_RECOVERED', sourceEventId: source.id, ...(excludeEventId ? { id: { not: excludeEventId } } : {}) },
      select: { id: true, quantity: true, correctsEventId: true },
    });
    const effective = recoveries.filter((r: any) => !this.isSuperseded(recoveries, r.id));
    const outstanding = computeOutstandingRecoverable(source.quantity, effective.map((r: any) => r.quantity));
    if (quantity.greaterThan(outstanding)) throw this.badRequest('productionLoss.recoveryExceedsSent');
  }

  private resolveOccurredAt(input: string | undefined, run: any, now: Date): Date {
    const occurredAt = input ? new Date(input) : now;
    if (!Number.isFinite(occurredAt.getTime())) throw this.badRequest('productionLoss.occurredAtInvalid');
    if (occurredAt.getTime() > now.getTime() + 60000) throw this.badRequest('productionLoss.occurredAtFuture');
    if (run?.startedAt && occurredAt.getTime() < new Date(run.startedAt).getTime()) throw this.badRequest('productionLoss.occurredAtBeforeRunStart');
    return occurredAt;
  }

  private writeAudit(client: any, userId: string, action: string, entityId: string, ctx: ActiveOperationalContext, details: Record<string, any>) {
    return this.audit.logWithClient(client, {
      userId,
      action,
      entity: PRODUCTION_LOSS_EVENT_AUDIT_ENTITY,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }

  async record(dto: RecordLossDto, userId: string, ctx: ActiveOperationalContext) {
    if (!isProductionLossType(dto.type)) throw this.badRequest('productionLoss.invalidType');
    if (dto.type !== 'REWORK_RECOVERED' && dto.sourceEventId) throw this.badRequest('productionLoss.sourceOnlyForRecovery');
    const existing = await this.findByRequestId(dto.requestId, ctx);
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = await this.findByRequestId(dto.requestId, ctx, tx);
        if (raced) return raced;

        const context = await this.resolveRunContext(dto, ctx, tx);
        const reason = await this.resolveReason(dto.reasonId, dto.type, ctx, tx);
        const outputEvent = await this.resolveOutputEvent(dto.outputEventId, context.run, ctx, tx);
        const occurredAt = this.resolveOccurredAt(dto.occurredAt, context.run, new Date());
        const quantity = new Prisma.Decimal(dto.quantity.toFixed(4));
        if (!isPositiveQuantity(quantity)) throw this.badRequest('productionLoss.quantityPositiveRequired');
        if (outputEvent && context.run && outputEvent.productionRunId !== context.run.id) throw this.badRequest('productionLoss.orderContextMismatch');

        if (dto.type === 'REWORK_RECOVERED') {
          await this.assertRecoverableCapacity(tx, dto.sourceEventId!, dto.type, quantity, ctx);
        }

        const event = await tx.productionLossQuantityEvent.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            productionRunId: context.run?.id ?? null,
            productionOrderId: context.productionOrderId,
            outputEventId: outputEvent?.id ?? null,
            type: dto.type,
            stage: dto.stage ?? null,
            productionLineId: context.productionLineId,
            machineId: context.machineId,
            measurementPointId: dto.measurementPointId ?? null,
            productId: context.snapshots.productId,
            productCodeSnapshot: context.snapshots.productCodeSnapshot,
            productNameSnapshot: context.snapshots.productNameSnapshot,
            versionLabelSnapshot: context.snapshots.versionLabelSnapshot,
            packagingLabelSnapshot: context.snapshots.packagingLabelSnapshot,
            unit: dto.unit,
            quantity,
            reason: dto.reason ?? reason?.code ?? null,
            reasonId: reason?.id ?? null,
            sourceType: 'MANUAL',
            requestId: dto.requestId,
            sourceEventId: dto.type === 'REWORK_RECOVERED' ? (dto.sourceEventId ?? null) : null,
            notes: dto.notes ?? null,
            recordedById: userId,
            occurredAt,
          },
          include: PRODUCTION_LOSS_EVENT_INCLUDE,
        });

        await this.writeAudit(tx, userId, 'RECORD', event.id, ctx, {
          type: dto.type,
          quantity: quantity.toString(),
          unit: dto.unit,
          productionRunId: context.run?.id ?? null,
          productionOrderId: context.productionOrderId,
          sourceEventId: dto.type === 'REWORK_RECOVERED' ? (dto.sourceEventId ?? null) : null,
          reasonId: reason?.id ?? null,
          occurredAt: occurredAt.toISOString(),
        });
        return event;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await this.findByRequestId(dto.requestId, ctx);
        if (raced) return raced;
        throw this.conflict('productionLoss.duplicateRequest');
      }
      throw error;
    }
  }

  async findAll(query: LossQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.type) {
      if (!isProductionLossType(query.type)) throw this.badRequest('productionLoss.invalidType');
      where.type = query.type;
    }
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.stage) where.stage = query.stage;
    if (query.dateFrom || query.dateTo) {
      where.occurredAt = {};
      if (query.dateFrom) where.occurredAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.occurredAt.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [{ reason: { contains: query.search } }, { notes: { contains: query.search } }];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).productionLossQuantityEvent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }],
        include: PRODUCTION_LOSS_EVENT_INCLUDE,
      }),
      (this.prisma as any).productionLossQuantityEvent.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findEvent(id, ctx);
  }

  async correct(id: string, dto: CorrectLossDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findByRequestId(dto.requestId, ctx);
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = await this.findByRequestId(dto.requestId, ctx, tx);
        if (raced) return raced;

        const original = await this.findEvent(id, ctx, tx);
        const correctionCount = await tx.productionLossQuantityEvent.count({
          where: { companyId: ctx.companyId, branchId: ctx.branchId, correctsEventId: original.id },
        });
        if (correctionCount > 0) throw this.conflict('productionLoss.correctionProductionOnly');

        const reason = await this.resolveReason(dto.reasonId, original.type, ctx, tx);
        const occurredAt = this.resolveOccurredAt(dto.occurredAt, null, new Date());
        const quantity = new Prisma.Decimal((dto.quantity ?? Number(original.quantity)).toFixed(4));
        if (!isPositiveQuantity(quantity)) throw this.badRequest('productionLoss.quantityPositiveRequired');

        if (original.type === 'REWORK_RECOVERED' && original.sourceEventId) {
          await this.assertRecoverableCapacity(tx, original.sourceEventId, 'REWORK_RECOVERED', quantity, ctx, original.id);
        }

        const correction = await tx.productionLossQuantityEvent.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            productionRunId: original.productionRunId,
            productionOrderId: original.productionOrderId,
            outputEventId: original.outputEventId,
            type: original.type,
            stage: original.stage,
            productionLineId: original.productionLineId,
            machineId: original.machineId,
            measurementPointId: original.measurementPointId,
            productId: original.productId,
            productCodeSnapshot: original.productCodeSnapshot,
            productNameSnapshot: original.productNameSnapshot,
            versionLabelSnapshot: original.versionLabelSnapshot,
            packagingLabelSnapshot: original.packagingLabelSnapshot,
            unit: original.unit,
            quantity,
            reason: reason?.code ?? original.reason,
            reasonId: reason?.id ?? original.reasonId,
            sourceType: 'MANUAL',
            requestId: dto.requestId,
            sourceEventId: original.sourceEventId,
            correctsEventId: original.id,
            correctionReason: dto.reason,
            notes: dto.notes ?? original.notes,
            recordedById: userId,
            occurredAt,
          },
          include: PRODUCTION_LOSS_EVENT_INCLUDE,
        });

        await this.writeAudit(tx, userId, 'CORRECT', correction.id, ctx, {
          type: original.type,
          quantity: quantity.toString(),
          unit: original.unit,
          correctsEventId: original.id,
          reason: dto.reason,
          productionRunId: original.productionRunId,
        });
        return correction;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await this.findByRequestId(dto.requestId, ctx);
        if (raced) return raced;
        throw this.conflict('productionLoss.duplicateRequest');
      }
      throw error;
    }
  }

  async getRunLosses(runId: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const run = await (this.prisma as any).productionRun.findFirst({
      where: { id: runId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) throw this.notFound('productionLoss.runNotFound');
    const page = query.page || 1;
    const limit = query.limit || 50;
    const where = { companyId: ctx.companyId, branchId: ctx.branchId, productionRunId: runId };
    const [events, segments, total] = await Promise.all([
      (this.prisma as any).productionLossQuantityEvent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }],
        include: PRODUCTION_LOSS_EVENT_INCLUDE,
      }),
      (this.prisma as any).downtimeSegment.findMany({
        where: { companyId: ctx.companyId, branchId: ctx.branchId, productionRunId: runId, status: { in: ['OPEN', 'CLOSED'] } },
        orderBy: [{ startedAt: 'asc' }],
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          durationMinutes: true,
          planned: true,
          severity: true,
          ownerDomain: true,
          status: true,
          reason: { select: { id: true, code: true, nameAr: true, nameEn: true, lossCategory: true } },
          machine: { select: { id: true, machineCode: true, name: true } },
        },
      }),
      (this.prisma as any).productionLossQuantityEvent.count({ where }),
    ]);
    const totals = (events as any[]).reduce((acc: any, e: any) => {
      acc[e.type] = (acc[e.type] || new Prisma.Decimal(0)).plus(e.quantity);
      return acc;
    }, {} as Record<string, Prisma.Decimal>);
    const totalDowntimeMinutes = (segments as any[]).reduce((acc: number, s: any) => acc + Number(s.durationMinutes || 0), 0);
    return {
      runId,
      runNumber: run.runNumber,
      segments,
      totalDowntimeMinutes,
      events,
      totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, (v as Prisma.Decimal).toString()])),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
