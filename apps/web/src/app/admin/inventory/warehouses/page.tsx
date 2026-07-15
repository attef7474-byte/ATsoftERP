'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Warehouse } from '../../../../lib/admin-types';
import { Button, Input, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function WarehousesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Warehouse[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', code: '', name: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
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
      const res = await api.get<{ data: Warehouse[]; meta: any }>('/inventory/warehouses', { params });
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
    setForm({ companyId: '', branchId: '', code: '', name: '', location: '' });
    setModalOpen(true);
  };

  const openEdit = (item: Warehouse) => {
    setEditItem(item);
    setForm({
      companyId: item.companyId,
      branchId: item.branchId || '',
      code: item.code,
      name: item.name,
      location: item.location || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.companyId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { companyId: form.companyId, code: form.code, name: form.name };
      if (form.branchId) payload.branchId = form.branchId;
      if (form.location) payload.location = form.location;
      if (editItem) {
        await api.patch(`/inventory/warehouses/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/inventory/warehouses', payload);
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

  const confirmStatus = (id: string) => { setSelectedId(id); setConfirmOpen(true); };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((w) => w.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/inventory/warehouses/${selectedId}`, { status });
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'company', header: t('core.company'), render: (w: Warehouse) => w.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), render: (w: Warehouse) => w.branch?.name || '-' },
    { key: 'location', header: t('inventory.location'), render: (w: Warehouse) => w.location || '-' },
    { key: 'status', header: t('common.status'), render: (w: Warehouse) => <StatusBadge status={w.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (w: Warehouse) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(w)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
          <button onClick={() => confirmStatus(w.id)}
            className={`text-sm ${w.status === 'ACTIVE' ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
            {w.status === 'ACTIVE' ? t('actions.deactivate') : t('actions.activate')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('inventory.warehouses')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('inventory.newWarehouse')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(w: Warehouse) => w.id} selectedKey={selectedId} onRowClick={(item: Warehouse) => setSelectedId(item.id)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventory.editWarehouse') : t('inventory.newWarehouse')}>
        <div className="space-y-4">
          <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
          <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
          <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('inventory.location')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
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
