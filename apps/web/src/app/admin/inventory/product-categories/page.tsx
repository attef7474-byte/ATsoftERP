'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { ProductCategory } from '../../../../lib/admin-types';
import { Button, Input, Select, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';

export default function ProductCategoriesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<ProductCategory[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [parents, setParents] = useState<ProductCategory[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductCategory | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', parentId: '' });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: ProductCategory[]; meta: any }>('/product-categories', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [search, t]);

  const fetchParents = async () => {
    try {
      const res = await api.get<{ data: ProductCategory[] }>('/product-categories', { params: { limit: 50 } });
      setParents(res.data || []);
    } catch {}
  };

  useEffect(() => { fetchData(); fetchParents(); }, []);

  const openCreate = () => { setEditItem(null); setForm({ code: '', name: '', description: '', parentId: '' }); setModalOpen(true); };
  const openEdit = (item: ProductCategory) => {
    setEditItem(item);
    setForm({ code: item.code, name: item.name, description: item.description || '', parentId: item.parentId || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { code: form.code, name: form.name, description: form.description || undefined };
      if (form.parentId) payload.parentId = form.parentId;
      if (editItem) {
        await api.patch(`/product-categories/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/product-categories', payload);
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
      const item = data.find((c) => c.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/product-categories/${selectedId}`, { status });
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
    { key: 'description', header: t('common.description'), render: (c: ProductCategory) => c.description || '-' },
    { key: 'parent', header: t('inventory.parentCategory'), render: (c: ProductCategory) => c.parent?.name || '-' },
    { key: 'products', header: t('inventory.products'), render: (c: ProductCategory) => c._count?.products ?? '-' },
    { key: 'status', header: t('common.status'), render: (c: ProductCategory) => <StatusBadge status={c.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (c: ProductCategory) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
          <button onClick={() => confirmStatus(c.id)}
            className={`text-sm ${c.status === 'ACTIVE' ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
            {c.status === 'ACTIVE' ? t('actions.deactivate') : t('actions.activate')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('inventory.productCategories')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('inventory.newProductCategory')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(c: ProductCategory) => c.id} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventory.editProductCategory') : t('inventory.newProductCategory')}>
        <div className="space-y-4">
          <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select label={t('inventory.parentCategory')} value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            options={parents.filter((p) => p.id !== editItem?.id).map((c) => ({ value: c.id, label: `[${c.code}] ${c.name}` }))} placeholder='-' />
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
