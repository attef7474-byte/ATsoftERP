'use client';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { safeString } from '../../../../lib/form-utils';
import { useCrudList, CrudOperation } from '../../../../hooks/useCrudList';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Department, PaginationMeta } from '../../../../lib/admin-types';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button, Input, Card, Pagination, LoadingState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, companyAdapter, branchAdapter, administrationAdapter, departmentAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { EntityWorkspaceLayout, EntityPageHeader, EntityDataTable, EntityDetailDrawer, EntityEmptyState, useDrawerSectionData, type DrawerSection } from '../../../../components/entity';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../lib/form-validation';

interface DepartmentForm {
  companyId: string;
  branchId: string;
  administrationId: string;
  parentId: string;
  code: string;
  name: string;
  classification: string;
}

interface DepartmentPayload {
  companyId: string;
  name: string;
  code?: string;
  branchId?: string;
  administrationId?: string;
  parentId?: string;
  classification?: string;
}

const EMPTY_DEPARTMENT_FORM: DepartmentForm = { companyId: '', branchId: '', administrationId: '', parentId: '', code: '', name: '', classification: 'OPERATIONAL' };
const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

const overviewIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const userIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const deptIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

export default function DepartmentsPage() {
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

  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  // Users API has no departmentId filter (departmentId is dropped), so the
  // section is scoped by the department's company.
  const selectedDepartmentCompanyId = selectedDepartment?.companyId || selectedDepartment?.company?.id || null;

  const drawerUsers = useDrawerSectionData<any>(selectedDepartmentCompanyId, async (companyId) => {
    const res = await api.get<{ data: any[] }>('/users', { params: { companyId, limit: 50 } });
    return res.data || [];
  });

  useEffect(() => {
    if (drawerUsers.error) {
      handleApiError(drawerUsers.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerUsers.error, handleApiError]);

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
  } = useCrudList<Department, DepartmentForm, DepartmentPayload, PaginationMeta, [page?: number]>({
    initialForm: EMPTY_DEPARTMENT_FORM,
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
      return api.get('/departments', { params });
    },
    detailRequest: (id) => api.get(`/departments/${id}`),
    createRequest: (payload) => api.post('/departments', payload),
    updateRequest: (id, payload) => api.patch(`/departments/${id}`, payload),
    mapRecordToForm: (detail) => ({
      companyId: safeString(detail.companyId),
      branchId: safeString(detail.branchId),
      administrationId: safeString(detail.administrationId),
      parentId: safeString(detail.parentId),
      code: safeString(detail.code),
      name: safeString(detail.name),
      classification: safeString(detail.classification || 'OPERATIONAL'),
    }),
    mapFormToPayload: (currentForm) => ({
      companyId: currentForm.companyId,
      name: currentForm.name,
      ...(currentForm.code.trim() ? { code: currentForm.code.trim() } : {}),
      ...(currentForm.branchId ? { branchId: currentForm.branchId } : {}),
      ...(currentForm.administrationId ? { administrationId: currentForm.administrationId } : {}),
      ...(currentForm.parentId ? { parentId: currentForm.parentId } : {}),
      ...(currentForm.classification ? { classification: currentForm.classification } : {}),
    }),
    validate: (currentForm) => {
      const fieldErrors: Record<string, string> = {};
      if (!currentForm.companyId.trim()) fieldErrors.companyId = t('validation.required');
      if (!currentForm.name.trim()) fieldErrors.name = t('validation.required');
      if (Object.keys(fieldErrors).length > 0) {
        return { message: t('validation.required'), fieldErrors };
      }
      return null;
    },
    errorMessage: (operation: CrudOperation) => {
      if (operation === 'list' || operation === 'detail') return t('errors.loadFailed');
      return operation === 'create' ? t('errors.createFailed') : t('errors.updateFailed');
    },
    onError: (message, operation) => {
      if (operation !== 'list') setValidationErrors({ form: message });
    },
    onFieldErrors: (errors) => {
      setValidationErrors(adaptFieldErrorsToMap(errors));
      focusFirstInvalidField(errors);
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
      await api.patch(`/departments/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(paginationMeta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setStatusSaving(false);
    }
  };

  const baseColumns: GridColumn<Department>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('common.name'), sortable: true, filterable: true },
    { key: 'classification', header: t('core.classification'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'OPERATIONAL', label: t('core.classifications.OPERATIONAL') },
      { value: 'MANAGEMENT', label: t('core.classifications.MANAGEMENT') },
      { value: 'AREA', label: t('core.classifications.AREA') },
      { value: 'PROCESS', label: t('core.classifications.PROCESS') },
      { value: 'SECTION', label: t('core.classifications.SECTION') },
      { value: 'UNIT', label: t('core.classifications.UNIT') },
      { value: 'WORKSHOP', label: t('core.classifications.WORKSHOP') },
    ], render: (d) => <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{t(`core.classifications.${d.classification || 'OPERATIONAL'}`)}</span> },
    { key: 'company', header: t('core.company'), sortable: true, render: (d) => d.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), sortable: true, render: (d) => d.branch?.name || '-' },
    { key: 'administration', header: t('core.administration'), sortable: true, render: (d) => d.administration?.name || '-' },
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

  const handleRowClick = useCallback((item: any) => {
    setSelectedDepartment(item);
    setSelectedId(item.id);
    setActiveSection('overview');
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedDepartment(null);
    setActiveSection('overview');
  }, []);

  useEffect(() => {
    return () => closeDrawer();
  }, [pathname, searchParams, closeDrawer]);

  useEffect(() => {
    if (selectedDepartment && drawerOpen && data.length > 0) {
      const exists = data.some((d: any) => d.id === selectedDepartment.id);
      if (!exists) closeDrawer();
    }
  }, [data, selectedDepartment, drawerOpen, closeDrawer]);

  const drawerNavItems = [
    { id: 'overview', label: t('workspace.overview'), icon: overviewIcon },
    { id: 'users', label: t('workspace.users'), icon: userIcon },
  ];

  const drawerSections: DrawerSection[] = [
    {
      id: 'overview',
      label: t('workspace.overview'),
      content: selectedDepartment ? (
        <div className="space-y-4">
          <div className="bg-[var(--ws-soft)] border border-[var(--ws-border)] rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.code')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedDepartment.code}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.name')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedDepartment.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('core.company')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedDepartment.company?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('core.branch')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedDepartment.branch?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('core.administration')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedDepartment.administration?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('core.parentDepartment')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedDepartment.parent?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.status')}</span>
              <StatusBadge status={selectedDepartment.status} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('core.classification')}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{t(`core.classifications.${selectedDepartment.classification || 'OPERATIONAL'}`)}</span>
            </div>
          </div>
          <div className="bg-[var(--ws-soft)] border border-[var(--ws-border)] rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-[var(--ws-primary)]">{drawerUsers.loading ? '—' : drawerUsers.data.length}</div>
            <div className="text-xs text-gray-500">{t('workspace.users')}</div>
          </div>
        </div>
      ) : null,
    },
    {
      id: 'users',
      label: t('workspace.users'),
      content: drawerUsers.loading ? <LoadingState /> : drawerUsers.loaded && drawerUsers.data.length === 0 ? <EntityEmptyState title={t('workspace.noRelatedUsers')} /> : (
        <div className="space-y-2">
          {drawerUsers.data.map((item: any) => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-[var(--ws-border)] hover:border-[var(--ws-accent)] transition-colors">
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
  ];

  return (
    <EntityWorkspaceLayout drawerOpen={drawerOpen} drawer={
      <EntityDetailDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={selectedDepartment?.name || ''}
        subtitle={selectedDepartment?.code || ''}
        statusBadge={selectedDepartment && <StatusBadge status={selectedDepartment.status} />}
        sections={drawerSections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        navItems={drawerNavItems}
        dir={dir}
        closeLabel={t('workspace.closePanel')}
      />
    }>
      <EntityPageHeader title={t('core.departments')} icon={deptIcon} />
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

      <Modal open={modalOpen} onClose={() => { closeFormModal(); setValidationErrors({}); }} title={editItem ? t('core.editDepartment') : t('core.newDepartment')}>
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          {validationErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.form}</div>}
          <F9Lookup label={t('core.company')} name="companyId" value={form.companyId} onChange={(v) => { setForm({ ...form, companyId: v, branchId: '', administrationId: '' }); setValidationErrors(prev => ({ ...prev, companyId: '' })); }} adapter={companyAdapter} error={validationErrors.companyId} />
          <F9Lookup label={t('core.branch')} name="branchId" value={form.branchId} onChange={(v) => { setForm({ ...form, branchId: v, administrationId: '' }); setValidationErrors(prev => ({ ...prev, branchId: '' })); }} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} error={validationErrors.branchId} />
          <F9Lookup label={t('core.administration')} name="administrationId" value={form.administrationId} onChange={(v) => { setForm({ ...form, administrationId: v }); setValidationErrors(prev => ({ ...prev, administrationId: '' })); }} adapter={administrationAdapter} filters={form.branchId ? { branchId: form.branchId } : undefined} error={validationErrors.administrationId} />
          <F9Lookup label={t('core.parentDepartment')} name="parentId" value={form.parentId} onChange={(v) => { setForm({ ...form, parentId: v }); setValidationErrors(prev => ({ ...prev, parentId: '' })); }} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} error={validationErrors.parentId} />
          <Input label={t('common.code')} name="code" value={form.code} onChange={(e) => { setForm({ ...form, code: e.target.value }); setValidationErrors(prev => ({ ...prev, code: '' })); }} error={validationErrors.code} />
          <Input label={t('common.name')} name="name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} error={validationErrors.name} required />
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.classification')}</label>
            <select value={form.classification} onChange={(e) => { setForm({ ...form, classification: e.target.value }); setValidationErrors(prev => ({ ...prev, classification: '' })); }} className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: validationErrors.classification ? '#fca5a5' : undefined }}>
              {['OPERATIONAL', 'MANAGEMENT', 'AREA', 'PROCESS', 'SECTION', 'UNIT', 'WORKSHOP'].map((type) => <option key={type} value={type}>{t(`core.classifications.${type}`)}</option>)}
            </select>
            {validationErrors.classification && <p className="text-sm text-red-500 mt-1">{validationErrors.classification}</p>}
          </div>
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
