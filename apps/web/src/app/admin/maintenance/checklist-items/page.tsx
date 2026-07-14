'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MaintenanceChecklistItem } from '../../../../lib/admin-types';
import { Button, Input, Select, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, maintenanceScheduleAdapter, maintenanceTaskAdapter } from '../../../../components/f9';

export default function MaintenanceChecklistItemsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<MaintenanceChecklistItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceChecklistItem | null>(null);
  const [form, setForm] = useState({ scheduleId: '', taskId: '', title: '', description: '', sortOrder: 0, required: false });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: MaintenanceChecklistItem[]; meta: any }>('/maintenance/checklist-items', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ scheduleId: '', taskId: '', title: '', description: '', sortOrder: 0, required: false });
    setModalOpen(true);
  };
  const openEdit = (item: MaintenanceChecklistItem) => {
    setEditItem(item);
    setForm({ scheduleId: item.scheduleId || '', taskId: item.taskId || '', title: item.title, description: item.description || '', sortOrder: item.sortOrder, required: item.required });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { title: form.title, sortOrder: form.sortOrder, required: form.required };
      if (form.scheduleId) payload.scheduleId = form.scheduleId;
      if (form.taskId) payload.taskId = form.taskId;
      if (form.description) payload.description = form.description;
      if (editItem) {
        await api.patch(`/maintenance/checklist-items/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/checklist-items', payload);
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
      const item = data.find((c) => c.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (status === 'ACTIVE') {
        await api.patch(`/maintenance/checklist-items/${selectedId}/activate`);
      } else {
        await api.patch(`/maintenance/checklist-items/${selectedId}/deactivate`);
      }
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'title', header: t('common.title') },
    { key: 'schedule', header: t('maintenance.maintenanceSchedule'), render: (c: MaintenanceChecklistItem) => c.schedule?.title || '-' },
    { key: 'sortOrder', header: t('maintenance.sortOrder') },
    { key: 'required', header: t('maintenance.required'), render: (c: MaintenanceChecklistItem) => c.required ? t('status.true') : t('status.false') },
    { key: 'status', header: t('common.status'), render: (c: MaintenanceChecklistItem) => <CmmsStatusBadge status={c.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (c: MaintenanceChecklistItem) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
          <button onClick={() => confirmStatus(c.id)}
            className={`text-sm ${c.status === 'ACTIVE' ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
            {c.status === 'ACTIVE' ? t('actions.deactivate') : t('actions.activate')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.checklistItems')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('maintenance.newChecklistItem')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(c: MaintenanceChecklistItem) => c.id} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editChecklistItem') : t('maintenance.newChecklistItem')} size="lg">
        <div className="space-y-4">
          <Input label={t('common.title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <F9Lookup label={t('maintenance.maintenanceSchedule')} value={form.scheduleId} onChange={(v) => setForm({ ...form, scheduleId: v })} adapter={maintenanceScheduleAdapter} />
          <F9Lookup label={t('maintenance.maintenanceTask')} value={form.taskId} onChange={(v) => setForm({ ...form, taskId: v })} adapter={maintenanceTaskAdapter} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('maintenance.sortOrder')} type="number" value={String(form.sortOrder)} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
            <Select label={t('maintenance.required')} value={String(form.required)} onChange={(e) => setForm({ ...form, required: e.target.value === 'true' })} options={[{ value: 'true', label: t('status.true') }, { value: 'false', label: t('status.false') }]} />
          </div>
          <Input label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
