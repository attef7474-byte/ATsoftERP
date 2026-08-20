'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { ProductionMeasurementPoint } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

const MEASUREMENT_POINT_ROLES = ['INPUT', 'INTERMEDIATE', 'FINAL_OUTPUT', 'WASTE', 'REWORK'];
const MEASUREMENT_POINT_SOURCES = ['MANUAL', 'COUNTER'];
const MEASUREMENT_POINT_UNITS = ['PACK', 'UNIT', 'KG', 'TON', 'LITER', 'BATCH'];

function roleLabelKey(value: string): string {
  switch (value) {
    case 'INPUT': return 'production.measurementPoints.roleInput';
    case 'INTERMEDIATE': return 'production.measurementPoints.roleIntermediate';
    case 'FINAL_OUTPUT': return 'production.measurementPoints.roleFinalOutput';
    case 'WASTE': return 'production.measurementPoints.roleWaste';
    case 'REWORK': return 'production.measurementPoints.roleRework';
    default: return 'production.measurementPoints.roleInput';
  }
}

function sourceLabelKey(value: string): string {
  switch (value) {
    case 'MANUAL': return 'production.measurementPoints.sourceManual';
    case 'COUNTER': return 'production.measurementPoints.sourceCounter';
    default: return 'production.measurementPoints.sourceManual';
  }
}

function unitLabelKey(value: string): string {
  switch (value) {
    case 'PACK': return 'production.capacityUnit.PACK';
    case 'UNIT': return 'production.capacityUnit.UNIT';
    case 'KG': return 'production.capacityUnit.KG';
    case 'TON': return 'production.capacityUnit.TON';
    case 'LITER': return 'production.capacityUnit.LITER';
    case 'BATCH': return 'production.capacityUnit.BATCH';
    default: return 'production.capacityUnit.UNIT';
  }
}

export default function ProductionMeasurementPointsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionMeasurementPoint[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionMeasurementPoint | null>(null);
  const [form, setForm] = useState({
    name: '',
    productionLineId: '',
    machineId: '',
    productionUnitId: '',
    role: 'INPUT',
    source: 'MANUAL',
    unit: 'UNIT',
    isAuthoritativeFinal: false,
    counterModulus: '',
    effectiveFrom: '',
    effectiveTo: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [statusAction, setStatusAction] = useState<'activate' | 'deactivate'>('activate');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    activate: () => { setStatusAction('activate'); setConfirmStatusOpen(true); },
    deactivate: () => { setStatusAction('deactivate'); setConfirmStatusOpen(true); },
    delete: () => selectedId && setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (roleFilter) params.role = roleFilter;
      const res = await api.get<{ data: ProductionMeasurementPoint[]; meta: any }>('/production/measurement-points', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, roleFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({
      name: '',
      productionLineId: '',
      machineId: '',
      productionUnitId: '',
      role: 'INPUT',
      source: 'MANUAL',
      unit: 'UNIT',
      isAuthoritativeFinal: false,
      counterModulus: '',
      effectiveFrom: '',
      effectiveTo: '',
      description: '',
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<ProductionMeasurementPoint>(`/production/measurement-points/${id}`);
      setEditItem(item);
      setForm({
        name: item.name,
        productionLineId: item.productionLineId,
        machineId: item.machineId || '',
        productionUnitId: item.productionUnitId,
        role: item.role,
        source: item.source,
        unit: item.unit,
        isAuthoritativeFinal: item.isAuthoritativeFinal,
        counterModulus: item.counterModulus != null ? String(item.counterModulus) : '',
        effectiveFrom: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : '',
        effectiveTo: item.effectiveTo ? item.effectiveTo.slice(0, 10) : '',
        description: item.notes || '',
      });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.name) errors.name = t('validation.required');
    if (!form.productionLineId) errors.productionLineId = t('validation.required');
    if (!form.productionUnitId) errors.productionUnitId = t('validation.required');
    if (!form.effectiveFrom) errors.effectiveFrom = t('validation.required');
    if (form.source === 'COUNTER' && !form.counterModulus) errors.counterModulus = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        productionLineId: form.productionLineId,
        machineId: form.machineId || null,
        productionUnitId: form.productionUnitId,
        role: form.role,
        source: form.source,
        unit: form.unit,
        isAuthoritativeFinal: form.isAuthoritativeFinal,
        counterModulus: form.source === 'COUNTER' ? form.counterModulus : null,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        notes: form.description || null,
      };
      if (editItem) {
        await api.patch(`/production/measurement-points/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/production/measurement-points', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const action = statusAction === 'activate' ? 'activate' : 'deactivate';
      await api.post(`/production/measurement-points/${selectedId}/${action}`, {});
      showToast(statusAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/production/measurement-points/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionMeasurementPoint>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'productionLine', header: t('production.line'), render: (p) => p.productionLine?.name || '-' },
    { key: 'machine', header: t('production.machine'), render: (p) => p.machine?.name || '-' },
    { key: 'role', header: t('production.measurementPoints.role'), render: (p) => t(roleLabelKey(p.role)) },
    { key: 'source', header: t('production.measurementPoints.source'), render: (p) => t(sourceLabelKey(p.source)) },
    { key: 'unit', header: t('production.measurementPoints.unit'), render: (p) => t(unitLabelKey(p.unit)) },
    { key: 'status', header: t('common.status'), render: (p) => <CmmsStatusBadge status={p.status} /> },
  ];

  const gridActions: GridAction<ProductionMeasurementPoint>[] = [
    { label: t('actions.edit'), onClick: (p) => openEdit(p.id), enabled: (p) => p.status === 'DRAFT' },
    { label: t('actions.activate'), onClick: (p) => { setSelectedId(p.id); setStatusAction('activate'); setConfirmStatusOpen(true); }, enabled: (p) => p.status !== 'ACTIVE' },
    { label: t('actions.deactivate'), onClick: (p) => { setSelectedId(p.id); setStatusAction('deactivate'); setConfirmStatusOpen(true); }, enabled: (p) => p.status === 'ACTIVE', variant: 'danger' },
    { label: t('common.delete'), onClick: (p) => { setSelectedId(p.id); setConfirmDeleteOpen(true); }, enabled: (p) => p.status === 'DRAFT', variant: 'danger' },
  ];

  const isCounterSource = form.source === 'COUNTER';

  return (
    <div>
      <PageHeader title={t('production.measurementPoints.title')} />
      <div className="mb-4 flex max-w-2xl gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.measurementPoints.allStatuses')}
          options={[
            { value: 'DRAFT', label: t('status.DRAFT') },
            { value: 'ACTIVE', label: t('status.ACTIVE') },
            { value: 'INACTIVE', label: t('status.INACTIVE') },
          ]}
        />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          placeholder={t('production.measurementPoints.allRoles')}
          options={MEASUREMENT_POINT_ROLES.map((value) => ({ value, label: t(roleLabelKey(value)) }))}
        />
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => setSelectedId(p.id)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.measurementPoints.editPoint') : t('production.measurementPoints.newPoint')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('common.name')} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} required />
                {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
              </div>
              <div>
                <Input label={t('production.measurementPoints.effectiveFrom')} type="date" value={form.effectiveFrom} onChange={(e) => { setForm({ ...form, effectiveFrom: e.target.value }); setValidationErrors(prev => ({ ...prev, effectiveFrom: '' })); }} required />
                {validationErrors.effectiveFrom && <p className="text-red-500 text-sm mt-1">{validationErrors.effectiveFrom}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('production.measurementPoints.productionLine')} value={form.productionLineId} onChange={(e) => { setForm({ ...form, productionLineId: e.target.value }); setValidationErrors(prev => ({ ...prev, productionLineId: '' })); }} required />
                {validationErrors.productionLineId && <p className="text-red-500 text-sm mt-1">{validationErrors.productionLineId}</p>}
              </div>
              <div>
                <Input label={t('production.measurementPoints.machine')} value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('production.measurementPoints.productionUnit')} value={form.productionUnitId} onChange={(e) => { setForm({ ...form, productionUnitId: e.target.value }); setValidationErrors(prev => ({ ...prev, productionUnitId: '' })); }} required />
                {validationErrors.productionUnitId && <p className="text-red-500 text-sm mt-1">{validationErrors.productionUnitId}</p>}
              </div>
              <div>
                <Select
                  label={t('production.measurementPoints.role')}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  options={MEASUREMENT_POINT_ROLES.map((value) => ({ value, label: t(roleLabelKey(value)) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Select
                  label={t('production.measurementPoints.source')}
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  options={MEASUREMENT_POINT_SOURCES.map((value) => ({ value, label: t(sourceLabelKey(value)) }))}
                />
              </div>
              <div>
                <Select
                  label={t('production.measurementPoints.unit')}
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  options={MEASUREMENT_POINT_UNITS.map((value) => ({ value, label: t(unitLabelKey(value)) }))}
                />
              </div>
            </div>
            {isCounterSource && (
              <div>
                <Input label={t('production.measurementPoints.counterModulus')} value={form.counterModulus} onChange={(e) => { setForm({ ...form, counterModulus: e.target.value }); setValidationErrors(prev => ({ ...prev, counterModulus: '' })); }} required />
                {validationErrors.counterModulus && <p className="text-red-500 text-sm mt-1">{validationErrors.counterModulus}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('production.measurementPoints.isAuthoritativeFinal')}</label>
                <input type="checkbox" checked={form.isAuthoritativeFinal} onChange={(e) => setForm({ ...form, isAuthoritativeFinal: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
              </div>
              <div>
                <Input label={t('production.measurementPoints.effectiveTo')} type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
              </div>
            </div>
            <Textarea label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
              <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmStatusOpen}
        onClose={() => setConfirmStatusOpen(false)}
        onConfirm={handleStatusChange}
        title={statusAction === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={statusAction === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
        variant="danger"
        loading={saving}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')}
        message={t('common.confirmDeleteMessage')}
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
