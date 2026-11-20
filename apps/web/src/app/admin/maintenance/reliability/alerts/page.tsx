'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useAuth } from '../../../../../lib/auth-context';
import { isPermissionGranted } from '../../../../../lib/permission-gate';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { PageHeader, Card, Select, Input, Button, DataTable, Pagination } from '../../../../../components/admin/ui';
import { Modal } from '../../../../../components/admin/ui/modal';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, machineComponentAdapter, sparePartAdapter, productionLineAdapter } from '../../../../../components/f9';
import {
  formatExpectedLifeUnit,
  formatExpectedLifeValue,
} from '../../../../../lib/maintenance/expected-life-display';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type ActionStatus = 'NO_ACTION' | 'MAINTENANCE_REQUESTED' | 'SCHEDULED' | 'MAINTENANCE_REQUESTED_AND_SCHEDULED';

interface AlertRow {
  id: string;
  alertType: string;
  severity: Severity;
  machine: { id: string; code: string; name: string };
  productionLine: { id: string; code: string; name: string } | null;
  machineComponent: { id: string; code: string; name: string } | null;
  sparePart: {
    id: string; code: string; name: string; partNumber: string | null;
    isCritical: boolean; unit: string | null;
    defaultExpectedLifeValue?: number | null;
    defaultExpectedLifeUnit?: string | null;
    defaultWarningThresholdPercent?: number | null;
  };
  installedPartId: string | null;
  installedAt: string | null;
  serialNumber?: string | null;
  batchNumber?: string | null;
  expectedLifeUnit: string | null;
  expectedLifeValue: number | null;
  lifeStartReading?: number | null;
  currentReading?: number | null;
  consumedPercent: number | null;
  remainingMs: number | null;
  remainingReading: number | null;
  expectedDueAt: string | null;
  expectedDueReading?: number | null;
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
  actionStatus?: ActionStatus;
  linkedRequestNumber?: string | null;
  linkedScheduleTitle?: string | null;
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

interface AlertDetail {
  alert: AlertRow;
  standardLife: { value: number | null; unit: string | null; warningThresholdPercent: number | null };
  appliedLife: {
    value: number | null; unit: string | null; warningThresholdPercent: number | null;
    lifeStartReading: number | null; currentReading: number | null; lifeStartDate: string | null;
    expectedDueAt: string | null; expectedDueReading: number | null;
    remainingMs: number | null; remainingReading: number | null;
    serialNumber: string | null; batchNumber: string | null;
  };
  readings: {
    id: string; readingType: string; readingValue: number; isReset: boolean;
    recordedAt: string; notes: string | null;
  }[];
  readingCount: number;
  failureHistory: {
    installedPartId: string; installedAt: string | null; removedAt: string | null;
    serialNumber: string | null; batchNumber: string | null;
    serviceLifeMs: number | null; expectedLifeValue: number | null; expectedLifeUnit: string | null;
    achievedPercent: number | null; removedReason: string | null;
    request: { requestNumber: string; title: string; status: string } | null;
  }[];
  failureSummary: {
    failureEventCount: number; prematureFailureCount: number;
    repeatedEarlyFailure: boolean; replacementCount: number;
  };
  replacements: { id: string; replacementNumber: string; replacedAt: string; replacementAction: string }[];
  actions: {
    status: ActionStatus;
    sourceToken: string;
    requests: { id: string; requestNumber: string; title: string; status: string; priority: string; type: string }[];
    schedules: { id: string; title: string; type: string; status: string }[];
  };
  stock: {
    productId: string | null;
    reorderPoint: number | null;
    minRecommendedStock: number | null;
    warehouses: { warehouseId: string; code: string; name: string; branchId: string | null; quantity: number }[];
    totalAvailable: number;
    belowReorderPoint: boolean;
  };
}

const ALERT_TYPES = ['LIFE_APPROACHING_DUE', 'LIFE_DUE', 'LIFE_OVERDUE', 'REPEATED_PREMATURE_FAILURE', 'HIGH_REPLACEMENT_FREQUENCY'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DUE_STATES = ['NORMAL', 'WARNING', 'DUE', 'EXPIRED', 'N/A'];
const DAY_MS = 86_400_000;

const SEV_BADGE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const EVIDENCE_LABEL_KEYS: Record<string, string> = {
  basis: 'maintenance.ralEvidence_basis',
  band: 'maintenance.ralEvidence_band',
  consumedPercent: 'maintenance.ralEvidence_consumedPercent',
  remainingMs: 'maintenance.ralEvidence_remainingMs',
  remainingReading: 'maintenance.ralEvidence_remainingReading',
  expectedLifeUnit: 'maintenance.ralEvidence_expectedLifeUnit',
  expectedDueAt: 'maintenance.ralEvidence_expectedDueAt',
  expectedDueReading: 'maintenance.ralEvidence_expectedDueReading',
  installedAt: 'maintenance.ralEvidence_installedAt',
  criticalitySource: 'maintenance.ralEvidence_criticalitySource',
  failureEventCount: 'maintenance.ralEvidence_failureEventCount',
  prematureFailureCount: 'maintenance.ralEvidence_prematureFailureCount',
  lastFailureAt: 'maintenance.ralEvidence_lastFailureAt',
  replacementCount: 'maintenance.ralEvidence_replacementCount',
  replacementCountInWindow: 'maintenance.ralEvidence_replacementCountInWindow',
  windowDays: 'maintenance.ralEvidence_windowDays',
  maxCount: 'maintenance.ralEvidence_maxCount',
};

const BASIS_LABEL_KEYS: Record<string, string> = {
  CANONICAL_EXPECTED_LIFE_BAND: 'maintenance.ralBasisExpectedLife',
  CANONICAL_REPEATED_EARLY_FAILURE: 'maintenance.ralBasisRepeatedFailure',
  CONFIGURED_REPLACEMENT_FREQUENCY: 'maintenance.ralBasisReplacementFrequency',
};

export default function ReliabilityAlertsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const canPlan = isPermissionGranted('maintenance-schedule:create', permissions?.permissions ?? null, isSuperAdmin);
  const canRequest = isPermissionGranted('maintenance-request:create', permissions?.permissions ?? null, isSuperAdmin);

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

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState('');

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

  const loadDetail = useCallback(async (alertId: string) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const data = await api.get<AlertDetail>('/maintenance/reliability/alerts/detail', { params: { alertId } });
      setDetail(data);
    } catch (err: any) {
      setDetail(null);
      setDetailError(err?.message || t('maintenance.ralDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const { exec } = useStableHandlers({ refresh: () => fetchAll(page) });
  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  useEffect(() => { fetchAll(page); }, [page, machineId, machineComponentId, sparePartId, productionLineId, alertType, severity, dueState, isCritical, search]);

  const clearFilters = () => {
    setMachineId(''); setMachineComponentId(''); setSparePartId(''); setProductionLineId('');
    setAlertType(''); setSeverity(''); setDueState(''); setIsCritical(false); setSearch(''); setPage(1);
  };

  const fmtDate = (v: string | null): string => (v ? new Date(v).toLocaleDateString() : t('maintenance.ralNotAvailable'));
  const typeLabel = (v: string) => t(`maintenance.ralType_${v}`);
  const sevLabel = (v: string) => t(`maintenance.ralSev_${v}`);
  const actionLabel = (v: string) => t(`maintenance.ralAction_${v}`);
  const dueStateLabel = (v: string) => (v === 'N/A' ? t('maintenance.ralDueStateNA') : t(`maintenance.iprBand${v}`));
  const criticalityLabel = (v: string) => v === 'COMPONENT_CRITICAL' ? t('maintenance.ralCritComponent')
    : v === 'SPARE_PART_CRITICAL' ? t('maintenance.ralCritSparePart') : t('maintenance.ralCritNone');
  const actionStatusLabel = (v?: ActionStatus) => t(`maintenance.ralActionStatus_${v ?? 'NO_ACTION'}`);
  const basisLabel = (v: string) => BASIS_LABEL_KEYS[v] ? t(BASIS_LABEL_KEYS[v]) : t('maintenance.ralBasisOther');

  const fmtDuration = (ms: number | null): string => {
    if (ms === null || ms === undefined) return t('maintenance.iprInsufficient');
    if (ms < 0) return t('maintenance.ralPastDue');
    const days = ms / DAY_MS;
    return `${days.toFixed(1)} ${t('maintenance.iprUnitDays')}`;
  };

  const fmtRemaining = (a: Pick<AlertRow, 'expectedLifeUnit' | 'remainingMs' | 'remainingReading'>): string => {
    if (a.expectedLifeUnit === 'DAYS' && a.remainingMs !== null && a.remainingMs !== undefined) return fmtDuration(a.remainingMs);
    if ((a.expectedLifeUnit === 'HOURS' || a.expectedLifeUnit === 'CYCLES')
      && a.remainingReading !== null && a.remainingReading !== undefined) {
      if (a.remainingReading < 0) return t('maintenance.ralPastDue');
      return `${a.remainingReading} ${formatExpectedLifeUnit(t, a.expectedLifeUnit)}`;
    }
    return t('maintenance.iprInsufficient');
  };

  const fmtDue = (a: AlertRow): string => (
    a.expectedLifeUnit === 'DAYS'
      ? fmtDate(a.expectedDueAt)
      : t('maintenance.ralReadingBasedNoDate')
  );

  const evidenceLabel = (key: string) => EVIDENCE_LABEL_KEYS[key] ? t(EVIDENCE_LABEL_KEYS[key]) : t('maintenance.ralEvidenceOther');
  const evidenceValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === '') return t('maintenance.ralNotAvailable');
    if (key === 'band') return dueStateLabel(String(value));
    if (key === 'criticalitySource') return criticalityLabel(String(value));
    if (key === 'basis') return basisLabel(String(value));
    if (key === 'expectedLifeUnit') return formatExpectedLifeUnit(t, String(value));
    if (key === 'installedAt' || key === 'lastFailureAt' || key === 'expectedDueAt') return fmtDate(String(value));
    if (key === 'remainingMs') return fmtDuration(Number(value));
    if (key === 'consumedPercent') return `${value}%`;
    return String(value);
  };

  const openDetail = async (a: AlertRow) => {
    setDetailOpen(true);
    setRequestError('');
    await loadDetail(a.id);
  };

  const goPlan = (a: AlertRow) => {
    const params = new URLSearchParams();
    params.set('planSource', 'reliability');
    params.set('planMachineId', a.machine.id);
    params.set('planSparePartId', a.sparePart.id);
    if (a.machineComponent?.id) params.set('planComponentId', a.machineComponent.id);
    params.set('planAlertType', a.alertType);
    params.set('planAlertId', a.id);
    if (a.installedPartId) params.set('planInstalledPartId', a.installedPartId);
    router.push(`/admin/maintenance/schedules?${params.toString()}`);
  };

  const createRequest = async (a: AlertRow) => {
    if (!canRequest || requestBusy) return;
    setRequestBusy(true);
    setRequestError('');
    try {
      const result = await api.post<{ created: boolean; request: { requestNumber: string } }>(
        '/maintenance/reliability/alerts/maintenance-request',
        { alertId: a.id },
      );
      showToast(result?.created ? t('maintenance.ralRequestCreated') : t('maintenance.ralRequestAlreadyLinked'), 'success');
      await Promise.all([fetchAll(page), loadDetail(a.id)]);
    } catch (err: any) {
      const message = err?.message || t('maintenance.ralRequestFailed');
      setRequestError(message);
      handleApiError(err, { title: t('maintenance.ralRequestFailed') });
    } finally {
      setRequestBusy(false);
    }
  };

  const actionCell = (a: AlertRow) => (
    <div className="flex flex-col" data-testid="ral-action-status">
      <span>{actionStatusLabel(a.actionStatus)}</span>
      {(a.linkedRequestNumber || a.linkedScheduleTitle) && (
        <span className="text-xs text-gray-400">{a.linkedRequestNumber ?? a.linkedScheduleTitle}</span>
      )}
    </div>
  );

  const requestButton = (a: AlertRow) => {
    if (!canRequest) return <span className="text-xs text-gray-400">{t('maintenance.ralRequestNeedsPermission')}</span>;
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={requestBusy}
        data-testid="ral-create-request"
        onClick={(e: any) => { e.stopPropagation(); createRequest(a); }}
      >
        {requestBusy ? t('maintenance.ralRequestBusy') : t('maintenance.ralRequestAction')}
      </Button>
    );
  };

  const columns = [
    { key: 'severity', header: t('maintenance.ralColSeverity'), render: (a: AlertRow) => (
      <span className={`text-xs px-2 py-0.5 rounded-full ${SEV_BADGE[a.severity] ?? 'bg-gray-100 text-gray-700'}`}>{sevLabel(a.severity)}</span>
    ) },
    { key: 'alertType', header: t('maintenance.ralColType'), render: (a: AlertRow) => typeLabel(a.alertType) },
    { key: 'line', header: t('maintenance.ralColLine'), render: (a: AlertRow) => (a.productionLine ? `${a.productionLine.code} - ${a.productionLine.name}` : t('maintenance.ralNotAvailable')) },
    { key: 'machine', header: t('maintenance.ralColMachine'), render: (a: AlertRow) => `${a.machine.code} - ${a.machine.name}` },
    { key: 'component', header: t('maintenance.ralColComponent'), render: (a: AlertRow) => (a.machineComponent ? `${a.machineComponent.code} - ${a.machineComponent.name}` : t('maintenance.ralNotAvailable')) },
    { key: 'sparePart', header: t('maintenance.ralColSparePart'), render: (a: AlertRow) => `${a.sparePart.code} - ${a.sparePart.name}` },
    { key: 'installedAt', header: t('maintenance.ralColInstalledAt'), render: (a: AlertRow) => fmtDate(a.installedAt) },
    { key: 'expectedDueAt', header: t('maintenance.ralColExpectedDue'), render: (a: AlertRow) => fmtDue(a) },
    { key: 'consumed', header: t('maintenance.ralColConsumed'), render: (a: AlertRow) => (a.consumedPercent === null ? t('maintenance.ralNotAvailable') : `${a.consumedPercent}%`) },
    { key: 'remaining', header: t('maintenance.ralColRemaining'), render: (a: AlertRow) => fmtRemaining(a) },
    { key: 'dueState', header: t('maintenance.ralColDueState'), render: (a: AlertRow) => dueStateLabel(a.dueState) },
    { key: 'recommended', header: t('maintenance.ralColAction'), render: (a: AlertRow) => actionLabel(a.recommendedAction) },
    { key: 'actionStatus', header: t('maintenance.ralColActionStatus'), render: actionCell },
    { key: 'request', header: t('maintenance.ralColRequestAction'), render: (a: AlertRow) => requestButton(a) },
    { key: 'plan', header: t('maintenance.ralColPlanning'), render: (a: AlertRow) => (
      canPlan ? (
        <Button size="sm" variant="secondary" onClick={(e: any) => { e.stopPropagation(); goPlan(a); }}>{t('maintenance.ralPlanAction')}</Button>
      ) : <span className="text-xs text-gray-400">{t('maintenance.ralPlanNeedsPermission')}</span>
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
      {requestError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="ral-request-error">
          {requestError}
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
        <DataTable<AlertRow> columns={columns} data={rows} keyExtractor={(a) => a.id} loading={loading} emptyMessage={t('maintenance.ralEmpty')} onRowClick={openDetail} />
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
                        : t('maintenance.ralDqReasonOther')}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-gray-400">{t('maintenance.ralDqNote')}</p>
        </Card>
      )}

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={t('maintenance.ralDetails')} size="xl">
        {detailLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">{t('common.loading')}</div>
        ) : detailError ? (
          <div className="py-8 text-center text-sm text-red-600">{detailError}</div>
        ) : detail ? (
          <div className="space-y-4" data-testid="ral-alert-detail">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${SEV_BADGE[detail.alert.severity] ?? 'bg-gray-100 text-gray-700'}`}>{sevLabel(detail.alert.severity)}</span>
              <span className="text-sm font-semibold text-gray-800">{typeLabel(detail.alert.alertType)}</span>
              <span className="text-xs text-gray-500">{actionStatusLabel(detail.actions.status)}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
              <div><span className="text-gray-400">{t('maintenance.ralColMachine')}: </span>{detail.alert.machine.code} - {detail.alert.machine.name}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColComponent')}: </span>{detail.alert.machineComponent ? `${detail.alert.machineComponent.code} - ${detail.alert.machineComponent.name}` : t('maintenance.ralNotAvailable')}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColSparePart')}: </span>{detail.alert.sparePart.code} - {detail.alert.sparePart.name}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColLine')}: </span>{detail.alert.productionLine ? `${detail.alert.productionLine.code} - ${detail.alert.productionLine.name}` : t('maintenance.ralNotAvailable')}</div>
              <div><span className="text-gray-400">{t('maintenance.ralColInstalledAt')}: </span>{fmtDate(detail.alert.installedAt)}</div>
              <div><span className="text-gray-400">{t('maintenance.ralRemainingSerial')}: </span>{detail.appliedLife.serialNumber ?? t('maintenance.ralNotAvailable')}</div>
              <div><span className="text-gray-400">{t('maintenance.ralRemainingBatch')}: </span>{detail.appliedLife.batchNumber ?? t('maintenance.ralNotAvailable')}</div>
              <div><span className="text-gray-400">{t('maintenance.ralCriticalitySource')}: </span>{criticalityLabel(detail.alert.criticalitySource)}</div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">{t('maintenance.ralStandardVsAppliedLife')}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                <div><span className="text-gray-400">{t('maintenance.ralStandardLife')}: </span>{formatExpectedLifeValue(t, detail.standardLife.value, detail.standardLife.unit)}</div>
                <div><span className="text-gray-400">{t('maintenance.ralStandardWarning')}: </span>{detail.standardLife.warningThresholdPercent === null ? t('maintenance.ralNotAvailable') : `${detail.standardLife.warningThresholdPercent}%`}</div>
                <div><span className="text-gray-400">{t('maintenance.ralAppliedLife')}: </span>{formatExpectedLifeValue(t, detail.appliedLife.value, detail.appliedLife.unit)}</div>
                <div><span className="text-gray-400">{t('maintenance.ralAppliedWarning')}: </span>{detail.appliedLife.warningThresholdPercent === null ? t('maintenance.ralNotAvailable') : `${detail.appliedLife.warningThresholdPercent}%`}</div>
                <div><span className="text-gray-400">{t('maintenance.ralLifeStartReading')}: </span>{detail.appliedLife.lifeStartReading ?? t('maintenance.ralNotAvailable')}</div>
                <div><span className="text-gray-400">{t('maintenance.ralCurrentReading')}: </span>{detail.appliedLife.currentReading ?? t('maintenance.ralNotAvailable')}</div>
                <div><span className="text-gray-400">{t('maintenance.ralColRemaining')}: </span>{fmtRemaining(detail.alert)}</div>
                <div><span className="text-gray-400">{t('maintenance.ralExpectedDueReading')}: </span>{detail.appliedLife.expectedDueReading ?? t('maintenance.ralNotAvailable')}</div>
              </div>
              <p className="mt-2 text-xs text-gray-400">{t('maintenance.ralLifeEvidenceNote')}</p>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">{t('maintenance.ralWhyAlerted')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-gray-600">
                {Object.entries(detail.alert.evidence || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-gray-100 py-1" data-testid="ral-evidence-row">
                    <span className="text-gray-400">{evidenceLabel(k)}</span>
                    <span className="font-medium">{evidenceValue(k, v)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <div className="flex justify-between py-1"><span className="text-gray-400">{t('maintenance.ralRecommendedAction')}</span><span className="font-medium">{actionLabel(detail.alert.recommendedAction)}</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-400">{t('maintenance.ralRecommendedDate')}</span><span className="font-medium">{fmtDue(detail.alert)}</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-400">{t('maintenance.ralLinkedRequest')}</span><span className="font-medium">{detail.actions.requests[0]?.requestNumber ?? t('maintenance.ralNotAvailable')}</span></div>
              <div className="flex justify-between py-1"><span className="text-gray-400">{t('maintenance.ralLinkedPlan')}</span><span className="font-medium">{detail.actions.schedules[0]?.title ?? t('maintenance.ralNotAvailable')}</span></div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">{t('maintenance.ralFailureHistory')}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mb-2">
                <div>{t('maintenance.ralColFailures')}: {detail.failureSummary.failureEventCount}</div>
                <div>{t('maintenance.ralColPremature')}: {detail.failureSummary.prematureFailureCount}</div>
                <div>{t('maintenance.ralColReplacements')}: {detail.failureSummary.replacementCount}</div>
                <div>{t('maintenance.ralColRepeatedEarlyFailure')}: {detail.failureSummary.repeatedEarlyFailure ? t('maintenance.iprYes') : t('maintenance.iprNo')}</div>
              </div>
              {detail.failureHistory.length === 0 ? (
                <div className="text-xs text-gray-400">{t('maintenance.ralNoFailureHistory')}</div>
              ) : (
                <ul className="text-xs text-gray-600 space-y-1" data-testid="ral-failure-history">
                  {detail.failureHistory.map((f) => (
                    <li key={f.installedPartId} className="flex flex-wrap justify-between border-b border-gray-100 py-1">
                      <span>{fmtDate(f.removedAt ?? f.installedAt)}</span>
                      <span>{f.achievedPercent === null ? t('maintenance.ralNotAvailable') : `${f.achievedPercent}%`}</span>
                      <span>{f.serialNumber ?? t('maintenance.ralNotAvailable')}</span>
                      <span>{f.request?.requestNumber ?? t('maintenance.ralNotAvailable')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-700 mb-2">{t('maintenance.ralReadings')} ({detail.readingCount})</div>
                {detail.readings.length === 0 ? (
                  <div className="text-xs text-gray-400">{t('maintenance.ralNoReadings')}</div>
                ) : (
                  <ul className="text-xs text-gray-600 space-y-1">
                    {detail.readings.map((r) => (
                      <li key={r.id} className="flex justify-between border-b border-gray-100 py-1">
                        <span>{formatExpectedLifeUnit(t, r.readingType)}</span>
                        <span>{r.readingValue}</span>
                        <span>{r.isReset ? t('maintenance.ralReadingReset') : t('maintenance.ralReadingRecord')}</span>
                        <span>{fmtDate(r.recordedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-700 mb-2">{t('maintenance.ralReplacementHistory')}</div>
                {detail.replacements.length === 0 ? (
                  <div className="text-xs text-gray-400">{t('maintenance.ralNoReplacementHistory')}</div>
                ) : (
                  <ul className="text-xs text-gray-600 space-y-1">
                    {detail.replacements.map((r) => (
                      <li key={r.id} className="flex justify-between border-b border-gray-100 py-1">
                        <span>{r.replacementNumber}</span>
                        <span>{fmtDate(r.replacedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">{t('maintenance.ralStockContext')}</div>
              {!detail.stock.productId ? (
                <div className="text-xs text-gray-400">{t('maintenance.ralNoStockProduct')}</div>
              ) : (
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex flex-wrap gap-4">
                    <span>{t('maintenance.ralStockTotal')}: {detail.stock.totalAvailable}</span>
                    <span>{t('maintenance.ralStockReorderPoint')}: {detail.stock.reorderPoint ?? t('maintenance.ralNotAvailable')}</span>
                    <span>{t('maintenance.ralStockMinRecommended')}: {detail.stock.minRecommendedStock ?? t('maintenance.ralNotAvailable')}</span>
                    <span>{detail.stock.belowReorderPoint ? t('maintenance.ralStockBelowReorder') : t('maintenance.ralStockAboveReorder')}</span>
                  </div>
                  {detail.stock.warehouses.length === 0 ? (
                    <div className="text-gray-400">{t('maintenance.ralNoStockWarehouses')}</div>
                  ) : (
                    <ul className="space-y-1">
                      {detail.stock.warehouses.map((w) => (
                        <li key={w.warehouseId} className="flex justify-between border-b border-gray-100 py-1">
                          <span>{w.code} - {w.name}</span>
                          <span>{w.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-gray-400">{t('maintenance.ralStockNote')}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDetailOpen(false)}>{t('maintenance.ralClose')}</Button>
              {requestButton(detail.alert)}
              {canPlan ? (
                <Button onClick={() => goPlan(detail.alert)}>{t('maintenance.ralPlanAction')}</Button>
              ) : (
                <span className="text-xs text-gray-400 self-center">{t('maintenance.ralPlanNeedsPermission')}</span>
              )}
            </div>
            {canPlan && <p className="text-xs text-gray-400 text-end">{t('maintenance.ralPlanningNote')}</p>}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
