'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../components/admin/error-handler';
import { AdminDataGrid, GridColumn } from '../../../components/admin/datagrid';
import { Button, Card, Modal } from '../../../components/admin/ui';
import { F9Lookup } from '../../../components/f9';
import { productionLineAdapter, productionShiftCalendarAdapter } from '../../../components/f9/lookup-adapters';
import type {
  ApplyPlanningResult,
  PlanningDraftResult,
  PlanningResourceLoad,
  ScheduledOperation,
  UnscheduledOperation,
} from '../../../lib/admin-types';

function toLocalInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayStart(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function dayEnd(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59`).toISOString();
}

function formatInstant(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

export function ProductionSchedulingPanel() {
  const { t, dir, locale } = useTranslation() as any;
  const { isSuperAdmin, permissions } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const can = useCallback(
    (permission: string) => isSuperAdmin || Boolean(permissions?.permissions?.includes(permission)),
    [isSuperAdmin, permissions],
  );
  const canApply = can('production-order:plan');

  const today = useMemo(() => new Date(), []);
  const defaultTo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d;
  }, []);

  const [horizonFrom, setHorizonFrom] = useState(toLocalInput(today));
  const [horizonTo, setHorizonTo] = useState(toLocalInput(defaultTo));
  const [calendarId, setCalendarId] = useState('');
  const [productionLineId, setProductionLineId] = useState('');

  const [draft, setDraft] = useState<PlanningDraftResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmApply, setConfirmApply] = useState(false);

  const buildPayload = useCallback(() => {
    const payload: Record<string, unknown> = {
      horizonFrom: dayStart(horizonFrom),
      horizonTo: dayEnd(horizonTo),
    };
    if (calendarId) payload.calendarId = calendarId;
    if (productionLineId) payload.productionLineId = productionLineId;
    return payload;
  }, [horizonFrom, horizonTo, calendarId, productionLineId]);

  const runPreview = useCallback(async () => {
    setPreviewing(true);
    setDraft(null);
    setSelected({});
    try {
      const result = await api.post<PlanningDraftResult>('/production/planning/preview', buildPayload());
      setDraft(result);
      const initial: Record<string, boolean> = {};
      for (const op of result.scheduled) initial[op.orderId] = true;
      setSelected(initial);
    } catch (err) {
      handleApiError(err);
    } finally {
      setPreviewing(false);
    }
  }, [buildPayload, handleApiError]);

  const selectedOps = useMemo(
    () => (draft?.scheduled ?? []).filter((op) => selected[op.orderId]),
    [draft, selected],
  );

  const runApply = useCallback(async () => {
    if (!draft) {
      showToast(t('production.planning.previewFirst'), 'error');
      return;
    }
    if (selectedOps.length === 0) {
      showToast(t('production.planning.applyNoneSelected'), 'error');
      return;
    }
    setApplying(true);
    try {
      const result = await api.post<ApplyPlanningResult>('/production/planning/apply', {
        ...buildPayload(),
        plans: selectedOps.map((op) => ({
          orderId: op.orderId,
          lockVersion: 0,
          scheduledStartAt: op.scheduledStartAt,
          scheduledEndAt: op.scheduledEndAt,
        })),
      });
      showToast(t('production.planning.applyCompleted', { count: result.applied }), 'success');
      if (result.rejected > 0) {
        showToast(t('production.planning.applyRejected', { count: result.rejected }), 'error');
      }
      setConfirmApply(false);
      await runPreview();
    } catch (err) {
      handleApiError(err);
    } finally {
      setApplying(false);
    }
  }, [draft, selectedOps, buildPayload, showToast, t, runPreview, handleApiError]);

  const scheduledColumns: GridColumn<ScheduledOperation & { _select: string }>[] = [
    {
      key: '_select',
      header: t('production.planning.selectRow'),
      width: '56px',
      render: (row) => (
        <input
          type="checkbox"
          aria-label={t('production.planning.selectRow')}
          checked={Boolean(selected[row.orderId])}
          onChange={(e) => setSelected((prev) => ({ ...prev, [row.orderId]: e.target.checked }))}
        />
      ),
    },
    { key: 'orderNumber', header: t('production.planning.order'), render: (row) => row.orderNumber },
    { key: 'priority', header: t('production.planning.priority') },
    {
      key: 'originalStartAt',
      header: t('production.planning.originalWindow'),
      render: (row) => `${formatInstant(row.originalStartAt, locale)} → ${formatInstant(row.originalEndAt, locale)}`,
    },
    {
      key: 'scheduledStartAt',
      header: t('production.planning.scheduledWindow'),
      render: (row) => `${formatInstant(row.scheduledStartAt, locale)} → ${formatInstant(row.scheduledEndAt, locale)}`,
    },
    { key: 'productionLineId', header: t('production.planning.line') },
    { key: 'plannedDurationMinutes', header: t('production.planning.duration') },
    {
      key: 'latenessState',
      header: t('production.planning.lateness'),
      render: (row) => `${row.latenessState === 'LATE' ? t('production.planning.late') : t('production.planning.onTime')} (${row.latenessMinutes})`,
    },
    {
      key: 'materialState',
      header: t('production.planning.material'),
      render: (row) =>
        row.materialState === 'SHORTAGE'
          ? t('production.planning.materialShortage')
          : row.materialState === 'READY'
          ? t('production.planning.materialReady')
          : t('production.planning.materialUnknown'),
    },
    {
      key: 'changed',
      header: t('production.planning.state'),
      render: (row) => (row.changed ? t('production.planning.changed') : t('production.planning.notChanged')),
    },
  ];

  const unscheduledColumns: GridColumn<UnscheduledOperation>[] = [
    { key: 'orderNumber', header: t('production.planning.order') },
    { key: 'priority', header: t('production.planning.priority') },
    {
      key: 'reasons',
      header: t('production.planning.reasonCodes'),
      render: (row) => row.reasonKeys.map((key) => t(key)).join(', '),
    },
  ];

  const loadColumns: GridColumn<PlanningResourceLoad>[] = [
    { key: 'label', header: t('production.planning.line') },
    { key: 'usedMinutes', header: t('production.planning.usedMinutes') },
    { key: 'availableMinutes', header: t('production.planning.availableMinutes') },
    {
      key: 'utilizationPercent',
      header: t('production.planning.utilization'),
      render: (row) => `${Number(row.utilizationPercent).toFixed(2)}%`,
    },
    { key: 'operationCount', header: t('production.planning.operationCount') },
  ];

  const totals = draft?.totals;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-gray-600">{t('production.planning.description')}</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-gray-600">
            {t('production.planning.horizonFrom')}
            <input
              type="date"
              className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
              value={horizonFrom}
              onChange={(e) => setHorizonFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-xs text-gray-600">
            {t('production.planning.horizonTo')}
            <input
              type="date"
              className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
              value={horizonTo}
              onChange={(e) => setHorizonTo(e.target.value)}
            />
          </label>
          <div className="w-64">
            <F9Lookup
              label={t('production.planning.calendar')}
              value={calendarId}
              onChange={setCalendarId}
              adapter={productionShiftCalendarAdapter}
              placeholder={t('production.planning.calendarAuto')}
            />
          </div>
          <div className="w-64">
            <F9Lookup
              label={t('production.planning.productionLine')}
              value={productionLineId}
              onChange={setProductionLineId}
              adapter={productionLineAdapter}
              placeholder={t('production.planning.allLines')}
            />
          </div>
          <Button onClick={runPreview} disabled={previewing}>
            {previewing ? t('common.loading') : t('production.planning.preview')}
          </Button>
          <Button
            onClick={() => setConfirmApply(true)}
            disabled={!draft || selectedOps.length === 0 || applying || !canApply}
          >
            {t('production.planning.applySelected')}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">{t('production.planning.previewHint')}</p>
        {!canApply && <p className="mt-1 text-xs text-amber-600">{t('production.planning.applyHint')}</p>}
      </Card>

      {draft && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card><div className="text-xs text-gray-500">{t('production.planning.requested')}</div><div className="text-lg font-semibold">{totals?.requested ?? 0}</div></Card>
          <Card><div className="text-xs text-gray-500">{t('production.planning.scheduledCount')}</div><div className="text-lg font-semibold">{totals?.scheduled ?? 0}</div></Card>
          <Card><div className="text-xs text-gray-500">{t('production.planning.unscheduledCount')}</div><div className="text-lg font-semibold">{totals?.unscheduled ?? 0}</div></Card>
          <Card><div className="text-xs text-gray-500">{t('production.planning.lateCount')}</div><div className="text-lg font-semibold">{totals?.late ?? 0}</div></Card>
          <Card><div className="text-xs text-gray-500">{t('production.planning.shortageRisk')}</div><div className="text-lg font-semibold">{totals?.shortageRisk ?? 0}</div></Card>
        </div>
      )}

      {draft && (
        <>
          <section>
            <h3 className="mb-2 text-sm font-semibold">{t('production.planning.scheduledTitle')}</h3>
            <AdminDataGrid<ScheduledOperation & { _select: string }>
              columns={scheduledColumns}
              data={draft.scheduled as any}
              keyExtractor={(row) => row.orderId}
              emptyMessage={t('production.planning.noScheduled')}
              dir={dir}
            />
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">{t('production.planning.unscheduledTitle')}</h3>
            <AdminDataGrid<UnscheduledOperation>
              columns={unscheduledColumns}
              data={draft.unscheduled}
              keyExtractor={(row) => row.orderId}
              emptyMessage={t('production.planning.noUnscheduled')}
              dir={dir}
            />
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">{t('production.planning.resourceLoadTitle')}</h3>
            <AdminDataGrid<PlanningResourceLoad>
              columns={loadColumns}
              data={draft.resourceLoad}
              keyExtractor={(row) => `${row.productionLineId}:${row.machineId ?? '-'}`}
              emptyMessage={t('production.planning.empty')}
              dir={dir}
            />
          </section>
        </>
      )}

      <Modal open={confirmApply} onClose={() => setConfirmApply(false)} title={t('production.planning.apply')}>
        <p className="text-sm text-gray-700">{t('production.planning.applyConfirmation', { count: selectedOps.length })}</p>
        <p className="mt-2 text-xs text-gray-500">{t('production.planning.applyHint')}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmApply(false)}>{t('common.cancel')}</Button>
          <Button onClick={runApply} disabled={applying}>{applying ? t('common.loading') : t('production.planning.apply')}</Button>
        </div>
      </Modal>
    </div>
  );
}
