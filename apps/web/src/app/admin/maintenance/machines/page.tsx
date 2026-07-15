'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Machine } from '../../../../lib/admin-types';
import { Button, Input, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter, departmentAdapter, machineCategoryAdapter } from '../../../../components/f9';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function MachinesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Machine[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Machine | null>(null);
  const [form, setForm] = useState({
    code: '', name: '', categoryId: '', companyId: '', branchId: '', departmentId: '',
    model: '', serialNumber: '', manufacturer: '', purchaseDate: '', warrantyEnd: '', location: '', notes: '',
  });
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
      const res = await api.get<{ data: Machine[]; meta: any }>('/maintenance/machines', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', categoryId: '', companyId: '', branchId: '', departmentId: '', model: '', serialNumber: '', manufacturer: '', purchaseDate: '', warrantyEnd: '', location: '', notes: '' });
    setModalOpen(true);
  };
  const openEdit = (item: Machine) => {
    setEditItem(item);
    setForm({
      code: item.code, name: item.name, categoryId: item.categoryId || '',
      companyId: item.companyId || '', branchId: item.branchId || '', departmentId: item.departmentId || '',
      model: item.model || '', serialNumber: item.serialNumber || '', manufacturer: item.manufacturer || '',
      purchaseDate: item.purchaseDate ? item.purchaseDate.split('T')[0] : '',
      warrantyEnd: item.warrantyEnd ? item.warrantyEnd.split('T')[0] : '',
      location: item.location || '', notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { code: form.code, name: form.name };
      if (form.categoryId) payload.categoryId = form.categoryId;
      if (form.companyId) payload.companyId = form.companyId;
      if (form.branchId) payload.branchId = form.branchId;
      if (form.departmentId) payload.departmentId = form.departmentId;
      if (form.model) payload.model = form.model;
      if (form.serialNumber) payload.serialNumber = form.serialNumber;
      if (form.manufacturer) payload.manufacturer = form.manufacturer;
      if (form.purchaseDate) payload.purchaseDate = form.purchaseDate;
      if (form.warrantyEnd) payload.warrantyEnd = form.warrantyEnd;
      if (form.location) payload.location = form.location;
      if (form.notes) payload.notes = form.notes;
      if (editItem) {
        await api.patch(`/maintenance/machines/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/machines', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const confirmStatus = (id: string) => { setSelectedId(id); setConfirmOpen(true); };
  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((m) => m.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/maintenance/machines/${selectedId}`, { status });
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
    { key: 'category', header: t('maintenance.machineCategory'), render: (m: Machine) => m.category?.name || '-' },
    { key: 'model', header: t('maintenance.model'), render: (m: Machine) => m.model || '-' },
    { key: 'serialNumber', header: t('maintenance.serialNumber'), render: (m: Machine) => m.serialNumber || '-' },
    { key: 'manufacturer', header: t('maintenance.manufacturer'), render: (m: Machine) => m.manufacturer || '-' },
    { key: 'status', header: t('common.status'), render: (m: Machine) => <StatusBadge status={m.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (m: Machine) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(m)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
          <button onClick={() => confirmStatus(m.id)}
            className={`text-sm ${m.status === 'ACTIVE' ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
            {m.status === 'ACTIVE' ? t('actions.deactivate') : t('actions.activate')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.machines')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('maintenance.newMachine')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(m: Machine) => m.id} onRowClick={(item: Machine) => setSelectedId(item.id)} selectedKey={selectedId} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editMachine') : t('maintenance.newMachine')} size="lg">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <F9Lookup label={t('maintenance.machineCategory')} value={form.categoryId} onChange={(v) => setForm({ ...form, categoryId: v })} adapter={machineCategoryAdapter} />
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
            <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
          </div>
          <F9Lookup label={t('core.department')} value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('maintenance.model')} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <Input label={t('maintenance.serialNumber')} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          </div>
          <Input label={t('maintenance.manufacturer')} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('maintenance.purchaseDate')} type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
            <Input label={t('maintenance.warrantyEnd')} type="date" value={form.warrantyEnd} onChange={(e) => setForm({ ...form, warrantyEnd: e.target.value })} />
          </div>
          <Input label={t('inventory.location')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Input label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
