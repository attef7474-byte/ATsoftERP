'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { InventoryAdjustment, InventoryAdjustmentLine } from '../../../../lib/admin-types';
import { Button, Input, Select, Textarea, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { InventoryStatusBadge } from '../../../../components/inventory-counting/InventoryStatusBadge';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter, productAdapter } from '../../../../components/f9';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionPostIcon, ActionCancelIcon } from '../../../../components/admin/admin-action-bar';

export default function InventoryAdjustmentsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<InventoryAdjustment[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({ companyId: '', branchId: '', warehouseId: '', status: '' });
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryAdjustment | null>(null);
  const [form, setForm] = useState({
    companyId: '', branchId: '', warehouseId: '',
    adjustmentDate: new Date().toISOString().split('T')[0],
    reason: '', notes: '',
  });
  const [lines, setLines] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [lineForm, setLineForm] = useState({ productId: '', countedQty: 0, notes: '' });
  const [lineSystemQty, setLineSystemQty] = useState(0);

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

  const [viewingItem, setViewingItem] = useState<InventoryAdjustment | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (filters.companyId) params.companyId = filters.companyId;
      if (filters.branchId) params.branchId = filters.branchId;
      if (filters.warehouseId) params.warehouseId = filters.warehouseId;
      if (filters.status) params.status = filters.status;
      if (search) params.search = search;
      const res = await api.get<{ data: InventoryAdjustment[]; meta: any }>('/inventory/adjustments', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [filters, search, t]);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!lineForm.productId || !form.warehouseId) { setLineSystemQty(0); return; }
    api.get<any[]>(`/inventory/balances/product/${lineForm.productId}`).then((balances) => {
      const whBalance = balances.find((b: any) => b.warehouseId === form.warehouseId);
      setLineSystemQty(whBalance?.quantity ?? 0);
    }).catch(() => setLineSystemQty(0));
  }, [lineForm.productId, form.warehouseId]);

  const openCreate = () => {
    setEditItem(null);
    setForm({
      companyId: '', branchId: '', warehouseId: '',
      adjustmentDate: new Date().toISOString().split('T')[0],
      reason: '', notes: '',
    });
    setLines([]); setModalOpen(true);
  };

  const openEdit = (item: InventoryAdjustment) => {
    setEditItem(item);
    setForm({
      companyId: item.companyId, branchId: item.branchId, warehouseId: item.warehouseId,
      adjustmentDate: item.adjustmentDate.split('T')[0],
      reason: item.reason || '', notes: item.notes || '',
    });
    setLines((item.lines || []).map((l: any) => ({
      id: l.id, productId: l.productId, systemQty: l.systemQty,
      countedQty: l.countedQty, differenceQty: l.differenceQty,
      notes: l.notes || '', product: l.product,
    })));
    setModalOpen(true);
  };

  const openView = async (item: InventoryAdjustment) => {
    try {
      const res = await api.get<any>(`/inventory/adjustments/${item.id}`);
      setViewingItem(res);
    } catch { setViewingItem(item); }
    setViewDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.companyId || !form.branchId || !form.warehouseId) {
      showToast(t('validation.required'), 'error'); return;
    }
    if (lines.length === 0) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = {
        companyId: form.companyId, branchId: form.branchId, warehouseId: form.warehouseId,
        adjustmentDate: form.adjustmentDate, reason: form.reason || undefined, notes: form.notes || undefined,
        lines: lines.map((l) => ({ productId: l.productId, countedQty: l.countedQty, notes: l.notes || undefined })),
      };
      if (editItem) {
        await api.patch(`/inventory/adjustments/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/inventory/adjustments', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) {       showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const handleAddLine = () => {
    if (!lineForm.productId || lineForm.countedQty <= 0) return;
    setLines([...lines, { ...lineForm, systemQty: lineSystemQty, differenceQty: lineForm.countedQty - lineSystemQty, _id: Date.now().toString() }]);
    setLineForm({ productId: '', countedQty: 0, notes: '' });
    setLineSystemQty(0);
    setLineFormOpen(false);
  };

  const handleRemoveLine = (id: string) => setLines(lines.filter((l) => l._id !== id));

  const confirmAction = (id: string, action: string) => { setSelectedId(id); setPendingAction(action); setActionConfirmOpen(true); };
  const handleAction = async () => {
    setSaving(true);
    try {
      await api.patch(`/inventory/adjustments/${selectedId}/${pendingAction}`);
      showToast(t('common.successUpdated'), 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const statusOptions = [
    { value: '', label: t('common.all') },
    { value: 'DRAFT', label: t('status.DRAFT') },
    { value: 'POSTED', label: t('status.POSTED') },
    { value: 'CANCELLED', label: t('status.CANCELLED') },
  ];

  const columns = [
    { key: 'adjustmentNumber', header: t('inventoryCounting.adjustmentNumber') },
    { key: 'company', header: t('inventoryCounting.company'), render: (r: InventoryAdjustment) => r.company?.name || '-' },
    { key: 'branch', header: t('inventoryCounting.branch'), render: (r: InventoryAdjustment) => r.branch?.name || '-' },
    { key: 'warehouse', header: t('inventoryCounting.warehouse'), render: (r: InventoryAdjustment) => r.warehouse?.name || '-' },
    { key: 'status', header: t('common.status'), render: (r: InventoryAdjustment) => <InventoryStatusBadge status={r.status} /> },
    { key: 'adjustmentDate', header: t('inventoryCounting.adjustmentDate'), render: (r: InventoryAdjustment) => r.adjustmentDate ? new Date(r.adjustmentDate).toLocaleDateString() : '-' },
    { key: 'reason', header: t('inventoryCounting.reason'), render: (r: InventoryAdjustment) => r.reason || '-' },
    { key: 'sourceCount', header: t('inventoryCounting.inventoryCountRef'), render: (r: InventoryAdjustment) => r.inventoryCount ? (
      <button onClick={() => router.push(`/admin/inventory/counts/${r.inventoryCount!.id}`)} className="text-indigo-600 hover:text-indigo-800 text-sm underline">{r.inventoryCount.countNumber}</button>
    ) : '-' },
    { key: 'postedAt', header: t('inventoryCounting.postedAt'), render: (r: InventoryAdjustment) => r.postedAt ? new Date(r.postedAt).toLocaleString() : '-' },
    {
      key: 'actions', header: t('common.actions'), render: (r: InventoryAdjustment) => (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => router.push(`/admin/inventory/adjustments/${r.id}`)} className="text-indigo-600 hover:text-indigo-800 text-sm">{t('details.viewDetails')}</button>
          {r.status === 'DRAFT' && (
            <>
              <button onClick={() => confirmAction(r.id, 'post')} className="text-green-600 hover:text-green-800 text-sm">{t('inventoryCounting.post')}</button>
              <button onClick={() => openEdit(r)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
              <button onClick={() => confirmAction(r.id, 'cancel')} className="text-red-600 hover:text-red-800 text-sm">{t('inventoryCounting.cancel')}</button>
            </>
          )}
          <button onClick={() => openView(r)} className="text-indigo-600 hover:text-indigo-800 text-sm">{t('common.view')}</button>
        </div>
      ),
    },
  ];

  const isReadOnly = editItem ? editItem.status !== 'DRAFT' : false;

  return (
    <div>
      <PageHeader title={t('inventoryCounting.adjustments')} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <F9Lookup label={t('inventoryCounting.company')} value={filters.companyId} onChange={(v) => setFilters({ ...filters, companyId: v })} adapter={companyAdapter} />
        <F9Lookup label={t('inventoryCounting.branch')} value={filters.branchId} onChange={(v) => setFilters({ ...filters, branchId: v })} adapter={branchAdapter} />
        <F9Lookup label={t('inventoryCounting.warehouse')} value={filters.warehouseId} onChange={(v) => setFilters({ ...filters, warehouseId: v })} adapter={warehouseAdapter} />
        <Select label={t('common.status')} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={statusOptions} />
      </div>
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('inventoryCounting.newAdjustment')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('inventoryCounting.noAdjustments')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(r: InventoryAdjustment) => r.id} onRowClick={(r: InventoryAdjustment) => setSelectedId(r.id)} selectedKey={selectedId} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editItem ? t('inventoryCounting.editAdjustment') : t('inventoryCounting.newAdjustment')} size="lg">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('inventoryCounting.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
            <F9Lookup label={t('inventoryCounting.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('inventoryCounting.warehouse')} value={form.warehouseId} onChange={(v) => setForm({ ...form, warehouseId: v })} adapter={warehouseAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
            <Input label={t('inventoryCounting.adjustmentDate')} type="date" value={form.adjustmentDate} onChange={(e) => setForm({ ...form, adjustmentDate: e.target.value })} required />
          </div>
          <Input label={t('inventoryCounting.reason')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <Textarea label={t('inventoryCounting.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{t('inventoryCounting.lines')}</h4>
              <Button variant="secondary" size="sm" onClick={() => setLineFormOpen(!lineFormOpen)}>{t('inventoryCounting.addLine')}</Button>
            </div>
            {lineFormOpen && (
              <div className="border rounded p-3 mb-3 space-y-3 bg-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  <F9Lookup label={t('inventoryCounting.product')} value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-sm">
                    <span className="block text-gray-500">{t('inventoryCounting.systemQty')}</span>
                    <span className="font-medium">{lineSystemQty}</span>
                  </div>
                  <Input label={t('inventoryCounting.countedQty')} type="number" value={String(lineForm.countedQty)} onChange={(e) => setLineForm({ ...lineForm, countedQty: Number(e.target.value) })} />
                  <div className="flex items-end">
                    <Button onClick={handleAddLine}>{t('actions.add')}</Button>
                  </div>
                </div>
                {lineForm.productId && (
                  <p className="text-xs text-gray-500">
                    {t('inventoryCounting.differenceQty')}: {lineForm.countedQty - lineSystemQty}
                  </p>
                )}
                <Textarea label={t('inventoryCounting.notes')} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
              </div>
            )}
            {lines.length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2">{t('inventoryCounting.product')}</th>
                    <th className="text-right p-2">{t('inventoryCounting.systemQty')}</th>
                    <th className="text-right p-2">{t('inventoryCounting.countedQty')}</th>
                    <th className="text-center p-2">{t('inventoryCounting.differenceQty')}</th>
                    <th className="text-left p-2">{t('inventoryCounting.notes')}</th>
                    <th className="text-center p-2">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line: any) => (
                    <tr key={line._id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{line.product?.name || line.productId}</td>
                      <td className="p-2 text-right">{line.systemQty}</td>
                      <td className="p-2 text-right">{line.countedQty}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          line.differenceQty === 0 ? 'bg-gray-100 text-gray-700' : line.differenceQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {line.differenceQty > 0 ? '+' : ''}{line.differenceQty}
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
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            {!isReadOnly && <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>}
          </div>
        </div>
      </Modal>

      <Modal open={viewDrawerOpen} onClose={() => setViewDrawerOpen(false)}
        title={t('inventoryCounting.viewLines')} size="lg">
        {viewingItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium text-gray-500">{t('inventoryCounting.adjustmentNumber')}:</span> {viewingItem.adjustmentNumber}</div>
              <div><span className="font-medium text-gray-500">{t('common.status')}:</span> <InventoryStatusBadge status={viewingItem.status} /></div>
              <div><span className="font-medium text-gray-500">{t('inventoryCounting.company')}:</span> {viewingItem.company?.name || '-'}</div>
              <div><span className="font-medium text-gray-500">{t('inventoryCounting.branch')}:</span> {viewingItem.branch?.name || '-'}</div>
              <div><span className="font-medium text-gray-500">{t('inventoryCounting.warehouse')}:</span> {viewingItem.warehouse?.name || '-'}</div>
              <div><span className="font-medium text-gray-500">{t('inventoryCounting.adjustmentDate')}:</span> {viewingItem.adjustmentDate ? new Date(viewingItem.adjustmentDate).toLocaleDateString() : '-'}</div>
              <div><span className="font-medium text-gray-500">{t('inventoryCounting.reason')}:</span> {viewingItem.reason || '-'}</div>
              {viewingItem.postedAt && <div><span className="font-medium text-gray-500">{t('inventoryCounting.postedAt')}:</span> {new Date(viewingItem.postedAt).toLocaleString()}</div>}
              <div className="col-span-2"><span className="font-medium text-gray-500">{t('inventoryCounting.notes')}:</span> {viewingItem.notes || '-'}</div>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-base font-semibold mb-3">{t('inventoryCounting.lines')}</h4>
              {(!viewingItem.lines || viewingItem.lines.length === 0) ? (
                <EmptyState message={t('inventoryCounting.noLines')} />
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('inventoryCounting.product')}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('inventoryCounting.systemQty')}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('inventoryCounting.countedQty')}</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('inventoryCounting.differenceQty')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('inventoryCounting.notes')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viewingItem.lines.map((line: InventoryAdjustmentLine) => (
                        <tr key={line.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{line.product ? `[${line.product.code}] ${line.product.name}` : line.productId}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">{line.systemQty}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">{line.countedQty}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              line.differenceQty === 0 ? 'bg-gray-100 text-gray-700' : line.differenceQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {line.differenceQty > 0 ? '+' : ''}{line.differenceQty}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{line.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title={t('common.confirm')}
        message={pendingAction === 'post' ? t('inventoryCounting.confirmPostAdjustment') : t('inventoryCounting.confirmCancelAdjustment')}
        variant={pendingAction === 'cancel' ? 'danger' : 'primary'} loading={saving} />
    </div>
  );
}
