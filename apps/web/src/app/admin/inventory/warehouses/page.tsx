'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { safeString, unwrapApiData, unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Warehouse } from '../../../../lib/admin-types';
import { Button, Input, Card, Pagination, PageHeader, LoadingState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, companyAdapter, branchAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function WarehousesPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Warehouse[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', name: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
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
      const listResult = unwrapApiList<Warehouse, typeof meta>(res);
      setData(listResult.data);
      if (listResult.meta) setMeta(listResult.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ companyId: '', branchId: '', name: '', location: '' });
    setModalOpen(true);
  };

  const openEdit = async (item: Warehouse) => {
    setEditItem(item);
    setDetailLoading(true);
    setModalOpen(true);
    try {
      const res = await api.get<any>(`/inventory/warehouses/${item.id}`);
      const detail = unwrapApiData<Warehouse>(res);
      setForm({
        companyId: safeString(detail.companyId),
        branchId: safeString(detail.branchId),
        name: safeString(detail.name),
        location: safeString(detail.location),
      });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.companyId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { companyId: form.companyId, name: form.name };
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

  const columns: GridColumn<Warehouse>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('common.name'), sortable: true, filterable: true },
    { key: 'company', header: t('core.company'), sortable: true, render: (w: Warehouse) => w.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), sortable: true, render: (w: Warehouse) => w.branch?.name || '-' },
    { key: 'location', header: t('inventory.location'), render: (w: Warehouse) => w.location || '-' },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('common.active') }, { value: 'INACTIVE', label: t('common.inactive') },
    ], render: (w: Warehouse) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${w.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{w.status}</span>
    )},
  ];

  const gridActions: GridAction<Warehouse>[] = [
    { label: t('actions.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (w: Warehouse) => openEdit(w) },
    { label: t('actions.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, onClick: (w: Warehouse) => confirmStatus(w.id), enabled: (w: Warehouse) => w.status !== 'ACTIVE' },
    { label: t('actions.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, onClick: (w: Warehouse) => confirmStatus(w.id), enabled: (w: Warehouse) => w.status === 'ACTIVE' },
  ];

  return (
    <div>
      <PageHeader title={t('inventory.warehouses')} />
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
        </div>
      )}
      {!error && loading && data.length === 0 && <LoadingState />}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('common.noData')}</p>
        </div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <AdminDataGrid
          columns={columns}
          data={data}
          keyExtractor={(w: Warehouse) => w.id}
          selectedKey={selectedId}
          onRowClick={(item: Warehouse) => setSelectedId(item.id)}
          loading={loading}
          emptyMessage={t('common.noData')}
          error={error || undefined}
          actions={gridActions}
          dir={dir}
          globalSearch={search}
          onGlobalSearch={setSearch}
          searchPlaceholder={t('common.search')}
          onRefresh={() => fetchData(meta.page)}
          refreshLoading={loading}
        />
      )}
      {data.length > 0 && (
        <div className="mt-3">
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </div>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventory.editWarehouse') : t('inventory.newWarehouse')}>
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
          <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('inventory.location')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" loading={saving} />
    </div>
  );
}
