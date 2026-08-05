'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { ProductionCostRate } from '../../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup } from '../../../../../components/f9';
import { productionLineAdapter, machineAdapter, costCenterAdapter } from '../../../../../components/f9';

const COST_TYPES = ['MATERIAL', 'LABOR', 'MACHINE', 'OVERHEAD'];
const COST_UNITS = ['PACK', 'UNIT', 'KG', 'TON', 'LITER', 'BATCH', 'HOUR', 'MINUTE'];

function costTypeLabelKey(value: string): string {
  return 'production.costRates.costType' + value;
}

function unitLabelKey(value: string): string {
  return 'production.costRates.unit' + value;
}

export default function ProductionCostRatesPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionCostRate[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [costTypeFilter, setCostTypeFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionCostRate | null>(null);
  const [form, setForm] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    description: '',
    costType: 'MATERIAL',
    unit: 'UNIT',
    rate: '',
    currencyCode: 'USD',
    productionLineId: '',
    machineId: '',
    costCenterId: '',
    effectiveFrom: '',
    effectiveTo: '',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    delete: () => selectedId && setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (costTypeFilter) params.costType = costTypeFilter;
      const res = await api.get<{ data: ProductionCostRate[]; meta: any }>('/production/cost-rates', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, costTypeFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({
      code: '', nameAr: '', nameEn: '', description: '',
      costType: 'MATERIAL', unit: 'UNIT', rate: '', currencyCode: 'USD',
      productionLineId: '', machineId: '', costCenterId: '',
      effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '',
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<ProductionCostRate>(`/production/cost-rates/${id}`);
      setEditItem(item);
      setForm({
        code: item.code,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        description: item.description || '',
        costType: item.costType,
        unit: item.unit,
        rate: String(item.rate),
        currencyCode: item.currencyCode || 'USD',
        productionLineId: item.productionLineId || '',
        machineId: item.machineId || '',
        costCenterId: item.costCenterId || '',
        effectiveFrom: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : '',
        effectiveTo: item.effectiveTo ? item.effectiveTo.slice(0, 10) : '',
      });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!editItem && !form.code) errors.code = t('production.costRates.errors.codeRequired');
    if (!form.nameAr) errors.nameAr = t('production.costRates.errors.nameArRequired');
    if (!form.nameEn) errors.nameEn = t('production.costRates.errors.nameEnRequired');
    if (!form.costType) errors.costType = t('production.costRates.errors.costTypeRequired');
    if (!form.unit) errors.unit = t('production.costRates.errors.unitRequired');
    if (!form.rate || Number(form.rate) <= 0) errors.rate = t('production.costRates.errors.rateRequired');
    if (!form.effectiveFrom) errors.effectiveFrom = t('production.costRates.errors.effectiveFromRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        code: form.code,
        nameAr: form.nameAr,
        nameEn: form.nameEn,
        description: form.description || null,
        costType: form.costType,
        unit: form.unit,
        rate: Number(form.rate),
        currencyCode: form.currencyCode || 'USD',
        productionLineId: form.productionLineId || undefined,
        machineId: form.machineId || undefined,
        costCenterId: form.costCenterId || undefined,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      };
      if (editItem) {
        delete payload.code;
        await api.patch(`/production/cost-rates/${editItem.id}`, payload);
        showToast(t('production.costRates.updateCompleted'), 'success');
      } else {
        await api.post('/production/cost-rates', payload);
        showToast(t('production.costRates.createCompleted'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/production/cost-rates/${selectedId}`);
      showToast(t('production.costRates.deleteCompleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionCostRate>[] = [
    { key: 'code', header: t('production.costRates.code') },
    { key: 'nameEn', header: t('production.costRates.nameEn'), render: (r) => r.nameEn },
    { key: 'nameAr', header: t('production.costRates.nameAr'), render: (r) => r.nameAr },
    { key: 'costType', header: t('production.costRates.costType'), render: (r) => t(costTypeLabelKey(r.costType)) },
    { key: 'unit', header: t('production.costRates.unit'), render: (r) => t(unitLabelKey(r.unit)) },
    { key: 'rate', header: t('production.costRates.rate'), render: (r) => `${r.rate} ${r.currencyCode}` },
    { key: 'costCenter', header: t('production.costRates.costCenter'), render: (r) => r.costCenter?.name || '-' },
    { key: 'status', header: t('production.costRates.status'), render: (r) => <CmmsStatusBadge status={r.status} /> },
  ];

  const gridActions: GridAction<ProductionCostRate>[] = [
    { label: t('actions.edit'), onClick: (r) => openEdit(r.id) },
    { label: t('common.delete'), onClick: (r) => { setSelectedId(r.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
  ];

  return (
    <div>
      <PageHeader title={t('production.costRates.title')} />
      <div className="mb-4 flex max-w-2xl gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.costRates.allStatuses')}
          options={[
            { value: 'ACTIVE', label: t('production.costRates.statusACTIVE') },
            { value: 'INACTIVE', label: t('production.costRates.statusINACTIVE') },
          ]}
        />
        <Select
          value={costTypeFilter}
          onChange={(e) => setCostTypeFilter(e.target.value)}
          placeholder={t('production.costRates.allStatuses')}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.costRates.editRate') : t('production.costRates.newRate')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('production.costRates.code')} value={form.code} disabled={!!editItem} onChange={(e) => { setForm({ ...form, code: e.target.value }); setValidationErrors(prev => ({ ...prev, code: '' })); }} required />
                {editItem && <p className="mt-1 text-xs text-gray-500">{t('production.costRates.codeImmutable')}</p>}
                {validationErrors.code && <p className="text-red-500 text-sm mt-1">{validationErrors.code}</p>}
              </div>
              <div>
                <Input label={t('production.costRates.effectiveFrom')} type="date" value={form.effectiveFrom} onChange={(e) => { setForm({ ...form, effectiveFrom: e.target.value }); setValidationErrors(prev => ({ ...prev, effectiveFrom: '' })); }} required />
                {validationErrors.effectiveFrom && <p className="text-red-500 text-sm mt-1">{validationErrors.effectiveFrom}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('production.costRates.nameAr')} value={form.nameAr} onChange={(e) => { setForm({ ...form, nameAr: e.target.value }); setValidationErrors(prev => ({ ...prev, nameAr: '' })); }} required />
                {validationErrors.nameAr && <p className="text-red-500 text-sm mt-1">{validationErrors.nameAr}</p>}
              </div>
              <div>
                <Input label={t('production.costRates.nameEn')} value={form.nameEn} onChange={(e) => { setForm({ ...form, nameEn: e.target.value }); setValidationErrors(prev => ({ ...prev, nameEn: '' })); }} required />
                {validationErrors.nameEn && <p className="text-red-500 text-sm mt-1">{validationErrors.nameEn}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Select
                  label={t('production.costRates.costType')}
                  value={form.costType}
                  onChange={(e) => setForm({ ...form, costType: e.target.value })}
                  options={COST_TYPES.map((value) => ({ value, label: t(costTypeLabelKey(value)) }))}
                />
              </div>
              <div>
                <Select
                  label={t('production.costRates.unit')}
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  options={COST_UNITS.map((value) => ({ value, label: t(unitLabelKey(value)) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Input label={t('production.costRates.rate')} type="number" step="0.0001" min="0" value={form.rate} onChange={(e) => { setForm({ ...form, rate: e.target.value }); setValidationErrors(prev => ({ ...prev, rate: '' })); }} required />
                {validationErrors.rate && <p className="text-red-500 text-sm mt-1">{validationErrors.rate}</p>}
              </div>
              <div>
                <Input label={t('production.costRates.currencyCode')} value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })} maxLength={10} />
              </div>
              <div>
                <Input label={t('production.costRates.effectiveTo')} type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <F9Lookup
                  label={t('production.costRates.line')}
                  adapter={productionLineAdapter}
                  value={form.productionLineId}
                  onChange={(value) => setForm({ ...form, productionLineId: value })}
                />
              </div>
              <div>
                <F9Lookup
                  label={t('production.costRates.machine')}
                  adapter={machineAdapter}
                  value={form.machineId}
                  onChange={(value) => setForm({ ...form, machineId: value })}
                />
              </div>
              <div>
                <F9Lookup
                  label={t('production.costRates.costCenter')}
                  adapter={costCenterAdapter}
                  value={form.costCenterId}
                  onChange={(value) => setForm({ ...form, costCenterId: value })}
                />
              </div>
            </div>
            <Textarea label={t('production.costRates.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
              <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')}
        message={t('production.costRates.deleteConfirmation')}
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
