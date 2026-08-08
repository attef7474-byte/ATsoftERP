'use client';

import React, { useCallback, useState } from 'react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { Button, Input, PageHeader } from '../../../../components/admin/ui';
import { ChartCard } from '../../../../components/admin/charts/chart-card';
import { F9Lookup } from '../../../../components/f9/F9Lookup';
import { machineAdapter, productionLineAdapter } from '../../../../components/f9/lookup-adapters';

type Filters = { dateFrom: string; dateTo: string; productionLineId: string; machineId: string };
type Query = { dateFrom: string; dateTo: string; productionLineId?: string; machineId?: string };

type Factor = { percent: string | null; numerator: string; denominator: string; blockers?: string[] } | null;

type OperationsOverview = {
  formulaVersion: string;
  cardinality: { strategy: string; rule: string; cache: string };
  summary: {
    runCount: number;
    plannedMinutes: string;
    operatingMinutes: string;
    totalOutput: string;
    goodOutput: string;
    factors: { availability: Factor; performance: Factor; quality: Factor; oee: Factor };
    reliability: {
      mtbf: { mtbfHours?: number | string; metadata?: { formulaVersion?: string } };
      mttr: { mttrHours?: number | string; metadata?: { formulaVersion?: string } };
      totalDowntime: { totalHours?: number | string; totalEvents?: number; metadata?: { formulaVersion?: string } };
    };
    operationalCost: { totalAmount: string; transactionCount: number; currencyCode: string };
  };
  breakdowns: {
    downtimeByMachine: { items: Array<any> };
    costByEventType: Array<any>;
  };
  sourceLineage: Array<{ section: string; authority: string; formulaVersion?: string | null }>;
};

type OperationsDrilldown = {
  oeeFormulaVersion: string;
  data: Array<any>;
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const initialFilters = (): Filters => {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
    productionLineId: '',
    machineId: '',
  };
};

const toQuery = (filters: Filters): Query => ({
  dateFrom: filters.dateFrom,
  dateTo: filters.dateTo,
  productionLineId: filters.productionLineId || undefined,
  machineId: filters.machineId || undefined,
});

const localeName = (locale: 'ar' | 'en') => locale === 'ar' ? 'ar-EG' : 'en-US';
const number = (value: unknown, locale: 'ar' | 'en', digits = 1) =>
  value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString(localeName(locale), { maximumFractionDigits: digits });
const percent = (factor: Factor, locale: 'ar' | 'en') => factor?.percent === null || factor?.percent === undefined ? '—' : `${number(factor.percent, locale, 1)}%`;

function statusKey(status: string): string {
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-50" dir="ltr">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  );
}

export default function OperationsReportPage() {
  const { t, locale } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const canRead = isSuperAdmin || Boolean(permissions?.permissions.includes('reports.operations:read'));
  const canExport = isSuperAdmin || Boolean(permissions?.permissions.includes('reports.operations:export'));

  const [filters, setFilters] = useState<Filters>(initialFilters());
  const [applied, setApplied] = useState<Query | null>(null);
  const [overview, setOverview] = useState<OperationsOverview | null>(null);
  const [drilldown, setDrilldown] = useState<OperationsDrilldown | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadPage = useCallback(async (base: Query, page: number) => {
    const result = await api.get<OperationsDrilldown>('/reports/operations/drilldown', { params: { ...base, page, limit: 20 } });
    setDrilldown(result);
  }, []);

  const apply = useCallback(async () => {
    const next = toQuery(filters);
    if (next.dateTo < next.dateFrom) {
      showToast(t('operationsReports.invalidWindow'), 'error');
      return;
    }
    const from = new Date(`${next.dateFrom}T00:00:00.000Z`);
    const to = new Date(`${next.dateTo}T23:59:59.999Z`);
    if ((to.getTime() - from.getTime()) / 86400000 > 366) {
      showToast(t('operationsReports.windowTooLarge'), 'error');
      return;
    }
    setLoading(true);
    try {
      const [summary, details] = await Promise.all([
        api.get<OperationsOverview>('/reports/operations/overview', { params: next }),
        api.get<OperationsDrilldown>('/reports/operations/drilldown', { params: { ...next, page: 1, limit: 20 } }),
      ]);
      setApplied(next);
      setOverview(summary);
      setDrilldown(details);
    } catch (error) {
      setOverview(null);
      setDrilldown(null);
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  }, [filters, handleApiError, showToast, t]);

  const reset = useCallback(() => {
    setFilters(initialFilters());
    setApplied(null);
    setOverview(null);
    setDrilldown(null);
  }, []);

  const changePage = useCallback(async (page: number) => {
    if (!applied) return;
    setLoading(true);
    try { await loadPage(applied, page); }
    catch (error) { handleApiError(error); }
    finally { setLoading(false); }
  }, [applied, handleApiError, loadPage]);

  const exportCsv = useCallback(async () => {
    if (!applied) {
      showToast(t('operationsReports.applyFirst'), 'error');
      return;
    }
    if (!canExport) return;
    setExporting(true);
    try {
      const result = await api.post<{ csv: string; truncated: boolean }>('/reports/operations/export', applied);
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `operations_${applied.dateFrom}_${applied.dateTo}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(t(result.truncated ? 'operationsReports.exportTruncated' : 'operationsReports.exported'), result.truncated ? 'error' : 'success');
    } catch (error) { handleApiError(error); }
    finally { setExporting(false); }
  }, [applied, canExport, handleApiError, showToast, t]);

  const money = useCallback((amount: string, currency: string) => new Intl.NumberFormat(localeName(locale), {
    style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2,
  }).format(Number(amount || 0)), [locale]);

  if (!canRead) {
    return <div><PageHeader title={t('operationsReports.title')} /><div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{t('operationsReports.permissionDenied')}</div></div>;
  }

  const summary = overview?.summary;
  const runs = drilldown?.data ?? [];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <PageHeader title={t('operationsReports.title')} subtitle={t('operationsReports.subtitle')} />
      <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={!canExport || !applied}>{t('operationsReports.export')}</Button>
    </div>

    <ChartCard title={t('operationsReports.filters')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input type="date" label={t('operationsReports.dateFrom')} value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} />
        <Input type="date" label={t('operationsReports.dateTo')} value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} />
        <F9Lookup label={t('operationsReports.productionLine')} value={filters.productionLineId} adapter={productionLineAdapter} onChange={(value) => setFilters({ ...filters, productionLineId: value, machineId: '' })} />
        <F9Lookup label={t('operationsReports.machine')} value={filters.machineId} adapter={machineAdapter} filters={filters.productionLineId ? { productionLineId: filters.productionLineId } : undefined} onChange={(value) => setFilters({ ...filters, machineId: value })} />
        <div className="flex items-end gap-2">
          <Button onClick={apply} loading={loading}>{t('operationsReports.apply')}</Button>
          <Button variant="secondary" onClick={reset}>{t('operationsReports.reset')}</Button>
        </div>
      </div>
    </ChartCard>

    {overview && summary ? <>
      <section aria-labelledby="operations-summary-title">
        <h2 id="operations-summary-title" className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-50">{t('operationsReports.summary')}</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label={t('operationsReports.oee')} value={percent(summary.factors.oee, locale)} hint={drilldown?.oeeFormulaVersion} />
          <Stat label={t('operationsReports.availability')} value={percent(summary.factors.availability, locale)} hint={`${number(summary.factors.availability?.numerator, locale, 0)} / ${number(summary.factors.availability?.denominator, locale, 0)}`} />
          <Stat label={t('operationsReports.performance')} value={percent(summary.factors.performance, locale)} />
          <Stat label={t('operationsReports.quality')} value={percent(summary.factors.quality, locale)} />
          <Stat label={t('operationsReports.runCount')} value={number(summary.runCount, locale, 0)} />
          <Stat label={t('operationsReports.mtbf')} value={`${number(summary.reliability.mtbf?.mtbfHours, locale)} ${t('operationsReports.hoursUnit')}`} />
          <Stat label={t('operationsReports.totalDowntime')} value={`${number(summary.reliability.totalDowntime?.totalHours, locale)} ${t('operationsReports.hoursUnit')}`} hint={`${number(summary.reliability.totalDowntime?.totalEvents, locale, 0)} ${t('operationsReports.events')}`} />
          <Stat label={t('operationsReports.operationalCost')} value={money(summary.operationalCost.totalAmount, summary.operationalCost.currencyCode)} hint={`${number(summary.operationalCost.transactionCount, locale, 0)} ${t('operationsReports.transactions')}`} />
        </div>
      </section>

      <ChartCard title={t('operationsReports.runs')} subtitle={`${number(drilldown?.meta.total ?? 0, locale, 0)} ${t('operationsReports.runCount')}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 dark:border-gray-700">
              {[t('operationsReports.run'), t('operationsReports.status'), t('operationsReports.productionLine'), t('operationsReports.machine'), t('operationsReports.product'), t('operationsReports.startedAt'), t('operationsReports.plannedMinutes'), t('operationsReports.operatingMinutes'), t('operationsReports.output'), t('operationsReports.goodOutput'), t('operationsReports.oee')].map((heading) => <th key={heading} scope="col" className="px-3 py-2 text-start text-xs font-semibold text-gray-500">{heading}</th>)}
            </tr></thead>
            <tbody>{runs.map((run) => <tr key={run.productionRunId} className="border-b border-gray-100 dark:border-gray-800">
              <td className="px-3 py-2 font-medium">{run.runNumber}</td>
              <td className="px-3 py-2">{t(statusKey(run.status))}</td>
              <td className="px-3 py-2">{run.productionLineCode || '—'}</td>
              <td className="px-3 py-2">{run.machineCode || '—'}</td>
              <td className="px-3 py-2">{run.productCode || run.productName || '—'}</td>
              <td className="px-3 py-2" dir="ltr">{run.startedAt ? new Date(run.startedAt).toLocaleString(localeName(locale)) : '—'}</td>
              <td className="px-3 py-2" dir="ltr">{number(run.metrics?.plannedMinutes, locale)}</td>
              <td className="px-3 py-2" dir="ltr">{number(run.metrics?.operatingMinutes, locale)}</td>
              <td className="px-3 py-2" dir="ltr">{number(run.metrics?.totalOutput, locale)}</td>
              <td className="px-3 py-2" dir="ltr">{number(run.metrics?.goodOutput, locale)}</td>
              <td className="px-3 py-2" dir="ltr">{percent(run.metrics?.oee ?? null, locale)}</td>
            </tr>)}</tbody>
          </table>
          {runs.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">{t('operationsReports.noData')}</p> : null}
        </div>
        {drilldown && drilldown.meta.totalPages > 1 ? <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="secondary" size="sm" disabled={loading || drilldown.meta.page <= 1} onClick={() => changePage(drilldown.meta.page - 1)}>{t('operationsReports.previous')}</Button>
          <span className="text-sm text-gray-600">{t('operationsReports.page')} {number(drilldown.meta.page, locale, 0)} {t('operationsReports.of')} {number(drilldown.meta.totalPages, locale, 0)}</span>
          <Button variant="secondary" size="sm" disabled={loading || drilldown.meta.page >= drilldown.meta.totalPages} onClick={() => changePage(drilldown.meta.page + 1)}>{t('operationsReports.next')}</Button>
        </div> : null}
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title={t('operationsReports.costByEvent')}>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="px-3 py-2 text-start">{t('operationsReports.eventType')}</th><th className="px-3 py-2 text-start">{t('operationsReports.amount')}</th><th className="px-3 py-2 text-start">{t('operationsReports.transactions')}</th></tr></thead><tbody>
            {(overview.breakdowns.costByEventType ?? []).map((item) => <tr key={item.eventType} className="border-b"><td className="px-3 py-2">{t(costEventKey(item.eventType))}</td><td className="px-3 py-2" dir="ltr">{money(item.amount, summary.operationalCost.currencyCode)}</td><td className="px-3 py-2">{number(item.count, locale, 0)}</td></tr>)}
          </tbody></table>{(overview.breakdowns.costByEventType ?? []).length === 0 ? <p className="py-6 text-center text-sm text-gray-500">{t('operationsReports.noData')}</p> : null}</div>
        </ChartCard>
        <ChartCard title={t('operationsReports.downtimeByMachine')}>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="px-3 py-2 text-start">{t('operationsReports.machine')}</th><th className="px-3 py-2 text-start">{t('operationsReports.totalDowntime')}</th><th className="px-3 py-2 text-start">{t('operationsReports.events')}</th></tr></thead><tbody>
            {(overview.breakdowns.downtimeByMachine?.items ?? []).map((item, index) => <tr key={`${item.machine?.id ?? 'none'}-${index}`} className="border-b"><td className="px-3 py-2">{item.machine?.code || item.machine?.name || '—'}</td><td className="px-3 py-2" dir="ltr">{number(item.totalHours, locale)} {t('operationsReports.hoursUnit')}</td><td className="px-3 py-2">{number(item.eventCount, locale, 0)}</td></tr>)}
          </tbody></table>{(overview.breakdowns.downtimeByMachine?.items ?? []).length === 0 ? <p className="py-6 text-center text-sm text-gray-500">{t('operationsReports.noData')}</p> : null}</div>
        </ChartCard>
      </div>

      <ChartCard title={t('operationsReports.lineage')} subtitle={t('operationsReports.liveNoCache')}>
        <p className="text-sm text-gray-700 dark:text-gray-200">{t('operationsReports.lineageText')}</p>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <div><dt className="font-medium">{t('operationsReports.reportFormula')}</dt><dd dir="ltr">{overview.formulaVersion}</dd></div>
          <div><dt className="font-medium">{t('operationsReports.oeeAuthority')}</dt><dd dir="ltr">{drilldown?.oeeFormulaVersion || '—'}</dd></div>
        </dl>
      </ChartCard>
    </> : applied && !loading ? <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">{t('operationsReports.noData')}</div> : null}
  </div>;
}
