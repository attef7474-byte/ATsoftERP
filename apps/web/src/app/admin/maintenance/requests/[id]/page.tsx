'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import { isReservedDetailRouteId } from '../../../../../lib/route-guards';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { MaintenanceRequest, MaintenanceTask, DowntimeLog, SparePartRequestLine, MachineInstalledPart } from '../../../../../lib/admin-types';
import { CloseReadiness, CloseReadinessBlocker } from '../../../../../lib/canonical-cost-types';
import { maintenanceEscalationLevelLabel, maintenanceSlaStatusLabel } from '../../../../../lib/maintenance-labels';

function blockerLabelKey(code: CloseReadinessBlocker['code']): string {
  switch (code) {
    case 'OPEN_TASKS': return 'maintenanceWorkflow.blockerOpenTasks';
    case 'UNRESOLVED_REQUIRED_PARTS': return 'maintenanceWorkflow.blockerUnresolvedParts';
    case 'ACTIVE_WORK_ORDERS': return 'maintenanceWorkflow.blockerActiveWorkOrders';
    case 'MANDATORY_CHECKLIST_PENDING': return 'maintenanceWorkflow.blockerMandatoryChecklist';
    case 'REQUEST_NOT_COMPLETED': return 'maintenanceWorkflow.blockerRequestNotCompleted';
    default: return 'maintenanceWorkflow.closeReadinessBlocked';
  }
}
import { useAuth } from '../../../../../lib/auth-context';
import { COST_PURPOSE_VALUES, MAINTENANCE_COST_PURPOSE, COST_PURPOSE_OVERRIDE_PERMISSION } from '../../../../../lib/cost-purpose';

interface RequestDetail extends MaintenanceRequest {
  tasks?: MaintenanceTask[];
  downtimeLogs?: DowntimeLog[];
  requiredParts?: any[];
}
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge, ConfirmDialog, Select, Modal, Input, Textarea, Button } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon, ActionBarcodeIcon, ActionAddIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup, sparePartAdapter, warehouseAdapter, userAdapter, machineInstalledPartAdapter } from '../../../../../components/f9';
import { ReplacementHistoryCard } from '../../../../../components/admin/maintenance/replacement-history-card';

export default function MaintenanceRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { isSuperAdmin, permissions } = useAuth();
  const canOverrideCostPurpose = isSuperAdmin || Boolean(permissions?.permissions.includes(COST_PURPOSE_OVERRIDE_PERMISSION));
  const id = params.id as string;
  if (isReservedDetailRouteId(id)) {
    notFound();
  }
  const [data, setData] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [partAccountabilities, setPartAccountabilities] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [partLines, setPartLines] = useState<SparePartRequestLine[]>([]);
  const [partLinesLoading, setPartLinesLoading] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const [addPartSparePartId, setAddPartSparePartId] = useState('');
  const [addPartQuantity, setAddPartQuantity] = useState(1);
  const [addPartReason, setAddPartReason] = useState('');
  const [addPartNote, setAddPartNote] = useState('');
  const [addPartErrors, setAddPartErrors] = useState<Record<string, string>>({});
  const [partLineActionLoading, setPartLineActionLoading] = useState('');
  const [rejectLineId, setRejectLineId] = useState('');
  const [stockIssueLineId, setStockIssueLineId] = useState('');
  const [stockIssueWarehouseId, setStockIssueWarehouseId] = useState('');
  const [stockIssueQuantity, setStockIssueQuantity] = useState(0);
  const [stockIssueNotes, setStockIssueNotes] = useState('');
  const [stockIssueLoading, setStockIssueLoading] = useState(false);
  const [stockIssueErrors, setStockIssueErrors] = useState<Record<string, string>>({});
  const [stockIssueCondition, setStockIssueCondition] = useState('NEW');
  const [stockIssueReplacementAction, setStockIssueReplacementAction] = useState('NEW_INSTALLATION');
  const [stockIssueOldInstalledPartId, setStockIssueOldInstalledPartId] = useState('');
  const [stockIssueOldInstalledPart, setStockIssueOldInstalledPart] = useState<MachineInstalledPart | null>(null);
  const [stockIssueRemovedCondition, setStockIssueRemovedCondition] = useState('');
  const [stockIssueRemovedWarehouseId, setStockIssueRemovedWarehouseId] = useState('');
  const [stockIssueNoReturnReason, setStockIssueNoReturnReason] = useState('');
  const [stockIssueCostPurpose, setStockIssueCostPurpose] = useState<string>(MAINTENANCE_COST_PURPOSE);
  const [stockIssueCostPurposeOverrideReason, setStockIssueCostPurposeOverrideReason] = useState('');
  const [stockIssueMovements, setStockIssueMovements] = useState<any[]>([]);
  const [stockIssueMovementsLoading, setStockIssueMovementsLoading] = useState(false);
  const [showStockIssueHistory, setShowStockIssueHistory] = useState('');
  const [conditionBalances, setConditionBalances] = useState<any[]>([]);
  const [conditionBalancesLoading, setConditionBalancesLoading] = useState(false);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [workOrdersLoading, setWorkOrdersLoading] = useState(false);
  const [showCreateWorkOrder, setShowCreateWorkOrder] = useState(false);
  const [createWOLoading, setCreateWOLoading] = useState(false);
  const [createWOForm, setCreateWOForm] = useState({
    title: '', description: '', type: 'CORRECTIVE', priority: 'MEDIUM',
    supervisorId: '', assignedToId: '', warehouseId: '',
    plannedStartAt: '', plannedEndAt: '', estimatedCost: '', notes: '',
  });
  const [createWOErrors, setCreateWOErrors] = useState<Record<string, string>>({});
  const [closeReadiness, setCloseReadiness] = useState<CloseReadiness | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<MaintenanceRequest>(`/maintenance/requests/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await api.get<any>(`/maintenance/request-assignments?maintenanceRequestId=${id}&limit=50`);
      setAssignments(res.data || []);
    } catch { setAssignments([]); }
  }, [id]);

  const fetchPartAccountabilities = useCallback(async () => {
    try {
      const res = await api.get<any>(`/maintenance/part-accountabilities?maintenanceRequestId=${id}&limit=50`);
      setPartAccountabilities(res.data || []);
    } catch { setPartAccountabilities([]); }
  }, [id]);

  const fetchPartLines = useCallback(async () => {
    setPartLinesLoading(true);
    try {
      const res = await api.get<any[]>(`/maintenance/requests/${id}/parts`);
      setPartLines(res || []);
    } catch { setPartLines([]); }
    finally { setPartLinesLoading(false); }
  }, [id]);

  const fetchWorkOrders = useCallback(async () => {
    setWorkOrdersLoading(true);
    try {
      const res = await api.get<any>(`/maintenance-work-orders?requestId=${id}&limit=50`);
      setWorkOrders(res.data || []);
    } catch { setWorkOrders([]); }
    finally { setWorkOrdersLoading(false); }
  }, [id]);

  const fetchCloseReadiness = useCallback(async () => {
    try {
      const res = await api.get<CloseReadiness>(`/maintenance/requests/${id}/close-readiness`);
      setCloseReadiness(res);
    } catch { setCloseReadiness(null); }
  }, [id]);

  useEffect(() => { fetchData(); fetchAssignments(); fetchPartAccountabilities(); fetchPartLines(); fetchWorkOrders(); fetchCloseReadiness(); }, [fetchData, fetchAssignments, fetchPartAccountabilities, fetchPartLines, fetchWorkOrders, fetchCloseReadiness]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const execWorkflow = async (action: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/maintenance/requests/${id}/${action}`, {});
      showToast(t('common.successUpdated'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      handleApiError(err);
    } finally { setActionLoading(false); }
  };

  const confirmAndExec = (action: string) => {
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    edit: () => router.push(`/admin/maintenance/requests/${id}/edit`),
    start: () => confirmAndExec('start'),
    complete: () => confirmAndExec('complete'),
    close: () => confirmAndExec('close'),
    cancel: () => confirmAndExec('cancel'),
    reopen: () => confirmAndExec('reopen'),
    addWorkOrder: () => {
      if (!data) return;
      setCreateWOForm({
        title: data.title || '',
        description: data.description || '',
        type: 'CORRECTIVE',
        priority: data.priority || 'MEDIUM',
        supervisorId: '',
        assignedToId: '',
        warehouseId: '',
        plannedStartAt: '',
        plannedEndAt: '',
        estimatedCost: '',
        notes: '',
      });
      setCreateWOErrors({});
      setShowCreateWorkOrder(true);
    },
  });

  const canCreateWorkOrder = isSuperAdmin || Boolean(permissions?.permissions.includes('maintenance-work-order:create'));
  const requestIsTerminal = data ? ['COMPLETED', 'CANCELLED', 'CLOSED'].includes(data.status) : true;

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'start', labelKey: 'common.start', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(data && data.status === 'OPEN') },
    { id: 'complete', labelKey: 'common.complete', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: !!(data && data.status === 'IN_PROGRESS') },
    { id: 'close', labelKey: 'common.close', icon: <ActionCompleteIcon />, onClick: () => exec('close'), enabled: !!(data && data.status === 'COMPLETED') },
    { id: 'cancel', labelKey: 'common.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(data && (data.status === 'OPEN' || data.status === 'IN_PROGRESS')), variant: 'danger' },
    { id: 'reopen', labelKey: 'common.reopen', icon: <ActionRefreshIcon />, onClick: () => exec('reopen'), enabled: !!(data && (data.status === 'COMPLETED' || data.status === 'CANCELLED' || data.status === 'CLOSED')) },
    { id: 'addWorkOrder', labelKey: 'maintenance.createWorkOrderFromRequest', icon: <ActionAddIcon />, onClick: () => exec('addWorkOrder'), enabled: !!data && !requestIsTerminal && canCreateWorkOrder },
  ]);

  useEffect(() => {
    if (!stockIssueLineId || !partLines.length) { setConditionBalances([]); return; }
    const line = partLines.find(l => l.id === stockIssueLineId);
    if (!line?.sparePartId) { setConditionBalances([]); return; }
    let cancelled = false;
    (async () => {
      setConditionBalancesLoading(true);
      try {
        const res = await api.get<any[]>(`/spare-part-conditions/by-spare-part/${line.sparePartId}`);
        if (!cancelled) setConditionBalances(Array.isArray(res) ? res : []);
      } catch { if (!cancelled) setConditionBalances([]); }
      finally { if (!cancelled) setConditionBalancesLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [stockIssueLineId, partLines]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'tasks', label: t('details.maintenanceRequest.tasks') },
    { id: 'downtimeLogs', label: t('details.maintenanceRequest.downtimeLogs') },
    { id: 'assign', label: t('maintenanceWorkflow.workflowAssign') },
    { id: 'assignments', label: t('maintenance.requestAssignments') },
    { id: 'parts', label: t('maintenanceWorkflow.workflowParts') },
    { id: 'partAccountability', label: t('maintenance.partAccountabilities') },
    { id: 'costs', label: t('maintenanceWorkflow.workflowCosts') },
    { id: 'replacementHistory', label: t('maintenance.replacementHistory') },
    { id: 'workOrders', label: t('maintenance.linkedWorkOrders') },
  ];

  const createWOTypeOptions = ['CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE', 'OVERHAUL', 'OTHER'].map((type) => ({ value: type, label: t(`status.${type}`) }));
  const createWOPriorityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((priority) => ({ value: priority, label: t(`status.${priority}`) }));

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const execPartAction = async (lineId: string, action: string) => {
    setPartLineActionLoading(`${lineId}_${action}`);
    try {
      await api.patch(`/maintenance/requests/${id}/parts/${lineId}/${action}`, {});
      showToast(t('common.successUpdated'), 'success');
      fetchPartLines();
    } catch (err: any) {
      handleApiError(err);
    } finally { setPartLineActionLoading(''); }
  };

  const createWorkOrderFromRequest = async () => {
    const errors: Record<string, string> = {};
    if (!createWOForm.title.trim()) errors.title = t('validation.required');
    setCreateWOErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setCreateWOLoading(true);
    try {
      const payload: any = { title: createWOForm.title.trim(), type: createWOForm.type || 'CORRECTIVE', priority: createWOForm.priority || 'MEDIUM' };
      if (createWOForm.description.trim()) payload.description = createWOForm.description.trim();
      if (createWOForm.supervisorId) payload.supervisorId = createWOForm.supervisorId;
      if (createWOForm.assignedToId) payload.assignedToId = createWOForm.assignedToId;
      if (createWOForm.warehouseId) payload.warehouseId = createWOForm.warehouseId;
      if (createWOForm.plannedStartAt) payload.plannedStartAt = new Date(createWOForm.plannedStartAt).toISOString();
      if (createWOForm.plannedEndAt) payload.plannedEndAt = new Date(createWOForm.plannedEndAt).toISOString();
      if (createWOForm.estimatedCost.trim()) {
        const value = Number(createWOForm.estimatedCost);
        if (!Number.isNaN(value) && value >= 0) payload.estimatedCost = value;
      }
      if (createWOForm.notes.trim()) payload.notes = createWOForm.notes.trim();
      const created = await api.post<any>(`/maintenance-work-orders/from-request/${id}`, payload);
      showToast(t('common.successCreated'), 'success');
      setShowCreateWorkOrder(false);
      setCreateWOForm({
        title: '', description: '', type: 'CORRECTIVE', priority: 'MEDIUM',
        supervisorId: '', assignedToId: '', warehouseId: '',
        plannedStartAt: '', plannedEndAt: '', estimatedCost: '', notes: '',
      });
      fetchWorkOrders();
      if (created?.id) router.push(`/admin/maintenance/work-orders/${created.id}`);
      else fetchData();
    } catch (err: any) {
      handleApiError(err);
    } finally { setCreateWOLoading(false); }
  };

  const addPartLine = async () => {
    const errors: Record<string, string> = {};
    if (!addPartSparePartId) errors.addPartSparePartId = t('maintenance.sparePartLabel') + ' ' + t('common.required');
    if (addPartQuantity <= 0) errors.addPartQuantity = t('maintenance.quantityMustBeGreaterThanZero');
    setAddPartErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setPartLineActionLoading('add');
    try {
      await api.post(`/maintenance/requests/${id}/parts`, {
        sparePartId: addPartSparePartId,
        quantity: addPartQuantity,
        reason: addPartReason || undefined,
        usageNote: addPartNote || undefined,
      });
      showToast(t('common.successCreated'), 'success');
      setShowAddPart(false);
      setAddPartSparePartId('');
      setAddPartQuantity(1);
      setAddPartReason('');
      setAddPartNote('');
      fetchPartLines();
    } catch (err: any) {
      handleApiError(err);
    } finally { setPartLineActionLoading(''); }
  };

  const isStockIssueReplacement = stockIssueReplacementAction !== 'NEW_INSTALLATION';

  // R2-E: changing the action invalidates every action-specific field, so a stale
  // selection can never leak from one action into another submission.
  const selectStockIssueReplacementAction = (action: string) => {
    setStockIssueReplacementAction(action);
    setStockIssueOldInstalledPartId('');
    setStockIssueOldInstalledPart(null);
    setStockIssueRemovedCondition('');
    setStockIssueRemovedWarehouseId('');
    setStockIssueNoReturnReason('');
    setStockIssueErrors((prev) => ({ ...prev, oldInstalledPartId: '', removedPartCondition: '', removedPartWarehouseId: '', noReturnReason: '' }));
  };

  const resetStockIssueForm = () => {
    setStockIssueLineId('');
    setStockIssueWarehouseId('');
    setStockIssueQuantity(0);
    setStockIssueNotes('');
    setStockIssueCondition('NEW');
    setStockIssueReplacementAction('NEW_INSTALLATION');
    setStockIssueOldInstalledPartId('');
    setStockIssueOldInstalledPart(null);
    setStockIssueRemovedCondition('');
    setStockIssueRemovedWarehouseId('');
    setStockIssueNoReturnReason('');
    setStockIssueCostPurpose(MAINTENANCE_COST_PURPOSE);
    setStockIssueCostPurposeOverrideReason('');
  };

  const execStockIssue = async () => {
    const errors: Record<string, string> = {};
    if (!stockIssueWarehouseId) errors.stockIssueWarehouseId = t('sparePartRequest.selectWarehouseForIssue');
    if (stockIssueQuantity <= 0) errors.stockIssueQuantity = t('validation.quantityMustBePositive');
    // R2-E: a true replacement must name the ACTUAL installed part being removed,
    // and the full selected record is what the removed quantity is derived from.
    if (isStockIssueReplacement && (!stockIssueOldInstalledPartId || !stockIssueOldInstalledPart)) {
      errors.oldInstalledPartId = t('sparePartRequest.selectOldInstalledPartRequired');
    }
    if (stockIssueReplacementAction === 'RETURNED_REMOVED_PART') {
      if (!stockIssueRemovedCondition) errors.removedPartCondition = t('sparePartRequest.removedPartConditionRequired');
      if (!stockIssueRemovedWarehouseId) errors.removedPartWarehouseId = t('sparePartRequest.removedPartWarehouseRequired');
    }
    if (stockIssueReplacementAction === 'NO_REMOVED_PART' && !stockIssueNoReturnReason.trim()) {
      errors.noReturnReason = t('sparePartRequest.noReturnReasonRequired');
    }
    if (stockIssueCostPurpose !== MAINTENANCE_COST_PURPOSE && !stockIssueCostPurposeOverrideReason.trim()) {
      errors.costPurposeOverrideReason = t('maintenance.costPurposeOverrideReasonRequired');
    }
    setStockIssueErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setStockIssueLoading(true);
    try {
      const payload: any = {
        warehouseId: stockIssueWarehouseId,
        issuedQuantity: stockIssueQuantity,
        notes: stockIssueNotes || undefined,
        issuedStockCondition: stockIssueCondition,
        replacementAction: stockIssueReplacementAction,
        costPurpose: stockIssueCostPurpose,
        costPurposeOverrideReason: stockIssueCostPurpose !== MAINTENANCE_COST_PURPOSE ? stockIssueCostPurposeOverrideReason.trim() : undefined,
      };
      // Only the installed-part record id is ever sent. The removed spare-part and
      // product identity are derived server-side, so OLD and NEW can never be
      // conflated or dictated by the client.
      if (isStockIssueReplacement) {
        payload.oldInstalledPartId = stockIssueOldInstalledPartId;
      }
      if (stockIssueReplacementAction === 'RETURNED_REMOVED_PART') {
        payload.removedPartCondition = stockIssueRemovedCondition;
        payload.removedPartWarehouseId = stockIssueRemovedWarehouseId;
        // Full-quantity removal of the one physical installed record; the backend
        // re-derives this and fails closed on any mismatch.
        payload.removedPartQuantity = stockIssueOldInstalledPart!.installedQuantity;
      }
      if (stockIssueReplacementAction === 'NO_REMOVED_PART') {
        payload.noReturnReason = stockIssueNoReturnReason.trim();
      }
      await api.post(`/maintenance/requests/${id}/parts/${stockIssueLineId}/stock-issue/issue`, payload);
      showToast(t('common.successUpdated'), 'success');
      resetStockIssueForm();
      fetchPartLines();
    } catch (err: any) {
      handleApiError(err);
    } finally { setStockIssueLoading(false); }
  };

  const fetchStockIssueHistory = async (lineId: string) => {
    setShowStockIssueHistory(lineId);
    setStockIssueMovementsLoading(true);
    try {
      const res = await api.get<any[]>(`/maintenance/requests/${id}/parts/${lineId}/stock-issue`);
      setStockIssueMovements(res || []);
    } catch { setStockIssueMovements([]); }
    finally { setStockIssueMovementsLoading(false); }
  };

  const partStatusBadge = (status: string) => {
    return <StatusBadge status={status} />;
  };

  const canAction = (line: any): Record<string, boolean> => {
    const status: string = line.status;
    const stockIssueStatus: string | null | undefined = line.stockIssueStatus;
    // R2-D: a stock-controlled spare part (linked inventory product) may only be
    // marked USED after a physical stock issue; non-stock parts keep the plain flow.
    const stockControlled = Boolean(line.sparePart?.productId);
    const hasIssues = stockIssueStatus != null && stockIssueStatus !== '' && stockIssueStatus !== 'NOT_ISSUED';
    return {
      request: status === 'DRAFT',
      approve: status === 'REQUESTED',
      reject: status === 'REQUESTED',
      reserve: status === 'APPROVED',
      use: (status === 'RESERVED' || status === 'APPROVED') && (!stockControlled || hasIssues),
      cancel: !['CANCELLED', 'USED', 'REJECTED'].includes(status),
      issueStock: status === 'APPROVED' || status === 'RESERVED',
      hasIssues,
    };
  };

  const statusActions: Record<string, string> = {
    OPEN: 'Start / Cancel',
    IN_PROGRESS: 'Complete / Cancel',
    COMPLETED: 'Close / Reopen',
    CANCELLED: 'Reopen',
    CLOSED: 'Reopen',
  };

  return (
    <div className="space-y-6">
      {closeReadiness && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">{t('maintenanceWorkflow.closeReadinessTitle')}</h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 mb-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${closeReadiness.canComplete ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {t('maintenanceWorkflow.closeReadinessCanComplete')}: {closeReadiness.canComplete ? t('common.yes') : t('common.no')}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${closeReadiness.canClose ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                {t('maintenanceWorkflow.closeReadinessCanClose')}: {closeReadiness.canClose ? t('common.yes') : t('common.no')}
              </span>
            </div>
            {closeReadiness.closeBlockers.length === 0 ? (
              <p className="text-sm text-gray-700">{t('maintenanceWorkflow.closeReadinessReady')}</p>
            ) : (
              <>
                <p className="text-sm text-gray-700 mb-2">{t('maintenanceWorkflow.closeReadinessBlocked')}</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {closeReadiness.closeBlockers.map((b, i) => (
                    <li key={`${b.code}-${i}`}>
                      {t(blockerLabelKey(b.code))}
                      {b.code !== 'REQUEST_NOT_COMPLETED' ? ` (${b.count})` : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.requestNumber')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.requestNumber}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.title') || t('common.name')}</dt><dd className="mt-1 text-sm text-gray-900">{data.title}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            {(data as any).slaStatus && (
              /* R2I-BLOCKER-R2: this rendered the raw slaStatus and escalationLevel values.
                 slaStatus is exactly ON_TRACK|OVERDUE and the escalation level is not a
                 closed enum, so both go through the maintenance label helpers. The
                 existing green/red/grey colour classes are preserved unchanged. */
              <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.slaStatus')}</dt><dd className="mt-1"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(data as any).slaStatus === 'ON_TRACK' ? 'bg-green-100 text-green-800' : (data as any).slaStatus === 'OVERDUE' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{maintenanceSlaStatusLabel((data as any).slaStatus, t)}</span>{(data as any).escalationLevel && (data as any).escalationLevel !== 'NONE' ? <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{t('maintenance.escalated')}: {maintenanceEscalationLevelLabel((data as any).escalationLevel, t)}</span> : null}</dd></div>
            )}
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.machine')}</dt><dd className="mt-1 text-sm text-gray-900">{data.machine?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.productionLine')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).productionLine?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.machineComponent')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).machineComponent?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.operationType')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).operationType?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.costCenter')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).costCenter?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.type')}</dt><dd className="mt-1 text-sm text-gray-900">{t('status.' + data.type)}</dd></div>
            {data.isEmergency && <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.isEmergency')}</dt><dd className="mt-1"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{(t as any)('emergency') || 'Emergency'}</span></dd></div>}
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.priority')}</dt><dd className="mt-1 text-sm text-gray-900">{t('status.' + data.priority)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.requestedBy')}</dt><dd className="mt-1 text-sm text-gray-900">{data.requestedBy?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.assignedTo')}</dt><dd className="mt-1 text-sm text-gray-900">{data.assignedTo?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.estimatedCost')}</dt><dd className="mt-1 text-sm text-gray-900">{data.estimatedCost != null ? data.estimatedCost.toLocaleString() : '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.actualCost')}</dt><dd className="mt-1 text-sm text-gray-900">{data.actualCost != null ? data.actualCost.toLocaleString() : '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.downtimeHours')}</dt><dd className="mt-1 text-sm text-gray-900">{data.downtimeHours != null ? data.downtimeHours : '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.description')}</dt><dd className="mt-1 text-sm text-gray-900">{data.description || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.startedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.startedAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.completedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.completedAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.cancelledAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.cancelledAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.updatedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.updatedAt)}</dd></div>
          </dl>
          {data.status === 'COMPLETED' || data.status === 'CANCELLED' || data.status === 'CLOSED' ? (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">{t('details.readOnlyRecord')}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.operationalContext')}</h2>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.productionLine')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).productionLine?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.machineComponent')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).machineComponent?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.operationType')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).operationType?.name || '-'}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.costContext')}</h2>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.costCenter')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).costCenter?.name || '-'}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.requiredSpareParts')}</h2>
          {data.requiredParts && data.requiredParts.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.sparePartLabel')}</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.requiredQuantity')}</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.unit')}</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">{t('common.status')}</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.usageNote')}</th>
                </tr>
              </thead>
              <tbody>
                {data.requiredParts.map((part: any, idx: number) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2">{part.sparePart?.name || part.sparePartId || '-'}</td>
                    <td className="py-2 px-2">{part.quantity}</td>
                    <td className="py-2 px-2">{part.unit || '-'}</td>
                    {/* R2I-BLOCKER-R2: this ternary only covered PLANNED/REQUESTED/CANCELLED and
                        fell through to the raw enum for APPROVED/REJECTED/RESERVED/USED/DRAFT.
                        Use the same canonical partStatusBadge already used by the required-part
                        lines table below so all seven required-part states are localized. */}
                    <td className="py-2 px-2">{partStatusBadge(part.status)}</td>
                    <td className="py-2 px-2">{part.usageNote || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">{t('maintenance.noRequiredSpareParts')}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card><CardContent><p className="text-sm text-gray-500">{t('details.overview')}</p></CardContent></Card>
      )}

      {activeTab === 'tasks' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.maintenanceRequest.tasks')}</h3></CardHeader>
          <CardContent>
            {!data.tasks || data.tasks.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'title', header: t('common.name'), render: (t: MaintenanceTask) => t.title },
                { key: 'status', header: t('common.status'), render: (t: MaintenanceTask) => <StatusBadge status={t.status} /> },
                { key: 'assignedTo', header: t('maintenance.assignedTo'), render: (t: MaintenanceTask) => t.assignedTo?.name || '-' },
                { key: 'startedAt', header: t('maintenance.startedAt'), render: (t: MaintenanceTask) => fmt(t.startedAt) },
                { key: 'completedAt', header: t('maintenance.completedAt'), render: (t: MaintenanceTask) => fmt(t.completedAt) },
              ]} data={data.tasks} keyExtractor={(t: MaintenanceTask) => t.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'downtimeLogs' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.maintenanceRequest.downtimeLogs')}</h3></CardHeader>
          <CardContent>
            {!data.downtimeLogs || data.downtimeLogs.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'reason', header: t('maintenance.reason'), render: (d: DowntimeLog) => d.reason },
                { key: 'startTime', header: t('maintenance.startTime'), render: (d: DowntimeLog) => fmt(d.startTime) },
                { key: 'endTime', header: t('maintenance.endTime'), render: (d: DowntimeLog) => d.endTime ? fmt(d.endTime) : '-' },
                { key: 'duration', header: t('maintenance.durationHours'), render: (d: DowntimeLog) => d.durationHours ?? '-' },
              ]} data={data.downtimeLogs} keyExtractor={(d: DowntimeLog) => d.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'assign' && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">{t('maintenanceWorkflow.assignDescription')}</p>
            <button onClick={() => router.push(`/admin/maintenance/requests/${id}/assign`)} className="text-blue-600 hover:text-blue-800 font-medium">{t('maintenanceWorkflow.workflowAssign')}</button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'assignments' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.requestAssignments')}</h3></CardHeader>
          <CardContent>
            {assignments.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'personnel', header: t('maintenance.personnel'), render: (r: any) => r.maintenancePersonnel ? `[${r.maintenancePersonnel.code}] ${r.maintenancePersonnel.name}` : '-' },
                { key: 'assignmentRole', header: t('maintenance.assignmentRole') },
                { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
                { key: 'assignedAt', header: t('common.createdAt'), render: (r: any) => fmt(r.assignedAt) },
              ]} data={assignments} keyExtractor={(r: any) => r.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'parts' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">{t('sparePartRequest.requestedParts')}</h3>
              <button onClick={() => setShowAddPart(true)} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('sparePartRequest.addSparePart')}</button>
            </div>
          </CardHeader>
          <CardContent>
            {showAddPart && (
              <div className="mb-6 p-4 border rounded-lg bg-gray-50 space-y-3">
                <h4 className="text-sm font-medium text-gray-700">{t('sparePartRequest.addSparePart')}</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.sparePartLabel')}</label>
                  <F9Lookup value={addPartSparePartId} onChange={(v) => { setAddPartSparePartId(v); setAddPartErrors(prev => ({ ...prev, addPartSparePartId: '' })); }} adapter={sparePartAdapter} />
                  {addPartErrors.addPartSparePartId && <p className="text-red-500 text-sm mt-1">{addPartErrors.addPartSparePartId}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('sparePartRequest.requestedQuantity')}</label>
                    <input type="number" min="0.01" step="0.01" value={addPartQuantity} onChange={e => { setAddPartQuantity(parseFloat(e.target.value) || 0); setAddPartErrors(prev => ({ ...prev, addPartQuantity: '' })); }} className="w-full border rounded px-2 py-1 text-sm" />
                    {addPartErrors.addPartQuantity && <p className="text-red-500 text-sm mt-1">{addPartErrors.addPartQuantity}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('sparePartRequest.requestReason')}</label>
                    <input type="text" value={addPartReason} onChange={e => setAddPartReason(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.usageNote')}</label>
                  <input type="text" value={addPartNote} onChange={e => setAddPartNote(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={addPartLine} disabled={partLineActionLoading === 'add'} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{t('common.save')}</button>
                  <button onClick={() => setShowAddPart(false)} className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">{t('common.cancel')}</button>
                </div>
                <p className="text-xs text-amber-600 mt-2">{t('sparePartRequest.noStockDeducted')}</p>
              </div>
            )}
            {partLinesLoading ? <LoadingState /> : partLines.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">{t('maintenance.noRequiredSpareParts')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.sparePartLabel')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('sparePartRequest.requestedQuantity')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('sparePartRequest.reason')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('common.status')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partLines.map((line) => {
                      const actions = canAction(line);
                      const stockIssueStatusColor = line.stockIssueStatus === 'FULLY_ISSUED' ? 'bg-green-100 text-green-700' : line.stockIssueStatus === 'PARTIALLY_ISSUED' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700';
                      return (
                        <tr key={line.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2">{line.sparePart ? `[${line.sparePart.code}] ${line.sparePart.name}` : line.sparePartId}</td>
                          <td className="py-2 px-2">{line.quantity}</td>
                          <td className="py-2 px-2">{line.reason || '-'}</td>
                          <td className="py-2 px-2">{partStatusBadge(line.status)}</td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap gap-1">
                              {actions.request && (
                                <button onClick={() => execPartAction(line.id, 'request')} disabled={partLineActionLoading === `${line.id}_request`} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">{t('sparePartRequest.requestSparePart')}</button>
                              )}
                              {actions.approve && (
                                <button onClick={() => execPartAction(line.id, 'approve')} disabled={partLineActionLoading === `${line.id}_approve`} className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50">{t('sparePartRequest.approveSparePart')}</button>
                              )}
                              {actions.reject && (
                                <button onClick={() => execPartAction(line.id, 'reject')} disabled={partLineActionLoading === `${line.id}_reject`} className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50">{t('sparePartRequest.rejectSparePart')}</button>
                              )}
                              {actions.reserve && (
                                <button onClick={() => execPartAction(line.id, 'reserve')} disabled={partLineActionLoading === `${line.id}_reserve`} className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50">{t('sparePartRequest.operationalReservation')}</button>
                              )}
                              {actions.use && (
                                <button onClick={() => execPartAction(line.id, 'use')} disabled={partLineActionLoading === `${line.id}_use`} className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50">{t('sparePartRequest.markPartUsed')}</button>
                              )}
                              {actions.issueStock && (
                                <button onClick={() => setStockIssueLineId(line.id)} className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">{t('sparePartRequest.issueStock')}</button>
                              )}
                              {actions.hasIssues && (
                                <button onClick={() => fetchStockIssueHistory(line.id)} className="px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200">{t('sparePartRequest.stockIssueHistory')}</button>
                              )}
                              {actions.cancel && (
                                <button onClick={() => execPartAction(line.id, 'cancel')} disabled={partLineActionLoading === `${line.id}_cancel`} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50">{t('sparePartRequest.cancelRequest')}</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">{t('sparePartRequest.noStockDeducted')} — {t('sparePartRequest.noInventoryMovement')} {t('sparePartRequest.issueStock')}</p>
          </CardContent>
        </Card>
      )}

      {stockIssueLineId && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">{t('sparePartRequest.issueStockToWarehouse')}</h3>
              <button onClick={resetStockIssueForm} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('inventory.warehouse')}</label>
              <F9Lookup value={stockIssueWarehouseId} onChange={(v) => { setStockIssueWarehouseId(v); setStockIssueErrors(prev => ({ ...prev, stockIssueWarehouseId: '' })); }} adapter={warehouseAdapter} />
              {stockIssueErrors.stockIssueWarehouseId && <p className="text-red-500 text-sm mt-1">{stockIssueErrors.stockIssueWarehouseId}</p>}
              <p className="text-xs text-amber-600 mt-1">{t('sparePartRequest.selectSparePartWarehouseOnly')}</p>
            </div>
            {conditionBalancesLoading ? (
              <p className="text-xs text-gray-400">{t('common.loading')}</p>
            ) : conditionBalances.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('sparePartRequest.availableConditionBalances')}</label>
                <div className="flex flex-wrap gap-2">
                  {conditionBalances.map((cb: any) => {
                    const conditionLabels: Record<string, string> = {
                      NEW: t('sparePartRequest.conditionNew'),
                      USED_SERVICEABLE: t('sparePartRequest.conditionUsedServiceable'),
                      USED_REPAIRABLE: t('sparePartRequest.conditionUsedRepairable'),
                      DAMAGED_REPAIRABLE: t('sparePartRequest.conditionDamagedRepairable'),
                      DAMAGED_NOT_REPAIRABLE: t('sparePartRequest.conditionDamagedNotRepairable'),
                    };
                    return (
                      <span key={cb.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                        {conditionLabels[cb.condition] || cb.condition}: <strong>{cb.availableQuantity}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('sparePartRequest.issuedQuantity')}</label>
              <input type="number" min="0.001" step="0.001" value={stockIssueQuantity || ''} onChange={e => { setStockIssueQuantity(parseFloat(e.target.value) || 0); setStockIssueErrors(prev => ({ ...prev, stockIssueQuantity: '' })); }} className="w-full border rounded px-2 py-1 text-sm" />
              {stockIssueErrors.stockIssueQuantity && <p className="text-red-500 text-sm mt-1">{stockIssueErrors.stockIssueQuantity}</p>}
            </div>
            <Select label={t('sparePartRequest.issuedStockCondition')} value={stockIssueCondition} onChange={e => setStockIssueCondition(e.target.value)} options={[
              { value: 'NEW', label: t('sparePartRequest.conditionNew') },
              { value: 'USED_SERVICEABLE', label: t('sparePartRequest.conditionUsedServiceable') },
              { value: 'USED_REPAIRABLE', label: t('sparePartRequest.conditionUsedRepairable') },
              { value: 'DAMAGED_REPAIRABLE', label: t('sparePartRequest.conditionDamagedRepairable') },
              { value: 'DAMAGED_NOT_REPAIRABLE', label: t('sparePartRequest.conditionDamagedNotRepairable') },
            ]} />
            <Select
              label={t('common.costPurpose.label')}
              value={stockIssueCostPurpose}
              onChange={e => setStockIssueCostPurpose(e.target.value)}
              options={COST_PURPOSE_VALUES.map(v => ({ value: v, label: t('common.costPurpose.' + v) }))}
            />
            {canOverrideCostPurpose && stockIssueCostPurpose !== MAINTENANCE_COST_PURPOSE && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.costPurpose.overrideReason')}</label>
                <input type="text" value={stockIssueCostPurposeOverrideReason} onChange={e => setStockIssueCostPurposeOverrideReason(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" placeholder={t('common.costPurpose.overrideReasonHint')} />
                {stockIssueErrors.costPurposeOverrideReason && <p className="text-red-500 text-sm mt-1">{stockIssueErrors.costPurposeOverrideReason}</p>}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('sparePartRequest.replacementAction')}</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['RETURNED_REMOVED_PART', 'NO_REMOVED_PART', 'NEW_INSTALLATION'].map(action => (
                  <button key={action} type="button" onClick={() => selectStockIssueReplacementAction(action)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${stockIssueReplacementAction === action ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {action === 'RETURNED_REMOVED_PART' ? t('sparePartRequest.replacementReturnedRemoved') : action === 'NO_REMOVED_PART' ? t('sparePartRequest.replacementNoRemoved') : t('sparePartRequest.replacementNewInstallation')}
                  </button>
                ))}
              </div>
            </div>
            {isStockIssueReplacement && (
              <div className="p-3 border border-indigo-200 rounded-lg bg-indigo-50 space-y-3">
                <p className="text-xs font-medium text-indigo-700">{t('sparePartRequest.oldInstalledPartSection')}</p>
                <F9Lookup
                  name="oldInstalledPartId"
                  label={t('sparePartRequest.oldInstalledPart')}
                  value={stockIssueOldInstalledPartId}
                  onChange={(value) => { setStockIssueOldInstalledPartId(value); if (!value) setStockIssueOldInstalledPart(null); }}
                  onItemSelect={(part: MachineInstalledPart) => setStockIssueOldInstalledPart(part)}
                  adapter={machineInstalledPartAdapter}
                  filters={{ machineId: data?.machineId || '', status: 'ACTIVE' }}
                  placeholder={t('sparePartRequest.oldInstalledPartPlaceholder')}
                  error={stockIssueErrors.oldInstalledPartId}
                />
                {/* R2-E read-only derived context: the removed part's identity is
                    shown, never typed. The backend re-derives and re-validates it. */}
                {stockIssueOldInstalledPart && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-700 bg-white rounded border border-indigo-100 p-2">
                    <dt className="text-gray-500">{t('sparePartRequest.oldPartSparePart')}</dt>
                    <dd className="font-medium">{stockIssueOldInstalledPart.sparePart ? `[${stockIssueOldInstalledPart.sparePart.code}] ${stockIssueOldInstalledPart.sparePart.name}` : '-'}</dd>
                    <dt className="text-gray-500">{t('sparePartRequest.oldPartCondition')}</dt>
                    <dd className="font-medium">{stockIssueOldInstalledPart.installedCondition}</dd>
                    <dt className="text-gray-500">{t('sparePartRequest.oldPartQuantity')}</dt>
                    <dd className="font-medium">{stockIssueOldInstalledPart.installedQuantity}</dd>
                    <dt className="text-gray-500">{t('sparePartRequest.oldPartComponent')}</dt>
                    <dd className="font-medium">{stockIssueOldInstalledPart.machineComponent?.name || t('sparePartRequest.machineLevelPart')}</dd>
                    {stockIssueOldInstalledPart.serialNumber && (
                      <>
                        <dt className="text-gray-500">{t('sparePartRequest.oldPartSerial')}</dt>
                        <dd className="font-medium">{stockIssueOldInstalledPart.serialNumber}</dd>
                      </>
                    )}
                    {stockIssueOldInstalledPart.batchNumber && (
                      <>
                        <dt className="text-gray-500">{t('sparePartRequest.oldPartBatch')}</dt>
                        <dd className="font-medium">{stockIssueOldInstalledPart.batchNumber}</dd>
                      </>
                    )}
                  </dl>
                )}
                {stockIssueReplacementAction === 'RETURNED_REMOVED_PART' && (
                  <div className="space-y-3 border-t border-indigo-100 pt-3">
                    <p className="text-xs font-medium text-amber-700">{t('sparePartRequest.removedPartFields')}</p>
                    <Select label={t('sparePartRequest.removedPartCondition')} value={stockIssueRemovedCondition} onChange={e => setStockIssueRemovedCondition(e.target.value)} options={[
                      { value: '', label: t('common.select') },
                      { value: 'NEW', label: t('sparePartRequest.conditionNew') },
                      { value: 'USED_SERVICEABLE', label: t('sparePartRequest.conditionUsedServiceable') },
                      { value: 'USED_REPAIRABLE', label: t('sparePartRequest.conditionUsedRepairable') },
                      { value: 'DAMAGED_REPAIRABLE', label: t('sparePartRequest.conditionDamagedRepairable') },
                      { value: 'DAMAGED_NOT_REPAIRABLE', label: t('sparePartRequest.conditionDamagedNotRepairable') },
                    ]} />
                    {stockIssueErrors.removedPartCondition && <p className="text-red-500 text-sm">{stockIssueErrors.removedPartCondition}</p>}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('sparePartRequest.removedPartWarehouse')}</label>
                      <F9Lookup value={stockIssueRemovedWarehouseId} onChange={setStockIssueRemovedWarehouseId} adapter={warehouseAdapter} />
                      {stockIssueErrors.removedPartWarehouseId && <p className="text-red-500 text-sm mt-1">{stockIssueErrors.removedPartWarehouseId}</p>}
                    </div>
                    <div>
                      {/* The returned quantity is the full installed quantity of the
                          selected physical part. It is displayed read-only because a
                          partial removal of one installed record is not representable. */}
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('sparePartRequest.removedPartQuantity')}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        readOnly
                        value={stockIssueOldInstalledPart?.installedQuantity ?? ''}
                        placeholder={t('sparePartRequest.removedPartQuantityDerived')}
                        className="w-full border rounded px-2 py-1 text-sm bg-gray-50 text-gray-700"
                      />
                      {stockIssueErrors.removedPartQuantity && <p className="text-red-500 text-sm mt-1">{stockIssueErrors.removedPartQuantity}</p>}
                    </div>
                  </div>
                )}
                {stockIssueReplacementAction === 'NO_REMOVED_PART' && (
                  <div className="border-t border-indigo-100 pt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('sparePartRequest.noReturnReason')}</label>
                    <input type="text" value={stockIssueNoReturnReason} onChange={e => setStockIssueNoReturnReason(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                    {stockIssueErrors.noReturnReason && <p className="text-red-500 text-sm mt-1">{stockIssueErrors.noReturnReason}</p>}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.notes')}</label>
              <input type="text" value={stockIssueNotes} onChange={e => setStockIssueNotes(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={execStockIssue} disabled={stockIssueLoading} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">{t('sparePartRequest.issueStock')}</button>
              <button onClick={resetStockIssueForm} className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">{t('common.cancel')}</button>
            </div>
          </CardContent>
        </Card>
      )}

      {showStockIssueHistory && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">{t('sparePartRequest.stockIssueHistory')}</h3>
              <button onClick={() => setShowStockIssueHistory('')} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
          </CardHeader>
          <CardContent>
            {stockIssueMovementsLoading ? <LoadingState /> : stockIssueMovements.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
            ) : (
              <DataTable columns={[
                { key: 'movementNumber', header: t('common.number'), render: (m: any) => m.movementNumber },
                { key: 'movementType', header: t('common.type'), render: (m: any) => m.movementType === 'MAINTENANCE_ISSUE' ? t('sparePartRequest.issueStock') : t('sparePartRequest.returnStock') },
                { key: 'warehouse', header: t('inventory.warehouse'), render: (m: any) => m.warehouse?.name || '-' },
                { key: 'lines', header: t('sparePartRequest.issuedQuantity'), render: (m: any) => m.lines?.map((l: any) => `${l.product?.name || l.productId} x ${l.quantity} (${l.direction})`).join(', ') || '-' },
                { key: 'createdAt', header: t('common.createdAt'), render: (m: any) => fmt(m.createdAt) },
              ]} data={stockIssueMovements} keyExtractor={(m: any) => m.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'partAccountability' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.partAccountabilities')}</h3></CardHeader>
          <CardContent>
            {partAccountabilities.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'sparePart', header: t('maintenance.sparePartLabel'), render: (r: any) => r.sparePart ? `[${r.sparePart.code}] ${r.sparePart.name}` : '-' },
                { key: 'personnel', header: t('maintenance.personnel'), render: (r: any) => r.maintenancePersonnel ? `[${r.maintenancePersonnel.code}] ${r.maintenancePersonnel.name}` : '-' },
                { key: 'quantity', header: t('maintenance.assignedQuantity'), render: (r: any) => r.quantity },
                { key: 'reportedUsedQuantity', header: t('maintenance.reportedUsedQuantity'), render: (r: any) => r.reportedUsedQuantity ?? '-' },
                { key: 'returnedQuantity', header: t('maintenance.returnedQuantity'), render: (r: any) => r.returnedQuantity ?? '-' },
                { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
              ]} data={partAccountabilities} keyExtractor={(r: any) => r.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'costs' && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">{t('maintenanceWorkflow.costEntriesDescription')}</p>
            <button onClick={() => router.push(`/admin/maintenance/requests/${id}/cost`)} className="text-blue-600 hover:text-blue-800 font-medium">{t('maintenanceWorkflow.workflowCosts')}</button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'replacementHistory' && (
        <ReplacementHistoryCard requestId={id} />
      )}

      {activeTab === 'workOrders' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">{t('maintenance.linkedWorkOrders')}</h3>
              {!requestIsTerminal && canCreateWorkOrder && (
                <button onClick={() => exec('addWorkOrder')} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('maintenance.createWorkOrderFromRequest')}</button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 mb-3">{t('maintenance.createWorkOrderFromRequestHint')}</p>
            {workOrdersLoading ? <LoadingState /> : workOrders.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">{t('maintenance.noLinkedWorkOrders')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.workOrderNumber')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.workOrderTitle')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.workOrderStatus')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.workOrderType')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.workOrderMachine')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workOrders.map((wo) => (
                      <tr key={wo.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">{wo.workOrderNumber}</td>
                        <td className="py-2 px-2">{wo.title}</td>
                        <td className="py-2 px-2"><StatusBadge status={wo.status} /></td>
                        <td className="py-2 px-2">{t('status.' + wo.type)}</td>
                        <td className="py-2 px-2">{wo.machine ? `[${wo.machine.code}] ${wo.machine.name}` : '-'}</td>
                        <td className="py-2 px-2">
                          <button onClick={() => router.push(`/admin/maintenance/work-orders/${wo.id}`)} className="text-blue-600 hover:text-blue-800 font-medium">{t('maintenance.goToWorkOrder')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showCreateWorkOrder && (
        <Modal open={showCreateWorkOrder} onClose={() => setShowCreateWorkOrder(false)} title={t('maintenance.createWorkOrderFromRequest')}>
          <div className="space-y-4">
            {createWOErrors.form && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createWOErrors.form}</div>}
            <Input label={t('maintenance.workOrderTitle')} name="title" value={createWOForm.title} onChange={(e) => { setCreateWOForm({ ...createWOForm, title: e.target.value }); setCreateWOErrors(prev => ({ ...prev, title: '' })); }} error={createWOErrors.title} required />
            <Textarea label={t('maintenance.workOrderDescription')} name="description" value={createWOForm.description} onChange={(e) => { setCreateWOForm({ ...createWOForm, description: e.target.value }); setCreateWOErrors(prev => ({ ...prev, description: '' })); }} error={createWOErrors.description} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('maintenance.workOrderType')} name="type" value={createWOForm.type} onChange={(e) => setCreateWOForm({ ...createWOForm, type: e.target.value })} options={createWOTypeOptions} />
              <Select label={t('maintenance.workOrderPriority')} name="priority" value={createWOForm.priority} onChange={(e) => setCreateWOForm({ ...createWOForm, priority: e.target.value })} options={createWOPriorityOptions} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('maintenance.workOrderSupervisor')} name="supervisorId" value={createWOForm.supervisorId} onChange={(v) => setCreateWOForm({ ...createWOForm, supervisorId: v })} adapter={userAdapter} />
              <F9Lookup label={t('maintenance.workOrderAssignedTo')} name="assignedToId" value={createWOForm.assignedToId} onChange={(v) => setCreateWOForm({ ...createWOForm, assignedToId: v })} adapter={userAdapter} />
            </div>
            <F9Lookup label={t('maintenance.workOrderWarehouse')} name="warehouseId" value={createWOForm.warehouseId} onChange={(v) => setCreateWOForm({ ...createWOForm, warehouseId: v })} adapter={warehouseAdapter} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label={t('maintenance.workOrderPlannedStart')} name="plannedStartAt" type="datetime-local" value={createWOForm.plannedStartAt} onChange={(e) => setCreateWOForm({ ...createWOForm, plannedStartAt: e.target.value })} />
              <Input label={t('maintenance.workOrderPlannedEnd')} name="plannedEndAt" type="datetime-local" value={createWOForm.plannedEndAt} onChange={(e) => setCreateWOForm({ ...createWOForm, plannedEndAt: e.target.value })} />
              <Input label={t('maintenance.workOrderEstimatedCost')} name="estimatedCost" type="number" min="0" step="0.01" value={createWOForm.estimatedCost} onChange={(e) => setCreateWOForm({ ...createWOForm, estimatedCost: e.target.value })} />
            </div>
            <Textarea label={t('maintenance.workOrderNotes')} name="notes" value={createWOForm.notes} onChange={(e) => setCreateWOForm({ ...createWOForm, notes: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setShowCreateWorkOrder(false)}>{t('actions.cancel')}</Button>
              <Button onClick={createWorkOrderFromRequest} loading={createWOLoading}>{t('actions.save')}</Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => execWorkflow(pendingAction)}
        title={t('common.confirm')}
        message={t('common.confirmDeactivateMessage')}
        variant={pendingAction === 'cancel' ? 'danger' : 'primary'} loading={actionLoading} />
    </div>
  );
}
