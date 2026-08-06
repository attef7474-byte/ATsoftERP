'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { Button, Input, PageHeader, Select } from '../../../../components/admin/ui';
import { ChartCard } from '../../../../components/admin/charts/chart-card';
import { RadialProgressCard } from '../../../../components/admin/charts/radial-progress-card';
import { LineChartCard } from '../../../../components/admin/charts/line-chart-card';
import { BarChartCard } from '../../../../components/admin/charts/bar-chart-card';
import { PieChartCard } from '../../../../components/admin/charts/pie-chart-card';
import { F9Lookup } from '../../../../components/f9/F9Lookup';
import {
  machineAdapter,
  productionLineAdapter,
  productionLossReasonAdapter,
  productionProductDefinitionAdapter,
  productionShiftAdapter,
  productionUnitAdapter,
} from '../../../../components/f9/lookup-adapters';
import type {
  ProductionAnalyticsBottlenecksReport,
  ProductionAnalyticsCapacityVarianceReport,
  ProductionAnalyticsCostReport,
  ProductionAnalyticsDowntimeReport,
  ProductionAnalyticsExportResult,
  ProductionAnalyticsLossesReport,
  ProductionAnalyticsLossParetoReport,
  ProductionAnalyticsMaterialsReport,
  ProductionAnalyticsOeeReport,
  ProductionAnalyticsOutputReport,
  ProductionAnalyticsQualityReport,
  ProductionAnalyticsQuery,
  ProductionAnalyticsReportName,
  ProductionAnalyticsTrendReport,
} from '../../../../lib/admin-types';

const REPORT_NAMES: ProductionAnalyticsReportName[] = [
  'oee', 'trends', 'loss-pareto', 'bottlenecks', 'capacity-variance',
  'drilldown', 'output', 'downtime', 'losses', 'quality', 'materials', 'cost',
];

const REPORT_LABEL_KEYS: Record<ProductionAnalyticsReportName, string> = {
  oee: 'production.analytics.reportLabels.reportOee',
  trends: 'production.analytics.reportLabels.reportTrends',
  'loss-pareto': 'production.analytics.reportLabels.reportLossPareto',
  bottlenecks: 'production.analytics.reportLabels.reportBottlenecks',
  'capacity-variance': 'production.analytics.reportLabels.reportCapacityVariance',
  drilldown: 'production.analytics.reportLabels.reportDrilldown',
  output: 'production.analytics.reportLabels.reportOutput',
  downtime: 'production.analytics.reportLabels.reportDowntime',
  losses: 'production.analytics.reportLabels.reportLosses',
  quality: 'production.analytics.reportLabels.reportQuality',
  materials: 'production.analytics.reportLabels.reportMaterials',
  cost: 'production.analytics.reportLabels.reportCost',
};

type FilterState = {
  dateFrom: string;
  dateTo: string;
  productionUnitId: string;
  productionLineId: string;
  machineId: string;
  productionProductDefinitionId: string;
  shiftId: string;
  grain: string;
  lossCategory: string;
  downtimeOccurrence: string;
  reasonId: string;
};

const defaultFilters = (): FilterState => {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
    productionUnitId: '',
    productionLineId: '',
    machineId: '',
    productionProductDefinitionId: '',
    shiftId: '',
    grain: 'DAY',
    lossCategory: '',
    downtimeOccurrence: '',
    reasonId: '',
  };
};

const queryFrom = (filters: FilterState): ProductionAnalyticsQuery => ({
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo,
  productionUnitId: filters.productionUnitId || undefined,
  productionLineId: filters.productionLineId || undefined,
  machineId: filters.machineId || undefined,
  productionProductDefinitionId: filters.productionProductDefinitionId || undefined,
  shiftId: filters.shiftId || undefined,
  grain: (filters.grain as ProductionAnalyticsQuery['grain']) || undefined,
  lossCategory: (filters.lossCategory as ProductionAnalyticsQuery['lossCategory']) || undefined,
  downtimeOccurrence: (filters.downtimeOccurrence as ProductionAnalyticsQuery['downtimeOccurrence']) || undefined,
  reasonId: filters.reasonId || undefined,
});

const pct = (value: string | null | undefined): string =>
  value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`;

const num = (value: string | null | undefined, digits = 1): string =>
  value === null || value === undefined ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });

const factorValue = (value: string | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-50" dir="ltr">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  );
}

function TableCard<T>({ title, columns, rows, keyExtractor, emptyMessage }: {
  title: string;
  columns: Array<{ header: string; render: (row: T) => React.ReactNode }>;
  rows: T[];
  keyExtractor: (row: T, index: number) => string;
  emptyMessage?: string;
}) {
  return (
    <ChartCard title={title}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">{emptyMessage || '—'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {columns.map((column) => (
                  <th key={column.header} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={keyExtractor(row, index)} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                  {columns.map((column) => (
                    <td key={column.header} className="px-3 py-2 text-gray-700 dark:text-gray-200">{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

export default function ProductionAnalyticsPage() {
  const { t, dir } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const canRead = isSuperAdmin || Boolean(permissions?.permissions.includes('production-analytics:read'));
  const canExport = isSuperAdmin || Boolean(permissions?.permissions.includes('production-analytics:export'));

  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [applied, setApplied] = useState<ProductionAnalyticsQuery | null>(null);
  const [exportReport, setExportReport] = useState<ProductionAnalyticsReportName>('oee');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [oee, setOee] = useState<ProductionAnalyticsOeeReport | null>(null);
  const [trends, setTrends] = useState<ProductionAnalyticsTrendReport | null>(null);
  const [lossPareto, setLossPareto] = useState<ProductionAnalyticsLossParetoReport | null>(null);
  const [bottlenecks, setBottlenecks] = useState<ProductionAnalyticsBottlenecksReport | null>(null);
  const [capacityVariance, setCapacityVariance] = useState<ProductionAnalyticsCapacityVarianceReport | null>(null);
  const [output, setOutput] = useState<ProductionAnalyticsOutputReport | null>(null);
  const [downtime, setDowntime] = useState<ProductionAnalyticsDowntimeReport | null>(null);
  const [losses, setLosses] = useState<ProductionAnalyticsLossesReport | null>(null);
  const [quality, setQuality] = useState<ProductionAnalyticsQualityReport | null>(null);
  const [materials, setMaterials] = useState<ProductionAnalyticsMaterialsReport | null>(null);
  const [cost, setCost] = useState<ProductionAnalyticsCostReport | null>(null);

  const lossCategoryLabel = useCallback((category: string | null): string => {
    switch (category) {
      case 'WASTE': return t('production.analytics.lossCategory.WASTE');
      case 'SCRAP': return t('production.analytics.lossCategory.SCRAP');
      case 'REWORK': return t('production.analytics.lossCategory.REWORK');
      case 'OTHER': return t('production.analytics.lossCategory.OTHER');
      default: return t('production.analytics.unknownValue');
    }
  }, [t]);

  const lossTypeLabel = useCallback((type: string): string => {
    switch (type) {
      case 'WASTE': return t('production.analytics.lossType.WASTE');
      case 'SCRAP': return t('production.analytics.lossType.SCRAP');
      case 'REWORK_SENT': return t('production.analytics.lossType.REWORK_SENT');
      case 'REWORK_RECOVERED': return t('production.analytics.lossType.REWORK_RECOVERED');
      default: return t('production.analytics.unknownValue');
    }
  }, [t]);

  const grainLabel = useCallback((grain: string): string => {
    switch (grain) {
      case 'DAY': return t('production.analytics.grainOptions.DAY');
      case 'WEEK': return t('production.analytics.grainOptions.WEEK');
      case 'MONTH': return t('production.analytics.grainOptions.MONTH');
      default: return t('production.analytics.unknownValue');
    }
  }, [t]);

  const targetStatusLabel = useCallback((status: string): string => {
    switch (status) {
      case 'MEETING': return t('production.analytics.targetStatus.MEETING');
      case 'BELOW_TARGET': return t('production.analytics.targetStatus.BELOW_TARGET');
      case 'BLOCKED': return t('production.analytics.targetStatus.BLOCKED');
      case 'NO_TARGET': return t('production.analytics.targetStatus.NO_TARGET');
      default: return t('production.analytics.unknownValue');
    }
  }, [t]);

  const downtimeOccurrenceLabel = useCallback((value: string): string => {
    switch (value) {
      case 'PLANNED': return t('production.analytics.downtimeOccurrence.PLANNED');
      case 'UNPLANNED': return t('production.analytics.downtimeOccurrence.UNPLANNED');
      default: return t('production.analytics.unknownValue');
    }
  }, [t]);

  const reasonName = useCallback((item: { reasonNameEn: string | null; reasonNameAr: string | null; reasonCode: string | null }): string => {
    const locale = typeof window !== 'undefined' ? document.documentElement.lang : 'en';
    const name = locale === 'ar' ? item.reasonNameAr : item.reasonNameEn;
    return name || item.reasonCode || '—';
  }, []);

  const runReport = useCallback((report: string, query: ProductionAnalyticsQuery) => {
    return api.get<any>(`/reports/production/${report}`, { params: query as Record<string, any> });
  }, []);

  const apply = useCallback(async () => {
    const query = queryFrom(filters);
    if (!query.dateFrom || !query.dateTo) { showToast(t('validation.required'), 'error'); return; }
    if (query.dateTo < query.dateFrom) { showToast(t('production.analytics.invalidWindow'), 'error'); return; }
    setLoading(true);
    setApplied(query);
    const calls = [
      runReport('oee', query),
      runReport('trends', query),
      runReport('loss-pareto', query),
      runReport('bottlenecks', query),
      runReport('capacity-variance', query),
      runReport('output', query),
      runReport('downtime', query),
      runReport('losses', query),
      runReport('quality', query),
      runReport('materials', query),
      runReport('cost', query),
    ];
    const results = await Promise.allSettled(calls);
    const setters = [setOee, setTrends, setLossPareto, setBottlenecks, setCapacityVariance, setOutput, setDowntime, setLosses, setQuality, setMaterials, setCost];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') setters[index](result.value);
      else setters[index](null);
    });
    const rejected = results.filter((result) => result.status === 'rejected');
    if (rejected.length > 0) {
      showToast(t('errors.loadFailed'), 'error');
    }
    setLoading(false);
  }, [filters, runReport, showToast, t]);

  const reset = useCallback(() => {
    setFilters(defaultFilters());
    setApplied(null);
    setOee(null); setTrends(null); setLossPareto(null); setBottlenecks(null);
    setCapacityVariance(null); setOutput(null); setDowntime(null); setLosses(null);
    setQuality(null); setMaterials(null); setCost(null);
  }, []);

  const doExport = useCallback(async () => {
    if (!applied) { showToast(t('production.analytics.applyFirst'), 'error'); return; }
    if (!canExport) return;
    setExporting(true);
    try {
      const body = { ...queryFrom(filters), report: exportReport };
      const result = await api.post<ProductionAnalyticsExportResult>('/reports/production/export', body);
      if (!result.csv) { showToast(t('production.analytics.exported'), 'error'); return; }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportReport}_${filters.dateFrom}_${filters.dateTo}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(t('production.analytics.exported'), 'success');
    } catch (err) { handleApiError(err); }
    finally { setExporting(false); }
  }, [applied, canExport, exportReport, filters, handleApiError, showToast, t]);

  const trendData = useMemo(() => (trends?.items ?? []).map((item) => ({
    label: item.key,
    value: factorValue(item.aggregates?.oee?.percent),
  })), [trends]);

  const paretoData = useMemo(() => (lossPareto?.items ?? []).map((item) => ({
    label: reasonName(item),
    value: Number(item.minutes),
  })), [lossPareto, reasonName]);

  const bottleneckData = useMemo(() => (bottlenecks?.items ?? []).map((item) => ({
    label: item.machineName || item.productionLineCode || '—',
    value: Number(item.minutes),
  })), [bottlenecks]);

  const outputByProduct = useMemo(() => (output?.byProduct ?? []).map((item) => ({
    label: item.label,
    value: Number(item.totals.totalOutput),
  })), [output]);

  const lossesByType = useMemo(() => (losses?.byType ?? []).map((item) => ({
    label: lossTypeLabel(item.type),
    value: Number(item.quantity),
  })), [losses, lossTypeLabel]);

  const oeeRunStatus = useMemo(() => {
    const runs = oee?.runs ?? [];
    const meeting = runs.filter((run) => run.targetStatus === 'MEETING').length;
    const below = runs.filter((run) => run.targetStatus === 'BELOW_TARGET').length;
    const blocked = runs.filter((run) => run.targetStatus === 'BLOCKED').length;
    const noTarget = runs.filter((run) => run.targetStatus === 'NO_TARGET').length;
    return { meeting, below, blocked, noTarget };
  }, [oee]);

  if (!canRead) return <div><PageHeader title={t('production.analytics.title')} /><div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{t('validation.forbidden')}</div></div>;

  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <PageHeader title={t('production.analytics.title')} subtitle={t('production.analytics.subtitle')} />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={exportReport} onChange={(e) => setExportReport(e.target.value as ProductionAnalyticsReportName)} options={REPORT_NAMES.map((value) => ({ value, label: t(REPORT_LABEL_KEYS[value]) }))} />
        <Button variant="secondary" onClick={doExport} loading={exporting} disabled={!canExport || !applied}>{t('production.analytics.export')}</Button>
      </div>
    </div>

    <ChartCard title={t('production.analytics.filters')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input type="date" label={t('production.analytics.dateFrom')} value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
        <Input type="date" label={t('production.analytics.dateTo')} value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
        <Select label={t('production.analytics.grain')} value={filters.grain} onChange={(e) => setFilters({ ...filters, grain: e.target.value })} options={['DAY', 'WEEK', 'MONTH'].map((value) => ({ value, label: grainLabel(value) }))} />
        <F9Lookup label={t('production.analytics.selectUnit')} value={filters.productionUnitId} adapter={productionUnitAdapter} onChange={(value) => setFilters({ ...filters, productionUnitId: value })} />
        <F9Lookup label={t('production.analytics.selectLine')} value={filters.productionLineId} adapter={productionLineAdapter} onChange={(value) => setFilters({ ...filters, productionLineId: value, machineId: '' })} />
        <F9Lookup label={t('production.analytics.selectMachine')} value={filters.machineId} adapter={machineAdapter} filters={filters.productionLineId ? { productionLineId: filters.productionLineId } : undefined} onChange={(value) => setFilters({ ...filters, machineId: value })} />
        <F9Lookup label={t('production.analytics.selectProduct')} value={filters.productionProductDefinitionId} adapter={productionProductDefinitionAdapter} onChange={(value) => setFilters({ ...filters, productionProductDefinitionId: value })} />
        <F9Lookup label={t('production.analytics.selectShift')} value={filters.shiftId} adapter={productionShiftAdapter} onChange={(value) => setFilters({ ...filters, shiftId: value })} />
        <F9Lookup label={t('production.analytics.selectReason')} value={filters.reasonId} adapter={productionLossReasonAdapter} onChange={(value) => setFilters({ ...filters, reasonId: value })} />
        <Select label={t('production.analytics.lossCategoryFilter')} value={filters.lossCategory} onChange={(e) => setFilters({ ...filters, lossCategory: e.target.value })} placeholder={t('production.analytics.allValues')} options={['WASTE', 'SCRAP', 'REWORK', 'OTHER'].map((value) => ({ value, label: lossCategoryLabel(value) }))} />
        <Select label={t('production.analytics.downtimeOccurrenceFilter')} value={filters.downtimeOccurrence} onChange={(e) => setFilters({ ...filters, downtimeOccurrence: e.target.value })} placeholder={t('production.analytics.allValues')} options={['PLANNED', 'UNPLANNED'].map((value) => ({ value, label: downtimeOccurrenceLabel(value) }))} />
        <div className="flex items-end gap-2">
          <Button onClick={apply} loading={loading}>{t('production.analytics.apply')}</Button>
          <Button variant="secondary" onClick={reset}>{t('production.analytics.reset')}</Button>
        </div>
      </div>
    </ChartCard>

    {applied ? (
      <div className="mt-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <RadialProgressCard value={factorValue(oee?.aggregates?.availability?.percent)} label={t('production.analytics.availability')} suffix="%" color="#2563eb" />
          <RadialProgressCard value={factorValue(oee?.aggregates?.performance?.percent)} label={t('production.analytics.performance')} suffix="%" color="#d97706" />
          <RadialProgressCard value={factorValue(oee?.aggregates?.quality?.percent)} label={t('production.analytics.quality')} suffix="%" color="#7c3aed" />
          <RadialProgressCard value={factorValue(oee?.aggregates?.oee?.percent)} label={t('production.analytics.oee')} suffix="%" color="#059669" />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={t('production.analytics.runCount')} value={String(oee?.aggregates?.runCount ?? 0)} />
          <StatCard label={t('production.analytics.totalOutput')} value={num(oee?.aggregates?.totalOutput)} />
          <StatCard label={t('production.analytics.goodOutput')} value={num(oee?.aggregates?.goodOutput)} />
          <StatCard label={t('production.analytics.rejectOutput')} value={num(oee?.aggregates?.rejectOutput)} />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={t('production.analytics.targetStatus.MEETING')} value={String(oeeRunStatus.meeting)} />
          <StatCard label={t('production.analytics.targetStatus.BELOW_TARGET')} value={String(oeeRunStatus.below)} />
          <StatCard label={t('production.analytics.targetStatus.BLOCKED')} value={String(oeeRunStatus.blocked)} />
          <StatCard label={t('production.analytics.targetStatus.NO_TARGET')} value={String(oeeRunStatus.noTarget)} />
        </div>

        <ChartCard title={t('production.analytics.trends')} subtitle={trends ? grainLabel(trends.grain) : undefined}>
          <LineChartCard
            data={trendData}
            formatValue={(value) => `${value.toFixed(1)}%`}
            seriesName={t('production.analytics.oee')}
            ariaLabel={t('production.analytics.trends')}
            emptyMessage={t('production.analytics.noData')}
          />
        </ChartCard>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title={t('production.analytics.lossPareto')}>
            <BarChartCard
              data={paretoData}
              formatValue={(value) => `${value.toFixed(0)} ${t('production.analytics.minutes')}`}
              ariaLabel={t('production.analytics.lossPareto')}
              emptyMessage={t('production.analytics.noData')}
            />
          </ChartCard>
          <ChartCard title={t('production.analytics.bottlenecks')}>
            <BarChartCard
              data={bottleneckData}
              formatValue={(value) => `${value.toFixed(0)} ${t('production.analytics.minutes')}`}
              ariaLabel={t('production.analytics.bottlenecks')}
              emptyMessage={t('production.analytics.noData')}
            />
          </ChartCard>
        </div>

        <ChartCard title={t('production.analytics.output')}>
          <BarChartCard
            data={outputByProduct}
            formatValue={(value) => num(String(value))}
            ariaLabel={t('production.analytics.output')}
            emptyMessage={t('production.analytics.noData')}
          />
        </ChartCard>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title={t('production.analytics.losses')}>
            <PieChartCard
              data={lossesByType}
              formatValue={(value) => num(String(value))}
              centerLabel={t('production.analytics.totalLossQuantity')}
              centerValue={num(losses?.aggregates?.totalLossQuantity)}
              ariaLabel={t('production.analytics.losses')}
              emptyMessage={t('production.analytics.noData')}
            />
          </ChartCard>
          <ChartCard title={t('production.analytics.qualityReport')}>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t('production.analytics.firstPassRate')} value={pct(quality?.aggregates?.firstPassRatePercent)} />
              <StatCard label={t('production.analytics.goodOutput')} value={num(quality?.aggregates?.goodOutput)} />
              <StatCard label={t('production.analytics.rejectOutput')} value={num(quality?.aggregates?.rejectOutput)} />
              <StatCard label={t('production.analytics.inspectionCount')} value={String(quality?.aggregates?.inspectionCount ?? 0)} />
            </div>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TableCard
            title={t('production.analytics.downtime')}
            columns={[
              { header: t('production.analytics.byReason'), render: (row) => reasonName(row) },
              { header: t('production.analytics.minutes'), render: (row) => <span dir="ltr">{num(row.minutes)}</span> },
              { header: t('production.analytics.eventCount'), render: (row) => String(row.count) },
            ]}
            rows={downtime?.byReason ?? []}
            keyExtractor={(row, index) => `${row.reasonId || 'none'}-${index}`}
            emptyMessage={t('production.analytics.noData')}
          />
          <TableCard
            title={t('production.analytics.materials')}
            columns={[
              { header: t('production.product'), render: (row) => `${row.productCode} - ${row.productName}` },
              { header: t('production.analytics.totalQuantity'), render: (row) => <span dir="ltr">{num(row.quantity)} {row.unit}</span> },
              { header: t('production.analytics.eventCount'), render: (row) => String(row.count) },
            ]}
            rows={materials?.byProduct ?? []}
            keyExtractor={(row, index) => `${row.productId}-${index}`}
            emptyMessage={t('production.analytics.noData')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TableCard
            title={t('production.analytics.cost')}
            columns={[
              { header: t('production.analytics.byCostCenter'), render: (row) => row.costCenterName || row.costCenterCode || '—' },
              { header: t('production.analytics.totalAmount'), render: (row) => <span dir="ltr">{num(row.amount)} {cost?.currencyCode || ''}</span> },
              { header: t('production.analytics.transactionCount'), render: (row) => String(row.count) },
            ]}
            rows={cost?.byCostCenter ?? []}
            keyExtractor={(row, index) => `${row.costCenterId || 'none'}-${index}`}
            emptyMessage={t('production.analytics.noData')}
          />
          <TableCard
            title={t('production.analytics.capacityVariance')}
            columns={[
              { header: t('production.runNumber'), render: (row) => row.runNumber },
              { header: t('production.product'), render: (row) => row.productCode },
              { header: t('production.analytics.totalOutput'), render: (row) => <span dir="ltr">{num(row.actualOutput)}</span> },
              { header: t('production.analytics.idealOutput'), render: (row) => <span dir="ltr">{num(row.idealOutput)}</span> },
              { header: t('production.analytics.variance'), render: (row) => <span dir="ltr">{num(row.variance)}</span> },
            ]}
            rows={(capacityVariance?.rows ?? []).slice(0, 50)}
            keyExtractor={(row, index) => `${row.productionRunId}-${index}`}
            emptyMessage={t('production.analytics.noData')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TableCard
            title={t('production.analytics.drilldown')}
            columns={[
              { header: t('production.runNumber'), render: (row) => row.runNumber },
              { header: t('production.analytics.oee'), render: (row) => <span dir="ltr">{pct(row.metrics?.oee?.percent)}</span> },
              { header: t('production.analytics.availability'), render: (row) => <span dir="ltr">{pct(row.metrics?.availability?.percent)}</span> },
              { header: t('production.analytics.performance'), render: (row) => <span dir="ltr">{pct(row.metrics?.performance?.percent)}</span> },
              { header: t('production.analytics.quality'), render: (row) => <span dir="ltr">{pct(row.metrics?.quality?.percent)}</span> },
              { header: t('production.analytics.target'), render: (row) => targetStatusLabel(row.targetStatus) },
            ]}
            rows={(oee?.runs ?? []).slice(0, 50)}
            keyExtractor={(row, index) => `${row.productionRunId}-${index}`}
            emptyMessage={t('production.analytics.noData')}
          />
          <div className="space-y-4">
            <TableCard
              title={t('production.analytics.losses')}
              columns={[
                { header: t('production.analytics.byReason'), render: (row) => reasonName(row) },
                { header: t('production.analytics.totalLossQuantity'), render: (row) => <span dir="ltr">{num(row.quantity)}</span> },
              ]}
              rows={(losses?.byReason ?? []).slice(0, 20)}
              keyExtractor={(row, index) => `${row.reasonId || 'none'}-${index}`}
              emptyMessage={t('production.analytics.noData')}
            />
            <TableCard
              title={t('production.analytics.byShift')}
              columns={[
                { header: t('production.analytics.byShift'), render: (row) => row.shiftCode || '—' },
                { header: t('production.analytics.minutes'), render: (row) => <span dir="ltr">{num(row.minutes)}</span> },
              ]}
              rows={downtime?.byShift ?? []}
              keyExtractor={(row, index) => `${row.shiftId || 'none'}-${index}`}
              emptyMessage={t('production.analytics.noData')}
            />
          </div>
        </div>
      </div>
    ) : (
      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700" dir={dir}>
        {t('production.analytics.subtitle')}
      </div>
    )}
  </div>;
}
