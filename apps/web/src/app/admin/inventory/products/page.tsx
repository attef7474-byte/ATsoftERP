'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Product } from '../../../../lib/admin-types';
import { Button, Input, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, productCategoryAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function ProductsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', categoryId: '', unit: '', barcode: '', minStock: '0', maxStock: '0' });
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
      const res = await api.get<{ data: Product[]; meta: any }>('/products', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditItem(null); setForm({ code: '', name: '', description: '', categoryId: '', unit: 'pcs', barcode: '', minStock: '0', maxStock: '0' }); setModalOpen(true); };
  const openEdit = (item: Product) => {
    setEditItem(item);
    setForm({
      code: item.code, name: item.name, description: item.description || '',
      categoryId: item.categoryId || '', unit: item.unit, barcode: item.barcode || '',
      minStock: String(item.minStock ?? 0), maxStock: String(item.maxStock ?? 0),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.unit) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = {
        code: form.code, name: form.name, unit: form.unit,
        description: form.description || undefined, barcode: form.barcode || undefined,
        categoryId: form.categoryId || undefined,
        minStock: Number(form.minStock) || 0, maxStock: Number(form.maxStock) || 0,
      };
      if (editItem) {
        await api.patch(`/products/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/products', payload);
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
      const item = data.find((p) => p.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/products/${selectedId}`, { status });
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
    { key: 'category', header: t('inventory.productCategory'), render: (p: Product) => p.category?.name || '-' },
    { key: 'unit', header: t('inventory.unit') },
    { key: 'barcode', header: t('inventory.barcode'), render: (p: Product) => p.barcode || '-' },
    { key: 'minStock', header: t('inventory.minStock'), render: (p: Product) => p.minStock },
    { key: 'maxStock', header: t('inventory.maxStock'), render: (p: Product) => p.maxStock },
    { key: 'status', header: t('common.status'), render: (p: Product) => <StatusBadge status={p.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (p: Product) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
          <button onClick={() => confirmStatus(p.id)}
            className={`text-sm ${p.status === 'ACTIVE' ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
            {p.status === 'ACTIVE' ? t('actions.deactivate') : t('actions.activate')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('inventory.products')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('inventory.newProduct')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(p: Product) => p.id} selectedKey={selectedId} onRowClick={(item: Product) => setSelectedId(item.id)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventory.editProduct') : t('inventory.newProduct')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <Input label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('inventory.productCategory')} value={form.categoryId} onChange={(v) => setForm({ ...form, categoryId: v })} adapter={productCategoryAdapter} />
            <Input label={t('inventory.unit')} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
          </div>
          <Input label={t('inventory.barcode')} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('inventory.minStock')} type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
            <Input label={t('inventory.maxStock')} type="number" value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} />
          </div>
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
