'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { Button, Modal, PageHeader, Pagination, Textarea } from '../../../../../components/admin/ui';
import type {
  ProductionMeasurementPoint,
  ProductionOutputEvent,
  ProductionRun,
  ProductionRunSession,
  ProductionRunTransition,
  ProductionRunTotals,
  RunLossesView,
} from '../../../../../lib/admin-types';
import { OutputForm } from './_components/output-form';
import { CorrectionForm } from './_components/correction-form';

const TABS = ['live', 'events', 'output', 'corrections', 'losses', 'history'];

const TAB_LABEL_KEYS: Record<string, string> = {
  live: 'production.runs.liveView',
  events: 'production.runs.events',
  output: 'production.runs.recordOutput',
  corrections: 'production.runs.correctEvent',
  losses: 'production.runs.losses',
  history: 'production.runs.history',
};

const RUN_STATUSES: Record<string, string> = {
  READY: 'production.runs.runStatus.READY',
  RUNNING: 'production.runs.runStatus.RUNNING',
  PAUSED: 'production.runs.runStatus.PAUSED',
  COMPLETED: 'production.runs.runStatus.COMPLETED',
  ABORTED: 'production.runs.runStatus.ABORTED',
};

interface LiveData {
  sessions: ProductionRunSession[];
  recentEvents: ProductionOutputEvent[];
  totals: ProductionRunTotals;
}

interface EventsData {
  data: ProductionOutputEvent[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface HistoryData {
  transitions: ProductionRunTransition[];
  audits: any[];
}

interface TransitionTarget {
  action: string;
  reasonRequired: boolean;
}

function runStatusLabelKey(status: string): string {
  return RUN_STATUSES[status] || 'production.runs.runStatus.' + status;
}

function eventTypeLabelKey(eventType: string): string {
  switch (eventType) {
    case 'PRODUCTION': return 'production.runs.eventTypeProduction';
    case 'RESET': return 'production.runs.eventTypeReset';
    case 'CORRECTION': return 'production.runs.eventTypeCorrection';
    default: return eventType;
  }
}

function assignmentSourceLabelKey(value: string | null | undefined): string {
  switch (value) {
    case 'RESOURCE': return 'production.runs.assignmentSourceResource';
    case 'EXPLICIT': return 'production.runs.assignmentSourceExplicit';
    default: return 'production.runs.assignmentSource';
  }
}

function toNumber(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

export default function ProductionRunDetailPage() {
  const { t, dir } = useTranslation();
  const params = useParams();
  const id = String(params?.id || '');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { permissions, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('production-run:' + action)),
    [isSuperAdmin, permissions],
  );

  const [run, setRun] = useState<ProductionRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(searchParams.get('tab') || 'live');

  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const [eventsData, setEventsData] = useState<EventsData | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsPage, setEventsPage] = useState(1);

  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [lossesData, setLossesData] = useState<RunLossesView | null>(null);
  const [lossesLoading, setLossesLoading] = useState(false);
  const [lossesPage, setLossesPage] = useState(1);

  const [measurementPoints, setMeasurementPoints] = useState<ProductionMeasurementPoint[]>([]);

  const [transition, setTransition] = useState<TransitionTarget | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const fetchRun = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRun(await api.get<ProductionRun>('/production/runs/' + id));
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (id) fetchRun();
  }, [id, fetchRun]);

  const loadLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      setLiveData(await api.get<LiveData>('/production/runs/' + id + '/live'));
    } catch (err) {
      handleApiError(err);
    } finally {
      setLiveLoading(false);
    }
  }, [id, handleApiError]);

  const loadEvents = useCallback(async (page: number) => {
    setEventsLoading(true);
    try {
      const result = await api.get<EventsData>('/production/runs/' + id + '/events', { params: { page, limit: 10 } });
      setEventsData(result);
    } catch (err) {
      handleApiError(err);
    } finally {
      setEventsLoading(false);
    }
  }, [id, handleApiError]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistoryData(await api.get<HistoryData>('/production/runs/' + id + '/history'));
    } catch (err) {
      handleApiError(err);
    } finally {
      setHistoryLoading(false);
    }
  }, [id, handleApiError]);

  const loadLosses = useCallback(async (page: number) => {
    setLossesLoading(true);
    try {
      setLossesData(await api.get<RunLossesView>('/production/runs/' + id + '/losses', { params: { page, limit: 20 } }));
    } catch (err) {
      handleApiError(err);
    } finally {
      setLossesLoading(false);
    }
  }, [id, handleApiError]);

  const loadMeasurementPoints = useCallback(async () => {
    if (!run?.productionLineId) return;
    try {
      const result = await api.get<ProductionMeasurementPoint[] | { data: ProductionMeasurementPoint[] }>(
        '/production/measurement-points',
        { params: { productionLineId: run.productionLineId, status: 'ACTIVE' } },
      );
      setMeasurementPoints(Array.isArray(result) ? result : (result.data || []));
    } catch (err) {
      handleApiError(err);
    }
  }, [run?.productionLineId, handleApiError]);

  useEffect(() => {
    if (!run) return;
    if (tab === 'live') loadLive();
    if (tab === 'events') loadEvents(eventsPage);
    if (tab === 'history') loadHistory();
    if (tab === 'corrections') loadEvents(1);
    if (tab === 'losses') loadLosses(lossesPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, run?.id, eventsPage, lossesPage]);

  useEffect(() => {
    if (run) loadMeasurementPoints();
  }, [run, loadMeasurementPoints]);

  const handleSaveError = (err: any) => {
    const key = (err as any)?.messageKey;
    if (key && key.startsWith('productionRun.')) {
      handleApiError(err, { message: t('production.runs.' + key.slice('productionRun.'.length)) });
      return;
    }
    handleApiError(err);
  };

  const runTransition = async () => {
    if (!run || !transition) return;
    if (transition.reasonRequired && reason.trim().length < 3) return;
    setActing(true);
    try {
      const body: any = { requestId: crypto.randomUUID(), lockVersion: run.lockVersion };
      if (reason.trim()) body.reason = reason.trim();
      const updated = await api.post<ProductionRun>('/production/runs/' + id + '/' + transition.action, body);
      showToast(t('production.runs.actionCompleted'), 'success');
      setTransition(null);
      setReason('');
      setRun(updated);
      if (tab === 'live') loadLive();
    } catch (err) {
      handleSaveError(err);
    } finally {
      setActing(false);
    }
  };

  const refreshAfterOutput = useCallback(() => {
    fetchRun();
    if (tab === 'live') loadLive();
    if (tab === 'events') loadEvents(eventsPage);
    if (tab === 'corrections') loadEvents(1);
  }, [fetchRun, tab, loadLive, loadEvents, eventsPage]);

  if (loading) {
    return <div><PageHeader title={t('production.runs.title')} /><div className="text-gray-500">{t('common.loading')}</div></div>;
  }

  if (error || !run) {
    return (
      <div>
        <PageHeader title={t('production.runs.title')} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">{error || t('common.notFound')}</div>
        <div className="mt-4"><Button variant="secondary" onClick={() => router.push('/admin/production/runs')}>{t('common.backToList')}</Button></div>
      </div>
    );
  }

  const canTransition = (action: string) => {
    if (action === 'pause') return can('pause') && run.status === 'RUNNING';
    if (action === 'resume') return can('resume') && run.status === 'PAUSED';
    if (action === 'complete') return can('complete') && ['RUNNING', 'PAUSED'].includes(run.status);
    if (action === 'abort') return can('abort') && ['READY', 'RUNNING', 'PAUSED'].includes(run.status);
    return false;
  };

  const transitionTitle = (action: string) => {
    if (action === 'pause') return t('production.runs.pauseRun');
    if (action === 'resume') return t('production.runs.resumeRun');
    if (action === 'complete') return t('production.runs.completeRun');
    if (action === 'abort') return t('production.runs.abortRun');
    return action;
  };

  const transitionConfirmation = (action: string) => {
    if (action === 'pause') return t('production.runs.pauseConfirmation');
    if (action === 'resume') return t('production.runs.resumeConfirmation');
    if (action === 'complete') return t('production.runs.completeConfirmation');
    if (action === 'abort') return t('production.runs.abortConfirmation');
    return '';
  };

  const plannedQuantity = toNumber(run.plannedQuantitySnapshot);
  const finalOutput = liveData?.totals ? toNumber(liveData.totals.finalOutputTotal) : 0;
  const wasteTotal = liveData?.totals ? toNumber(liveData.totals.wasteTotal) : 0;
  const reworkTotal = liveData?.totals ? toNumber(liveData.totals.reworkTotal) : 0;
  const correctionsTotal = liveData?.totals ? toNumber(liveData.totals.correctionsTotal) : 0;
  const progressPercent = liveData?.totals && liveData.totals.progressPercent !== undefined
    ? liveData.totals.progressPercent
    : (plannedQuantity > 0 ? Math.min(100, Math.round((finalOutput / plannedQuantity) * 100)) : 0);

  const statusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-green-100 text-green-800';
      case 'PAUSED': return 'bg-amber-100 text-amber-800';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800';
      case 'ABORTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const infoCell = (label: string, value: string) => (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900" dir={dir}>{value}</div>
    </div>
  );

  const summaryCard = (label: string, value: string | number) => (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900" dir="ltr">{value}</div>
    </div>
  );

  const recentEvents = liveData?.recentEvents?.slice(0, 20) || [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PageHeader title={run.runNumber} subtitle={t('production.runs.title')} />
        <div className="flex flex-wrap gap-2">
          {canTransition('pause') && <Button onClick={() => setTransition({ action: 'pause', reasonRequired: false })}>{t('production.runs.pauseRun')}</Button>}
          {canTransition('resume') && <Button onClick={() => setTransition({ action: 'resume', reasonRequired: false })}>{t('production.runs.resumeRun')}</Button>}
          {canTransition('complete') && <Button onClick={() => setTransition({ action: 'complete', reasonRequired: false })}>{t('production.runs.completeRun')}</Button>}
          {canTransition('abort') && <Button variant="danger" onClick={() => setTransition({ action: 'abort', reasonRequired: true })}>{t('production.runs.abortRun')}</Button>}
          <Button variant="secondary" onClick={() => router.push('/admin/production/runs')}>{t('common.backToList')}</Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className={'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ' + statusColor(run.status)}>
          {t(runStatusLabelKey(run.status))}
        </span>
        <span className="text-sm text-gray-600">{t('production.runs.orderNumber')}: {run.productionOrder?.orderNumber || run.orderNumberSnapshot}</span>
        <span className="text-sm text-gray-600">{t('production.runs.plannedQuantity')}: <span dir="ltr">{plannedQuantity} {run.quantityUnitSnapshot}</span></span>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {infoCell(t('production.line'), run.productionLine?.name || '-')}
        {infoCell(t('production.machine'), run.machine?.name || '-')}
        {infoCell(t('production.units'), run.productionUnit?.name || '-')}
        {infoCell(t('production.orders.costCenter'), run.costCenterId || '-')}
        {infoCell(t('production.runs.shift'), run.shiftNameSnapshot || '-')}
        {infoCell(t('production.runs.operator'), run.operationalPersonNameSnapshot || '-')}
        {infoCell(t('production.runs.startedAt'), run.startedAt ? new Date(run.startedAt).toLocaleString() : '-')}
        {infoCell(t('production.runs.endedAt'), run.endedAt ? new Date(run.endedAt).toLocaleString() : '-')}
        {infoCell(t('production.runs.assignmentSource'), t(assignmentSourceLabelKey(run.assignmentResolutionSource)))}
        {infoCell(t('common.notes'), run.notes || '-')}
      </div>

      <div className="mb-4 flex gap-2 border-b border-gray-200">
        {TABS.map((tabKey) => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={'px-4 py-2 text-sm font-medium ' + (tab === tabKey ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700')}>
            {t(TAB_LABEL_KEYS[tabKey] || 'production.runs.' + tabKey)}
          </button>
        ))}
      </div>

      {tab === 'live' && (
        <div className="space-y-6">
          {liveLoading && <div className="text-sm text-gray-500">{t('common.loading')}</div>}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{t('production.runs.progressPercent')}</span>
              <span className="text-sm font-semibold text-gray-700" dir="ltr">{progressPercent}%</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: Math.min(100, progressPercent) + '%' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryCard(t('production.runs.finalOutput'), finalOutput + ' ' + run.quantityUnitSnapshot)}
            {summaryCard(t('production.runs.waste'), wasteTotal + ' ' + run.quantityUnitSnapshot)}
            {summaryCard(t('production.runs.rework'), reworkTotal + ' ' + run.quantityUnitSnapshot)}
            {summaryCard(t('production.runs.corrections'), correctionsTotal + ' ' + run.quantityUnitSnapshot)}
          </div>

          <div>
            <div className="mb-2 font-semibold">{t('production.runs.sessions')}</div>
            <div className="space-y-2">
              {(liveData?.sessions || []).map((s) => (
                <div key={s.id} className={'rounded border p-3 text-sm ' + (s.closedAt ? 'border-gray-200 bg-gray-50' : 'border-green-300 bg-green-50')}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {new Date(s.startedAt).toLocaleString()}
                      {!s.closedAt && <span className="ms-2 text-xs font-semibold text-green-700">{t('production.runs.openSession')}</span>}
                    </span>
                  </div>
                  {s.closedAt ? (
                    <div className="mt-1 text-xs text-gray-600">{t('production.runs.sessionEnd')}: {new Date(s.closedAt).toLocaleString()}</div>
                  ) : null}
                </div>
              ))}
              {!liveLoading && !liveData?.sessions?.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}
            </div>
          </div>

          <div>
            <div className="mb-2 font-semibold">{t('production.runs.events')}</div>
            <div className="space-y-2">
              {recentEvents.map((e) => (
                <div key={e.id} className="rounded border border-gray-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.measurementPoint?.code} - {e.measurementPoint?.name}</span>
                    <span className="text-xs text-gray-500">{new Date(e.occurredAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span>{t(eventTypeLabelKey(e.eventType))}</span>
                    <span>·</span>
                    <span dir="ltr">{String(e.quantity)} {e.unit}</span>
                    {e.goodQuantity !== undefined && toNumber(e.goodQuantity) > 0 && <span>· {t('production.runs.goodQuantity')}: <span dir="ltr">{String(e.goodQuantity)}</span></span>}
                    {e.rejectQuantity !== undefined && toNumber(e.rejectQuantity) > 0 && <span>· {t('production.runs.rejectQuantity')}: <span dir="ltr">{String(e.rejectQuantity)}</span></span>}
                  </div>
                </div>
              ))}
              {!liveLoading && !recentEvents.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-4">
          {eventsLoading && <div className="text-sm text-gray-500">{t('common.loading')}</div>}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.runs.occurredAt')}</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.runs.eventType')}</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.measurementPoints.title')}</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.runs.quantity')}</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.runs.goodQuantity')}</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.runs.rejectQuantity')}</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">{t('common.notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(eventsData?.data || []).map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-4 py-2">{new Date(e.occurredAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{t(eventTypeLabelKey(e.eventType))}</td>
                    <td className="px-4 py-2">{e.measurementPoint?.code} - {e.measurementPoint?.name}</td>
                    <td className="px-4 py-2" dir="ltr">{String(e.quantity)} {e.unit}</td>
                    <td className="px-4 py-2" dir="ltr">{String(e.goodQuantity ?? '-')}</td>
                    <td className="px-4 py-2" dir="ltr">{String(e.rejectQuantity ?? '-')}</td>
                    <td className="px-4 py-2">{e.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!eventsLoading && !eventsData?.data?.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}
          {eventsData && eventsData.data.length > 0 && (
            <Pagination page={eventsData.meta.page} totalPages={eventsData.meta.totalPages} total={eventsData.meta.total} onPageChange={setEventsPage} />
          )}
        </div>
      )}

      {tab === 'output' && (
        <OutputForm
          runId={id}
          runStatus={run.status}
          productionLineId={run.productionLineId}
          machineId={run.machineId}
          measurementPoints={measurementPoints}
          onSuccess={refreshAfterOutput}
        />
      )}

      {tab === 'corrections' && (
        <CorrectionForm events={eventsData?.data || []} onSuccess={refreshAfterOutput} />
      )}

      {tab === 'losses' && (
        <div className="space-y-6">
          {lossesLoading && <div className="text-sm text-gray-500">{t('common.loading')}</div>}
          {!lossesLoading && lossesData && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {summaryCard(t('production.losses.typeWASTE'), (lossesData.totals?.WASTE || 0) + ' ')}
                {summaryCard(t('production.losses.typeSCRAP'), (lossesData.totals?.SCRAP || 0) + ' ')}
                {summaryCard(t('production.losses.typeREWORK_SENT'), (lossesData.totals?.REWORK_SENT || 0) + ' ')}
                {summaryCard(t('production.losses.typeREWORK_RECOVERED'), (lossesData.totals?.REWORK_RECOVERED || 0) + ' ')}
              </div>
              <div className="rounded border border-gray-200 p-3 text-sm">
                {t('production.downtime.title')}: <span dir="ltr">{lossesData.totalDowntimeMinutes} {t('production.downtime.durationMinutes')}</span>
              </div>
              <div>
                <div className="mb-2 font-semibold">{t('production.downtime.title')}</div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.downtime.startedAt')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.downtime.endedAt')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.downtime.durationMinutes')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.lossReasons.title')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.downtime.planned')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.downtime.severity')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.downtime.ownerDomain')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.downtime.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {(lossesData.segments || []).map((s) => (
                        <tr key={s.id}>
                          <td className="whitespace-nowrap px-4 py-2">{new Date(s.startedAt).toLocaleString()}</td>
                          <td className="whitespace-nowrap px-4 py-2">{s.endedAt ? new Date(s.endedAt).toLocaleString() : '-'}</td>
                          <td className="px-4 py-2" dir="ltr">{String(s.durationMinutes)}</td>
                          <td className="px-4 py-2">{s.reason ? `${s.reason.code} - ${s.reason.nameEn}` : '-'}</td>
                          <td className="px-4 py-2">{s.planned ? t('common.yes') : t('common.no')}</td>
                          <td className="px-4 py-2">{t('production.downtime.severity' + s.severity)}</td>
                          <td className="px-4 py-2">{t('production.downtime.owner' + s.ownerDomain)}</td>
                          <td className="px-4 py-2">{t('production.downtime.status' + s.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!lossesData.segments?.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}
              </div>
              <div>
                <div className="mb-2 font-semibold">{t('production.losses.title')}</div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.losses.occurredAt')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.losses.type')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.losses.stage')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.losses.quantity')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.lossReasons.title')}</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">{t('production.losses.reasonText')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {(lossesData.events || []).map((e) => (
                        <tr key={e.id}>
                          <td className="whitespace-nowrap px-4 py-2">{new Date(e.occurredAt).toLocaleString()}</td>
                          <td className="px-4 py-2">{t('production.losses.type' + e.type)}</td>
                          <td className="px-4 py-2">{e.stage || '-'}</td>
                          <td className="px-4 py-2" dir="ltr">{String(e.quantity)} {e.unit}</td>
                          <td className="px-4 py-2">{e.reasonRef ? `${e.reasonRef.code} - ${e.reasonRef.nameEn}` : '-'}</td>
                          <td className="px-4 py-2">{e.reason || e.correctionReason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!lossesData.events?.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}
                {lossesData.meta && lossesData.meta.total > 0 && (
                  <Pagination page={lossesData.meta.page} totalPages={lossesData.meta.totalPages} total={lossesData.meta.total} onPageChange={setLossesPage} />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {historyLoading && <div className="text-sm text-gray-500">{t('common.loading')}</div>}
          <div>
            <div className="mb-2 font-semibold">{t('production.runs.transitions')}</div>
            <div className="space-y-2">
              {(historyData?.transitions || []).map((tr) => (
                <div key={tr.id} className="rounded border border-gray-200 p-2 text-sm">
                  <span className="font-medium">{t(runStatusLabelKey(tr.fromStatus))}</span> → <span className="font-medium">{t(runStatusLabelKey(tr.toStatus))}</span> · {tr.action} · {new Date(tr.createdAt).toLocaleString()}
                  {tr.reason ? <div className="mt-1 text-xs text-gray-600">{t('production.runs.reason')}: {tr.reason}</div> : null}
                </div>
              ))}
              {!historyLoading && !historyData?.transitions?.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}
            </div>
          </div>
          <div>
            <div className="mb-2 font-semibold">{t('production.runs.auditTrail')}</div>
            <div className="space-y-2">
              {(historyData?.audits || []).map((a: any) => (
                <div key={a.id} className="rounded border border-gray-200 p-2 text-sm">
                  <span className="font-medium">{a.action}</span> · {new Date(a.createdAt).toLocaleString()}
                  {a.user?.name ? <span className="text-xs text-gray-500"> · {a.user.name}</span> : null}
                  {a.details ? <div className="mt-1 text-xs text-gray-600">{typeof a.details === 'string' ? a.details : JSON.stringify(a.details)}</div> : null}
                </div>
              ))}
              {!historyLoading && !historyData?.audits?.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}
            </div>
          </div>
        </div>
      )}

      <Modal open={Boolean(transition)} onClose={() => setTransition(null)} title={transitionTitle(transition?.action || '')}>
        <div className="space-y-4">
          <p>{transitionConfirmation(transition?.action || '')}</p>
          {transition?.reasonRequired && <Textarea label={t('production.runs.abortReason')} value={reason} onChange={(e) => setReason(e.target.value)} required />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTransition(null)}>{t('actions.cancel')}</Button>
            <Button onClick={runTransition} loading={acting} disabled={Boolean(transition?.reasonRequired && reason.trim().length < 3)}>{t('actions.confirm')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
