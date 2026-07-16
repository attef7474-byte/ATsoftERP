'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Company } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function CompaniesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Company[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Company | null>(null);
  const [form, setForm] = useState({ code: '', name: '', legalName: '', taxNumber: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate' | 'delete'>('deactivate');
  const [selectedId, setSelectedId] = useState<string>('');

  const selectedRecord = useMemo(() => data.find(c => c.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    delete: () => confirmDelete(selectedId),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatusChange(selectedId, 'activate'),
    deactivate: () => confirmStatusChange(selectedId, 'deactivate'),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord && selectedRecord.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord && selectedRecord.status === 'ACTIVE') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: Company[]; meta: any }>('/companies', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', legalName: '', taxNumber: '', phone: '', email: '', address: '' });
    setModalOpen(true);
  };

  const openEdit = (item: Company) => {
    setEditItem(item);
    setForm({
      code: item.code,
      name: item.name,
      legalName: item.legalName || '',
      taxNumber: item.taxNumber || '',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      if (editItem) {
        await api.patch(`/companies/${editItem.id}`, form);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/companies', form);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.createFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmStatusChange = (id: string, action: 'activate' | 'deactivate') => {
    setSelectedId(id);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const status = confirmAction === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await api.patch(`/companies/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setSelectedId(id);
    setConfirmAction('delete');
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/companies/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.deleteFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'legalName', header: t('core.legalName'), render: (item: Company) => item.legalName || '-' },
    { key: 'taxNumber', header: t('core.taxNumber'), render: (item: Company) => item.taxNumber || '-' },
    { key: 'phone', header: t('common.phone'), render: (item: Company) => item.phone || '-' },
    { key: 'email', header: t('common.email'), render: (item: Company) => item.email || '-' },
    { key: 'status', header: t('common.status'), render: (item: Company) => <StatusBadge status={item.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (item: Company) => (
        <div className="flex gap-2">
          <button onClick={() => router.push(`/admin/core/companies/${item.id}`)} className="text-indigo-600 hover:text-indigo-800 text-sm">{t('details.viewDetails')}</button>
          <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
          <button onClick={() => item.status === 'ACTIVE' ? confirmStatusChange(item.id, 'deactivate') : confirmStatusChange(item.id, 'activate')}
            className={`text-sm ${item.status === 'ACTIVE' ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
            {item.status === 'ACTIVE' ? t('actions.deactivate') : t('actions.activate')}
          </button>
          <button onClick={() => confirmDelete(item.id)} className="text-red-600 hover:text-red-800 text-sm">{t('actions.delete')}</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('core.companies')} />
      <Toolbar
        searchValue={search}
        onSearchChange={setSearch}
        onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)}
        onCreate={openCreate}
        createLabel={t('core.newCompany')}
        loading={loading}
      />

      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(c: Company) => c.id} onRowClick={(c: Company) => setSelectedId(c.id)} selectedKey={selectedId} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('core.editCompany') : t('core.newCompany')}>
        <div className="space-y-4">
          <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('core.legalName')} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
          <Input label={t('core.taxNumber')} value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
          <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label={t('common.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAction === 'delete' ? handleDelete : handleStatusChange}
        title={confirmAction === 'delete' ? t('common.confirmDeleteTitle') : confirmAction === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={confirmAction === 'delete' ? t('common.confirmDeleteMessage') : confirmAction === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
        variant={confirmAction === 'activate' ? 'primary' : 'danger'}
        loading={saving}
      />
    </div>
  );
}
