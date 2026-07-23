'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { SparePart } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon, ActionBackIcon } from '../../../../components/admin/admin-action-bar';

export default function SparePartsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<SparePart[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'activate' | 'deactivate' } | null>(null);
  const [form, setForm] = useState({
    code: '', name: '', description: '', category: '', specification: '', unit: '',
    manufacturer: '', model: '', partNumber: '', barcode: '',
    minRecommendedStock: 0, maxRecommendedStock: 0, reorderPoint: 0, isCritical: false,
  });

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      const res = await api.get<{ data: SparePart[]; meta: typeof meta }>(`/maintenance/spare-parts?${params}`);
      setData(res.data); setMeta(res.meta);
    } catch (e: any) { setError(e.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setForm({ code: '', name: '', description: '', category: '', specification: '', unit: '', manufacturer: '', model: '', partNumber: '', barcode: '', minRecommendedStock: 0, maxRecommendedStock: 0, reorderPoint: 0, isCritical: false });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((item: SparePart) => {
    setEditingId(item.id);
    setForm({
      code: item.code, name: item.name, description: item.description || '',
      category: item.category || '', specification: item.specification || '',
      unit: item.unit || '', manufacturer: item.manufacturer || '', model: item.model || '',
      partNumber: item.partNumber || '', barcode: item.barcode || '',
      minRecommendedStock: item.minRecommendedStock ?? 0,
      maxRecommendedStock: item.maxRecommendedStock ?? 0,
      reorderPoint: item.reorderPoint ?? 0, isCritical: item.isCritical,
    });
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.code || !form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/maintenance/spare-parts/${editingId}`, form);
        showToast(t('maintenance.sparePartUpdated'), 'success');
      } else {
        await api.post('/maintenance/spare-parts', form);
        showToast(t('maintenance.sparePartCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (e: any) { showToast(e.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  }, [form, editingId, meta.page, showToast, t, fetchData]);

  const handleStatusChange = useCallback(async (id: string, action: 'activate' | 'deactivate') => {
    setConfirmAction(null);
    try {
      await api.patch(`/maintenance/spare-parts/${id}/${action}`, {});
      showToast(action === 'activate' ? t('common.activated') : t('common.deactivated'), 'success');
      fetchData(meta.page);
    } catch (e: any) { showToast(e.message, 'error'); }
  }, [meta.page, showToast, t, fetchData]);

  const { exec } = useStableHandlers({
    add: () => openNew(),
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions(useMemo(() => [
    { id: 'add', labelKey: 'common.add', icon: <ActionAddIcon />, onClick: () => exec('add') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ], [exec]));

  const columns: GridColumn<SparePart>[] = [
    { key: 'code', header: t('maintenance.sparePartCode'), sortable: true },
    { key: 'name', header: t('maintenance.sparePartName'), sortable: true },
    { key: 'category', header: t('maintenance.partCategory') },
    { key: 'partNumber', header: t('maintenance.partNumber') },
    { key: 'manufacturer', header: t('maintenance.manufacturer') },
    { key: 'unit', header: t('maintenance.sparePart.form.unit') },
    { key: 'isCritical', header: t('maintenance.criticalPart'), render: (s) => s.isCritical ? t('common.yes') : t('common.no') },
    { key: 'status', header: t('common.status'), render: (s) => s.status },
  ];

  const gridActions: GridAction<SparePart>[] = [
    { label: t('actions.view'), onClick: (s) => router.push(`/admin/maintenance/spare-parts/${s.id}`) },
    { label: t('actions.edit'), onClick: (s) => openEdit(s) },
    { label: t('actions.deactivate'), onClick: (s) => setConfirmAction({ id: s.id, action: 'deactivate' }), enabled: (s) => s.status === 'ACTIVE' },
    { label: t('actions.activate'), onClick: (s) => setConfirmAction({ id: s.id, action: 'activate' }), enabled: (s) => s.status !== 'ACTIVE' },
  ];

  return (
    <div className="p-6">
      <PageHeader title={t('maintenance.spareParts')} />
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <AdminDataGrid<SparePart>
        columns={columns}
        data={data}
        keyExtractor={(s) => s.id}
        onRowClick={(s) => router.push(`/admin/maintenance/spare-parts/${s.id}`)}
        selectedKey=""
        loading={loading}
        emptyMessage={t('maintenance.noSpareParts')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('common.edit') : t('common.new')}>
        <div className="space-y-4">
          <Input label={`${t('maintenance.sparePart.form.code')} *`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input label={`${t('maintenance.sparePart.form.name')} *`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t('maintenance.sparePart.form.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label={t('maintenance.sparePart.form.category')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Input label={t('maintenance.sparePart.form.specification')} value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} />
          <Input label={t('maintenance.sparePart.form.unit')} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <Input label={t('maintenance.sparePart.form.manufacturer')} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          <Input label={t('maintenance.sparePart.form.model')} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <Input label={t('maintenance.sparePart.form.partNumber')} value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
          <Input label={t('maintenance.sparePart.form.barcode')} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          <Input label={t('maintenance.sparePart.form.minRecommendedStock')} type="number" value={form.minRecommendedStock} onChange={(e) => setForm({ ...form, minRecommendedStock: Number(e.target.value) })} />
          <Input label={t('maintenance.sparePart.form.maxRecommendedStock')} type="number" value={form.maxRecommendedStock} onChange={(e) => setForm({ ...form, maxRecommendedStock: Number(e.target.value) })} />
          <Input label={t('maintenance.sparePart.form.reorderPoint')} type="number" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: Number(e.target.value) })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isCritical} onChange={(e) => setForm({ ...form, isCritical: e.target.checked })} className="rounded" />
            {t('maintenance.sparePart.form.isCritical')}
          </label>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} variant="primary">{saving ? t('common.saving') : t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmAction?.action === 'deactivate'} onClose={() => setConfirmAction(null)} onConfirm={() => handleStatusChange(confirmAction!.id, 'deactivate')} title={t('common.deactivate')} message={t('maintenance.confirmDeactivateSparePart')} variant="danger" />
      <ConfirmDialog open={confirmAction?.action === 'activate'} onClose={() => setConfirmAction(null)} onConfirm={() => handleStatusChange(confirmAction!.id, 'activate')} title={t('common.activate')} message={t('maintenance.confirmActivateSparePart')} />
    </div>
  );
}
