'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useAuth } from '../../../../../lib/auth-context';
import { isPermissionGranted } from '../../../../../lib/permission-gate';
import { PageHeader, Card, Select, Input, Button, DataTable, Pagination } from '../../../../../components/admin/ui';
import { Modal } from '../../../../../components/admin/ui/modal';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, machineComponentAdapter, sparePartAdapter, productionLineAdapter } from '../../../../../components/f9';

interface AlertRow {
  id: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  machine: { id: string; code: string; name: string };
  productionLine: { id: string; code: string; name: string } | null;
  machineComponent: { id: string; code: string; name: string } | null;
  sparePart: { id: string; code: string; name: string; partNumber: string | null; isCritical: boolean; unit: string | null };
  installedPartId: string | null;
  installedAt: string | null;
  expectedLifeUnit: string | null;
  expectedLifeValue: number | null;
  consumedPercent: number | null;
  remainingMs: number | null;
  remainingReading: number | null;
  expectedDueAt: string | null;
  dueState: string;
  failureEventCount: number;
  prematureFailureCount: number;
  replacementCount: number;
  replacementCountInWindow: number | null;
  lastFailureAt: string | null;
  recommendedAction: string;
  recommendedDate: string | null;
  criticalitySource: 'COMPONENT_CRITICAL' | 'SPARE_PART_CRITICAL' | 'NONE';
  evidence: Record<string, any>;
}

interface SummaryData {
  totalAlerts: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  approaching: number;
  due: number;
  overdue: number;
  repeatedPrematureFailure: number;
  highReplacementFrequency: number;
  criticalAlerts: number;
  eligibility: {
    populations: number; activeInstances: number; withExpectedLife: number; unknownExpectedLife: number;
    prematureFailurePopulations: number; repeatedFailurePopulations: number; replacementFrequencyEligible: number;
    replacementFrequencyThresholdConfigured: boolean;
  };
  hasAnyEligibleSignal: boolean;
}

interface DataQuality {
  populations: number; activeInstances: number; withExpectedLife: number; unknownExpectedLife: number;
  prematureFailurePopulations: number; repeatedFailurePopulations: number; replacementFrequencyEligible: number;
  replacementFrequencyThresholdConfigured: boolean;
  notEligibleReasons: string[];
}

const ALERT_TYPES = ['LIFE_APPROACHING_DUE', 'LIFE_DUE', 'LIFE_OVERDUE', 'REPEATED_PREMATURE_FAILURE', 'HIGH_REPLACEMENT_FREQUENCY'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DUE_STATES = ['NORMAL', 'WARNING', 'DUE', 'EXPIRED', 'N/A'];

const SEV_BADGE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export default function ReliabilityAlertsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const canPlan = isPermissionGranted('maintenance-schedule:create', permissions?.permissions ?? null, isSuperAdmin);

  const [rows, setRows] = useState<AlertRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [dq, setDq] = useState<DataQuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [machineId, setMachineId] = useState('');
  const [machineComponentId, setMachineComponentId] = useState('');
  const [sparePartId, setSparePartId] = useState('');
  const [productionLineId, setProductionLineId] = useState('');
  const [alertType, setAlertType] = useState('');
  const [severity, setSeverity] = useState('');
  const [dueState, setDueState] = useState('');
  const [isCritical, setIsCritical] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<AlertRow | null>(null);

  const buildParams = useCallback((forPage = page): Record<string, string> => {
    const p: Record<string, string> = { page: String(forPage), limit: String(meta.limit) };
    if (machineId) p.machineId = machineId;
    if (machineComponentId) p.machineComponentId = machineComponentId;
    if (sparePartId) p.sparePartId = sparePartId;
    if (productionLineId) p.productionLineId = productionLineId;
    if (alertType) p.alertType = alertType;
    if (severity) p.severity = severity;
    if (dueState) p.dueState = dueState;
    if (isCritical) p.isCritical = 'true';
    if (search) p.search = search;
    return p;
  }, [page, meta.limit, machineId, machineComponentId, sparePartId, productionLineId, alertType, severity, dueState, isCritical, search]);

  const fetchAll = useCallback(async (forPage = page) => {
    setLoading(true);
    setError('');
    const params = buildParams(forPage);
    try {
      const [list, sum, quality] = await Promise.all([
        api.get<{ data: AlertRow[]; meta: typeof meta }>('/maintenance/reliability/alerts', { params }),
        api.get<SummaryData>('/maintenance/reliability/alerts/summary', { params }),
        api.get<DataQuality>('/maintenance/reliability/alerts/data-quality', { params }),
      ]);
      setRows(list.data || []);
      setMeta(list.meta);
      setSummary(sum);
      setDq(quality);
    } catch (err: any) {
      setError(err?.message || t('maintenance.ralLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [buildParams, page, t]);

  const { exec } = useStableHandlers({ refresh: () => fetchAll(page) });
  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  useEffect(() => { fetchAll(page); }, [page, machineId, machineComponentId, sparePartId, productionLineId, alertType, severity, dueState, isCritical, search]);

  const clearFilters = () => {
    setMachineId(''); setMachineComponentId(''); setSparePartId(''); setProductionLineId('');
    setAlertType(''); setSeverity(''); setDueState(''); setIsCritical(false); setSearch(''); setPage(1);
  };

  const fmtDate = (v: string | null): string => (v ? new Date(v).toLocaleDateString() : '-');
  const typeLabel = (v: string) => t(`maintenance.ralType_${v}`);
  const sevLabel = (v: string) => t(`maintenance.ralSev_${v}`);
  const actionLabel = (v: string) => t(`maintenance.ralAction_${v}`);
  const dueStateLabel = (v: string) => (v === 'N/A' ? t('maintenance.ralDueStateNA') : t(`maintenance.iprBand${v}`));
  const criticalityLabel = (v: string) => v === 'COMPONENT_CRITICAL' ? t('maintenance.ralCritComponent') : v === 'SPARE_PART_CRITICAL' ? t('maintenance.ralCritSparePart') : t('maintenance.ralCritNone');

  const goPlan = (a: AlertRow) => {
    const params = new URLSearchParams();
    params.set('planSource', 'reliability');
    params.set('planMachineId', a.machine.id);
    params.set('planSparePartId', a.sparePart.id);
    if (a.machineComponent?.id) params.set('planComponentId', a.machineComponent.id);
    params.set('planAlertType', a.alertType);
    if (a.installedPartId) params.set('planInstalledPartId', a.installedPartId);
    router.push(`/admin/maintenance/schedules?${params.toString()}`);
  };

  const columns = [
    { key: 'severity', header: t('maintenance.ralColSeverity'), render: (a: AlertRow) => (
      <span className={`text-xs px-2 py-0.5 rounded-full ${SEV_BADGE[a.severity] ?? 'bg-gray-100 text-gray-700'}`}>{sevLabel(a.severity)}</span>
    ) },
    { key: 'alertType', header: t('maintenance.ralColType'), render: (a: AlertRow) => typeLabel(a.alertType) },
    { key: 'line', header: t('maintenance.ralColLine'), render: (a: AlertRow) => (a.productionLine ? `${a.productionLine.code} - ${a.productionLine.name}` : '-') },
    { key: 'machine', header: t('maintenance.ralColMachine'), render: (a: AlertRow) => `${a.machine.code} - ${a.machine.name}` },
    { key: 'component', header: t('maintenance.ralColComponent'), render: (a: AlertRow) => (a.machineComponent ? `${a.machineComponent.code} - ${a.machineComponent.name}` : '-') },
    { key: 'sparePart', header: t('maintenance.ralColSparePart'), render: (a: AlertRow) => `${a.sparePart.code} - ${a.sparePart.name}` },
    { key: 'installedAt', header: t('maintenance.ralColInstalledAt'), render: (a: AlertRow) => fmtDate(a.installedAt) },
    { key: 'expectedDueAt', header: t('maintenance.ralColExpectedDue'), render: (a: AlertRow) => fmtDate(a.expectedDueAt) },
    { key: 'consumed', header: t('maintenance.ralColConsumed'), render: (a: AlertRow) => (a.consumedPercent === null ? '-' : `${a.consumedPercent}%`) },
    { key: 'dueState', header: t('maintenance.ralColDueState'), render: (a: AlertRow) => dueStateLabel(a.dueState) },
    { key: 'action', header: t('maintenance.ralColAction'), render: (a: AlertRow) => actionLabel(a.recommendedAction) },
    { key: 'plan', header: t('maintenance.ralColPlanning'), render: (a: AlertRow) => (
      canPlan ? (
        <Button size="sm" variant="secondary" onClick={(e: any) => { e.stopPropagation(); goPlan(a); }}>{t('maintenance.ralPlanAction')}</Button>
      ) : <span className="text-xs text-gray-400">-</span>
    ) },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.reliabilityAlertsTitle')} subtitle={t('maintenance.ralSubtitle')} />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => fetchAll(page)} className="ms-2 underline">{t('common.retry')}</button>
        </div>
      )}

      <Card className="p-4 mb-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">{t('maintenance.ralFilters')}</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <F9Lookup label={t('maintenance.ralMachine')} value={machineId} onChange={(v) => { setMachineId(v || ''); setPage(1); }} adapter={machineAdapter} />
          <F9Lookup label={t('maintenance.ralComponent')} value={machineComponentId} onChange={(v) => { setMachineComponentId(v || ''); setPage(1); }} adapter={machineComponentAdapter} filters={machineId ? { machineId } : undefined} />
          <F9Lookup label={t('maintenance.ralSparePart')} value={sparePartId} onChange={(v) => { setSparePartId(v || ''); setPage(1); }} adapter={sparePartAdapter} />
          <F9Lookup label={t('maintenance.ralProductionLine')} value={productionLineId} onChange={(v) => { setProductionLineId(v || ''); setPage(1); }} adapter={productionLineAdapter} />
          <Select label={t('maintenance.ralAlertType')} value={alertType} onChange={(e) => { setAlertType(e.target.value); setPage(1); }} placeholder={t('common.all')}
            options={ALERT_TYPES.map((v) => ({ value: v, label: typeLabel(v) }))} />
          <Select label={t('maintenance.ralSeverity')} value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} placeholder={t('common.all')}
            options={SEVERITIES.map((v) => ({ value: v, label: sevLabel(v) }))} />
          <Select label={t('maintenance.ralDueState')} value={dueState} onChange={(e) => { setDueState(e.target.value); setPage(1); }} placeholder={t('common.all')}
            options={DUE_STATES.map((v) => ({ value: v, label: dueStateLabel(v) }))} />
          <Input label={t('maintenance.ralSearch')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isCritical} onChange={(e) => { setIsCritical(e.target.checked); setPage(1); }} />
            {t('maintenance.ralCriticalOnly')}
          </label>
          <Button variant="secondary" size="sm" onClick={clearFilters}>{t('maintenance.ralClear')}</Button>
        </div>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{summary.totalAlerts}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.ralTotalAlerts')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{summary.approaching}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.ralApproaching')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{summary.due}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.ralDue')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{summary.overdue}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.ralOverdue')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-700">{summary.repeatedPrematureFailure}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.ralRepeated')}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{summary.highReplacementFrequency}</div>
            <div className="text-xs text-gray-500 mt-1">{t('maintenance.ralHighFrequency')}</div>
          </Card>
        </div>
      )}

      <Card className="mb-4 overflow-hidden">
        <DataTable<AlertRow> columns={columns} data={rows} keyExtractor={(a) => a.id} loading={loading} emptyMessage={t('maintenance.ralEmpty')} onRowClick={(a) => setDetail(a)} />
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
      </Card>

      {dq && (
        <Card className="p-4 mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">{t('maintenance.ralDataQuality')}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-700">
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.ralDqPopulations')}</span><span className="font-medium">{dq.populations}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.ralDqActiveInstances')}</span><span className="font-medium">{dq.activeInstances}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.ralDqWithExpectedLife')}</span><span className="font-medium">{dq.withExpectedLife}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.ralDqUnknownExpectedLife')}</span><span className="font-medium">{dq.unknownExpectedLife}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.ralDqPrematurePopulations')}</span><span className="font-medium">{dq.prematureFailurePopulations}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.ralDqRepeatedPopulations')}</span><span className="font-medium">{dq.repeatedFailurePopulations}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1"><span>{t('maintenance.ralDqFrequencyEligible')}</span><span className="font-medium">{dq.replacementFrequencyEligible}</span></div>
            <div className="flex justify-between border-b border-gray-100 py-1">
              <span>{t('maintenance.ralDqFrequencyNotConfigured')}</span>
              <span className="font-medium">{dq.replacementFrequencyThresholdConfigured ? t('maintenance.iprYes') : t('maintenance.iprNo')}</span>
            </div>
          </div>
          {dq.notEligibleReasons.length > 0 && (
            <ul className="mt-3 text-xs text-amber-700 list-disc ps-5">
              {dq.notEligibleReasons.map((r) => (
                <li key={r}>{r === 'NO_POPULATIONS' ? t('maintenance.ralDqPopulationsZero')
                  : r === 'NO_ACTIVE_INSTANCES' ? t('maintenance.ralDqNoActive')
                  : r === 'EXPECTED_LIFE_UNKNOWN' ? t('maintenance.ralDqUnknownLife')
                  : r === 'REPLACEMENT_FREQUENCY_THRESHOLD_NOT_CONFIGURED' ? t('maintenance.ralDqThresholdNotConfigured')
                  : r}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-gray-400">{t('maintenance.ralDqNote')}</p>
        </Card>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={t('maintenance.ralDetails')} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${SEV_BADGE[detail.severity] ?? 'bg-gray-100 text-gray-700'}`}>{sevLabel(detail.severity)}</span>
              <span className="text-sm font-semibold text-gray-800">{typeLabel(detail.alertType)}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
              <div><span className="text-gray-400">{t('maintenance.ralColMachine')}: </span>{detail.machine.code} - {detail.machine.name}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColComponent')}: </span>{detail.machineComponent ? `${detail.machineComponent.code} - ${detail.machineComponent.name}` : '-'}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColSparePart')}: </span>{detail.sparePart.code} - {detail.sparePart.name}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColLine')}: </span>{detail.productionLine ? `${detail.productionLine.code} - ${detail.productionLine.name}` : '-'}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColInstalledAt')}: </span>{fmtDate(detail.installedAt)}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColExpectedDue')}: </span>{fmtDate(detail.expectedDueAt)}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColConsumed')}: </span>{detail.consumedPercent === null ? '-' : `${detail.consumedPercent}%`}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColDueState')}: </span>{dueStateLabel(detail.dueState)}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColFailures')}: </span>{detail.failureEventCount}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColPremature')}: </span>{detail.prematureFailureCount}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColReplacements')}: </span>{detail.replacementCount}</div>
              <div><span className="text-gray-400">{t('maintenance.ralCriticalitySource')}: </span>{criticalityLabel(detail.criticalitySource)}</div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">{t('maintenance.ralWhyAlerted')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-gray-600">
                {Object.entries(detail.evidence || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-gray-100 py-1">
                    <span className="text-gray-400">{t('maintenance.ralEvidence')} · {k}</span>
                    <span className="font-medium">{v === null || v === undefined ? '-' : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <div className="flex justify-between py-1"><span className="text-gray-400">{t('maintenance.ralRecommendedAction')}</span><span className="font-medium">{actionLabel(detail.recommendedAction)}</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-400">{t('maintenance.ralRecommendedDate')}</span><span className="font-medium">{fmtDate(detail.recommendedDate)}</span></div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDetail(null)}>{t('maintenance.ralClose')}</Button>
              {canPlan ? (
                <Button onClick={() => goPlan(detail)}>{t('maintenance.ralPlanAction')}</Button>
              ) : (
                <span className="text-xs text-gray-400 self-center">{t('maintenance.ralPlanNeedsPermission')}</span>
              )}
            </div>
            {canPlan && <p className="text-xs text-gray-400 text-end">{t('maintenance.ralPlanningNote')}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
