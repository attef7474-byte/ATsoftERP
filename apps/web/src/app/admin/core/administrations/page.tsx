'use client';
import React, { useState, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { safeString } from '../../../../lib/form-utils';
import { useCrudList, CrudOperation } from '../../../../hooks/useCrudList';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Administration, PaginationMeta } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Pagination, PageHeader, LoadingState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, companyAdapter, branchAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../lib/form-validation';

interface AdministrationForm {
  branchId: string;
  code: string;
  name: string;
  description: string;
}

const EMPTY_FORM: AdministrationForm = { branchId: '', code: '', name: '', description: '' };
const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

export default function AdministrationsPage() {
  const router = useRouter();
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
  } = useCrudList<Administration, AdministrationForm, AdministrationForm, PaginationMeta, [page?: number]>({
    initialForm: EMPTY_FORM,
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
      return api.get('/administrations', { params });
    },
    detailRequest: (id) => api.get(`/administrations/${id}`),
    createRequest: (payload) => api.post('/administrations', payload),
    updateRequest: (id, payload) => api.patch(`/administrations/${id}`, payload),
    mapRecordToForm: (detail) => ({
      branchId: safeString(detail.branchId),
      code: safeString(detail.code),
      name: safeString(detail.name),
      description: safeString(detail.description),
    }),
    mapFormToPayload: (currentForm) => ({
      branchId: currentForm.branchId,
      name: currentForm.name,
      description: currentForm.description,
      code: currentForm.code.trim(),
    }),
    validate: (currentForm) => {
      const fieldErrors: Record<string, string> = {};
      if (!currentForm.branchId.trim()) fieldErrors.branchId = t('validation.required');
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
    onFieldErrors: (errors, operation) => {
      if (operation === 'list' || operation === 'detail') return;
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
      await api.patch(`/administrations/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(paginationMeta.page);
    } catch (err) {
      handleApiError(err);
    } finally {
      setStatusSaving(false);
    }
  };

  const baseColumns: GridColumn<Administration>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('common.name'), sortable: true, filterable: true },
    { key: 'branch', header: t('core.branch'), sortable: true, render: (a) => a.branch?.name || '-' },
    { key: 'description', header: t('common.description'), sortable: false, render: (a) => a.description || '-' },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('common.active') },
      { value: 'INACTIVE', label: t('common.inactive') },
    ], render: (a) => <StatusBadge status={a.status} /> },
  ];

  const gridActions: GridAction<Administration>[] = [
    { label: t('grid.view'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (a) => router.push(`/admin/core/administrations/${a.id}`) },
    { label: t('grid.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (a) => openEdit(a) },
    { label: t('common.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, onClick: (a) => confirmStatusChange(a.id, 'activate'), enabled: (a) => a.status !== 'ACTIVE' },
    { label: t('common.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, variant: 'danger', onClick: (a) => confirmStatusChange(a.id, 'deactivate'), enabled: (a) => a.status === 'ACTIVE' },
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
      <PageHeader title={t('core.administrations')} />
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
          onRefresh={() => fetchData(paginationMeta.page)}
          refreshLoading={loading}
        />
      )}
      {data.length > 0 && (
        <div className="mt-3">
          <Pagination page={paginationMeta.page} totalPages={paginationMeta.totalPages} total={paginationMeta.total} onPageChange={fetchData} />
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { closeFormModal(); setValidationErrors({}); }} title={editItem ? t('core.editAdministration') : t('core.newAdministration')}>
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          {validationErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.form}</div>}
          <F9Lookup label={t('core.branch')} name="branchId" value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} error={validationErrors.branchId} adapter={branchAdapter} />
          <Input label={t('common.code')} name="code" value={form.code} onChange={(e) => { setForm({ ...form, code: e.target.value }); setValidationErrors(prev => ({ ...prev, code: '' })); }} error={validationErrors.code} />
          <Input label={t('common.name')} name="name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} error={validationErrors.name} required />
          <Input label={t('common.description')} name="description" value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); setValidationErrors(prev => ({ ...prev, description: '' })); }} error={validationErrors.description} />
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
    </div>
  );
}
