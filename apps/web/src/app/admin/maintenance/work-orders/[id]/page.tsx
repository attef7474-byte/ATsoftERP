'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../../lib/api';
import { safeString } from '../../../../../lib/form-utils';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { MaintenanceWorkOrder } from '../../../../../lib/admin-types';
import { Button, Card, CardHeader, CardContent, DataTable, LoadingState, EmptyState, ErrorState, Modal, Input, ConfirmDialog, Select, Textarea } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionAddIcon, ActionDeleteIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, machineComponentAdapter, maintenanceRequestAdapter, warehouseAdapter, userAdapter, sparePartAdapter, productAdapter } from '../../../../../components/f9';
import { CmmsStatusBadge } from '../../../../../components/maintenance/CmmsStatusBadge';
import { CmmsPriorityBadge } from '../../../../../components/maintenance/CmmsPriorityBadge';
import { useParams, useRouter } from 'next/navigation';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../../lib/form-validation';
import { formatDateTime } from '../../../../../lib/i18n/literals';

const WORK_ORDER_TYPES = ['CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE', 'OVERHAUL', 'OTHER'];
const WORK_ORDER_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const COST_ENTRY_TYPES = ['LABOR', 'PARTS', 'EXTERNAL', 'OTHER'];

type Tab = 'overview' | 'parts' | 'costs';

interface WorkOrderForm {
  title: string;
  description: string;
  type: string;
  priority: string;
  machineId: string;
  machineComponentId: string;
  requestId: string;
  warehouseId: string;
  assignedToId: string;
  supervisorId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  estimatedCost: string;
  notes: string;
}

interface PartForm {
  id: string;
  sparePartId: string;
  productId: string;
  quantity: string;
  unit: string;
  unitCost: string;
  notes: string;
}

interface CostForm {
  id: string;
  type: string;
  description: string;
  amount: string;
  incurredAt: string;
}

const EMPTY_WO_FORM: WorkOrderForm = {
  title: '', description: '', type: 'CORRECTIVE', priority: 'MEDIUM',
  machineId: '', machineComponentId: '', requestId: '', warehouseId: '',
  assignedToId: '', supervisorId: '', plannedStartAt: '', plannedEndAt: '',
  estimatedCost: '', notes: '',
};
const EMPTY_PART_FORM: PartForm = { id: '', sparePartId: '', productId: '', quantity: '', unit: '', unitCost: '', notes: '' };
const EMPTY_COST_FORM: CostForm = { id: '', type: 'LABOR', description: '', amount: '', incurredAt: '' };

export default function MaintenanceWorkOrderDetailPage() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<MaintenanceWorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const [headerForm, setHeaderForm] = useState<WorkOrderForm>(EMPTY_WO_FORM);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [partModalOpen, setPartModalOpen] = useState(false);
  const [partForm, setPartForm] = useState<PartForm>(EMPTY_PART_FORM);
  const [partSaving, setPartSaving] = useState(false);

  const [costModalOpen, setCostModalOpen] = useState(false);
  const [costForm, setCostForm] = useState<CostForm>(EMPTY_COST_FORM);
  const [costSaving, setCostSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'plan' | 'start' | 'complete' | 'cancel' | 'issue' | 'deletePart' | 'deleteCost' | 'deleteWorkOrder'>('plan');
  const [cancelReason, setCancelReason] = useState('');
  const [actionTargetId, setActionTargetId] = useState('');

  const typeOptions = useMemo(
    () => WORK_ORDER_TYPES.map((type) => ({ value: type, label: t(`common.status.${type}`) })),
    [t],
  );
  const priorityOptions = useMemo(
    () => WORK_ORDER_PRIORITIES.map((priority) => ({ value: priority, label: t(`common.status.${priority}`) })),
    [t],
  );
  const costTypeOptions = useMemo(
    () => COST_ENTRY_TYPES.map((type) => ({ value: type, label: t(`maintenance.costType${type}`) })),
    [t],
  );

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await api.get<MaintenanceWorkOrder>(`/maintenance-work-orders/${id}`);
      setData(res);
    } catch (err: any) {
      if (err?.status === 404) {
        setNotFound(true);
      } else {
        handleApiError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [id, handleApiError]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/maintenance/work-orders'),
    refresh: () => fetchData(),
    edit: () => {
      if (!data) return;
      setHeaderForm({
        title: data.title,
        description: data.description || '',
        type: data.type || 'CORRECTIVE',
        priority: data.priority || 'MEDIUM',
        machineId: data.machineId || '',
        machineComponentId: data.machineComponentId || '',
        requestId: data.requestId || '',
        warehouseId: data.warehouseId || '',
        assignedToId: data.assignedToId || '',
        supervisorId: data.supervisorId || '',
        plannedStartAt: data.plannedStartAt ? toLocalInput(data.plannedStartAt) : '',
        plannedEndAt: data.plannedEndAt ? toLocalInput(data.plannedEndAt) : '',
        estimatedCost: data.estimatedCost != null ? String(data.estimatedCost) : '',
        notes: data.notes || '',
      });
      setValidationErrors({});
      setHeaderModalOpen(true);
    },
    plan: () => { setConfirmAction('plan'); setConfirmOpen(true); },
    start: () => { setConfirmAction('start'); setConfirmOpen(true); },
    complete: () => { setConfirmAction('complete'); setConfirmOpen(true); },
    cancel: () => { setCancelReason(''); setValidationErrors({}); setConfirmAction('cancel'); setConfirmOpen(true); },
    addPart: () => { setPartForm(EMPTY_PART_FORM); setValidationErrors({}); setPartModalOpen(true); },
    addCost: () => { setCostForm(EMPTY_COST_FORM); setValidationErrors({}); setCostModalOpen(true); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data && data.status !== 'COMPLETED' && data.status !== 'CANCELLED' },
    { id: 'plan', labelKey: 'maintenance.planWorkOrder', icon: <ActionEditIcon />, onClick: () => exec('plan'), enabled: !!(data && data.status === 'DRAFT') },
    { id: 'start', labelKey: 'maintenance.startWorkOrder', icon: <ActionEditIcon />, onClick: () => exec('start'), enabled: !!(data && data.status === 'PLANNED') },
    { id: 'complete', labelKey: 'maintenance.completeWorkOrder', icon: <ActionEditIcon />, onClick: () => exec('complete'), enabled: !!(data && data.status === 'IN_PROGRESS') },
    { id: 'cancel', labelKey: 'maintenance.cancelWorkOrder', icon: <ActionDeleteIcon />, onClick: () => exec('cancel'), enabled: !!(data && (data.status === 'DRAFT' || data.status === 'PLANNED')) },
    { id: 'addPart', labelKey: 'maintenance.addPart', icon: <ActionAddIcon />, onClick: () => exec('addPart'), enabled: !!data && data.status !== 'COMPLETED' && data.status !== 'CANCELLED' },
    { id: 'addCost', labelKey: 'maintenance.addCostEntry', icon: <ActionAddIcon />, onClick: () => exec('addCost'), enabled: !!data && data.status !== 'COMPLETED' && data.status !== 'CANCELLED' },
  ]);

  const handleHeaderSave = async () => {
    const errors: Record<string, string> = {};
    if (!headerForm.title.trim()) errors.title = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(Object.entries(errors).map(([field, message]) => ({ field, code: 'validation.required', message })));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string | number> = { title: headerForm.title.trim() };
      if (headerForm.description.trim()) payload.description = headerForm.description.trim();
      payload.type = headerForm.type || 'CORRECTIVE';
      payload.priority = headerForm.priority || 'MEDIUM';
      if (headerForm.machineId) payload.machineId = headerForm.machineId;
      if (headerForm.machineComponentId) payload.machineComponentId = headerForm.machineComponentId;
      if (headerForm.requestId) payload.requestId = headerForm.requestId;
      if (headerForm.warehouseId) payload.warehouseId = headerForm.warehouseId;
      if (headerForm.assignedToId) payload.assignedToId = headerForm.assignedToId;
      if (headerForm.supervisorId) payload.supervisorId = headerForm.supervisorId;
      if (headerForm.plannedStartAt) payload.plannedStartAt = new Date(headerForm.plannedStartAt).toISOString();
      if (headerForm.plannedEndAt) payload.plannedEndAt = new Date(headerForm.plannedEndAt).toISOString();
      if (headerForm.estimatedCost.trim()) {
        const value = Number(headerForm.estimatedCost);
        if (!Number.isNaN(value) && value >= 0) payload.estimatedCost = value;
      }
      if (headerForm.notes.trim()) payload.notes = headerForm.notes.trim();
      await api.patch(`/maintenance-work-orders/${id}`, payload);
      showToast(t('common.successUpdated'), 'success');
      setHeaderModalOpen(false);
      fetchData();
    } catch (err: any) {
      const config = handleApiError(err);
      if (config?.errors?.length) {
        setValidationErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = { action: confirmAction };
      if (confirmAction === 'cancel') {
        if (!cancelReason.trim()) {
          setValidationErrors({ cancelReason: t('validation.required') });
          return;
        }
        body.reason = cancelReason.trim();
      }
      await api.patch(`/maintenance-work-orders/${id}/status`, body);
      showToast(t('maintenance.statusUpdated'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const openEditPart = (partId: string) => {
    const part = data?.parts?.find((p: any) => p.id === partId);
    if (!part) return;
    setPartForm({
      id: part.id,
      sparePartId: part.sparePartId || '',
      productId: part.productId || '',
      quantity: String(part.quantity ?? ''),
      unit: part.unit || '',
      unitCost: part.unitCost != null ? String(part.unitCost) : '',
      notes: part.notes || '',
    });
    setValidationErrors({});
    setPartModalOpen(true);
  };

  const handlePartSave = async () => {
    const errors: Record<string, string> = {};
    if (!partForm.sparePartId && !partForm.productId) {
      errors.part = t('validation.required');
    }
    if (!partForm.quantity.trim() || Number.isNaN(Number(partForm.quantity)) || Number(partForm.quantity) <= 0) {
      errors.quantity = t('validation.required');
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setPartSaving(true);
    try {
      const payload: Record<string, string | number> = { quantity: Number(partForm.quantity) };
      if (partForm.sparePartId) payload.sparePartId = partForm.sparePartId;
      if (partForm.productId) payload.productId = partForm.productId;
      if (partForm.unit.trim()) payload.unit = partForm.unit.trim();
      if (partForm.unitCost.trim()) {
        const value = Number(partForm.unitCost);
        if (!Number.isNaN(value) && value >= 0) payload.unitCost = value;
      }
      if (partForm.notes.trim()) payload.notes = partForm.notes.trim();

      if (partForm.id) {
        await api.patch(`/maintenance-work-orders/parts/${partForm.id}`, payload);
        showToast(t('maintenance.partUpdated'), 'success');
      } else {
        await api.post(`/maintenance-work-orders/${id}/parts`, payload);
        showToast(t('maintenance.partAdded'), 'success');
      }
      setPartModalOpen(false);
      fetchData();
    } catch (err: any) {
      const config = handleApiError(err);
      if (config?.errors?.length) {
        setValidationErrors(adaptFieldErrorsToMap(config.errors));
      }
    } finally {
      setPartSaving(false);
    }
  };

  const requestDeletePart = (partId: string) => {
    setActionTargetId(partId);
    setConfirmAction('deletePart');
    setConfirmOpen(true);
  };

  const handleDeletePart = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance-work-orders/parts/${actionTargetId}`);
      showToast(t('maintenance.partRemoved'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const requestIssueParts = () => {
    setConfirmAction('issue');
    setConfirmOpen(true);
  };

  const handleIssueParts = async () => {
    setSaving(true);
    try {
      await api.post(`/maintenance-work-orders/${id}/issue-parts`, {});
      showToast(t('maintenance.partsIssued'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const openEditCost = (entryId: string) => {
    const entry = data?.costEntries?.find((c: any) => c.id === entryId);
    if (!entry) return;
    setCostForm({
      id: entry.id,
      type: entry.type || 'LABOR',
      description: entry.description || '',
      amount: String(entry.amount ?? ''),
      incurredAt: entry.incurredAt ? toLocalInput(entry.incurredAt) : '',
    });
    setValidationErrors({});
    setCostModalOpen(true);
  };

  const handleCostSave = async () => {
    const errors: Record<string, string> = {};
    if (!costForm.amount.trim() || Number.isNaN(Number(costForm.amount)) || Number(costForm.amount) < 0) {
      errors.amount = t('validation.required');
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setCostSaving(true);
    try {
      const payload: Record<string, string | number> = {
        type: costForm.type || 'LABOR',
        amount: Number(costForm.amount),
      };
      if (costForm.description.trim()) payload.description = costForm.description.trim();
      if (costForm.incurredAt) payload.incurredAt = new Date(costForm.incurredAt).toISOString();

      if (costForm.id) {
        await api.patch(`/maintenance-work-orders/cost-entries/${costForm.id}`, payload);
        showToast(t('maintenance.costEntryUpdated'), 'success');
      } else {
        await api.post(`/maintenance-work-orders/${id}/cost-entries`, payload);
        showToast(t('maintenance.costEntryAdded'), 'success');
      }
      setCostModalOpen(false);
      fetchData();
    } catch (err: any) {
      const config = handleApiError(err);
      if (config?.errors?.length) {
        setValidationErrors(adaptFieldErrorsToMap(config.errors));
      }
    } finally {
      setCostSaving(false);
    }
  };

  const requestDeleteCost = (entryId: string) => {
    setActionTargetId(entryId);
    setConfirmAction('deleteCost');
    setConfirmOpen(true);
  };

  const handleDeleteCost = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance-work-orders/cost-entries/${actionTargetId}`);
      showToast(t('maintenance.costEntryRemoved'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteWorkOrder = () => {
    setConfirmAction('deleteWorkOrder');
    setConfirmOpen(true);
  };

  const handleDeleteWorkOrder = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance-work-orders/${id}`);
      showToast(t('common.successDeleted'), 'success');
      router.push('/admin/maintenance/work-orders');
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (confirmAction === 'issue') return handleIssueParts();
    if (confirmAction === 'deletePart') return handleDeletePart();
    if (confirmAction === 'deleteCost') return handleDeleteCost();
    if (confirmAction === 'deleteWorkOrder') return handleDeleteWorkOrder();
    return handleStatusChange();
  };

  const partColumns = [
    { key: 'item', header: t('maintenance.partQuantity'), render: (p: any) => p.sparePart ? `[${p.sparePart.code}] ${p.sparePart.name}` : (p.product ? `[${p.product.code}] ${p.product.name}` : '-') },
    { key: 'quantity', header: t('maintenance.partQuantity'), render: (p: any) => `${p.quantity}${p.unit ? ` ${p.unit}` : ''}` },
    { key: 'unitCost', header: t('maintenance.partUnitCost'), render: (p: any) => p.unitCost != null ? Number(p.unitCost).toLocaleString() : '-' },
    { key: 'totalCost', header: t('maintenance.partTotalCost'), render: (p: any) => p.totalCost != null ? Number(p.totalCost).toLocaleString() : '-' },
    { key: 'stockIssueStatus', header: t('maintenance.partIssueStatus'), render: (p: any) => <CmmsStatusBadge status={p.stockIssueStatus} /> },
    { key: 'issuedQuantity', header: t('maintenance.partIssuedQuantity'), render: (p: any) => p.issuedQuantity ?? 0 },
    {
      key: 'actions', header: '',
      render: (p: any) => (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEditPart(p.id)}>{t('common.edit')}</Button>
          <Button variant="danger" size="sm" onClick={() => requestDeletePart(p.id)}>{t('common.delete')}</Button>
        </div>
      ),
    },
  ];

  const costColumns = [
    { key: 'type', header: t('maintenance.costType'), render: (c: any) => t(`maintenance.costType${c.type}`) },
    { key: 'description', header: t('maintenance.costDescription'), render: (c: any) => c.description || '-' },
    { key: 'amount', header: t('maintenance.costAmount'), render: (c: any) => Number(c.amount).toLocaleString() },
    { key: 'incurredAt', header: t('maintenance.costIncurredAt'), render: (c: any) => formatDateTime(c.incurredAt, locale) },
    {
      key: 'actions', header: '',
      render: (c: any) => (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEditCost(c.id)}>{t('common.edit')}</Button>
          <Button variant="danger" size="sm" onClick={() => requestDeleteCost(c.id)}>{t('common.delete')}</Button>
        </div>
      ),
    },
  ];

  const confirmDialogTitle = () => {
    switch (confirmAction) {
      case 'plan': return t('maintenance.planWorkOrder');
      case 'start': return t('maintenance.startWorkOrder');
      case 'complete': return t('maintenance.completeWorkOrder');
      case 'cancel': return t('maintenance.cancelWorkOrder');
      case 'issue': return t('maintenance.issueParts');
      case 'deletePart': return t('common.confirmDeleteTitle');
      case 'deleteCost': return t('common.confirmDeleteTitle');
      case 'deleteWorkOrder': return t('common.confirmDeleteTitle');
      default: return '';
    }
  };

  const confirmDialogMessage = () => {
    switch (confirmAction) {
      case 'plan': return '';
      case 'start': return '';
      case 'complete': return t('maintenance.confirmCompleteWorkOrder');
      case 'cancel': return t('maintenance.confirmCancelWorkOrder');
      case 'issue': return t('maintenance.confirmIssueParts');
      case 'deletePart': return t('common.confirmDeleteMessage');
      case 'deleteCost': return t('common.confirmDeleteMessage');
      case 'deleteWorkOrder': return t('maintenance.confirmDeleteWorkOrder');
      default: return '';
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('details.overview') },
    { key: 'parts', label: t('maintenance.workOrderParts') },
    { key: 'costs', label: t('maintenance.workOrderCostEntries') },
  ];

  if (notFound) {
    return <ErrorState message={t('errors.notFound')} onRetry={() => router.push('/admin/maintenance/work-orders')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  if (loading || !data) {
    return <LoadingState />;
  }

  const canEdit = data.status !== 'COMPLETED' && data.status !== 'CANCELLED';
  const hasPendingParts = (data.parts || []).some((p: any) => p.stockIssueStatus === 'PENDING');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.title}</h1>
              <p className="text-sm text-gray-500 mt-1">{t('maintenance.workOrderNumber')}: {data.workOrderNumber}</p>
            </div>
            <div className="flex items-center gap-3">
              <CmmsPriorityBadge priority={data.priority} />
              <CmmsStatusBadge status={data.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderType')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{t(`common.status.${data.type}`)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderMachine')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.machine ? `[${data.machine.code}] ${data.machine.name}` : '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderComponent')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.machineComponent ? `[${data.machineComponent.code}] ${data.machineComponent.name}` : '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderRequest')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.request ? `${data.request.requestNumber} - ${data.request.title}` : '-'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderAssignedTo')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.assignedTo?.name || '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderSupervisor')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.supervisor?.name || '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderWarehouse')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.warehouse ? `[${data.warehouse.code}] ${data.warehouse.name}` : '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderPlannedStart')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{formatDateTime(data.plannedStartAt, locale)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderPlannedEnd')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{formatDateTime(data.plannedEndAt, locale)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderEstimatedCost')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.estimatedCost != null ? Number(data.estimatedCost).toLocaleString() : '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderActualCost')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.actualCost != null ? Number(data.actualCost).toLocaleString() : '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('common.status')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.cancelReason || '-'}</p>
            </div>
          </div>
          {data.description && (
            <div className="mt-4">
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderDescription')}</span>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{data.description}</p>
            </div>
          )}
          {data.notes && (
            <div className="mt-4">
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.workOrderNotes')}</span>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{data.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">{t('common.createdAt')}</span>
              <p className="font-medium text-gray-900 mt-1">{formatDateTime(data.createdAt, locale)}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('common.updatedAt')}</span>
              <p className="font-medium text-gray-900 mt-1">{formatDateTime(data.updatedAt, locale)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">{t('details.overview')}</h2>
              {canEdit && (
                <div className="flex gap-2">
                  {data.status === 'DRAFT' && <Button size="sm" onClick={() => exec('plan')}>{t('maintenance.planWorkOrder')}</Button>}
                  {data.status === 'PLANNED' && <Button size="sm" onClick={() => exec('start')}>{t('maintenance.startWorkOrder')}</Button>}
                  {data.status === 'IN_PROGRESS' && <Button size="sm" onClick={() => exec('complete')}>{t('maintenance.completeWorkOrder')}</Button>}
                  {(data.status === 'DRAFT' || data.status === 'PLANNED') && <Button variant="danger" size="sm" onClick={() => exec('cancel')}>{t('maintenance.cancelWorkOrder')}</Button>}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{data.description || t('maintenance.workOrderDescription')}</p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'parts' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">{t('maintenance.workOrderParts')}</h2>
              {canEdit && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => exec('addPart')}>{t('maintenance.addPart')}</Button>
                  {hasPendingParts && <Button size="sm" onClick={requestIssueParts}>{t('maintenance.issueParts')}</Button>}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!data.parts || data.parts.length === 0 ? (
              <EmptyState message={t('maintenance.noParts')} />
            ) : (
              <DataTable columns={partColumns} data={data.parts as any[]} keyExtractor={(p: any) => p.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'costs' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">{t('maintenance.workOrderCostEntries')}</h2>
              {canEdit && <Button size="sm" onClick={() => exec('addCost')}>{t('maintenance.addCostEntry')}</Button>}
            </div>
          </CardHeader>
          <CardContent>
            {!data.costEntries || data.costEntries.length === 0 ? (
              <EmptyState message={t('maintenance.noCostEntries')} />
            ) : (
              <DataTable columns={costColumns} data={data.costEntries as any[]} keyExtractor={(c: any) => c.id} />
            )}
          </CardContent>
        </Card>
      )}

      <Modal open={headerModalOpen} onClose={() => setHeaderModalOpen(false)} title={t('maintenance.editMaintenanceWorkOrder')}>
        <div className="space-y-4">
          {validationErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.form}</div>}
          <Input label={t('maintenance.workOrderTitle')} name="title" value={headerForm.title} onChange={(e) => { setHeaderForm({ ...headerForm, title: e.target.value }); setValidationErrors(prev => ({ ...prev, title: '' })); }} error={validationErrors.title} required />
          <Textarea label={t('maintenance.workOrderDescription')} name="description" value={headerForm.description} onChange={(e) => { setHeaderForm({ ...headerForm, description: e.target.value }); setValidationErrors(prev => ({ ...prev, description: '' })); }} error={validationErrors.description} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label={t('maintenance.workOrderType')} name="type" value={headerForm.type} onChange={(e) => { setHeaderForm({ ...headerForm, type: e.target.value }); setValidationErrors(prev => ({ ...prev, type: '' })); }} options={typeOptions} error={validationErrors.type} />
            <Select label={t('maintenance.workOrderPriority')} name="priority" value={headerForm.priority} onChange={(e) => { setHeaderForm({ ...headerForm, priority: e.target.value }); setValidationErrors(prev => ({ ...prev, priority: '' })); }} options={priorityOptions} error={validationErrors.priority} />
          </div>
          <F9Lookup label={t('maintenance.workOrderMachine')} name="machineId" value={headerForm.machineId} onChange={(v) => { setHeaderForm({ ...headerForm, machineId: v }); setValidationErrors(prev => ({ ...prev, machineId: '' })); }} adapter={machineAdapter} error={validationErrors.machineId} />
          <F9Lookup label={t('maintenance.workOrderComponent')} name="machineComponentId" value={headerForm.machineComponentId} onChange={(v) => { setHeaderForm({ ...headerForm, machineComponentId: v }); setValidationErrors(prev => ({ ...prev, machineComponentId: '' })); }} adapter={machineComponentAdapter} filters={headerForm.machineId ? { machineId: headerForm.machineId } : undefined} error={validationErrors.machineComponentId} />
          <F9Lookup label={t('maintenance.workOrderRequest')} name="requestId" value={headerForm.requestId} onChange={(v) => { setHeaderForm({ ...headerForm, requestId: v }); setValidationErrors(prev => ({ ...prev, requestId: '' })); }} adapter={maintenanceRequestAdapter} error={validationErrors.requestId} />
          <F9Lookup label={t('maintenance.workOrderWarehouse')} name="warehouseId" value={headerForm.warehouseId} onChange={(v) => { setHeaderForm({ ...headerForm, warehouseId: v }); setValidationErrors(prev => ({ ...prev, warehouseId: '' })); }} adapter={warehouseAdapter} error={validationErrors.warehouseId} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F9Lookup label={t('maintenance.workOrderAssignedTo')} name="assignedToId" value={headerForm.assignedToId} onChange={(v) => { setHeaderForm({ ...headerForm, assignedToId: v }); setValidationErrors(prev => ({ ...prev, assignedToId: '' })); }} adapter={userAdapter} error={validationErrors.assignedToId} />
            <F9Lookup label={t('maintenance.workOrderSupervisor')} name="supervisorId" value={headerForm.supervisorId} onChange={(v) => { setHeaderForm({ ...headerForm, supervisorId: v }); setValidationErrors(prev => ({ ...prev, supervisorId: '' })); }} adapter={userAdapter} error={validationErrors.supervisorId} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label={t('maintenance.workOrderPlannedStart')} name="plannedStartAt" type="datetime-local" value={headerForm.plannedStartAt} onChange={(e) => { setHeaderForm({ ...headerForm, plannedStartAt: e.target.value }); setValidationErrors(prev => ({ ...prev, plannedStartAt: '' })); }} error={validationErrors.plannedStartAt} />
            <Input label={t('maintenance.workOrderPlannedEnd')} name="plannedEndAt" type="datetime-local" value={headerForm.plannedEndAt} onChange={(e) => { setHeaderForm({ ...headerForm, plannedEndAt: e.target.value }); setValidationErrors(prev => ({ ...prev, plannedEndAt: '' })); }} error={validationErrors.plannedEndAt} />
            <Input label={t('maintenance.workOrderEstimatedCost')} name="estimatedCost" type="number" min="0" step="0.01" value={headerForm.estimatedCost} onChange={(e) => { setHeaderForm({ ...headerForm, estimatedCost: e.target.value }); setValidationErrors(prev => ({ ...prev, estimatedCost: '' })); }} error={validationErrors.estimatedCost} />
          </div>
          <Textarea label={t('maintenance.workOrderNotes')} name="notes" value={headerForm.notes} onChange={(e) => { setHeaderForm({ ...headerForm, notes: e.target.value }); setValidationErrors(prev => ({ ...prev, notes: '' })); }} error={validationErrors.notes} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setHeaderModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleHeaderSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={partModalOpen} onClose={() => setPartModalOpen(false)} title={partForm.id ? t('maintenance.editPart') : t('maintenance.addPart')}>
        <div className="space-y-4">
          {validationErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.form}</div>}
          {validationErrors.part && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.part}</div>}
          <F9Lookup label={t('maintenance.sparePartLabel')} name="sparePartId" value={partForm.sparePartId} onChange={(v) => { setPartForm({ ...partForm, sparePartId: v }); setValidationErrors(prev => ({ ...prev, part: '' })); }} adapter={sparePartAdapter} />
          <F9Lookup label={t('maintenance.linkedInventoryItem')} name="productId" value={partForm.productId} onChange={(v) => { setPartForm({ ...partForm, productId: v }); setValidationErrors(prev => ({ ...prev, part: '' })); }} adapter={productAdapter} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label={t('maintenance.partQuantity')} name="quantity" type="number" min="0.0001" step="0.0001" value={partForm.quantity} onChange={(e) => { setPartForm({ ...partForm, quantity: e.target.value }); setValidationErrors(prev => ({ ...prev, quantity: '' })); }} error={validationErrors.quantity} required />
            <Input label={t('maintenance.unit')} name="unit" value={partForm.unit} onChange={(e) => { setPartForm({ ...partForm, unit: e.target.value }); }} />
            <Input label={t('maintenance.partUnitCost')} name="unitCost" type="number" min="0" step="0.01" value={partForm.unitCost} onChange={(e) => { setPartForm({ ...partForm, unitCost: e.target.value }); }} />
          </div>
          <Textarea label={t('maintenance.partLineNotes')} name="notes" value={partForm.notes} onChange={(e) => { setPartForm({ ...partForm, notes: e.target.value }); }} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setPartModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handlePartSave} loading={partSaving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={costModalOpen} onClose={() => setCostModalOpen(false)} title={costForm.id ? t('maintenance.editCostEntry') : t('maintenance.addCostEntry')}>
        <div className="space-y-4">
          {validationErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{validationErrors.form}</div>}
          <Select label={t('maintenance.costType')} name="type" value={costForm.type} onChange={(e) => { setCostForm({ ...costForm, type: e.target.value }); }} options={costTypeOptions} />
          <Input label={t('maintenance.costAmount')} name="amount" type="number" min="0" step="0.01" value={costForm.amount} onChange={(e) => { setCostForm({ ...costForm, amount: e.target.value }); setValidationErrors(prev => ({ ...prev, amount: '' })); }} error={validationErrors.amount} required />
          <Textarea label={t('maintenance.costDescription')} name="description" value={costForm.description} onChange={(e) => { setCostForm({ ...costForm, description: e.target.value }); }} />
          <Input label={t('maintenance.costIncurredAt')} name="incurredAt" type="datetime-local" value={costForm.incurredAt} onChange={(e) => { setCostForm({ ...costForm, incurredAt: e.target.value }); }} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setCostModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleCostSave} loading={costSaving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title={confirmDialogTitle()}
        message={confirmDialogMessage()}
        variant={confirmAction === 'cancel' || confirmAction === 'deletePart' || confirmAction === 'deleteCost' || confirmAction === 'deleteWorkOrder' ? 'danger' : 'primary'} loading={saving}>
        {confirmAction === 'cancel' && (
          <div className="pt-2">
            <Input label={t('maintenance.cancelReason')} name="cancelReason" value={cancelReason} onChange={(e) => { setCancelReason(e.target.value); setValidationErrors(prev => ({ ...prev, cancelReason: '' })); }} error={validationErrors.cancelReason} required placeholder={t('maintenance.cancelReasonPlaceholder')} />
          </div>
        )}
      </ConfirmDialog>
    </div>
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
