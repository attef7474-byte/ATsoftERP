'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MachineDocument } from '../../../../lib/admin-types';
import { Button, Input, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, machineAdapter } from '../../../../components/f9';

export default function MachineDocumentsPage() {
  const { t } = useTranslation();
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

  const columns = [
    { key: 'title', header: t('maintenance.title') },
    { key: 'documentType', header: t('maintenance.documentType'), render: (d: MachineDocument) => d.documentType || '-' },
    { key: 'machine', header: t('maintenance.machine'), render: (d: MachineDocument) => d.machine?.name || '-' },
    {
      key: 'fileUrl', header: t('maintenance.fileUrl'), render: (d: MachineDocument) =>
        d.fileUrl ? <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">{d.fileName || 'Link'}</a> : '-'
    },
    { key: 'createdAt', header: t('common.createdAt'), render: (d: MachineDocument) => new Date(d.createdAt).toLocaleDateString() },
    {
      key: 'actions', header: t('common.actions'), render: (d: MachineDocument) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(d)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
          <button onClick={() => confirmDelete(d.id)} className="text-red-600 hover:text-red-800 text-sm">{t('actions.delete')}</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.machineDocuments')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('maintenance.newMachineDocument')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(d: MachineDocument) => d.id} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
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
