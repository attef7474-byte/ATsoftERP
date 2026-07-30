'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { unwrapApiData, unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { User, Company, Branch, Department, Role } from '../../../../lib/admin-types';
import { useRouter, usePathname } from 'next/navigation';
import { Button, Input, Card, Pagination, LoadingState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { EntityWorkspaceLayout, EntityPageHeader, EntityDataTable, EntityDetailDrawer, EntityStatusBadge } from '../../../../components/entity';
import type { DrawerSection } from '../../../../components/entity';
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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [drawerRoles, setDrawerRoles] = useState<any[]>([]);
  const [drawerRolesLoading, setDrawerRolesLoading] = useState(false);
  const [drawerScopes, setDrawerScopes] = useState<any[]>([]);
  const [drawerScopesLoading, setDrawerScopesLoading] = useState(false);

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
      const listResult = unwrapApiList<User, typeof meta>(res);
      setData(listResult.data);
      if (listResult.meta) setMeta(listResult.meta);
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
      if (cRes.status === 'fulfilled') setCompanies(unwrapApiList<Company>(cRes.value).data);
      if (bRes.status === 'fulfilled') setBranches(unwrapApiList<Branch>(bRes.value).data);
      if (dRes.status === 'fulfilled') setDepartments(unwrapApiList<Department>(dRes.value).data);
      if (rRes.status === 'fulfilled') setRoles(unwrapApiList<Role>(rRes.value).data);
    } catch (_) { }
  }, []);

  useEffect(() => { fetchData(); fetchLookups(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ email: '', password: '', name: '', phone: '', companyId: '', branchId: '', departmentId: '', roleId: '' });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (item: User) => {
    setEditItem(item);
    setDetailLoading(true);
    setModalOpen(true);
    try {
      const res = await api.get<any>(`/users/${item.id}`);
      const detail = unwrapApiData<User>(res);
      setForm({ email: detail.email ?? '', password: '', name: detail.name ?? '', phone: detail.phone ?? '', companyId: detail.companyId ?? '', branchId: detail.branchId ?? '', departmentId: detail.departmentId ?? '', roleId: (detail.roles && detail.roles.length > 0) ? detail.roles[0].role.id : '' });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.email) errors.email = t('validation.required');
    if (!form.name) errors.name = t('validation.required');
    if (!editItem && !form.password) errors.password = t('users.passwordRequired');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
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
  const getDepartmentName = (id?: string | null) => id ? departments.find((d) => d.id === id)?.name || '-' : '-';

  const fetchDrawerRoles = useCallback(async (userId: string) => {
    setDrawerRolesLoading(true);
    try {
      const res = await api.get<{ data: any[] }>(`/users/${userId}/roles`);
      setDrawerRoles(res.data || []);
    } catch {
      // ignore - roles shown from inline data
    } finally {
      setDrawerRolesLoading(false);
    }
  }, []);

  const fetchDrawerScopes = useCallback(async (userId: string) => {
    setDrawerScopesLoading(true);
    try {
      const res = await api.get<{ data: any[] }>(`/users/${userId}/operational-scopes`);
      setDrawerScopes(res.data || []);
    } catch {
      // ignore
    } finally {
      setDrawerScopesLoading(false);
    }
  }, []);

  const handleRowClick = useCallback((item: User) => {
    setSelectedId(item.id);
    setSelectedUser(item);
    setActiveSection('overview');
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setActiveSection('overview');
  }, []);

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

  const pathname = usePathname();
  useEffect(() => {
    if (drawerOpen) setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen && selectedUser && !data.find(d => d.id === selectedUser.id)) {
      setDrawerOpen(false);
      setSelectedUser(null);
    }
  }, [data, drawerOpen, selectedUser]);

  useEffect(() => {
    if (drawerOpen && selectedUser) {
      fetchDrawerRoles(selectedUser.id);
      fetchDrawerScopes(selectedUser.id);
    }
  }, [drawerOpen, selectedUser?.id, fetchDrawerRoles, fetchDrawerScopes]);

  const drawerNavItems = useMemo(() => [
    { id: 'overview', label: t('workspace.overview'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { id: 'roles', label: t('workspace.roles'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
    { id: 'scopes', label: t('workspace.operationalScopes'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  ], [t]);

  const drawerSections = useMemo((): DrawerSection[] => [
    {
      id: 'overview',
      label: t('workspace.overview'),
      content: selectedUser ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">{t('users.name')}</label>
            <p className="text-sm font-medium text-gray-900">{selectedUser.name}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('users.email')}</label>
            <p className="text-sm text-gray-700">{selectedUser.email}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('common.status')}</label>
            <div className="mt-0.5">
              <EntityStatusBadge status={selectedUser.status} activeLabel={t('common.active')} inactiveLabel={t('common.inactive')} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('users.company')}</label>
            <p className="text-sm text-gray-700">{getCompanyName(selectedUser.companyId)}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('users.branch')}</label>
            <p className="text-sm text-gray-700">{getBranchName(selectedUser.branchId)}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('users.department')}</label>
            <p className="text-sm text-gray-700">{getDepartmentName(selectedUser.departmentId)}</p>
          </div>
        </div>
      ) : null,
    },
    {
      id: 'roles',
      label: t('workspace.roles'),
      content: (
        <div>
          {drawerRolesLoading ? <LoadingState /> : (
            <div className="space-y-2">
              {(selectedUser?.roles || drawerRoles).length > 0 ? (
                (selectedUser?.roles || drawerRoles).map((r: any, i: number) => (
                  <div key={r.id || r.role?.id || i} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{r.role?.name || r.name}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">{t('common.noData')}</p>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'scopes',
      label: t('workspace.operationalScopes'),
      content: (
        <div>
          {drawerScopesLoading ? <LoadingState /> : (
            <div className="space-y-2">
              {drawerScopes.length > 0 ? drawerScopes.map((s: any) => (
                <div key={s.id} className="p-2 bg-gray-50 rounded text-sm">
                  {s.company?.name || s.companyId}
                </div>
              )) : (
                <p className="text-gray-500 text-sm">{t('common.noData')}</p>
              )}
            </div>
          )}
        </div>
      ),
    },
  ], [selectedUser, t, getCompanyName, getBranchName, getDepartmentName, drawerRoles, drawerRolesLoading, drawerScopes, drawerScopesLoading]);

  const usersIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  return (
    <EntityWorkspaceLayout drawerOpen={drawerOpen} drawer={drawerOpen ? <EntityDetailDrawer open={drawerOpen} onClose={closeDrawer} title={selectedUser?.name || ''} subtitle={selectedUser?.email} statusBadge={<EntityStatusBadge status={selectedUser?.status || ''} activeLabel={t('common.active')} inactiveLabel={t('common.inactive')} />} sections={drawerSections} activeSection={activeSection} onSectionChange={setActiveSection} navItems={drawerNavItems} dir={dir} /> : undefined}>
      <EntityPageHeader title={t('users.title')} icon={usersIcon} />
      {error && <div className="text-center py-12"><p className="text-red-500 mb-4">{error}</p></div>}
      {!error && loading && data.length === 0 && <LoadingState />}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12"><p className="text-gray-500">{t('common.noData')}</p></div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <EntityDataTable
          columns={baseColumns}
          data={data}
          keyExtractor={(item) => item.id}
          onRowClick={handleRowClick}
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
          <div>
            <Input label={t('users.email')} type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setValidationErrors(prev => ({ ...prev, email: '' })); }} required />
            {validationErrors.email && <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>}
          </div>
          <div>
            <Input label={t('users.name')} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} required />
            {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
          </div>
          <Input label={t('users.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {!editItem && <div>
            <Input label={t('users.password')} type="password" value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setValidationErrors(prev => ({ ...prev, password: '' })); }} required />
            {validationErrors.password && <p className="text-red-500 text-sm mt-1">{validationErrors.password}</p>}
          </div>}
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
    </EntityWorkspaceLayout>
  );
}
