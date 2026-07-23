'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MachinePart } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, machineAdapter, productAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function MachinePartsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<MachinePart[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MachinePart | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', machineId: '', productId: '', partNumber: '', serialNumber: '', manufacturer: '', quantity: 1, unit: '', replacementInterval: '' });
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
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: MachinePart[]; meta: any }>('/maintenance/machine-parts', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', description: '', machineId: '', productId: '', partNumber: '', serialNumber: '', manufacturer: '', quantity: 1, unit: '', replacementInterval: '' });
    setModalOpen(true);
  };
  const openEdit = (item: MachinePart) => {
    setEditItem(item);
    setForm({
      code: item.code, name: item.name, description: item.description || '',
      machineId: item.machineId || '', productId: item.productId || '',
      partNumber: item.partNumber || '', serialNumber: item.serialNumber || '',
      manufacturer: item.manufacturer || '', quantity: item.quantity, unit: item.unit || '',
      replacementInterval: item.replacementInterval ? String(item.replacementInterval) : '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { code: form.code, name: form.name };
      if (form.description) payload.description = form.description;
      if (form.machineId) payload.machineId = form.machineId;
      if (form.productId) payload.productId = form.productId;
      if (form.partNumber) payload.partNumber = form.partNumber;
      if (form.serialNumber) payload.serialNumber = form.serialNumber;
      if (form.manufacturer) payload.manufacturer = form.manufacturer;
      payload.quantity = form.quantity;
      if (form.unit) payload.unit = form.unit;
      if (form.replacementInterval) payload.replacementInterval = parseInt(form.replacementInterval, 10);
      if (editItem) {
        await api.patch(`/maintenance/machine-parts/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/machine-parts', payload);
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
      const item = data.find((p) => p.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (status === 'ACTIVE') {
        await api.patch(`/maintenance/machine-parts/${selectedId}/activate`);
      } else {
        await api.patch(`/maintenance/machine-parts/${selectedId}/deactivate`);
      }
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<MachinePart>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'partNumber', header: t('maintenance.partNumber'), render: (p: MachinePart) => p.partNumber || '-' },
    { key: 'machine', header: t('maintenance.machine'), render: (p: MachinePart) => p.machine?.name || '-' },
    { key: 'quantity', header: t('maintenance.quantity'), render: (p: MachinePart) => p.quantity },
    { key: 'status', header: t('common.status'), render: (p: MachinePart) => <CmmsStatusBadge status={p.status} /> },
  ];

  const gridActions: GridAction<MachinePart>[] = [
    { label: t('actions.edit'), onClick: (p: MachinePart) => openEdit(p) },
    { label: t('actions.deactivate'), onClick: (p: MachinePart) => confirmStatus(p.id), enabled: (p: MachinePart) => p.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (p: MachinePart) => confirmStatus(p.id), enabled: (p: MachinePart) => p.status !== 'ACTIVE' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.machineParts')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(p: MachinePart) => p.id}
        onRowClick={(p: MachinePart) => setSelectedId(p.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editMachinePart') : t('maintenance.newMachinePart')} size="lg">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setForm({ ...form, machineId: v })} adapter={machineAdapter} />
          <F9Lookup label={t('inventory.product')} value={form.productId} onChange={(v) => setForm({ ...form, productId: v })} adapter={productAdapter} />
          <Input label={t('maintenance.partNumber')} value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('maintenance.quantity')} type="number" value={String(form.quantity)} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
            <Input label={t('maintenance.unit')} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <Input label={t('maintenance.serialNumber')} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          <Input label={t('maintenance.manufacturer')} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          <Input label={t('maintenance.replacementInterval')} type="number" value={form.replacementInterval} onChange={(e) => setForm({ ...form, replacementInterval: e.target.value })} />
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
