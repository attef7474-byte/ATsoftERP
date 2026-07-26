'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MaintenanceSchedule } from '../../../../lib/admin-types';
import { Button, Input, Select, Textarea, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, machineAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function MaintenanceSchedulesPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<MaintenanceSchedule[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceSchedule | null>(null);
  const [form, setForm] = useState({ machineId: '', title: '', description: '', maintenanceType: 'PREVENTIVE', frequency: 'MONTHLY', startDate: '', code: '' });
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

const { exec } = useStableHandlers({
  new: () => openCreate(),
  edit: () => selectedId && openEdit(selectedId),
  refresh: () => fetchData(meta.page),
  activate: () => confirmStatus(selectedId),
  deactivate: () => confirmStatus(selectedId),
  delete: () => handleDelete(),
});

useRegisterAdminActions([
  { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
  { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
  { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
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
    setForm({ machineId: '', title: '', description: '', maintenanceType: 'PREVENTIVE', frequency: 'MONTHLY', startDate: '', code: '' });
    setModalOpen(true);
  };
  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const res: any = await api.get(`/maintenance/schedules/${id}`);
      const item: MaintenanceSchedule = res.data || res;
      setEditItem(item);
      setForm({ machineId: item.machineId, title: item.title, description: item.description || '', maintenanceType: item.maintenanceType, frequency: item.frequency, startDate: item.startDate ? item.startDate.split('T')[0] : '', code: res.code || (item as any).code || '' });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
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

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/schedules/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.deleteFailed'), 'error'); }
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

  const columns: GridColumn<MaintenanceSchedule>[] = [
    { key: 'title', header: t('common.title') },
    { key: 'machine', header: t('maintenance.machine'), render: (s: MaintenanceSchedule) => s.machine?.name || '-' },
    { key: 'maintenanceType', header: t('maintenance.maintenanceType'), render: (s: MaintenanceSchedule) => t(`status.${s.maintenanceType}` as any) || s.maintenanceType },
    { key: 'frequency', header: t('maintenance.frequency'), render: (s: MaintenanceSchedule) => t(`status.${s.frequency}` as any) || s.frequency },
    { key: 'dueStatus', header: 'Due', render: (s: MaintenanceSchedule) => s.dueStatus ? <CmmsStatusBadge status={s.dueStatus} /> : '-' },
    { key: 'status', header: t('common.status'), render: (s: MaintenanceSchedule) => <CmmsStatusBadge status={s.status} /> },
  ];

  const gridActions: GridAction<MaintenanceSchedule>[] = [
    { label: t('actions.edit'), onClick: (s: MaintenanceSchedule) => openEdit(s.id) },
    { label: t('actions.delete'), onClick: (s: MaintenanceSchedule) => { setSelectedId(s.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
    { label: t('actions.deactivate'), onClick: (s: MaintenanceSchedule) => confirmStatus(s.id), enabled: (s: MaintenanceSchedule) => s.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (s: MaintenanceSchedule) => confirmStatus(s.id), enabled: (s: MaintenanceSchedule) => s.status !== 'ACTIVE' },
    { label: t('maintenanceWorkflow.scheduleChecklist'), onClick: (s: MaintenanceSchedule) => window.location.href = `/admin/maintenance/schedules/${s.id}/checklist` },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.maintenanceSchedules')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(s: MaintenanceSchedule) => s.id}
        onRowClick={(s: MaintenanceSchedule) => setSelectedId(s.id)}
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
      <Modal open={modalOpen} onClose={() => !loadingDetail && setModalOpen(false)} title={editItem ? t('maintenance.editMaintenanceSchedule') : t('maintenance.newMaintenanceSchedule')} size="lg">
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-gray-500">{t('common.loading')}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {editItem ? (
              <>
                <Input label={t('common.code')} value={form.code} disabled />
                <p className="text-xs text-gray-400 -mt-3">{t('common.codeImmutableHint')}</p>
              </>
            ) : (
              <div className="text-sm text-gray-500">{t('common.codeAutoGenerated')}</div>
            )}
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
        )}
      </Modal>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" loading={saving} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
