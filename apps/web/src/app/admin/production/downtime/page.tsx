'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { DowntimeSegment } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../components/f9/F9Lookup';
import { productionRunAdapter, productionOrderAdapter, productionLineAdapter, machineAdapter, productionShiftAdapter, productionLossReasonAdapter, maintenanceRequestAdapter, maintenanceWorkOrderAdapter } from '../../../../components/f9/lookup-adapters';

const DOWNTIME_STATUSES = ['OPEN', 'CLOSED', 'SUPERSEDED', 'CANCELLED'];
const OWNER_DOMAINS = ['MAINTENANCE', 'PRODUCTION', 'EXTERNAL'];
const SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'];

function statusLabelKey(value: string): string {
  return 'production.downtime.status' + value;
}

function ownerLabelKey(value: string): string {
  return 'production.downtime.owner' + value;
}

function severityLabelKey(value: string): string {
  return 'production.downtime.severity' + value;
}

function toNumber(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

type ActionType = 'open' | 'close' | 'correct' | 'cancel' | 'link';

export default function ProductionDowntimePage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<DowntimeSegment[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [action, setAction] = useState<ActionType | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    productionRunId: '',
    productionOrderId: '',
    productionLineId: '',
    machineId: '',
    shiftId: '',
    startedAt: new Date().toISOString().slice(0, 16),
    endedAt: new Date().toISOString().slice(0, 16),
    reasonId: '',
    reason: '',
    planned: false,
    severity: 'MINOR',
    ownerDomain: 'PRODUCTION',
    maintenanceRequestId: '',
    maintenanceWorkOrderId: '',
    notes: '',
    correctiveReason: '',
  });

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const resetForm = (preserve?: Partial<typeof form>) => {
    setForm({
      productionRunId: '', productionOrderId: '', productionLineId: '', machineId: '', shiftId: '',
      startedAt: new Date().toISOString().slice(0, 16),
      endedAt: new Date().toISOString().slice(0, 16),
      reasonId: '', reason: '', planned: false, severity: 'MINOR', ownerDomain: 'PRODUCTION',
      maintenanceRequestId: '', maintenanceWorkOrderId: '', notes: '', correctiveReason: '',
      ...preserve,
    });
    setValidationErrors({});
  };

  const { exec } = useStableHandlers({
    new: () => { resetForm(); setAction('open'); },
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'production.downtime.newSegment', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (ownerFilter) params.ownerDomain = ownerFilter;
      const res = await api.get<{ data: DowntimeSegment[]; meta: any }>('/production/downtime', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, ownerFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const handleSaveError = (err: any) => {
    const key = (err as any)?.messageKey;
    if (key && key.startsWith('productionDowntime.')) {
      handleApiError(err, { message: t('production.downtime.' + key.slice('productionDowntime.'.length)) });
      return;
    }
    handleApiError(err);
  };

  const handleOpen = async () => {
    const errors: Record<string, string> = {};
    if (!form.startedAt) errors.startedAt = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        requestId: crypto.randomUUID(),
        productionRunId: form.productionRunId || undefined,
        productionOrderId: form.productionOrderId || undefined,
        productionLineId: form.productionLineId || undefined,
        machineId: form.machineId || undefined,
        shiftId: form.shiftId || undefined,
        startedAt: form.startedAt || undefined,
        endedAt: form.endedAt || undefined,
        reasonId: form.reasonId || undefined,
        reason: form.reason || undefined,
        planned: form.planned,
        severity: form.severity,
        ownerDomain: form.ownerDomain,
        notes: form.notes || undefined,
      };
      await api.post('/production/downtime', payload);
      showToast(t('production.downtime.recordCompleted'), 'success');
      setAction(null); resetForm(); fetchData(meta.page);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleClose = async () => {
    const errors: Record<string, string> = {};
    if (!form.endedAt) errors.endedAt = t('production.downtime.closeReasonRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await api.patch(`/production/downtime/${selectedId}/close`, { endedAt: form.endedAt });
      showToast(t('production.downtime.closeCompleted'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleCorrect = async () => {
    const errors: Record<string, string> = {};
    if (!form.correctiveReason.trim()) errors.correctiveReason = t('production.downtime.correctReasonRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        reason: form.correctiveReason.trim(),
        startedAt: form.startedAt || undefined,
        endedAt: form.endedAt || undefined,
        reasonId: form.reasonId || undefined,
        planned: form.planned,
        severity: form.severity,
        ownerDomain: form.ownerDomain,
        shiftId: form.shiftId || undefined,
        productionLineId: form.productionLineId || undefined,
        machineId: form.machineId || undefined,
        notes: form.notes || undefined,
      };
      await api.patch(`/production/downtime/${selectedId}/correct`, payload);
      showToast(t('production.downtime.correctCompleted'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleCancel = async () => {
    const errors: Record<string, string> = {};
    if (!form.correctiveReason.trim()) errors.correctiveReason = t('production.downtime.cancelReasonRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await api.patch(`/production/downtime/${selectedId}/cancel`, { reason: form.correctiveReason.trim() });
      showToast(t('production.downtime.cancelCompleted'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleLink = async () => {
    const errors: Record<string, string> = {};
    if (!form.maintenanceRequestId) errors.maintenanceRequestId = t('production.downtime.selectMaintenanceRequest');
    if (!form.correctiveReason.trim()) errors.correctiveReason = t('production.downtime.linkReasonRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        maintenanceRequestId: form.maintenanceRequestId,
        maintenanceWorkOrderId: form.maintenanceWorkOrderId || undefined,
        reason: form.correctiveReason.trim(),
      };
      await api.patch(`/production/downtime/${selectedId}/link-maintenance`, payload);
      showToast(t('production.downtime.linkCompleted'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const confirmDialogOpen = action === 'close' || action === 'correct' || action === 'cancel';
  const confirmMessage =
    action === 'close' ? t('production.downtime.closeConfirmation')
    : action === 'correct' ? t('production.downtime.correctConfirmation')
    : action === 'cancel' ? t('production.downtime.cancelConfirmation') : '';

  const performAction = async () => {
    if (action === 'open') await handleOpen();
    if (action === 'close') await handleClose();
    if (action === 'correct') await handleCorrect();
    if (action === 'cancel') await handleCancel();
    if (action === 'link') await handleLink();
  };

  const columns: GridColumn<DowntimeSegment>[] = [
    { key: 'machine', header: t('production.downtime.machine'), render: (s) => s.machine?.name || '-' },
    { key: 'line', header: t('production.downtime.line'), render: (s) => s.productionLine?.name || '-' },
    { key: 'run', header: t('production.downtime.runNumber'), render: (s) => s.productionRun?.runNumber || '-' },
    { key: 'startedAt', header: t('production.downtime.startedAt'), render: (s) => new Date(s.startedAt).toLocaleString() },
    { key: 'endedAt', header: t('production.downtime.endedAt'), render: (s) => s.endedAt ? new Date(s.endedAt).toLocaleString() : '-' },
    { key: 'durationMinutes', header: t('production.downtime.durationMinutes'), render: (s) => <span dir="ltr">{String(s.durationMinutes)}</span> },
    { key: 'reason', header: t('production.lossReasons.title'), render: (s) => s.reason ? `${s.reason.code} - ${s.reason.nameEn}` : (s.downtimeLog?.reason || '-') },
    { key: 'planned', header: t('production.downtime.planned'), render: (s) => s.planned ? t('common.yes') : t('common.no') },
    { key: 'severity', header: t('production.downtime.severity'), render: (s) => t(severityLabelKey(s.severity)) },
    { key: 'ownerDomain', header: t('production.downtime.ownerDomain'), render: (s) => t(ownerLabelKey(s.ownerDomain)) },
    { key: 'status', header: t('production.downtime.status'), render: (s) => <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">{t(statusLabelKey(s.status))}</span> },
  ];

  const gridActions: GridAction<DowntimeSegment>[] = [
    {
      label: t('production.downtime.close'), onClick: (s) => { setSelectedId(s.id); resetForm({ endedAt: new Date().toISOString().slice(0, 16) }); setAction('close'); },
      enabled: (s) => s.status === 'OPEN',
    },
    {
      label: t('production.downtime.correct'), onClick: (s) => { setSelectedId(s.id); resetForm({ startedAt: s.startedAt.slice(0, 16), endedAt: s.endedAt ? s.endedAt.slice(0, 16) : new Date().toISOString().slice(0, 16), reasonId: s.reasonId || '', planned: s.planned, severity: s.severity, ownerDomain: s.ownerDomain }); setAction('correct'); },
      enabled: (s) => s.status === 'OPEN' || s.status === 'CLOSED',
    },
    {
      label: t('production.downtime.cancel'), onClick: (s) => { setSelectedId(s.id); resetForm(); setAction('cancel'); },
      enabled: (s) => s.status === 'OPEN',
      variant: 'danger',
    },
    {
      label: t('production.downtime.linkMaintenance'), onClick: (s) => { setSelectedId(s.id); resetForm(); setAction('link'); },
      enabled: (s) => s.status === 'OPEN' || s.status === 'CLOSED',
    },
  ];

  return (
    <div>
      <PageHeader title={t('production.downtime.title')} />
      <div className="mb-4 flex max-w-2xl gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.downtime.allStatuses')}
          options={DOWNTIME_STATUSES.map((value) => ({ value, label: t(statusLabelKey(value)) }))}
        />
        <Select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          placeholder={t('production.downtime.allOwnerDomains')}
          options={OWNER_DOMAINS.map((value) => ({ value, label: t(ownerLabelKey(value)) }))}
        />
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(s) => s.id}
        onRowClick={(s) => setSelectedId(s.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
        dir={dir}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(meta.page)}
        refreshLoading={loading}
      />
      {data.length > 0 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      )}

      <Modal open={action === 'open'} onClose={() => { setAction(null); resetForm(); }} title={t('production.downtime.openSegment')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('production.downtime.selectRun')} value={form.productionRunId} adapter={productionRunAdapter} onChange={(v) => setForm({ ...form, productionRunId: v })} />
            <F9Lookup label={t('production.downtime.selectOrder')} value={form.productionOrderId} adapter={productionOrderAdapter} onChange={(v) => setForm({ ...form, productionOrderId: v })} />
            <F9Lookup label={t('production.downtime.selectLine')} value={form.productionLineId} adapter={productionLineAdapter} onChange={(v) => setForm({ ...form, productionLineId: v })} />
            <F9Lookup label={t('production.downtime.selectMachine')} value={form.machineId} adapter={machineAdapter} onChange={(v) => setForm({ ...form, machineId: v })} />
            <F9Lookup label={t('production.downtime.selectShift')} value={form.shiftId} adapter={productionShiftAdapter} onChange={(v) => setForm({ ...form, shiftId: v })} />
            <F9Lookup label={t('production.downtime.reasonId')} value={form.reasonId} adapter={productionLossReasonAdapter} onChange={(v) => setForm({ ...form, reasonId: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label={t('production.downtime.startedAt')} type="datetime-local" value={form.startedAt} onChange={(e) => setForm({ ...form, startedAt: e.target.value })} required />
              {validationErrors.startedAt && <p className="text-red-500 text-sm mt-1">{validationErrors.startedAt}</p>}
            </div>
            <Input label={t('production.downtime.endedAt')} type="datetime-local" value={form.endedAt} onChange={(e) => setForm({ ...form, endedAt: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('production.downtime.severity')}
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              options={SEVERITIES.map((value) => ({ value, label: t(severityLabelKey(value)) }))}
            />
            <Select
              label={t('production.downtime.ownerDomain')}
              value={form.ownerDomain}
              onChange={(e) => setForm({ ...form, ownerDomain: e.target.value })}
              options={OWNER_DOMAINS.map((value) => ({ value, label: t(ownerLabelKey(value)) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('production.downtime.planned')}</label>
            <input type="checkbox" checked={form.planned} onChange={(e) => setForm({ ...form, planned: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
          </div>
          <Input label={t('production.downtime.reasonText')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <Textarea label={t('production.downtime.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setAction(null); resetForm(); }}>{t('actions.cancel')}</Button>
            <Button onClick={performAction} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={action === 'link'} onClose={() => { setAction(null); resetForm(); }} title={t('production.downtime.linkMaintenance')} size="lg">
        <div className="space-y-4">
          <div>
            <F9Lookup label={t('production.downtime.selectMaintenanceRequest')} value={form.maintenanceRequestId} adapter={maintenanceRequestAdapter} onChange={(v) => { setForm({ ...form, maintenanceRequestId: v }); setValidationErrors(prev => ({ ...prev, maintenanceRequestId: '' })); }} />
            {validationErrors.maintenanceRequestId && <p className="text-red-500 text-sm mt-1">{validationErrors.maintenanceRequestId}</p>}
          </div>
          <F9Lookup label={t('production.downtime.selectWorkOrder')} value={form.maintenanceWorkOrderId} adapter={maintenanceWorkOrderAdapter} onChange={(v) => setForm({ ...form, maintenanceWorkOrderId: v })} />
          <div>
            <Textarea label={t('production.downtime.linkReasonRequired')} value={form.correctiveReason} onChange={(e) => { setForm({ ...form, correctiveReason: e.target.value }); setValidationErrors(prev => ({ ...prev, correctiveReason: '' })); }} required />
            {validationErrors.correctiveReason && <p className="text-red-500 text-sm mt-1">{validationErrors.correctiveReason}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setAction(null); resetForm(); }}>{t('actions.cancel')}</Button>
            <Button onClick={performAction} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDialogOpen}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={performAction}
        title={action === 'close' ? t('production.downtime.closeSegment') : action === 'correct' ? t('production.downtime.correctSegment') : t('production.downtime.cancelSegment')}
        message={confirmMessage}
        variant="danger"
        loading={saving}
      >
        {action === 'correct' && (
          <div className="space-y-4 pt-3">
            <div>
              <Textarea label={t('production.downtime.correctReasonRequired')} value={form.correctiveReason} onChange={(e) => { setForm({ ...form, correctiveReason: e.target.value }); setValidationErrors(prev => ({ ...prev, correctiveReason: '' })); }} required />
              {validationErrors.correctiveReason && <p className="text-red-500 text-sm mt-1">{validationErrors.correctiveReason}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('production.downtime.startedAt')} type="datetime-local" value={form.startedAt} onChange={(e) => setForm({ ...form, startedAt: e.target.value })} />
              <Input label={t('production.downtime.endedAt')} type="datetime-local" value={form.endedAt} onChange={(e) => setForm({ ...form, endedAt: e.target.value })} />
              <F9Lookup label={t('production.downtime.reasonId')} value={form.reasonId} adapter={productionLossReasonAdapter} onChange={(v) => setForm({ ...form, reasonId: v })} />
              <div className="grid grid-cols-2 gap-4">
                <Select label={t('production.downtime.severity')} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} options={SEVERITIES.map((value) => ({ value, label: t(severityLabelKey(value)) }))} />
                <Select label={t('production.downtime.ownerDomain')} value={form.ownerDomain} onChange={(e) => setForm({ ...form, ownerDomain: e.target.value })} options={OWNER_DOMAINS.map((value) => ({ value, label: t(ownerLabelKey(value)) }))} />
              </div>
              <F9Lookup label={t('production.downtime.selectLine')} value={form.productionLineId} adapter={productionLineAdapter} onChange={(v) => setForm({ ...form, productionLineId: v })} />
              <F9Lookup label={t('production.downtime.selectMachine')} value={form.machineId} adapter={machineAdapter} onChange={(v) => setForm({ ...form, machineId: v })} />
              <F9Lookup label={t('production.downtime.selectShift')} value={form.shiftId} adapter={productionShiftAdapter} onChange={(v) => setForm({ ...form, shiftId: v })} />
            </div>
            <Input label={t('production.downtime.planned')} type="checkbox" checked={form.planned} onChange={(e) => setForm({ ...form, planned: e.target.checked })} />
            <Textarea label={t('production.downtime.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        )}
        {action === 'cancel' && (
          <div className="pt-3">
            <Textarea label={t('production.downtime.cancelReasonRequired')} value={form.correctiveReason} onChange={(e) => { setForm({ ...form, correctiveReason: e.target.value }); setValidationErrors(prev => ({ ...prev, correctiveReason: '' })); }} required />
            {validationErrors.correctiveReason && <p className="text-red-500 text-sm mt-1">{validationErrors.correctiveReason}</p>}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
