'use client';
import React, { useState, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { safeString } from '../../../../lib/form-utils';
import { useCrudList, CrudOperation } from '../../../../hooks/useCrudList';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Company, PaginationMeta } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Card, Pagination, PageHeader, LoadingState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

interface CompanyForm {
  name: string;
  legalName: string;
  taxNumber: string;
  phone: string;
  email: string;
  address: string;
}

const EMPTY_COMPANY_FORM: CompanyForm = {
  name: '',
  legalName: '',
  taxNumber: '',
  phone: '',
  email: '',
  address: '',
};

const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

export default function CompaniesPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate'>('deactivate');
  const [statusSaving, setStatusSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');

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
  } = useCrudList<Company, CompanyForm, CompanyForm, PaginationMeta, [page?: number]>({
    initialForm: EMPTY_COMPANY_FORM,
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
      return api.get('/companies', { params });
    },
    detailRequest: (id) => api.get(`/companies/${id}`),
    createRequest: (payload) => api.post('/companies', payload),
    updateRequest: (id, payload) => api.patch(`/companies/${id}`, payload),
    deleteRequest: (id) => api.delete(`/companies/${id}`),
    mapRecordToForm: (detail) => ({
      name: safeString(detail.name),
      legalName: safeString(detail.legalName),
      taxNumber: safeString(detail.taxNumber),
      phone: safeString(detail.phone),
      email: safeString(detail.email),
      address: safeString(detail.address),
    }),
    mapFormToPayload: (currentForm) => ({ ...currentForm }),
    validate: (currentForm) => currentForm.name.trim() ? null : t('validation.required'),
    errorMessage: (operation: CrudOperation) => {
      if (operation === 'list' || operation === 'detail') return t('errors.loadFailed');
      if (operation === 'delete') return t('errors.deleteFailed');
      return operation === 'create' ? t('errors.createFailed') : t('errors.updateFailed');
    },
    onError: (message, operation) => {
      if (operation !== 'list') showToast(message, 'error');
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

  const selectedRecord = useMemo(() => data.find(c => c.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    delete: () => selectedRecord && requestDelete(selectedRecord),
    refresh: () => fetchData(paginationMeta.page),
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

  const confirmStatusChange = (id: string, action: 'activate' | 'deactivate') => {
    setSelectedId(id);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleStatusChange = async () => {
    setStatusSaving(true);
    try {
      const status = confirmAction === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await api.patch(`/companies/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(paginationMeta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setStatusSaving(false);
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
    { label: t('grid.delete'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, variant: 'danger', onClick: requestDelete },
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
          onRefresh={() => fetchData(paginationMeta.page)}
          refreshLoading={loading}
        />
      )}
      {data.length > 0 && (
        <div className="mt-3">
          <Pagination page={paginationMeta.page} totalPages={paginationMeta.totalPages} total={paginationMeta.total} onPageChange={fetchData} />
        </div>
      )}

      <Modal open={modalOpen} onClose={closeFormModal} title={editItem ? t('core.editCompany') : t('core.newCompany')}>
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('core.legalName')} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
          <Input label={t('core.taxNumber')} value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
          <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label={t('common.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={closeFormModal}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleStatusChange}
        title={confirmAction === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={confirmAction === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
        variant={confirmAction === 'activate' ? 'primary' : 'danger'}
        loading={statusSaving}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={cancelDelete}
        onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')}
        message={t('common.confirmDeleteMessage')}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
