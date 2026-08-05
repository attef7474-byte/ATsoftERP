'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { ProductionCostSnapshot, ProductionProductDefinition, ProductionVersion, ProductionPackaging } from '../../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../../components/f9';
import { productionProductDefinitionAdapter, productionLineAdapter, machineAdapter, costCenterAdapter } from '../../../../../components/f9';

const COST_TYPES = ['MATERIAL', 'LABOR', 'MACHINE', 'OVERHEAD'];
const COST_UNITS = ['PACK', 'UNIT', 'KG', 'TON', 'LITER', 'BATCH', 'HOUR', 'MINUTE'];

function costTypeLabelKey(value: string): string {
  return 'production.costSnapshots.costType' + value;
}

function unitLabelKey(value: string): string {
  return 'production.costSnapshots.unit' + value;
}

export default function ProductionCostSnapshotsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionCostSnapshot[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [costTypeFilter, setCostTypeFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionCostSnapshot | null>(null);
  const [versions, setVersions] = useState<ProductionVersion[]>([]);
  const [packagings, setPackagings] = useState<ProductionPackaging[]>([]);
  const [form, setForm] = useState({
    code: '',
    productionProductDefinitionId: '',
    productionVersionId: '',
    productionPackagingId: '',
    productionLineId: '',
    machineId: '',
    costCenterId: '',
    costType: 'MATERIAL',
    unit: 'UNIT',
    quantity: '',
    rate: '',
    currencyCode: 'USD',
    effectiveFrom: '',
    effectiveTo: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmFreezeOpen, setConfirmFreezeOpen] = useState(false);
  const [confirmSupersedeOpen, setConfirmSupersedeOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const loadProductChildren = async (id: string) => {
    if (!id) { setVersions([]); setPackagings([]); return; }
    try {
      const product = await api.get<ProductionProductDefinition>(`/production/product-definitions/${id}`);
      setVersions(product.versions || []); setPackagings(product.packagings || []);
    } catch (err) { handleApiError(err); setVersions([]); setPackagings([]); }
  };

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    freeze: () => selectedId && setConfirmFreezeOpen(true),
    supersede: () => selectedId && setConfirmSupersedeOpen(true),
    delete: () => selectedId && setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'freeze', labelKey: 'production.costSnapshots.freeze', icon: <ActionEditIcon />, onClick: () => exec('freeze'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
    { id: 'supersede', labelKey: 'production.costSnapshots.supersede', icon: <ActionEditIcon />, onClick: () => exec('supersede'), enabled: !!(selectedId && selectedRecord?.status === 'FROZEN') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (costTypeFilter) params.costType = costTypeFilter;
      const res = await api.get<{ data: ProductionCostSnapshot[]; meta: any }>('/production/cost-snapshots', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, costTypeFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setVersions([]); setPackagings([]);
    setForm({
      code: '', productionProductDefinitionId: '', productionVersionId: '', productionPackagingId: '',
      productionLineId: '', machineId: '', costCenterId: '',
      costType: 'MATERIAL', unit: 'UNIT', quantity: '', rate: '', currencyCode: 'USD',
      effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '', notes: '',
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<ProductionCostSnapshot>(`/production/cost-snapshots/${id}`);
      setEditItem(item);
      setForm({
        code: item.code,
        productionProductDefinitionId: item.productionProductDefinitionId,
        productionVersionId: item.productionVersionId || '',
        productionPackagingId: item.productionPackagingId || '',
        productionLineId: item.productionLineId || '',
        machineId: item.machineId || '',
        costCenterId: item.costCenterId || '',
        costType: item.costType,
        unit: item.unit,
        quantity: String(item.quantity),
        rate: String(item.rate),
        currencyCode: item.currencyCode || 'USD',
        effectiveFrom: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : '',
        effectiveTo: item.effectiveTo ? item.effectiveTo.slice(0, 10) : '',
        notes: item.notes || '',
      });
      await loadProductChildren(item.productionProductDefinitionId);
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!editItem && !form.code) errors.code = t('production.costSnapshots.errors.codeRequired');
    if (!form.productionProductDefinitionId) errors.productionProductDefinitionId = t('production.costSnapshots.errors.productDefinitionRequired');
    if (!form.costType) errors.costType = t('production.costSnapshots.errors.costTypeRequired');
    if (!form.unit) errors.unit = t('production.costSnapshots.errors.unitRequired');
    if (!form.quantity || Number(form.quantity) <= 0) errors.quantity = t('production.costSnapshots.errors.quantityRequired');
    if (!form.rate || Number(form.rate) <= 0) errors.rate = t('production.costSnapshots.errors.rateRequired');
    if (!form.effectiveFrom) errors.effectiveFrom = t('production.costSnapshots.errors.effectiveFromRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        code: form.code,
        productionProductDefinitionId: form.productionProductDefinitionId,
        productionVersionId: form.productionVersionId || undefined,
        productionPackagingId: form.productionPackagingId || undefined,
        productionLineId: form.productionLineId || undefined,
        machineId: form.machineId || undefined,
        costCenterId: form.costCenterId || undefined,
        costType: form.costType,
        unit: form.unit,
        quantity: Number(form.quantity),
        rate: Number(form.rate),
        currencyCode: form.currencyCode || 'USD',
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        notes: form.notes || null,
      };
      if (editItem) {
        delete payload.code;
        delete payload.productionProductDefinitionId;
        delete payload.costType;
        await api.patch(`/production/cost-snapshots/${editItem.id}`, payload);
        showToast(t('production.costSnapshots.updateCompleted'), 'success');
      } else {
        await api.post('/production/cost-snapshots', payload);
        showToast(t('production.costSnapshots.createCompleted'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const runAction = async (action: 'delete' | 'freeze' | 'supersede') => {
    setSaving(true);
    try {
      if (action === 'delete') {
        await api.delete(`/production/cost-snapshots/${selectedId}`);
        showToast(t('production.costSnapshots.deleteCompleted'), 'success');
      } else if (action === 'freeze') {
        await api.patch(`/production/cost-snapshots/${selectedId}/freeze`, {});
        showToast(t('production.costSnapshots.freezeCompleted'), 'success');
      } else {
        await api.patch(`/production/cost-snapshots/${selectedId}/supersede`, {});
        showToast(t('production.costSnapshots.supersedeCompleted'), 'success');
      }
      setConfirmDeleteOpen(false); setConfirmFreezeOpen(false); setConfirmSupersedeOpen(false);
      setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionCostSnapshot>[] = [
    { key: 'code', header: t('production.costSnapshots.code'), render: (r) => `${r.code} / ${r.revision}` },
    { key: 'productDefinition', header: t('production.costSnapshots.productDefinition'), render: (r) => r.productionProductDefinition?.product?.name || r.productionProductDefinition?.code || '-' },
    { key: 'costType', header: t('production.costSnapshots.costType'), render: (r) => t(costTypeLabelKey(r.costType)) },
    { key: 'unit', header: t('production.costSnapshots.unit'), render: (r) => t(unitLabelKey(r.unit)) },
    { key: 'quantity', header: t('production.costSnapshots.quantity'), render: (r) => r.quantity },
    { key: 'rate', header: t('production.costSnapshots.rate'), render: (r) => r.rate },
    { key: 'amount', header: t('production.costSnapshots.amount'), render: (r) => `${r.amount} ${r.currencyCode}` },
    { key: 'status', header: t('production.costSnapshots.status'), render: (r) => <CmmsStatusBadge status={r.status} /> },
  ];

  const gridActions: GridAction<ProductionCostSnapshot>[] = [
    { label: t('actions.edit'), onClick: (r) => openEdit(r.id), enabled: (r) => r.status === 'DRAFT' },
    { label: t('production.costSnapshots.freeze'), onClick: (r) => { setSelectedId(r.id); setConfirmFreezeOpen(true); }, enabled: (r) => r.status === 'DRAFT' },
    { label: t('production.costSnapshots.supersede'), onClick: (r) => { setSelectedId(r.id); setConfirmSupersedeOpen(true); }, enabled: (r) => r.status === 'FROZEN' },
    { label: t('common.delete'), onClick: (r) => { setSelectedId(r.id); setConfirmDeleteOpen(true); }, enabled: (r) => r.status === 'DRAFT', variant: 'danger' },
  ];

  return (
    <div>
      <PageHeader title={t('production.costSnapshots.title')} />
      <div className="mb-4 flex max-w-2xl gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.costSnapshots.allStatuses')}
          options={[
            { value: 'DRAFT', label: t('production.costSnapshots.statusDRAFT') },
            { value: 'FROZEN', label: t('production.costSnapshots.statusFROZEN') },
            { value: 'SUPERSEDED', label: t('production.costSnapshots.statusSUPERSEDED') },
          ]}
        />
        <Select
          value={costTypeFilter}
          onChange={(e) => setCostTypeFilter(e.target.value)}
          placeholder={t('production.costSnapshots.allStatuses')}
          options={COST_TYPES.map((value) => ({ value, label: t(costTypeLabelKey(value)) }))}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.costSnapshots.editSnapshot') : t('production.costSnapshots.newSnapshot')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('production.costSnapshots.code')} value={form.code} disabled={!!editItem} onChange={(e) => { setForm({ ...form, code: e.target.value }); setValidationErrors(prev => ({ ...prev, code: '' })); }} required />
                {validationErrors.code && <p className="text-red-500 text-sm mt-1">{validationErrors.code}</p>}
              </div>
              <div>
                <Input label={t('production.costSnapshots.effectiveFrom')} type="date" value={form.effectiveFrom} onChange={(e) => { setForm({ ...form, effectiveFrom: e.target.value }); setValidationErrors(prev => ({ ...prev, effectiveFrom: '' })); }} required />
                {validationErrors.effectiveFrom && <p className="text-red-500 text-sm mt-1">{validationErrors.effectiveFrom}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <F9Lookup
                  label={t('production.costSnapshots.productDefinition')}
                  adapter={productionProductDefinitionAdapter}
                  value={form.productionProductDefinitionId}
                  onChange={(value) => { setForm({ ...form, productionProductDefinitionId: value, productionVersionId: '', productionPackagingId: '' }); loadProductChildren(value); }}
                />
                {validationErrors.productionProductDefinitionId && <p className="text-red-500 text-sm mt-1">{validationErrors.productionProductDefinitionId}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label={t('production.costSnapshots.version')}
                  value={form.productionVersionId}
                  onChange={(e) => setForm({ ...form, productionVersionId: e.target.value })}
                  placeholder={t('common.none')}
                  options={versions.map((v) => ({ value: v.id, label: `${v.versionNumber} - ${v.versionLabel}` }))}
                />
                <Select
                  label={t('production.costSnapshots.packaging')}
                  value={form.productionPackagingId}
                  onChange={(e) => setForm({ ...form, productionPackagingId: e.target.value })}
                  placeholder={t('common.none')}
                  options={packagings.map((p) => ({ value: p.id, label: `${p.packagingType} (${p.packQuantity})` }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Select
                  label={t('production.costSnapshots.costType')}
                  value={form.costType}
                  onChange={(e) => setForm({ ...form, costType: e.target.value })}
                  options={COST_TYPES.map((value) => ({ value, label: t(costTypeLabelKey(value)) }))}
                />
              </div>
              <div>
                <Select
                  label={t('production.costSnapshots.unit')}
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  options={COST_UNITS.map((value) => ({ value, label: t(unitLabelKey(value)) }))}
                />
              </div>
              <div>
                <Input label={t('production.costSnapshots.currencyCode')} value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })} maxLength={10} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Input label={t('production.costSnapshots.quantity')} type="number" step="0.0001" min="0" value={form.quantity} onChange={(e) => { setForm({ ...form, quantity: e.target.value }); setValidationErrors(prev => ({ ...prev, quantity: '' })); }} required />
                {validationErrors.quantity && <p className="text-red-500 text-sm mt-1">{validationErrors.quantity}</p>}
              </div>
              <div>
                <Input label={t('production.costSnapshots.rate')} type="number" step="0.0001" min="0" value={form.rate} onChange={(e) => { setForm({ ...form, rate: e.target.value }); setValidationErrors(prev => ({ ...prev, rate: '' })); }} required />
                {validationErrors.rate && <p className="text-red-500 text-sm mt-1">{validationErrors.rate}</p>}
              </div>
              <div>
                <Input label={t('production.costSnapshots.effectiveTo')} type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-gray-500">{t('production.costSnapshots.amountHint')}</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <F9Lookup
                  label={t('production.costSnapshots.line')}
                  adapter={productionLineAdapter}
                  value={form.productionLineId}
                  onChange={(value) => setForm({ ...form, productionLineId: value })}
                />
              </div>
              <div>
                <F9Lookup
                  label={t('production.costSnapshots.machine')}
                  adapter={machineAdapter}
                  value={form.machineId}
                  onChange={(value) => setForm({ ...form, machineId: value })}
                />
              </div>
              <div>
                <F9Lookup
                  label={t('production.costSnapshots.costCenter')}
                  adapter={costCenterAdapter}
                  value={form.costCenterId}
                  onChange={(value) => setForm({ ...form, costCenterId: value })}
                />
              </div>
            </div>
            <Textarea label={t('production.costSnapshots.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
              <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmFreezeOpen}
        onClose={() => setConfirmFreezeOpen(false)}
        onConfirm={() => runAction('freeze')}
        title={t('production.costSnapshots.freeze')}
        message={t('production.costSnapshots.freezeConfirmation')}
        loading={saving}
      />
      <ConfirmDialog
        open={confirmSupersedeOpen}
        onClose={() => setConfirmSupersedeOpen(false)}
        onConfirm={() => runAction('supersede')}
        title={t('production.costSnapshots.supersede')}
        message={t('production.costSnapshots.supersedeConfirmation')}
        loading={saving}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => runAction('delete')}
        title={t('common.confirmDeleteTitle')}
        message={t('production.costSnapshots.deleteConfirmation')}
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
