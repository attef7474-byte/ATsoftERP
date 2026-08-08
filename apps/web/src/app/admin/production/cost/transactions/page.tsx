'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { ProductionCostTransaction } from '../../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../../components/f9';
import { productionOrderAdapter, productionRunAdapter, productAdapter, productionLineAdapter, machineAdapter, productionShiftAdapter, costCenterAdapter, productionCostSnapshotAdapter } from '../../../../../components/f9';

const COST_TYPES = ['MATERIAL', 'LABOR', 'MACHINE', 'OVERHEAD'];
const COST_UNITS = ['PACK', 'UNIT', 'KG', 'TON', 'LITER', 'BATCH', 'HOUR', 'MINUTE'];
const SOURCE_TYPES = ['PRODUCTION_ORDER', 'PRODUCTION_RUN', 'OUTPUT_EVENT', 'FG_RECEIPT', 'MATERIAL_DOCUMENT', 'QUALITY_DISPOSITION', 'REVERSAL', 'MANUAL'];

function eventTypeLabelKey(value: string): string {
  return 'production.costTransactions.eventType' + value;
}

function sourceTypeLabelKey(value: string): string {
  return 'production.costTransactions.sourceType' + value;
}

function unitLabelKey(value: string): string {
  return 'production.costTransactions.unit' + value;
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ProductionCostTransactionsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionCostTransaction[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    clientRequestId: '',
    eventType: 'MATERIAL',
    sourceType: 'MANUAL',
    sourceId: '',
    sourceNumberSnapshot: '',
    productionOrderId: '',
    productionRunId: '',
    productId: '',
    productionLineId: '',
    machineId: '',
    shiftId: '',
    costCenterId: '',
    standardCostSnapshotId: '',
    quantity: '',
    unit: 'UNIT',
    rate: '',
    currencyCode: 'USD',
    occurredAt: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [confirmReverseOpen, setConfirmReverseOpen] = useState(false);
  const [reverseForm, setReverseForm] = useState({ clientRequestId: '', reason: '', notes: '' });
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (eventTypeFilter) params.eventType = eventTypeFilter;
      const res = await api.get<{ data: ProductionCostTransaction[]; meta: any }>('/production/cost-transactions', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, eventTypeFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setForm({
      clientRequestId: newUuid(),
      eventType: 'MATERIAL',
      sourceType: 'MANUAL',
      sourceId: '',
      sourceNumberSnapshot: '',
      productionOrderId: '',
      productionRunId: '',
      productId: '',
      productionLineId: '',
      machineId: '',
      shiftId: '',
      costCenterId: '',
      standardCostSnapshotId: '',
      quantity: '',
      unit: 'UNIT',
      rate: '',
      currencyCode: 'USD',
      occurredAt: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.eventType) errors.eventType = t('production.costTransactions.errors.eventTypeRequired');
    if (!form.sourceType) errors.sourceType = t('production.costTransactions.errors.sourceTypeRequired');
    if (!form.quantity || Number(form.quantity) <= 0) errors.quantity = t('production.costTransactions.errors.quantityRequired');
    if (!form.unit) errors.unit = t('production.costTransactions.errors.unitRequired');
    if (!form.rate || Number(form.rate) <= 0) errors.rate = t('production.costTransactions.errors.rateRequired');
    if (!form.occurredAt) errors.occurredAt = t('production.costTransactions.errors.occurredAtRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        clientRequestId: form.clientRequestId,
        eventType: form.eventType,
        sourceType: form.sourceType,
        sourceId: form.sourceId || form.sourceNumberSnapshot || form.clientRequestId,
        sourceNumberSnapshot: form.sourceNumberSnapshot || null,
        productionOrderId: form.productionOrderId || undefined,
        productionRunId: form.productionRunId || undefined,
        productId: form.productId || undefined,
        productionLineId: form.productionLineId || undefined,
        machineId: form.machineId || undefined,
        shiftId: form.shiftId || undefined,
        costCenterId: form.costCenterId || undefined,
        standardCostSnapshotId: form.standardCostSnapshotId || undefined,
        quantity: Number(form.quantity),
        unit: form.unit,
        rate: Number(form.rate),
        currencyCode: form.currencyCode || 'USD',
        occurredAt: form.occurredAt,
        notes: form.notes || null,
      };
      await api.post('/production/cost-transactions', payload);
      showToast(t('production.costTransactions.createCompleted'), 'success');
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const openReverse = (id: string) => {
    setSelectedId(id);
    setReverseForm({ clientRequestId: newUuid(), reason: '', notes: '' });
    setConfirmReverseOpen(true);
  };

  const handleReverse = async () => {
    if (!reverseForm.reason) {
      showToast(t('production.costTransactions.errors.reverseReasonRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/production/cost-transactions/${selectedId}/reverse`, {
        clientRequestId: reverseForm.clientRequestId,
        reason: reverseForm.reason,
        notes: reverseForm.notes || undefined,
      });
      showToast(t('production.costTransactions.reverseCompleted'), 'success');
      setConfirmReverseOpen(false); setSelectedId(''); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionCostTransaction>[] = [
    { key: 'sourceNumberSnapshot', header: t('production.costTransactions.sourceNumber'), render: (r) => r.sourceNumberSnapshot || r.sourceType },
    { key: 'eventType', header: t('production.costTransactions.eventType'), render: (r) => t(eventTypeLabelKey(r.eventType)) },
    { key: 'sourceType', header: t('production.costTransactions.sourceType'), render: (r) => t(sourceTypeLabelKey(r.sourceType)) },
    { key: 'quantity', header: t('production.costTransactions.quantity'), render: (r) => `${r.quantity} ${t(unitLabelKey(r.unit))}` },
    { key: 'rate', header: t('production.costTransactions.rate'), render: (r) => r.rate },
    { key: 'amount', header: t('production.costTransactions.amount'), render: (r) => `${r.amount} ${r.currencyCode}` },
    { key: 'standardAmount', header: t('production.costTransactions.standardAmount'), render: (r) => (r.standardAmount != null ? `${r.standardAmount} ${r.currencyCode}` : '-') },
    { key: 'varianceAmount', header: t('production.costTransactions.varianceAmount'), render: (r) => (r.varianceAmount != null ? `${r.varianceAmount} ${r.currencyCode}` : '-') },
    { key: 'occurredAt', header: t('production.costTransactions.occurredAt'), render: (r) => new Date(r.occurredAt).toLocaleDateString() },
    { key: 'status', header: t('production.costTransactions.status'), render: (r) => <CmmsStatusBadge status={r.status} /> },
  ];

  const gridActions: GridAction<ProductionCostTransaction>[] = [
    { label: t('production.costTransactions.reverse'), onClick: (r) => openReverse(r.id), enabled: (r) => r.status === 'POSTED', variant: 'danger' },
  ];

  return (
    <div>
      <PageHeader title={t('production.costTransactions.title')} />
      <div className="mb-4 flex max-w-3xl gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.costTransactions.allStatuses')}
          options={[
            { value: 'POSTED', label: t('production.costTransactions.statusPOSTED') },
            { value: 'REVERSED', label: t('production.costTransactions.statusREVERSED') },
          ]}
        />
        <Select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          placeholder={t('production.costTransactions.allEventTypes')}
          options={COST_TYPES.map((value) => ({ value, label: t(eventTypeLabelKey(value)) }))}
        />
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('production.costTransactions.newTransaction')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Select
                label={t('production.costTransactions.eventType')}
                value={form.eventType}
                onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                options={COST_TYPES.map((value) => ({ value, label: t(eventTypeLabelKey(value)) }))}
              />
            </div>
            <div>
              <Select
                label={t('production.costTransactions.sourceType')}
                value={form.sourceType}
                onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                options={SOURCE_TYPES.map((value) => ({ value, label: t(sourceTypeLabelKey(value)) }))}
              />
            </div>
            <div>
              <Input label={t('production.costTransactions.sourceId')} value={form.sourceId} onChange={(e) => setForm({ ...form, sourceId: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label={t('production.costTransactions.sourceNumber')} value={form.sourceNumberSnapshot} onChange={(e) => setForm({ ...form, sourceNumberSnapshot: e.target.value })} />
            </div>
            <div>
              <Input label={t('production.costTransactions.occurredAt')} type="date" value={form.occurredAt} onChange={(e) => { setForm({ ...form, occurredAt: e.target.value }); setValidationErrors(prev => ({ ...prev, occurredAt: '' })); }} required />
              {validationErrors.occurredAt && <p className="text-red-500 text-sm mt-1">{validationErrors.occurredAt}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Input label={t('production.costTransactions.quantity')} type="number" step="0.0001" min="0" value={form.quantity} onChange={(e) => { setForm({ ...form, quantity: e.target.value }); setValidationErrors(prev => ({ ...prev, quantity: '' })); }} required />
              {validationErrors.quantity && <p className="text-red-500 text-sm mt-1">{validationErrors.quantity}</p>}
            </div>
            <div>
              <Select
                label={t('production.costTransactions.unit')}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                options={COST_UNITS.map((value) => ({ value, label: t(unitLabelKey(value)) }))}
              />
            </div>
            <div>
              <Input label={t('production.costTransactions.rate')} type="number" step="0.0001" min="0" value={form.rate} onChange={(e) => { setForm({ ...form, rate: e.target.value }); setValidationErrors(prev => ({ ...prev, rate: '' })); }} required />
              {validationErrors.rate && <p className="text-red-500 text-sm mt-1">{validationErrors.rate}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Input label={t('production.costTransactions.currencyCode')} value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })} maxLength={10} />
            </div>
            <div>
              <F9Lookup
                label={t('production.costTransactions.order')}
                adapter={productionOrderAdapter}
                value={form.productionOrderId}
                onChange={(value) => setForm({ ...form, productionOrderId: value })}
              />
            </div>
            <div>
              <F9Lookup
                label={t('production.costTransactions.run')}
                adapter={productionRunAdapter}
                value={form.productionRunId}
                onChange={(value) => setForm({ ...form, productionRunId: value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <F9Lookup
                label={t('production.costTransactions.product')}
                adapter={productAdapter}
                value={form.productId}
                onChange={(value) => setForm({ ...form, productId: value })}
              />
            </div>
            <div>
              <F9Lookup
                label={t('production.costTransactions.line')}
                adapter={productionLineAdapter}
                value={form.productionLineId}
                onChange={(value) => setForm({ ...form, productionLineId: value })}
              />
            </div>
            <div>
              <F9Lookup
                label={t('production.costTransactions.machine')}
                adapter={machineAdapter}
                value={form.machineId}
                onChange={(value) => setForm({ ...form, machineId: value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <F9Lookup
                label={t('production.costTransactions.shift')}
                adapter={productionShiftAdapter}
                value={form.shiftId}
                onChange={(value) => setForm({ ...form, shiftId: value })}
              />
            </div>
            <div>
              <F9Lookup
                label={t('production.costTransactions.costCenter')}
                adapter={costCenterAdapter}
                value={form.costCenterId}
                onChange={(value) => setForm({ ...form, costCenterId: value })}
              />
            </div>
            <div>
              <F9Lookup
                label={t('production.costTransactions.standardSnapshot')}
                adapter={productionCostSnapshotAdapter}
                value={form.standardCostSnapshotId}
                onChange={(value) => setForm({ ...form, standardCostSnapshotId: value })}
              />
            </div>
          </div>
          <Textarea label={t('production.costTransactions.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmReverseOpen} onClose={() => setConfirmReverseOpen(false)} title={t('production.costTransactions.reverse')} size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('production.costTransactions.reverseConfirmation')}</p>
          <div>
            <Input label={t('production.costTransactions.reverseReason')} value={reverseForm.reason} onChange={(e) => setReverseForm({ ...reverseForm, reason: e.target.value })} required />
          </div>
          <div>
            <Textarea label={t('production.costTransactions.notes')} value={reverseForm.notes} onChange={(e) => setReverseForm({ ...reverseForm, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setConfirmReverseOpen(false)}>{t('actions.cancel')}</Button>
            <Button variant="danger" onClick={handleReverse} loading={saving}>{t('production.costTransactions.reverse')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
