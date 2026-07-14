'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MaintenanceTask } from '../../../../lib/admin-types';
import { Button, Input, Textarea, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, maintenanceRequestAdapter, userAdapter } from '../../../../components/f9';

export default function MaintenanceTasksPage() {
  const { t } = useTranslation();
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

  const columns = [
    { key: 'title', header: t('common.title') },
    { key: 'request', header: t('maintenance.maintenanceRequest'), render: (tk: MaintenanceTask) => tk.request?.requestNumber || '-' },
    { key: 'assignedTo', header: t('maintenance.assignedTo'), render: (tk: MaintenanceTask) => tk.assignedTo?.name || '-' },
    { key: 'status', header: t('common.status'), render: (tk: MaintenanceTask) => <CmmsStatusBadge status={tk.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (tk: MaintenanceTask) => (
        <div className="flex gap-2 flex-wrap">
          {tk.status === 'PENDING' && <button onClick={() => confirmAction(tk.id, 'start')} className="text-green-600 hover:text-green-800 text-sm">{t('maintenance.start')}</button>}
          {tk.status === 'IN_PROGRESS' && <button onClick={() => confirmAction(tk.id, 'complete')} className="text-green-600 hover:text-green-800 text-sm">{t('maintenance.complete')}</button>}
          {(tk.status === 'PENDING' || tk.status === 'IN_PROGRESS') && <button onClick={() => confirmAction(tk.id, 'cancel')} className="text-red-600 hover:text-red-800 text-sm">{t('maintenance.cancel')}</button>}
          <button onClick={() => openEdit(tk)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.maintenanceTasks')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('maintenance.newMaintenanceTask')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(tk: MaintenanceTask) => tk.id} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
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
