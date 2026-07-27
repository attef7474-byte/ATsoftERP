'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Textarea, Card, Pagination, PageHeader, LoadingState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { InventoryStatusBadge } from '../../../../components/inventory-counting/InventoryStatusBadge';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter, productAdapter, warehouseLocationAdapter } from '../../../../components/f9';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionPostIcon, ActionCancelIcon } from '../../../../components/admin/admin-action-bar';

interface TransferLine {
  _id?: string;
  id?: string;
  productId: string;
  product?: { id: string; name: string; code: string };
  quantity: number;
  notes?: string;
  transferOutMovementId?: string;
  transferInMovementId?: string;
}

interface StockTransfer {
  id: string;
  code: string;
  companyId: string;
  company?: { id: string; name: string };
  branchId?: string;
  branch?: { id: string; name: string };
  sourceWarehouseId: string;
  sourceWarehouse?: { id: string; name: string; code: string };
  sourceLocationId?: string;
  sourceLocation?: { id: string; name: string; code: string };
  destinationWarehouseId: string;
  destinationWarehouse?: { id: string; name: string; code: string };
  destinationLocationId?: string;
  destinationLocation?: { id: string; name: string; code: string };
  status: string;
  documentDate: string;
  reason: string;
  notes?: string;
  lines?: TransferLine[];
  createdAt: string;
  postedAt?: string;
  [key: string]: any;
}

export default function StockTransfersPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<StockTransfer[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ companyId: '', branchId: '', sourceWarehouseId: '', destinationWarehouseId: '', status: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<StockTransfer | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', sourceWarehouseId: '', sourceLocationId: '', destinationWarehouseId: '', destinationLocationId: '', reason: '', notes: '' });
  const [lines, setLines] = useState<TransferLine[]>([]);
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
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = k === 'sourceWarehouseId' || k === 'destinationWarehouseId' ? v : v; });
      const res = await api.get<{ data: StockTransfer[]; meta: any }>('/inventory/stock-transfers', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || 'Load failed'); }
    finally { setLoading(false); }
  }, [search, filters]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ companyId: '', branchId: '', sourceWarehouseId: '', sourceLocationId: '', destinationWarehouseId: '', destinationLocationId: '', reason: '', notes: '' });
    setLines([]);
    setModalOpen(true);
  };

  const openEdit = (item: StockTransfer) => {
    setEditItem(item);
    setForm({
      companyId: item.companyId, branchId: item.branchId || '',
      sourceWarehouseId: item.sourceWarehouseId, sourceLocationId: item.sourceLocationId || '',
      destinationWarehouseId: item.destinationWarehouseId, destinationLocationId: item.destinationLocationId || '',
      reason: item.reason, notes: item.notes || '',
    });
    setLines((item.lines || []).map((l: any) => ({ ...l, _id: l.id || Date.now().toString() })));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.companyId || !form.sourceWarehouseId || !form.destinationWarehouseId || !form.reason) { showToast('Required fields missing', 'error'); return; }
    if (form.sourceWarehouseId === form.destinationWarehouseId) { showToast('Source and destination must be different', 'error'); return; }
    if (lines.length === 0) { showToast('Add at least one line', 'error'); return; }
    setSaving(true);
    try {
      const payload: any = {
        companyId: form.companyId, branchId: form.branchId || undefined,
        sourceWarehouseId: form.sourceWarehouseId, sourceLocationId: form.sourceLocationId || undefined,
        destinationWarehouseId: form.destinationWarehouseId, destinationLocationId: form.destinationLocationId || undefined,
        reason: form.reason, notes: form.notes || undefined,
        lines: lines.map((l) => ({
          productId: l.productId, quantity: l.quantity, notes: l.notes || undefined,
        })),
      };
      if (editItem) {
        await api.patch(`/inventory/stock-transfers/${editItem.id}`, payload);
        showToast('Updated successfully', 'success');
      } else {
        await api.post('/inventory/stock-transfers', payload);
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
      await api.post(`/inventory/stock-transfers/${selectedId}/${pendingAction}`);
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

  const columns: GridColumn<StockTransfer>[] = [
    { key: 'code', header: 'Doc #', sortable: true },
    { key: 'sourceWarehouse', header: 'From', render: (r: StockTransfer) => r.sourceWarehouse?.name || '-' },
    { key: 'destinationWarehouse', header: 'To', render: (r: StockTransfer) => r.destinationWarehouse?.name || '-' },
    { key: 'status', header: 'Status', render: (r: StockTransfer) => <InventoryStatusBadge status={r.status} /> },
    { key: 'documentDate', header: 'Date', sortable: true, render: (r: StockTransfer) => r.documentDate ? new Date(r.documentDate).toLocaleDateString() : '-' },
    { key: 'reason', header: 'Reason', render: (r: StockTransfer) => r.reason?.substring(0, 50) || '-' },
    { key: 'lineCount', header: 'Lines', align: 'center', render: (r: any) => r._count?.lines ?? '-' },
    { key: 'createdAt', header: 'Created', render: (r: StockTransfer) => new Date(r.createdAt).toLocaleDateString() },
  ];

  const gridActions: GridAction<StockTransfer>[] = [
    { label: 'Edit', onClick: (r) => openEdit(r), enabled: (r) => canAction(r.status, 'edit') },
    { label: 'Submit', onClick: (r) => confirmAction(r.id, 'submit'), enabled: (r) => canAction(r.status, 'submit') },
    { label: 'Approve', onClick: (r) => confirmAction(r.id, 'approve'), enabled: (r) => canAction(r.status, 'approve') },
    { label: 'Reject', onClick: (r) => confirmAction(r.id, 'reject'), enabled: (r) => canAction(r.status, 'reject') },
    { label: 'Post', onClick: (r) => confirmAction(r.id, 'post'), enabled: (r) => canAction(r.status, 'post') },
    { label: 'Cancel', onClick: (r) => confirmAction(r.id, 'cancel'), enabled: (r) => canAction(r.status, 'cancel'), variant: 'danger' },
  ];

  const actionLabels: Record<string, string> = {
    submit: 'Submit this stock transfer?',
    approve: 'Approve this stock transfer?',
    reject: 'Reject this stock transfer?',
    post: 'Post this stock transfer? This will deduct from source, add to destination.',
    cancel: 'Cancel this stock transfer?',
    delete: 'Delete this stock transfer (DRAFT only)?',
  };

  return (
    <div>
      <PageHeader title="Stock Transfers" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <F9Lookup label="Company" value={filters.companyId} onChange={(v) => setFilters({ ...filters, companyId: v })} adapter={companyAdapter} />
        <F9Lookup label="Branch" value={filters.branchId} onChange={(v) => setFilters({ ...filters, branchId: v })} adapter={branchAdapter} />
        <F9Lookup label="From Warehouse" value={filters.sourceWarehouseId} onChange={(v) => setFilters({ ...filters, sourceWarehouseId: v })} adapter={warehouseAdapter} />
        <F9Lookup label="To Warehouse" value={filters.destinationWarehouseId} onChange={(v) => setFilters({ ...filters, destinationWarehouseId: v })} adapter={warehouseAdapter} />
        <Select label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={[
          { value: '', label: 'All' }, { value: 'DRAFT', label: 'Draft' }, { value: 'SUBMITTED', label: 'Submitted' },
          { value: 'APPROVED', label: 'Approved' }, { value: 'POSTED', label: 'Posted' }, { value: 'REJECTED', label: 'Rejected' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ]} />
      </div>
      {!error && loading && data.length === 0 && <LoadingState />}
      {!error && !loading && data.length === 0 && <div className="text-center py-12"><p className="text-gray-500">No stock transfers found</p></div>}
      {data.length > 0 && (
        <>
          <AdminDataGrid columns={columns} data={data} keyExtractor={(r) => r.id}
            onRowClick={(r) => setSelectedId(r.id)} selectedKey={selectedId} loading={loading}
            emptyMessage="No stock transfers" error={error || undefined} actions={gridActions}
            globalSearch={search} onGlobalSearch={setSearch} searchPlaceholder="Search..."
            onRefresh={() => fetchData(meta.page)} refreshLoading={loading} />
          <div className="mt-3">
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={openCreate}>New Transfer</Button>
            <Button variant="secondary" onClick={() => fetchData(meta.page)}>Refresh</Button>
          </div>
        </>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Stock Transfer' : 'New Stock Transfer'} size="lg">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            <F9Lookup label="Company" value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
            <F9Lookup label="Branch" value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label="Source Warehouse" value={form.sourceWarehouseId} onChange={(v) => setForm({ ...form, sourceWarehouseId: v })} adapter={warehouseAdapter} />
            <F9Lookup label="Source Location" value={form.sourceLocationId} onChange={(v) => setForm({ ...form, sourceLocationId: v })} adapter={warehouseLocationAdapter} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label="Destination Warehouse" value={form.destinationWarehouseId} onChange={(v) => setForm({ ...form, destinationWarehouseId: v })} adapter={warehouseAdapter} />
            <F9Lookup label="Destination Location" value={form.destinationLocationId} onChange={(v) => setForm({ ...form, destinationLocationId: v })} adapter={warehouseLocationAdapter} />
          </div>
          <Textarea label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">Transfer Lines</h4>
              <Button variant="secondary" size="sm" onClick={() => setLineFormOpen(!lineFormOpen)}>Add Line</Button>
            </div>
            {lineFormOpen && (
              <div className="border rounded p-3 mb-3 space-y-3 bg-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  <F9Lookup label="Product" value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
                </div>
                <Input label="Quantity" type="number" value={String(lineForm.quantity)} onChange={(e) => setLineForm({ ...lineForm, quantity: Number(e.target.value) })} />
                <Textarea label="Notes" value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
                <Button onClick={handleAddLine}>Add</Button>
              </div>
            )}
            {lines.length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Quantity</th>
                    <th className="text-left p-2">Notes</th>
                    <th className="text-center p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line._id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{line.product?.name || line.productId}</td>
                      <td className="p-2 text-right font-medium">{line.quantity}</td>
                      <td className="p-2">{line.notes || '-'}</td>
                      <td className="p-2 text-center">
                        <button onClick={() => handleRemoveLine(line._id!)} className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title="Confirm" message={actionLabels[pendingAction] || 'Confirm action?'}
        variant={pendingAction === 'cancel' || pendingAction === 'reject' ? 'danger' : 'primary'} loading={saving} />
    </div>
  );
}
