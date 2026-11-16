import { printFormatters, PrintPreparationError, type PrintColumn } from '../../lib/print';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

interface MetricCard { label: string; value: number | string | null; unit?: string }
export interface MaintenanceKpisPrintData {
  kpi: { cards: MetricCard[] };
  reliability: { repeatFailureRate: number | null; totalEvents: number; repeatEvents?: number };
  compliance: { cards: MetricCard[] };
}

export function maintenanceKpisPrintModel(snapshot: ReportPrintSnapshot<MaintenanceKpisPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale);
  const definitions: Record<string, string> = { productionLineId: 'maintenance.productionLine', machineId: 'reports.machine', operationTypeId: 'maintenance.operationType', costCenterId: 'maintenance.costCenter' };
  const filters = Object.entries(definitions).filter(([key]) => params[key]).map(([key, label]) => {
    if (!labels[key]) throw new PrintPreparationError('unavailable');
    return { label: t(label), value: labels[key] };
  });
  const periodMetrics = new Set(['totalRequests', 'completedRequests', 'cancelledRequests', 'totalCost', 'partsCost', 'otherCost', 'pmCmRatio', 'emergencyPercentage']);
  const contextPeriodMetrics = new Set(['totalDowntime', 'totalDowntimeHours', 'totalDowntimeEvents']);
  const labelFor = (card: MetricCard) => card.label === 'totalDowntime' ? t('maintenance.totalDowntime') : t(`reports.${card.label}`);
  const valueFor = (card: MetricCard) => {
    if (card.value == null) return fmt.number(null);
    if (card.unit === '%') return fmt.percent(Number(card.value) / 100);
    const value = fmt.number(card.value);
    return card.unit === 'hours' ? `${value} ${t('common.hours')}` : card.unit === 'minutes' ? `${value} ${t('common.minutes')}` : value;
  };
  const scopeFor = (label: string) => periodMetrics.has(label) ? t('reports.printDocument.kpiSelectedPeriod')
    : contextPeriodMetrics.has(label) ? t('reports.printDocument.kpiContextPeriod')
      : label === 'activeDowntime' ? t('reports.printDocument.kpiContextCurrent')
        : label === 'overdueSchedules' ? t('reports.printDocument.kpiMachineCurrent')
          : t('reports.printDocument.kpiSelectedAllDates');
  type MetricRow = { label: string; value: string; scope: string };
  const columns: PrintColumn<MetricRow>[] = [
    { key: 'label', label: t('reports.printDocument.metric'), value: row => row.label, align: 'start', priority: 1, width: 35 },
    { key: 'value', label: t('reports.printDocument.value'), value: row => row.value, align: 'end', priority: 2, width: 20, direction: 'ltr' },
    { key: 'scope', label: t('reports.printDocument.scope'), value: row => row.scope, align: 'start', priority: 3, width: 45 },
  ];
  return {
    mode: 'REPORT', title: t('maintenance.kpiOverview'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.kpiScope'),
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined, periodEnd: params.dateTo ? String(params.dateTo) : undefined, filters,
    sections: [
      { title: t('reports.summary'), columns, rows: data.kpi.cards.map(card => ({ label: labelFor(card), value: valueFor(card), scope: scopeFor(card.label) })) },
      { title: t('maintenance.reliabilityKpis'), columns, rows: [
        { label: t('maintenance.repeatFailureRate'), value: valueFor({ label: '', value: data.reliability.repeatFailureRate, unit: '%' }), scope: t(params.productionLineId && params.machineId ? 'reports.printDocument.kpiReliabilityLineScope' : 'reports.printDocument.kpiSelectedPeriod') },
        { label: t('maintenance.totalDowntimeEvents'), value: fmt.number(data.reliability.totalEvents), scope: t(params.productionLineId && params.machineId ? 'reports.printDocument.kpiReliabilityLineScope' : 'reports.printDocument.kpiSelectedPeriod') },
      ] },
      { title: t('maintenance.scheduleCompliance'), columns, rows: data.compliance.cards.map(card => ({ label: labelFor(card), value: valueFor(card), scope: ['complianceRate', 'completedPreventive'].includes(card.label) ? t('reports.printDocument.kpiComplianceScope') : card.label === 'scheduleComplianceTarget' ? t('reports.printDocument.kpiSelectedPeriod') : t('reports.printDocument.kpiSelectedAllDates') })) },
    ],
    notes: [t('reports.printDocument.kpiFilterNote'), t('reports.printDocument.kpiLegacyCostNote')],
  };
}
