'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { User, Company, Branch, Department, Role } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, Pagination, PageHeader, LoadingState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, companyAdapter, branchAdapter, departmentAdapter, roleAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function UsersPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<User[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', companyId: '', branchId: '', departmentId: '', roleId: '' });
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
    activate: () => confirmActivate(selectedId),
    deactivate: () => confirmDeactivate(selectedId),
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
      const res = await api.get<{ data: User[]; meta: any }>('/users', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t, sortColumn, sortDirection, filters]);

  const fetchLookups = useCallback(async () => {
    try {
      const [cRes, bRes, dRes, rRes] = await Promise.allSettled([
        api.get<{ data: Company[] }>('/companies', { params: { page: 1, limit: 1000 } }),
        api.get<{ data: Branch[] }>('/branches', { params: { page: 1, limit: 1000 } }),
        api.get<{ data: Department[] }>('/departments', { params: { page: 1, limit: 1000 } }),
        api.get<{ data: Role[] }>('/roles', { params: { page: 1, limit: 1000 } }),
      ]);
      if (cRes.status === 'fulfilled') setCompanies(cRes.value.data || []);
      if (bRes.status === 'fulfilled') setBranches(bRes.value.data || []);
      if (dRes.status === 'fulfilled') setDepartments(dRes.value.data || []);
      if (rRes.status === 'fulfilled') setRoles(rRes.value.data || []);
    } catch (_) { }
  }, []);

  useEffect(() => { fetchData(); fetchLookups(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ email: '', password: '', name: '', phone: '', companyId: '', branchId: '', departmentId: '', roleId: '' });
    setModalOpen(true);
  };

  const openEdit = async (item: User) => {
    setEditItem(item);
    setDetailLoading(true);
    setModalOpen(true);
    try {
      const res = await api.get<any>(`/users/${item.id}`);
      const detail = res.data as User;
      setForm({ email: detail.email ?? '', password: '', name: detail.name ?? '', phone: detail.phone ?? '', companyId: detail.companyId ?? '', branchId: detail.branchId ?? '', departmentId: detail.departmentId ?? '', roleId: (detail.roles && detail.roles.length > 0) ? detail.roles[0].role.id : '' });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.email || !form.name) { showToast(t('validation.required'), 'error'); return; }
    if (!editItem && !form.password) { showToast(t('users.passwordRequired'), 'error'); return; }
    setSaving(true);
    try {
      const body: any = { email: form.email, name: form.name, phone: form.phone || undefined, companyId: form.companyId || undefined, branchId: form.branchId || undefined, departmentId: form.departmentId || undefined, roleId: form.roleId || undefined };
      if (!editItem) body.password = form.password;
      if (editItem) {
        await api.patch(`/users/${editItem.id}`, body);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/users', body);
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

  const confirmDeactivate = (id: string) => { setSelectedId(id); setConfirmAction('deactivate'); setConfirmOpen(true); };
  const confirmActivate = (id: string) => { setSelectedId(id); setConfirmAction('activate'); setConfirmOpen(true); };

  const handleConfirm = async () => {
    try {
      const status = confirmAction === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await api.patch(`/users/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    }
  };

  const getCompanyName = (id?: string | null) => id ? companies.find((c) => c.id === id)?.name || '-' : '-';
  const getBranchName = (id?: string | null) => id ? branches.find((b) => b.id === id)?.name || '-' : '-';

  const baseColumns: GridColumn<User>[] = [
    { key: 'name', header: t('users.name'), sortable: true, filterable: true },
    { key: 'email', header: t('users.email'), sortable: true, filterable: true },
    { key: 'phone', header: t('users.phone'), sortable: true, render: (r) => r.phone || '-' },
    { key: 'company', header: t('users.company'), sortable: true, render: (r) => getCompanyName(r.companyId) },
    { key: 'branch', header: t('users.branch'), sortable: true, render: (r) => getBranchName(r.branchId) },
    { key: 'role', header: t('users.role'), sortable: true, render: (r) => (r.roles && r.roles.length > 0) ? r.roles[0].role.name : '-' },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('common.active') },
      { value: 'INACTIVE', label: t('common.inactive') },
    ], render: (r) => <StatusBadge status={r.status} /> },
  ];

  const gridActions: GridAction<User>[] = [
    { label: t('grid.view'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (r) => router.push(`/admin/access/users/${r.id}`) },
    { label: t('grid.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (r) => openEdit(r) },
    { label: t('common.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, onClick: (r) => confirmActivate(r.id), enabled: (r) => r.status !== 'ACTIVE' },
    { label: t('common.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, variant: 'danger', onClick: (r) => confirmDeactivate(r.id), enabled: (r) => r.status === 'ACTIVE' },
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
      <PageHeader title={t('users.title')} />
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('users.edit') : t('users.create')}>
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          <Input label={t('users.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label={t('users.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('users.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {!editItem && <Input label={t('users.password')} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />}
          <F9Lookup label={t('users.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
          <F9Lookup label={t('users.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
          <F9Lookup label={t('users.department')} value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} />
          <F9Lookup label={t('users.role')} value={form.roleId} onChange={(v) => setForm({ ...form, roleId: v })} adapter={roleAdapter} />
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleConfirm} title={confirmAction === 'activate' ? t('users.activateTitle') : t('users.deactivateTitle')} message={confirmAction === 'activate' ? t('users.activateConfirm') : t('users.deactivateConfirm')} />
    </div>
  );
}
