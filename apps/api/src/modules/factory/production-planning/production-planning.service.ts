import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionCapacityStandardsService } from '../production-capacity-standards/production-capacity-standards.service';
import { ProductionMaterialRequirementsService } from '../production-material-requirements/production-material-requirements.service';
import { calculatePlannedDuration } from '../production-orders/production-order-duration';
import { PRODUCTION_ORDER_AUDIT_ENTITY } from '../production-orders/production-order.constants';
import {
  PLANNING_BLOCKING_ORDER_STATUSES,
  PLANNING_BLOCKING_RUN_STATUSES,
  PLANNING_DEFAULT_HORIZON_DAYS,
  PLANNING_EDITABLE_STATUSES,
  PLANNING_MAX_HORIZON_DAYS,
  PLANNING_REASON_I18N_KEYS,
  PlanningReasonCode,
} from './production-planning.constants';
import {
  PlanningDraftResult,
  PlanningResourceLoad,
  PlanningWorkingInterval,
  ScheduledOperation,
  UnscheduledOperation,
} from './production-planning.types';
import { ApplyPlanningScheduleDto, PreviewPlanningScheduleDto } from './dto/planning-schedule.dto';

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const ENGINE_VERSION = 'FINITE_CAPACITY_V1' as const;
const MS_PER_MINUTE = 60000;

interface OccupiedInterval {
  start: number;
  end: number;
}

/**
 * Deterministic finite-capacity Production Planning & Scheduling engine.
 *
 * Read-only with respect to physical/committed facts: Preview computes a draft
 * schedule in memory and persists nothing. Apply persists ONLY plannedStartAt /
 * plannedEndAt for editable (DRAFT/PLANNED, unfrozen) orders, guarded by
 * tenant scope, optimistic lockVersion, and a serializable transaction.
 *
 * Two-phase: an internal compute() returns the deterministic draft; preview
 * returns it directly; apply recomputes it in-transaction and asserts that each
 * requested order's proposed slot matches the client-supplied slot.
 */
@Injectable()
export class ProductionPlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly capacityStandards: ProductionCapacityStandardsService,
    private readonly materialRequirements: ProductionMaterialRequirementsService,
  ) {}

  async preview(dto: PreviewPlanningScheduleDto, ctx: ActiveOperationalContext) {
    return this.compute(dto, ctx, this.prisma);
  }

  async apply(dto: ApplyPlanningScheduleDto, userId: string, ctx: ActiveOperationalContext) {
    try {
      return await this.applyInternal(dto, userId, ctx);
    } catch (error) {
      if (this.isConcurrencyError(error)) {
        throw new ConflictException({ messageKey: 'productionOrder.staleVersion', details: { reason: 'concurrentApply' } });
      }
      throw error;
    }
  }

  /** A serializable transaction conflict / deadlock must degrade to a controlled 409, never a 500. */
  private isConcurrencyError(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'P2034') return true;
    const message = String((error as { message?: string } | null)?.message ?? '');
    return /deadlock|serializ|1205|3960/i.test(message);
  }

  private async applyInternal(dto: ApplyPlanningScheduleDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await this.compute(dto, ctx, tx);

      const byId = new Map(draft.scheduled.map((op) => [op.orderId, op]));
      const applied: ScheduledOperation[] = [];
      const rejected: Array<{ orderId: string; reasons: PlanningReasonCode[]; reasonKeys: string[] }> = [];

      for (const item of dto.plans) {
        const op = byId.get(item.orderId);
        if (!op) {
          rejected.push({ orderId: item.orderId, reasons: ['INVALID_ORDER_STATE'], reasonKeys: [PLANNING_REASON_I18N_KEYS.INVALID_ORDER_STATE] });
          continue;
        }
        const current = await tx.productionOrder.findFirst({
          where: { id: item.orderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        });
        if (!current) {
          rejected.push({ orderId: item.orderId, reasons: ['INVALID_REFERENCES'], reasonKeys: [PLANNING_REASON_I18N_KEYS.INVALID_REFERENCES] });
          continue;
        }
        if (!(PLANNING_EDITABLE_STATUSES as readonly string[]).includes(current.status) || current.snapshotFrozenAt) {
          rejected.push({ orderId: item.orderId, reasons: ['INVALID_ORDER_STATE'], reasonKeys: [PLANNING_REASON_I18N_KEYS.INVALID_ORDER_STATE] });
          continue;
        }
        if (current.lockVersion !== item.lockVersion) {
          throw new ConflictException({ messageKey: 'productionOrder.staleVersion', details: { orderId: item.orderId } });
        }

        const desiredStart = new Date(item.scheduledStartAt);
        const desiredEnd = new Date(item.scheduledEndAt);
        if (!Number.isFinite(desiredStart.getTime()) || !Number.isFinite(desiredEnd.getTime()) || desiredEnd <= desiredStart) {
          throw new BadRequestException({ messageKey: 'common.validationFailed', errors: [{ field: 'scheduledStartAt', code: 'productionPlanning.invalidRange' }] });
        }

        const expectedStart = new Date(op.scheduledStartAt).getTime();
        const expectedEnd = new Date(op.scheduledEndAt).getTime();
        if (Math.abs(expectedStart - desiredStart.getTime()) > MS_PER_MINUTE || Math.abs(expectedEnd - desiredEnd.getTime()) > MS_PER_MINUTE) {
          throw new ConflictException({ messageKey: 'productionPlanning.staleDraft', details: { orderId: item.orderId } });
        }

        const count = await (tx as any).productionOrder.updateMany({
          where: {
            id: item.orderId,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            deletedAt: null,
            lockVersion: item.lockVersion,
          },
          data: {
            plannedStartAt: desiredStart,
            plannedEndAt: desiredEnd,
            productionLineId: op.productionLineId,
            machineId: op.machineId,
            updatedById: userId,
            lockVersion: { increment: 1 },
          },
        });
        if (count.count !== 1) {
          throw new ConflictException({ messageKey: 'productionOrder.staleVersion', details: { orderId: item.orderId } });
        }

        await this.audit.logWithClient(tx, {
          userId,
          action: 'RESCHEDULE',
          entity: PRODUCTION_ORDER_AUDIT_ENTITY,
          entityId: item.orderId,
          details: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            orderNumber: op.orderNumber,
            engineVersion: ENGINE_VERSION,
            before: { plannedStartAt: op.originalStartAt, plannedEndAt: op.originalEndAt, productionLineId: current.productionLineId, machineId: current.machineId },
            after: { plannedStartAt: desiredStart.toISOString(), plannedEndAt: desiredEnd.toISOString(), productionLineId: op.productionLineId, machineId: op.machineId },
          },
        });

        applied.push(op);
      }

      return {
        applied: applied.length,
        rejected: rejected.length,
        operations: applied,
        rejections: rejected,
        engineVersion: ENGINE_VERSION,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // ---------------------------------------------------------------------------
  // Deterministic compute (read-only)
  // ---------------------------------------------------------------------------

  private async compute(input: PreviewPlanningScheduleDto, ctx: ActiveOperationalContext, client: any): Promise<PlanningDraftResult> {
    const now = new Date();
    const horizon = this.resolveHorizon(input, now);

    const calendarId = await this.resolveCalendarId(input.calendarId, ctx, client);
    const calendar = await client.productionShiftCalendar.findFirst({
      where: { id: calendarId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null, status: 'ACTIVE' },
      include: {
        entries: { include: { shift: { select: { id: true, code: true, startTime: true, endTime: true, breakMinutes: true } } }, orderBy: { date: 'asc' } },
        template: { include: { days: { include: { shift: { select: { id: true, code: true, startTime: true, endTime: true, breakMinutes: true } } } } } },
      },
    });
    if (!calendar) throw new NotFoundException({ messageKey: 'productionPlanning.calendarNotFound' });

    const intervalsByDate = this.buildIntervalIndex(calendar, horizon);

    const orders = await client.productionOrder.findMany({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        deletedAt: null,
        status: { in: PLANNING_EDITABLE_STATUSES as unknown as string[] },
        ...(input.orderIds && input.orderIds.length ? { id: { in: input.orderIds } } : {}),
        ...(input.productionLineId ? { productionLineId: input.productionLineId } : {}),
      },
      include: {
        capacityStandard: { select: { id: true, code: true } },
        productionLine: { select: { id: true, code: true, name: true } },
      },
    });

    const blocking = await this.collectOccupied(ctx, client, horizon);
    const occupiedByLine = new Map<string, OccupiedInterval[]>();
    for (const fact of blocking) {
      const list = occupiedByLine.get(fact.productionLineId) ?? [];
      list.push({ start: fact.start, end: fact.end });
      occupiedByLine.set(fact.productionLineId, list);
    }

    const ordered = [...orders].sort((a, b) => {
      const pr = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
      if (pr !== 0) return pr;
      const dueA = new Date(a.plannedEndAt).getTime();
      const dueB = new Date(b.plannedEndAt).getTime();
      if (dueA !== dueB) return dueA - dueB;
      return String(a.orderNumber).localeCompare(String(b.orderNumber));
    });

    const scheduled: ScheduledOperation[] = [];
    const unscheduled: UnscheduledOperation[] = [];
    const lineLoad = new Map<string, { used: number; count: number; label: string; machineId: string | null }>();
    const lineAssignedByLine = new Map<string, OccupiedInterval[]>();

    for (const order of ordered) {
      const assignedForLine = lineAssignedByLine.get(order.productionLineId) ?? [];
      const result = await this.scheduleOrder(order, ctx, client, calendar, intervalsByDate, occupiedByLine, assignedForLine, horizon);
      if ('reasons' in result) {
        unscheduled.push(this.buildUnscheduled(order, result.reasons, result.details));
        continue;
      }
      scheduled.push(result.operation);
      const list = occupiedByLine.get(result.operation.productionLineId) ?? [];
      const slot = { start: new Date(result.operation.scheduledStartAt).getTime(), end: new Date(result.operation.scheduledEndAt).getTime() };
      list.push(slot);
      occupiedByLine.set(result.operation.productionLineId, list);
      const assignedList = lineAssignedByLine.get(result.operation.productionLineId) ?? [];
      assignedList.push(slot);
      lineAssignedByLine.set(result.operation.productionLineId, assignedList);
      const lineLabel = order.productionLine?.name || order.productionLine?.code || order.productionLineId;
      const load = lineLoad.get(order.productionLineId) ?? { used: 0, count: 0, label: lineLabel, machineId: order.machineId };
      load.label = load.label || lineLabel;
      load.used += result.durationMinutes;
      load.count += 1;
      lineLoad.set(order.productionLineId, load);
    }

    const resourceLoad: PlanningResourceLoad[] = [...lineLoad.entries()].map(([productionLineId, agg]) => {
      const availableMinutes = this.availableMinutesForLine(productionLineId, intervalsByDate, horizon);
      const used = new Prisma.Decimal(agg.used);
      const available = new Prisma.Decimal(availableMinutes);
      const util = available.greaterThan(0) ? used.div(available).mul(100).toDecimalPlaces(4) : new Prisma.Decimal(0);
      return {
        productionLineId,
        machineId: agg.machineId,
        label: agg.label || productionLineId,
        usedMinutes: used.toDecimalPlaces(4).toString(),
        availableMinutes: available.toDecimalPlaces(4).toString(),
        utilizationPercent: util.toString(),
        operationCount: agg.count,
      };
    }).sort((a, b) => a.productionLineId.localeCompare(b.productionLineId));

    const late = scheduled.filter((s) => s.latenessState === 'LATE').length;
    const shortageRisk = scheduled.filter((s) => s.materialState === 'SHORTAGE').length;

    return {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      horizonFrom: horizon.from.toISOString(),
      horizonTo: horizon.to.toISOString(),
      calendarId,
      generatedAt: now.toISOString(),
      engineVersion: ENGINE_VERSION,
      scheduled,
      unscheduled,
      resourceLoad,
      totals: {
        requested: ordered.length,
        scheduled: scheduled.length,
        unscheduled: unscheduled.length,
        late,
        shortageRisk,
      },
    };
  }

  private async scheduleOrder(
    order: any,
    ctx: ActiveOperationalContext,
    client: any,
    calendar: any,
    intervalsByDate: Map<string, PlanningWorkingInterval[]>,
    occupiedByLine: Map<string, OccupiedInterval[]>,
    lineAssigned: OccupiedInterval[],
    horizon: { from: Date; to: Date },
  ): Promise<{ operation: ScheduledOperation; durationMinutes: number } | { reasons: PlanningReasonCode[]; details?: Record<string, unknown> }> {
    const reasons: PlanningReasonCode[] = [];

    if (!(PLANNING_EDITABLE_STATUSES as readonly string[]).includes(order.status) || order.snapshotFrozenAt) {
      return { reasons: ['INVALID_ORDER_STATE'] };
    }

    let durationMinutes: number;
    let capacity: any;
    try {
      capacity = await this.resolveCapacity(order, ctx, client);
      const duration = calculatePlannedDuration({
        plannedQuantity: order.plannedQuantity,
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
      durationMinutes = Number(duration.plannedDurationMinutes.toString());
    } catch (error: any) {
      const key = error?.getResponse?.()?.messageKey || error?.messageKey;
      if (key === 'capacityStandard.ambiguousResolution') return { reasons: ['AMBIENT_CAPACITY_AMBIGUOUS'] };
      if (key === 'capacityStandard.notConfigured') return { reasons: ['NO_CAPACITY_STANDARD'] };
      return { reasons: ['INVALID_REFERENCES'], details: { messageKey: key ?? null } };
    }

    const materialState = await this.materialState(order.id, ctx);

    const lineSlots = occupiedByLine.get(order.productionLineId) ?? [];
    const occupied = [...lineSlots, ...lineAssigned];

    const placement = this.findEarliestFeasible(durationMinutes, intervalsByDate, occupied, horizon);
    if (!placement) {
      const hasAnyWorking = this.availableMinutesForLine(order.productionLineId, intervalsByDate, horizon) > 0;
      reasons.push(hasAnyWorking ? 'RESOURCE_FULL' : 'NO_WORKING_SHIFT');
      if (materialState === 'SHORTAGE') reasons.push('MATERIAL_SHORTAGE');
      return { reasons, details: { requiredMinutes: durationMinutes } };
    }

    const originalStart = new Date(order.plannedStartAt).getTime();
    const originalEnd = new Date(order.plannedEndAt).getTime();
    const target = originalEnd;
    const lateness = placement.end - target;
    const latenessMinutes = lateness > 0 ? lateness / MS_PER_MINUTE : 0;

    const operation: ScheduledOperation = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      priority: order.priority,
      originalStartAt: new Date(originalStart).toISOString(),
      originalEndAt: new Date(originalEnd).toISOString(),
      scheduledStartAt: new Date(placement.start).toISOString(),
      scheduledEndAt: new Date(placement.end).toISOString(),
      productionLineId: order.productionLineId,
      productionLineCode: order.productionLine?.code || null,
      productionLineName: order.productionLine?.name || null,
      machineId: order.machineId || null,
      capacityStandardId: capacity.id,
      capacityStandardCode: capacity.code,
      plannedDurationMinutes: new Prisma.Decimal(durationMinutes).toDecimalPlaces(4).toString(),
      sequenceOnResource: 0,
      latenessMinutes: new Prisma.Decimal(latenessMinutes).toDecimalPlaces(4).toString(),
      latenessState: latenessMinutes > 0 ? 'LATE' : 'ON_TIME',
      materialState,
      materialWarnings: materialState === 'SHORTAGE' ? ['productionMaterialRequirement.shortageWarning'] : [],
      changed: Math.abs(placement.start - originalStart) > MS_PER_MINUTE || Math.abs(placement.end - originalEnd) > MS_PER_MINUTE,
    };
    return { operation, durationMinutes };
  }

  /**
   * Earliest feasible placement of an operation that may span multiple working
   * intervals (and pause across non-working gaps). The operation occupies the
   * contiguous wall-clock span [start, end] but only *counts* working minutes;
   * non-working gaps within the span are idle, and an occupied block forces the
   * operation to continue after the block. Deterministic by construction.
   */
  private findEarliestFeasible(
    durationMinutes: number,
    intervalsByDate: Map<string, PlanningWorkingInterval[]>,
    occupied: OccupiedInterval[],
    horizon: { from: Date; to: Date },
  ): { start: number; end: number } | null {
    const requiredMs = durationMinutes * MS_PER_MINUTE;
    const horizonFrom = horizon.from.getTime();
    const horizonTo = horizon.to.getTime();
    const available = this.availableSegments(intervalsByDate, occupied, horizon);
    if (!available.length) return null;

    for (let i = 0; i < available.length; i += 1) {
      const start = available[i].start;
      if (start >= horizonTo) break;
      const end = this.footprintEnd(start, requiredMs, available, horizonTo);
      if (end !== null) return { start, end };
    }
    return null;
  }

  /**
   * Working-time segments = working intervals minus occupied blocks, clipped to
   * the horizon, sorted and merged. Occupied blocks remove capacity; the
   * operation's wall-clock span may bridge gaps between segments.
   */
  private availableSegments(
    intervalsByDate: Map<string, PlanningWorkingInterval[]>,
    occupied: OccupiedInterval[],
    horizon: { from: Date; to: Date },
  ): OccupiedInterval[] {
    const horizonFrom = horizon.from.getTime();
    const horizonTo = horizon.to.getTime();
    const raw: OccupiedInterval[] = [];
    for (const [, intervals] of intervalsByDate) {
      for (const iv of intervals) {
        const s = Math.max(new Date(iv.start).getTime(), horizonFrom);
        const e = Math.min(new Date(iv.end).getTime(), horizonTo);
        if (e > s) raw.push({ start: s, end: e });
      }
    }
    raw.sort((a, b) => a.start - b.start);

    const sortedOccupied = [...occupied].sort((a, b) => a.start - b.start);
    const result: OccupiedInterval[] = [];
    for (const seg of raw) {
      let cursor = seg.start;
      for (const block of sortedOccupied) {
        if (block.end <= cursor || block.start >= seg.end) continue;
        if (block.start > cursor) result.push({ start: cursor, end: Math.min(block.start, seg.end) });
        cursor = Math.max(cursor, block.end);
        if (cursor >= seg.end) break;
      }
      if (cursor < seg.end) result.push({ start: cursor, end: seg.end });
    }
    return result;
  }

  /**
   * Given a wall-clock start, returns the wall-clock instant at which the
   * accumulated working time across the available segments reaches requiredMs,
   * or null if the horizon is exhausted first.
   */
  private footprintEnd(start: number, requiredMs: number, segments: OccupiedInterval[], horizonTo: number): number | null {
    let remaining = requiredMs;
    for (const seg of segments) {
      if (seg.end <= start) continue;
      const usableStart = Math.max(seg.start, start);
      if (usableStart >= horizonTo) return null;
      const usableEnd = Math.min(seg.end, horizonTo);
      const usable = usableEnd - usableStart;
      if (usable <= 0) continue;
      remaining -= usable;
      if (remaining <= 0) {
        return usableEnd + remaining;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Read-only working-interval expander (mirrors resolveDay precedence)
  // ---------------------------------------------------------------------------

  private buildIntervalIndex(calendar: any, horizon: { from: Date; to: Date }): Map<string, PlanningWorkingInterval[]> {
    const index = new Map<string, PlanningWorkingInterval[]>();
    const entryByDay = new Map<string, any>();
    for (const entry of calendar.entries ?? []) {
      entryByDay.set(this.dayKey(new Date(entry.date)), entry);
    }
    const templateDayByDow = new Map<number, any>();
    for (const day of calendar.template?.days ?? []) {
      templateDayByDow.set(day.dayOfWeek, day);
    }

    const effectiveFrom = new Date(calendar.effectiveFrom).getTime();
    const effectiveTo = calendar.effectiveTo ? new Date(calendar.effectiveTo).getTime() : Infinity;

    const cursor = new Date(this.floorDay(horizon.from));
    cursor.setHours(0, 0, 0, 0);
    const last = horizon.to.getTime();
    let guard = 0;
    while (cursor.getTime() <= last && guard < PLANNING_MAX_HORIZON_DAYS + 2) {
      guard += 1;
      const dayStart = cursor.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const withinRange = dayEnd > effectiveFrom && dayStart <= effectiveTo;
      if (withinRange) {
        const key = this.dayKey(cursor);
        const entry = entryByDay.get(key);
        if (entry) {
          if (entry.isWorkDay && entry.shift) {
            index.set(key, [this.toInterval(cursor, entry.shift, 'ENTRY')]);
          }
        } else if (calendar.templateId) {
          const dow = cursor.getDay();
          const templateDay = templateDayByDow.get(dow);
          if (templateDay && templateDay.isWorkDay && templateDay.shift) {
            index.set(key, [this.toInterval(cursor, templateDay.shift, 'TEMPLATE')]);
          }
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return index;
  }

  private toInterval(day: Date, shift: any, source: 'ENTRY' | 'TEMPLATE'): PlanningWorkingInterval {
    const [sh, sm] = String(shift.startTime).split(':').map((n: string) => parseInt(n, 10));
    const [eh, em] = String(shift.endTime).split(':').map((n: string) => parseInt(n, 10));
    const start = new Date(day);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(day);
    end.setHours(eh, em, 0, 0);
    if (end.getTime() <= start.getTime()) {
      end.setDate(end.getDate() + 1);
    }
    // The domain exposes a single breakMinutes value per shift (no break windows).
    // Deterministically model it as trailing unavailability: usable window is
    // [start, end - breakMinutes). This is a documented limitation.
    const breakMinutes = Number(shift.breakMinutes ?? 0);
    const usableEnd = new Date(end.getTime() - breakMinutes * MS_PER_MINUTE);
    const effectiveEnd = usableEnd.getTime() > start.getTime() ? usableEnd : new Date(start.getTime());
    return {
      start: start.toISOString(),
      end: effectiveEnd.toISOString(),
      minutes: (effectiveEnd.getTime() - start.getTime()) / MS_PER_MINUTE,
      source,
      shiftId: shift.id ?? null,
      shiftCode: shift.code ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Occupied facts (RELEASED/IN_PROGRESS orders + READY/RUNNING/PAUSED runs)
  // ---------------------------------------------------------------------------

  private async collectOccupied(ctx: ActiveOperationalContext, client: any, horizon: { from: Date; to: Date }): Promise<Array<{ productionLineId: string; start: number; end: number }>> {
    const facts: Array<{ productionLineId: string; start: number; end: number }> = [];

    const orders = await client.productionOrder.findMany({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        deletedAt: null,
        status: { in: PLANNING_BLOCKING_ORDER_STATUSES as unknown as string[] },
        plannedEndAt: { gt: horizon.from },
        plannedStartAt: { lt: horizon.to },
      },
      select: { productionLineId: true, plannedStartAt: true, plannedEndAt: true },
    });
    for (const o of orders) {
      facts.push({ productionLineId: o.productionLineId, start: new Date(o.plannedStartAt).getTime(), end: new Date(o.plannedEndAt).getTime() });
    }

    const runs = await client.productionRun.findMany({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        deletedAt: null,
        status: { in: PLANNING_BLOCKING_RUN_STATUSES as unknown as string[] },
        startedAt: { not: null },
        OR: [{ endedAt: null }, { endedAt: { gt: horizon.from } }],
      },
      select: { productionLineId: true, startedAt: true, endedAt: true, status: true },
    });
    for (const r of runs) {
      const start = new Date(r.startedAt).getTime();
      const end = r.endedAt ? new Date(r.endedAt).getTime() : horizon.to.getTime();
      if (start >= horizon.to.getTime()) continue;
      facts.push({ productionLineId: r.productionLineId, start, end });
    }

    return facts;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async resolveCapacity(order: any, ctx: ActiveOperationalContext, client: any) {
    const unit = await client.productionUnit.findFirst({
      where: { id: order.productionUnitId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      select: { code: true },
    });
    const quantityUnit = String(unit?.code ?? '').toUpperCase();
    return this.capacityStandards.resolveWithClient({
      productionProductId: order.productionProductDefinitionId,
      productionVersionId: order.productionVersionId,
      productionPackagingId: order.productionPackagingId || undefined,
      productionLineId: order.productionLineId,
      machineId: order.machineId || undefined,
      outputUnit: quantityUnit,
      timeBasis: order.capacityTimeBasis,
      requestedAt: new Date(order.plannedStartAt).toISOString(),
    } as any, ctx, client);
  }

  /**
   * Material readiness is surfaced as a WARNING only (Release is the enforcing
   * gate). Delegates to the canonical readiness contract: a missing frozen
   * snapshot is UNKNOWN, any per-line shortage warning maps to SHORTAGE.
   */
  private async materialState(orderId: string, ctx: ActiveOperationalContext): Promise<'READY' | 'SHORTAGE' | 'UNKNOWN'> {
    try {
      const readiness = await this.materialRequirements.getOrderReadiness(orderId, ctx);
      if (!readiness || readiness.status === 'NOT_READY' && (readiness.blockers?.length ?? 0) > 0 && (readiness.lines?.length ?? 0) === 0) {
        return 'UNKNOWN';
      }
      const shortage = (readiness.lines ?? []).some((line: any) => line.status === 'SHORT' || line.status === 'OVER_ISSUE');
      return shortage ? 'SHORTAGE' : 'READY';
    } catch {
      return 'UNKNOWN';
    }
  }

  private async resolveCalendarId(explicit: string | undefined, ctx: ActiveOperationalContext, client: any): Promise<string> {
    if (explicit) {
      const owned = await client.productionShiftCalendar.findFirst({
        where: { id: explicit, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) throw new NotFoundException({ messageKey: 'productionPlanning.calendarNotFound' });
      return explicit;
    }
    const calendars = await client.productionShiftCalendar.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
      take: 2,
      orderBy: { effectiveFrom: 'desc' },
    });
    if (calendars.length === 0) throw new NotFoundException({ messageKey: 'productionPlanning.noCalendar' });
    if (calendars.length > 1) throw new BadRequestException({ messageKey: 'productionPlanning.calendarAmbiguous' });
    return calendars[0].id;
  }

  private buildUnscheduled(order: any, reasons: PlanningReasonCode[], details?: Record<string, unknown>): UnscheduledOperation {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      priority: order.priority,
      reasons,
      reasonKeys: reasons.map((r) => PLANNING_REASON_I18N_KEYS[r]),
      details,
    };
  }

  private availableMinutesForLine(_lineId: string, intervalsByDate: Map<string, PlanningWorkingInterval[]>, horizon: { from: Date; to: Date }): number {
    let total = 0;
    for (const [, intervals] of intervalsByDate) {
      for (const iv of intervals) {
        const s = new Date(iv.start).getTime();
        const e = new Date(iv.end).getTime();
        const clippedStart = Math.max(s, horizon.from.getTime());
        const clippedEnd = Math.min(e, horizon.to.getTime());
        if (clippedEnd > clippedStart) total += (clippedEnd - clippedStart) / MS_PER_MINUTE;
      }
    }
    return total;
  }

  private resolveHorizon(input: PreviewPlanningScheduleDto, now: Date): { from: Date; to: Date } {
    const from = input.horizonFrom ? new Date(input.horizonFrom) : this.floorDay(now);
    const defaultTo = new Date(from.getTime());
    defaultTo.setDate(defaultTo.getDate() + PLANNING_DEFAULT_HORIZON_DAYS);
    const to = input.horizonTo ? new Date(input.horizonTo) : defaultTo;
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
      throw new BadRequestException({ messageKey: 'common.validationFailed', errors: [{ field: 'horizonFrom', code: 'productionPlanning.invalidHorizon' }] });
    }
    const days = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (days > PLANNING_MAX_HORIZON_DAYS) {
      throw new BadRequestException({ messageKey: 'common.validationFailed', errors: [{ field: 'horizonTo', code: 'productionPlanning.horizonTooLong' }] });
    }
    return { from, to };
  }

  private floorDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private dayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
