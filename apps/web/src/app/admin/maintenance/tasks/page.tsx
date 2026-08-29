'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { MaintenanceTask } from '../../../../lib/admin-types';
import { Button, Input, Textarea, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, maintenanceRequestAdapter, userAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon } from '../../../../components/admin/admin-action-bar';

export default function MaintenanceTasksPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<MaintenanceTask[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceTask | null>(null);
  const [form, setForm] = useState({ requestId: '', title: '', description: '', assignedToId: '', code: '', notes: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    start: () => confirmAction(selectedId, 'start'),
    complete: () => confirmAction(selectedId, 'complete'),
    cancel: () => confirmAction(selectedId, 'cancel'),
    delete: () => setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
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
    setForm({ requestId: '', title: '', description: '', assignedToId: '', code: '', notes: '' });
    setValidationErrors({});
    setModalOpen(true);
  };
  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setValidationErrors({});
    setModalOpen(true);
    try {
      const res = await api.get<MaintenanceTask>(`/maintenance/tasks/${id}`);
      const item = res;
      setEditItem(item);
      setForm({ requestId: item.requestId, title: item.title, description: item.description || '', assignedToId: item.assignedToId || '', code: (item as any).code || '', notes: item.notes || '' });
    } catch (err: any) {
      handleApiError(err);
      setModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.title) errors.title = t('validation.required');
    if (!form.requestId) errors.requestId = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = { requestId: form.requestId, title: form.title };
      if (form.description) payload.description = form.description;
      if (form.assignedToId) payload.assignedToId = form.assignedToId;
      if (form.notes) payload.notes = form.notes;
      if (editItem) {
        await api.patch(`/maintenance/tasks/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/tasks', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/tasks/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const confirmAction = (id: string, action: string) => { setSelectedId(id); setPendingAction(action); setActionConfirmOpen(true); };
  const handleAction = async () => {
    setSaving(true);
    try {
      await api.patch(`/maintenance/tasks/${selectedId}/${pendingAction}`);
      showToast(t('common.successUpdated'), 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
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
    { label: t('actions.edit'), onClick: (tk: MaintenanceTask) => openEdit(tk.id) },
    { label: t('common.delete'), onClick: (tk: MaintenanceTask) => { setSelectedId(tk.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
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
        {loadingDetail ? (
          <div className="flex justify-center py-8"><span>{t('common.loading')}</span></div>
        ) : (
          <div className="space-y-4">
            {editItem ? (
              <div>
                <Input label={t('common.code')} value={form.code} disabled />
                <p className="text-xs text-gray-500 mt-1">{t('common.codeImmutableHint')}</p>
              </div>
            ) : (
              <Input label={t('common.code')} value={t('common.codeAutoGenerated')} disabled />
            )}
            <div>
              <Input label={t('common.title')} value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setValidationErrors(prev => ({ ...prev, title: '' })); }} required />
              {validationErrors.title && <p className="text-red-500 text-sm mt-1">{validationErrors.title}</p>}
            </div>
            <div>
              <F9Lookup label={t('maintenance.maintenanceRequest')} value={form.requestId} onChange={(v) => { setForm({ ...form, requestId: v }); setValidationErrors(prev => ({ ...prev, requestId: '' })); }} adapter={maintenanceRequestAdapter} />
              {validationErrors.requestId && <p className="text-red-500 text-sm mt-1">{validationErrors.requestId}</p>}
            </div>
            <F9Lookup label={t('maintenance.assignedTo')} value={form.assignedToId} onChange={(v) => setForm({ ...form, assignedToId: v })} adapter={userAdapter} />
            <Textarea label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
              <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title={t('common.confirm')} message={t('common.confirmDeactivateMessage')} variant="primary" loading={saving} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
