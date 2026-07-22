'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Department } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, Pagination, PageHeader, LoadingState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, companyAdapter, branchAdapter, departmentAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function DepartmentsPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Department[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Department | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', parentId: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate'>('deactivate');
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatusChange(selectedId, 'activate'),
    deactivate: () => confirmStatusChange(selectedId, 'deactivate'),
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
      if (sortColumn) { params.sortBy = sortColumn; params.sortOrder = sortDirection; }
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get<{ data: Department[]; meta: any }>('/departments', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t, sortColumn, sortDirection, filters]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ companyId: '', branchId: '', parentId: '', name: '' });
    setModalOpen(true);
  };

  const openEdit = async (item: Department) => {
    setEditItem(item);
    setDetailLoading(true);
    setModalOpen(true);
    try {
      const res = await api.get<any>(`/departments/${item.id}`);
      const detail = res.data as Department;
      setForm({
        companyId: detail.companyId,
        branchId: detail.branchId ?? '',
        parentId: detail.parentId ?? '',
        name: detail.name,
      });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.companyId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { name: form.name, companyId: form.companyId };
      if (form.branchId) payload.branchId = form.branchId;
      if (form.parentId) payload.parentId = form.parentId;
      if (editItem) {
        await api.patch(`/departments/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/departments', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.createFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmStatusChange = (id: string, action: 'activate' | 'deactivate') => {
    setSelectedId(id);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const status = confirmAction === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await api.patch(`/departments/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const baseColumns: GridColumn<Department>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('common.name'), sortable: true, filterable: true },
    { key: 'company', header: t('core.company'), sortable: true, render: (d) => d.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), sortable: true, render: (d) => d.branch?.name || '-' },
    { key: 'parent', header: t('core.parentDepartment'), sortable: true, render: (d) => d.parent?.name || '-' },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('common.active') },
      { value: 'INACTIVE', label: t('common.inactive') },
    ], render: (d) => <StatusBadge status={d.status} /> },
  ];

  const gridActions: GridAction<Department>[] = [
    { label: t('grid.view'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (d) => router.push(`/admin/core/departments/${d.id}`) },
    { label: t('grid.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (d) => openEdit(d) },
    { label: t('common.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, onClick: (d) => confirmStatusChange(d.id, 'activate'), enabled: (d) => d.status !== 'ACTIVE' },
    { label: t('common.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, variant: 'danger', onClick: (d) => confirmStatusChange(d.id, 'deactivate'), enabled: (d) => d.status === 'ACTIVE' },
  ];

  const handleSort = useCallback((col: string, dir: 'asc' | 'desc') => {
    setSortColumn(col);
    setSortDirection(dir);
  }, []);

  const handleFilter = useCallback((col: string, value: string) => {
    setFilters(prev => ({ ...prev, [col]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearch('');
  }, []);

  return (
    <div>
      <PageHeader title={t('core.departments')} />
      {error && <div className="text-center py-12"><p className="text-red-500 mb-4">{error}</p></div>}
      {!error && loading && data.length === 0 && <LoadingState />}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12"><p className="text-gray-500">{t('common.noData')}</p></div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <AdminDataGrid
          columns={baseColumns}
          data={data}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => setSelectedId(item.id)}
          selectedKey={selectedId}
          loading={loading}
          emptyMessage={t('common.noData')}
          loadingMessage={t('common.loading')}
          error={error || undefined}
          actions={gridActions}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          filters={filters}
          onFilter={handleFilter}
          onClearFilters={handleClearFilters}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          dir={dir}
          globalSearch={search}
          onGlobalSearch={(v) => setSearch(v)}
          searchPlaceholder={t('grid.searchPlaceholder')}
          onRefresh={() => fetchData(meta.page)}
          refreshLoading={loading}
        />
      )}
      {data.length > 0 && (
        <div className="mt-3">
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('core.editDepartment') : t('core.newDepartment')}>
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
          <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
          <F9Lookup label={t('core.parentDepartment')} value={form.parentId} onChange={(v) => setForm({ ...form, parentId: v })} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>}
      </Modal>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)}
        onConfirm={handleStatusChange}
        title={confirmAction === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={confirmAction === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
        variant={confirmAction === 'activate' ? 'primary' : 'danger'} loading={saving} />
    </div>
  );
}
