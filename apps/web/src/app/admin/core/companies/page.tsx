'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Company } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Card, Pagination, PageHeader, LoadingState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function CompaniesPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Company[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', legalName: '', taxNumber: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate' | 'delete'>('deactivate');
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(c => c.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    delete: () => confirmDelete(selectedId),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatusChange(selectedId, 'activate'),
    deactivate: () => confirmStatusChange(selectedId, 'deactivate'),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord && selectedRecord.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord && selectedRecord.status === 'ACTIVE') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (sortColumn) { params.sortBy = sortColumn; params.sortOrder = sortDirection; }
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get<{ data: Company[]; meta: any }>('/companies', { params });
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
    setForm({ name: '', legalName: '', taxNumber: '', phone: '', email: '', address: '' });
    setModalOpen(true);
  };

  const openEdit = (item: Company) => {
    setEditItem(item);
    setForm({
      name: item.name,
      legalName: item.legalName || '',
      taxNumber: item.taxNumber || '',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      if (editItem) {
        await api.patch(`/companies/${editItem.id}`, form);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/companies', form);
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
      await api.patch(`/companies/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setSelectedId(id);
    setConfirmAction('delete');
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/companies/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.deleteFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const baseColumns: GridColumn<Company>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('common.name'), sortable: true, filterable: true },
    { key: 'legalName', header: t('core.legalName'), sortable: true, render: (item) => item.legalName || '-' },
    { key: 'taxNumber', header: t('core.taxNumber'), sortable: true, render: (item) => item.taxNumber || '-' },
    { key: 'phone', header: t('common.phone'), sortable: true, render: (item) => item.phone || '-' },
    { key: 'email', header: t('common.email'), sortable: true, render: (item) => item.email || '-' },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('common.active') },
      { value: 'INACTIVE', label: t('common.inactive') },
    ], render: (item) => <StatusBadge status={item.status} /> },
  ];

  const gridActions: GridAction<Company>[] = [
    { label: t('grid.view'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (item) => router.push(`/admin/core/companies/${item.id}`) },
    { label: t('grid.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (item) => openEdit(item) },
    { label: t('grid.delete'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, variant: 'danger', onClick: (item) => confirmDelete(item.id) },
    { label: t('common.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, onClick: (item) => confirmStatusChange(item.id, 'activate'), enabled: (item) => item.status !== 'ACTIVE' },
    { label: t('common.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, variant: 'danger', onClick: (item) => confirmStatusChange(item.id, 'deactivate'), enabled: (item) => item.status === 'ACTIVE' },
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
      <PageHeader title={t('core.companies')} />
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('core.editCompany') : t('core.newCompany')}>
        <div className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('core.legalName')} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
          <Input label={t('core.taxNumber')} value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
          <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label={t('common.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAction === 'delete' ? handleDelete : handleStatusChange}
        title={confirmAction === 'delete' ? t('common.confirmDeleteTitle') : confirmAction === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={confirmAction === 'delete' ? t('common.confirmDeleteMessage') : confirmAction === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
        variant={confirmAction === 'activate' ? 'primary' : 'danger'}
        loading={saving}
      />
    </div>
  );
}
