'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MachineComponent } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, machineComponentAdapter } from '../../../../components/f9';

const COMPONENT_TYPE_OPTIONS = [
  { value: 'MECHANICAL', label: 'Mechanical' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'CONTROL', label: 'Control' },
  { value: 'PNEUMATIC', label: 'Pneumatic' },
  { value: 'HYDRAULIC', label: 'Hydraulic' },
  { value: 'HEATING', label: 'Heating' },
  { value: 'COOLING', label: 'Cooling' },
  { value: 'SENSOR', label: 'Sensor' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'CONVEYOR', label: 'Conveyor' },
  { value: 'FRAME', label: 'Frame' },
  { value: 'UTILITY', label: 'Utility' },
  { value: 'OTHER', label: 'Other' },
];

const CRITICALITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export default function MachineComponentsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<MachineComponent[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MachineComponent | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', componentType: '', criticality: '', locationInMachine: '', manufacturer: '', model: '', serialNumber: '', parentComponentId: '' });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
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
    setForm({ code: '', name: '', description: '', componentType: '', criticality: '', locationInMachine: '', manufacturer: '', model: '', serialNumber: '', parentComponentId: '' });
    setModalOpen(true);
  };
  const openEdit = (item: MachineComponent) => {
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
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { code: form.code, name: form.name };
      if (form.description) payload.description = form.description;
      if (form.componentType) payload.componentType = form.componentType;
      if (form.criticality) payload.criticality = form.criticality;
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
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const confirmStatus = (id: string) => { setSelectedId(id); setConfirmOpen(true); };
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
      setConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<MachineComponent>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'componentType', header: t('maintenance.componentType'), render: (c: MachineComponent) => c.componentType || '-' },
    { key: 'criticality', header: t('maintenance.criticality'), render: (c: MachineComponent) => c.criticality || '-' },
    { key: 'machine', header: t('maintenance.machine'), render: (c: MachineComponent) => c.machine?.name || '-' },
    { key: 'status', header: t('common.status'), render: (c: MachineComponent) => <CmmsStatusBadge status={c.status} /> },
  ];

  const gridActions: GridAction<MachineComponent>[] = [
    { label: t('actions.edit'), onClick: (c: MachineComponent) => openEdit(c) },
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('maintenance.componentType')} value={form.componentType} onChange={(e) => setForm({ ...form, componentType: e.target.value })} options={COMPONENT_TYPE_OPTIONS} placeholder={t('common.select')} />
            <Select label={t('maintenance.criticality')} value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })} options={CRITICALITY_OPTIONS} placeholder={t('common.select')} />
          </div>
          <Input label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label={t('maintenance.locationInMachine')} value={form.locationInMachine} onChange={(e) => setForm({ ...form, locationInMachine: e.target.value })} />
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('common.manufacturer')} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            <Input label={t('common.model')} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <Input label={t('common.serialNumber')} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          </div>
          <F9Lookup label={t('maintenance.parentComponent')} value={form.parentComponentId} onChange={(v) => setForm({ ...form, parentComponentId: v })} adapter={machineComponentAdapter} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" loading={saving} />
    </div>
  );
}