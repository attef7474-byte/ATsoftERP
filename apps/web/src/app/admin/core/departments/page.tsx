'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Department } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter, departmentAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function DepartmentsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Department[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Department | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', parentId: '', name: '' });
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate'>('deactivate');
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatusChange(selectedId, 'activate'),
    deactivate: () => confirmStatusChange(selectedId, 'deactivate'),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: Department[]; meta: any }>('/departments', { params });
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
    setForm({ companyId: '', branchId: '', parentId: '', name: '' });
    setModalOpen(true);
  };

  const openEdit = (item: Department) => {
    setEditItem(item);
    setForm({
      companyId: item.companyId,
      branchId: item.branchId || '',
      parentId: item.parentId || '',
      name: item.name,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.companyId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { name: form.name, companyId: form.companyId };
      if (form.branchId) payload.branchId = form.branchId;
      if (form.parentId) payload.parentId = form.parentId;
      if (editItem) {
        await api.patch(`/departments/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/departments', payload);
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
      await api.patch(`/departments/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'company', header: t('core.company'), render: (d: Department) => d.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), render: (d: Department) => d.branch?.name || '-' },
    { key: 'parent', header: t('core.parentDepartment'), render: (d: Department) => d.parent?.name || '-' },
    { key: 'status', header: t('common.status'), render: (d: Department) => <StatusBadge status={d.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (d: Department) => (
        <div className="flex gap-2">
          <button onClick={() => router.push(`/admin/core/departments/${d.id}`)} className="text-indigo-600 hover:text-indigo-800 text-sm">{t('details.viewDetails')}</button>
          <button onClick={() => openEdit(d)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
          <button onClick={() => d.status === 'ACTIVE' ? confirmStatusChange(d.id, 'deactivate') : confirmStatusChange(d.id, 'activate')}
            className={`text-sm ${d.status === 'ACTIVE' ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
            {d.status === 'ACTIVE' ? t('actions.deactivate') : t('actions.activate')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('core.departments')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('core.newDepartment')} loading={loading} />

      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(d: Department) => d.id} onRowClick={(item: Department) => setSelectedId(item.id)} selectedKey={selectedId} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('core.editDepartment') : t('core.newDepartment')}>
        <div className="space-y-4">
          <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
          <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
          <F9Lookup label={t('core.parentDepartment')} value={form.parentId} onChange={(v) => setForm({ ...form, parentId: v })} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)}
        onConfirm={handleStatusChange}
        title={confirmAction === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={confirmAction === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
        variant={confirmAction === 'activate' ? 'primary' : 'danger'} loading={saving} />
    </div>
  );
}
