'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { ProductionLossQuantityEvent } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../components/f9/F9Lookup';
import { productionRunAdapter, productionOrderAdapter, productionLineAdapter, machineAdapter, productionMeasurementPointAdapter, productionLossReasonAdapter } from '../../../../components/f9/lookup-adapters';

const LOSS_TYPES = ['WASTE', 'SCRAP', 'REWORK_SENT', 'REWORK_RECOVERED'];

function typeLabelKey(value: string): string {
  return 'production.losses.type' + value;
}

function toNumber(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

type ActionType = 'record' | 'correct';

export default function ProductionLossesPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionLossQuantityEvent[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [action, setAction] = useState<ActionType | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [reworkSources, setReworkSources] = useState<ProductionLossQuantityEvent[]>([]);

  const [form, setForm] = useState({
    type: 'WASTE',
    quantity: '',
    unit: 'UNIT',
    productionRunId: '',
    productionOrderId: '',
    productionLineId: '',
    machineId: '',
    measurementPointId: '',
    stage: '',
    reasonId: '',
    reason: '',
    sourceEventId: '',
    occurredAt: new Date().toISOString().slice(0, 16),
    notes: '',
    correctiveReason: '',
  });

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const resetForm = (preserve?: Partial<typeof form>) => {
    setForm({
      type: 'WASTE', quantity: '', unit: 'UNIT',
      productionRunId: '', productionOrderId: '', productionLineId: '', machineId: '',
      measurementPointId: '', stage: '', reasonId: '', reason: '', sourceEventId: '',
      occurredAt: new Date().toISOString().slice(0, 16), notes: '', correctiveReason: '',
      ...preserve,
    });
    setValidationErrors({});
  };

  const { exec } = useStableHandlers({
    new: () => { resetForm(); setAction('record'); },
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'production.losses.recordLoss', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const res = await api.get<{ data: ProductionLossQuantityEvent[]; meta: any }>('/production/loss-quantity-events', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, typeFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const loadReworkSources = useCallback(async () => {
    try {
      const res = await api.get<{ data: ProductionLossQuantityEvent[] }>('/production/loss-quantity-events', { params: { type: 'REWORK_SENT', limit: 50 } });
      setReworkSources(res.data || []);
    } catch (err) { handleApiError(err); }
  }, [handleApiError]);

  useEffect(() => {
    if (form.type === 'REWORK_RECOVERED') loadReworkSources();
  }, [form.type, loadReworkSources]);

  const handleSaveError = (err: any) => {
    const key = (err as any)?.messageKey;
    if (key && key.startsWith('productionLoss.')) {
      handleApiError(err, { message: t('production.losses.' + key.slice('productionLoss.'.length)) });
      return;
    }
    handleApiError(err);
  };

  const handleRecord = async () => {
    const errors: Record<string, string> = {};
    if (!form.quantity || toNumber(form.quantity) <= 0) errors.quantity = t('validation.required');
    if (!form.unit.trim()) errors.unit = t('validation.required');
    if (form.type === 'REWORK_RECOVERED' && !form.sourceEventId) errors.sourceEventId = t('production.losses.recoveryRequiresSource');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        requestId: crypto.randomUUID(),
        type: form.type,
        quantity: toNumber(form.quantity),
        unit: form.unit.trim(),
        productionRunId: form.productionRunId || undefined,
        productionOrderId: form.productionOrderId || undefined,
        productionLineId: form.productionLineId || undefined,
        machineId: form.machineId || undefined,
        measurementPointId: form.measurementPointId || undefined,
        stage: form.stage || undefined,
        reasonId: form.reasonId || undefined,
        reason: form.reason || undefined,
        sourceEventId: form.sourceEventId || undefined,
        occurredAt: form.occurredAt || undefined,
        notes: form.notes || undefined,
      };
      await api.post('/production/loss-quantity-events', payload);
      showToast(t('production.losses.recordCompleted'), 'success');
      setAction(null); resetForm(); fetchData(meta.page);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const handleCorrect = async () => {
    const errors: Record<string, string> = {};
    if (!form.correctiveReason.trim()) errors.correctiveReason = t('production.losses.correctionReasonRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        requestId: crypto.randomUUID(),
        reason: form.correctiveReason.trim(),
        quantity: form.quantity ? toNumber(form.quantity) : undefined,
        reasonId: form.reasonId || undefined,
        occurredAt: form.occurredAt || undefined,
        notes: form.notes || undefined,
      };
      await api.patch(`/production/loss-quantity-events/${selectedId}/correct`, payload);
      showToast(t('production.losses.correctCompleted'), 'success');
      setAction(null); resetForm(); setSelectedId(''); fetchData(meta.page);
    } catch (err: any) { handleSaveError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionLossQuantityEvent>[] = [
    { key: 'occurredAt', header: t('production.losses.occurredAt'), render: (e) => new Date(e.occurredAt).toLocaleString() },
    { key: 'type', header: t('production.losses.type'), render: (e) => t(typeLabelKey(e.type)) },
    { key: 'run', header: t('production.losses.runNumber'), render: (e) => e.productionRun?.runNumber || '-' },
    { key: 'machine', header: t('production.losses.machine'), render: (e) => e.machine?.name || '-' },
    { key: 'stage', header: t('production.losses.stage'), render: (e) => e.stage || '-' },
    { key: 'quantity', header: t('production.losses.quantity'), render: (e) => <span dir="ltr">{String(e.quantity)} {e.unit}</span> },
    { key: 'reason', header: t('production.lossReasons.title'), render: (e) => e.reasonRef ? `${e.reasonRef.code} - ${e.reasonRef.nameEn}` : (e.reason || '-') },
    { key: 'corrected', header: t('production.losses.correctEvent'), render: (e) => e.correctsEvent ? t('common.yes') : '-' },
  ];

  const gridActions: GridAction<ProductionLossQuantityEvent>[] = [
    {
      label: t('production.losses.correctEvent'),
      onClick: (e) => { setSelectedId(e.id); resetForm({ quantity: String(e.quantity), reasonId: e.reasonId || '', occurredAt: new Date().toISOString().slice(0, 16), notes: e.notes || '' }); setAction('correct'); },
      enabled: (e) => !e.correctsEvent,
    },
  ];

  return (
    <div>
      <PageHeader title={t('production.losses.title')} />
      <p className="mb-4 text-sm text-gray-500">{t('production.losses.noInventoryPosting')}</p>
      <div className="mb-4 flex max-w-2xl gap-3">
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          placeholder={t('production.losses.allTypes')}
          options={LOSS_TYPES.map((value) => ({ value, label: t(typeLabelKey(value)) }))}
        />
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(e) => e.id}
        onRowClick={(e) => setSelectedId(e.id)}
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

      <Modal open={action === 'record'} onClose={() => { setAction(null); resetForm(); }} title={t('production.losses.recordLoss')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select
                label={t('production.losses.type')}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value, sourceEventId: '' })}
                options={LOSS_TYPES.map((value) => ({ value, label: t(typeLabelKey(value)) }))}
              />
            </div>
            <div>
              <Input label={t('production.losses.quantity')} type="number" step="any" value={form.quantity} onChange={(e) => { setForm({ ...form, quantity: e.target.value }); setValidationErrors(prev => ({ ...prev, quantity: '' })); }} required />
              {validationErrors.quantity && <p className="text-red-500 text-sm mt-1">{validationErrors.quantity}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label={t('production.losses.unit')} value={form.unit} onChange={(e) => { setForm({ ...form, unit: e.target.value }); setValidationErrors(prev => ({ ...prev, unit: '' })); }} required />
              {validationErrors.unit && <p className="text-red-500 text-sm mt-1">{validationErrors.unit}</p>}
            </div>
            <div>
              <Input label={t('production.losses.stage')} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('production.losses.selectRun')} value={form.productionRunId} adapter={productionRunAdapter} onChange={(v) => setForm({ ...form, productionRunId: v })} />
            <F9Lookup label={t('production.losses.selectOrder')} value={form.productionOrderId} adapter={productionOrderAdapter} onChange={(v) => setForm({ ...form, productionOrderId: v })} />
            <F9Lookup label={t('production.losses.line')} value={form.productionLineId} adapter={productionLineAdapter} onChange={(v) => setForm({ ...form, productionLineId: v })} />
            <F9Lookup label={t('production.losses.machine')} value={form.machineId} adapter={machineAdapter} onChange={(v) => setForm({ ...form, machineId: v })} />
            <F9Lookup label={t('production.losses.selectMeasurementPoint')} value={form.measurementPointId} adapter={productionMeasurementPointAdapter} onChange={(v) => setForm({ ...form, measurementPointId: v })} />
            <F9Lookup label={t('production.lossReasons.title')} value={form.reasonId} adapter={productionLossReasonAdapter} onChange={(v) => setForm({ ...form, reasonId: v })} />
          </div>
          {form.type === 'REWORK_RECOVERED' && (
            <div>
              <Select
                label={t('production.losses.selectSourceEvent')}
                value={form.sourceEventId}
                onChange={(e) => { setForm({ ...form, sourceEventId: e.target.value }); setValidationErrors(prev => ({ ...prev, sourceEventId: '' })); }}
                placeholder={t('production.losses.selectSourceEvent')}
                options={reworkSources.map((s) => ({ value: s.id, label: `${s.id.slice(0, 8)} - ${String(s.quantity)} ${s.unit} - ${new Date(s.occurredAt).toLocaleString()}` }))}
              />
              {validationErrors.sourceEventId && <p className="text-red-500 text-sm mt-1">{validationErrors.sourceEventId}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('production.losses.occurredAt')} type="datetime-local" value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} />
            <Input label={t('production.losses.reasonText')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <Textarea label={t('production.losses.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setAction(null); resetForm(); }}>{t('actions.cancel')}</Button>
            <Button onClick={handleRecord} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={action === 'correct'}
        onClose={() => { setAction(null); resetForm(); }}
        onConfirm={handleCorrect}
        title={t('production.losses.correctEvent')}
        message={t('production.losses.correctCompleted')}
        variant="danger"
        loading={saving}
      >
        <div className="space-y-4 pt-3">
          <div>
            <Textarea label={t('production.losses.correctionReasonRequired')} value={form.correctiveReason} onChange={(e) => { setForm({ ...form, correctiveReason: e.target.value }); setValidationErrors(prev => ({ ...prev, correctiveReason: '' })); }} required />
            {validationErrors.correctiveReason && <p className="text-red-500 text-sm mt-1">{validationErrors.correctiveReason}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('production.losses.quantity')} type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <F9Lookup label={t('production.lossReasons.title')} value={form.reasonId} adapter={productionLossReasonAdapter} onChange={(v) => setForm({ ...form, reasonId: v })} />
          </div>
          <Textarea label={t('production.losses.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </ConfirmDialog>
    </div>
  );
}
