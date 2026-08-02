'use client';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { safeString } from '../../../../lib/form-utils';
import { useCrudList, CrudOperation } from '../../../../hooks/useCrudList';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { OrganizationalUnit, PaginationMeta } from '../../../../lib/admin-types';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button, Input, Card, Pagination, LoadingState, Modal, StatusBadge, ConfirmDialog, Select } from '../../../../components/admin/ui';
import { GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, organizationalUnitAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';
import { EntityWorkspaceLayout, EntityPageHeader, EntityDataTable, EntityDetailDrawer, EntityEmptyState, type DrawerSection } from '../../../../components/entity';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../lib/form-validation';

const UNIT_TYPES = ['DEPARTMENT', 'SECTION', 'UNIT', 'TEAM', 'PROJECT', 'OTHER'];

interface OrganizationalUnitForm {
  code: string;
  name: string;
  type: string;
  parentId: string;
  status: string;
}

interface OrganizationalUnitPayload {
  name: string;
  code?: string;
  type?: string;
  parentId?: string;
  status?: string;
}

const EMPTY_UNIT_FORM: OrganizationalUnitForm = { code: '', name: '', type: 'DEPARTMENT', parentId: '', status: 'ACTIVE' };
const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

const overviewIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const childrenIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const unitIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

export default function OrganizationalUnitsPage() {
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

  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  const typeOptions = useMemo(
    () => UNIT_TYPES.map((type) => ({ value: type, label: t(`core.unitTypes.${type}`) })),
    [t],
  );

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
    deleting,
    deleteConfirmOpen,
    refresh: fetchData,
    openCreate,
    openEdit,
    closeFormModal,
    requestDelete,
    cancelDelete,
    handleSave,
    handleDelete,
  } = useCrudList<OrganizationalUnit, OrganizationalUnitForm, OrganizationalUnitPayload, PaginationMeta, [page?: number]>({
    initialForm: EMPTY_UNIT_FORM,
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
      return api.get('/organizational-units', { params });
    },
    detailRequest: (id) => api.get(`/organizational-units/${id}`),
    createRequest: (payload) => api.post('/organizational-units', payload),
    updateRequest: (id, payload) => api.patch(`/organizational-units/${id}`, payload),
    deleteRequest: (id) => api.delete(`/organizational-units/${id}`),
    mapRecordToForm: (detail) => ({
      code: safeString(detail.code),
      name: safeString(detail.name),
      type: safeString(detail.type) || 'DEPARTMENT',
      parentId: safeString(detail.parentId),
      status: safeString(detail.status) || 'ACTIVE',
    }),
    mapFormToPayload: (currentForm) => ({
      name: currentForm.name,
      ...(currentForm.code.trim() ? { code: currentForm.code.trim() } : {}),
      type: currentForm.type || 'DEPARTMENT',
      ...(currentForm.parentId ? { parentId: currentForm.parentId } : {}),
      status: currentForm.status || 'ACTIVE',
    }),
    validate: (currentForm) => {
      const fieldErrors: Record<string, string> = {};
      if (!currentForm.name.trim()) fieldErrors.name = t('validation.required');
      if (Object.keys(fieldErrors).length > 0) {
        return { message: t('validation.required'), fieldErrors };
      }
      return null;
    },
    errorMessage: (operation: CrudOperation) => {
      if (operation === 'list' || operation === 'detail') return t('errors.loadFailed');
      if (operation === 'delete') return t('errors.deleteFailed');
      return operation === 'create' ? t('errors.createFailed') : t('errors.updateFailed');
    },
    onError: (message, operation, thrown) => {
      if (operation === 'list' || operation === 'detail') return;
      const config = handleApiError(thrown, { dialog: false });
      if (config.errors && config.errors.length > 0) {
        setValidationErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      } else {
        setValidationErrors({ form: message });
      }
    },
    onFieldErrors: (errors) => {
      setValidationErrors(adaptFieldErrorsToMap(errors));
      focusFirstInvalidField(errors);
    },
    onSuccess: (operation) => {
      const message = operation === 'create'
        ? t('common.successCreated')
        : operation === 'update'
          ? t('common.successUpdated')
          : t('common.successDeleted');
      showToast(message, 'success');
      if (operation === 'delete') setSelectedId('');
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
    delete: () => selectedRecord && requestDelete(selectedRecord),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, onClick: () => exec('delete'), enabled: !!selectedId },
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
      await api.patch(`/organizational-units/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(paginationMeta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setStatusSaving(false);
    }
  };

  const baseColumns: GridColumn<OrganizationalUnit>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('common.name'), sortable: true, filterable: true },
    { key: 'type', header: t('core.unitType'), sortable: true, filterable: true, filterType: 'select', filterOptions: typeOptions, render: (d) => t(`core.unitTypes.${d.type}`) },
    { key: 'parent', header: t('core.parentUnit'), sortable: true, render: (d) => d.parent?.name || '-' },
    { key: 'children', header: t('core.childrenUnits'), sortable: true, render: (d) => d._count?.children ?? 0 },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('common.active') },
      { value: 'INACTIVE', label: t('common.inactive') },
    ], render: (d) => <StatusBadge status={d.status} /> },
  ];

  const gridActions: GridAction<OrganizationalUnit>[] = [
    { label: t('grid.view'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (d) => router.push(`/admin/core/organizational-units/${d.id}`) },
    { label: t('grid.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (d) => openEdit(d) },
    { label: t('common.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, onClick: (d) => confirmStatusChange(d.id, 'activate'), enabled: (d) => d.status !== 'ACTIVE' },
    { label: t('common.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, variant: 'danger', onClick: (d) => confirmStatusChange(d.id, 'deactivate'), enabled: (d) => d.status === 'ACTIVE' },
    { label: t('grid.delete'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, variant: 'danger', onClick: (d) => requestDelete(d) },
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
    setSelectedUnit(item);
    setSelectedId(item.id);
    setActiveSection('overview');
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedUnit(null);
    setActiveSection('overview');
  }, []);

  useEffect(() => {
    return () => closeDrawer();
  }, [pathname, searchParams, closeDrawer]);

  useEffect(() => {
    if (selectedUnit && drawerOpen && data.length > 0) {
      const exists = data.some((d: any) => d.id === selectedUnit.id);
      if (!exists) closeDrawer();
    }
  }, [data, selectedUnit, drawerOpen, closeDrawer]);

  const drawerNavItems = [
    { id: 'overview', label: t('workspace.overview'), icon: overviewIcon },
    { id: 'children', label: t('core.childrenUnits'), icon: childrenIcon },
  ];

  const drawerSections: DrawerSection[] = [
    {
      id: 'overview',
      label: t('workspace.overview'),
      content: selectedUnit ? (
        <div className="space-y-4">
          <div className="bg-[var(--ws-soft)] border border-[var(--ws-border)] rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.code')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedUnit.code}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.name')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedUnit.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('core.unitType')}</span>
              <span className="text-sm font-medium text-gray-900">{t(`core.unitTypes.${selectedUnit.type}`)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('core.parentUnit')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedUnit.parent?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('core.company')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedUnit.company?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('core.branch')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedUnit.branch?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('common.status')}</span>
              <StatusBadge status={selectedUnit.status} />
            </div>
          </div>
        </div>
      ) : null,
    },
    {
      id: 'children',
      label: t('core.childrenUnits'),
      content: !selectedUnit || !selectedUnit.children || selectedUnit.children.length === 0 ? (
        <EntityEmptyState title={t('common.noData')} />
      ) : (
        <div className="space-y-2">
          {selectedUnit.children.map((child: any) => (
            <div key={child.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-[var(--ws-border)] hover:border-[var(--ws-accent)] transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">[{child.code}] {child.name}</p>
              </div>
              <StatusBadge status="ACTIVE" />
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
        title={selectedUnit?.name || ''}
        subtitle={selectedUnit?.code || ''}
        statusBadge={selectedUnit && <StatusBadge status={selectedUnit.status} />}
        sections={drawerSections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        navItems={drawerNavItems}
        dir={dir}
        closeLabel={t('workspace.closePanel')}
      />
    }>
      <EntityPageHeader title={t('core.organizationalUnits')} icon={unitIcon} />
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

      <Modal open={modalOpen} onClose={() => { closeFormModal(); setValidationErrors({}); }} title={editItem ? t('core.editOrganizationalUnit') : t('core.newOrganizationalUnit')}>
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          {validationErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.form}</div>}
          <F9Lookup label={t('core.parentUnit')} name="parentId" value={form.parentId} onChange={(v) => { setForm({ ...form, parentId: v }); setValidationErrors(prev => ({ ...prev, parentId: '' })); }} adapter={organizationalUnitAdapter} error={validationErrors.parentId} />
          <Input label={t('common.code')} name="code" value={form.code} onChange={(e) => { setForm({ ...form, code: e.target.value }); setValidationErrors(prev => ({ ...prev, code: '' })); }} error={validationErrors.code} />
          <Input label={t('common.name')} name="name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} error={validationErrors.name} required />
          <Select label={t('core.unitType')} name="type" value={form.type} onChange={(e) => { setForm({ ...form, type: e.target.value }); setValidationErrors(prev => ({ ...prev, type: '' })); }} options={typeOptions} error={validationErrors.type} />
          <Select label={t('common.status')} name="status" value={form.status} onChange={(e) => { setForm({ ...form, status: e.target.value }); setValidationErrors(prev => ({ ...prev, status: '' })); }} options={[
            { value: 'ACTIVE', label: t('common.active') },
            { value: 'INACTIVE', label: t('common.inactive') },
          ]} error={validationErrors.status} />
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

      <ConfirmDialog open={deleteConfirmOpen} onClose={cancelDelete}
        onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')}
        message={t('common.confirmDeleteMessage')}
        variant="danger" loading={deleting} />
    </EntityWorkspaceLayout>
  );
}
