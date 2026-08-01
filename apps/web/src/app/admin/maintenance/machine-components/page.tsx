'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MachineComponent } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, machineComponentAdapter, machineAdapter } from '../../../../components/f9';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../lib/form-validation';

const COMPONENT_TYPE_OPTIONS = [
  { value: 'MECHANICAL', labelKey: 'maintenance.componentTypeOptions.MECHANICAL' },
  { value: 'ELECTRICAL', labelKey: 'maintenance.componentTypeOptions.ELECTRICAL' },
  { value: 'CONTROL', labelKey: 'maintenance.componentTypeOptions.CONTROL' },
  { value: 'PNEUMATIC', labelKey: 'maintenance.componentTypeOptions.PNEUMATIC' },
  { value: 'HYDRAULIC', labelKey: 'maintenance.componentTypeOptions.HYDRAULIC' },
  { value: 'HEATING', labelKey: 'maintenance.componentTypeOptions.HEATING' },
  { value: 'COOLING', labelKey: 'maintenance.componentTypeOptions.COOLING' },
  { value: 'SENSOR', labelKey: 'maintenance.componentTypeOptions.SENSOR' },
  { value: 'SAFETY', labelKey: 'maintenance.componentTypeOptions.SAFETY' },
  { value: 'CONVEYOR', labelKey: 'maintenance.componentTypeOptions.CONVEYOR' },
  { value: 'FRAME', labelKey: 'maintenance.componentTypeOptions.FRAME' },
  { value: 'UTILITY', labelKey: 'maintenance.componentTypeOptions.UTILITY' },
  { value: 'OTHER', labelKey: 'maintenance.componentTypeOptions.OTHER' },
];

const CRITICALITY_OPTIONS = [
  { value: 'LOW', labelKey: 'maintenance.criticalityOptions.LOW' },
  { value: 'MEDIUM', labelKey: 'maintenance.criticalityOptions.MEDIUM' },
  { value: 'HIGH', labelKey: 'maintenance.criticalityOptions.HIGH' },
  { value: 'CRITICAL', labelKey: 'maintenance.criticalityOptions.CRITICAL' },
];

export default function MachineComponentsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<MachineComponent[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MachineComponent | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', componentType: '', criticality: '', locationInMachine: '', manufacturer: '', model: '', serialNumber: '', parentComponentId: '', machineId: '' });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
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
      const res = await api.get<{ data: MachineComponent[]; meta: any }>('/maintenance/machine-components', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', description: '', componentType: '', criticality: '', locationInMachine: '', manufacturer: '', model: '', serialNumber: '', parentComponentId: '', machineId: '' });
    setValidationErrors({});
    setModalOpen(true);
  };
  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<MachineComponent>(`/maintenance/machine-components/${id}`);
      setEditItem(item);
      setForm({
        code: item.code,
        name: item.name,
        description: item.description || '',
        componentType: item.componentType || '',
        criticality: item.criticality || '',
        locationInMachine: item.locationInMachine || '',
        manufacturer: item.manufacturer || '',
        model: item.model || '',
        serialNumber: item.serialNumber || '',
        parentComponentId: item.parentComponentId || '',
        machineId: item.machineId || '',
      });
    } catch (err: any) {
      handleApiError(err);
      setModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!editItem && !form.code.trim()) errors.code = t('validation.required');
    if (!form.name.trim()) errors.name = t('validation.required');
    if (!form.componentType) errors.componentType = t('validation.required');
    if (!form.machineId) errors.machineId = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(Object.entries(errors).map(([field, message]) => ({ field, code: 'validation.required', message })));
      return;
    }
    setSaving(true);
    try {
      const payload: any = { name: form.name.trim(), componentType: form.componentType, machineId: form.machineId };
      if (!editItem) payload.code = form.code.trim();
      if (form.criticality) payload.criticality = form.criticality;
      if (form.description) payload.description = form.description;
      if (form.locationInMachine) payload.locationInMachine = form.locationInMachine;
      if (form.manufacturer) payload.manufacturer = form.manufacturer;
      if (form.model) payload.model = form.model;
      if (form.serialNumber) payload.serialNumber = form.serialNumber;
      if (form.parentComponentId) payload.parentComponentId = form.parentComponentId;
      if (editItem) {
        await api.patch(`/maintenance/machine-components/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/machine-components', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) {
      const config = handleApiError(err);
      if (config.errors?.length) {
        setValidationErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      }
    }
    finally { setSaving(false); }
  };

  const confirmStatus = (id: string) => { setSelectedId(id); setConfirmStatusOpen(true); };
  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((m) => m.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (status === 'ACTIVE') {
        await api.patch(`/maintenance/machine-components/${selectedId}/activate`);
      } else {
        await api.patch(`/maintenance/machine-components/${selectedId}/deactivate`);
      }
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/machine-components/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<MachineComponent>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'componentType', header: t('maintenance.componentType'), render: (c: MachineComponent) => t(`maintenance.componentTypeOptions.${c.componentType}`) || c.componentType || '-' },
    { key: 'criticality', header: t('maintenance.criticality'), render: (c: MachineComponent) => t(`maintenance.criticalityOptions.${c.criticality}`) || c.criticality || '-' },
    { key: 'machine', header: t('maintenance.machine'), render: (c: MachineComponent) => c.machine?.name || '-' },
    { key: 'status', header: t('common.status'), render: (c: MachineComponent) => <CmmsStatusBadge status={c.status} /> },
  ];

  const gridActions: GridAction<MachineComponent>[] = [
    { label: t('actions.edit'), onClick: (c: MachineComponent) => openEdit(c.id) },
    { label: t('common.delete'), onClick: (c: MachineComponent) => { setSelectedId(c.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
    { label: t('actions.deactivate'), onClick: (c: MachineComponent) => confirmStatus(c.id), enabled: (c: MachineComponent) => c.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (c: MachineComponent) => confirmStatus(c.id), enabled: (c: MachineComponent) => c.status !== 'ACTIVE' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.machineComponents')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(c: MachineComponent) => c.id}
        onRowClick={(c: MachineComponent) => setSelectedId(c.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editMachineComponent') : t('maintenance.newMachineComponent')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {editItem ? (
              <div>
                <Input label={t('common.code')} value={form.code} disabled />
                <p className="text-xs text-gray-500 mt-1">{t('common.codeImmutableHint')}</p>
              </div>
            ) : (
              <div>
                <Input label={t('common.code')} name="code" value={form.code} onChange={(e) => { setForm({ ...form, code: e.target.value }); setValidationErrors(prev => ({ ...prev, code: '' })); }} required />
                {validationErrors.code && <p className="text-red-500 text-sm mt-1">{validationErrors.code}</p>}
              </div>
            )}
            <div>
              <Input label={t('common.name')} name="name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} required />
              {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select label={t('maintenance.componentType')} value={form.componentType} onChange={(e) => { setForm({ ...form, componentType: e.target.value }); setValidationErrors(prev => ({ ...prev, componentType: '' })); }} options={COMPONENT_TYPE_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))} placeholder={t('common.select')} required />
              {validationErrors.componentType && <p className="text-red-500 text-sm mt-1">{validationErrors.componentType}</p>}
            </div>
            <Select label={t('maintenance.criticality')} value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })} options={CRITICALITY_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))} placeholder={t('common.select')} />
          </div>
          <div>
            <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => { setForm({ ...form, machineId: v }); setValidationErrors(prev => ({ ...prev, machineId: '' })); }} adapter={machineAdapter} />
            {validationErrors.machineId && <p className="text-red-500 text-sm mt-1">{validationErrors.machineId}</p>}
          </div>
          <Input label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label={t('maintenance.locationInMachine')} value={form.locationInMachine} onChange={(e) => setForm({ ...form, locationInMachine: e.target.value })} />
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('maintenance.manufacturer')} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            <Input label={t('maintenance.model')} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <Input label={t('maintenance.serialNumber')} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          </div>
          <F9Lookup label={t('maintenance.parentComponent')} value={form.parentComponentId} onChange={(v) => setForm({ ...form, parentComponentId: v })} adapter={machineComponentAdapter} />
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