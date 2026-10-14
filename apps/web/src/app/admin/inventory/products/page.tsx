'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Product } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Pagination, PageHeader, LoadingState, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { ProductForm } from './product-form';

export default function ProductsPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formProductId, setFormProductId] = useState<string | null>(null);
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
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, permission: 'products:create', onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, permission: 'products:update', onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, permission: 'products:update', onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, permission: 'products:update', onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: Product[]; meta: any }>('/products', { params });
      const listResult = unwrapApiList<Product, typeof meta>(res);
      setData(listResult.data);
      if (listResult.meta) setMeta(listResult.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  // Deep links from the (now redirecting) legacy routes and from bookmarks:
  // `/admin/inventory/products?create=1` and `?edit=<id>` open the same modal
  // above this list, then clean the URL so a refresh never reopens it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const create = params.get('create');
    const edit = params.get('edit');
    if (create === '1' || edit) {
      setFormProductId(edit || null);
      setFormOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const openCreate = () => { setFormProductId(null); setFormOpen(true); };
  const openEdit = (item: Product) => { setFormProductId(item.id); setFormOpen(true); };

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

  const columns: GridColumn<Product>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('common.name'), sortable: true, filterable: true },
    { key: 'category', header: t('inventory.productCategory'), sortable: true, render: (p: Product) => p.category?.name || '-' },
    { key: 'unit', header: t('inventory.unit'), sortable: true, filterable: true, render: (p: Product) => p.unitRef?.code || p.unit || '-' },
    { key: 'barcode', header: t('inventory.barcode'), render: (p: Product) => p.barcode || '-' },
    { key: 'minStock', header: t('inventory.minStock'), align: 'center', render: (p: Product) => p.minStock },
    { key: 'maxStock', header: t('inventory.maxStock'), align: 'center', render: (p: Product) => p.maxStock },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('common.active') }, { value: 'INACTIVE', label: t('common.inactive') },
    ], render: (p: Product) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
    )},
  ];

  const gridActions: GridAction<Product>[] = [
    { label: t('details.viewDetails'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (p: Product) => router.push(`/admin/inventory/products/${p.id}`) },
    { label: t('common.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, permission: 'products:update', onClick: (p: Product) => openEdit(p) },
    { label: t('common.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, permission: 'products:update', onClick: (p: Product) => confirmStatus(p.id), enabled: (p: Product) => p.status !== 'ACTIVE' },
    { label: t('common.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, permission: 'products:update', onClick: (p: Product) => confirmStatus(p.id), enabled: (p: Product) => p.status === 'ACTIVE' },
  ];

  return (
    <div>
      <PageHeader title={t('inventory.products')} />
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
        </div>
      )}
      {!error && loading && data.length === 0 && <LoadingState />}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('common.noData')}</p>
        </div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <AdminDataGrid
          columns={columns}
          data={data}
          keyExtractor={(p: Product) => p.id}
          selectedKey={selectedId}
          onRowClick={(item: Product) => setSelectedId(item.id)}
          loading={loading}
          emptyMessage={t('common.noData')}
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

      <ProductForm
        open={formOpen}
        productId={formProductId}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchData(formProductId ? meta.page : 1)}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleStatusChange}
        title={selectedRecord?.status === 'ACTIVE' ? t('common.confirmDeactivateTitle') : t('common.confirmActivateTitle')}
        message={selectedRecord?.status === 'ACTIVE' ? t('common.confirmDeactivateMessage') : t('common.confirmActivateMessage')}
        loading={saving}
      />
    </div>
  );
}
