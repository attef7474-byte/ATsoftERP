'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { WarehouseLocation } from '../../../../lib/admin-types';
import { Button, Input, Textarea, Pagination, PageHeader, Toolbar, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, warehouseAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function WarehouseLocationsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ warehouseId: '', code: '', name: '', description: '' });
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
      if (warehouseFilter) params.warehouseId = warehouseFilter;
      const res = await api.get<{ data: any[]; meta: any }>('/inventory/locations', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, warehouseFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ warehouseId: '', code: '', name: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      warehouseId: item.warehouseId,
      code: item.code,
      name: item.name,
      description: item.description || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.warehouseId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { warehouseId: form.warehouseId, code: form.code, name: form.name };
      if (form.description) payload.description = form.description;
      if (editItem) {
        await api.patch(`/inventory/locations/${editItem.id}`, payload);
        showToast(t('inventory.locations.updateSuccess'), 'success');
      } else {
        await api.post('/inventory/locations', payload);
        showToast(t('inventory.locations.createSuccess'), 'success');
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
      const isActive = item?.status === 'ACTIVE';
      if (isActive) {
        await api.delete(`/inventory/locations/${selectedId}`);
        showToast(t('inventory.locations.deactivateSuccess'), 'success');
      } else {
        await api.patch(`/inventory/locations/${selectedId}/activate`, {});
        showToast(t('inventory.locations.activateSuccess'), 'success');
      }
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const columns: GridColumn<any>[] = [
    { key: 'code', header: t('inventory.locations.code') },
    { key: 'name', header: t('inventory.locations.name') },
    { key: 'warehouse', header: t('inventory.locations.warehouse'), render: (item: any) => item.warehouse?.name || '-' },
    { key: 'status', header: t('common.status'), render: (item: any) => <StatusBadge status={item.status} /> },
    { key: 'createdAt', header: t('common.createdAt'), render: (item: any) => item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-' },
    { key: 'updatedAt', header: t('common.updatedAt'), render: (item: any) => item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-' },
  ];

  return (
    <div>
      <PageHeader title={t('inventory.locations.title')} />
      <div className="flex items-center gap-3 mb-4">
        <div className="w-48">
          <F9Lookup value={warehouseFilter} onChange={(v) => { setWarehouseFilter(v); fetchData(1); }} adapter={warehouseAdapter} placeholder={t('common.all')} />
        </div>
        <Button variant="secondary" onClick={openCreate}>{t('inventory.locations.newLocation')}</Button>
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(item: any) => item.id}
        onRowClick={(item: any) => setSelectedId(item.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('inventory.locations.noLocations')}
        loadingMessage={t('inventory.locations.loadingLocations')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventory.locations.editLocation') : t('inventory.locations.newLocation')}>
        <div className="space-y-4">
          <F9Lookup label={t('inventory.locations.warehouse')} value={form.warehouseId} onChange={(v) => setForm({ ...form, warehouseId: v })} adapter={warehouseAdapter} />
          <Input label={t('inventory.locations.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input label={t('inventory.locations.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Textarea label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
