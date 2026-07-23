'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MaintenanceRequest } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Textarea, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge, CmmsPriorityBadge } from '../../../../components/maintenance';
import { F9Lookup, machineAdapter, userAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon } from '../../../../components/admin/admin-action-bar';

export default function MaintenanceRequestsPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<MaintenanceRequest[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceRequest | null>(null);
  const [form, setForm] = useState({ machineId: '', title: '', description: '', type: '', priority: 'MEDIUM', assignedToId: '' });
  const [saving, setSaving] = useState(false);

  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    start: () => confirmAction(selectedId, 'start'),
    complete: () => confirmAction(selectedId, 'complete'),
    cancel: () => confirmAction(selectedId, 'cancel'),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'start', labelKey: 'common.start', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(selectedId && selectedRecord?.status === 'OPEN') },
    { id: 'complete', labelKey: 'common.complete', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: !!(selectedId && selectedRecord?.status === 'IN_PROGRESS') },
    { id: 'cancel', labelKey: 'common.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(selectedId && (selectedRecord?.status === 'OPEN' || selectedRecord?.status === 'IN_PROGRESS')) },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: MaintenanceRequest[]; meta: any }>('/maintenance/requests', { params });
      const listResult = unwrapApiList<MaintenanceRequest, typeof meta>(res);
      setData(listResult.data);
      if (listResult.meta) setMeta(listResult.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { router.push('/admin/maintenance/requests/new'); };
  const openEdit = (item: MaintenanceRequest) => { router.push(`/admin/maintenance/requests/${item.id}/edit`); };

  const handleSave = async () => {
    if (!form.title || !form.machineId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { machineId: form.machineId, title: form.title, type: form.type, priority: form.priority };
      if (form.description) payload.description = form.description;
      if (form.assignedToId) payload.assignedToId = form.assignedToId;
      if (editItem) {
        await api.patch(`/maintenance/requests/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/requests', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const confirmAction = (id: string, action: string) => { setSelectedId(id); setPendingAction(action); setActionConfirmOpen(true); };
  const handleAction = async () => {
    setSaving(true);
    try {
      const actionMap: Record<string, string> = { start: 'start', complete: 'complete', cancel: 'cancel' };
      await api.patch(`/maintenance/requests/${selectedId}/${actionMap[pendingAction] || pendingAction}`);
      showToast(t(`common.successUpdated`), 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const typeOptions = [
    { value: 'PREVENTIVE', label: t('status.PREVENTIVE') },
    { value: 'CORRECTIVE', label: t('status.CORRECTIVE') },
    { value: 'PREDICTIVE', label: t('status.PREDICTIVE') },
    { value: 'CALIBRATION', label: t('status.CALIBRATION') },
  ];
  const priorityOptions = [
    { value: 'LOW', label: t('status.LOW') },
    { value: 'MEDIUM', label: t('status.MEDIUM') },
    { value: 'HIGH', label: t('status.HIGH') },
    { value: 'CRITICAL', label: t('status.CRITICAL') },
  ];

  const columns: GridColumn<MaintenanceRequest>[] = [
    { key: 'requestNumber', header: t('maintenance.requestNumber') },
    { key: 'title', header: t('common.title') },
    { key: 'machine', header: t('maintenance.machine'), render: (r: MaintenanceRequest) => r.machine?.name || '-' },
    { key: 'type', header: t('maintenance.maintenanceType'), render: (r: MaintenanceRequest) => t(`status.${r.type}` as any) || r.type },
    { key: 'priority', header: t('maintenance.priority'), render: (r: MaintenanceRequest) => <CmmsPriorityBadge priority={r.priority} /> },
    { key: 'status', header: t('common.status'), render: (r: MaintenanceRequest) => <CmmsStatusBadge status={r.status} /> },
  ];

  const gridActions: GridAction<MaintenanceRequest>[] = [
    { label: t('details.viewDetails'), onClick: (r: MaintenanceRequest) => router.push(`/admin/maintenance/requests/${r.id}`) },
    { label: t('maintenance.start'), onClick: (r: MaintenanceRequest) => confirmAction(r.id, 'start'), enabled: (r: MaintenanceRequest) => r.status === 'OPEN' },
    { label: t('maintenance.complete'), onClick: (r: MaintenanceRequest) => confirmAction(r.id, 'complete'), enabled: (r: MaintenanceRequest) => r.status === 'IN_PROGRESS' },
    { label: t('maintenance.cancel'), onClick: (r: MaintenanceRequest) => confirmAction(r.id, 'cancel'), enabled: (r: MaintenanceRequest) => r.status === 'OPEN' || r.status === 'IN_PROGRESS', variant: 'danger' },
    { label: t('actions.edit'), onClick: (r: MaintenanceRequest) => openEdit(r) },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.maintenanceRequests')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(r: MaintenanceRequest) => r.id}
        onRowClick={(r: MaintenanceRequest) => setSelectedId(r.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editMaintenanceRequest') : t('maintenance.newMaintenanceRequest')} size="lg">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <Input label={t('common.title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setForm({ ...form, machineId: v })} adapter={machineAdapter} />
          <F9Lookup label={t('maintenance.assignedTo')} value={form.assignedToId} onChange={(v) => setForm({ ...form, assignedToId: v })} adapter={userAdapter} />
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('maintenance.maintenanceType')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={typeOptions} />
            <Select label={t('maintenance.priority')} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} options={priorityOptions} />
          </div>
          <Textarea label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title={t('common.confirm')} message={t('common.confirmDeactivateMessage')} variant="primary" loading={saving} />
    </div>
  );
}
