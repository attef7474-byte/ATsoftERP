import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { OperationalSourceChangesService } from '../operational-source-changes/operational-source-changes.service';
import { deriveRunTotals, TotalsInputEvent } from '../production-runs/production-runs.util';
import {
  aggregateFactor,
  availabilityFactor,
  decimal,
  idealRatePerHour,
  minutesBetween,
  oeeProduct,
  performanceFactor,
  qualityFactor,
} from './oee-formula.util';
import { clampToPeriod, intersectionMinutes, mergeIntervals, totalDurationMinutes } from './downtime-union.util';
import { ProductionPerformanceTargetsService } from './production-performance-targets.service';
import { ANALYTICS_EXPORT_AUDIT_ENTITY, ANALYTICS_INVALIDATE_AUDIT_ENTITY, ANALYTICS_LIMITS, ANALYTICS_TIMEZONE, OEE_FORMULA_VERSION } from './production-analytics.constants';
import { AnalyticsExportQueryDto, AnalyticsInvalidateDto, AnalyticsPageDto, AnalyticsQueryDto } from './dto/analytics-query.dto';

interface Window {
  from: Date;
  to: Date;
}

interface RunView {
  id: string;
  runNumber: string;
  status: string;
  productionOrderId: string;
  orderNumber: string;
  productionUnitId: string;
  productionUnitCode: string;
  productionLineId: string;
  productionLineCode: string;
  machineId: string | null;
  machineCode: string | null;
  productionProductDefinitionId: string;
  productCode: string;
  productName: string;
  shiftCode: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  plannedQuantity: Prisma.Decimal;
  quantityUnit: string;
  capacityStandardCode: string;
  capacityStandardRevision: number;
  standardRate: Prisma.Decimal;
  outputUnit: string;
  timeBasis: string;
  targetEfficiencyPercent: Prisma.Decimal;
  expectedYieldPercent: Prisma.Decimal;
}

interface RunMetrics {
  plannedMinutes: Prisma.Decimal;
  unplannedDowntimeMinutes: Prisma.Decimal;
  plannedDowntimeMinutes: Prisma.Decimal;
  operatingMinutes: Prisma.Decimal;
  idealOutput: Prisma.Decimal;
  totalOutput: Prisma.Decimal;
  goodOutput: Prisma.Decimal;
  rejectOutput: Prisma.Decimal;
  wasteTotal: Prisma.Decimal;
  reworkTotal: Prisma.Decimal;
  outputEventCount: number;
  availability: ReturnType<typeof availabilityFactor>;
  performance: ReturnType<typeof performanceFactor>;
  quality: ReturnType<typeof qualityFactor>;
  oee: ReturnType<typeof oeeProduct>;
}

type MetricsEntry = { metrics: RunMetrics; run: RunView; target: any };

@Injectable()
export class ProductionAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: ProductionPerformanceTargetsService,
    private readonly audit: AuditService,
    private readonly sourceChanges: OperationalSourceChangesService,
  ) {}

  async oee(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const { runs, views } = await this.loadRuns(query, ctx, window);
    const metrics = await this.computeAll(runs, views, window, ctx);
    return {
      formulaVersion: OEE_FORMULA_VERSION,
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      aggregates: this.aggregate(metrics),
      byProduct: this.groupBy(metrics, (v) => v.productionProductDefinitionId, (v) => v.productCode),
      runs: metrics.map((entry) => this.serializeRun(entry)),
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async trends(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const grain = query.grain || 'DAY';
    const { runs, views } = await this.loadRuns(query, ctx, window);
    const metrics = await this.computeAll(runs, views, window, ctx);
    const buckets = new Map<string, { from: Date; to: Date; entries: MetricsEntry[] }>();
    for (const entry of metrics) {
      const anchor = entry.run.startedAt ?? entry.run.endedAt ?? new Date();
      const { key, from, to } = this.bucket(anchor, grain);
      if (!buckets.has(key)) buckets.set(key, { from, to, entries: [] });
      buckets.get(key)!.entries.push(entry);
    }
    const items = [...buckets.entries()]
      .sort((a, b) => a[1].from.getTime() - b[1].from.getTime())
      .map(([key, bucket]) => ({
        key,
        from: bucket.from.toISOString(),
        to: bucket.to.toISOString(),
        runCount: bucket.entries.length,
        aggregates: this.aggregate(bucket.entries),
      }));
    return {
      grain,
      formulaVersion: OEE_FORMULA_VERSION,
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      bucketCount: items.length,
      items,
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async lossPareto(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const segments = await this.prisma.downtimeSegment.findMany({
      where: this.downtimeWhere(query, ctx, window),
      include: { reason: { select: { id: true, code: true, nameEn: true, nameAr: true, lossCategory: true, plannedDefault: true } } },
      orderBy: { startedAt: 'asc' },
    });
    const items = new Map<string, any>();
    let totalUnplanned = new Prisma.Decimal(0);
    let totalPlanned = new Prisma.Decimal(0);
    for (const segment of segments) {
      const duration = this.segmentMinutes(segment, window);
      if (segment.planned) totalPlanned = totalPlanned.plus(duration);
      else totalUnplanned = totalUnplanned.plus(duration);
      const key = segment.reasonId ?? '__UNCLASSIFIED__';
      const row = items.get(key) || {
        reasonId: segment.reasonId,
        reasonCode: segment.reason?.code ?? null,
        reasonNameEn: segment.reason?.nameEn ?? null,
        reasonNameAr: segment.reason?.nameAr ?? null,
        lossCategory: segment.reason?.lossCategory ?? null,
        plannedDefault: segment.reason?.plannedDefault ?? null,
        minutes: new Prisma.Decimal(0),
        count: 0,
      };
      row.minutes = row.minutes.plus(duration);
      row.count += 1;
      items.set(key, row);
    }
    const total = totalUnplanned.plus(totalPlanned);
    const list = [...items.values()]
      .map((row) => ({
        ...row,
        minutes: row.minutes.toDecimalPlaces(4).toString(),
        sharePercent: total.greaterThan(0) ? row.minutes.div(total).mul(100).toDecimalPlaces(4).toString() : '0',
      }))
      .sort((a, b) => decimal(b.minutes).minus(decimal(a.minutes)).toNumber())
      .slice(0, ANALYTICS_LIMITS.maxParetoTop);
    return {
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      totals: {
        unplannedMinutes: totalUnplanned.toDecimalPlaces(4).toString(),
        plannedMinutes: totalPlanned.toDecimalPlaces(4).toString(),
        totalMinutes: total.toDecimalPlaces(4).toString(),
        segmentCount: segments.length,
      },
      items: list,
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async bottlenecks(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const segments = await this.prisma.downtimeSegment.findMany({
      where: this.downtimeWhere(query, ctx, window),
      include: { machine: { select: { id: true, code: true, name: true } }, productionLine: { select: { id: true, code: true, name: true } } },
    });
    const items = new Map<string, any>();
    for (const segment of segments) {
      if (segment.planned) continue;
      const duration = this.segmentMinutes(segment, window);
      const key = segment.machineId ?? segment.productionLineId ?? '__UNASSIGNED__';
      const row = items.get(key) || {
        machineId: segment.machineId,
        machineCode: segment.machine?.code ?? null,
        machineName: segment.machine?.name ?? null,
        productionLineId: segment.productionLineId,
        productionLineCode: segment.productionLine?.code ?? null,
        minutes: new Prisma.Decimal(0),
        count: 0,
      };
      row.minutes = row.minutes.plus(duration);
      row.count += 1;
      items.set(key, row);
    }
    const total = [...items.values()].reduce((sum, row) => sum.plus(row.minutes), new Prisma.Decimal(0));
    const list = [...items.values()]
      .map((row) => ({ ...row, minutes: row.minutes.toDecimalPlaces(4).toString(), sharePercent: total.greaterThan(0) ? row.minutes.div(total).mul(100).toDecimalPlaces(4).toString() : '0' }))
      .sort((a, b) => decimal(b.minutes).minus(decimal(a.minutes)).toNumber());
    return {
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      totalUnplannedMinutes: total.toDecimalPlaces(4).toString(),
      items: list,
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async capacityVariance(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const { runs, views } = await this.loadRuns(query, ctx, window);
    const metrics = await this.computeAll(runs, views, window, ctx);
    const rows = metrics.map((entry) => {
      const planned = entry.run.plannedQuantity;
      const actual = entry.metrics.totalOutput;
      const ideal = entry.metrics.idealOutput;
      const variance = actual.minus(ideal);
      return {
        productionRunId: entry.run.id,
        runNumber: entry.run.runNumber,
        status: entry.run.status,
        productionOrderId: entry.run.productionOrderId,
        orderNumber: entry.run.orderNumber,
        productCode: entry.run.productCode,
        productName: entry.run.productName,
        productionLineCode: entry.run.productionLineCode,
        machineCode: entry.run.machineCode,
        capacityStandardCode: entry.run.capacityStandardCode,
        capacityStandardRevision: entry.run.capacityStandardRevision,
        plannedQuantity: planned.toDecimalPlaces(4).toString(),
        quantityUnit: entry.run.quantityUnit,
        actualOutput: actual.toDecimalPlaces(4).toString(),
        idealOutput: ideal.toDecimalPlaces(4).toString(),
        variance: variance.toDecimalPlaces(4).toString(),
        utilizationPercent: planned.greaterThan(0) ? actual.div(planned).mul(100).toDecimalPlaces(4).toString() : '0',
      };
    });
    const sums = rows.reduce(
      (acc, row) => ({
        planned: acc.planned.plus(row.plannedQuantity),
        actual: acc.actual.plus(row.actualOutput),
        ideal: acc.ideal.plus(row.idealOutput),
      }),
      { planned: new Prisma.Decimal(0), actual: new Prisma.Decimal(0), ideal: new Prisma.Decimal(0) },
    );
    return {
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      aggregates: {
        totalPlannedQuantity: sums.planned.toDecimalPlaces(4).toString(),
        totalActualOutput: sums.actual.toDecimalPlaces(4).toString(),
        totalIdealOutput: sums.ideal.toDecimalPlaces(4).toString(),
        totalVariance: sums.actual.minus(sums.ideal).toDecimalPlaces(4).toString(),
        utilizationPercent: sums.planned.greaterThan(0) ? sums.actual.div(sums.planned).mul(100).toDecimalPlaces(4).toString() : '0',
      },
      rows,
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async drilldown(query: AnalyticsPageDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, ANALYTICS_LIMITS.maxPageSize);
    const { runs, views, total } = await this.loadRuns(query, ctx, window, { paginate: true, page, limit });
    const metrics = await this.computeAll(runs, views, window, ctx);
    return {
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      runs: metrics.map((entry) => this.serializeRun(entry, true)),
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async output(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const { runs, views } = await this.loadRuns(query, ctx, window);
    const metrics = await this.computeAll(runs, views, window, ctx);
    return {
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      aggregates: this.outputTotals(metrics),
      byProduct: this.groupBy(metrics, (v) => v.productionProductDefinitionId, (v) => v.productCode).map((row) => ({ key: row.key, label: row.label, runCount: row.runCount, totals: this.outputTotals(row.entries) })),
      byLine: this.groupBy(metrics, (v) => v.productionLineId, (v) => v.productionLineCode).map((row) => ({ key: row.key, label: row.label, runCount: row.runCount, totals: this.outputTotals(row.entries) })),
      byMachine: this.groupBy(metrics, (v) => v.machineId ?? '__UNASSIGNED__', (v) => v.machineCode ?? '__UNASSIGNED__').map((row) => ({ key: row.key, label: row.label, runCount: row.runCount, totals: this.outputTotals(row.entries) })),
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async downtime(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const segments = await this.prisma.downtimeSegment.findMany({
      where: this.downtimeWhere(query, ctx, window),
      include: { reason: { select: { id: true, code: true, nameEn: true, nameAr: true, lossCategory: true } }, shift: { select: { code: true } } },
      orderBy: { startedAt: 'asc' },
    });
    let unplanned = new Prisma.Decimal(0);
    let planned = new Prisma.Decimal(0);
    const byReason = new Map<string, any>();
    const byShift = new Map<string, any>();
    for (const segment of segments) {
      const duration = this.segmentMinutes(segment, window);
      if (segment.planned) planned = planned.plus(duration);
      else unplanned = unplanned.plus(duration);
      const reasonKey = segment.reasonId ?? '__UNCLASSIFIED__';
      const reasonRow = byReason.get(reasonKey) || { reasonId: segment.reasonId, reasonCode: segment.reason?.code ?? null, reasonNameEn: segment.reason?.nameEn ?? null, reasonNameAr: segment.reason?.nameAr ?? null, lossCategory: segment.reason?.lossCategory ?? null, minutes: new Prisma.Decimal(0), count: 0 };
      reasonRow.minutes = reasonRow.minutes.plus(duration);
      reasonRow.count += 1;
      byReason.set(reasonKey, reasonRow);
      const shiftKey = segment.shiftId ?? '__NONE__';
      const shiftRow = byShift.get(shiftKey) || { shiftId: segment.shiftId, shiftCode: segment.shift?.code ?? null, minutes: new Prisma.Decimal(0), count: 0 };
      shiftRow.minutes = shiftRow.minutes.plus(duration);
      shiftRow.count += 1;
      byShift.set(shiftKey, shiftRow);
    }
    const total = unplanned.plus(planned);
    return {
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      aggregates: {
        segmentCount: segments.length,
        unplannedDowntimeMinutes: unplanned.toDecimalPlaces(4).toString(),
        plannedDowntimeMinutes: planned.toDecimalPlaces(4).toString(),
        totalDowntimeMinutes: total.toDecimalPlaces(4).toString(),
      },
      byReason: [...byReason.values()].map((row) => ({ ...row, minutes: row.minutes.toDecimalPlaces(4).toString() })).sort((a, b) => decimal(b.minutes).minus(decimal(a.minutes)).toNumber()),
      byShift: [...byShift.values()].map((row) => ({ ...row, minutes: row.minutes.toDecimalPlaces(4).toString() })).sort((a, b) => decimal(b.minutes).minus(decimal(a.minutes)).toNumber()),
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async losses(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const where: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      sourceType: { not: 'CORRECTION' },
      occurredAt: { gte: window.from, lte: window.to },
    };
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.reasonId) where.reasonId = query.reasonId;
    if (query.lossCategory) where.reason = { is: { lossCategory: query.lossCategory } };
    const events = await this.prisma.productionLossQuantityEvent.findMany({
      where,
      include: { reasonRef: { select: { id: true, code: true, nameEn: true, nameAr: true, lossCategory: true } } },
    });
    const byType = new Map<string, any>();
    const byReason = new Map<string, any>();
    let total = new Prisma.Decimal(0);
    for (const event of events) {
      const quantity = new Prisma.Decimal(event.quantity);
      total = total.plus(quantity);
      const typeRow = byType.get(event.type) || { type: event.type, quantity: new Prisma.Decimal(0), count: 0 };
      typeRow.quantity = typeRow.quantity.plus(quantity);
      typeRow.count += 1;
      byType.set(event.type, typeRow);
      const reasonKey = event.reasonId ?? '__UNCLASSIFIED__';
      const reasonRow = byReason.get(reasonKey) || { reasonId: event.reasonId, reasonCode: event.reasonRef?.code ?? null, reasonNameEn: event.reasonRef?.nameEn ?? null, reasonNameAr: event.reasonRef?.nameAr ?? null, lossCategory: event.reasonRef?.lossCategory ?? null, quantity: new Prisma.Decimal(0), count: 0 };
      reasonRow.quantity = reasonRow.quantity.plus(quantity);
      reasonRow.count += 1;
      byReason.set(reasonKey, reasonRow);
    }
    return {
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      aggregates: { totalLossQuantity: total.toDecimalPlaces(4).toString(), eventCount: events.length },
      byType: [...byType.values()].map((row) => ({ type: row.type, quantity: row.quantity.toDecimalPlaces(4).toString(), count: row.count })),
      byReason: [...byReason.values()].map((row) => ({ ...row, quantity: row.quantity.toDecimalPlaces(4).toString() })).sort((a, b) => decimal(b.quantity).minus(decimal(a.quantity)).toNumber()),
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async quality(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const { runs, views } = await this.loadRuns(query, ctx, window);
    const metrics = await this.computeAll(runs, views, window, ctx);
    let good = new Prisma.Decimal(0);
    let reject = new Prisma.Decimal(0);
    for (const entry of metrics) {
      good = good.plus(entry.metrics.goodOutput);
      reject = reject.plus(entry.metrics.rejectOutput);
    }
    const total = good.plus(reject);
    const qualityFactorResult = qualityFactor(good, total);
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null, inspectedAt: { gte: window.from, lte: window.to } };
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    const [inspections, dispositions] = await Promise.all([
      this.prisma.productionInspection.findMany({ where, select: { id: true, status: true, results: { select: { pass: true } } } }),
      this.prisma.productionQualityDisposition.findMany({ where: { companyId: ctx.companyId, branchId: ctx.branchId, status: { notIn: ['REJECTED', 'CANCELLED'] }, createdAt: { gte: window.from, lte: window.to } }, select: { id: true, action: true, quantity: true, status: true } }),
    ]);
    let passed = 0;
    let failed = 0;
    for (const inspection of inspections) {
      const results = inspection.results || [];
      const hasFail = results.some((result) => result.pass === false);
      if (hasFail) failed += 1;
      else passed += 1;
    }
    const byAction = new Map<string, any>();
    for (const disposition of dispositions) {
      const row = byAction.get(disposition.action) || { action: disposition.action, quantity: new Prisma.Decimal(0), count: 0 };
      row.quantity = row.quantity.plus(new Prisma.Decimal(disposition.quantity));
      row.count += 1;
      byAction.set(disposition.action, row);
    }
    return {
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      aggregates: {
        goodOutput: good.toDecimalPlaces(4).toString(),
        rejectOutput: reject.toDecimalPlaces(4).toString(),
        totalOutput: total.toDecimalPlaces(4).toString(),
        qualityFactor: qualityFactorResult,
        firstPassRatePercent: total.greaterThan(0) ? good.div(total).mul(100).toDecimalPlaces(4).toString() : '0',
        inspectionCount: inspections.length,
        passedInspections: passed,
        failedInspections: failed,
        dispositionCount: dispositions.length,
      },
      byAction: [...byAction.values()].map((row) => ({ action: row.action, quantity: row.quantity.toDecimalPlaces(4).toString(), count: row.count })),
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async materials(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, recordedAt: { gte: window.from, lte: window.to } };
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    const consumptions = await this.prisma.productionMaterialConsumption.findMany({ where, select: { id: true, productId: true, productCodeSnapshot: true, productNameSnapshot: true, unit: true, quantity: true, method: true, sourceType: true } });
    const byProduct = new Map<string, any>();
    let total = new Prisma.Decimal(0);
    for (const consumption of consumptions) {
      const quantity = new Prisma.Decimal(consumption.quantity);
      total = total.plus(quantity);
      const row = byProduct.get(consumption.productId) || { productId: consumption.productId, productCode: consumption.productCodeSnapshot, productName: consumption.productNameSnapshot, unit: consumption.unit, quantity: new Prisma.Decimal(0), count: 0 };
      row.quantity = row.quantity.plus(quantity);
      row.count += 1;
      byProduct.set(consumption.productId, row);
    }
    return {
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      aggregates: { totalQuantity: total.toDecimalPlaces(4).toString(), documentCount: consumptions.length },
      byProduct: [...byProduct.values()].map((row) => ({ ...row, quantity: row.quantity.toDecimalPlaces(4).toString() })).sort((a, b) => decimal(b.quantity).minus(decimal(a.quantity)).toNumber()),
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  async cost(query: AnalyticsQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, status: 'POSTED', reversalOfId: null, reversedAt: null, occurredAt: { gte: window.from, lte: window.to } };
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    // Batch 2E: aggregate at the database authority instead of materializing every
    // matching transaction in the API process. The same tenant/status/reversal
    // predicate is reused by every aggregation so the sections reconcile exactly.
    const [totals, eventGroups, costCenterGroups, currencyGroups] = await Promise.all([
      this.prisma.operationalCostTransaction.aggregate({ where, _sum: { amount: true }, _count: true }),
      this.prisma.operationalCostTransaction.groupBy({ by: ['eventType'], where, _sum: { amount: true }, _count: true }),
      this.prisma.operationalCostTransaction.groupBy({ by: ['costCenterId'], where, _sum: { amount: true }, _count: true }),
      this.prisma.operationalCostTransaction.groupBy({ by: ['currencyCode'], where, _sum: { amount: true }, _count: true }),
    ]);
    if (currencyGroups.length > 1) {
      throw new BadRequestException({
        messageKey: 'analytics.mixedCurrenciesUnsupported',
        message: 'A single cost report cannot aggregate multiple currencies',
      });
    }
    const costCenterIds = costCenterGroups.map((row) => row.costCenterId).filter((id): id is string => Boolean(id));
    const costCenters = costCenterIds.length > 0
      ? await this.prisma.costCenter.findMany({
        where: {
          id: { in: costCenterIds },
          companyId: ctx.companyId,
          OR: [{ branchId: ctx.branchId }, { branchId: null }],
        },
        select: { id: true, code: true, name: true },
      })
      : [];
    const costCenterMap = new Map(costCenters.map((center) => [center.id, center]));
    const countOf = (row: { _count: number | { _all?: number } }) => typeof row._count === 'number' ? row._count : row._count._all ?? 0;
    const totalAmount = new Prisma.Decimal(totals._sum.amount ?? 0);
    return {
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      currencyCode: currencyGroups[0]?.currencyCode ?? 'USD',
      aggregates: { totalAmount: totalAmount.toDecimalPlaces(4).toString(), transactionCount: countOf(totals) },
      byEventType: eventGroups.map((row) => ({
        eventType: row.eventType,
        amount: new Prisma.Decimal(row._sum.amount ?? 0).toDecimalPlaces(4).toString(),
        count: countOf(row),
      })),
      byCostCenter: costCenterGroups.map((row) => {
        const center = row.costCenterId ? costCenterMap.get(row.costCenterId) : null;
        return {
          costCenterId: row.costCenterId,
          costCenterCode: center?.code ?? null,
          costCenterName: center?.name ?? null,
          amount: new Prisma.Decimal(row._sum.amount ?? 0).toDecimalPlaces(4).toString(),
          count: countOf(row),
        };
      }).sort((a, b) => decimal(b.amount).minus(decimal(a.amount)).toNumber()),
      sourceChanges: await this.sourceChangeMetadata(query, window, ctx),
    };
  }

  /**
   * Phase 2 — manual analytics invalidation/refresh watermark. Analytics are always
   * computed live, so there is no cache to flush; this records an audited,
   * tenant-scoped SOURCE_UPDATE change so consumers of the affected scope see
   * `dataAdjusted: true` on subsequent reads. A reason is mandatory and the action
   * is permission-gated.
   */
  async invalidate(dto: AnalyticsInvalidateDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const change = await this.sourceChanges.recordChange(
        tx,
        ctx,
        {
          scopeType: dto.scopeType as any,
          scopeId: dto.scopeId,
          entityType: 'PRODUCTION_ANALYTICS',
          entityId: dto.scopeId,
          changeType: 'SOURCE_UPDATE',
          reason: dto.reason,
        },
        userId,
      );
      await this.audit.logWithClient(tx, {
        userId,
        action: 'INVALIDATE',
        entity: ANALYTICS_INVALIDATE_AUDIT_ENTITY,
        entityId: change.id,
        details: { companyId: ctx.companyId, branchId: ctx.branchId, scopeType: dto.scopeType, scopeId: dto.scopeId, reason: dto.reason },
      });
      return {
        invalidatedAt: change.createdAt.toISOString(),
        scopeType: dto.scopeType,
        scopeId: dto.scopeId,
        changeId: change.id,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async export(query: AnalyticsExportQueryDto, userId: string, ctx: ActiveOperationalContext) {
    const window = this.window(query, ctx);
    const report = await this.runReport(query, ctx);
    const rows = this.flattenReport(query.report, report);
    const csv = this.toCsv(rows);
    await this.audit.log(userId, 'EXPORT', ANALYTICS_EXPORT_AUDIT_ENTITY, undefined, {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      report: query.report,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      rowCount: rows.length,
    });
    return {
      report: query.report,
      timezone: ANALYTICS_TIMEZONE,
      window: this.windowPayload(window),
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      csv,
    };
  }

  private async runReport(query: AnalyticsExportQueryDto, ctx: ActiveOperationalContext) {
    switch (query.report) {
      case 'oee':
        return this.oee(query, ctx);
      case 'trends':
        return this.trends(query, ctx);
      case 'loss-pareto':
        return this.lossPareto(query, ctx);
      case 'bottlenecks':
        return this.bottlenecks(query, ctx);
      case 'capacity-variance':
        return this.capacityVariance(query, ctx);
      case 'drilldown':
        return this.drilldown(query as unknown as AnalyticsPageDto, ctx);
      case 'output':
        return this.output(query, ctx);
      case 'downtime':
        return this.downtime(query, ctx);
      case 'losses':
        return this.losses(query, ctx);
      case 'quality':
        return this.quality(query, ctx);
      case 'materials':
        return this.materials(query, ctx);
      case 'cost':
        return this.cost(query, ctx);
      default:
        throw new BadRequestException({ messageKey: 'analytics.unknownReport', message: 'Unknown report type' });
    }
  }

  private flattenReport(report: string, data: any): Array<Record<string, string>> {
    const rows: Array<Record<string, string>> = [];
    const push = (row: Record<string, any>) => {
      const flat: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) flat[key] = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      rows.push(flat);
    };
    if ((report === 'oee' || report === 'drilldown') && data.runs) {
      for (const run of data.runs) push(this.pick(run, ['runNumber', 'status', 'orderNumber', 'productCode', 'productName', 'productionLineCode', 'machineCode', 'shiftCode', 'startedAt', 'endedAt', 'plannedMinutes', 'operatingMinutes', 'totalOutput', 'goodOutput', 'rejectOutput', 'targetStatus']));
    } else if ((report === 'loss-pareto' || report === 'bottlenecks') && data.items) {
      for (const item of data.items) push(this.pick(item, ['reasonId', 'reasonCode', 'reasonNameEn', 'reasonNameAr', 'lossCategory', 'machineCode', 'machineName', 'productionLineCode', 'minutes', 'count', 'sharePercent']));
    } else if (report === 'trends' && data.items) {
      for (const item of data.items) push({ key: item.key, from: item.from, to: item.to, runCount: item.runCount, ...this.pick(item.aggregates ?? {}, ['plannedMinutes', 'operatingMinutes', 'totalOutput', 'goodOutput', 'rejectOutput', 'oee']) });
    } else if (report === 'capacity-variance' && data.rows) {
      for (const row of data.rows) push(row);
    } else {
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) for (const item of value) push(item);
      }
    }
    return rows.length > 0 ? rows : [{}];
  }

  private pick(source: Record<string, any>, keys: string[]): Record<string, any> {
    const out: Record<string, any> = {};
    for (const key of keys) if (key in source) out[key] = source[key];
    return out;
  }

  private toCsv(rows: Array<Record<string, string>>): string {
    if (rows.length === 0) return '';
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(','))].join('\n');
  }

  private window(query: AnalyticsQueryDto, ctx: ActiveOperationalContext): Window {
    const from = query.dateFrom.length <= 10 ? new Date(`${query.dateFrom}T00:00:00.000Z`) : new Date(query.dateFrom);
    const to = query.dateTo.length <= 10 ? new Date(`${query.dateTo}T23:59:59.999Z`) : new Date(query.dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new BadRequestException({ messageKey: 'analytics.invalidWindow', message: 'Invalid report window' });
    if (from.getTime() >= to.getTime()) throw new BadRequestException({ messageKey: 'analytics.invalidWindow', message: 'dateFrom must precede dateTo' });
    const days = (to.getTime() - from.getTime()) / 86400000;
    if (days > ANALYTICS_LIMITS.maxWindowDays) throw new BadRequestException({ messageKey: 'analytics.windowTooLarge', message: `Window must not exceed ${ANALYTICS_LIMITS.maxWindowDays} days` });
    return { from, to };
  }

  private windowPayload(window: Window) {
    return { from: window.from.toISOString(), to: window.to.toISOString() };
  }

  /**
   * Phase 2 — watermark metadata for analytics read endpoints. Analytics are always
   * computed live from the source tables; this surfaces whether any underlying
   * source fact (material-document reversal, cost reversal, snapshot/rate
   * correction, manual invalidation) changed inside the reporting window and within
   * the requested scope, so consumers can warn that a previously exported figure is
   * stale. Run scope is resolved to its order so a run-filtered report also sees
   * order-level changes.
   */
  private async sourceChangeMetadata(query: AnalyticsQueryDto, window: Window, ctx: ActiveOperationalContext) {
    const scope: { orderId?: string; runId?: string; productionLineId?: string; machineId?: string; productDefinitionId?: string } = {};
    if (query.productionOrderId) scope.orderId = query.productionOrderId;
    if (query.productionRunId) scope.runId = query.productionRunId;
    if (query.productionLineId) scope.productionLineId = query.productionLineId;
    if (query.machineId) scope.machineId = query.machineId;
    if (query.productionProductDefinitionId) scope.productDefinitionId = query.productionProductDefinitionId;
    if (!scope.orderId && query.productionRunId) {
      const run = await this.prisma.productionRun.findFirst({
        where: { id: query.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        select: { productionOrderId: true },
      });
      if (run) scope.orderId = run.productionOrderId;
    }
    const changes = await this.sourceChanges.findByWindow(ctx, window, scope);
    return { changeCount: changes.length, dataAdjusted: changes.length > 0, changes };
  }

  private bucket(date: Date, grain: string): { key: string; from: Date; to: Date } {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    if (grain === 'DAY') {
      return { key: start.toISOString().slice(0, 10), from: start, to: new Date(start.getTime() + 86400000 - 1) };
    }
    if (grain === 'WEEK') {
      const day = start.getUTCDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const weekStart = new Date(start.getTime() + diffToMonday * 86400000);
      const key = `${weekStart.toISOString().slice(0, 10)}T00:00:00Z`;
      return { key, from: weekStart, to: new Date(weekStart.getTime() + 7 * 86400000 - 1) };
    }
    const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const key = monthStart.toISOString().slice(0, 7);
    const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    return { key, from: monthStart, to: new Date(nextMonth.getTime() - 1) };
  }

  private async loadRuns(query: AnalyticsQueryDto, ctx: ActiveOperationalContext, window: Window, options: { paginate?: boolean; page?: number; limit?: number } = {}) {
    const where: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      deletedAt: null,
      OR: [
        { startedAt: { gte: window.from, lte: window.to } },
        { endedAt: { gte: window.from, lte: window.to } },
        { startedAt: { lte: window.from }, endedAt: { gte: window.to } },
        { startedAt: { lte: window.to }, endedAt: null },
      ],
    };
    if (query.productionUnitId) where.productionUnitId = query.productionUnitId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionProductDefinitionId) where.productionProductDefinitionId = query.productionProductDefinitionId;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.productionRunId) where.id = query.productionRunId;
    const include: Prisma.ProductionRunInclude = {
      productionOrder: { select: { id: true, orderNumber: true } },
      productionUnit: { select: { id: true, code: true, name: true } },
      productionLine: { select: { id: true, code: true, name: true } },
      machine: { select: { id: true, code: true, name: true } },
      productionProductDefinition: { select: { id: true, code: true, name: true } },
      sessions: { take: ANALYTICS_LIMITS.maxDrilldownEventsPerRun + 1 },
      outputEvents: {
        take: ANALYTICS_LIMITS.maxDrilldownEventsPerRun + 1,
        include: { measurementPoint: { select: { isAuthoritativeFinal: true } } },
      },
      downtimeSegments: {
        where: { status: { notIn: ['CANCELLED', 'SUPERSEDED'] } },
        take: ANALYTICS_LIMITS.maxDrilldownEventsPerRun + 1,
      },
      lossQuantityEvents: { take: ANALYTICS_LIMITS.maxDrilldownEventsPerRun + 1 },
    };
    const limit = options.paginate ? Math.min(options.limit || 20, ANALYTICS_LIMITS.maxPageSize) : ANALYTICS_LIMITS.maxSummaryRuns;
    const findRecords = () => this.prisma.productionRun.findMany({
        where,
        skip: options.paginate ? ((options.page || 1) - 1) * limit : undefined,
        take: limit,
        orderBy: [{ startedAt: 'desc' }],
        include,
      });
    let records: Awaited<ReturnType<typeof findRecords>>;
    let total: number;
    if (options.paginate) {
      [records, total] = await Promise.all([findRecords(), this.prisma.productionRun.count({ where })]);
    } else {
      total = await this.prisma.productionRun.count({ where });
      if (total > ANALYTICS_LIMITS.maxSummaryRuns) {
        throw new BadRequestException({
          messageKey: 'analytics.resultTooLarge',
          message: `The report matches more than ${ANALYTICS_LIMITS.maxSummaryRuns} production runs; narrow the filters`,
        });
      }
      records = await findRecords();
    }
    const oversizedRun = records.find((run: any) => [run.sessions, run.outputEvents, run.downtimeSegments, run.lossQuantityEvents]
      .some((events: unknown[]) => Array.isArray(events) && events.length > ANALYTICS_LIMITS.maxDrilldownEventsPerRun));
    if (oversizedRun) {
      throw new BadRequestException({
        messageKey: 'analytics.resultTooLarge',
        message: `A production run exceeds the ${ANALYTICS_LIMITS.maxDrilldownEventsPerRun}-event calculation limit; narrow the filters`,
      });
    }
    const views: RunView[] = records.map((run: any) => ({
      id: run.id,
      runNumber: run.runNumber,
      status: run.status,
      productionOrderId: run.productionOrderId,
      orderNumber: run.productionOrder?.orderNumber ?? null,
      productionUnitId: run.productionUnitId,
      productionUnitCode: run.productionUnit?.code ?? null,
      productionLineId: run.productionLineId,
      productionLineCode: run.productionLine?.code ?? null,
      machineId: run.machineId ?? null,
      machineCode: run.machine?.code ?? null,
      productionProductDefinitionId: run.productionProductDefinitionId,
      productCode: run.productionProductDefinition?.code ?? null,
      productName: run.productionProductDefinition?.name ?? null,
      shiftCode: run.shiftCodeSnapshot ?? null,
      startedAt: run.startedAt ?? null,
      endedAt: run.endedAt ?? null,
      plannedQuantity: new Prisma.Decimal(run.plannedQuantitySnapshot ?? 0),
      quantityUnit: run.quantityUnitSnapshot,
      capacityStandardCode: run.capacityStandardCodeSnapshot,
      capacityStandardRevision: run.capacityStandardRevisionSnapshot,
      standardRate: new Prisma.Decimal(run.standardRateSnapshot ?? 0),
      outputUnit: run.outputUnitSnapshot,
      timeBasis: run.timeBasisSnapshot,
      targetEfficiencyPercent: new Prisma.Decimal(run.targetEfficiencyPercentSnapshot ?? 0),
      expectedYieldPercent: new Prisma.Decimal(run.expectedYieldPercentSnapshot ?? 0),
    }));
    return { runs: records, views, total };
  }

  private downtimeWhere(query: AnalyticsQueryDto, ctx: ActiveOperationalContext, window: Window) {
    const where: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      status: { notIn: ['CANCELLED', 'SUPERSEDED'] },
      startedAt: { lte: window.to },
      OR: [{ endedAt: null }, { endedAt: { gte: window.from } }],
    };
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.reasonId) where.reasonId = query.reasonId;
    if (query.lossCategory) where.reason = { is: { lossCategory: query.lossCategory } };
    if (query.downtimeOccurrence === 'PLANNED') where.planned = true;
    if (query.downtimeOccurrence === 'UNPLANNED') where.planned = false;
    return where;
  }

  private segmentMinutes(segment: any, window: Window): Prisma.Decimal {
    const start = clampTime(segment.startedAt, window.from, window.to);
    const end = clampTime(segment.endedAt ?? window.to, window.from, window.to);
    return minutesBetween(start, end);
  }

  private async computeAll(runs: any[], views: RunView[], window: Window, ctx: ActiveOperationalContext): Promise<MetricsEntry[]> {
    const resolved = await this.targets.resolveForRuns(views, { companyId: ctx.companyId, branchId: ctx.branchId }, window.from, window.to);
    return runs.map((run: any, index: number) => ({ metrics: this.computeRun(run, views[index], window), run: views[index], target: resolved[index] ?? null }));
  }

  private computeRun(run: any, view: RunView, window: Window): RunMetrics {
    const runStart = run.startedAt;
    const runEnd = run.endedAt;
    const active = !runEnd;
    const sessionIntervals = (run.sessions || [])
      .map((session: any) => {
        const start = clampTime(maxDate(session.startedAt, runStart, window.from), window.from, window.to);
        const end = clampTime(minDate(session.closedAt ?? (active ? window.to : runEnd), runEnd ?? window.to, window.to), window.from, window.to);
        if (start.getTime() >= end.getTime()) return null;
        return { start, end };
      })
      .filter(Boolean);
    const mergedSessions = mergeIntervals(sessionIntervals);
    const plannedMinutes = new Prisma.Decimal(totalDurationMinutes(mergedSessions)).toDecimalPlaces(4);
    const rawSegments = (run.downtimeSegments || []).filter((segment: any) => segment.status !== 'CANCELLED' && segment.status !== 'SUPERSEDED');
    const unplannedIntervals: any[] = [];
    const plannedIntervals: any[] = [];
    for (const segment of rawSegments) {
      const clamped = clampToPeriod([{ start: segment.startedAt, end: segment.endedAt ?? runEnd ?? window.to }], window.from, window.to);
      if (segment.planned) plannedIntervals.push(...clamped);
      else unplannedIntervals.push(...clamped);
    }
    const unplannedDowntimeMinutes = new Prisma.Decimal(intersectionMinutes(unplannedIntervals, mergedSessions)).toDecimalPlaces(4);
    const plannedDowntimeMinutes = new Prisma.Decimal(intersectionMinutes(plannedIntervals, mergedSessions)).toDecimalPlaces(4);
    const operatingMinutes = Prisma.Decimal.max(0, plannedMinutes.minus(unplannedDowntimeMinutes)).toDecimalPlaces(4);
    const rate = idealRatePerHour(view.standardRate, view.timeBasis);
    const idealOutput = rate.mul(operatingMinutes.div(60)).toDecimalPlaces(4);
    const events: TotalsInputEvent[] = (run.outputEvents || []).map((event: any) => ({
      id: event.id,
      eventType: event.eventType,
      classification: event.classification,
      quantity: event.quantity,
      goodQuantity: event.goodQuantity,
      rejectQuantity: event.rejectQuantity,
      correctsEventId: event.correctsEventId ?? null,
      measurementPointId: event.measurementPointId,
      measurementPoint: event.measurementPoint ? { isAuthoritativeFinal: Boolean(event.measurementPoint.isAuthoritativeFinal) } : null,
    }));
    const totals = deriveRunTotals(events);
    const totalOutput = new Prisma.Decimal(totals.finalOutputTotal);
    const goodOutput = new Prisma.Decimal(totals.finalOutputGood);
    const rejectOutput = new Prisma.Decimal(totals.finalOutputReject);
    const wasteTotal = new Prisma.Decimal(totals.wasteTotal);
    const reworkTotal = new Prisma.Decimal(totals.reworkTotal);
    const availability = availabilityFactor(plannedMinutes, operatingMinutes);
    const performance = performanceFactor(idealOutput, totalOutput);
    const quality = qualityFactor(goodOutput, totalOutput);
    const oee = oeeProduct(availability, performance, quality);
    return {
      plannedMinutes,
      unplannedDowntimeMinutes,
      plannedDowntimeMinutes,
      operatingMinutes,
      idealOutput,
      totalOutput,
      goodOutput,
      rejectOutput,
      wasteTotal,
      reworkTotal,
      outputEventCount: totals.finalOutputEventCount,
      availability,
      performance,
      quality,
      oee,
    };
  }

  private aggregate(entries: MetricsEntry[]) {
    let planned = new Prisma.Decimal(0);
    let operating = new Prisma.Decimal(0);
    let totalOutput = new Prisma.Decimal(0);
    let goodOutput = new Prisma.Decimal(0);
    let idealOutput = new Prisma.Decimal(0);
    for (const entry of entries) {
      planned = planned.plus(entry.metrics.plannedMinutes);
      operating = operating.plus(entry.metrics.operatingMinutes);
      totalOutput = totalOutput.plus(entry.metrics.totalOutput);
      goodOutput = goodOutput.plus(entry.metrics.goodOutput);
      idealOutput = idealOutput.plus(entry.metrics.idealOutput);
    }
    const availability = aggregateFactor(operating, planned, 'minutes');
    const performance = aggregateFactor(totalOutput, idealOutput, 'units');
    const quality = aggregateFactor(goodOutput, totalOutput, 'units');
    const oee = oeeProduct(availability, performance, quality);
    return {
      runCount: entries.length,
      plannedMinutes: planned.toDecimalPlaces(4).toString(),
      operatingMinutes: operating.toDecimalPlaces(4).toString(),
      totalOutput: totalOutput.toDecimalPlaces(4).toString(),
      goodOutput: goodOutput.toDecimalPlaces(4).toString(),
      rejectOutput: totalOutput.sub(goodOutput).toDecimalPlaces(4).toString(),
      idealOutput: idealOutput.toDecimalPlaces(4).toString(),
      availability,
      performance,
      quality,
      oee,
    };
  }

  private groupBy(metrics: MetricsEntry[], keyFn: (view: RunView) => string, labelFn: (view: RunView) => string) {
    const groups = new Map<string, MetricsEntry[]>();
    const labels = new Map<string, string>();
    for (const entry of metrics) {
      const key = keyFn(entry.run);
      if (!groups.has(key)) {
        groups.set(key, []);
        labels.set(key, labelFn(entry.run));
      }
      groups.get(key)!.push(entry);
    }
    return [...groups.entries()].map(([key, entries]) => ({ key, label: labels.get(key) ?? key, runCount: entries.length, entries, aggregates: this.aggregate(entries) }));
  }

  private outputTotals(entries: MetricsEntry[]) {
    let totalOutput = new Prisma.Decimal(0);
    let goodOutput = new Prisma.Decimal(0);
    let rejectOutput = new Prisma.Decimal(0);
    let waste = new Prisma.Decimal(0);
    let rework = new Prisma.Decimal(0);
    for (const entry of entries) {
      totalOutput = totalOutput.plus(entry.metrics.totalOutput);
      goodOutput = goodOutput.plus(entry.metrics.goodOutput);
      rejectOutput = rejectOutput.plus(entry.metrics.rejectOutput);
      waste = waste.plus(entry.metrics.wasteTotal);
      rework = rework.plus(entry.metrics.reworkTotal);
    }
    return {
      runCount: entries.length,
      totalOutput: totalOutput.toDecimalPlaces(4).toString(),
      goodOutput: goodOutput.toDecimalPlaces(4).toString(),
      rejectOutput: rejectOutput.toDecimalPlaces(4).toString(),
      waste: waste.toDecimalPlaces(4).toString(),
      rework: rework.toDecimalPlaces(4).toString(),
      yieldPercent: totalOutput.greaterThan(0) ? goodOutput.div(totalOutput).mul(100).toDecimalPlaces(4).toString() : '0',
    };
  }

  private serializeRun(entry: MetricsEntry, detailed = false) {
    const { metrics, run, target } = entry;
    const base = {
      productionRunId: run.id,
      runNumber: run.runNumber,
      status: run.status,
      productionOrderId: run.productionOrderId,
      orderNumber: run.orderNumber,
      productionUnitCode: run.productionUnitCode,
      productionLineCode: run.productionLineCode,
      machineCode: run.machineCode,
      productCode: run.productCode,
      productName: run.productName,
      shiftCode: run.shiftCode,
      startedAt: run.startedAt?.toISOString() ?? null,
      endedAt: run.endedAt?.toISOString() ?? null,
      metrics: {
        plannedMinutes: metrics.plannedMinutes.toDecimalPlaces(4).toString(),
        unplannedDowntimeMinutes: metrics.unplannedDowntimeMinutes.toDecimalPlaces(4).toString(),
        operatingMinutes: metrics.operatingMinutes.toDecimalPlaces(4).toString(),
        idealOutput: metrics.idealOutput.toDecimalPlaces(4).toString(),
        totalOutput: metrics.totalOutput.toDecimalPlaces(4).toString(),
        goodOutput: metrics.goodOutput.toDecimalPlaces(4).toString(),
        outputEventCount: metrics.outputEventCount,
        availability: metrics.availability,
        performance: metrics.performance,
        quality: metrics.quality,
        oee: metrics.oee,
      },
      target: target
        ? {
            id: target.id,
            code: target.code,
            revision: target.revision,
            scopeType: target.scopeType,
            availabilityTarget: new Prisma.Decimal(target.availabilityTarget).toDecimalPlaces(4).toString(),
            performanceTarget: new Prisma.Decimal(target.performanceTarget).toDecimalPlaces(4).toString(),
            qualityTarget: new Prisma.Decimal(target.qualityTarget).toDecimalPlaces(4).toString(),
            oeeTarget: new Prisma.Decimal(target.oeeTarget).toDecimalPlaces(4).toString(),
          }
        : null,
      targetStatus: target ? this.targetStatus(metrics, target) : 'NO_TARGET',
    };
    if (!detailed) return base;
    return {
      ...base,
      plannedDowntimeMinutes: metrics.plannedDowntimeMinutes.toDecimalPlaces(4).toString(),
      wasteTotal: metrics.wasteTotal.toDecimalPlaces(4).toString(),
      reworkTotal: metrics.reworkTotal.toDecimalPlaces(4).toString(),
    };
  }

  private targetStatus(metrics: RunMetrics, target: any): string {
    const achieved = (factor: any, targetValue: any) => factor?.percent !== null && decimal(factor.percent).greaterThanOrEqualTo(decimal(targetValue));
    if (achieved(metrics.oee, target.oeeTarget)) return 'MEETING';
    if (metrics.oee?.percent === null) return 'BLOCKED';
    return 'BELOW_TARGET';
  }
}

function maxDate(...dates: Array<Date | null | undefined>): Date {
  return dates.filter((date): date is Date => Boolean(date)).reduce((max, date) => (date.getTime() > max.getTime() ? date : max), new Date(0));
}

function minDate(...dates: Array<Date | null | undefined>): Date {
  return dates.filter((date): date is Date => Boolean(date)).reduce((min, date) => (date.getTime() < min.getTime() ? date : min), new Date(8640000000000000));
}

function clampTime(date: Date, from: Date, to: Date): Date {
  return new Date(Math.min(Math.max(date.getTime(), from.getTime()), to.getTime()));
}
