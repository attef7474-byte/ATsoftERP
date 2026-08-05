'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { ProductionInspection, ProductionQualityPlan, QualityCharacteristic, ProductionQualityDisposition } from '../../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../../components/f9';
import { productionQualityPlanAdapter, productionOrderAdapter, productionRunAdapter, productAdapter, productionLineAdapter, machineAdapter, productionShiftAdapter, costCenterAdapter } from '../../../../../components/f9';

const QUALITY_UNITS = ['PACK', 'UNIT', 'KG', 'TON', 'LITER', 'BATCH'];
const DISPOSITION_ACTIONS = ['RELEASE', 'REJECT', 'REWORK', 'SCRAP'];
const INSPECTION_STATUSES = ['OPEN', 'COMPLETED', 'HELD', 'DISPOSITIONED'];

function statusLabelKey(value: string): string {
  return 'production.inspections.status' + value;
}

function unitLabelKey(value: string): string {
  return 'production.inspections.unit' + value;
}

function actionLabelKey(value: string): string {
  return 'production.inspections.action' + value;
}

function dispositionStatusLabelKey(value: string): string {
  return 'production.inspections.dispositionStatus' + value;
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type DetailTab = 'details' | 'results' | 'dispositions' | 'ncrs';

interface ResultEntryValue {
  value: string;
  pass: boolean;
}

export default function ProductionInspectionsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionInspection[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    planId: '',
    clientRequestId: '',
    productionOrderId: '',
    productionRunId: '',
    productId: '',
    productionLineId: '',
    machineId: '',
    shiftId: '',
    costCenterId: '',
    sampledQuantity: '',
    unit: 'UNIT',
    inspectedAt: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ProductionInspection | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('details');

  const [resultsOpen, setResultsOpen] = useState(false);
  const [plan, setPlan] = useState<ProductionQualityPlan | null>(null);
  const [resultEntries, setResultEntries] = useState<Record<string, ResultEntryValue>>({});

  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  const [dispositionOpen, setDispositionOpen] = useState(false);
  const [dispositionForm, setDispositionForm] = useState({
    action: 'RELEASE', quantity: '', unit: 'UNIT', reason: '', notes: '',
  });

  const [confirmApproveDisposition, setConfirmApproveDisposition] = useState<ProductionQualityDisposition | null>(null);
  const [rejectDispositionOpen, setRejectDispositionOpen] = useState<ProductionQualityDisposition | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [selectedId, setSelectedId] = useState('');

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
      const res = await api.get<{ data: ProductionInspection[]; meta: any }>('/production/inspections', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setForm({
      planId: '', clientRequestId: newUuid(),
      productionOrderId: '', productionRunId: '', productId: '',
      productionLineId: '', machineId: '', shiftId: '', costCenterId: '',
      sampledQuantity: '', unit: 'UNIT',
      inspectedAt: new Date().toISOString().slice(0, 10), notes: '',
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.planId) errors.planId = t('production.inspections.errors.planRequired');
    if (!form.clientRequestId) errors.clientRequestId = t('production.inspections.errors.clientRequestIdRequired');
    if (!form.sampledQuantity || Number(form.sampledQuantity) <= 0) errors.sampledQuantity = t('production.inspections.errors.sampledQuantityRequired');
    if (!form.unit) errors.unit = t('production.inspections.errors.unitRequired');
    if (!form.inspectedAt) errors.inspectedAt = t('production.inspections.errors.inspectedAtRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        planId: form.planId,
        clientRequestId: form.clientRequestId,
        productionOrderId: form.productionOrderId || undefined,
        productionRunId: form.productionRunId || undefined,
        productId: form.productId || undefined,
        productionLineId: form.productionLineId || undefined,
        machineId: form.machineId || undefined,
        shiftId: form.shiftId || undefined,
        costCenterId: form.costCenterId || undefined,
        sampledQuantity: Number(form.sampledQuantity),
        unit: form.unit,
        inspectedAt: form.inspectedAt,
        notes: form.notes || undefined,
      };
      await api.post('/production/inspections', payload);
      showToast(t('production.inspections.createCompleted'), 'success');
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailTab('details');
    setDetail(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const item = await api.get<ProductionInspection>(`/production/inspections/${id}`);
      setDetail(item);
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setDetailOpen(false);
    } finally { setDetailLoading(false); }
  };

  const refreshDetail = async () => {
    if (!detail) return;
    try {
      const item = await api.get<ProductionInspection>(`/production/inspections/${detail.id}`);
      setDetail(item);
    } catch (err: any) { handleApiError(err); }
  };

  // ── Results ─────────────────────────────────────────────────────

  const openResults = async () => {
    if (!detail) return;
    setPlan(null);
    setResultEntries({});
    setResultsOpen(true);
    try {
      const planItem = await api.get<ProductionQualityPlan>(`/production/quality-plans/${detail.planId}`);
      setPlan(planItem);
      const initial: Record<string, ResultEntryValue> = {};
      for (const r of detail.results || []) {
        const value = r.valueNumeric != null ? String(r.valueNumeric)
          : r.valueBoolean != null ? String(r.valueBoolean)
            : r.valueText || r.valueChoice || '';
        initial[r.characteristicId] = { value, pass: r.pass };
      }
      for (const c of planItem.characteristics || []) {
        if (!initial[c.id]) {
          initial[c.id] = c.characteristicType === 'BOOLEAN'
            ? { value: 'true', pass: true }
            : { value: '', pass: true };
        }
      }
      setResultEntries(initial);
    } catch (err: any) {
      handleApiError(err);
      setResultsOpen(false);
    }
  };

  const saveResults = async () => {
    if (!detail || !plan) return;
    const entries: { characteristicId: string; valueNumeric?: number; valueBoolean?: boolean; valueText?: string; valueChoice?: string; method?: string; sourceType?: string; pass?: boolean }[] = [];
    for (const c of plan.characteristics) {
      const entry = resultEntries[c.id];
      if (!entry || entry.value === '') continue;
      switch (c.characteristicType) {
        case 'NUMERIC': {
          const numeric = Number(entry.value);
          if (Number.isNaN(numeric)) {
            showToast(t('production.inspections.errors.resultsRequired'), 'error');
            return;
          }
          entries.push({ characteristicId: c.id, valueNumeric: numeric, sourceType: 'MANUAL' });
          break;
        }
        case 'BOOLEAN':
          entries.push({ characteristicId: c.id, valueBoolean: entry.value === 'true', pass: entry.pass, sourceType: 'MANUAL' });
          break;
        case 'TEXT':
          entries.push({ characteristicId: c.id, valueText: entry.value, pass: entry.pass, sourceType: 'MANUAL' });
          break;
        case 'CHOICE':
          entries.push({ characteristicId: c.id, valueChoice: entry.value, pass: entry.pass, sourceType: 'MANUAL' });
          break;
      }
    }
    if (entries.length === 0) {
      showToast(t('production.inspections.errors.resultsRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/production/inspections/${detail.id}/results`, { results: entries });
      showToast(t('production.inspections.resultsCompleted'), 'success');
      setResultsOpen(false);
      await refreshDetail();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const renderResultInput = (c: QualityCharacteristic) => {
    const entry = resultEntries[c.id] || { value: '', pass: true };
    if (c.characteristicType === 'BOOLEAN') {
      return (
        <Select
          value={entry.value === '' ? 'true' : entry.value}
          onChange={(e) => setResultEntries({ ...resultEntries, [c.id]: { ...entry, value: e.target.value } })}
          options={[
            { value: 'true', label: t('common.yes') },
            { value: 'false', label: t('common.no') },
          ]}
        />
      );
    }
    if (c.characteristicType === 'NUMERIC') {
      return (
        <Input
          type="number"
          step="0.0001"
          value={entry.value}
          placeholder={c.unit || ''}
          onChange={(e) => setResultEntries({ ...resultEntries, [c.id]: { ...entry, value: e.target.value } })}
        />
      );
    }
    return (
      <Input
        value={entry.value}
        onChange={(e) => setResultEntries({ ...resultEntries, [c.id]: { ...entry, value: e.target.value } })}
      />
    );
  };

  const renderResultPass = (c: QualityCharacteristic) => {
    if (c.characteristicType === 'NUMERIC') return <span className="text-xs text-gray-400">{t('production.inspections.pass')}*</span>;
    const entry = resultEntries[c.id] || { value: '', pass: true };
    return (
      <Select
        value={String(entry.pass)}
        onChange={(e) => setResultEntries({ ...resultEntries, [c.id]: { ...entry, pass: e.target.value === 'true' } })}
        options={[
          { value: 'true', label: t('production.inspections.pass') },
          { value: 'false', label: t('production.inspections.fail') },
        ]}
      />
    );
  };

  const resultDisplayValue = (r: ProductionInspection['results'][number]): string => {
    if (r.valueNumeric != null) return String(r.valueNumeric);
    if (r.valueBoolean != null) return r.valueBoolean ? t('common.yes') : t('common.no');
    if (r.valueText != null) return r.valueText;
    if (r.valueChoice != null) return r.valueChoice;
    return '-';
  };

  // ── Complete ─────────────────────────────────────────────────────

  const handleComplete = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await api.patch(`/production/inspections/${detail.id}/complete`, {});
      showToast(t('production.inspections.completeCompleted'), 'success');
      setConfirmCompleteOpen(false);
      await refreshDetail();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  // ── Dispositions ─────────────────────────────────────────────────

  const openDisposition = () => {
    if (!detail) return;
    setDispositionForm({
      action: 'RELEASE',
      quantity: String(detail.sampledQuantity ?? ''),
      unit: detail.unit || 'UNIT',
      reason: '',
      notes: '',
    });
    setDispositionOpen(true);
  };

  const requestDisposition = async () => {
    if (!detail) return;
    if (!dispositionForm.reason) {
      showToast(t('production.inspections.errors.dispositionReasonRequired'), 'error');
      return;
    }
    if (!dispositionForm.quantity || Number(dispositionForm.quantity) <= 0) {
      showToast(t('production.inspections.errors.dispositionQuantityRequired'), 'error');
      return;
    }
    if (!dispositionForm.unit) {
      showToast(t('production.inspections.errors.dispositionUnitRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/production/inspections/${detail.id}/dispositions`, {
        action: dispositionForm.action,
        quantity: Number(dispositionForm.quantity),
        unit: dispositionForm.unit,
        reason: dispositionForm.reason,
        notes: dispositionForm.notes || undefined,
      });
      showToast(t('production.inspections.dispositionRequestCompleted'), 'success');
      setDispositionOpen(false);
      await refreshDetail();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const approveDisposition = async () => {
    if (!detail || !confirmApproveDisposition) return;
    setSaving(true);
    try {
      await api.patch(`/production/inspections/${detail.id}/dispositions/${confirmApproveDisposition.id}/approve`, {});
      showToast(t('production.inspections.dispositionApproveCompleted'), 'success');
      setConfirmApproveDisposition(null);
      await refreshDetail();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const rejectDisposition = async () => {
    if (!detail || !rejectDispositionOpen) return;
    if (!rejectReason) {
      showToast(t('production.inspections.errors.rejectReasonRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/production/inspections/${detail.id}/dispositions/${rejectDispositionOpen.id}/reject`, { reason: rejectReason });
      showToast(t('production.inspections.dispositionRejectCompleted'), 'success');
      setRejectDispositionOpen(null);
      setRejectReason('');
      await refreshDetail();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const hasApprovedDisposition = (d: ProductionInspection) => (d.dispositions || []).some((x) => x.status === 'APPROVED');

  const columns: GridColumn<ProductionInspection>[] = [
    { key: 'inspectionNumber', header: t('production.inspections.inspectionNumber'), render: (r) => r.inspectionNumber },
    { key: 'plan', header: t('production.inspections.plan'), render: (r) => `${r.planCodeSnapshot || ''} / Rev.${r.planRevisionSnapshot}` },
    { key: 'product', header: t('production.inspections.product'), render: (r) => r.productNameSnapshot || r.product?.name || '-' },
    { key: 'line', header: t('production.inspections.line'), render: (r) => r.productionLine?.name || r.machine?.name || '-' },
    { key: 'sampledQuantity', header: t('production.inspections.sampledQuantity'), render: (r) => `${r.sampledQuantity} ${t(unitLabelKey(r.unit))}` },
    { key: 'inspectedAt', header: t('production.inspections.inspectedAt'), render: (r) => new Date(r.inspectedAt).toLocaleDateString() },
    { key: 'status', header: t('production.inspections.allStatuses'), render: (r) => <CmmsStatusBadge status={r.status} /> },
  ];

  const gridActions: GridAction<ProductionInspection>[] = [
    { label: t('actions.view'), onClick: (r) => openDetail(r.id) },
    { label: t('production.inspections.recordResults'), onClick: (r) => openDetail(r.id).then(() => setDetailTab('results')), enabled: (r) => r.status === 'OPEN' },
  ];

  return (
    <div>
      <PageHeader title={t('production.inspections.title')} />
      <div className="mb-4 flex max-w-md gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.inspections.allStatuses')}
          options={INSPECTION_STATUSES.map((value) => ({ value, label: t(statusLabelKey(value)) }))}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('production.inspections.newInspection')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <F9Lookup
                label={t('production.inspections.plan')}
                adapter={productionQualityPlanAdapter}
                filters={{ status: 'APPROVED' }}
                value={form.planId}
                onChange={(value) => { setForm({ ...form, planId: value }); setValidationErrors(prev => ({ ...prev, planId: '' })); }}
              />
              {validationErrors.planId && <p className="text-red-500 text-sm mt-1">{validationErrors.planId}</p>}
            </div>
            <div>
              <Input label={t('production.inspections.inspectedAt')} type="date" value={form.inspectedAt} onChange={(e) => { setForm({ ...form, inspectedAt: e.target.value }); setValidationErrors(prev => ({ ...prev, inspectedAt: '' })); }} required />
              {validationErrors.inspectedAt && <p className="text-red-500 text-sm mt-1">{validationErrors.inspectedAt}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Input label={t('production.inspections.sampledQuantity')} type="number" step="0.0001" min="0" value={form.sampledQuantity} onChange={(e) => { setForm({ ...form, sampledQuantity: e.target.value }); setValidationErrors(prev => ({ ...prev, sampledQuantity: '' })); }} required />
              {validationErrors.sampledQuantity && <p className="text-red-500 text-sm mt-1">{validationErrors.sampledQuantity}</p>}
            </div>
            <div>
              <Select
                label={t('production.inspections.unit')}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                options={QUALITY_UNITS.map((value) => ({ value, label: t(unitLabelKey(value)) }))}
              />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-gray-400">{t('production.inspections.selectPlan')}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <F9Lookup
              label={t('production.inspections.order')}
              adapter={productionOrderAdapter}
              value={form.productionOrderId}
              onChange={(value) => setForm({ ...form, productionOrderId: value })}
            />
            <F9Lookup
              label={t('production.inspections.run')}
              adapter={productionRunAdapter}
              value={form.productionRunId}
              onChange={(value) => setForm({ ...form, productionRunId: value })}
            />
            <F9Lookup
              label={t('production.inspections.product')}
              adapter={productAdapter}
              value={form.productId}
              onChange={(value) => setForm({ ...form, productId: value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <F9Lookup
              label={t('production.inspections.line')}
              adapter={productionLineAdapter}
              value={form.productionLineId}
              onChange={(value) => setForm({ ...form, productionLineId: value })}
            />
            <F9Lookup
              label={t('production.inspections.machine')}
              adapter={machineAdapter}
              value={form.machineId}
              onChange={(value) => setForm({ ...form, machineId: value })}
            />
            <F9Lookup
              label={t('production.inspections.shift')}
              adapter={productionShiftAdapter}
              value={form.shiftId}
              onChange={(value) => setForm({ ...form, shiftId: value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup
              label={t('production.inspections.costCenter')}
              adapter={costCenterAdapter}
              value={form.costCenterId}
              onChange={(value) => setForm({ ...form, costCenterId: value })}
            />
            <div className="flex items-end">
              <p className="text-xs text-gray-400">clientRequestId: {form.clientRequestId}</p>
            </div>
          </div>
          <Textarea label={t('production.inspections.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail ? detail.inspectionNumber : ''} size="lg">
        {detailLoading || !detail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
          <div>
            <div className="mb-4 flex gap-2 border-b border-gray-200">
              {(['details', 'results', 'dispositions', 'ncrs'] as DetailTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${detailTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {tab === 'details' ? t('production.inspections.newInspection') : tab === 'ncrs' ? t('production.ncrs.title') : t('production.inspections.' + tab)}
                </button>
              ))}
            </div>

            {detailTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><div className="text-gray-500">{t('production.inspections.plan')}</div><div className="font-medium">{detail.planCodeSnapshot} / Rev.{detail.planRevisionSnapshot}</div></div>
                  <div><div className="text-gray-500">{t('production.inspections.product')}</div><div className="font-medium">{detail.productNameSnapshot || detail.product?.name || '-'}</div></div>
                  <div><div className="text-gray-500">{t('production.inspections.status')}</div><div><CmmsStatusBadge status={detail.status} /></div></div>
                  <div><div className="text-gray-500">{t('production.inspections.order')}</div><div className="font-medium">{detail.productionOrder?.orderNumber || '-'}</div></div>
                  <div><div className="text-gray-500">{t('production.inspections.run')}</div><div className="font-medium">{detail.productionRun?.runNumber || '-'}</div></div>
                  <div><div className="text-gray-500">{t('production.inspections.line')}</div><div className="font-medium">{detail.productionLine?.name || detail.machine?.name || '-'}</div></div>
                  <div><div className="text-gray-500">{t('production.inspections.shift')}</div><div className="font-medium">{detail.shift?.name || '-'}</div></div>
                  <div><div className="text-gray-500">{t('production.inspections.costCenter')}</div><div className="font-medium">{detail.costCenter?.name || '-'}</div></div>
                  <div><div className="text-gray-500">{t('production.inspections.sampledQuantity')}</div><div className="font-medium">{detail.sampledQuantity} {t(unitLabelKey(detail.unit))}</div></div>
                  <div><div className="text-gray-500">{t('production.inspections.inspectedAt')}</div><div className="font-medium">{new Date(detail.inspectedAt).toLocaleString()}</div></div>
                  <div><div className="text-gray-500">{t('production.inspections.notes')}</div><div className="font-medium">{detail.notes || '-'}</div></div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setDetailOpen(false)}>{t('actions.cancel')}</Button>
                  {detail.status === 'OPEN' && (
                    <Button onClick={() => { setResultsOpen(true); openResults(); }}>{t('production.inspections.recordResults')}</Button>
                  )}
                  {detail.status === 'OPEN' && (
                    <Button onClick={() => setConfirmCompleteOpen(true)}>{t('production.inspections.complete')}</Button>
                  )}
                  {(detail.status === 'COMPLETED' || detail.status === 'HELD') && !hasApprovedDisposition(detail) && (
                    <Button onClick={openDisposition}>{t('production.inspections.requestDisposition')}</Button>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'results' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  {detail.status === 'OPEN' && (
                    <Button onClick={openResults} size="sm">{t('production.inspections.recordResults')}</Button>
                  )}
                </div>
                {(detail.results || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">{t('common.noData')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.characteristic')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.value')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.pass')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.method')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(detail.results || []).map((r) => (
                          <tr key={r.id}>
                            <td className="px-3 py-2">{r.characteristicNameEnSnapshot || r.characteristic?.nameEn || '-'}</td>
                            <td className="px-3 py-2">{resultDisplayValue(r)}</td>
                            <td className="px-3 py-2">{r.pass ? t('production.inspections.pass') : t('production.inspections.fail')}</td>
                            <td className="px-3 py-2">{r.method || r.sourceType || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'dispositions' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  {(detail.status === 'COMPLETED' || detail.status === 'HELD') && !hasApprovedDisposition(detail) && (
                    <Button onClick={openDisposition} size="sm">{t('production.inspections.requestDisposition')}</Button>
                  )}
                </div>
                {(detail.dispositions || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">{t('common.noData')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.dispositionAction')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.sampledQuantity')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.dispositionReason')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.dispositionStatus')}</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(detail.dispositions || []).map((d) => (
                          <tr key={d.id}>
                            <td className="px-3 py-2">{t(actionLabelKey(d.action))}</td>
                            <td className="px-3 py-2">{d.quantity} {t(unitLabelKey(d.unit))}</td>
                            <td className="px-3 py-2">{d.reason}</td>
                            <td className="px-3 py-2">{t(dispositionStatusLabelKey(d.status))}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {d.status === 'PENDING' && (
                                <>
                                  <button type="button" className="text-blue-600 hover:text-blue-800 mr-3" onClick={() => setConfirmApproveDisposition(d)}>{t('production.inspections.approveDisposition')}</button>
                                  <button type="button" className="text-red-600 hover:text-red-800" onClick={() => { setRejectReason(''); setRejectDispositionOpen(d); }}>{t('production.inspections.rejectDisposition')}</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'ncrs' && (
              <div className="space-y-3">
                {(detail.nonconformances || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">{t('common.noData')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.ncrs.ncrNumber')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.ncrs.severity')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.ncrs.status')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.ncrs.description')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(detail.nonconformances || []).map((n) => (
                          <tr key={n.id}>
                            <td className="px-3 py-2">{n.ncrNumber}</td>
                            <td className="px-3 py-2">{t('production.ncrs.severity' + n.severity)}</td>
                            <td className="px-3 py-2"><CmmsStatusBadge status={n.status} /></td>
                            <td className="px-3 py-2">{n.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={resultsOpen} onClose={() => setResultsOpen(false)} title={t('production.inspections.recordResults')} size="lg">
        {!plan ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
          <div className="space-y-3">
            {plan.characteristics.length === 0 ? (
              <div className="text-center py-8 text-gray-400">{t('common.noData')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.characteristic')}</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.value')}</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">{t('production.inspections.pass')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {plan.characteristics.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2">
                          <div>{c.nameEn} / {c.nameAr}</div>
                          <div className="text-xs text-gray-400">{c.characteristicType}{c.isRequired ? ' *' : ''}{c.lowerLimit != null || c.upperLimit != null ? ` [${c.lowerLimit ?? '-'} .. ${c.upperLimit ?? '-'}]` : ''}</div>
                        </td>
                        <td className="px-3 py-2 w-48">{renderResultInput(c)}</td>
                        <td className="px-3 py-2 w-32">{renderResultPass(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setResultsOpen(false)}>{t('actions.cancel')}</Button>
              <Button onClick={saveResults} loading={saving}>{t('actions.save')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={dispositionOpen} onClose={() => setDispositionOpen(false)} title={t('production.inspections.requestDisposition')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Select
                label={t('production.inspections.dispositionAction')}
                value={dispositionForm.action}
                onChange={(e) => setDispositionForm({ ...dispositionForm, action: e.target.value })}
                options={DISPOSITION_ACTIONS.map((value) => ({ value, label: t(actionLabelKey(value)) }))}
              />
            </div>
            <div>
              <Input label={t('production.inspections.sampledQuantity')} type="number" step="0.0001" min="0" value={dispositionForm.quantity} onChange={(e) => setDispositionForm({ ...dispositionForm, quantity: e.target.value })} />
            </div>
            <div>
              <Select
                label={t('production.inspections.unit')}
                value={dispositionForm.unit}
                onChange={(e) => setDispositionForm({ ...dispositionForm, unit: e.target.value })}
                options={QUALITY_UNITS.map((value) => ({ value, label: t(unitLabelKey(value)) }))}
              />
            </div>
          </div>
          <Textarea label={t('production.inspections.dispositionReason')} value={dispositionForm.reason} onChange={(e) => setDispositionForm({ ...dispositionForm, reason: e.target.value })} required />
          <Textarea label={t('production.inspections.dispositionNotes')} value={dispositionForm.notes} onChange={(e) => setDispositionForm({ ...dispositionForm, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDispositionOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={requestDisposition} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmCompleteOpen}
        onClose={() => setConfirmCompleteOpen(false)}
        onConfirm={handleComplete}
        title={t('production.inspections.completeConfirmation')}
        message={t('production.inspections.completeConfirmation')}
        loading={saving}
      />

      <ConfirmDialog
        open={!!confirmApproveDisposition}
        onClose={() => setConfirmApproveDisposition(null)}
        onConfirm={approveDisposition}
        title={t('production.inspections.approveConfirmation')}
        message={t('production.inspections.approveConfirmation')}
        loading={saving}
      />

      <Modal open={!!rejectDispositionOpen} onClose={() => setRejectDispositionOpen(null)} title={t('production.inspections.rejectDisposition')} size="md">
        <div className="space-y-4">
          <Textarea label={t('production.inspections.dispositionReason')} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setRejectDispositionOpen(null)}>{t('actions.cancel')}</Button>
            <Button variant="danger" onClick={rejectDisposition} loading={saving}>{t('production.inspections.rejectDisposition')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
