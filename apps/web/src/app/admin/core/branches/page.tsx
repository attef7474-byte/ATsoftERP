'use client';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { safeString } from '../../../../lib/form-utils';
import { useCrudList, CrudOperation } from '../../../../hooks/useCrudList';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Branch, PaginationMeta } from '../../../../lib/admin-types';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button, Input, Card, Pagination, LoadingState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, companyAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { EntityWorkspaceLayout, EntityPageHeader, EntityDataTable, EntityDetailDrawer, EntityEmptyState, type DrawerSection } from '../../../../components/entity';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';

interface BranchForm {
  companyId: string;
  name: string;
  address: string;
  phone: string;
}

const EMPTY_BRANCH_FORM: BranchForm = { companyId: '', name: '', address: '', phone: '' };
const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

const overviewIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const peopleIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const userIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const warehouseIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v11a1 1 0 001 1h16a1 1 0 001-1V7M3 7l9-4 9 4M3 7l9 4m0-4v4" />
  </svg>
);

const branchIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

export default function BranchesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate'>('deactivate');
  const [statusSaving, setStatusSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [drawerDepartments, setDrawerDepartments] = useState<any[]>([]);
  const [drawerDepartmentsLoading, setDrawerDepartmentsLoading] = useState(false);
  const [drawerUsers, setDrawerUsers] = useState<any[]>([]);
  const [drawerUsersLoading, setDrawerUsersLoading] = useState(false);
  const [drawerWarehouses, setDrawerWarehouses] = useState<any[]>([]);
  const [drawerWarehousesLoading, setDrawerWarehousesLoading] = useState(false);

  const {
    data,
    meta,
    loading,
    error,
    form,
    setForm,
    modalOpen,
    editItem,
    detailLoading,
    saving,
    refresh: fetchData,
    openCreate,
    openEdit,
    closeFormModal,
    handleSave,
  } = useCrudList<Branch, BranchForm, BranchForm, PaginationMeta, [page?: number]>({
    initialForm: EMPTY_BRANCH_FORM,
    initialMeta: INITIAL_META,
    initialListArgs: [1],
    listRequest: (page = 1) => {
      const params: Record<string, string | number | undefined> = { page, limit: 10 };
      if (search) params.search = search;
      if (sortColumn) {
        params.sortBy = sortColumn;
        params.sortOrder = sortDirection;
      }
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      return api.get('/branches', { params });
    },
    detailRequest: (id) => api.get(`/branches/${id}`),
    createRequest: (payload) => api.post('/branches', payload),
    updateRequest: (id, payload) => api.patch(`/branches/${id}`, payload),
    mapRecordToForm: (detail) => ({
      companyId: safeString(detail.companyId),
      name: safeString(detail.name),
      address: safeString(detail.address),
      phone: safeString(detail.phone),
    }),
    mapFormToPayload: (currentForm) => ({ ...currentForm }),
    validate: (currentForm) => currentForm.name.trim() && currentForm.companyId.trim()
      ? null
      : t('validation.required'),
    errorMessage: (operation: CrudOperation) => {
      if (operation === 'list' || operation === 'detail') return t('errors.loadFailed');
      return operation === 'create' ? t('errors.createFailed') : t('errors.updateFailed');
    },
    onError: (message, operation) => {
      if (operation !== 'list') setValidationErrors({ form: message });
    },
    onSuccess: (operation) => {
      showToast(operation === 'create' ? t('common.successCreated') : t('common.successUpdated'), 'success');
    },
  });

  const paginationMeta = meta ?? INITIAL_META;

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(paginationMeta.page),
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

  const confirmStatusChange = (id: string, action: 'activate' | 'deactivate') => {
    setSelectedId(id);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleStatusChange = async () => {
    setStatusSaving(true);
    try {
      const status = confirmAction === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await api.patch(`/branches/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(paginationMeta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setStatusSaving(false);
    }
  };

  const baseColumns: GridColumn<Branch>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('common.name'), sortable: true, filterable: true },
    { key: 'company', header: t('core.company'), sortable: true, render: (b) => b.company?.name || '-' },
    { key: 'address', header: t('common.address'), sortable: true, render: (b) => b.address || '-' },
    { key: 'phone', header: t('common.phone'), sortable: true, render: (b) => b.phone || '-' },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('common.active') },
      { value: 'INACTIVE', label: t('common.inactive') },
    ], render: (b) => <StatusBadge status={b.status} /> },
  ];

  const gridActions: GridAction<Branch>[] = [
    { label: t('grid.view'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (b) => router.push(`/admin/core/branches/${b.id}`) },
    { label: t('grid.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (b) => openEdit(b) },
    { label: t('common.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, onClick: (b) => confirmStatusChange(b.id, 'activate'), enabled: (b) => b.status !== 'ACTIVE' },
    { label: t('common.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, variant: 'danger', onClick: (b) => confirmStatusChange(b.id, 'deactivate'), enabled: (b) => b.status === 'ACTIVE' },
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

  const handleRowClick = useCallback((item: any) => {
    setSelectedBranch(item);
    setSelectedId(item.id);
    setActiveSection('overview');
    setDrawerOpen(true);
    fetchDrawerDepartments(item.id);
    fetchDrawerUsers(item.id);
    fetchDrawerWarehouses(item.id);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedBranch(null);
    setActiveSection('overview');
  }, []);

  useEffect(() => {
    return () => closeDrawer();
  }, [pathname, searchParams, closeDrawer]);

  useEffect(() => {
    if (selectedBranch && drawerOpen && data.length > 0) {
      const exists = data.some((d: any) => d.id === selectedBranch.id);
      if (!exists) closeDrawer();
    }
  }, [data, selectedBranch, drawerOpen, closeDrawer]);

  const fetchDrawerDepartments = useCallback(async (branchId: string) => {
    setDrawerDepartmentsLoading(true);
    try {
      const res = await api.get<{ data: any[] }>('/departments', { params: { branchId, limit: 50 } });
      setDrawerDepartments(res.data || []);
    } catch { /* ignore */ } finally { setDrawerDepartmentsLoading(false); }
  }, []);

  const fetchDrawerUsers = useCallback(async (branchId: string) => {
    setDrawerUsersLoading(true);
    try {
      const res = await api.get<{ data: any[] }>('/users', { params: { branchId, limit: 50 } });
      setDrawerUsers(res.data || []);
    } catch { /* ignore */ } finally { setDrawerUsersLoading(false); }
  }, []);

  const fetchDrawerWarehouses = useCallback(async (branchId: string) => {
    setDrawerWarehousesLoading(true);
    try {
      const res = await api.get<{ data: any[] }>('/warehouses', { params: { branchId, limit: 50 } });
      setDrawerWarehouses(res.data || []);
    } catch { /* ignore */ } finally { setDrawerWarehousesLoading(false); }
  }, []);

  const drawerNavItems = [
    { id: 'overview', label: t('workspace.overview'), icon: overviewIcon },
    { id: 'departments', label: t('workspace.departments'), icon: peopleIcon },
    { id: 'users', label: t('workspace.users'), icon: userIcon },
    { id: 'warehouses', label: t('workspace.warehouses'), icon: warehouseIcon },
  ];

  const drawerSections: DrawerSection[] = [
    {
      id: 'overview',
      label: t('workspace.overview'),
      content: selectedBranch ? (
        <div className="space-y-4">
          <div className="bg-teal-50/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.code')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedBranch.code}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.name')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedBranch.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('core.company')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedBranch.company?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.address')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedBranch.address || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.phone')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedBranch.phone || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.status')}</span>
              <StatusBadge status={selectedBranch.status} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-teal-700">{drawerDepartments.length}</div>
              <div className="text-xs text-gray-500">{t('workspace.departments')}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-teal-700">{drawerUsers.length}</div>
              <div className="text-xs text-gray-500">{t('workspace.users')}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-teal-700">{drawerWarehouses.length}</div>
              <div className="text-xs text-gray-500">{t('workspace.warehouses')}</div>
            </div>
          </div>
        </div>
      ) : null,
    },
    {
      id: 'departments',
      label: t('workspace.departments'),
      content: drawerDepartmentsLoading ? <LoadingState /> : drawerDepartments.length === 0 ? <EntityEmptyState title={t('workspace.noRelatedDepartments')} /> : (
        <div className="space-y-2">
          {drawerDepartments.map((item: any) => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-100 hover:border-teal-200 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.code}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'users',
      label: t('workspace.users'),
      content: drawerUsersLoading ? <LoadingState /> : drawerUsers.length === 0 ? <EntityEmptyState title={t('workspace.noRelatedUsers')} /> : (
        <div className="space-y-2">
          {drawerUsers.map((item: any) => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-100 hover:border-teal-200 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name || item.username || item.email}</p>
                <p className="text-xs text-gray-500">{item.email || item.username}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'warehouses',
      label: t('workspace.warehouses'),
      content: drawerWarehousesLoading ? <LoadingState /> : drawerWarehouses.length === 0 ? <EntityEmptyState title={t('workspace.noRelatedWarehouses')} /> : (
        <div className="space-y-2">
          {drawerWarehouses.map((item: any) => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-100 hover:border-teal-200 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.code}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <EntityWorkspaceLayout drawerOpen={drawerOpen} drawer={
      <EntityDetailDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={selectedBranch?.name || ''}
        subtitle={selectedBranch?.code || ''}
        statusBadge={selectedBranch && <StatusBadge status={selectedBranch.status} />}
        sections={drawerSections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        navItems={drawerNavItems}
        dir={dir}
      />
    }>
      <EntityPageHeader title={t('core.branches')} icon={branchIcon} />
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
          onRefresh={() => fetchData(paginationMeta.page)}
          refreshLoading={loading}
        />
      )}
      {data.length > 0 && (
        <div className="mt-3">
          <Pagination page={paginationMeta.page} totalPages={paginationMeta.totalPages} total={paginationMeta.total} onPageChange={fetchData} />
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { closeFormModal(); setValidationErrors({}); }} title={editItem ? t('core.editBranch') : t('core.newBranch')}>
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          {validationErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.form}</div>}
          <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { closeFormModal(); setValidationErrors({}); }}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>}
      </Modal>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)}
        onConfirm={handleStatusChange}
        title={confirmAction === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={confirmAction === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
        variant={confirmAction === 'activate' ? 'primary' : 'danger'} loading={statusSaving} />
    </EntityWorkspaceLayout>
  );
}
