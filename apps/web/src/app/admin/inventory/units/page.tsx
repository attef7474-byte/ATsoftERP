'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Unit } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog, StatusBadge } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { useAuth } from '../../../../lib/auth-context';

export default function UnitsPage() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();
  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(`unit:${action}`)),
    [isSuperAdmin, permissions],
  );
  const canCreate = can('create');
  const canUpdate = can('update');
  const canDelete = can('delete');
  const canActivate = can('activate');
  const canDeactivate = can('deactivate');

  const [data, setData] = useState<Unit[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'activate' | 'deactivate' } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const emptyForm = { code: '', nameAr: '', nameEn: '', symbol: '', isActive: true };
  const [form, setForm] = useState(emptyForm);

  const localizedName = useCallback((u: Unit) => (locale === 'ar' ? u.nameAr : u.nameEn), [locale]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: Unit[]; meta: typeof meta }>('/units', { params });
      setData(res.data); setMeta(res.meta);
    } catch (e: any) { setError(e.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setValidationErrors({});
    setForm(emptyForm);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setEditingId(id);
    setValidationErrors({});
    setModalOpen(true);
    try {
      const item = await api.get<Unit>(`/units/${id}`);
      setForm({
        code: item.code, nameAr: item.nameAr, nameEn: item.nameEn,
        symbol: item.symbol || '', isActive: item.isActive,
      });
    } catch (e: any) {
      handleApiError(e);
      setModalOpen(false);
    } finally { setLoadingDetail(false); }
  }, [handleApiError]);

  const handleSave = useCallback(async () => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = t('validation.required');
    if (!form.nameAr.trim()) errs.nameAr = t('validation.required');
    if (!form.nameEn.trim()) errs.nameEn = t('validation.required');
    if (Object.keys(errs).length > 0) { setValidationErrors(errs); return; }
    setValidationErrors({});
    setSaving(true);
    try {
      const payload = { code: form.code.trim(), nameAr: form.nameAr.trim(), nameEn: form.nameEn.trim(), symbol: form.symbol.trim() || undefined, isActive: form.isActive };
      if (editingId) {
        await api.patch(`/units/${editingId}`, payload);
        showToast(t('inventory.units.updated'), 'success');
      } else {
        await api.post('/units', payload);
        showToast(t('inventory.units.created'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (e: any) { handleApiError(e); }
    finally { setSaving(false); }
  }, [form, editingId, meta.page, showToast, t, fetchData, handleApiError]);

  const handleStatusChange = useCallback(async (id: string, action: 'activate' | 'deactivate') => {
    setConfirmAction(null);
    try {
      await api.patch(`/units/${id}/${action}`, {});
      showToast(action === 'activate' ? t('common.activated') : t('common.deactivated'), 'success');
      fetchData(meta.page);
    } catch (e: any) { handleApiError(e); }
  }, [meta.page, showToast, t, fetchData, handleApiError]);

  const handleDelete = useCallback(async () => {
    setSaving(true);
    try {
      await api.delete(`/units/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (e: any) { handleApiError(e); }
    finally { setSaving(false); }
  }, [selectedId, showToast, t, fetchData, handleApiError]);

  const { exec } = useStableHandlers({
    add: () => openNew(),
    refresh: () => fetchData(meta.page),
    delete: () => selectedId && setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'add', labelKey: 'actions.add', icon: <ActionAddIcon />, permission: 'unit:create', onClick: () => exec('add'), enabled: canCreate },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', permission: 'unit:delete', onClick: () => exec('delete'), enabled: !!selectedId && canDelete },
  ]);

  const columns: GridColumn<Unit>[] = useMemo(() => [
    { key: 'code', header: t('inventory.units.code'), sortable: true },
    { key: 'name', header: t('inventory.units.name'), render: (u) => localizedName(u) },
    { key: 'nameAr', header: t('inventory.units.nameAr') },
    { key: 'nameEn', header: t('inventory.units.nameEn') },
    { key: 'symbol', header: t('inventory.units.symbol'), render: (u) => u.symbol || '-' },
    {
      key: 'usage', header: t('inventory.units.usage'),
      render: (u) => String((u._count?.products || 0) + (u._count?.spareParts || 0) + (u._count?.machineParts || 0)),
    },
    {
      key: 'isActive', header: t('common.status'),
      render: (u) => <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
  ], [t, localizedName]);

  const gridActions: GridAction<Unit>[] = [
    { label: t('actions.edit'), permission: 'unit:update', onClick: (u) => openEdit(u.id), enabled: () => canUpdate },
    { label: t('common.delete'), permission: 'unit:delete', onClick: (u) => { setSelectedId(u.id); setConfirmDeleteOpen(true); }, variant: 'danger', enabled: () => canDelete },
    { label: t('actions.deactivate'), permission: 'unit:deactivate', onClick: (u) => setConfirmAction({ id: u.id, action: 'deactivate' }), enabled: (u) => u.isActive && canDeactivate },
    { label: t('actions.activate'), permission: 'unit:activate', onClick: (u) => setConfirmAction({ id: u.id, action: 'activate' }), enabled: (u) => !u.isActive && canActivate },
  ];

  return (
    <div className="p-6">
      <PageHeader title={t('inventory.units.title')} />
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <AdminDataGrid<Unit>
        columns={columns}
        data={data}
        keyExtractor={(u) => u.id}
        onRowClick={(u) => setSelectedId(u.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('inventory.units.empty')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('inventory.units.edit') : t('inventory.units.new')}>
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
          <div className="space-y-4">
            <div>
              <Input label={`${t('inventory.units.code')} *`} value={form.code} onChange={(e) => { setForm({ ...form, code: e.target.value }); if (validationErrors.code) setValidationErrors((prev) => { const n = { ...prev }; delete n.code; return n; }); }} />
              {validationErrors.code && <p className="text-red-500 text-sm mt-1">{validationErrors.code}</p>}
            </div>
            <div>
              <Input label={`${t('inventory.units.nameAr')} *`} value={form.nameAr} onChange={(e) => { setForm({ ...form, nameAr: e.target.value }); if (validationErrors.nameAr) setValidationErrors((prev) => { const n = { ...prev }; delete n.nameAr; return n; }); }} />
              {validationErrors.nameAr && <p className="text-red-500 text-sm mt-1">{validationErrors.nameAr}</p>}
            </div>
            <div>
              <Input label={`${t('inventory.units.nameEn')} *`} value={form.nameEn} onChange={(e) => { setForm({ ...form, nameEn: e.target.value }); if (validationErrors.nameEn) setValidationErrors((prev) => { const n = { ...prev }; delete n.nameEn; return n; }); }} />
              {validationErrors.nameEn && <p className="text-red-500 text-sm mt-1">{validationErrors.nameEn}</p>}
            </div>
            <Input label={t('inventory.units.symbol')} value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
              {t('common.active')}
            </label>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving} variant="primary">{saving ? t('common.saving') : t('actions.save')}</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={confirmAction?.action === 'deactivate'} onClose={() => setConfirmAction(null)} onConfirm={() => handleStatusChange(confirmAction!.id, 'deactivate')} title={t('common.deactivate')} message={t('inventory.units.confirmDeactivate')} variant="danger" />
      <ConfirmDialog open={confirmAction?.action === 'activate'} onClose={() => setConfirmAction(null)} onConfirm={() => handleStatusChange(confirmAction!.id, 'activate')} title={t('common.activate')} message={t('inventory.units.confirmActivate')} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete} title={t('common.confirmDeleteTitle')} message={t('inventory.units.confirmDelete')} variant="danger" />
    </div>
  );
}
