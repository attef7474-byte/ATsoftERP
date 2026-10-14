'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { PageHeader, Card, Select, Input, Button, DataTable, Pagination } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, sparePartAdapter, productionLineAdapter } from '../../../../../components/f9';
import { Modal } from '../../../../../components/admin/ui/modal';

interface DurationValue { state: 'OK' | 'UNKNOWN' | 'INVALID'; ms: number | null; }
interface ExpectedLife {
  configured: boolean;
  unit: string | null;
  progress: number | null;
  consumedPercent: number | null;
  remainingMs: number | null;
  remainingReading: number | null;
  totalMs: number | null;
  band: string;
}
interface ReliabilityRow {
  key: string;
  machine: { id: string; code: string; name: string };
  productionLine: { id: string; code: string; name: string } | null;
  machineComponent: { id: string; code: string; name: string } | null;
  sparePart: { id: string; code: string; name: string; partNumber: string | null; manufacturer: string | null; isCritical: boolean; unit: string | null };
  current: {
    id: string; status: string; installedAt: string | null; installedQuantity: number;
    serialNumber: string | null; installedCondition: string; serviceLife: DurationValue; expectedLife: ExpectedLife;
  } | null;
  lastFailureAt: string | null;
  replacementCount: number;
  failureEventCount: number;
  prematureFailureCount: number;
  repeatedEarlyFailure: boolean;
  mtbf: { status: string; mtbfDays: number | null; eventCount: number };
  mttr: { status: string; mttrHours: number | null; samples: number };
}
interface SummaryData {
  populations: number; activeInstalledParts: number; nearExpectedEnd: number; overdueParts: number;
  prematureFailures: number; hasExpectedLifeData: boolean;
  mostReplaced: { machine: { code: string; name: string }; sparePart: { code: string; name: string }; replacementCount: number }[];
  machinesWithMostFailures: { machine: { code: string; name: string }; sparePart: { code: string; name: string }; failureEventCount: number }[];
}
interface DataQuality {
  installedPartsTotal: number; withInstalledAt: number; withoutInstalledAt: number;
  removedWithRemovedAt: number; removedMissingRemovedAt: number; replacementEvents: number;
  failureClassifiedEvents: number; preventiveReplacementEvents: number;
  withExpectedLife: number; withoutExpectedLife: number; linkedExecutions: number; linkedClassifiedDowntime: number;
}
interface TimelineEntry {
  instance: { id: string; status: string; installedAt: string | null; removedAt: string | null; installedCondition: string; removedCondition: string | null; serialNumber: string | null; installedQuantity: number };
  serviceLife: DurationValue;
  expectedLife: ExpectedLife;
  classification: string;
  request: { requestNumber: string; title: string } | null;
  usages: { usageType: string; usedAt: string; execution: { title: string } | null }[];
  replacements: { replacementNumber: string; replacementAction: string; replacedAt: string }[];
}
interface DetailData {
  machine: { id: string; code: string; name: string } | null;
  sparePart: { id: string; code: string; name: string } | null;
  timeline: TimelineEntry[];
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const STATUS_OPTIONS = ['ACTIVE', 'REMOVED', 'REPLACED', 'FAILED', 'RETIRED', 'DECOMMISSIONED'];
const LIFE_STATUS_OPTIONS = ['UNKNOWN', 'NORMAL', 'WARNING', 'DUE', 'EXPIRED'];

export default function InstalledPartReliabilityPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ReliabilityRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [dq, setDq] = useState<DataQuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [machineId, setMachineId] = useState('');
  const [sparePartId, setSparePartId] = useState('');
  const [productionLineId, setProductionLineId] = useState('');
  const [status, setStatus] = useState('');
  const [lifeStatus, setLifeStatus] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [isCritical, setIsCritical] = useState(false);
  const [onlyEarlyFailure, setOnlyEarlyFailure] = useState(false);
  const [onlyApproachingEol, setOnlyApproachingEol] = useState(false);
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const buildParams = useCallback((forPage = page): Record<string, string> => {
    const p: Record<string, string> = { page: String(forPage), limit: String(meta.limit) };
    if (machineId) p.machineId = machineId;
    if (sparePartId) p.sparePartId = sparePartId;
    if (productionLineId) p.productionLineId = productionLineId;
    if (status) p.status = status;
    if (lifeStatus) p.lifeStatus = lifeStatus;
    if (manufacturer) p.manufacturer = manufacturer;
    if (isCritical) p.isCritical = 'true';
    if (onlyEarlyFailure) p.onlyEarlyFailure = 'true';
    if (onlyApproachingEol) p.onlyApproachingEol = 'true';
    return p;
  }, [page, meta.limit, machineId, sparePartId, productionLineId, status, lifeStatus, manufacturer, isCritical, onlyEarlyFailure, onlyApproachingEol]);

  const fetchAll = useCallback(async (forPage = page) => {
    setLoading(true);
    setError('');
    const params = buildParams(forPage);
    try {
      const [list, sum, quality] = await Promise.all([
        api.get<{ data: ReliabilityRow[]; meta: typeof meta }>('/maintenance/reliability/installed-parts', { params }),
        api.get<SummaryData>('/maintenance/reliability/installed-parts/summary', { params }),
        api.get<DataQuality>('/maintenance/reliability/installed-parts/data-quality', { params }),
      ]);
      setRows(list.data);
      setMeta(list.meta);
      setSummary(sum);
      setDq(quality);
    } catch (err: any) {
      setError(err?.message || t('maintenance.iprLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [buildParams, page, t]);

  const { exec } = useStableHandlers({ refresh: () => fetchAll(page) });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  useEffect(() => { fetchAll(page); }, [page, machineId, sparePartId, productionLineId, status, lifeStatus, isCritical, onlyEarlyFailure, onlyApproachingEol]);

  const openDetail = async (row: ReliabilityRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    try {
      const data = await api.get<DetailData>(`/maintenance/reliability/installed-parts/${row.machine.id}/${row.sparePart.id}`);
      setDetail(data);
    } catch (err: any) {
      setDetailError(err?.message || t('maintenance.iprDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const clearFilters = () => {
    setMachineId(''); setSparePartId(''); setProductionLineId(''); setStatus(''); setLifeStatus('');
    setManufacturer(''); setIsCritical(false); setOnlyEarlyFailure(false); setOnlyApproachingEol(false); setPage(1);
  };

  const fmtDuration = (v: DurationValue | undefined | null): string => {
    if (!v) return '-';
    if (v.state === 'UNKNOWN') return t('maintenance.iprUnknown');
    if (v.state === 'INVALID') return t('maintenance.iprInvalid');
    if (v.ms === null) return t('maintenance.iprInsufficient');
    const days = v.ms / DAY_MS;
    if (days >= 1) return `${days.toFixed(1)} ${t('maintenance.iprUnitDays')}`;
    return `${(v.ms / HOUR_MS).toFixed(1)} ${t('maintenance.iprUnitHours')}`;
  };

  const fmtExpected = (e: ExpectedLife | null): string => {
    if (!e || !e.configured) return t('maintenance.iprNotConfigured');
    if (e.consumedPercent === null) return t('maintenance.iprInsufficient');
    return `${e.consumedPercent}%`;
  };

  const fmtDate = (v: string | null): string => (v ? new Date(v).toLocaleDateString() : '-');
  const statusLabel = (s: string) => t(`maintenance.iprStatus${s}`);
  const bandLabel = (b: string) => t(`maintenance.iprBand${b}`);
  const yesNo = (b: boolean) => (b ? t('maintenance.iprYes') : t('maintenance.iprNo'));

  const columns = [
    { key: 'machine', header: t('maintenance.iprColMachine'), render: (r: ReliabilityRow) => `${r.machine.code} - ${r.machine.name}` },
    { key: 'component', header: t('maintenance.iprColComponent'), render: (r: ReliabilityRow) => (r.machineComponent ? `${r.machineComponent.code} - ${r.machineComponent.name}` : '-') },
    { key: 'sparePart', header: t('maintenance.iprColSparePart'), render: (r: ReliabilityRow) => `${r.sparePart.code} - ${r.sparePart.name}` },
    { key: 'status', header: t('maintenance.iprColStatus'), render: (r: ReliabilityRow) => (r.current ? statusLabel(r.current.status) : '-') },
    { key: 'installedAt', header: t('maintenance.iprColInstalledAt'), render: (r: ReliabilityRow) => fmtDate(r.current?.installedAt ?? null) },
    { key: 'serviceLife', header: t('maintenance.iprColServiceLife'), render: (r: ReliabilityRow) => fmtDuration(r.current?.serviceLife) },
    { key: 'expectedLife', header: t('maintenance.iprColExpectedLife'), render: (r: ReliabilityRow) => fmtExpected(r.current?.expectedLife ?? null) },
    { key: 'lifeBand', header: t('maintenance.iprColLifeBand'), render: (r: ReliabilityRow) => bandLabel(r.current?.expectedLife.band ?? 'UNKNOWN') },
    { key: 'lastFailureAt', header: t('maintenance.iprColLastFailure'), render: (r: ReliabilityRow) => fmtDate(r.lastFailureAt) },
    { key: 'replacements', header: t('maintenance.iprColReplacements'), render: (r: ReliabilityRow) => String(r.replacementCount) },
    { key: 'failures', header: t('maintenance.iprColFailures'), render: (r: ReliabilityRow) => String(r.failureEventCount) },
    { key: 'premature', header: t('maintenance.iprColPremature'), render: (r: ReliabilityRow) => String(r.prematureFailureCount) },
    { key: 'mtbf', header: t('maintenance.iprColMtbf'), render: (r: ReliabilityRow) => (r.mtbf.status === 'OK' ? `${r.mtbf.mtbfDays} ${t('maintenance.iprUnitDays')}` : t('maintenance.iprInsufficient')) },
    { key: 'mttr', header: t('maintenance.iprColMttr'), render: (r: ReliabilityRow) => (r.mttr.status === 'OK' ? `${r.mttr.mttrHours} ${t('maintenance.iprUnitHours')}` : t('maintenance.iprInsufficient')) },
    { key: 'repeated', header: t('maintenance.iprColRepeatedEarlyFailure'), render: (r: ReliabilityRow) => yesNo(r.repeatedEarlyFailure) },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.installedPartReliability')} subtitle={t('maintenance.iprSubtitle')} />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => fetchAll(page)} className="ms-2 underline">{t('common.retry')}</button>
        </div>
      )}

      <Card className="p-4 mb-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">{t('maintenance.iprFilters')}</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <F9Lookup label={t('maintenance.iprMachine')} value={machineId} onChange={(v) => { setMachineId(v || ''); setPage(1); }} adapter={machineAdapter} />
          <F9Lookup label={t('maintenance.iprSparePart')} value={sparePartId} onChange={(v) => { setSparePartId(v || ''); setPage(1); }} adapter={sparePartAdapter} />
          <F9Lookup label={t('maintenance.iprProductionLine')} value={productionLineId} onChange={(v) => { setProductionLineId(v || ''); setPage(1); }} adapter={productionLineAdapter} />
          <Select label={t('maintenance.iprInstanceStatus')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder={t('common.all')}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabel(s) }))} />
          <Select label={t('maintenance.iprLifeStatus')} value={lifeStatus} onChange={(e) => { setLifeStatus(e.target.value); setPage(1); }} placeholder={t('common.all')}
            options={LIFE_STATUS_OPTIONS.map((s) => ({ value: s, label: bandLabel(s) }))} />
          <Input label={t('maintenance.iprManufacturer')} value={manufacturer} onChange={(e) => { setManufacturer(e.target.value); setPage(1); }} />
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isCritical} onChange={(e) => { setIsCritical(e.target.checked); setPage(1); }} />
            {t('maintenance.iprCriticalOnly')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={onlyEarlyFailure} onChange={(e) => { setOnlyEarlyFailure(e.target.checked); setPage(1); }} />
            {t('maintenance.iprEarlyFailureOnly')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={onlyApproachingEol} onChange={(e) => { setOnlyApproachingEol(e.target.checked); setPage(1); }} />
            {t('maintenance.iprApproachingEolOnly')}
          </label>
          <Button variant="secondary" size="sm" onClick={clearFilters}>{t('maintenance.iprClear')}</Button>
        </div>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{summary.populations}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.iprPopulations')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{summary.activeInstalledParts}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.iprActiveParts')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{summary.hasExpectedLifeData ? summary.nearExpectedEnd : t('maintenance.iprInsufficient')}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.iprNearExpectedEnd')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{summary.hasExpectedLifeData ? summary.overdueParts : t('maintenance.iprInsufficient')}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.iprOverdueParts')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{summary.prematureFailures}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.iprPrematureFailures')}</div>
          </Card>
        </div>
      )}

      <Card className="mb-4 overflow-hidden">
        <DataTable<ReliabilityRow> columns={columns} data={rows} keyExtractor={(r) => r.key} loading={loading} emptyMessage={t('maintenance.iprEmpty')} onRowClick={openDetail} />
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
      </Card>

      {(summary?.mostReplaced?.length || summary?.machinesWithMostFailures?.length) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card className="p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">{t('maintenance.iprMostReplaced')}</div>
            {summary?.mostReplaced?.length ? (
              <ul className="text-sm text-gray-700 space-y-1">
                {summary.mostReplaced.map((m, i) => (
                  <li key={i} className="flex justify-between"><span>{m.machine.name} / {m.sparePart.name}</span><span className="font-medium">{m.replacementCount}</span></li>
                ))}
              </ul>
            ) : <div className="text-sm text-gray-400">{t('maintenance.iprNoData')}</div>}
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">{t('maintenance.iprMachinesWithMostFailures')}</div>
            {summary?.machinesWithMostFailures?.length ? (
              <ul className="text-sm text-gray-700 space-y-1">
                {summary.machinesWithMostFailures.map((m, i) => (
                  <li key={i} className="flex justify-between"><span>{m.machine.name} / {m.sparePart.name}</span><span className="font-medium">{m.failureEventCount}</span></li>
                ))}
              </ul>
            ) : <div className="text-sm text-gray-400">{t('maintenance.iprNoData')}</div>}
          </Card>
        </div>
      ) : null}

      {dq && (
        <Card className="p-4 mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">{t('maintenance.iprDataQuality')}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-700">
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.iprDqInstalledTotal')}</span><span className="font-medium">{dq.installedPartsTotal}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.iprDqWithoutInstalledAt')}</span><span className="font-medium">{dq.withoutInstalledAt}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.iprDqRemovedMissingRemovedAt')}</span><span className="font-medium">{dq.removedMissingRemovedAt}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.iprDqReplacementEvents')}</span><span className="font-medium">{dq.replacementEvents}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.iprDqFailureClassified')}</span><span className="font-medium">{dq.failureClassifiedEvents}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.iprDqPreventiveReplacements')}</span><span className="font-medium">{dq.preventiveReplacementEvents}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.iprDqWithExpectedLife')}</span><span className="font-medium">{dq.withExpectedLife}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.iprDqWithoutExpectedLife')}</span><span className="font-medium">{dq.withoutExpectedLife}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.iprDqLinkedExecutions')}</span><span className="font-medium">{dq.linkedExecutions}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.iprDqLinkedDowntime')}</span><span className="font-medium">{dq.linkedClassifiedDowntime}</span></div>
          </div>
          <p className="mt-3 text-xs text-gray-400">{t('maintenance.iprDqNote')}</p>
        </Card>
      )}

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={t('maintenance.iprDetail')} size="xl">
        {detailLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">{t('common.loading')}</div>
        ) : detailError ? (
          <div className="py-8 text-center text-sm text-red-600">{detailError}</div>
        ) : detail ? (
          <div>
            <div className="mb-4 text-sm font-medium text-gray-800">
              {detail.machine ? `${detail.machine.code} - ${detail.machine.name}` : ''} / {detail.sparePart ? `${detail.sparePart.code} - ${detail.sparePart.name}` : ''}
            </div>
            <div className="text-sm font-semibold text-gray-700 mb-2">{t('maintenance.iprTimeline')}</div>
            {detail.timeline.length === 0 ? (
              <div className="text-sm text-gray-400">{t('maintenance.iprNoEvents')}</div>
            ) : (
              <div className="space-y-3">
                {detail.timeline.map((entry) => (
                  <div key={entry.instance.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-800">{statusLabel(entry.instance.status)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${entry.classification === 'FAILURE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                        {entry.classification === 'FAILURE' ? t('maintenance.iprFailure') : t('maintenance.iprNonFailure')}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
                      <div><span className="text-gray-400">{t('maintenance.iprInstalledAt')}: </span>{fmtDate(entry.instance.installedAt)}</div>
                      <div><span className="text-gray-400">{t('maintenance.iprRemovedAt')}: </span>{fmtDate(entry.instance.removedAt)}</div>
                      <div><span className="text-gray-400">{t('maintenance.iprServiceLife')}: </span>{fmtDuration(entry.serviceLife)}</div>
                      <div><span className="text-gray-400">{t('maintenance.iprExpectedLife')}: </span>{fmtExpected(entry.expectedLife)}</div>
                      <div><span className="text-gray-400">{t('maintenance.iprCondition')}: </span>{entry.instance.installedCondition}{entry.instance.removedCondition ? ` / ${entry.instance.removedCondition}` : ''}</div>
                    </div>
                    {entry.request && (
                      <div className="mt-2 text-xs text-gray-600"><span className="text-gray-400">{t('maintenance.iprRequest')}: </span>{entry.request.requestNumber} - {entry.request.title}</div>
                    )}
                    {entry.usages.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="text-gray-400">{t('maintenance.iprUsage')}: </span>
                        {entry.usages.map((u, i) => <span key={i} className="me-2">{u.execution?.title ?? '-'} ({u.usageType})</span>)}
                      </div>
                    )}
                    {entry.replacements.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="text-gray-400">{t('maintenance.iprReplacement')}: </span>
                        {entry.replacements.map((r, i) => <span key={i} className="me-2">{r.replacementNumber} ({r.replacementAction})</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
