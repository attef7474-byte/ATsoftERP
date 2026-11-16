import { PRINT_ROW_LIMIT, printFormatters, PrintPreparationError, type PrintColumn, type PrintField } from '../../lib/print';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface OperationsFactor { percent: string | null; numerator?: string; denominator?: string; blockers?: string[] }

export interface OperationsRunRow {
  productionRunId: string;
  runNumber: string;
  status: string;
  productionLineCode?: string | null;
  machineCode?: string | null;
  productCode?: string | null;
  productName?: string | null;
  startedAt?: string | null;
  metrics?: {
    plannedMinutes?: string | number | null;
    operatingMinutes?: string | number | null;
    totalOutput?: string | number | null;
    goodOutput?: string | number | null;
    oee?: OperationsFactor | null;
  };
}

export interface OperationsCostRow { eventType: string; amount: string | number; count: number }
export interface OperationsDowntimeRow { machine?: { code?: string | null; name?: string | null } | null; totalHours?: string | number | null; eventCount?: number }

export interface OperationsPrintData {
  overview: {
    formulaVersion: string;
    summary: {
      runCount: number;
      plannedMinutes?: string;
      operatingMinutes?: string;
      totalOutput?: string;
      goodOutput?: string;
      factors: { availability: OperationsFactor | null; performance: OperationsFactor | null; quality: OperationsFactor | null; oee: OperationsFactor | null };
      reliability: {
        mtbf?: { mtbfHours?: number | string | null };
        mttr?: { mttrHours?: number | string | null };
        totalDowntime?: { totalHours?: number | string | null; totalEvents?: number };
      };
      operationalCost: { totalAmount: string | number; transactionCount: number; currencyCode: string };
    };
    breakdowns: {
      downtimeByMachine?: { items?: OperationsDowntimeRow[] } | OperationsDowntimeRow[];
      costByEventType?: OperationsCostRow[];
    };
  };
  drilldown: {
    oeeFormulaVersion?: string;
    data: OperationsRunRow[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  };
}

function runStatusKey(status: string): string {
  switch (status) {
    case 'READY': return 'production.runs.runStatus.READY';
    case 'RUNNING': return 'production.runs.runStatus.RUNNING';
    case 'PAUSED': return 'production.runs.runStatus.PAUSED';
    case 'COMPLETED': return 'production.runs.runStatus.COMPLETED';
    case 'ABORTED': return 'production.runs.runStatus.ABORTED';
    default: return 'operationsReports.unknownStatus';
  }
}

function costEventKey(eventType: string): string {
  switch (eventType) {
    case 'DOWNTIME': return 'operationsReports.costEventDOWNTIME';
    case 'MATERIAL': return 'operationsReports.costEventMATERIAL';
    case 'LABOR': return 'operationsReports.costEventLABOR';
    case 'MACHINE': return 'operationsReports.costEventMACHINE';
    case 'OVERHEAD': return 'operationsReports.costEventOVERHEAD';
    case 'ENERGY': return 'operationsReports.costEventENERGY';
    case 'QUALITY': return 'operationsReports.costEventQUALITY';
    case 'INVENTORY': return 'operationsReports.costEventINVENTORY';
    default: return 'operationsReports.otherCostEvent';
  }
}

/** Cross-domain operations report: runs are one bounded register; OEE, reliability and cost stay separate authoritative sections. */
export function operationsPrintModel(snapshot: ReportPrintSnapshot<OperationsPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params } = snapshot, fmt = printFormatters(locale);
  const overview = data?.overview, drilldown = data?.drilldown;
  if (!overview || !drilldown || !Array.isArray(drilldown.data) || drilldown.data.length > PRINT_ROW_LIMIT || drilldown.meta?.total > PRINT_ROW_LIMIT) throw new PrintPreparationError('limitExceeded');

  const s = overview.summary, factors = s.factors, reliability = s.reliability, cost = s.operationalCost;
  const percentText = (factor?: OperationsFactor | null) => factor?.percent == null ? undefined : `${fmt.number(factor.percent)}%`;
  const hours = (value?: number | string | null) => `${fmt.number(value)} ${t('operationsReports.hoursUnit')}`;
  const downtimeItems = Array.isArray(overview.breakdowns.downtimeByMachine)
    ? overview.breakdowns.downtimeByMachine
    : overview.breakdowns.downtimeByMachine?.items ?? [];

  const filters: PrintField[] = [];
  if (params.productionLineId && snapshot.labels.productionLineId) filters.push({ label: t('operationsReports.productionLine'), value: snapshot.labels.productionLineId });
  if (params.machineId && snapshot.labels.machineId) filters.push({ label: t('operationsReports.machine'), value: snapshot.labels.machineId });

  const summary: PrintField[] = [
    { label: t('operationsReports.oee'), value: percentText(factors.oee) },
    { label: t('operationsReports.availability'), value: percentText(factors.availability) },
    { label: t('operationsReports.performance'), value: percentText(factors.performance) },
    { label: t('operationsReports.quality'), value: percentText(factors.quality) },
    { label: t('operationsReports.runCount'), value: fmt.number(s.runCount, { maximumFractionDigits: 0 }) },
    { label: t('operationsReports.mtbf'), value: hours(reliability.mtbf?.mtbfHours) },
    { label: t('operationsReports.totalDowntime'), value: `${hours(reliability.totalDowntime?.totalHours)} · ${fmt.number(reliability.totalDowntime?.totalEvents, { maximumFractionDigits: 0 })} ${t('operationsReports.events')}` },
    { label: t('operationsReports.operationalCost'), value: `${fmt.currency(cost.totalAmount, cost.currencyCode)} · ${fmt.number(cost.transactionCount, { maximumFractionDigits: 0 })} ${t('operationsReports.transactions')}` },
  ];

  const runColumns: PrintColumn<OperationsRunRow>[] = [
    { key: 'run', label: t('operationsReports.run'), value: row => row.runNumber, align: 'start', priority: 1, width: 12, direction: 'ltr' },
    { key: 'status', label: t('operationsReports.status'), value: row => t(runStatusKey(row.status)), align: 'start', priority: 2, width: 12 },
    { key: 'line', label: t('operationsReports.productionLine'), value: row => row.productionLineCode, align: 'start', priority: 2, width: 12, direction: 'ltr' },
    { key: 'machine', label: t('operationsReports.machine'), value: row => row.machineCode, align: 'start', priority: 2, width: 12, direction: 'ltr' },
    { key: 'product', label: t('operationsReports.product'), value: row => row.productCode || row.productName, align: 'start', priority: 2, width: 16 },
    { key: 'startedAt', label: t('operationsReports.startedAt'), value: row => fmt.dateTime(row.startedAt), align: 'start', priority: 2, width: 16, direction: 'ltr' },
    { key: 'plannedMinutes', label: t('operationsReports.plannedMinutes'), value: row => fmt.number(row.metrics?.plannedMinutes), align: 'end', priority: 3, width: 10, direction: 'ltr' },
    { key: 'operatingMinutes', label: t('operationsReports.operatingMinutes'), value: row => fmt.number(row.metrics?.operatingMinutes), align: 'end', priority: 3, width: 10, direction: 'ltr' },
    { key: 'output', label: t('operationsReports.output'), value: row => fmt.number(row.metrics?.totalOutput), align: 'end', priority: 3, width: 10, direction: 'ltr' },
    { key: 'goodOutput', label: t('operationsReports.goodOutput'), value: row => fmt.number(row.metrics?.goodOutput), align: 'end', priority: 3, width: 10, direction: 'ltr' },
    { key: 'oee', label: t('operationsReports.oee'), value: row => percentText(row.metrics?.oee), align: 'end', priority: 3, width: 8, direction: 'ltr' },
  ];

  const costColumns: PrintColumn<OperationsCostRow>[] = [
    { key: 'eventType', label: t('operationsReports.eventType'), value: row => t(costEventKey(row.eventType)), align: 'start', priority: 1, width: 50 },
    { key: 'amount', label: t('operationsReports.amount'), value: row => fmt.currency(row.amount, cost.currencyCode), align: 'end', priority: 1, width: 30, direction: 'ltr' },
    { key: 'transactions', label: t('operationsReports.transactions'), value: row => fmt.number(row.count, { maximumFractionDigits: 0 }), align: 'end', priority: 2, width: 20, direction: 'ltr' },
  ];

  const downtimeColumns: PrintColumn<OperationsDowntimeRow>[] = [
    { key: 'machine', label: t('operationsReports.machine'), value: row => row.machine?.code || row.machine?.name, align: 'start', priority: 1, width: 50, direction: 'ltr' },
    { key: 'totalHours', label: t('operationsReports.totalDowntime'), value: row => hours(row.totalHours), align: 'end', priority: 1, width: 30, direction: 'ltr' },
    { key: 'events', label: t('operationsReports.events'), value: row => fmt.number(row.eventCount, { maximumFractionDigits: 0 }), align: 'end', priority: 2, width: 20, direction: 'ltr' },
  ];

  return {
    mode: 'REPORT', title: t('operationsReports.title'), subtitle: t('operationsReports.subtitle'), paperSize: 'A4', orientation: 'landscape',
    scopeLabel: t('reports.printDocument.operationsScope'),
    periodStart: String(params.dateFrom ?? ''), periodEnd: String(params.dateTo ?? ''),
    filters, summary,
    metadata: [
      { label: t('operationsReports.reportFormula'), value: overview.formulaVersion },
      { label: t('operationsReports.oeeAuthority'), value: drilldown.oeeFormulaVersion },
    ],
    sections: [
      { title: t('operationsReports.runs'), columns: runColumns, rows: drilldown.data },
      { title: t('operationsReports.costByEvent'), columns: costColumns, rows: overview.breakdowns.costByEventType ?? [], pageBreakBefore: true },
      { title: t('operationsReports.downtimeByMachine'), columns: downtimeColumns, rows: downtimeItems },
    ],
    notes: [t('reports.printDocument.operationsNote'), t('operationsReports.lineageText')],
  };
}
