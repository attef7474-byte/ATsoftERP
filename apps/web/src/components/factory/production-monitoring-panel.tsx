'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { F9Lookup } from '../f9/F9Lookup';
import { productionLineAdapter, machineAdapter } from '../f9/lookup-adapters';
import { useAuth, useOperationalContext } from '../../lib/auth-context';
import { useTranslation } from '../../lib/i18n/use-translation';
import { formatMonitoringQuantity, MonitoringOutput, MonitoringRow } from '../../lib/production-monitoring';
import { useProductionMonitoring } from '../../lib/use-production-monitoring';
import { AlertBanner, Button, ErrorState, Input, LoadingState, Select } from '../admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../admin/admin-action-bar';
function Output({
  values
}: {
  values: MonitoringOutput[] | null;
}) {
  const {
    t,
    locale
  } = useTranslation();
  if (values === null) return <span>{t('production.monitoring.noActiveShift')}</span>;
  if (!values.length) return <span dir="ltr">0</span>;
  return <div className="space-y-1" dir="ltr">{values.map(value => <div key={value.unit}>{formatMonitoringQuantity(value.quantity, locale)} {value.unit}</div>)}</div>;
}
function ResourceTable({
  title,
  rows,
  timezone,
  canReadRuns
}: {
  title: string;
  rows: MonitoringRow[];
  timezone: string;
  canReadRuns: boolean;
}) {
  const {
    t,
    locale
  } = useTranslation();
  const time = (value: string) => new Date(value).toLocaleString(locale, {
    timeZone: timezone
  });
  return <section className="rounded-lg border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <h2 className="mb-3 text-lg font-semibold">{title}</h2>
    {!rows.length ? <p className="text-sm text-gray-500">{t('common.noData')}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-start text-sm">
      <thead><tr className="border-b text-start text-gray-500">
        {['resource', 'line', 'operationType', 'status', 'currentProduct', 'currentRun', 'now', 'currentShift', 'today', 'monthToDate', 'lastEvent'].map(key => <th key={key} className="p-2 text-start">{t(`production.monitoring.${key}`)}</th>)}
      </tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b last:border-0">
        <td className="p-2"><Link className="text-blue-600 hover:underline" href={`/admin/production/analytics?tab=analytics${row.resourceType === 'LINE' ? `&productionLineId=${encodeURIComponent(row.id)}` : `&machineId=${encodeURIComponent(row.id)}`}`}>{row.code} · {row.name}</Link></td>
        <td className="p-2">{row.productionLine ? `${row.productionLine.code} · ${row.productionLine.name}` : '—'}</td>
        <td className="p-2">{row.operationType?.name || t('production.monitoring.UNCLASSIFIED')}</td>
        <td className="p-2"><span className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">{t(`production.monitoring.${row.status}`)}</span></td>
        <td className="p-2">{row.currentRuns.map(run => <div key={run.id}>{run.product.code} · {run.product.name}</div>)}</td>
        <td className="p-2">{row.currentRuns.map(run => <div key={run.id}>{canReadRuns ? <Link className="text-blue-600 hover:underline" href={`/admin/production/runs/${run.id}`}>{run.runNumber}</Link> : run.runNumber}</div>)}</td>
        <td className="p-2"><Output values={row.totals.now} /></td>
        <td className="p-2"><Output values={row.totals.currentShift} /></td>
        <td className="p-2"><Output values={row.totals.today} /></td>
        <td className="p-2"><Output values={row.totals.monthToDate} /></td>
        <td className="p-2">{row.lastEventAt ? time(row.lastEventAt) : '—'}</td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
export function ProductionMonitoringPanel() {
  const {
    t,
    locale
  } = useTranslation();
  const {
    permissions,
    isSuperAdmin,
    loading: authLoading
  } = useAuth();
  const {
    contextVersion
  } = useOperationalContext();
  const allowed = isSuperAdmin || Boolean(permissions?.permissions.includes('production-analytics:read'));
  const canReadRuns = isSuperAdmin || Boolean(permissions?.permissions.includes('production-run:read'));
  const [filters, setFilters] = useState({
    search: '',
    classification: '',
    productionLineId: '',
    machineId: '',
    operationTypeId: ''
  });
  const monitor = useProductionMonitoring(allowed, contextVersion, {
    productionLineId: filters.productionLineId,
    machineId: filters.machineId
  });
  useEffect(() => {
    setFilters({
      search: '',
      classification: '',
      productionLineId: '',
      machineId: '',
      operationTypeId: ''
    });
  }, [contextVersion]);
  const {
    exec
  } = useStableHandlers({
    refresh: monitor.refresh
  });
  useRegisterAdminActions(allowed ? [{
    id: 'refresh',
    labelKey: 'common.refresh',
    icon: <ActionRefreshIcon />,
    readOnly: true,
    onClick: () => exec('refresh')
  }] : []);
  const data = monitor.data;
  const visible = (row: MonitoringRow) => (!filters.classification || row.classification === filters.classification) && (!filters.productionLineId || (row.productionLine?.id || row.id) === filters.productionLineId) && (!filters.machineId || row.id === filters.machineId || data?.machines.some(machine => machine.id === filters.machineId && machine.productionLine?.id === row.id)) && (!filters.operationTypeId || row.operationType?.id === filters.operationTypeId) && (!filters.search || `${row.code} ${row.name}`.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()));
  const operations = useMemo(() => [...new Map([...(data?.lines || []), ...(data?.machines || [])].filter(row => row.operationType).map(row => [row.operationType!.id, row.operationType!])).values()], [data]);
  const scopeFields = <>
    <F9Lookup label={t('production.monitoring.line')} adapter={productionLineAdapter} value={filters.productionLineId} onChange={productionLineId => setFilters({
      ...filters,
      productionLineId,
      machineId: ''
    })} />
    <F9Lookup label={t('production.monitoring.machine')} adapter={machineAdapter} filters={filters.productionLineId ? {
      productionLineId: filters.productionLineId
    } : {}} value={filters.machineId} onChange={machineId => setFilters({
      ...filters,
      machineId
    })} />
  </>;
  if (authLoading || permissions === null) return <LoadingState />;
  if (!allowed) return <AlertBanner type="error" message={t('errors.forbidden')} />;
  if (!data) return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2">{scopeFields}</div>{monitor.error ? <ErrorState message={monitor.error} onRetry={() => void monitor.refresh()} /> : <LoadingState />}</div>;
  const time = (value: string) => new Date(value).toLocaleString(locale, {
    timeZone: data.timezone
  });
  const shift = data.windows.currentShift;
  const groups = [{
    title: 'manufacturingLines',
    rows: data.lines.filter(row => row.classification === 'MANUFACTURING')
  }, {
    title: 'packagingLines',
    rows: data.lines.filter(row => row.classification === 'PACKAGING')
  }, {
    title: 'packagingMachines',
    rows: data.machines.filter(row => row.classification === 'PACKAGING')
  }, {
    title: 'otherLines',
    rows: data.lines.filter(row => row.classification === 'UNCLASSIFIED')
  }, {
    title: 'otherMachines',
    rows: data.machines.filter(row => row.classification !== 'PACKAGING')
  }];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <p>{t('production.monitoring.lastUpdated')} {time(data.generatedAt)} ({data.timezone})</p>
      <label className="flex items-center gap-2"><input type="checkbox" checked={monitor.autoRefresh} onChange={event => monitor.setAutoRefresh(event.target.checked)} />{t('production.monitoring.autoRefresh')}</label>
      <Button variant="secondary" onClick={() => void monitor.refresh()} loading={monitor.loading}>{t('common.refresh')}</Button>
    </div>
    {monitor.error && <AlertBanner type="warning" message={`${t('production.monitoring.stale')} ${monitor.error}`} />}
    {data.dataQuality.inaccessibleMachineRuns > 0 && <AlertBanner type="warning" message={t('production.monitoring.unavailableMachine')} />}
    <p className="text-sm text-gray-500">{shift ? `${t('production.monitoring.currentShift')} · ${shift.shiftCode} · ${shift.shiftName} · ${time(shift.from)} — ${time(shift.to)}` : t('production.monitoring.noActiveShift')}</p>
    {data.dataQuality.ambiguousShift && <AlertBanner type="warning" message={t('production.monitoring.ambiguousShift')} />}
    {data.dataQuality.multipleActiveResources > 0 && <AlertBanner type="info" message={t('production.monitoring.multipleActiveRuns')} />}
    <section className="overflow-x-auto rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-3 text-lg font-semibold">{t('production.monitoring.factorySummary')}</h2>
      <table className="w-full text-sm"><thead><tr>{['classification', 'now', 'currentShift', 'today', 'monthToDate'].map(key => <th key={key} className="p-2 text-start">{t(`production.monitoring.${key}`)}</th>)}</tr></thead><tbody>
        {data.summary.map(summary => <tr key={summary.classification}><td className="p-2">{t(`production.monitoring.${summary.classification}`)}</td><td className="p-2"><Output values={summary.totals.now} /></td><td className="p-2"><Output values={summary.totals.currentShift} /></td><td className="p-2"><Output values={summary.totals.today} /></td><td className="p-2"><Output values={summary.totals.monthToDate} /></td></tr>)}
        {!data.summary.length && <tr><td colSpan={5} className="p-4 text-gray-500">{t('common.noData')}</td></tr>}
      </tbody></table>
    </section>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {scopeFields}
      <Input label={t('common.search')} value={filters.search} onChange={event => setFilters({
        ...filters,
        search: event.target.value
      })} />
      <Select label={t('production.monitoring.classification')} placeholder={t('common.all')} value={filters.classification} options={['MANUFACTURING', 'PACKAGING', 'UNCLASSIFIED'].map(value => ({
        value,
        label: t(`production.monitoring.${value}`)
      }))} onChange={event => setFilters({
        ...filters,
        classification: event.target.value
      })} />
      <Select label={t('production.monitoring.operationType')} placeholder={t('common.all')} value={filters.operationTypeId} options={operations.map(operation => ({
        value: operation.id,
        label: `${operation.code} · ${operation.name}`
      }))} onChange={event => setFilters({
        ...filters,
        operationTypeId: event.target.value
      })} />
    </div>
    {groups.map(group => <ResourceTable key={group.title} title={t(`production.monitoring.${group.title}`)} rows={group.rows.filter(visible)} timezone={data.timezone} canReadRuns={canReadRuns} />)}
    <section className="rounded-lg border p-4"><h2 className="mb-2 font-semibold">{t('production.monitoring.unassignedToMachine')}</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{(['now', 'currentShift', 'today', 'monthToDate'] as const).map(key => <div key={key}><p className="mb-1 text-sm text-gray-500">{t(`production.monitoring.${key}`)}</p><Output values={data.dataQuality.unassignedToMachine[key]} /></div>)}</div></section>
  </div>;
}
