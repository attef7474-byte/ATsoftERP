'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { InventoryMovement } from '../../../../lib/admin-types';
import { Button, Input, Select, Textarea, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { InventoryStatusBadge } from '../../../../components/inventory-counting/InventoryStatusBadge';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter, productAdapter, warehouseLocationAdapter } from '../../../../components/f9';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionPostIcon, ActionCancelIcon } from '../../../../components/admin/admin-action-bar';

export default function InventoryMovementsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<InventoryMovement[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [filters, setFilters] = useState({ companyId: '', branchId: '', warehouseId: '', movementType: '', status: '' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryMovement | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', warehouseId: '', movementType: 'OPENING', direction: 'IN', movementDate: new Date().toISOString().split('T')[0], sourceType: '', sourceId: '', notes: '' });
  const [lines, setLines] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [lineForm, setLineForm] = useState({ productId: '', warehouseLocationId: '', quantity: 1, direction: 'IN', notes: '' });

  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    post: () => confirmAction(selectedId, 'post'),
    cancel: () => confirmAction(selectedId, 'cancel'),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'post', labelKey: 'inventoryCounting.post', icon: <ActionPostIcon />, onClick: () => exec('post'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
    { id: 'cancel', labelKey: 'inventoryCounting.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT'), variant: 'danger' },
  ]);

  const [pendingAction, setPendingAction] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get<{ data: InventoryMovement[]; meta: any }>('/inventory/movements', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, filters, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ companyId: '', branchId: '', warehouseId: '', movementType: 'OPENING', direction: 'IN', movementDate: new Date().toISOString().split('T')[0], sourceType: '', sourceId: '', notes: '' });
    setLines([]);
    setModalOpen(true);
  };
  const openEdit = (item: InventoryMovement) => {
    setEditItem(item);
    setForm({
      companyId: item.companyId, branchId: item.branchId, warehouseId: item.warehouseId,
      movementType: item.movementType, direction: item.direction, movementDate: item.movementDate.split('T')[0],
      sourceType: item.sourceType || '', sourceId: item.sourceId || '', notes: item.notes || '',
    });
    setLines((item.lines || []).map((l: any) => ({ ...l, _id: l.id || Date.now().toString() })));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.companyId || !form.branchId || !form.warehouseId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = {
        companyId: form.companyId, branchId: form.branchId, warehouseId: form.warehouseId,
        movementType: form.movementType, direction: form.direction, movementDate: form.movementDate,
        sourceType: form.sourceType || undefined, sourceId: form.sourceId || undefined, notes: form.notes || undefined,
        lines: lines.map((l) => ({ productId: l.productId, warehouseLocationId: l.warehouseLocationId || undefined, quantity: l.quantity, direction: l.direction, notes: l.notes || undefined })),
      };
      if (editItem) {
        await api.patch(`/inventory/movements/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/inventory/movements', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const handleAddLine = () => {
    if (!lineForm.productId || !lineForm.quantity) return;
    setLines([...lines, { ...lineForm, _id: Date.now().toString() }]);
    setLineForm({ productId: '', warehouseLocationId: '', quantity: 1, direction: 'IN', notes: '' });
    setLineFormOpen(false);
  };
  const handleRemoveLine = (id: string) => setLines(lines.filter((l) => l._id !== id));

  const confirmAction = (id: string, action: string) => { setSelectedId(id); setPendingAction(action); setActionConfirmOpen(true); };
  const handleAction = async () => {
    setSaving(true);
    try {
      await api.patch(`/inventory/movements/${selectedId}/${pendingAction}`);
      showToast(t('common.successUpdated'), 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const movementTypeOptions = [
    { value: 'OPENING', label: t('status.OPENING') },
    { value: 'PURCHASE_RECEIPT', label: t('status.PURCHASE_RECEIPT') },
    { value: 'SALES_ISSUE', label: t('status.SALES_ISSUE') },
    { value: 'PRODUCTION_RECEIPT', label: t('status.PRODUCTION_RECEIPT') },
    { value: 'PRODUCTION_ISSUE', label: t('status.PRODUCTION_ISSUE') },
    { value: 'TRANSFER_IN', label: t('status.TRANSFER_IN') },
    { value: 'TRANSFER_OUT', label: t('status.TRANSFER_OUT') },
    { value: 'ADJUSTMENT_IN', label: t('status.ADJUSTMENT_IN') },
    { value: 'ADJUSTMENT_OUT', label: t('status.ADJUSTMENT_OUT') },
    { value: 'COUNT_ADJUSTMENT', label: t('status.COUNT_ADJUSTMENT') },
  ];
  const statusOptions = [
    { value: '', label: t('common.all') },
    { value: 'DRAFT', label: t('status.DRAFT') },
    { value: 'POSTED', label: t('status.POSTED') },
    { value: 'CANCELLED', label: t('status.CANCELLED') },
  ];
  const directionOptions = [
    { value: 'IN', label: t('status.IN') },
    { value: 'OUT', label: t('status.OUT') },
  ];

  const columns = [
    { key: 'movementNumber', header: t('inventoryCounting.movementNumber') },
    { key: 'company', header: t('inventoryCounting.company'), render: (r: InventoryMovement) => r.company?.name || '-' },
    { key: 'branch', header: t('inventoryCounting.branch'), render: (r: InventoryMovement) => r.branch?.name || '-' },
    { key: 'warehouse', header: t('inventoryCounting.warehouse'), render: (r: InventoryMovement) => r.warehouse?.name || '-' },
    { key: 'movementType', header: t('inventoryCounting.movementType'), render: (r: InventoryMovement) => t(`status.${r.movementType}` as any) || r.movementType },
    { key: 'status', header: t('common.status'), render: (r: InventoryMovement) => <InventoryStatusBadge status={r.status} /> },
    { key: 'direction', header: t('inventoryCounting.direction'), render: (r: InventoryMovement) => (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.direction === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {t(`status.${r.direction}` as any)}
      </span>
    )},
    { key: 'movementDate', header: t('inventoryCounting.movementDate'), render: (r: InventoryMovement) => r.movementDate ? new Date(r.movementDate).toLocaleDateString() : '-' },
    { key: 'postedAt', header: t('inventoryCounting.postedAt'), render: (r: InventoryMovement) => r.postedAt ? new Date(r.postedAt).toLocaleDateString() : '-' },
    { key: 'totalInQty', header: t('inventoryCounting.totalInQty'), render: (r: any) => r.totalInQty ?? '-' },
    { key: 'totalOutQty', header: t('inventoryCounting.totalOutQty'), render: (r: any) => r.totalOutQty ?? '-' },
    {
      key: 'actions', header: t('common.actions'), render: (r: InventoryMovement) => (
        <div className="flex gap-2 flex-wrap">
          {r.status === 'DRAFT' && <button onClick={() => confirmAction(r.id, 'post')} className="text-green-600 hover:text-green-800 text-sm">{t('inventoryCounting.post')}</button>}
          {r.status === 'DRAFT' && <button onClick={() => confirmAction(r.id, 'cancel')} className="text-red-600 hover:text-red-800 text-sm">{t('inventoryCounting.cancel')}</button>}
          {r.status === 'DRAFT' && <button onClick={() => openEdit(r)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('inventoryCounting.movements')} />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <F9Lookup label={t('inventoryCounting.company')} value={filters.companyId} onChange={(v) => setFilters({ ...filters, companyId: v })} adapter={companyAdapter} />
        <F9Lookup label={t('inventoryCounting.branch')} value={filters.branchId} onChange={(v) => setFilters({ ...filters, branchId: v })} adapter={branchAdapter} />
        <F9Lookup label={t('inventoryCounting.warehouse')} value={filters.warehouseId} onChange={(v) => setFilters({ ...filters, warehouseId: v })} adapter={warehouseAdapter} />
        <Select label={t('inventoryCounting.movementType')} value={filters.movementType} onChange={(e) => setFilters({ ...filters, movementType: e.target.value })} options={movementTypeOptions} />
        <Select label={t('common.status')} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={statusOptions} />
      </div>
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('inventoryCounting.newMovement')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('inventoryCounting.noMovements')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(r: InventoryMovement) => r.id} onRowClick={(r: InventoryMovement) => setSelectedId(r.id)} selectedKey={selectedId} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventoryCounting.editMovement') : t('inventoryCounting.newMovement')} size="lg">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            <F9Lookup label={t('inventoryCounting.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
            <F9Lookup label={t('inventoryCounting.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} />
            <F9Lookup label={t('inventoryCounting.warehouse')} value={form.warehouseId} onChange={(v) => setForm({ ...form, warehouseId: v })} adapter={warehouseAdapter} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label={t('inventoryCounting.movementType')} value={form.movementType} onChange={(e) => setForm({ ...form, movementType: e.target.value })} options={movementTypeOptions} />
            <Select label={t('inventoryCounting.direction')} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} options={directionOptions} />
            <Input label={t('inventoryCounting.movementDate')} type="date" value={form.movementDate} onChange={(e) => setForm({ ...form, movementDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('inventoryCounting.sourceType')} value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })} />
            <Input label={t('inventoryCounting.sourceId')} value={form.sourceId} onChange={(e) => setForm({ ...form, sourceId: e.target.value })} />
          </div>
          <Textarea label={t('inventoryCounting.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{t('inventoryCounting.lines')}</h4>
              <Button variant="secondary" size="sm" onClick={() => setLineFormOpen(!lineFormOpen)}>{t('inventoryCounting.addLine')}</Button>
            </div>
            {lineFormOpen && (
              <div className="border rounded p-3 mb-3 space-y-3 bg-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  <F9Lookup label={t('inventoryCounting.product')} value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
                  <F9Lookup label={t('inventoryCounting.warehouseLocation')} value={lineForm.warehouseLocationId} onChange={(v) => setLineForm({ ...lineForm, warehouseLocationId: v })} adapter={warehouseLocationAdapter} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input label={t('inventoryCounting.quantity')} type="number" value={String(lineForm.quantity)} onChange={(e) => setLineForm({ ...lineForm, quantity: Number(e.target.value) })} />
                  <Select label={t('inventoryCounting.direction')} value={lineForm.direction} onChange={(e) => setLineForm({ ...lineForm, direction: e.target.value })} options={directionOptions} />
                  <div className="flex items-end">
                    <Button onClick={handleAddLine}>{t('actions.add')}</Button>
                  </div>
                </div>
                <Textarea label={t('inventoryCounting.notes')} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
              </div>
            )}
            {lines.length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2">{t('inventoryCounting.product')}</th>
                    <th className="text-left p-2">{t('inventoryCounting.warehouseLocation')}</th>
                    <th className="text-right p-2">{t('inventoryCounting.quantity')}</th>
                    <th className="text-center p-2">{t('inventoryCounting.direction')}</th>
                    <th className="text-left p-2">{t('inventoryCounting.notes')}</th>
                    <th className="text-center p-2">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line._id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{line.product?.name || line.productId}</td>
                      <td className="p-2">{line.warehouseLocation?.name || line.warehouseLocationId || '-'}</td>
                      <td className="p-2 text-right">{line.quantity}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${line.direction === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {t(`status.${line.direction}` as any)}
                        </span>
                      </td>
                      <td className="p-2">{line.notes || '-'}</td>
                      <td className="p-2 text-center">
                        <button onClick={() => handleRemoveLine(line._id)} className="text-red-600 hover:text-red-800 text-sm">{t('actions.remove')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title={t('common.confirm')}
        message={pendingAction === 'post' ? t('inventoryCounting.confirmPostMovement') : t('inventoryCounting.confirmCancelMovement')}
        variant={pendingAction === 'cancel' ? 'danger' : 'primary'} loading={saving} />
    </div>
  );
}
