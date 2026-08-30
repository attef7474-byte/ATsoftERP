'use client';
import React, { useState, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { safeString } from '../../../../lib/form-utils';
import { useCrudList, CrudOperation } from '../../../../hooks/useCrudList';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { OperationalPerson, PaginationMeta } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Modal, Pagination, ConfirmDialog } from '../../../../components/admin/ui';
import { GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, departmentAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';
import { EntityWorkspaceLayout, EntityPageHeader, EntityDataTable, EntityEmptyState } from '../../../../components/entity';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../lib/form-validation';

const EMPLOYEE_CATEGORIES = ['OPERATIONAL', 'MAINTENANCE'];

interface EmployeeForm {
  code: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  notes: string;
  departmentId: string;
}

interface EmployeePayload {
  code: string;
  name: string;
  category?: string;
  phone?: string;
  email?: string;
  notes?: string;
  departmentId?: string;
}

const EMPTY_EMPLOYEE_FORM: EmployeeForm = { code: '', name: '', category: 'MAINTENANCE', phone: '', email: '', notes: '', departmentId: '' };
const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

const employeeIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

function EmployeeStatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
      {label}
    </span>
  );
}

export default function EmployeesPage() {
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
  const [deleteError, setDeleteError] = useState('');

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
  } = useCrudList<OperationalPerson, EmployeeForm, EmployeePayload, PaginationMeta, [page?: number]>({
    initialForm: EMPTY_EMPLOYEE_FORM,
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
      return api.get('/employees', { params });
    },
    detailRequest: (id) => api.get(`/employees/${id}`),
    createRequest: (payload) => api.post('/employees', payload),
    updateRequest: (id, payload) => api.patch(`/employees/${id}`, payload),
    deleteRequest: (id) => api.delete(`/employees/${id}`),
    mapRecordToForm: (detail) => ({
      code: safeString(detail.code),
      name: safeString(detail.name),
      category: safeString(detail.category) || 'MAINTENANCE',
      phone: safeString(detail.phone),
      email: safeString(detail.email),
      notes: safeString(detail.notes),
      departmentId: '',
    }),
    mapFormToPayload: (currentForm) => ({
      code: currentForm.code.trim(),
      name: currentForm.name,
      category: currentForm.category || 'MAINTENANCE',
      ...(currentForm.phone.trim() ? { phone: currentForm.phone.trim() } : {}),
      ...(currentForm.email.trim() ? { email: currentForm.email.trim() } : {}),
      ...(currentForm.notes.trim() ? { notes: currentForm.notes.trim() } : {}),
      ...(currentForm.departmentId ? { departmentId: currentForm.departmentId } : {}),
    }),
    validate: (currentForm) => {
      const fieldErrors: Record<string, string> = {};
      if (!currentForm.code.trim()) fieldErrors.code = t('validation.required');
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
      if (operation === 'delete') {
        setDeleteError(message);
        handleApiError(thrown, { dialog: true });
        return;
      }
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
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.isActive === false) },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.isActive === true) },
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
      const endpoint = confirmAction === 'activate' ? 'activate' : 'deactivate';
      await api.post(`/employees/${selectedId}/${endpoint}`);
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(paginationMeta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setStatusSaving(false);
    }
  };

  const baseColumns: GridColumn<OperationalPerson>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('common.name'), sortable: true, filterable: true },
    { key: 'category', header: t('core.personCategory'), sortable: true, filterable: true, filterType: 'select', filterOptions: EMPLOYEE_CATEGORIES.map((c) => ({ value: c, label: t(`core.employeeCategories.${c}`) })), render: (d) => <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{t(`core.employeeCategories.${d.category || 'MAINTENANCE'}`)}</span> },
    { key: 'phone', header: t('common.phone'), render: (d) => d.phone || '-' },
    { key: 'email', header: t('common.email'), render: (d) => d.email || '-' },
    { key: 'isActive', header: t('common.status'), filterable: true, filterType: 'select', filterOptions: [
      { value: 'true', label: t('common.active') },
      { value: 'false', label: t('common.inactive') },
    ], render: (d) => <EmployeeStatusBadge active={d.isActive} label={d.isActive ? t('common.active') : t('common.inactive')} /> },
  ];

  const gridActions: GridAction<OperationalPerson>[] = [
    { label: t('grid.view'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (d) => router.push(`/admin/core/persons/${d.id}`) },
    { label: t('grid.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (d) => openEdit(d) },
    { label: t('common.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, onClick: (d) => confirmStatusChange(d.id, 'activate'), enabled: (d) => d.isActive === false },
    { label: t('common.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, variant: 'danger', onClick: (d) => confirmStatusChange(d.id, 'deactivate'), enabled: (d) => d.isActive === true },
    { label: t('grid.delete'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, variant: 'danger', onClick: (d) => { setDeleteError(''); requestDelete(d); } },
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
    <EntityWorkspaceLayout drawerOpen={false}>
      <EntityPageHeader title={t('core.persons')} icon={employeeIcon} />
      {error && <div className="text-center py-12"><p className="text-red-500 mb-4">{error}</p></div>}
      {!error && loading && data.length === 0 && <div className="py-12" />}
      {!error && !loading && data.length === 0 && (
        <EntityEmptyState title={t('common.noData')} />
      )}
      {(!error || !loading) && data.length > 0 && (
        <EntityDataTable
          columns={baseColumns}
          data={data}
          keyExtractor={(item) => item.id}
          selectedKey={selectedId}
          onRowClick={(item) => setSelectedId(item.id)}
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

      <Modal open={modalOpen} onClose={() => { closeFormModal(); setValidationErrors({}); }} title={editItem ? t('core.editEmployee') : t('core.newEmployee')}>
        {detailLoading ? <div className="py-6" /> : <div className="space-y-4">
          {validationErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.form}</div>}
          <Input label={t('common.code')} name="code" value={form.code} onChange={(e) => { setForm({ ...form, code: e.target.value }); setValidationErrors(prev => ({ ...prev, code: '' })); }} error={validationErrors.code} required />
          <Input label={t('common.name')} name="name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} error={validationErrors.name} required />
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.personCategory')}</label>
            <select value={form.category} onChange={(e) => { setForm({ ...form, category: e.target.value }); setValidationErrors(prev => ({ ...prev, category: '' })); }} className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: validationErrors.category ? '#fca5a5' : undefined }}>
              {EMPLOYEE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`core.employeeCategories.${c}`)}</option>)}
            </select>
            {validationErrors.category && <p className="text-sm text-red-500 mt-1">{validationErrors.category}</p>}
          </div>
          <Input label={t('common.phone')} name="phone" value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setValidationErrors(prev => ({ ...prev, phone: '' })); }} error={validationErrors.phone} />
          <Input label={t('common.email')} name="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setValidationErrors(prev => ({ ...prev, email: '' })); }} error={validationErrors.email} />
          <Input label={t('common.notes')} name="notes" value={form.notes} onChange={(e) => { setForm({ ...form, notes: e.target.value }); setValidationErrors(prev => ({ ...prev, notes: '' })); }} error={validationErrors.notes} />
          {!editItem && (
            <>
              <F9Lookup label={t('core.initialPlacement')} name="departmentId" value={form.departmentId} onChange={(v) => { setForm({ ...form, departmentId: v }); setValidationErrors(prev => ({ ...prev, departmentId: '' })); }} adapter={departmentAdapter} error={validationErrors.departmentId} />
              <p className="text-xs text-gray-500">{t('core.createAssignmentHint')}</p>
            </>
          )}
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

      <ConfirmDialog open={deleteConfirmOpen} onClose={() => { cancelDelete(); setDeleteError(''); }}
        onConfirm={handleDelete}
        title={t('core.confirmDeleteEmployeeTitle')}
        message={t('core.confirmDeleteEmployeeMessage')}
        variant="danger" loading={deleting}>
        {deleteError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{deleteError}</div>
        )}
      </ConfirmDialog>
    </EntityWorkspaceLayout>
  );
}
