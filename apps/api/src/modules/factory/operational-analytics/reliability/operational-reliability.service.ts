import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { MaintenanceReliabilityService } from '../../maintenance/maintenance-reliability/maintenance-reliability.service';
import { DowntimeLogsService } from '../../maintenance/downtime-logs/downtime-logs.service';
import { ProductionAnalyticsService } from '../../production-analytics/production-analytics.service';
import {
  OPERATIONAL_RELIABILITY_EXPORT_AUDIT_ENTITY,
  OPERATIONAL_RELIABILITY_LIMITS,
  OPERATIONAL_RELIABILITY_TIMEZONE,
  RELIABILITY_METRIC_METADATA,
  RELIABILITY_NORMALIZATION_METADATA,
  RELIABILITY_PRODUCTION_ANALYTICS_AUTHORITY,
} from './operational-reliability.constants';
import {
  OperationalReliabilityDrilldownDto,
  OperationalReliabilityExportDto,
  OperationalReliabilityQueryDto,
} from './dto/operational-reliability-query.dto';

/**
 * Phase 2 Batch 2C — Operational Reliability facade.
 *
 * FACADE + COMPOSITION + NORMALIZATION + FORMULA/LINEAGE METADATA only
 * (D-2C-3, readiness contract §3/§8). No calculation engine:
 * - Maintenance reliability metrics delegate to the existing maintenance
 *   reliability authority (`MaintenanceReliabilityService` / `DowntimeLogsService`).
 * - Canonical Availability delegates to the existing production OEE authority
 *   (`ProductionAnalyticsService.oee`), reusing `PHASE_1_9_OEE_V1` (D-2C-2).
 * - Linked DowntimeLog/DowntimeSegment = one physical event (D-2C-1); the drilldown
 *   exposes the header plus linked segment detail and never sums both into one count.
 */
@Injectable()
export class OperationalReliabilityService {
  constructor(
    private maintenanceReliability: MaintenanceReliabilityService,
    private downtimeLogs: DowntimeLogsService,
    private productionAnalytics: ProductionAnalyticsService,
    private audit: AuditService,
  ) {}

  private badRequest(key: string, message: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message });
  }

  private window(query: OperationalReliabilityQueryDto): { from: Date; to: Date } {
    const from = query.dateFrom.length <= 10 ? new Date(`${query.dateFrom}T00:00:00.000Z`) : new Date(query.dateFrom);
    const to = query.dateTo.length <= 10 ? new Date(`${query.dateTo}T23:59:59.999Z`) : new Date(query.dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw this.badRequest('analytics.invalidWindow', 'Invalid report window');
    }
    if (from.getTime() >= to.getTime()) {
      throw this.badRequest('analytics.invalidWindow', 'dateFrom must precede dateTo');
    }
    const days = (to.getTime() - from.getTime()) / 86400000;
    if (days > OPERATIONAL_RELIABILITY_LIMITS.maxWindowDays) {
      throw this.badRequest('analytics.windowTooLarge', `Window must not exceed ${OPERATIONAL_RELIABILITY_LIMITS.maxWindowDays} days`);
    }
    return { from, to };
  }

  private def(key: string) {
    const definition = RELIABILITY_METRIC_METADATA.find((m) => m.key === key);
    if (!definition) throw new Error(`Missing reliability metric metadata for key "${key}"`);
    return definition;
  }

  private withMeta(value: any, definition: { key: string; formulaVersion: string; authority: string; model: string; basis?: string }, extra?: Record<string, unknown>) {
    return {
      ...value,
      metadata: {
        key: definition.key,
        formulaVersion: definition.formulaVersion,
        authority: definition.authority,
        sourceModel: definition.model,
        ...(definition.basis ? { basis: definition.basis } : {}),
        ...extra,
      },
    };
  }

  private maintenanceWindowQuery(query: OperationalReliabilityQueryDto) {
    return {
      machineId: query.machineId,
      productionLineId: query.productionLineId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };
  }

  async summary(query: OperationalReliabilityQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query);
    const maintenanceQuery = this.maintenanceWindowQuery(query);
    const kpiQuery = {
      ...maintenanceQuery,
      operationTypeId: query.operationTypeId,
      costCenterId: query.costCenterId,
    };

    const [
      mtbf,
      mttr,
      totalDowntime,
      repeatFailureRate,
      emergencyResponseTime,
      slaTimes,
      byMachine,
      byProductionLine,
      byCause,
      repeatFailures,
      availabilityResult,
    ] = await Promise.all([
      this.maintenanceReliability.getMtbf(maintenanceQuery, ctx),
      this.maintenanceReliability.getMttr(maintenanceQuery, ctx),
      this.maintenanceReliability.getTotalDowntime(maintenanceQuery, ctx),
      this.maintenanceReliability.getRepeatFailureRate(kpiQuery, ctx),
      this.maintenanceReliability.getEmergencyResponseTime(maintenanceQuery, ctx),
      this.maintenanceReliability.getSlaTimes(kpiQuery, ctx),
      this.maintenanceReliability.getDowntimeByMachine({ dateFrom: query.dateFrom, dateTo: query.dateTo }, ctx),
      this.maintenanceReliability.getDowntimeByProductionLine({ dateFrom: query.dateFrom, dateTo: query.dateTo }, ctx),
      this.maintenanceReliability.getDowntimeByCause({ dateFrom: query.dateFrom, dateTo: query.dateTo }, ctx),
      this.maintenanceReliability.getRepeatFailures({ dateFrom: query.dateFrom, dateTo: query.dateTo }, ctx),
      this.productionAnalytics.oee(
        {
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
          machineId: query.machineId,
          productionLineId: query.productionLineId,
        },
        ctx,
      ),
    ]);

    const availability = availabilityResult.aggregates.availability;
    const availabilityEnvelope = this.withMeta(
      {
        ...availability,
        plannedMinutes: availabilityResult.aggregates.plannedMinutes,
        operatingMinutes: availabilityResult.aggregates.operatingMinutes,
        runCount: availabilityResult.aggregates.runCount,
      },
      this.def('availability'),
      {
        plannedTimeBasis: 'completed ProductionSession planned windows (union)',
        downtimeBehavior: 'unplanned DowntimeSegment intersections with planned windows (planned segments do not reduce availability)',
        formulaVersion: availabilityResult.formulaVersion,
        sourceLineage: ['production-analytics', 'maintenance-reliability'],
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      timezone: OPERATIONAL_RELIABILITY_TIMEZONE,
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      filters: {
        machineId: query.machineId || null,
        productionLineId: query.productionLineId || null,
        operationTypeId: query.operationTypeId || null,
        costCenterId: query.costCenterId || null,
      },
      metrics: {
        mtbf: this.withMeta(mtbf, this.def('mtbf')),
        mttr: this.withMeta(mttr, this.def('mttr')),
        totalDowntime: this.withMeta(totalDowntime, this.def('totalDowntime')),
        repeatFailureRate: this.withMeta(repeatFailureRate, this.def('repeatFailureRate')),
        emergencyResponseTime: this.withMeta(emergencyResponseTime, this.def('emergencyResponseTime')),
        slaTimes: this.withMeta(slaTimes, this.def('slaTimes')),
        availability: availabilityEnvelope,
      },
      breakdown: {
        byMachine: { items: byMachine, metadata: this.def('downtimeByDimension') },
        byProductionLine: { items: byProductionLine, metadata: this.def('downtimeByDimension') },
        byCause: { items: byCause, metadata: this.def('downtimeByDimension') },
        repeatFailures: { items: repeatFailures, metadata: this.def('repeatFailures') },
      },
      productionPerformance: {
        formulaVersion: availabilityResult.formulaVersion,
        authority: RELIABILITY_PRODUCTION_ANALYTICS_AUTHORITY,
        sourceModels: ['ProductionRun', 'ProductionSession', 'ProductionOutputEvent', 'DowntimeSegment'],
        aggregates: availabilityResult.aggregates,
        sourceChanges: availabilityResult.sourceChanges ?? null,
      },
      normalization: RELIABILITY_NORMALIZATION_METADATA,
      metricMetadata: RELIABILITY_METRIC_METADATA,
    };
  }

  async drilldown(query: OperationalReliabilityDrilldownDto, ctx: ActiveOperationalContext) {
    const window = this.window(query);
    const result = await this.downtimeLogs.getReliabilityDrilldown(
      {
        page: query.page,
        limit: query.limit,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        machineId: query.machineId,
        productionLineId: query.productionLineId,
      },
      ctx,
    );

    return {
      timezone: OPERATIONAL_RELIABILITY_TIMEZONE,
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      filters: {
        machineId: query.machineId || null,
        productionLineId: query.productionLineId || null,
      },
      eventModel: 'DowntimeLog',
      linkedSegmentModel: 'DowntimeSegment',
      deduplication: 'one DowntimeLog header + linked DowntimeSegments = one physical event; linked segments are production detail and are never summed into the reliability event count',
      normalization: RELIABILITY_NORMALIZATION_METADATA,
      metricMetadata: this.def('mtbf'),
      data: result.data,
      meta: result.meta,
    };
  }

  async export(query: OperationalReliabilityExportDto, userId: string, ctx: ActiveOperationalContext) {
    const window = this.window(query);
    const summaryData = await this.summary(query, ctx);
    const rows = this.flattenSummary(summaryData);
    const csv = this.toCsv(rows);
    await this.audit.log(userId, 'EXPORT', OPERATIONAL_RELIABILITY_EXPORT_AUDIT_ENTITY, undefined, {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      report: 'reliability',
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      rowCount: rows.length,
    });
    return {
      report: 'reliability',
      timezone: OPERATIONAL_RELIABILITY_TIMEZONE,
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      csv,
    };
  }

  private flattenSummary(data: any): Array<Record<string, string>> {
    const rows: Array<Record<string, string>> = [];
    const push = (row: Record<string, any>) => {
      const flat: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        flat[key] = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
      rows.push(flat);
    };
    const metricKeys = ['mtbf', 'mttr', 'totalDowntime', 'repeatFailureRate', 'emergencyResponseTime', 'slaTimes', 'availability'];
    for (const key of metricKeys) {
      const metric = data.metrics[key];
      if (!metric) continue;
      const { metadata, ...value } = metric;
      push({ metric: key, formulaVersion: metadata?.formulaVersion ?? '', authority: metadata?.authority ?? '', values: value });
    }
    for (const item of data.breakdown.byMachine.items ?? []) {
      push({ metric: 'downtimeByMachine', formulaVersion: data.breakdown.byMachine.metadata?.formulaVersion ?? '', machineCode: item.machine?.code ?? '', totalHours: item.totalHours, eventCount: item.eventCount });
    }
    for (const item of data.breakdown.byProductionLine.items ?? []) {
      push({ metric: 'downtimeByProductionLine', formulaVersion: data.breakdown.byProductionLine.metadata?.formulaVersion ?? '', productionLineCode: item.productionLine?.code ?? '', totalHours: item.totalHours, eventCount: item.eventCount });
    }
    for (const item of data.breakdown.byCause.items ?? []) {
      push({ metric: 'downtimeByCause', formulaVersion: data.breakdown.byCause.metadata?.formulaVersion ?? '', failureCause: item.failureCause ?? '', totalHours: item.totalHours, eventCount: item.eventCount });
    }
    for (const item of data.breakdown.repeatFailures.items ?? []) {
      push({ metric: 'repeatFailures', formulaVersion: data.breakdown.repeatFailures.metadata?.formulaVersion ?? '', reason: item.reason ?? '', totalHours: item.durationHours ?? '', machineCode: item.machine?.code ?? '' });
    }
    return rows.length > 0 ? rows : [{}];
  }

  private toCsv(rows: Array<Record<string, string>>): string {
    if (rows.length === 0) return '';
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(','))].join('\n');
  }
}
