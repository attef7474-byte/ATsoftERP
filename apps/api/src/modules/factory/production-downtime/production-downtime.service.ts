import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import {
  DOWNTIME_LOG_AUDIT_ENTITY,
  DOWNTIME_SEGMENT_AUDIT_ENTITY,
  DOWNTIME_SEGMENT_INCLUDE,
  DOWNTIME_SEGMENT_STATUSES,
} from './production-downtime.constants';
import {
  allowedStatusTransition,
  computeDurationMinutes,
  intervalsOverlap,
  isValidInterval,
  resolveOccurrenceType,
  toDate,
} from './downtime-domain.util';
import {
  CancelDowntimeDto,
  CloseDowntimeDto,
  CorrectDowntimeDto,
  DowntimeQueryDto,
  LinkMaintenanceDto,
  OpenDowntimeDto,
} from './dto/production-downtime.dto';

const round2 = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class ProductionDowntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private notFound(key: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message: key });
  }

  private badRequest(key: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message: key });
  }

  private conflict(key: string): ConflictException {
    return new ConflictException({ messageKey: key, message: key });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] };
  }

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async findSegment(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const segment = await client.downtimeSegment.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: DOWNTIME_SEGMENT_INCLUDE,
    });
    if (!segment) throw this.notFound('productionDowntime.segmentNotFound');
    return segment;
  }

  private async findByRequestId(requestId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.downtimeSegment.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId },
      include: DOWNTIME_SEGMENT_INCLUDE,
    });
  }

  private async liftMachine(machineId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    if (!machineId) return null;
    const machine = await client.machine.findFirst({ where: { id: machineId, ...this.machineScope(ctx), deletedAt: null } });
    if (!machine) throw this.notFound('productionDowntime.machineNotFound');
    return machine;
  }

  private async liftLine(lineId: string | null | undefined, ctx: ActiveOperationalContext, client: any = this.prisma) {
    if (!lineId) return null;
    const line = await client.productionLine.findFirst({ where: { id: lineId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
    if (!line) throw this.notFound('productionDowntime.lineNotFound');
    return line;
  }

  private async liftShift(shiftId: string | null | undefined, ctx: ActiveOperationalContext, client: any = this.prisma) {
    if (!shiftId) return null;
    const shift = await client.productionShift.findFirst({ where: { id: shiftId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
    if (!shift) throw this.notFound('productionDowntime.shiftNotFound');
    return shift;
  }

  private async resolveActiveReason(reasonId: string | null | undefined, ctx: ActiveOperationalContext, client: any = this.prisma) {
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
    if (!reason) throw this.notFound('productionDowntime.reasonNotFound');
    return reason;
  }

  private async resolveRunContext(dto: OpenDowntimeDto, ctx: ActiveOperationalContext, client: any = this.prisma) {
    let run: any = null;
    if (dto.productionRunId) {
      run = await client.productionRun.findFirst({
        where: { id: dto.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!run) throw this.notFound('productionDowntime.runNotFound');
    }
    if (dto.productionOrderId) {
      const order = await client.productionOrder.findFirst({ where: { id: dto.productionOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
      if (!order) throw this.notFound('productionDowntime.orderNotFound');
      if (run && run.productionOrderId !== order.id) throw this.badRequest('productionDowntime.runContextMismatch');
    }
    const productionOrderId = dto.productionOrderId ?? run?.productionOrderId ?? null;
    const productionLineId = dto.productionLineId ?? run?.productionLineId ?? null;
    const shiftId = dto.shiftId ?? run?.shiftId ?? null;
    const machineId = dto.machineId ?? run?.machineId ?? null;
    if (run) {
      if (dto.productionLineId && run.productionLineId && dto.productionLineId !== run.productionLineId) {
        throw this.badRequest('productionDowntime.runContextMismatch');
      }
      if (dto.shiftId && run.shiftId && dto.shiftId !== run.shiftId) {
        throw this.badRequest('productionDowntime.runContextMismatch');
      }
      if (dto.machineId && run.machineId && dto.machineId !== run.machineId) {
        throw this.badRequest('productionDowntime.runContextMismatch');
      }
    }
    const machine = await this.liftMachine(machineId, ctx, client);
    if (!machine) throw this.badRequest('productionDowntime.openRequiresRunOrResource');
    const line = await this.liftLine(productionLineId, ctx, client);
    const shift = await this.liftShift(shiftId, ctx, client);
    if (run && run.machineId && machine.id !== run.machineId) throw this.badRequest('productionDowntime.runContextMismatch');
    return { run, productionOrderId, productionLineId, shiftId, machineId: machine.id, machine, line, shift };
  }

  private async findOverlappingSegments(
    client: any,
    ctx: ActiveOperationalContext,
    interval: { startedAt: Date; endedAt: Date | null },
    scopes: { productionRunId?: string | null; machineId?: string | null; productionLineId?: string | null },
    excludeSegmentId?: string,
  ) {
    const or: any[] = [];
    if (scopes.machineId) or.push({ machineId: scopes.machineId });
    if (scopes.productionRunId) or.push({ productionRunId: scopes.productionRunId });
    if (scopes.productionLineId) or.push({ productionLineId: scopes.productionLineId });
    const candidates = await client.downtimeSegment.findMany({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: { in: ['OPEN', 'CLOSED'] },
        ...(excludeSegmentId ? { id: { not: excludeSegmentId } } : {}),
        ...(or.length ? { OR: or } : {}),
      },
      select: { id: true, startedAt: true, endedAt: true, machineId: true, productionRunId: true, productionLineId: true },
    });
    return candidates.filter((c: any) => intervalsOverlap(interval, { startedAt: c.startedAt, endedAt: c.endedAt }));
  }

  private segmentDurationDecimal(startedAt: Date, endedAt: Date | null): Prisma.Decimal {
    const minutes = endedAt ? computeDurationMinutes(startedAt, endedAt) : 0;
    return new Prisma.Decimal(minutes.toFixed(4));
  }

  private async recomputeLogHeader(client: any, logId: string, ctx: ActiveOperationalContext) {
    const segments = await client.downtimeSegment.findMany({
      where: { downtimeLogId: logId, companyId: ctx.companyId, branchId: ctx.branchId },
      select: { startedAt: true, endedAt: true, durationMinutes: true, status: true },
    });
    const active = segments.filter((s: any) => s.status !== 'CANCELLED' && s.status !== 'SUPERSEDED');
    if (active.length === 0) {
      return client.downtimeLog.update({
        where: { id: logId },
        data: { status: 'CANCELLED', cancelledAt: new Date(), endTime: null, durationMinutes: 0 },
      });
    }
    const open = active.some((s: any) => s.status === 'OPEN');
    const closed = active.filter((s: any) => s.status === 'CLOSED' && s.endedAt);
    const startTime = new Date(Math.min(...active.map((s: any) => new Date(s.startedAt).getTime())));
    const endTime = open ? null : closed.length ? new Date(Math.max(...closed.map((s: any) => new Date(s.endedAt).getTime()))) : null;
    const durationMinutes = round2(closed.reduce((acc: number, s: any) => acc + Number(s.durationMinutes || 0), 0));
    return client.downtimeLog.update({
      where: { id: logId },
      data: { startTime, endTime, durationMinutes, status: open ? 'OPEN' : 'CLOSED', cancelledAt: null },
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

  async open(dto: OpenDowntimeDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findByRequestId(dto.requestId, ctx);
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = await this.findByRequestId(dto.requestId, ctx, tx);
        if (raced) return raced;

        const context = await this.resolveRunContext(dto, ctx, tx);
        const reason = await this.resolveActiveReason(dto.reasonId, ctx, tx);
        const startedAt = dto.startedAt ? toDate(dto.startedAt) : new Date();
        const endedAt = dto.endedAt ? toDate(dto.endedAt) : null;
        if (!Number.isFinite(startedAt.getTime())) throw this.badRequest('productionDowntime.invalidTime');
        if (endedAt && !Number.isFinite(endedAt.getTime())) throw this.badRequest('productionDowntime.invalidTime');
        if (endedAt && endedAt.getTime() > Date.now() + 60000) throw this.badRequest('productionDowntime.futureEnd');
        const intervalCheck = isValidInterval({ startedAt, endedAt });
        if (!intervalCheck.valid && intervalCheck.errorKey) throw this.badRequest(intervalCheck.errorKey);

        const planned = dto.planned ?? reason?.plannedDefault ?? false;
        const severity = dto.severity ?? reason?.severityDefault ?? 'MINOR';
        const ownerDomain = dto.ownerDomain ?? 'PRODUCTION';

        const overlapping = await this.findOverlappingSegments(tx, ctx, { startedAt, endedAt }, {
          productionRunId: context.run?.id ?? null,
          machineId: context.machineId,
          productionLineId: context.productionLineId,
        });
        if (overlapping.length > 0) {
          const hasOpenOverlap = overlapping.some((o: any) => !o.endedAt);
          throw hasOpenOverlap ? this.conflict('productionDowntime.openSegmentExists') : this.conflict('productionDowntime.overlapExists');
        }

        const now = new Date();
        const logReason = dto.reason || reason?.code || 'Production downtime';
        const log = await tx.downtimeLog.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            machineId: context.machineId,
            requestId: dto.maintenanceRequestId || null,
            productionRunId: context.run?.id ?? null,
            productionOrderId: context.productionOrderId,
            productionLineId: context.productionLineId,
            shiftId: context.shiftId,
            startTime: startedAt,
            endTime: endedAt,
            durationMinutes: endedAt ? round2(computeDurationMinutes(startedAt, endedAt)) : null,
            reason: logReason,
            occurrenceType: resolveOccurrenceType(planned),
            severity,
            sourceType: 'PRODUCTION',
            status: endedAt ? 'CLOSED' : 'OPEN',
            notes: dto.notes || null,
            createdAt: now,
            updatedAt: now,
          },
        });

        const segment = await tx.downtimeSegment.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            downtimeLogId: log.id,
            productionRunId: context.run?.id ?? null,
            productionOrderId: context.productionOrderId,
            shiftId: context.shiftId,
            productionLineId: context.productionLineId,
            machineId: context.machineId,
            startedAt,
            endedAt,
            durationMinutes: this.segmentDurationDecimal(startedAt, endedAt),
            reasonId: reason?.id ?? null,
            planned,
            severity,
            ownerDomain,
            maintenanceRequestId: dto.maintenanceRequestId || null,
            sourceType: 'MANUAL',
            status: endedAt ? 'CLOSED' : 'OPEN',
            requestId: dto.requestId,
            notes: dto.notes || null,
            recordedById: userId,
            closedById: endedAt ? userId : null,
            createdAt: now,
            updatedAt: now,
          },
          include: DOWNTIME_SEGMENT_INCLUDE,
        });

        await this.writeAudit(tx, userId, 'RECORD', DOWNTIME_SEGMENT_AUDIT_ENTITY, segment.id, ctx, {
          downtimeLogId: log.id,
          machineId: context.machineId,
          productionRunId: context.run?.id ?? null,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt?.toISOString() ?? null,
          planned,
          severity,
          ownerDomain,
          reasonId: reason?.id ?? null,
          source: 'OPEN',
        });
        return segment;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await this.findByRequestId(dto.requestId, ctx);
        if (raced) return raced;
        throw this.conflict('productionDowntime.idempotencyConflict');
      }
      throw error;
    }
  }

  async findAll(query: DowntimeQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.status) {
      if (!DOWNTIME_SEGMENT_STATUSES.includes(query.status as any)) throw this.badRequest('productionDowntime.invalidStatusTransition');
      where.status = query.status;
    }
    if (query.ownerDomain) where.ownerDomain = query.ownerDomain;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.dateFrom || query.dateTo) {
      where.startedAt = {};
      if (query.dateFrom) where.startedAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startedAt.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [{ notes: { contains: query.search } }, { downtimeLog: { reason: { contains: query.search } } }];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).downtimeSegment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ startedAt: 'desc' }],
        include: DOWNTIME_SEGMENT_INCLUDE,
      }),
      (this.prisma as any).downtimeSegment.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findSegment(id, ctx);
  }

  async close(id: string, dto: CloseDowntimeDto, userId: string, ctx: ActiveOperationalContext) {
    const segment = await this.findSegment(id, ctx);
    if (segment.status !== 'OPEN') {
      if (segment.status === 'CLOSED') throw this.conflict('productionDowntime.alreadyClosed');
      if (segment.status === 'CANCELLED') throw this.conflict('productionDowntime.cannotCloseCancelled');
      throw this.conflict('productionDowntime.cannotCloseSuperseded');
    }
    const endedAt = dto.endedAt ? toDate(dto.endedAt) : new Date();
    if (!Number.isFinite(endedAt.getTime())) throw this.badRequest('productionDowntime.invalidTime');
    if (endedAt.getTime() > Date.now() + 60000) throw this.badRequest('productionDowntime.futureEnd');
    const intervalCheck = isValidInterval({ startedAt: segment.startedAt, endedAt });
    if (!intervalCheck.valid && intervalCheck.errorKey) throw this.badRequest(intervalCheck.errorKey);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.downtimeSegment.update({
        where: { id },
        data: {
          endedAt,
          durationMinutes: this.segmentDurationDecimal(segment.startedAt, endedAt),
          status: 'CLOSED',
          closedById: userId,
          updatedAt: new Date(),
        },
        include: DOWNTIME_SEGMENT_INCLUDE,
      });
      await this.recomputeLogHeader(tx, segment.downtimeLogId, ctx);
      await this.writeAudit(tx, userId, 'CLOSE', DOWNTIME_SEGMENT_AUDIT_ENTITY, id, ctx, {
        downtimeLogId: segment.downtimeLogId,
        endedAt: endedAt.toISOString(),
      });
      return updated;
    });
  }

  async correct(id: string, dto: CorrectDowntimeDto, userId: string, ctx: ActiveOperationalContext) {
    const segment = await this.findSegment(id, ctx);
    if (segment.status === 'CANCELLED' || segment.status === 'SUPERSEDED') throw this.conflict('productionDowntime.cannotCorrectSegment');
    const startedAt = dto.startedAt ? toDate(dto.startedAt) : segment.startedAt;
    const endedAt = dto.endedAt !== undefined && dto.endedAt !== null && dto.endedAt !== '' ? toDate(dto.endedAt) : (segment.endedAt ?? null);
    if (!Number.isFinite(startedAt.getTime())) throw this.badRequest('productionDowntime.invalidTime');
    if (endedAt && !Number.isFinite(endedAt.getTime())) throw this.badRequest('productionDowntime.invalidTime');
    if (endedAt && endedAt.getTime() > Date.now() + 60000) throw this.badRequest('productionDowntime.futureEnd');
    const intervalCheck = isValidInterval({ startedAt, endedAt });
    if (!intervalCheck.valid && intervalCheck.errorKey) throw this.badRequest(intervalCheck.errorKey);

    return this.prisma.$transaction(async (tx) => {
      const overlapping = await this.findOverlappingSegments(tx, ctx, { startedAt, endedAt }, {
        productionRunId: segment.productionRunId,
        machineId: segment.machineId,
        productionLineId: segment.productionLineId,
      }, segment.id);
      if (overlapping.length > 0) throw this.conflict('productionDowntime.overlapExists');

      const planned = dto.planned ?? segment.planned;
      const severity = dto.severity ?? segment.severity;
      const ownerDomain = dto.ownerDomain ?? segment.ownerDomain;
      const reason = await this.resolveActiveReason(dto.reasonId ?? segment.reasonId, ctx, tx);

      const now = new Date();
      const correction = await tx.downtimeSegment.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          downtimeLogId: segment.downtimeLogId,
          productionRunId: segment.productionRunId,
          productionOrderId: segment.productionOrderId,
          shiftId: dto.shiftId ?? segment.shiftId,
          productionLineId: dto.productionLineId ?? segment.productionLineId,
          machineId: dto.machineId ?? segment.machineId,
          startedAt,
          endedAt,
          durationMinutes: this.segmentDurationDecimal(startedAt, endedAt),
          reasonId: reason?.id ?? null,
          planned,
          severity,
          ownerDomain,
          maintenanceRequestId: segment.maintenanceRequestId,
          maintenanceWorkOrderId: segment.maintenanceWorkOrderId,
          sourceType: 'MANUAL',
          status: endedAt ? 'CLOSED' : 'OPEN',
          correctsSegmentId: segment.id,
          correctionReason: dto.reason,
          notes: dto.notes ?? segment.notes,
          recordedById: userId,
          closedById: endedAt ? userId : null,
          createdAt: now,
          updatedAt: now,
        },
        include: DOWNTIME_SEGMENT_INCLUDE,
      });

      await tx.downtimeSegment.update({
        where: { id: segment.id },
        data: { status: 'SUPERSEDED', updatedAt: now },
      });
      await this.recomputeLogHeader(tx, segment.downtimeLogId, ctx);
      await this.writeAudit(tx, userId, 'CORRECT', DOWNTIME_SEGMENT_AUDIT_ENTITY, correction.id, ctx, {
        correctsSegmentId: segment.id,
        reason: dto.reason,
      });
      return correction;
    });
  }

  async cancel(id: string, dto: CancelDowntimeDto, userId: string, ctx: ActiveOperationalContext) {
    const segment = await this.findSegment(id, ctx);
    if (segment.status !== 'OPEN') {
      if (segment.status === 'CANCELLED') throw this.conflict('productionDowntime.alreadyCancelled');
      if (segment.status === 'CLOSED') throw this.conflict('productionDowntime.cannotCancelClosed');
      throw this.conflict('productionDowntime.cannotCancelSuperseded');
    }
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.downtimeSegment.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledById: userId, notes: dto.reason, updatedAt: now },
        include: DOWNTIME_SEGMENT_INCLUDE,
      });
      await this.recomputeLogHeader(tx, segment.downtimeLogId, ctx);
      await this.writeAudit(tx, userId, 'CANCEL', DOWNTIME_SEGMENT_AUDIT_ENTITY, id, ctx, {
        downtimeLogId: segment.downtimeLogId,
        reason: dto.reason,
      });
      return updated;
    });
  }

  async linkMaintenance(id: string, dto: LinkMaintenanceDto, userId: string, ctx: ActiveOperationalContext) {
    const segment = await this.findSegment(id, ctx);
    if (segment.status === 'CANCELLED' || segment.status === 'SUPERSEDED') throw this.conflict('productionDowntime.segmentNotLinkable');
    if (segment.maintenanceRequestId && segment.maintenanceRequestId !== dto.maintenanceRequestId) {
      throw this.conflict('productionDowntime.linkAlreadyDifferent');
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.maintenanceRequest.findFirst({
        where: { id: dto.maintenanceRequestId, machineId: segment.machineId },
        include: { machine: true },
      });
      if (!request || !this.machineOwns(request.machine, ctx)) throw this.notFound('productionDowntime.maintenanceRequestNotFound');

      let workOrder: any = null;
      if (dto.maintenanceWorkOrderId) {
        workOrder = await tx.maintenanceWorkOrder.findFirst({
          where: { id: dto.maintenanceWorkOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        });
        if (!workOrder) throw this.notFound('productionDowntime.workOrderNotFound');
        if (workOrder.requestId && workOrder.requestId !== request.id) throw this.badRequest('productionDowntime.workOrderRequestMismatch');
        if (workOrder.machineId && workOrder.machineId !== segment.machineId) throw this.badRequest('productionDowntime.maintenanceRequestMachineMismatch');
      }

      const now = new Date();
      const updated = await tx.downtimeSegment.update({
        where: { id },
        data: {
          maintenanceRequestId: request.id,
          maintenanceWorkOrderId: workOrder?.id ?? segment.maintenanceWorkOrderId,
          updatedAt: now,
        },
        include: DOWNTIME_SEGMENT_INCLUDE,
      });
      await tx.downtimeLog.update({
        where: { id: segment.downtimeLogId },
        data: { requestId: request.id, updatedAt: now },
      });
      await this.writeAudit(tx, userId, 'LINK_MAINTENANCE', DOWNTIME_SEGMENT_AUDIT_ENTITY, id, ctx, {
        maintenanceRequestId: request.id,
        maintenanceWorkOrderId: workOrder?.id ?? null,
        reason: dto.reason,
      });
      return updated;
    });
  }
}
