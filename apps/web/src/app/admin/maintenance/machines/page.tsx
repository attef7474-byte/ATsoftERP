'use client';
import React, { useState, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useCrudList, CrudOperation } from '../../../../hooks/useCrudList';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Machine } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Pagination, PageHeader, StatusBadge, ConfirmDialog, Modal, Button, LoadingState } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../lib/form-validation';
import { MachineForm, MachineFormState, createMachineForm, mapMachineToForm, isMachineReadOnly, machineFormFieldErrors, machineDedicatedCcPayload } from './machine-form';

interface MachinePayload {
  name?: string;
  categoryId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  productionLineId?: string | null;
  operationTypeId?: string | null;
  dedicatedCostCenter?: { name: string; type: string; description?: string } | null;
  model?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  location?: string | null;
  notes?: string | null;
}

const INITIAL_META = { page: 1, limit: 10, total: 0, totalPages: 0 };

export default function MachinesPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [search, setSearch] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [statusSaving, setStatusSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate'>('deactivate');
  const [selectedId, setSelectedId] = useState('');

  const {
    data,
    meta,
    loading,
    error,
    form,
    setForm,
    modalOpen,
    selectedMode,
    editItem,
    detailLoading,
    saving,
    refresh: fetchData,
    openCreate,
    openEdit,
    closeFormModal,
    handleSave,
  } = useCrudList<Machine, MachineFormState, MachinePayload, typeof INITIAL_META, [page?: number]>({
    initialForm: createMachineForm,
    initialMeta: INITIAL_META,
    initialListArgs: [1],
    listRequest: (page = 1) => {
      const params: Record<string, string | number | undefined> = { page, limit: 10 };
      if (search) params.search = search;
      return api.get('/maintenance/machines', { params });
    },
    detailRequest: (id) => api.get(`/maintenance/machines/${id}`),
    createRequest: (payload) => api.post('/maintenance/machines', payload),
    updateRequest: (id, payload) => api.patch(`/maintenance/machines/${id}`, payload),
    mapRecordToForm: (detail) => mapMachineToForm(detail),
    mapFormToPayload: (currentForm, context) => {
      if (context.mode === 'create') {
        const payload: MachinePayload = { name: currentForm.name.trim() };
        if (currentForm.categoryId) payload.categoryId = currentForm.categoryId;
        if (currentForm.companyId) payload.companyId = currentForm.companyId;
        if (currentForm.branchId) payload.branchId = currentForm.branchId;
        if (currentForm.departmentId) payload.departmentId = currentForm.departmentId;
        if (currentForm.productionLineId) payload.productionLineId = currentForm.productionLineId;
        if (currentForm.operationTypeId) payload.operationTypeId = currentForm.operationTypeId;
        const dedicatedCostCenter = machineDedicatedCcPayload(currentForm);
        if (dedicatedCostCenter) payload.dedicatedCostCenter = dedicatedCostCenter;
        if (currentForm.model.trim()) payload.model = currentForm.model.trim();
        if (currentForm.serialNumber.trim()) payload.serialNumber = currentForm.serialNumber.trim();
        if (currentForm.manufacturer.trim()) payload.manufacturer = currentForm.manufacturer.trim();
        if (currentForm.location.trim()) payload.location = currentForm.location.trim();
        if (currentForm.notes.trim()) payload.notes = currentForm.notes.trim();
        return payload;
      }
      const detail = context.record as Machine;
      const payload: MachinePayload = {};
      if (currentForm.name.trim() !== detail?.name) payload.name = currentForm.name.trim();
      if (currentForm.categoryId !== detail?.categoryId) payload.categoryId = currentForm.categoryId || null;
      if (currentForm.companyId !== detail?.companyId) payload.companyId = currentForm.companyId || null;
      if (currentForm.branchId !== detail?.branchId) payload.branchId = currentForm.branchId || null;
      if (currentForm.departmentId !== detail?.departmentId) payload.departmentId = currentForm.departmentId || null;
      if (currentForm.productionLineId !== detail?.productionLineId) payload.productionLineId = currentForm.productionLineId || null;
      if (currentForm.operationTypeId !== detail?.operationTypeId) payload.operationTypeId = currentForm.operationTypeId || null;
      // Legacy machines without a cost center attach one on edit (atomic), but
      // an existing cost center is preserved and never replaced.
      if (!detail?.defaultCostCenterId) {
        const dedicatedCostCenter = machineDedicatedCcPayload(currentForm);
        if (dedicatedCostCenter) payload.dedicatedCostCenter = dedicatedCostCenter;
      }
      if (currentForm.model !== detail?.model) payload.model = currentForm.model.trim() || null;
      if (currentForm.serialNumber !== detail?.serialNumber) payload.serialNumber = currentForm.serialNumber.trim() || null;
      if (currentForm.manufacturer !== detail?.manufacturer) payload.manufacturer = currentForm.manufacturer.trim() || null;
      if (currentForm.location !== detail?.location) payload.location = currentForm.location.trim() || null;
      if (currentForm.notes !== detail?.notes) payload.notes = currentForm.notes.trim() || null;
      return payload;
    },
    validate: (currentForm, context) => {
      const errs = machineFormFieldErrors(currentForm, t, context.mode, (context.record as Machine)?.defaultCostCenterId);
      const keys = Object.keys(errs);
      if (keys.length === 0) return null;
      return { message: errs[keys[0]], fieldErrors: errs };
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
      showToast(operation === 'create' ? t('complexForms.recordCreated') : t('complexForms.recordUpdated'), 'success');
    },
  });

  const paginationMeta = meta ?? INITIAL_META;
  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => { if (selectedRecord) openEdit(selectedRecord); },
    delete: () => setConfirmDeleteOpen(true),
    refresh: () => fetchData(paginationMeta.page),
    activate: () => confirmStatus(selectedId, 'activate'),
    deactivate: () => confirmStatus(selectedId, 'deactivate'),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
  ]);

  const confirmStatus = (id: string, action: 'activate' | 'deactivate') => {
    setSelectedId(id);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleStatusChange = async () => {
    setStatusSaving(true);
    try {
      if (confirmAction === 'activate') {
        await api.patch(`/maintenance/machines/${selectedId}/activate`);
      } else {
        await api.patch(`/maintenance/machines/${selectedId}/deactivate`);
      }
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(paginationMeta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally { setStatusSaving(false); }
  };

  const handleDelete = async () => {
    setStatusSaving(true);
    try {
      await api.delete(`/maintenance/machines/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false);
      setSelectedId('');
      fetchData(paginationMeta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally { setStatusSaving(false); }
  };

  const columns: GridColumn<Machine>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'category', header: t('maintenance.machineCategory'), render: (m: Machine) => m.category?.name || '-' },
    { key: 'productionLine', header: t('maintenance.productionLine'), render: (m: Machine) => m.productionLine?.name || '-' },
    { key: 'operationType', header: t('maintenance.operationType'), render: (m: Machine) => m.operationType?.name || '-' },
    { key: 'costCenter', header: t('maintenance.costCenter'), render: (m: Machine) => m.defaultCostCenter?.name || '-' },
    { key: 'status', header: t('common.status'), render: (m: Machine) => <StatusBadge status={m.status} /> },
  ];

  const gridActions: GridAction<Machine>[] = [
    { label: t('details.viewDetails'), onClick: (m: Machine) => router.push(`/admin/maintenance/machines/${m.id}`) },
    { label: t('actions.edit'), onClick: (m: Machine) => openEdit(m) },
    { label: t('actions.deactivate'), onClick: (m: Machine) => confirmStatus(m.id, 'deactivate'), enabled: (m: Machine) => m.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (m: Machine) => confirmStatus(m.id, 'activate'), enabled: (m: Machine) => m.status !== 'ACTIVE' },
    { label: t('common.delete'), onClick: (m: Machine) => { setSelectedId(m.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
  ];

  const editRecord = editItem as Machine | null;
  const editReadOnly = selectedMode === 'edit' && editRecord ? isMachineReadOnly(editRecord.status) : false;

  return (
    <div>
      <PageHeader title={t('maintenance.machines')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(m: Machine) => m.id}
        onRowClick={(m: Machine) => setSelectedId(m.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(paginationMeta.page)}
        actions={gridActions}
        dir={dir}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(paginationMeta.page)}
        refreshLoading={loading}
      />
      {data.length > 0 && (
        <Pagination page={paginationMeta.page} totalPages={paginationMeta.totalPages} total={paginationMeta.total} onPageChange={fetchData} />
      )}

      <Modal open={modalOpen} onClose={() => { closeFormModal(); setValidationErrors({}); }} title={selectedMode === 'edit' ? t('maintenance.editMachine') : t('maintenance.newMachine')} size="lg">
        {detailLoading ? <LoadingState /> : (
          <div className="space-y-4">
            {validationErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.form}</div>}
            <MachineForm
              form={form}
              setForm={setForm}
              errors={validationErrors}
              mode={selectedMode === 'edit' ? 'edit' : 'create'}
              isReadOnly={editReadOnly}
              status={editRecord?.status}
              createdAt={editRecord?.createdAt}
              updatedAt={editRecord?.updatedAt}
              existingCostCenterName={editRecord?.defaultCostCenter?.name}
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button variant="secondary" onClick={() => { closeFormModal(); setValidationErrors({}); }}>{t('actions.cancel')}</Button>
              <Button onClick={handleSave} loading={saving} disabled={editReadOnly}>{t('actions.save')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={statusSaving} />
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleStatusChange}
        title={confirmAction === 'deactivate' ? t('common.confirmDeactivateTitle') : t('common.confirmActivateTitle')}
        message={confirmAction === 'deactivate' ? t('common.confirmDeactivateMessage') : t('common.confirmActivateMessage')}
        variant={confirmAction === 'deactivate' ? 'danger' : 'primary'} loading={statusSaving} />
    </div>
  );
}
