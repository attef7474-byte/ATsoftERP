'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MaintenanceSchedule } from '../../../../lib/admin-types';
import { Button, Input, Select, Textarea, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, machineAdapter } from '../../../../components/f9';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function MaintenanceSchedulesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<MaintenanceSchedule[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceSchedule | null>(null);
  const [form, setForm] = useState({ machineId: '', title: '', description: '', maintenanceType: 'PREVENTIVE', frequency: 'MONTHLY', startDate: '' });
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
      const res = await api.get<{ data: MaintenanceSchedule[]; meta: any }>('/maintenance/schedules', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ machineId: '', title: '', description: '', maintenanceType: 'PREVENTIVE', frequency: 'MONTHLY', startDate: '' });
    setModalOpen(true);
  };
  const openEdit = (item: MaintenanceSchedule) => {
    setEditItem(item);
    setForm({ machineId: item.machineId, title: item.title, description: item.description || '', maintenanceType: item.maintenanceType, frequency: item.frequency, startDate: item.startDate ? item.startDate.split('T')[0] : '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.machineId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { machineId: form.machineId, title: form.title, maintenanceType: form.maintenanceType, frequency: form.frequency, startDate: form.startDate };
      if (form.description) payload.description = form.description;
      if (editItem) {
        await api.patch(`/maintenance/schedules/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/schedules', payload);
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
      const item = data.find((s) => s.id === selectedId);
      const isActive = item?.status === 'ACTIVE';
      if (isActive) {
        await api.patch(`/maintenance/schedules/${selectedId}/deactivate`);
      } else {
        await api.patch(`/maintenance/schedules/${selectedId}/activate`);
      }
      showToast(isActive ? t('common.successDeactivated') : t('common.successActivated'), 'success');
      setConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const typeOptions = [
    { value: 'PREVENTIVE', label: t('status.PREVENTIVE') },
    { value: 'CORRECTIVE', label: t('status.CORRECTIVE') },
    { value: 'PREDICTIVE', label: t('status.PREDICTIVE') },
    { value: 'CALIBRATION', label: t('status.CALIBRATION') },
  ];
  const freqOptions = [
    { value: 'DAILY', label: t('status.DAILY') },
    { value: 'WEEKLY', label: t('status.WEEKLY') },
    { value: 'MONTHLY', label: t('status.MONTHLY') },
    { value: 'YEARLY', label: t('status.YEARLY') },
  ];

  const columns = [
    { key: 'title', header: t('common.title') },
    { key: 'machine', header: t('maintenance.machine'), render: (s: MaintenanceSchedule) => s.machine?.name || '-' },
    { key: 'maintenanceType', header: t('maintenance.maintenanceType'), render: (s: MaintenanceSchedule) => t(`status.${s.maintenanceType}` as any) || s.maintenanceType },
    { key: 'frequency', header: t('maintenance.frequency'), render: (s: MaintenanceSchedule) => t(`status.${s.frequency}` as any) || s.frequency },
    { key: 'dueStatus', header: 'Due', render: (s: MaintenanceSchedule) => s.dueStatus ? <CmmsStatusBadge status={s.dueStatus} /> : '-' },
    { key: 'status', header: t('common.status'), render: (s: MaintenanceSchedule) => <CmmsStatusBadge status={s.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (s: MaintenanceSchedule) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
          <button onClick={() => confirmStatus(s.id)}
            className={`text-sm ${s.status === 'ACTIVE' ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
            {s.status === 'ACTIVE' ? t('actions.deactivate') : t('actions.activate')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.maintenanceSchedules')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('maintenance.newMaintenanceSchedule')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(s: MaintenanceSchedule) => s.id} onRowClick={(item: MaintenanceSchedule) => setSelectedId(item.id)} selectedKey={selectedId} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editMaintenanceSchedule') : t('maintenance.newMaintenanceSchedule')} size="lg">
        <div className="space-y-4">
          <Input label={t('common.title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setForm({ ...form, machineId: v })} adapter={machineAdapter} />
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('maintenance.maintenanceType')} value={form.maintenanceType} onChange={(e) => setForm({ ...form, maintenanceType: e.target.value })} options={typeOptions} />
            <Select label={t('maintenance.frequency')} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} options={freqOptions} />
          </div>
          <Input label={t('maintenance.startDate')} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <Textarea label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
