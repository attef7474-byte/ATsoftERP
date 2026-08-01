'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MachinePart } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, machineAdapter, productAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../lib/form-validation';

export default function MachinePartsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<MachinePart[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MachinePart | null>(null);
  const [form, setForm] = useState({ name: '', partNumber: '', unit: '', quantity: '0', minStock: '0', machineId: '', productId: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

const { exec } = useStableHandlers({
  new: () => openCreate(),
  edit: () => selectedId && openEdit(selectedId),
  refresh: () => fetchData(meta.page),
  delete: () => setConfirmDeleteOpen(true),
});

useRegisterAdminActions([
  { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
  { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
  { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, onClick: () => exec('delete'), enabled: !!selectedId, variant: 'danger' },
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
    setForm({ name: '', partNumber: '', unit: '', quantity: '0', minStock: '0', machineId: '', productId: '' });
    setValidationErrors({});
    setModalOpen(true);
  };
  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setValidationErrors({});
    try {
      const item = await api.get<MachinePart>('/maintenance/machine-parts/' + id);
      setEditItem(item);
      setForm({
        name: item.name, partNumber: item.partNumber || '',
        unit: item.unit || '', quantity: String(item.quantity ?? 0), minStock: String(item.minStock ?? 0),
        machineId: item.machineId || '', productId: item.productId || '',
      });
      setModalOpen(true);
    } catch (err: any) { handleApiError(err); }
    finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t('validation.required');
    if (!form.unit.trim()) errors.unit = t('validation.required');
    if (Number.isNaN(Number(form.quantity)) || Number(form.quantity) < 0) errors.quantity = t('validation.invalidQuantity');
    if (Number.isNaN(Number(form.minStock)) || Number(form.minStock) < 0) errors.minStock = t('validation.invalidQuantity');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(Object.entries(errors).map(([field, message]) => ({ field, code: 'validation.required', message })));
      return;
    }
    setSaving(true);
    try {
      const payload: any = { name: form.name.trim(), unit: form.unit.trim(), quantity: Number(form.quantity), minStock: Number(form.minStock) };
      if (form.partNumber.trim()) payload.partNumber = form.partNumber.trim();
      if (form.machineId) payload.machineId = form.machineId;
      if (form.productId) payload.productId = form.productId;
      if (editItem) {
        await api.patch(`/maintenance/machine-parts/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/machine-parts', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) {
      const config = handleApiError(err);
      if (config.errors?.length) {
        setValidationErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      }
    }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.delete('/maintenance/machine-parts/' + selectedId);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<MachinePart>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'partNumber', header: t('maintenance.partNumber'), render: (p: MachinePart) => p.partNumber || '-' },
    { key: 'machine', header: t('maintenance.machine'), render: (p: MachinePart) => p.machine?.name || '-' },
    { key: 'quantity', header: t('maintenance.quantity'), render: (p: MachinePart) => p.quantity },
    { key: 'unit', header: t('maintenance.unit'), render: (p: MachinePart) => p.unit || '-' },
  ];

  const gridActions: GridAction<MachinePart>[] = [
    { label: t('actions.edit'), onClick: (p: MachinePart) => openEdit(p.id) },
    { label: t('common.delete'), onClick: (p: MachinePart) => { setSelectedId(p.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
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
            {editItem ? (
              <div>
                <Input label={t('common.code')} value={editItem.code} disabled />
                <p className="text-sm text-gray-500 mt-1">{t('common.codeImmutableHint')}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('common.codeAutoGenerated')}</p>
            )}
            <div>
              <Input label={t('common.name')} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} required />
              {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
            </div>
          </div>
          <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setForm({ ...form, machineId: v })} adapter={machineAdapter} />
          <F9Lookup label={t('maintenance.linkedInventoryItem')} value={form.productId} onChange={(v) => setForm({ ...form, productId: v })} adapter={productAdapter} />
          <Input label={t('maintenance.partNumber')} value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label={t('maintenance.unit')} value={form.unit} onChange={(e) => { setForm({ ...form, unit: e.target.value }); setValidationErrors(prev => ({ ...prev, unit: '' })); }} required />
              {validationErrors.unit && <p className="text-red-500 text-sm mt-1">{validationErrors.unit}</p>}
            </div>
            <div>
              <Input label={t('maintenance.quantity')} type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              {validationErrors.quantity && <p className="text-red-500 text-sm mt-1">{validationErrors.quantity}</p>}
            </div>
            <div>
              <Input label={t('maintenance.minimumStock')} type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
              {validationErrors.minStock && <p className="text-red-500 text-sm mt-1">{validationErrors.minStock}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving || loadingDetail}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
