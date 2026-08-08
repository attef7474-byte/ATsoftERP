'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { Button, Input, PageHeader } from '../../../../components/admin/ui';
import { ChartCard } from '../../../../components/admin/charts/chart-card';
import { F9Lookup } from '../../../../components/f9/F9Lookup';
import {
  costCenterAdapter,
  machineAdapter,
  operationTypeAdapter,
  productionLineAdapter,
} from '../../../../components/f9/lookup-adapters';

type ReliabilityQuery = {
  dateFrom: string;
  dateTo: string;
  machineId?: string;
  productionLineId?: string;
  operationTypeId?: string;
  costCenterId?: string;
};

type MetricEnvelope = {
  metadata: { key: string; formulaVersion: string; authority: string; sourceModel: string; [k: string]: unknown };
  [k: string]: any;
};

type ReliabilitySummary = {
  generatedAt: string;
  timezone: string;
  window: { from: string; to: string };
  filters: { machineId: string | null; productionLineId: string | null; operationTypeId: string | null; costCenterId: string | null };
  metrics: Record<string, MetricEnvelope>;
  breakdown: {
    byMachine: { items: any[]; metadata: { formulaVersion: string } };
    byProductionLine: { items: any[]; metadata: { formulaVersion: string } };
    byCause: { items: any[]; metadata: { formulaVersion: string } };
    repeatFailures: { items: any[]; metadata: { formulaVersion: string } };
  };
  normalization: { cancelledExcluded: boolean; supersededOriginalsExcluded: boolean; correctedReplacementCountedOnce: boolean; dedupByDowntimeLogId: boolean };
  metricMetadata: Array<{ key: string; formulaVersion: string; authority: string; model: string }>;
};

type ReliabilityDrilldown = {
  window: { from: string; to: string };
  data: Array<Record<string, any>>;
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type FilterState = {
  dateFrom: string;
  dateTo: string;
  machineId: string;
  productionLineId: string;
  operationTypeId: string;
  costCenterId: string;
};

const defaultFilters = (): FilterState => {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
    machineId: '',
    productionLineId: '',
    operationTypeId: '',
    costCenterId: '',
  };
};

const queryFrom = (filters: FilterState): ReliabilityQuery => ({
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo,
  machineId: filters.machineId || undefined,
  productionLineId: filters.productionLineId || undefined,
  operationTypeId: filters.operationTypeId || undefined,
  costCenterId: filters.costCenterId || undefined,
});

const numberLocale = (locale: 'ar' | 'en'): string => locale === 'ar' ? 'ar-EG' : 'en-US';

const num = (value: string | number | null | undefined, digits = 1, locale: 'ar' | 'en' = 'en'): string =>
  value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString(numberLocale(locale), { maximumFractionDigits: digits });

const pct = (value: string | number | null | undefined, locale: 'ar' | 'en'): string =>
  value === null || value === undefined || value === ''
    ? '—'
    : `${Number(value).toLocaleString(numberLocale(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const hours = (value: string | number | null | undefined, locale: 'ar' | 'en', unit: string): string =>
  value === null || value === undefined || value === '' ? '—' : `${num(value, 1, locale)} ${unit}`;

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-50" dir="ltr">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
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

export default function OperationalReliabilityPage() {
  const { t, locale } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const canRead = isSuperAdmin || Boolean(permissions?.permissions.includes('operational-reliability:read'));
  const canExport = isSuperAdmin || Boolean(permissions?.permissions.includes('operational-reliability:export'));

  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [applied, setApplied] = useState<ReliabilityQuery | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [summary, setSummary] = useState<ReliabilitySummary | null>(null);
  const [drilldown, setDrilldown] = useState<ReliabilityDrilldown | null>(null);

  const apply = useCallback(async () => {
    const query = queryFrom(filters);
    if (!query.dateFrom || !query.dateTo) { showToast(t('validation.required'), 'error'); return; }
    if (query.dateTo < query.dateFrom) { showToast(t('productionReliability.invalidWindow'), 'error'); return; }
    setLoading(true);
    setApplied(query);
    const results = await Promise.allSettled([
      api.get<ReliabilitySummary>('/operational-analytics/reliability', { params: query as Record<string, any> }),
      api.get<ReliabilityDrilldown>('/operational-analytics/reliability/drilldown', { params: { ...query, page: 1, limit: 20 } as Record<string, any> }),
    ]);
    setSummary(results[0].status === 'fulfilled' ? results[0].value : null);
    setDrilldown(results[1].status === 'fulfilled' ? results[1].value : null);
    if (results.some((result) => result.status === 'rejected')) {
      showToast(t('productionReliability.loadFailed'), 'error');
    }
    setLoading(false);
  }, [filters, showToast, t]);

  const reset = useCallback(() => {
    setFilters(defaultFilters());
    setApplied(null);
    setSummary(null);
    setDrilldown(null);
  }, []);

  const doExport = useCallback(async () => {
    if (!applied) { showToast(t('productionReliability.applyFirst'), 'error'); return; }
    if (!canExport) return;
    setExporting(true);
    try {
      const body = { ...queryFrom(filters) };
      const result = await api.post<{ csv: string }>('/operational-analytics/reliability/export', body);
      if (!result.csv) { showToast(t('productionReliability.exported'), 'error'); return; }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `operational-reliability_${filters.dateFrom}_${filters.dateTo}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(t('productionReliability.exported'), 'success');
    } catch (err) { handleApiError(err); }
    finally { setExporting(false); }
  }, [applied, canExport, filters, handleApiError, showToast, t]);

  const metric = useCallback((key: string): MetricEnvelope | undefined => summary?.metrics[key], [summary]);

  const eventStatusLabel = useCallback((item: any): string => {
    if (item.cancelledAt || item.status === 'CANCELLED') return t('productionReliability.cancelled');
    if (item.supersededBy || item.status === 'SUPERSEDED') return t('productionReliability.superseded');
    return t('productionReliability.active');
  }, [t]);

  const segmentsLabel = useCallback((item: any): string => {
    const segments = Array.isArray(item.segments) ? item.segments : [];
    return segments.length > 0 ? num(segments.length, 0, locale) : '—';
  }, [locale]);

  const breakdownRows = useMemo(() => summary?.breakdown, [summary]);

  if (!canRead) return <div><PageHeader title={t('productionReliability.title')} /><div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{t('productionReliability.permissionDenied')}</div></div>;

  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <PageHeader title={t('productionReliability.title')} subtitle={t('productionReliability.subtitle')} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={doExport} loading={exporting} disabled={!canExport || !applied}>{t('productionReliability.export')}</Button>
      </div>
    </div>

    <ChartCard title={t('productionReliability.filters')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input type="date" label={t('productionReliability.dateFrom')} value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
        <Input type="date" label={t('productionReliability.dateTo')} value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
        <F9Lookup label={t('productionReliability.selectMachine')} value={filters.machineId} adapter={machineAdapter} filters={filters.productionLineId ? { productionLineId: filters.productionLineId } : undefined} onChange={(value) => setFilters({ ...filters, machineId: value })} />
        <F9Lookup label={t('productionReliability.selectLine')} value={filters.productionLineId} adapter={productionLineAdapter} onChange={(value) => setFilters({ ...filters, productionLineId: value, machineId: '' })} />
        <F9Lookup label={t('productionReliability.selectOperationType')} value={filters.operationTypeId} adapter={operationTypeAdapter} onChange={(value) => setFilters({ ...filters, operationTypeId: value })} />
        <F9Lookup label={t('productionReliability.selectCostCenter')} value={filters.costCenterId} adapter={costCenterAdapter} onChange={(value) => setFilters({ ...filters, costCenterId: value })} />
        <div className="flex items-end gap-2">
          <Button onClick={apply} loading={loading}>{t('productionReliability.apply')}</Button>
          <Button variant="secondary" onClick={reset}>{t('productionReliability.reset')}</Button>
        </div>
      </div>
    </ChartCard>

    {applied ? (
      <div className="mt-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={t('productionReliability.mtbf')} value={num(metric('mtbf')?.mtbfHours, 1, locale)} hint={t('productionReliability.mtbfValue')} />
          <StatCard label={t('productionReliability.mttr')} value={num(metric('mttr')?.mttrHours, 1, locale)} hint={t('productionReliability.mttrValue')} />
          <StatCard label={t('productionReliability.totalDowntime')} value={hours(metric('totalDowntime')?.totalHours, locale, t('productionReliability.hoursUnit'))} hint={t('productionReliability.totalDowntimeValue')} />
          <StatCard label={t('productionReliability.availability')} value={pct(metric('availability')?.percent, locale)} hint={t('productionReliability.plannedMinutes')} />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={t('productionReliability.repeatFailureRate')} value={pct(metric('repeatFailureRate')?.repeatFailureRate, locale)} hint={t('productionReliability.repeatFailureRateValue')} />
          <StatCard label={t('productionReliability.emergencyResponseTime')} value={hours(metric('emergencyResponseTime')?.avgResponseTimeHours, locale, t('productionReliability.hoursUnit'))} hint={t('productionReliability.emergencyResponseTimeValue')} />
          <StatCard label={t('productionReliability.slaTimes')} value={hours(metric('slaTimes')?.avgResponseTimeHours, locale, t('productionReliability.hoursUnit'))} hint={t('productionReliability.slaTimesValue')} />
          <StatCard label={t('productionReliability.eventCount')} value={num(metric('totalDowntime')?.totalEvents, 0, locale)} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TableCard
            title={t('productionReliability.byMachine')}
            columns={[
              { header: t('productionReliability.machine'), render: (row) => row.machine?.code || row.machine?.name || '—' },
              { header: t('productionReliability.totalHours'), render: (row) => <span dir="ltr">{hours(row.totalHours, locale, t('productionReliability.hoursUnit'))}</span> },
              { header: t('productionReliability.eventCount'), render: (row) => String(row.eventCount) },
            ]}
            rows={breakdownRows?.byMachine?.items ?? []}
            keyExtractor={(row, index) => `${row.machine?.id || 'none'}-${index}`}
            emptyMessage={t('productionReliability.noData')}
          />
          <TableCard
            title={t('productionReliability.byProductionLine')}
            columns={[
              { header: t('productionReliability.productionLine'), render: (row) => row.productionLine?.code || row.productionLine?.name || '—' },
              { header: t('productionReliability.totalHours'), render: (row) => <span dir="ltr">{hours(row.totalHours, locale, t('productionReliability.hoursUnit'))}</span> },
              { header: t('productionReliability.eventCount'), render: (row) => String(row.eventCount) },
            ]}
            rows={breakdownRows?.byProductionLine?.items ?? []}
            keyExtractor={(row, index) => `${row.productionLine?.id || 'none'}-${index}`}
            emptyMessage={t('productionReliability.noData')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TableCard
            title={t('productionReliability.byCause')}
            columns={[
              { header: t('productionReliability.failureCause'), render: (row) => row.failureCause || '—' },
              { header: t('productionReliability.totalHours'), render: (row) => <span dir="ltr">{hours(row.totalHours, locale, t('productionReliability.hoursUnit'))}</span> },
              { header: t('productionReliability.eventCount'), render: (row) => String(row.eventCount) },
            ]}
            rows={breakdownRows?.byCause?.items ?? []}
            keyExtractor={(row, index) => `${row.failureCause || 'none'}-${index}`}
            emptyMessage={t('productionReliability.noData')}
          />
          <TableCard
            title={t('productionReliability.repeatFailures')}
            columns={[
              { header: t('productionReliability.reason'), render: (row) => row.reason || '—' },
              { header: t('productionReliability.durationHours'), render: (row) => <span dir="ltr">{hours(row.durationHours, locale, t('productionReliability.hoursUnit'))}</span> },
              { header: t('productionReliability.machine'), render: (row) => row.machine?.code || '—' },
            ]}
            rows={breakdownRows?.repeatFailures?.items ?? []}
            keyExtractor={(row, index) => `${row.id || index}`}
            emptyMessage={t('productionReliability.noData')}
          />
        </div>

        <ChartCard title={t('productionReliability.drilldown')} subtitle={drilldown ? `${num(drilldown.meta.total, 0, locale)} ${t('productionReliability.eventCount')}` : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('productionReliability.eventId')}</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('productionReliability.machine')}</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('productionReliability.startTime')}</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('productionReliability.endTime')}</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('productionReliability.linkedSegments')}</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('productionReliability.status')}</th>
                </tr>
              </thead>
              <tbody>
                {(drilldown?.data ?? []).map((row, index) => (
                  <tr key={`${row.id}-${index}`} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-200">{row.code || row.id}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{row.machine?.code || row.machine?.name || '—'}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200" dir="ltr">{row.startTime ? new Date(row.startTime).toLocaleString(numberLocale(locale)) : '—'}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200" dir="ltr">{row.endTime ? new Date(row.endTime).toLocaleString(numberLocale(locale)) : '—'}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{segmentsLabel(row)}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{eventStatusLabel(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!drilldown || (drilldown?.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">{t('productionReliability.noData')}</p>
            ) : null}
          </div>
        </ChartCard>

        <ChartCard title={t('productionReliability.normalizationTitle')}>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-gray-200">
            <li>{t('productionReliability.cancelledExcluded')}</li>
            <li>{t('productionReliability.supersededOriginalsExcluded')}</li>
            <li>{t('productionReliability.correctedReplacementCountedOnce')}</li>
            <li>{t('productionReliability.dedupByDowntimeLogId')}</li>
          </ul>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t('productionReliability.formulaFootnote')}</p>
        </ChartCard>
      </div>
    ) : (
      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700">
        {t('productionReliability.subtitle')}
      </div>
    )}
  </div>;
}
