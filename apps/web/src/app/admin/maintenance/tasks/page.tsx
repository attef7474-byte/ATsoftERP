'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MaintenanceTask } from '../../../../lib/admin-types';
import { Button, Input, Textarea, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, maintenanceRequestAdapter, userAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon } from '../../../../components/admin/admin-action-bar';

export default function MaintenanceTasksPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<MaintenanceTask[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceTask | null>(null);
  const [form, setForm] = useState({ requestId: '', title: '', description: '', assignedToId: '' });
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
    { id: 'start', labelKey: 'common.start', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(selectedId && selectedRecord?.status === 'PENDING') },
    { id: 'complete', labelKey: 'common.complete', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: !!(selectedId && selectedRecord?.status === 'IN_PROGRESS') },
    { id: 'cancel', labelKey: 'common.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(selectedId && (selectedRecord?.status === 'PENDING' || selectedRecord?.status === 'IN_PROGRESS')) },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: MaintenanceTask[]; meta: any }>('/maintenance/tasks', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ requestId: '', title: '', description: '', assignedToId: '' });
    setModalOpen(true);
  };
  const openEdit = (item: MaintenanceTask) => {
    setEditItem(item);
    setForm({ requestId: item.requestId, title: item.title, description: item.description || '', assignedToId: item.assignedToId || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.requestId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { requestId: form.requestId, title: form.title };
      if (form.description) payload.description = form.description;
      if (form.assignedToId) payload.assignedToId = form.assignedToId;
      if (editItem) {
        await api.patch(`/maintenance/tasks/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/tasks', payload);
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
      await api.patch(`/maintenance/tasks/${selectedId}/${pendingAction}`);
      showToast(t('common.successUpdated'), 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<MaintenanceTask>[] = [
    { key: 'title', header: t('common.title') },
    { key: 'request', header: t('maintenance.maintenanceRequest'), render: (tk: MaintenanceTask) => tk.request?.requestNumber || '-' },
    { key: 'assignedTo', header: t('maintenance.assignedTo'), render: (tk: MaintenanceTask) => tk.assignedTo?.name || '-' },
    { key: 'status', header: t('common.status'), render: (tk: MaintenanceTask) => <CmmsStatusBadge status={tk.status} /> },
  ];

  const gridActions: GridAction<MaintenanceTask>[] = [
    { label: t('maintenance.start'), onClick: (tk: MaintenanceTask) => confirmAction(tk.id, 'start'), enabled: (tk: MaintenanceTask) => tk.status === 'PENDING' },
    { label: t('maintenance.complete'), onClick: (tk: MaintenanceTask) => confirmAction(tk.id, 'complete'), enabled: (tk: MaintenanceTask) => tk.status === 'IN_PROGRESS' },
    { label: t('maintenance.cancel'), onClick: (tk: MaintenanceTask) => confirmAction(tk.id, 'cancel'), enabled: (tk: MaintenanceTask) => tk.status === 'PENDING' || tk.status === 'IN_PROGRESS', variant: 'danger' },
    { label: t('actions.edit'), onClick: (tk: MaintenanceTask) => openEdit(tk) },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.maintenanceTasks')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(tk: MaintenanceTask) => tk.id}
        onRowClick={(tk: MaintenanceTask) => setSelectedId(tk.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editMaintenanceTask') : t('maintenance.newMaintenanceTask')} size="lg">
        <div className="space-y-4">
          <Input label={t('common.title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <F9Lookup label={t('maintenance.maintenanceRequest')} value={form.requestId} onChange={(v) => setForm({ ...form, requestId: v })} adapter={maintenanceRequestAdapter} />
          <F9Lookup label={t('maintenance.assignedTo')} value={form.assignedToId} onChange={(v) => setForm({ ...form, assignedToId: v })} adapter={userAdapter} />
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
