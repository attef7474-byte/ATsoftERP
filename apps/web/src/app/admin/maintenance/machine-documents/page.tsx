'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MachineDocument } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, machineAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

export default function MachineDocumentsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<MachineDocument[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MachineDocument | null>(null);
  const [form, setForm] = useState({ machineId: '', title: '', documentType: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

const { exec } = useStableHandlers({
  new: () => openCreate(),
  edit: () => selectedRecord && openEdit(selectedRecord),
  delete: () => confirmDelete(selectedId),
  refresh: () => fetchData(meta.page),
});

useRegisterAdminActions([
  { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
  { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
  { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, onClick: () => exec('delete'), enabled: !!selectedId, variant: 'danger' },
  { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: MachineDocument[]; meta: any }>('/maintenance/machine-documents', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ machineId: '', title: '', documentType: '', description: '' });
    setModalOpen(true);
  };
  const openEdit = (item: MachineDocument) => {
    setEditItem(item);
    setForm({ machineId: item.machineId, title: item.title, documentType: item.documentType || '', description: item.description || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { machineId: form.machineId, title: form.title };
      if (form.documentType) payload.documentType = form.documentType;
      if (form.description) payload.description = form.description;
      if (editItem) {
        await api.patch(`/maintenance/machine-documents/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/machine-documents', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const confirmDelete = (id: string) => { setSelectedId(id); setConfirmOpen(true); };
  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/machine-documents/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.deleteFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<MachineDocument>[] = [
    { key: 'title', header: t('maintenance.title') },
    { key: 'documentType', header: t('maintenance.documentType'), render: (d: MachineDocument) => d.documentType || '-' },
    { key: 'machine', header: t('maintenance.machine'), render: (d: MachineDocument) => d.machine?.name || '-' },
    {
      key: 'fileUrl', header: t('maintenance.fileUrl'), render: (d: MachineDocument) =>
        d.fileUrl ? <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">{d.fileName || 'Link'}</a> : '-'
    },
    { key: 'createdAt', header: t('common.createdAt'), render: (d: MachineDocument) => new Date(d.createdAt).toLocaleDateString() },
  ];

  const gridActions: GridAction<MachineDocument>[] = [
    { label: t('actions.edit'), onClick: (d: MachineDocument) => openEdit(d) },
    { label: t('actions.delete'), onClick: (d: MachineDocument) => confirmDelete(d.id), variant: 'danger' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.machineDocuments')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(d: MachineDocument) => d.id}
        onRowClick={(d: MachineDocument) => setSelectedId(d.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editMachineDocument') : t('maintenance.newMachineDocument')} size="lg">
        <div className="space-y-4">
          <Input label={t('maintenance.title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setForm({ ...form, machineId: v })} adapter={machineAdapter} />
          <Input label={t('maintenance.documentType')} value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} />
          <Input label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
