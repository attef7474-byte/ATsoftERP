'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { OpeningBalance } from '../../../../lib/admin-types';
import { Button, Input, Select, Textarea, Card, Pagination, PageHeader, LoadingState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { InventoryStatusBadge } from '../../../../components/inventory-counting/InventoryStatusBadge';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter, productAdapter } from '../../../../components/f9';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionPostIcon, ActionCancelIcon } from '../../../../components/admin/admin-action-bar';

export default function OpeningBalancesPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<OpeningBalance[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [filters, setFilters] = useState({ companyId: '', branchId: '', warehouseId: '', status: '' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<OpeningBalance | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', warehouseId: '', reason: '', notes: '' });
  const [lines, setLines] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [lineForm, setLineForm] = useState({ productId: '', quantity: 1, notes: '' });

  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const statusFilterOptions = [
    { value: '', label: t('common.all') },
    { value: 'DRAFT', label: t('status.DRAFT') },
    { value: 'SUBMITTED', label: t('status.SUBMITTED') },
    { value: 'APPROVED', label: t('status.APPROVED') },
    { value: 'REJECTED', label: t('status.REJECTED') },
    { value: 'POSTED', label: t('status.POSTED') },
    { value: 'CANCELLED', label: t('status.CANCELLED') },
  ];

  const submitEnabled = !!(selectedId && selectedRecord?.status === 'DRAFT');
  const approveEnabled = !!(selectedId && selectedRecord?.status === 'SUBMITTED');
  const rejectEnabled = !!(selectedId && selectedRecord?.status === 'SUBMITTED');
  const postEnabled = !!(selectedId && selectedRecord?.status === 'APPROVED');
  const cancelEnabled = !!(selectedId && (selectedRecord?.status === 'DRAFT' || selectedRecord?.status === 'SUBMITTED'));
  const editEnabled = !!(selectedId && selectedRecord?.status === 'DRAFT');
  const deleteEnabled = !!(selectedId && selectedRecord?.status === 'DRAFT');

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    submit: () => confirmAction(selectedId, 'submit'),
    approve: () => confirmAction(selectedId, 'approve'),
    reject: () => confirmAction(selectedId, 'reject'),
    post: () => confirmAction(selectedId, 'post'),
    cancel: () => confirmAction(selectedId, 'cancel'),
    delete: () => confirmAction(selectedId, 'delete'),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: editEnabled },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'submit', labelKey: 'inventoryCounting.submit', icon: <ActionPostIcon />, onClick: () => exec('submit'), enabled: submitEnabled },
    { id: 'approve', labelKey: 'inventoryCounting.approve', icon: <ActionPostIcon />, onClick: () => exec('approve'), enabled: approveEnabled },
    { id: 'reject', labelKey: 'inventoryCounting.reject', icon: <ActionCancelIcon />, onClick: () => exec('reject'), enabled: rejectEnabled, variant: 'danger' },
    { id: 'post', labelKey: 'inventoryCounting.post', icon: <ActionPostIcon />, onClick: () => exec('post'), enabled: postEnabled },
    { id: 'cancel', labelKey: 'inventoryCounting.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: cancelEnabled, variant: 'danger' },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionCancelIcon />, onClick: () => exec('delete'), enabled: deleteEnabled, variant: 'danger' },
  ]);

  const [pendingAction, setPendingAction] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get<{ data: OpeningBalance[]; meta: any }>('/inventory/opening-balances', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, filters, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ companyId: '', branchId: '', warehouseId: '', reason: '', notes: '' });
    setLines([]);
    setModalOpen(true);
  };
  const openEdit = (item: OpeningBalance) => {
    setEditItem(item);
    setForm({
      companyId: item.companyId, branchId: item.branchId, warehouseId: item.warehouseId,
      reason: item.reason || '', notes: item.notes || '',
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
        reason: form.reason || undefined, notes: form.notes || undefined,
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, notes: l.notes || undefined })),
      };
      if (editItem) {
        await api.patch(`/inventory/opening-balances/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/inventory/opening-balances', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const handleAddLine = () => {
    if (!lineForm.productId || !lineForm.quantity) return;
    setLines([...lines, { ...lineForm, _id: Date.now().toString() }]);
    setLineForm({ productId: '', quantity: 1, notes: '' });
    setLineFormOpen(false);
  };
  const handleRemoveLine = (id: string) => setLines(lines.filter((l) => l._id !== id));

  const confirmAction = (id: string, action: string) => { setSelectedId(id); setPendingAction(action); setActionConfirmOpen(true); };
  const handleAction = async () => {
    setSaving(true);
    try {
      if (pendingAction === 'delete') {
        await api.delete(`/inventory/opening-balances/${selectedId}`);
      } else {
        await api.post(`/inventory/opening-balances/${selectedId}/${pendingAction}`);
      }
      showToast(t('common.successUpdated'), 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      submit: t('inventoryCounting.confirmSubmit'),
      approve: t('inventoryCounting.confirmApprove'),
      reject: t('inventoryCounting.confirmReject'),
      post: t('inventoryCounting.confirmPost'),
      cancel: t('inventoryCounting.confirmCancel'),
      delete: t('common.confirmDelete'),
    };
    return labels[action] || t('common.confirm');
  };

  const columns: GridColumn<OpeningBalance>[] = [
    { key: 'code', header: t('inventoryCounting.documentCode'), sortable: true, filterable: true },
    { key: 'company', header: t('inventoryCounting.company'), render: (r: OpeningBalance) => r.company?.name || '-' },
    { key: 'branch', header: t('inventoryCounting.branch'), render: (r: OpeningBalance) => r.branch?.name || '-' },
    { key: 'warehouse', header: t('inventoryCounting.warehouse'), render: (r: OpeningBalance) => r.warehouse?.name || '-' },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: statusFilterOptions, render: (r: OpeningBalance) => <InventoryStatusBadge status={r.status} /> },
    { key: 'documentDate', header: t('inventoryCounting.documentDate'), sortable: true, render: (r: OpeningBalance) => r.documentDate ? new Date(r.documentDate).toLocaleDateString() : '-' },
    { key: 'reason', header: t('inventoryCounting.reason'), sortable: true, render: (r: OpeningBalance) => r.reason || '-' },
    { key: 'lineCount', header: t('inventoryCounting.lineCount'), align: 'center', render: (r: any) => r._count?.lines ?? r.lineCount ?? '-' },
  ];

  const gridActions: GridAction<OpeningBalance>[] = [
    { label: t('details.viewDetails'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (r: OpeningBalance) => router.push(`/admin/inventory/opening-balances/${r.id}`) },
    { label: t('actions.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (r: OpeningBalance) => openEdit(r), enabled: (r: OpeningBalance) => r.status === 'DRAFT' },
    { label: t('inventoryCounting.submit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>, onClick: (r: OpeningBalance) => confirmAction(r.id, 'submit'), enabled: (r: OpeningBalance) => r.status === 'DRAFT' },
    { label: t('inventoryCounting.approve'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>, onClick: (r: OpeningBalance) => confirmAction(r.id, 'approve'), enabled: (r: OpeningBalance) => r.status === 'SUBMITTED' },
    { label: t('inventoryCounting.reject'), variant: 'danger', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>, onClick: (r: OpeningBalance) => confirmAction(r.id, 'reject'), enabled: (r: OpeningBalance) => r.status === 'SUBMITTED' },
    { label: t('inventoryCounting.post'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>, onClick: (r: OpeningBalance) => confirmAction(r.id, 'post'), enabled: (r: OpeningBalance) => r.status === 'APPROVED' },
    { label: t('inventoryCounting.cancel'), variant: 'danger', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>, onClick: (r: OpeningBalance) => confirmAction(r.id, 'cancel'), enabled: (r: OpeningBalance) => r.status === 'DRAFT' || r.status === 'SUBMITTED' },
    { label: t('common.delete'), variant: 'danger', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, onClick: (r: OpeningBalance) => confirmAction(r.id, 'delete'), enabled: (r: OpeningBalance) => r.status === 'DRAFT' },
  ];

  return (
    <div>
      <PageHeader title={t('inventory.openingBalances')} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <F9Lookup label={t('inventoryCounting.company')} value={filters.companyId} onChange={(v) => setFilters({ ...filters, companyId: v })} adapter={companyAdapter} />
        <F9Lookup label={t('inventoryCounting.branch')} value={filters.branchId} onChange={(v) => setFilters({ ...filters, branchId: v })} adapter={branchAdapter} />
        <F9Lookup label={t('inventoryCounting.warehouse')} value={filters.warehouseId} onChange={(v) => setFilters({ ...filters, warehouseId: v })} adapter={warehouseAdapter} />
        <Select label={t('common.status')} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={statusFilterOptions} />
      </div>
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
        </div>
      )}
      {!error && loading && data.length === 0 && <LoadingState />}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('inventory.openingBalancesEmpty')}</p>
        </div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <AdminDataGrid
          columns={columns}
          data={data}
          keyExtractor={(r: OpeningBalance) => r.id}
          onRowClick={(r: OpeningBalance) => setSelectedId(r.id)}
          selectedKey={selectedId}
          loading={loading}
          emptyMessage={t('inventory.openingBalancesEmpty')}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventory.editOpeningBalance') : t('inventory.newOpeningBalance')} size="lg">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            <F9Lookup label={t('inventoryCounting.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
            <F9Lookup label={t('inventoryCounting.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} />
            <F9Lookup label={t('inventoryCounting.warehouse')} value={form.warehouseId} onChange={(v) => setForm({ ...form, warehouseId: v })} adapter={warehouseAdapter} />
          </div>
          <Textarea label={t('inventoryCounting.reason')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <Textarea label={t('inventoryCounting.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{t('inventoryCounting.lines')}</h4>
              <Button variant="secondary" size="sm" onClick={() => setLineFormOpen(!lineFormOpen)}>{t('inventoryCounting.addLine')}</Button>
            </div>
            {lineFormOpen && (
              <div className="border rounded p-3 mb-3 space-y-3 bg-gray-50">
                <F9Lookup label={t('inventoryCounting.product')} value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
                <div className="grid grid-cols-3 gap-3">
                  <Input label={t('inventoryCounting.quantity')} type="number" value={String(lineForm.quantity)} onChange={(e) => setLineForm({ ...lineForm, quantity: Number(e.target.value) })} />
                  <div className="flex items-end"><Button onClick={handleAddLine}>{t('actions.add')}</Button></div>
                </div>
                <Textarea label={t('inventoryCounting.notes')} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
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
                      <td className="p-2 text-right">{line.quantity}</td>
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
        message={getActionLabel(pendingAction)}
        variant={pendingAction === 'reject' || pendingAction === 'cancel' || pendingAction === 'delete' ? 'danger' : 'primary'} loading={saving} />
    </div>
  );
}
