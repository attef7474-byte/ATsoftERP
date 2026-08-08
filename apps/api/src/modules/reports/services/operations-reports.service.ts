import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { OperationalReliabilityService } from '../../factory/operational-analytics/reliability/operational-reliability.service';
import { ProductionAnalyticsService } from '../../factory/production-analytics/production-analytics.service';
import { OperationsReportExportDto, OperationsReportPageDto, OperationsReportQueryDto } from '../dto/operations-report-query.dto';
import {
  OPERATIONS_REPORT_CARDINALITY,
  OPERATIONS_REPORT_EXPORT_AUDIT_ENTITY,
  OPERATIONS_REPORT_FORMULA_VERSION,
  OPERATIONS_REPORT_LIMITS,
  OPERATIONS_REPORT_TIMEZONE,
} from '../operations-reports.constants';

@Injectable()
export class OperationsReportsService {
  constructor(
    private readonly reliability: OperationalReliabilityService,
    private readonly productionAnalytics: ProductionAnalyticsService,
    private readonly audit: AuditService,
  ) {}

  private badRequest(key: string, message: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message });
  }

  private window(query: OperationsReportQueryDto): { from: Date; to: Date } {
    const from = query.dateFrom.length <= 10 ? new Date(`${query.dateFrom}T00:00:00.000Z`) : new Date(query.dateFrom);
    const to = query.dateTo.length <= 10 ? new Date(`${query.dateTo}T23:59:59.999Z`) : new Date(query.dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw this.badRequest('analytics.invalidWindow', 'Invalid report window');
    }
    if (from.getTime() >= to.getTime()) {
      throw this.badRequest('analytics.invalidWindow', 'dateFrom must precede dateTo');
    }
    if ((to.getTime() - from.getTime()) / 86400000 > OPERATIONS_REPORT_LIMITS.maxWindowDays) {
      throw this.badRequest('analytics.windowTooLarge', `Window must not exceed ${OPERATIONS_REPORT_LIMITS.maxWindowDays} days`);
    }
    return { from, to };
  }

  private filters(query: OperationsReportQueryDto) {
    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      productionLineId: query.productionLineId || null,
      machineId: query.machineId || null,
    };
  }

  private authorityQuery(query: OperationsReportQueryDto) {
    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      productionLineId: query.productionLineId,
      machineId: query.machineId,
    };
  }

  async overview(query: OperationsReportQueryDto, ctx: ActiveOperationalContext) {
    const window = this.window(query);
    const authorityQuery = this.authorityQuery(query);
    const [reliability, cost] = await Promise.all([
      this.reliability.summary(authorityQuery, ctx),
      this.productionAnalytics.cost(authorityQuery, ctx),
    ]);
    const production = reliability.productionPerformance;
    const aggregates = production?.aggregates ?? {};

    return {
      generatedAt: new Date().toISOString(),
      timezone: OPERATIONS_REPORT_TIMEZONE,
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      filters: this.filters(query),
      formulaVersion: OPERATIONS_REPORT_FORMULA_VERSION,
      cardinality: OPERATIONS_REPORT_CARDINALITY,
      limits: OPERATIONS_REPORT_LIMITS,
      sourceLineage: [
        { section: 'reliability', authority: 'OperationalReliabilityService', sourceModels: ['DowntimeLog', 'MaintenanceRequest'] },
        { section: 'oee', authority: 'ProductionAnalyticsService', formulaVersion: production?.formulaVersion ?? null, sourceModels: production?.sourceModels ?? [] },
        { section: 'cost', authority: 'ProductionAnalyticsService.cost', sourceModels: ['OperationalCostTransaction'] },
      ],
      summary: {
        runCount: aggregates.runCount ?? 0,
        plannedMinutes: aggregates.plannedMinutes ?? '0',
        operatingMinutes: aggregates.operatingMinutes ?? '0',
        totalOutput: aggregates.totalOutput ?? '0',
        goodOutput: aggregates.goodOutput ?? '0',
        factors: {
          availability: aggregates.availability ?? null,
          performance: aggregates.performance ?? null,
          quality: aggregates.quality ?? null,
          oee: aggregates.oee ?? null,
        },
        reliability: {
          mtbf: reliability.metrics.mtbf,
          mttr: reliability.metrics.mttr,
          totalDowntime: reliability.metrics.totalDowntime,
          repeatFailureRate: reliability.metrics.repeatFailureRate,
        },
        operationalCost: {
          totalAmount: cost.aggregates.totalAmount,
          transactionCount: cost.aggregates.transactionCount,
          currencyCode: cost.currencyCode,
        },
      },
      breakdowns: {
        downtimeByMachine: reliability.breakdown.byMachine,
        downtimeByProductionLine: reliability.breakdown.byProductionLine,
        downtimeByCause: reliability.breakdown.byCause,
        costByEventType: cost.byEventType,
        costByCostCenter: cost.byCostCenter,
      },
      reconciliation: {
        productionRunCount: aggregates.runCount ?? 0,
        reliabilityEventCount: reliability.metrics.totalDowntime?.totalEvents ?? 0,
        costTransactionCount: cost.aggregates.transactionCount,
        rule: 'Each count reconciles only to its named authoritative fact set; counts are never added together as one physical-event total.',
      },
    };
  }

  async drilldown(query: OperationsReportPageDto, ctx: ActiveOperationalContext) {
    const window = this.window(query);
    const result = await this.productionAnalytics.drilldown(
      {
        ...this.authorityQuery(query),
        page: query.page || 1,
        limit: Math.min(query.limit || 20, OPERATIONS_REPORT_LIMITS.maxPageSize),
      },
      ctx,
    );
    return {
      timezone: OPERATIONS_REPORT_TIMEZONE,
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      filters: this.filters(query),
      formulaVersion: OPERATIONS_REPORT_FORMULA_VERSION,
      oeeFormulaVersion: 'PHASE_1_9_OEE_V1',
      sourceLineage: { authority: 'ProductionAnalyticsService.drilldown', sourceModel: 'ProductionRun' },
      cardinality: OPERATIONS_REPORT_CARDINALITY,
      data: result.runs,
      meta: result.meta,
      sourceChanges: result.sourceChanges,
    };
  }

  async export(query: OperationsReportExportDto, userId: string, ctx: ActiveOperationalContext) {
    const window = this.window(query);
    const overview = await this.overview(query, ctx);
    const rows = this.summaryRows(overview);
    let page = 1;
    let totalRuns = overview.summary.runCount;
    let truncated = rows.length > OPERATIONS_REPORT_LIMITS.maxExportRows;
    if (truncated) rows.length = OPERATIONS_REPORT_LIMITS.maxExportRows;

    while (rows.length < OPERATIONS_REPORT_LIMITS.maxExportRows) {
      const remaining = OPERATIONS_REPORT_LIMITS.maxExportRows - rows.length;
      const limit = Math.min(OPERATIONS_REPORT_LIMITS.maxPageSize, remaining);
      if (limit <= 0) break;
      const result = await this.drilldown({ ...query, page, limit }, ctx);
      totalRuns = result.meta.total;
      for (const run of result.data) rows.push(this.runRow(run));
      if (result.data.length === 0 || page >= result.meta.totalPages) break;
      page += 1;
    }
    if (rows.length >= OPERATIONS_REPORT_LIMITS.maxExportRows && totalRuns > rows.filter((row) => row.section === 'productionRun').length) {
      truncated = true;
    }

    const csv = this.toCsv(rows.slice(0, OPERATIONS_REPORT_LIMITS.maxExportRows));
    await this.audit.log(userId, 'EXPORT', OPERATIONS_REPORT_EXPORT_AUDIT_ENTITY, undefined, {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      report: 'operations',
      filters: this.filters(query),
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      rowCount: Math.min(rows.length, OPERATIONS_REPORT_LIMITS.maxExportRows),
      totalRuns,
      truncated,
    });

    return {
      report: 'operations',
      generatedAt: new Date().toISOString(),
      timezone: OPERATIONS_REPORT_TIMEZONE,
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      formulaVersion: OPERATIONS_REPORT_FORMULA_VERSION,
      rowCount: Math.min(rows.length, OPERATIONS_REPORT_LIMITS.maxExportRows),
      totalRuns,
      maxRows: OPERATIONS_REPORT_LIMITS.maxExportRows,
      truncated,
      csv,
    };
  }

  private summaryRows(overview: any): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = [
      {
        section: 'summary',
        formulaVersion: overview.formulaVersion,
        runCount: overview.summary.runCount,
        plannedMinutes: overview.summary.plannedMinutes,
        operatingMinutes: overview.summary.operatingMinutes,
        oeePercent: overview.summary.factors.oee?.percent ?? '',
        mtbfHours: overview.summary.reliability.mtbf?.mtbfHours ?? '',
        mttrHours: overview.summary.reliability.mttr?.mttrHours ?? '',
        downtimeHours: overview.summary.reliability.totalDowntime?.totalHours ?? '',
        costAmount: overview.summary.operationalCost.totalAmount,
        currencyCode: overview.summary.operationalCost.currencyCode,
      },
    ];
    for (const item of overview.breakdowns.costByEventType ?? []) {
      rows.push({ section: 'costByEventType', eventType: item.eventType, amount: item.amount, transactionCount: item.count });
    }
    for (const item of overview.breakdowns.costByCostCenter ?? []) {
      rows.push({ section: 'costByCostCenter', costCenterCode: item.costCenterCode, costCenterName: item.costCenterName, amount: item.amount, transactionCount: item.count });
    }
    for (const item of overview.breakdowns.downtimeByMachine?.items ?? []) {
      rows.push({ section: 'downtimeByMachine', machineCode: item.machine?.code ?? '', totalHours: item.totalHours, eventCount: item.eventCount });
    }
    return rows;
  }

  private runRow(run: any): Record<string, unknown> {
    return {
      section: 'productionRun',
      runNumber: run.runNumber,
      status: run.status,
      productionLineCode: run.productionLineCode,
      machineCode: run.machineCode,
      productCode: run.productCode,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      plannedMinutes: run.metrics?.plannedMinutes,
      operatingMinutes: run.metrics?.operatingMinutes,
      totalOutput: run.metrics?.totalOutput,
      goodOutput: run.metrics?.goodOutput,
      oeePercent: run.metrics?.oee?.percent,
      formulaVersion: 'PHASE_1_9_OEE_V1',
    };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    if (rows.length === 0) return '';
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const safe = (value: unknown): string => {
      const raw = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      const protectedValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return /[",\r\n]/.test(protectedValue) ? `"${protectedValue.replace(/"/g, '""')}"` : protectedValue;
    };
    return '\uFEFF' + [headers.join(','), ...rows.map((row) => headers.map((header) => safe(row[header])).join(','))].join('\n');
  }
}
