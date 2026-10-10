'use client';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { plannedPartsPayload, validatePlannedParts, type PlannedPartDraft } from '../../../../lib/work-order-planned-parts';
import { safeString } from '../../../../lib/form-utils';
import { useCrudList, CrudOperation } from '../../../../hooks/useCrudList';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MaintenanceWorkOrder, PaginationMeta } from '../../../../lib/admin-types';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button, Input, Textarea, Card, Pagination, LoadingState, Modal, ConfirmDialog, Select } from '../../../../components/admin/ui';
import { GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, machineAdapter, machineComponentAdapter, productionLineAdapter, costCenterAdapter, warehouseAdapter, userAdapter, sparePartAdapter, productAdapter } from '../../../../components/f9';
import { CmmsStatusBadge } from '../../../../components/maintenance/CmmsStatusBadge';
import { CmmsPriorityBadge } from '../../../../components/maintenance/CmmsPriorityBadge';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';
import { EntityWorkspaceLayout, EntityPageHeader, EntityDataTable, EntityDetailDrawer, type DrawerSection } from '../../../../components/entity';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../lib/form-validation';
import { formatDateTime } from '../../../../lib/i18n/literals';

const WORK_ORDER_TYPES = ['CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE', 'OVERHAUL', 'OTHER'];
const WORK_ORDER_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface WorkOrderForm {
  parts: PlannedPartDraft[];
  title: string;
  description: string;
  type: string;
  priority: string;
  machineId: string;
  machineComponentId: string;
  scopeType: 'MACHINE' | 'PRODUCTION_LINE' | 'GENERAL';
  productionLineId: string;
  workLocation: string;
  costCenterId: string;
  warehouseId: string;
  assignedToId: string;
  supervisorId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  estimatedCost: string;
  notes: string;
}

interface WorkOrderPayload {
  parts?: ReturnType<typeof plannedPartsPayload>['parts'];
  title?: string;
  description?: string;
  type?: string;
  priority?: string;
  machineId?: string;
  machineComponentId?: string;
  scopeType: 'MACHINE' | 'PRODUCTION_LINE' | 'GENERAL';
  productionLineId?: string;
  workLocation?: string;
  costCenterId?: string;
  warehouseId?: string;
  assignedToId?: string;
  supervisorId?: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  estimatedCost?: number;
  notes?: string;
}

const EMPTY_WO_FORM: WorkOrderForm = {
  title: '', description: '', type: 'CORRECTIVE', priority: 'MEDIUM',
  machineId: '', machineComponentId: '', scopeType: 'MACHINE', productionLineId: '', workLocation: '', costCenterId: '', warehouseId: '',
  assignedToId: '', supervisorId: '', plannedStartAt: '', plannedEndAt: '', parts: [],
  estimatedCost: '', notes: '',
};
const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

const workOrderIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const overviewIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const partsIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

const costsIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function MaintenanceWorkOrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, dir } = useTranslation();
  const { user, isSuperAdmin, permissions } = useAuth();
  const can = (key: string) => isSuperAdmin || !!permissions?.permissions.includes(key);
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'plan' | 'start' | 'complete' | 'cancel'>('plan');
  const [cancelReason, setCancelReason] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [selectedWO, setSelectedWO] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  const typeOptions = useMemo(
    () => WORK_ORDER_TYPES.map((type) => ({ value: type, label: t(`status.${type}`) })),
    [t],
  );
  const priorityOptions = useMemo(
    () => WORK_ORDER_PRIORITIES.map((priority) => ({ value: priority, label: t(`status.${priority}`) })),
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
  } = useCrudList<MaintenanceWorkOrder, WorkOrderForm, WorkOrderPayload, PaginationMeta, [page?: number]>({
    initialForm: EMPTY_WO_FORM,
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
      return api.get('/maintenance-work-orders', { params });
    },
    detailRequest: (id) => api.get(`/maintenance-work-orders/${id}`),
    createRequest: (payload) => api.post('/maintenance-work-orders', payload),
    updateRequest: (id, payload) => api.patch(`/maintenance-work-orders/${id}`, payload),
    deleteRequest: (id) => api.delete(`/maintenance-work-orders/${id}`),
    mapRecordToForm: (detail) => ({
      parts: [], // Saved-order parts remain managed through their dedicated endpoints.
      title: safeString(detail.title),
      description: safeString(detail.description),
      type: safeString(detail.type) || 'CORRECTIVE',
      priority: safeString(detail.priority) || 'MEDIUM',
      machineId: safeString(detail.machineId),
      machineComponentId: safeString(detail.machineComponentId),
      scopeType: detail.scopeType || (detail.machineId ? 'MACHINE' : 'GENERAL'),
      productionLineId: safeString(detail.productionLineId),
      workLocation: safeString(detail.workLocation),
      costCenterId: safeString(detail.costCenterId),
      warehouseId: safeString(detail.warehouseId),
      assignedToId: safeString(detail.assignedToId),
      supervisorId: safeString(detail.supervisorId),
      plannedStartAt: detail.plannedStartAt ? toLocalInput(detail.plannedStartAt) : '',
      plannedEndAt: detail.plannedEndAt ? toLocalInput(detail.plannedEndAt) : '',
      estimatedCost: detail.estimatedCost != null ? String(detail.estimatedCost) : '',
      notes: safeString(detail.notes),
    }),
    mapFormToPayload: (currentForm, context) => {
      const payload: WorkOrderPayload = { scopeType: currentForm.scopeType, ...plannedPartsPayload(currentForm.parts, context.mode) };
      if (editItem) payload.title = currentForm.title.trim();
      if (currentForm.description.trim()) payload.description = currentForm.description.trim();
      payload.type = currentForm.type || 'CORRECTIVE';
      payload.priority = currentForm.priority || 'MEDIUM';
      if (currentForm.machineId) payload.machineId = currentForm.machineId;
      if (currentForm.machineComponentId) payload.machineComponentId = currentForm.machineComponentId;
      if (currentForm.productionLineId) payload.productionLineId = currentForm.productionLineId;
      if (currentForm.workLocation.trim()) payload.workLocation = currentForm.workLocation.trim();
      if (currentForm.costCenterId) payload.costCenterId = currentForm.costCenterId;
      if (currentForm.warehouseId) payload.warehouseId = currentForm.warehouseId;
      if (currentForm.assignedToId) payload.assignedToId = currentForm.assignedToId;
      if (currentForm.supervisorId) payload.supervisorId = currentForm.supervisorId;
      if (currentForm.plannedStartAt) payload.plannedStartAt = new Date(currentForm.plannedStartAt).toISOString();
      if (currentForm.plannedEndAt) payload.plannedEndAt = new Date(currentForm.plannedEndAt).toISOString();
      if (currentForm.estimatedCost.trim()) {
        const value = Number(currentForm.estimatedCost);
        if (!Number.isNaN(value) && value >= 0) payload.estimatedCost = value;
      }
      if (currentForm.notes.trim()) payload.notes = currentForm.notes.trim();
      return payload;
    },
    validate: (currentForm, context) => {
      const fieldErrors: Record<string, string> = {};
      if (context.mode === 'create') {
        Object.entries(validatePlannedParts(currentForm.parts)).forEach(([field, key]) => { fieldErrors[field] = t(key); });
      }
      if (!currentForm.description.trim()) fieldErrors.description = t('validation.required');
      if (currentForm.scopeType !== 'GENERAL' && !currentForm.productionLineId) fieldErrors.productionLineId = t('validation.required');
      if (currentForm.scopeType === 'MACHINE' && !currentForm.machineId) fieldErrors.machineId = t('validation.required');
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
    delete: () => selectedRecord && requestDelete(selectedRecord),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, onClick: () => exec('delete'), enabled: !!selectedId },
  ].filter(item => item.id === 'new' ? can('maintenance-work-order:create') : item.id === 'complete' ? can('maintenance-task:create') : true));

  const confirmTransition = (id: string, action: 'plan' | 'start' | 'complete' | 'cancel') => {
    setSelectedId(id);
    setConfirmAction(action);
    setCancelReason('');
    setConfirmOpen(true);
  };

  const handleStatusChange = async () => {
    setStatusSaving(true);
    try {
      const body: Record<string, string> = { action: confirmAction };
      if (confirmAction === 'cancel') {
        if (!cancelReason.trim()) {
          setValidationErrors({ cancelReason: t('validation.required') });
          return;
        }
        body.reason = cancelReason.trim();
      }
      await api.patch(`/maintenance-work-orders/${selectedId}/status`, body);
      showToast(t('maintenance.statusUpdated'), 'success');
      setConfirmOpen(false);
      fetchData(paginationMeta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setStatusSaving(false);
    }
  };

  const baseColumns: GridColumn<MaintenanceWorkOrder>[] = [
    { key: 'workOrderNumber', header: t('maintenance.workOrderNumber'), sortable: true, filterable: true },
    { key: 'title', header: t('maintenance.workOrderTitle'), sortable: true, filterable: true },
    { key: 'type', header: t('maintenance.workOrderType'), sortable: true, filterable: true, filterType: 'select', filterOptions: typeOptions, render: (d) => t(`status.${d.type}`) },
    { key: 'priority', header: t('maintenance.workOrderPriority'), sortable: true, filterable: true, filterType: 'select', filterOptions: priorityOptions, render: (d) => <CmmsPriorityBadge priority={d.priority} /> },
    { key: 'status', header: t('maintenance.workOrderStatus'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'DRAFT', label: t('maintenance.workOrderDraft') },
      { value: 'PLANNED', label: t('maintenance.workOrderPlanned') },
      { value: 'IN_PROGRESS', label: t('maintenance.workOrderInProgress') },
      { value: 'COMPLETED', label: t('maintenance.workOrderCompleted') },
      { value: 'CANCELLED', label: t('maintenance.workOrderCancelled') },
    ], render: (d) => <CmmsStatusBadge status={d.status} /> },
    { key: 'machine', header: t('maintenance.workOrderMachine'), sortable: true, render: (d) => d.machine ? `[${d.machine.code}] ${d.machine.name}` : '-' },
    { key: 'requestId', header: t('maintenance.workOrderRequest'), filterable: true, render: (d) => d.request ? `[${d.request.requestNumber}] ${d.request.title || ''}`.trim() : '-' },
    { key: 'assignedTo', header: t('maintenance.workOrderAssignedTo'), sortable: true, render: (d) => d.assignedTo?.name || '-' },
    { key: 'estimatedCost', header: t('maintenance.workOrderEstimatedCost'), sortable: true, render: (d) => d.estimatedCost != null ? Number(d.estimatedCost).toLocaleString() : '-' },
    { key: 'partsCount', header: t('maintenance.workOrderParts'), sortable: true, render: (d) => d._count?.parts ?? 0 },
  ];

  const gridActions: GridAction<MaintenanceWorkOrder>[] = [
    { label: t('grid.view'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (d) => router.push(`/admin/maintenance/work-orders/${d.id}`) },
    { label: t('grid.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (d) => openEdit(d) },
    { label: t('maintenance.planWorkOrder'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3" /></svg>, onClick: (d) => confirmTransition(d.id, 'plan'), enabled: (d) => d.status === 'DRAFT' },
    { label: t('maintenance.startWorkOrder'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, onClick: (d) => confirmTransition(d.id, 'start'), enabled: (d) => d.status === 'PLANNED' },
    { label: t('maintenance.executeCompleteWork'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, onClick: (d) => router.push(`/admin/maintenance/tasks?sourceType=WORK_ORDER&workOrderId=${d.id}`), enabled: (d) => d.status === 'IN_PROGRESS' },
    { label: t('maintenance.cancelWorkOrder'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>, variant: 'danger', onClick: (d) => confirmTransition(d.id, 'cancel'), enabled: (d) => d.status === 'DRAFT' || d.status === 'PLANNED' },
    { label: t('grid.delete'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, variant: 'danger', onClick: (d) => requestDelete(d), enabled: (d) => d.status === 'DRAFT' || d.status === 'PLANNED' || d.status === 'CANCELLED' },
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
    setSelectedWO(item);
    setSelectedId(item.id);
    setActiveSection('overview');
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedWO(null);
    setActiveSection('overview');
  }, []);

  useEffect(() => {
    return () => closeDrawer();
  }, [pathname, searchParams, closeDrawer]);

  useEffect(() => {
    if (selectedWO && drawerOpen && data.length > 0) {
      const exists = data.some((d: any) => d.id === selectedWO.id);
      if (!exists) closeDrawer();
    }
  }, [data, selectedWO, drawerOpen, closeDrawer]);

  const drawerNavItems = [
    { id: 'overview', label: t('workspace.overview'), icon: overviewIcon },
    { id: 'parts', label: t('maintenance.workOrderParts'), icon: partsIcon },
    { id: 'costs', label: t('maintenance.workOrderCostEntries'), icon: costsIcon },
  ];

  const drawerSections: DrawerSection[] = [
    {
      id: 'overview',
      label: t('workspace.overview'),
      content: selectedWO ? (
        <div className="space-y-4">
          <div className="bg-[var(--ws-soft)] border border-[var(--ws-border)] rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('maintenance.workOrderNumber')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedWO.workOrderNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('maintenance.workOrderTitle')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedWO.title}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('maintenance.workOrderType')}</span>
              <span className="text-sm font-medium text-gray-900">{t(`status.${selectedWO.type}`)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('maintenance.workOrderPriority')}</span>
              <span className="text-sm font-medium text-gray-900"><CmmsPriorityBadge priority={selectedWO.priority} /></span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('maintenance.workOrderStatus')}</span>
              <CmmsStatusBadge status={selectedWO.status} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('maintenance.workOrderMachine')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedWO.machine ? `[${selectedWO.machine.code}] ${selectedWO.machine.name}` : '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('maintenance.workOrderAssignedTo')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedWO.assignedTo?.name || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('maintenance.workOrderEstimatedCost')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedWO.estimatedCost != null ? Number(selectedWO.estimatedCost).toLocaleString() : '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{t('maintenance.workOrderActualCost')}</span>
              <span className="text-sm font-medium text-gray-900">{selectedWO.actualCost != null ? Number(selectedWO.actualCost).toLocaleString() : '-'}</span>
            </div>
          </div>
        </div>
      ) : null,
    },
    {
      id: 'parts',
      label: t('maintenance.workOrderParts'),
      content: !selectedWO ? null : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/admin/maintenance/work-orders/${selectedWO.id}`)}
            className="w-full text-center px-3 py-2 text-sm font-medium text-white bg-[var(--ws-accent)] rounded-lg hover:opacity-90"
          >
            {t('maintenance.workOrderParts')}
          </button>
        </div>
      ),
    },
    {
      id: 'costs',
      label: t('maintenance.workOrderCostEntries'),
      content: !selectedWO ? null : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/admin/maintenance/work-orders/${selectedWO.id}`)}
            className="w-full text-center px-3 py-2 text-sm font-medium text-white bg-[var(--ws-accent)] rounded-lg hover:opacity-90"
          >
            {t('maintenance.workOrderCostEntries')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <EntityWorkspaceLayout drawerOpen={drawerOpen} drawer={
      <EntityDetailDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={selectedWO?.title || ''}
        subtitle={selectedWO?.workOrderNumber || ''}
        statusBadge={selectedWO && <CmmsStatusBadge status={selectedWO.status} />}
        sections={drawerSections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        navItems={drawerNavItems}
        dir={dir}
        closeLabel={t('workspace.closePanel')}
      />
    }>
      <EntityPageHeader title={t('maintenance.maintenanceWorkOrders')} icon={workOrderIcon} />
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

      <Modal open={modalOpen} onClose={() => { closeFormModal(); setValidationErrors({}); }} title={editItem ? t('maintenance.editMaintenanceWorkOrder') : t('maintenance.newMaintenanceWorkOrder')}>
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          {validationErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.form}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label={t('common.code')} value={editItem?.workOrderNumber || t('common.codeAutoGenerated')} disabled /><Input label={t('maintenance.createdBy')} value={editItem?.createdBy?.name || user?.name || ''} disabled /></div>
          {editItem && <Input label={t('maintenance.workOrderTitle')} name="title" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setValidationErrors(prev => ({ ...prev, title: '' })); }} error={validationErrors.title} />}
          <Textarea label={t('maintenance.workOrderDescription')} name="description" value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); setValidationErrors(prev => ({ ...prev, description: '' })); }} error={validationErrors.description} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label={t('maintenance.workOrderType')} name="type" value={form.type} onChange={(e) => { setForm({ ...form, type: e.target.value }); setValidationErrors(prev => ({ ...prev, type: '' })); }} options={typeOptions} error={validationErrors.type} />
            <Select label={t('maintenance.workOrderPriority')} name="priority" value={form.priority} onChange={(e) => { setForm({ ...form, priority: e.target.value }); setValidationErrors(prev => ({ ...prev, priority: '' })); }} options={priorityOptions} error={validationErrors.priority} />
          </div>
          <Select label={t('maintenance.scopeType')} value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value as WorkOrderForm['scopeType'], productionLineId: '', machineId: '', machineComponentId: '' })} options={['MACHINE', 'PRODUCTION_LINE', 'GENERAL'].map((value) => ({ value, label: t(`maintenance.scope${value}`) }))} />
          {form.scopeType !== 'GENERAL' && <F9Lookup label={t('maintenance.productionLine')} value={form.productionLineId} onChange={(v) => setForm({ ...form, productionLineId: v, machineId: '', machineComponentId: '' })} adapter={productionLineAdapter} error={validationErrors.productionLineId} />}
          {form.scopeType === 'MACHINE' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setForm({ ...form, machineId: v, machineComponentId: '' })} adapter={machineAdapter} filters={{ productionLineId: form.productionLineId }} disabled={!form.productionLineId} error={validationErrors.machineId} />
            <F9Lookup label={t('maintenance.machineComponent')} value={form.machineComponentId} onChange={(v) => setForm({ ...form, machineComponentId: v })} adapter={machineComponentAdapter} filters={{ machineId: form.machineId }} disabled={!form.machineId} error={validationErrors.machineComponentId} />
          </div>}
          <Input label={t('maintenance.workLocation')} value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} />
          <F9Lookup label={t('maintenance.costCenter')} value={form.costCenterId} onChange={(v) => setForm({ ...form, costCenterId: v })} adapter={costCenterAdapter} />
          <F9Lookup label={t('maintenance.workOrderWarehouse')} name="warehouseId" value={form.warehouseId} onChange={(v) => { setForm({ ...form, warehouseId: v }); setValidationErrors(prev => ({ ...prev, warehouseId: '' })); }} adapter={warehouseAdapter} error={validationErrors.warehouseId} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F9Lookup label={t('maintenance.workOrderAssignedTo')} name="assignedToId" value={form.assignedToId} onChange={(v) => { setForm({ ...form, assignedToId: v }); setValidationErrors(prev => ({ ...prev, assignedToId: '' })); }} adapter={userAdapter} error={validationErrors.assignedToId} />
            <F9Lookup label={t('maintenance.workOrderSupervisor')} name="supervisorId" value={form.supervisorId} onChange={(v) => { setForm({ ...form, supervisorId: v }); setValidationErrors(prev => ({ ...prev, supervisorId: '' })); }} adapter={userAdapter} error={validationErrors.supervisorId} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label={t('maintenance.workOrderPlannedStart')} name="plannedStartAt" type="datetime-local" value={form.plannedStartAt} onChange={(e) => { setForm({ ...form, plannedStartAt: e.target.value }); setValidationErrors(prev => ({ ...prev, plannedStartAt: '' })); }} error={validationErrors.plannedStartAt} />
            <Input label={t('maintenance.workOrderPlannedEnd')} name="plannedEndAt" type="datetime-local" value={form.plannedEndAt} onChange={(e) => { setForm({ ...form, plannedEndAt: e.target.value }); setValidationErrors(prev => ({ ...prev, plannedEndAt: '' })); }} error={validationErrors.plannedEndAt} />
            <Input label={t('maintenance.workOrderEstimatedCost')} name="estimatedCost" type="number" min="0" step="0.01" value={form.estimatedCost} onChange={(e) => { setForm({ ...form, estimatedCost: e.target.value }); setValidationErrors(prev => ({ ...prev, estimatedCost: '' })); }} error={validationErrors.estimatedCost} />
          </div>
          {!editItem && <section aria-labelledby="planned-parts-heading" className="space-y-3 border-t pt-4">
            <h3 id="planned-parts-heading" className="font-medium">{t('maintenance.plannedParts')}</h3>
            <p className="text-sm text-gray-500">{t('maintenance.plannedPartsHint')}</p>
            {validationErrors.parts && <p role="alert" className="text-sm text-red-600">{validationErrors.parts}</p>}
            {form.parts.map((part, index) => {
              const field = (name: string) => 'parts.' + index + '.' + name;
              const update = (patch: Partial<PlannedPartDraft>) => {
                setForm(current => ({ ...current, parts: current.parts.map(row => row.clientKey === part.clientKey ? { ...row, ...patch } : row) }));
                setValidationErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'parts' && !key.startsWith('parts.' + index + '.'))));
              };
              return <fieldset key={part.clientKey} disabled={saving} className="space-y-3 border rounded-lg p-3">
                <legend className="px-1 text-sm">{t('maintenance.plannedParts')} {index + 1}</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <F9Lookup id={part.clientKey + '-sparePart'} name={field('sparePartId')} label={t('maintenance.sparePartLabel')} value={part.sparePartId} adapter={sparePartAdapter} disabled={saving} filters={{ status: 'ACTIVE' }}
                    onChange={sparePartId => update({ sparePartId, productId: '', unit: '' })}
                    onItemSelect={item => update({ sparePartId: item.id, productId: item.productId || '', unit: safeString(item.unit) })}
                    error={validationErrors[field('sparePartId')]} />
                  <F9Lookup id={part.clientKey + '-product'} name={field('productId')} label={t('maintenance.inventoryProduct')} value={part.productId} adapter={productAdapter} disabled={saving} filters={{ status: 'ACTIVE' }}
                    onChange={productId => update({ productId, unit: '' })}
                    onItemSelect={item => update({ productId: item.id, unit: safeString(item.unit) })}
                    error={validationErrors[field('productId')]} />
                  <Input id={part.clientKey + '-quantity'} name={field('quantity')} label={t('maintenance.partQuantity')} type="number" min="0.0001" step="0.0001" required value={part.quantity} onChange={event => update({ quantity: event.target.value })} error={validationErrors[field('quantity')]} />
                  <Input id={part.clientKey + '-unit'} label={t('maintenance.unit')} value={part.unit} disabled />
                  <Input id={part.clientKey + '-unitCost'} name={field('unitCost')} label={t('maintenance.partUnitCost')} type="number" min="0" step="0.01" value={part.unitCost} onChange={event => update({ unitCost: event.target.value })} error={validationErrors[field('unitCost')]} />
                  <Input id={part.clientKey + '-notes'} name={field('notes')} label={t('maintenance.workOrderNotes')} value={part.notes} onChange={event => update({ notes: event.target.value })} />
                </div>
                <Button variant="danger" disabled={saving} onClick={() => {
                  setForm(current => ({ ...current, parts: current.parts.filter(row => row.clientKey !== part.clientKey) }));
                  setValidationErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'parts' && !key.startsWith('parts.'))));
                }}>{t('actions.remove')}</Button>
              </fieldset>;
            })}
            <Button variant="secondary" disabled={saving} onClick={() => setForm(current => ({ ...current, parts: [...current.parts, { clientKey: crypto.randomUUID(), sparePartId: '', productId: '', quantity: '1', unit: '', unitCost: '', notes: '' }] }))}>{t('maintenance.addPart')}</Button>
          </section>}
          <Textarea label={t('maintenance.workOrderNotes')} name="notes" value={form.notes} onChange={(e) => { setForm({ ...form, notes: e.target.value }); setValidationErrors(prev => ({ ...prev, notes: '' })); }} error={validationErrors.notes} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { closeFormModal(); setValidationErrors({}); }}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>}
      </Modal>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)}
        onConfirm={handleStatusChange}
        title={confirmAction === 'plan' ? t('maintenance.planWorkOrder')
          : confirmAction === 'start' ? t('maintenance.startWorkOrder')
            : confirmAction === 'complete' ? t('maintenance.completeWorkOrder')
              : t('maintenance.cancelWorkOrder')}
        message={confirmAction === 'cancel' ? t('maintenance.confirmCancelWorkOrder')
          : confirmAction === 'complete' ? t('maintenance.confirmCompleteWorkOrder')
            : ''}
        variant={confirmAction === 'cancel' ? 'danger' : 'primary'} loading={statusSaving}>
        {confirmAction === 'cancel' && (
          <div className="pt-3">
            <Input label={t('maintenance.cancelReason') || 'Reason'} name="cancelReason" value={cancelReason} onChange={(e) => { setCancelReason(e.target.value); setValidationErrors(prev => ({ ...prev, cancelReason: '' })); }} error={validationErrors.cancelReason} required placeholder={t('maintenance.cancelReasonPlaceholder') || 'Required for cancellation'} />
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog open={deleteConfirmOpen} onClose={cancelDelete}
        onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')}
        message={t('maintenance.confirmDeleteWorkOrder')}
        variant="danger" loading={deleting} />
    </EntityWorkspaceLayout>
  );
}

function toLocalInput(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}
