'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { ProductionOperationalAssignment } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog, Select, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, productionLineAdapter, productionUnitAdapter, productionShiftAdapter } from '../../../../components/f9';

type ResourceType = 'MACHINE' | 'LINE' | 'UNIT';

export default function ProductionOperationalAssignmentsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionOperationalAssignment[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionOperationalAssignment | null>(null);
  const [form, setForm] = useState({
    code: '', resourceType: 'MACHINE' as ResourceType,
    machineId: '', productionLineId: '', productionUnitId: '', shiftId: '',
    capacityPerShift: '', effectiveFrom: '', effectiveTo: '', isPrimary: 'false', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
    delete: () => selectedId && setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: ProductionOperationalAssignment[]; meta: any }>('/production/operational-assignments', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', resourceType: 'MACHINE', machineId: '', productionLineId: '', productionUnitId: '', shiftId: '', capacityPerShift: '', effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '', isPrimary: 'false', notes: '' });
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<ProductionOperationalAssignment>(`/production/operational-assignments/${id}`);
      setEditItem(item);
      setForm({
        code: item.code, resourceType: item.resourceType as ResourceType,
        machineId: item.machineId || '', productionLineId: item.productionLineId || '', productionUnitId: item.productionUnitId || '',
        shiftId: item.shiftId || '',
        capacityPerShift: item.capacityPerShift !== null && item.capacityPerShift !== undefined ? String(item.capacityPerShift) : '',
        effectiveFrom: item.effectiveFrom.slice(0, 10),
        effectiveTo: item.effectiveTo ? item.effectiveTo.slice(0, 10) : '',
        isPrimary: item.isPrimary ? 'true' : 'false',
        notes: item.notes || '',
      });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (form.resourceType === 'MACHINE' && !form.machineId) errors.machineId = t('validation.required');
    if (form.resourceType === 'LINE' && !form.productionLineId) errors.productionLineId = t('validation.required');
    if (form.resourceType === 'UNIT' && !form.productionUnitId) errors.productionUnitId = t('validation.required');
    if (!form.effectiveFrom) errors.effectiveFrom = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        resourceType: form.resourceType,
        machineId: form.resourceType === 'MACHINE' ? form.machineId : undefined,
        productionLineId: form.resourceType === 'LINE' ? form.productionLineId : undefined,
        productionUnitId: form.resourceType === 'UNIT' ? form.productionUnitId : undefined,
        shiftId: form.shiftId || undefined,
        capacityPerShift: form.capacityPerShift !== '' ? Number(form.capacityPerShift) : undefined,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
        isPrimary: form.isPrimary === 'true',
        notes: form.notes || undefined,
      };
      if (editItem) {
        await api.patch(`/production/operational-assignments/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/production/operational-assignments', { ...payload, code: form.code || undefined });
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const confirmStatus = (id: string) => { setSelectedId(id); setConfirmStatusOpen(true); };
  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((p) => p.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/production/operational-assignments/${selectedId}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`);
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/production/operational-assignments/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const resourceLabel = (a: ProductionOperationalAssignment) => {
    if (a.resourceType === 'MACHINE') return a.machine ? `[${a.machine.code}] ${a.machine.name}` : '-';
    if (a.resourceType === 'LINE') return a.productionLine ? `[${a.productionLine.code}] ${a.productionLine.name}` : '-';
    return a.productionUnit ? `[${a.productionUnit.code}] ${a.productionUnit.name}` : '-';
  };

  const columns: GridColumn<ProductionOperationalAssignment>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'resourceType', header: t('production.resourceType'), render: (a: ProductionOperationalAssignment) => a.resourceType },
    { key: 'resource', header: t('production.resourceType'), render: (a: ProductionOperationalAssignment) => resourceLabel(a) },
    { key: 'shift', header: t('production.shift'), render: (a: ProductionOperationalAssignment) => a.shift?.name || '-' },
    { key: 'capacityPerShift', header: t('production.capacityPerShift'), render: (a: ProductionOperationalAssignment) => a.capacityPerShift ?? '-' },
    { key: 'effectiveFrom', header: t('production.effectiveFrom'), render: (a: ProductionOperationalAssignment) => new Date(a.effectiveFrom).toLocaleDateString() },
    { key: 'effectiveTo', header: t('production.effectiveTo'), render: (a: ProductionOperationalAssignment) => a.effectiveTo ? new Date(a.effectiveTo).toLocaleDateString() : '-' },
    { key: 'status', header: t('common.status'), render: (a: ProductionOperationalAssignment) => <CmmsStatusBadge status={a.status} /> },
  ];

  const gridActions: GridAction<ProductionOperationalAssignment>[] = [
    { label: t('actions.edit'), onClick: (a: ProductionOperationalAssignment) => openEdit(a.id) },
    { label: t('common.delete'), onClick: (a: ProductionOperationalAssignment) => { setSelectedId(a.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
    { label: t('actions.deactivate'), onClick: (a: ProductionOperationalAssignment) => confirmStatus(a.id), enabled: (a: ProductionOperationalAssignment) => a.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (a: ProductionOperationalAssignment) => confirmStatus(a.id), enabled: (a: ProductionOperationalAssignment) => a.status !== 'ACTIVE' },
  ];

  return (
    <div>
      <PageHeader title={t('production.operationalAssignments')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(a: ProductionOperationalAssignment) => a.id}
        onRowClick={(a: ProductionOperationalAssignment) => setSelectedId(a.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.editOperationalAssignment') : t('production.newOperationalAssignment')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {editItem ? (
              <div>
                <Input label={t('common.code')} value={form.code} disabled />
                <p className="text-xs text-gray-500 mt-1">{t('production.codeImmutableHint')}</p>
              </div>
            ) : (
              <div>
                <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                <p className="text-xs text-gray-500 mt-1">{t('production.codeHint')}</p>
              </div>
            )}
            <Select label={t('production.resourceType')} value={form.resourceType} onChange={(e) => setForm({ ...form, resourceType: e.target.value as ResourceType })} options={[{ value: 'MACHINE', label: t('production.resourceMachine') }, { value: 'LINE', label: t('production.resourceLine') }, { value: 'UNIT', label: t('production.resourceUnit') }]} />
          </div>
          <div>
            {form.resourceType === 'MACHINE' && (
              <div>
                <F9Lookup label={t('production.resourceMachine')} value={form.machineId} onChange={(v) => { setForm({ ...form, machineId: v }); setValidationErrors(prev => ({ ...prev, machineId: '' })); }} adapter={machineAdapter} />
                {validationErrors.machineId && <p className="text-red-500 text-sm mt-1">{validationErrors.machineId}</p>}
              </div>
            )}
            {form.resourceType === 'LINE' && (
              <div>
                <F9Lookup label={t('production.resourceLine')} value={form.productionLineId} onChange={(v) => { setForm({ ...form, productionLineId: v }); setValidationErrors(prev => ({ ...prev, productionLineId: '' })); }} adapter={productionLineAdapter} />
                {validationErrors.productionLineId && <p className="text-red-500 text-sm mt-1">{validationErrors.productionLineId}</p>}
              </div>
            )}
            {form.resourceType === 'UNIT' && (
              <div>
                <F9Lookup label={t('production.resourceUnit')} value={form.productionUnitId} onChange={(v) => { setForm({ ...form, productionUnitId: v }); setValidationErrors(prev => ({ ...prev, productionUnitId: '' })); }} adapter={productionUnitAdapter} />
                {validationErrors.productionUnitId && <p className="text-red-500 text-sm mt-1">{validationErrors.productionUnitId}</p>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('production.shift')} value={form.shiftId} onChange={(v) => setForm({ ...form, shiftId: v })} adapter={productionShiftAdapter} />
            <Input label={t('production.capacityPerShift')} type="number" value={form.capacityPerShift} onChange={(e) => setForm({ ...form, capacityPerShift: e.target.value })} />
          </div>
          <p className="text-xs text-gray-500">{t('production.capacityHint')}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label={t('production.effectiveFrom')} type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
              {validationErrors.effectiveFrom && <p className="text-red-500 text-sm mt-1">{validationErrors.effectiveFrom}</p>}
            </div>
            <Input label={t('production.effectiveTo')} type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('production.isPrimary')} value={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.value })} options={[{ value: 'false', label: t('common.no') }, { value: 'true', label: t('common.yes') }]} />
          </div>
          <Textarea label={t('production.assignmentNotes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
        )}
      </Modal>
      <ConfirmDialog open={confirmStatusOpen} onClose={() => setConfirmStatusOpen(false)} onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" loading={saving} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}