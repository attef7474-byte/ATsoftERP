'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useOperationalContext } from '../../../../lib/auth-context';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Textarea, Card, Pagination, PageHeader, LoadingState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { InventoryStatusBadge } from '../../../../components/inventory-counting/InventoryStatusBadge';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter, productAdapter, warehouseLocationAdapter } from '../../../../components/f9';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionPostIcon, ActionCancelIcon } from '../../../../components/admin/admin-action-bar';

interface ReceiptLine {
  _id?: string;
  id?: string;
  productId: string;
  product?: { id: string; name: string; code: string };
  quantity: number;
  notes?: string;
}

interface OperationalReceipt {
  id: string;
  code: string;
  companyId: string;
  company?: { id: string; name: string };
  branchId?: string;
  branch?: { id: string; name: string };
  warehouseId: string;
  warehouse?: { id: string; name: string; code: string };
  locationId?: string;
  location?: { id: string; name: string; code: string };
  status: string;
  documentDate: string;
  reason: string;
  notes?: string;
  supplierName?: string;
  supplierDoc?: string;
  lines?: ReceiptLine[];
  createdAt: string;
  postedAt?: string;
  [key: string]: any;
}

export default function OperationalReceiptsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { activeContext } = useOperationalContext();
  const [data, setData] = useState<OperationalReceipt[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ companyId: '', branchId: '', warehouseId: '', status: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<OperationalReceipt | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', warehouseId: '', locationId: '', reason: '', notes: '', supplierName: '', supplierDoc: '' });
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [lineForm, setLineForm] = useState({ productId: '', quantity: 1, notes: '' });
  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get<{ data: OperationalReceipt[]; meta: any }>('/inventory/operational-receipts', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || 'Load failed'); }
    finally { setLoading(false); }
  }, [search, filters]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({
      companyId: activeContext?.companyId || '',
      branchId: activeContext?.branchId || '',
      warehouseId: '',
      locationId: '',
      reason: '',
      notes: '',
      supplierName: '',
      supplierDoc: '',
    });
    setLines([]);
    setModalOpen(true);
  };

  const openEdit = (item: OperationalReceipt) => {
    setEditItem(item);
    setForm({
      companyId: item.companyId, branchId: item.branchId || '',
      warehouseId: item.warehouseId, locationId: item.locationId || '',
      reason: item.reason, notes: item.notes || '',
      supplierName: item.supplierName || '', supplierDoc: item.supplierDoc || '',
    });
    setLines((item.lines || []).map((l: any) => ({ ...l, _id: l.id || Date.now().toString() })));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.companyId || !form.warehouseId || !form.reason) { showToast('Required fields missing', 'error'); return; }
    if (lines.length === 0) { showToast('Add at least one line', 'error'); return; }
    setSaving(true);
    try {
      const payload: any = {
        companyId: form.companyId, branchId: form.branchId || undefined,
        warehouseId: form.warehouseId, locationId: form.locationId || undefined,
        reason: form.reason, notes: form.notes || undefined,
        supplierName: form.supplierName || undefined, supplierDoc: form.supplierDoc || undefined,
        lines: lines.map((l) => ({
          productId: l.productId, quantity: l.quantity, notes: l.notes || undefined,
        })),
      };
      if (editItem) {
        await api.patch(`/inventory/operational-receipts/${editItem.id}`, payload);
        showToast('Updated successfully', 'success');
      } else {
        await api.post('/inventory/operational-receipts', payload);
        showToast('Created successfully', 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleAddLine = () => {
    if (!lineForm.productId || lineForm.quantity <= 0) return;
    setLines([...lines, { ...lineForm, _id: Date.now().toString() }]);
    setLineForm({ productId: '', quantity: 1, notes: '' });
    setLineFormOpen(false);
  };

  const handleRemoveLine = (id: string) => setLines(lines.filter((l) => l._id !== id));

  const confirmAction = (id: string, action: string) => { setSelectedId(id); setPendingAction(action); setActionConfirmOpen(true); };

  const handleAction = async () => {
    setSaving(true);
    try {
      await api.post(`/inventory/operational-receipts/${selectedId}/${pendingAction}`);
      showToast('Action completed', 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || 'Action failed', 'error'); }
    finally { setSaving(false); }
  };

  const canAction = (status: string, action: string) => {
    if (action === 'submit') return status === 'DRAFT';
    if (action === 'approve' || action === 'reject') return status === 'SUBMITTED';
    if (action === 'post') return status === 'APPROVED';
    if (action === 'cancel') return status === 'DRAFT' || status === 'SUBMITTED';
    if (action === 'delete') return status === 'DRAFT';
    if (action === 'edit') return status === 'DRAFT';
    return false;
  };

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    submit: () => selectedRecord && selectedRecord.status === 'DRAFT' && confirmAction(selectedRecord.id, 'submit'),
    approve: () => selectedRecord && selectedRecord.status === 'SUBMITTED' && confirmAction(selectedRecord.id, 'approve'),
    reject: () => selectedRecord && selectedRecord.status === 'SUBMITTED' && confirmAction(selectedRecord.id, 'reject'),
    post: () => selectedRecord && selectedRecord.status === 'APPROVED' && confirmAction(selectedRecord.id, 'post'),
    cancel: () => selectedRecord && (selectedRecord.status === 'DRAFT' || selectedRecord.status === 'SUBMITTED') && confirmAction(selectedRecord.id, 'cancel'),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedRecord && selectedRecord.status === 'DRAFT' },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'submit', labelKey: 'inventoryCounting.adjSubmit', icon: <ActionPostIcon />, onClick: () => exec('submit'), enabled: !!selectedRecord && selectedRecord.status === 'DRAFT' },
    { id: 'post', labelKey: 'inventoryCounting.adjPost', icon: <ActionPostIcon />, onClick: () => exec('post'), enabled: !!selectedRecord && selectedRecord.status === 'APPROVED' },
    { id: 'cancel', labelKey: 'inventoryCounting.adjCancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!selectedRecord && (selectedRecord.status === 'DRAFT' || selectedRecord.status === 'SUBMITTED'), variant: 'danger' },
  ]);

  const columns: GridColumn<OperationalReceipt>[] = [
    { key: 'code', header: t('inventory.operationalReceiptCode'), sortable: true },
    { key: 'warehouse', header: t('inventory.warehouse'), render: (r: OperationalReceipt) => r.warehouse?.name || '-' },
    { key: 'status', header: t('common.status'), render: (r: OperationalReceipt) => <InventoryStatusBadge status={r.status} /> },
    { key: 'documentDate', header: t('common.date'), sortable: true, render: (r: OperationalReceipt) => r.documentDate ? new Date(r.documentDate).toLocaleDateString() : '-' },
    { key: 'reason', header: t('inventoryCounting.reason'), render: (r: OperationalReceipt) => r.reason?.substring(0, 50) || '-' },
    { key: 'supplierName', header: t('inventory.supplierName'), render: (r: OperationalReceipt) => r.supplierName || '-' },
    { key: 'lineCount', header: t('inventoryCounting.lines'), align: 'center', render: (r: any) => r._count?.lines ?? '-' },
    { key: 'createdAt', header: t('common.createdAt'), render: (r: OperationalReceipt) => new Date(r.createdAt).toLocaleDateString() },
  ];

  const gridActions: GridAction<OperationalReceipt>[] = [
    { label: t('common.edit'), onClick: (r) => openEdit(r), enabled: (r) => canAction(r.status, 'edit') },
    { label: t('actions.submit'), onClick: (r) => confirmAction(r.id, 'submit'), enabled: (r) => canAction(r.status, 'submit') },
    { label: t('status.APPROVED'), onClick: (r) => confirmAction(r.id, 'approve'), enabled: (r) => canAction(r.status, 'approve') },
    { label: t('status.REJECTED'), onClick: (r) => confirmAction(r.id, 'reject'), enabled: (r) => canAction(r.status, 'reject') },
    { label: t('common.post'), onClick: (r) => confirmAction(r.id, 'post'), enabled: (r) => canAction(r.status, 'post') },
    { label: t('common.cancel'), onClick: (r) => confirmAction(r.id, 'cancel'), enabled: (r) => canAction(r.status, 'cancel'), variant: 'danger' },
  ];

  const actionLabels: Record<string, string> = {
    submit: t('inventory.confirmReceiptSubmit'),
    approve: t('inventory.confirmReceiptApprove'),
    reject: t('inventory.confirmReceiptReject'),
    post: t('inventory.confirmReceiptPost'),
    cancel: t('inventory.confirmReceiptCancel'),
    delete: t('inventory.confirmReceiptDelete'),
  };

  return (
    <div>
      <PageHeader title={t('inventory.operationalReceipts')} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <F9Lookup label={t('inventoryCounting.company')} value={filters.companyId} onChange={(v) => setFilters({ ...filters, companyId: v })} adapter={companyAdapter} />
        <F9Lookup label={t('inventoryCounting.branch')} value={filters.branchId} onChange={(v) => setFilters({ ...filters, branchId: v })} adapter={branchAdapter} />
        <F9Lookup label={t('inventory.warehouse')} value={filters.warehouseId} onChange={(v) => setFilters({ ...filters, warehouseId: v })} adapter={warehouseAdapter} />
        <Select label={t('common.status')} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={[
          { value: '', label: t('common.all') }, { value: 'DRAFT', label: t('status.DRAFT') }, { value: 'SUBMITTED', label: t('status.SUBMITTED') },
          { value: 'APPROVED', label: t('status.APPROVED') }, { value: 'POSTED', label: t('status.POSTED') }, { value: 'REJECTED', label: t('status.REJECTED') },
          { value: 'CANCELLED', label: t('status.CANCELLED') },
        ]} />
      </div>
      {!error && loading && data.length === 0 && <LoadingState />}
      {!error && !loading && data.length === 0 && <div className="text-center py-12"><p className="text-gray-500">{t('inventory.noOperationalReceipts')}</p></div>}
      {data.length > 0 && (
        <>
          <AdminDataGrid columns={columns} data={data} keyExtractor={(r) => r.id}
            onRowClick={(r) => setSelectedId(r.id)} selectedKey={selectedId} loading={loading}
            emptyMessage={t('inventory.noOperationalReceipts')} error={error || undefined} actions={gridActions}
            globalSearch={search} onGlobalSearch={setSearch} searchPlaceholder={t('common.search')}
            onRefresh={() => fetchData(meta.page)} refreshLoading={loading} />
          <div className="mt-3">
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={openCreate}>{t('inventory.newOperationalReceipt')}</Button>
            <Button variant="secondary" onClick={() => fetchData(meta.page)}>{t('common.refresh')}</Button>
          </div>
        </>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventory.editOperationalReceipt') : t('inventory.newOperationalReceipt')} size="lg">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('inventoryCounting.company')} value={activeContext?.companyName || ''} disabled />
            <Input label={t('inventoryCounting.branch')} value={activeContext?.branchName || ''} disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('inventory.warehouse')} value={form.warehouseId} onChange={(v) => setForm({ ...form, warehouseId: v, locationId: '' })} adapter={warehouseAdapter} />
            <F9Lookup label={t('inventory.locations.name')} value={form.locationId} onChange={(v) => setForm({ ...form, locationId: v })} adapter={warehouseLocationAdapter} filters={{ warehouseId: form.warehouseId }} disabled={!form.warehouseId} />
          </div>
          <Textarea label={t('inventoryCounting.reason')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          <Textarea label={t('inventoryCounting.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('inventory.supplierName')} value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
            <Input label={t('inventory.supplierDoc')} value={form.supplierDoc} onChange={(e) => setForm({ ...form, supplierDoc: e.target.value })} />
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{t('inventory.receiptLines')}</h4>
              <Button variant="secondary" size="sm" onClick={() => setLineFormOpen(!lineFormOpen)}>{t('inventoryCounting.addLine')}</Button>
            </div>
            {lineFormOpen && (
              <div className="border rounded p-3 mb-3 space-y-3 bg-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  <F9Lookup label={t('inventoryCounting.product')} value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
                </div>
                <Input label={t('inventoryCounting.quantity')} type="number" value={String(lineForm.quantity)} onChange={(e) => setLineForm({ ...lineForm, quantity: Number(e.target.value) })} />
                <Textarea label={t('inventoryCounting.notes')} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
                <Button onClick={handleAddLine}>{t('common.add')}</Button>
              </div>
            )}
            {lines.length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2">{t('inventoryCounting.product')}</th>
                    <th className="text-right p-2">{t('inventoryCounting.quantity')}</th>
                    <th className="text-left p-2">{t('inventoryCounting.notes')}</th>
                    <th className="text-center p-2">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line._id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{line.product?.name || line.productId}</td>
                      <td className="p-2 text-right font-medium">{line.quantity}</td>
                      <td className="p-2">{line.notes || '-'}</td>
                      <td className="p-2 text-center">
                        <button onClick={() => handleRemoveLine(line._id!)} className="text-red-600 hover:text-red-800 text-sm">{t('actions.remove')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title={t('common.confirm')} message={actionLabels[pendingAction] || t('common.confirm')}
        variant={pendingAction === 'cancel' || pendingAction === 'reject' ? 'danger' : 'primary'} loading={saving} />
    </div>
  );
}
