'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { MaintenanceRequest, MaintenanceTask, DowntimeLog, SparePartRequestLine } from '../../../../../lib/admin-types';

interface RequestDetail extends MaintenanceRequest {
  tasks?: MaintenanceTask[];
  downtimeLogs?: DowntimeLog[];
  requiredParts?: any[];
}
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge, ConfirmDialog, Select } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon, ActionBarcodeIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup, sparePartAdapter, warehouseAdapter } from '../../../../../components/f9';

export default function MaintenanceRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
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
  const [partLineActionLoading, setPartLineActionLoading] = useState('');
  const [rejectLineId, setRejectLineId] = useState('');
  const [stockIssueLineId, setStockIssueLineId] = useState('');
  const [stockIssueWarehouseId, setStockIssueWarehouseId] = useState('');
  const [stockIssueQuantity, setStockIssueQuantity] = useState(0);
  const [stockIssueNotes, setStockIssueNotes] = useState('');
  const [stockIssueLoading, setStockIssueLoading] = useState(false);
  const [stockIssueCondition, setStockIssueCondition] = useState('NEW');
  const [stockIssueReplacementAction, setStockIssueReplacementAction] = useState('NEW_INSTALLATION');
  const [stockIssueRemovedCondition, setStockIssueRemovedCondition] = useState('');
  const [stockIssueRemovedWarehouseId, setStockIssueRemovedWarehouseId] = useState('');
  const [stockIssueRemovedQuantity, setStockIssueRemovedQuantity] = useState(0);
  const [stockIssueNoReturnReason, setStockIssueNoReturnReason] = useState('');
  const [stockIssueMovements, setStockIssueMovements] = useState<any[]>([]);
  const [stockIssueMovementsLoading, setStockIssueMovementsLoading] = useState(false);
  const [showStockIssueHistory, setShowStockIssueHistory] = useState('');

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

  useEffect(() => { fetchData(); fetchAssignments(); fetchPartAccountabilities(); fetchPartLines(); }, [fetchData, fetchAssignments, fetchPartAccountabilities, fetchPartLines]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const execWorkflow = async (action: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/maintenance/requests/${id}/${action}`, {});
      showToast(t('common.successUpdated'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
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
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'start', labelKey: 'common.start', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(data && data.status === 'OPEN') },
    { id: 'complete', labelKey: 'common.complete', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: !!(data && data.status === 'IN_PROGRESS') },
    { id: 'close', labelKey: 'common.close', icon: <ActionCompleteIcon />, onClick: () => exec('close'), enabled: !!(data && data.status === 'COMPLETED') },
    { id: 'cancel', labelKey: 'common.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(data && (data.status === 'OPEN' || data.status === 'IN_PROGRESS')), variant: 'danger' },
    { id: 'reopen', labelKey: 'common.reopen', icon: <ActionRefreshIcon />, onClick: () => exec('reopen'), enabled: !!(data && (data.status === 'COMPLETED' || data.status === 'CANCELLED' || data.status === 'CLOSED')) },
  ]);

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
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const execPartAction = async (lineId: string, action: string) => {
    setPartLineActionLoading(`${lineId}_${action}`);
    try {
      await api.patch(`/maintenance/requests/${id}/parts/${lineId}/${action}`, {});
      showToast(t('common.successUpdated'), 'success');
      fetchPartLines();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setPartLineActionLoading(''); }
  };

  const addPartLine = async () => {
    if (!addPartSparePartId) { showToast(t('maintenance.sparePartLabel') + ' ' + t('common.required'), 'error'); return; }
    if (addPartQuantity <= 0) { showToast(t('maintenance.quantityMustBeGreaterThanZero'), 'error'); return; }
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
      showToast(err?.message || t('errors.createFailed'), 'error');
    } finally { setPartLineActionLoading(''); }
  };

  const execStockIssue = async () => {
    if (!stockIssueWarehouseId) { showToast(t('maintenance.sparePartRequest.selectWarehouseForIssue'), 'error'); return; }
    if (stockIssueQuantity <= 0) { showToast(t('validation.quantityMustBePositive'), 'error'); return; }
    setStockIssueLoading(true);
    try {
      const payload: any = {
        warehouseId: stockIssueWarehouseId,
        issuedQuantity: stockIssueQuantity,
        notes: stockIssueNotes || undefined,
        issuedStockCondition: stockIssueCondition,
        replacementAction: stockIssueReplacementAction,
      };
      if (stockIssueReplacementAction === 'RETURNED_REMOVED_PART') {
        payload.removedPartCondition = stockIssueRemovedCondition;
        payload.removedPartWarehouseId = stockIssueRemovedWarehouseId;
        payload.removedPartQuantity = stockIssueRemovedQuantity;
      }
      if (stockIssueReplacementAction === 'NO_REMOVED_PART') {
        payload.noReturnReason = stockIssueNoReturnReason;
      }
      await api.post(`/maintenance/requests/${id}/parts/${stockIssueLineId}/stock-issue/issue`, payload);
      showToast(t('common.successUpdated'), 'success');
      setStockIssueLineId('');
      setStockIssueWarehouseId('');
      setStockIssueQuantity(0);
      setStockIssueNotes('');
      setStockIssueCondition('NEW');
      setStockIssueReplacementAction('NEW_INSTALLATION');
      setStockIssueRemovedCondition('');
      setStockIssueRemovedWarehouseId('');
      setStockIssueRemovedQuantity(0);
      setStockIssueNoReturnReason('');
      fetchPartLines();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
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

  const canAction = (status: string, stockIssueStatus?: string | null): Record<string, boolean> => ({
    request: status === 'DRAFT',
    approve: status === 'REQUESTED',
    reject: status === 'REQUESTED',
    reserve: status === 'APPROVED',
    use: status === 'RESERVED' || status === 'APPROVED',
    cancel: !['CANCELLED', 'USED', 'REJECTED'].includes(status),
    issueStock: status === 'APPROVED' || status === 'RESERVED',
    hasIssues: stockIssueStatus != null && stockIssueStatus !== '' && stockIssueStatus !== 'NOT_ISSUED',
  });

  const statusActions: Record<string, string> = {
    OPEN: 'Start / Cancel',
    IN_PROGRESS: 'Complete / Cancel',
    COMPLETED: 'Close / Reopen',
    CANCELLED: 'Reopen',
    CLOSED: 'Reopen',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.requestNumber')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.requestNumber}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.title') || t('common.name')}</dt><dd className="mt-1 text-sm text-gray-900">{data.title}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            {(data as any).slaStatus && (
              <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.slaStatus')}</dt><dd className="mt-1"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(data as any).slaStatus === 'ON_TRACK' ? 'bg-green-100 text-green-800' : (data as any).slaStatus === 'OVERDUE' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{(data as any).slaStatus}</span>{(data as any).escalationLevel && (data as any).escalationLevel !== 'NONE' ? <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{t('maintenance.escalated')}: {(data as any).escalationLevel}</span> : null}</dd></div>
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
                    <td className="py-2 px-2">{part.status === 'PLANNED' ? t('maintenance.statusPlanned') : part.status === 'REQUESTED' ? t('maintenance.statusRequested') : part.status === 'CANCELLED' ? t('maintenance.statusCancelled') : part.status || '-'}</td>
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
              <h3 className="text-sm font-semibold text-gray-700">{t('maintenance.sparePartRequest.requestedParts')}</h3>
              <button onClick={() => setShowAddPart(true)} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('maintenance.sparePartRequest.addSparePart')}</button>
            </div>
          </CardHeader>
          <CardContent>
            {showAddPart && (
              <div className="mb-6 p-4 border rounded-lg bg-gray-50 space-y-3">
                <h4 className="text-sm font-medium text-gray-700">{t('maintenance.sparePartRequest.addSparePart')}</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.sparePartLabel')}</label>
                  <F9Lookup value={addPartSparePartId} onChange={setAddPartSparePartId} adapter={sparePartAdapter} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.sparePartRequest.requestedQuantity')}</label>
                    <input type="number" min="0.01" step="0.01" value={addPartQuantity} onChange={e => setAddPartQuantity(parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.sparePartRequest.requestReason')}</label>
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
                <p className="text-xs text-amber-600 mt-2">{t('maintenance.sparePartRequest.noStockDeducted')}</p>
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
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.sparePartRequest.requestedQuantity')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('maintenance.sparePartRequest.reason')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('common.status')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-500">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partLines.map((line) => {
                      const actions = canAction(line.status, line.stockIssueStatus);
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
                                <button onClick={() => execPartAction(line.id, 'request')} disabled={partLineActionLoading === `${line.id}_request`} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">{t('maintenance.sparePartRequest.requestSparePart')}</button>
                              )}
                              {actions.approve && (
                                <button onClick={() => execPartAction(line.id, 'approve')} disabled={partLineActionLoading === `${line.id}_approve`} className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50">{t('maintenance.sparePartRequest.approveSparePart')}</button>
                              )}
                              {actions.reject && (
                                <button onClick={() => execPartAction(line.id, 'reject')} disabled={partLineActionLoading === `${line.id}_reject`} className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50">{t('maintenance.sparePartRequest.rejectSparePart')}</button>
                              )}
                              {actions.reserve && (
                                <button onClick={() => execPartAction(line.id, 'reserve')} disabled={partLineActionLoading === `${line.id}_reserve`} className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50">{t('maintenance.sparePartRequest.operationalReservation')}</button>
                              )}
                              {actions.use && (
                                <button onClick={() => execPartAction(line.id, 'use')} disabled={partLineActionLoading === `${line.id}_use`} className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50">{t('maintenance.sparePartRequest.markPartUsed')}</button>
                              )}
                              {actions.issueStock && (
                                <button onClick={() => setStockIssueLineId(line.id)} className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">{t('maintenance.sparePartRequest.issueStock')}</button>
                              )}
                              {actions.hasIssues && (
                                <button onClick={() => fetchStockIssueHistory(line.id)} className="px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200">{t('maintenance.sparePartRequest.stockIssueHistory')}</button>
                              )}
                              {actions.cancel && (
                                <button onClick={() => execPartAction(line.id, 'cancel')} disabled={partLineActionLoading === `${line.id}_cancel`} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50">{t('maintenance.sparePartRequest.cancelRequest')}</button>
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
            <p className="text-xs text-gray-400 mt-3">{t('maintenance.sparePartRequest.noStockDeducted')} — {t('maintenance.sparePartRequest.noInventoryMovement')} {t('maintenance.sparePartRequest.issueStock')}</p>
          </CardContent>
        </Card>
      )}

      {stockIssueLineId && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">{t('maintenance.sparePartRequest.issueStockToWarehouse')}</h3>
              <button onClick={() => { setStockIssueLineId(''); setStockIssueWarehouseId(''); setStockIssueQuantity(0); setStockIssueNotes(''); setStockIssueCondition('NEW'); setStockIssueReplacementAction('NEW_INSTALLATION'); setStockIssueRemovedCondition(''); setStockIssueRemovedWarehouseId(''); setStockIssueRemovedQuantity(0); setStockIssueNoReturnReason(''); }} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('inventory.warehouse')}</label>
              <F9Lookup value={stockIssueWarehouseId} onChange={setStockIssueWarehouseId} adapter={warehouseAdapter} />
              <p className="text-xs text-amber-600 mt-1">{t('maintenance.sparePartRequest.selectSparePartWarehouseOnly')}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.sparePartRequest.issuedQuantity')}</label>
              <input type="number" min="0.001" step="0.001" value={stockIssueQuantity || ''} onChange={e => setStockIssueQuantity(parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <Select label={t('maintenance.sparePartRequest.issuedStockCondition')} value={stockIssueCondition} onChange={e => setStockIssueCondition(e.target.value)} options={[
              { value: 'NEW', label: t('maintenance.sparePartRequest.conditionNew') },
              { value: 'USED_SERVICEABLE', label: t('maintenance.sparePartRequest.conditionUsedServiceable') },
              { value: 'USED_REPAIRABLE', label: t('maintenance.sparePartRequest.conditionUsedRepairable') },
              { value: 'DAMAGED_REPAIRABLE', label: t('maintenance.sparePartRequest.conditionDamagedRepairable') },
              { value: 'DAMAGED_NOT_REPAIRABLE', label: t('maintenance.sparePartRequest.conditionDamagedNotRepairable') },
            ]} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.sparePartRequest.replacementAction')}</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['RETURNED_REMOVED_PART', 'NO_REMOVED_PART', 'NEW_INSTALLATION'].map(action => (
                  <button key={action} type="button" onClick={() => setStockIssueReplacementAction(action)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${stockIssueReplacementAction === action ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {action === 'RETURNED_REMOVED_PART' ? t('maintenance.sparePartRequest.replacementReturnedRemoved') : action === 'NO_REMOVED_PART' ? t('maintenance.sparePartRequest.replacementNoRemoved') : t('maintenance.sparePartRequest.replacementNewInstallation')}
                  </button>
                ))}
              </div>
            </div>
            {stockIssueReplacementAction === 'RETURNED_REMOVED_PART' && (
              <div className="p-3 border border-amber-200 rounded-lg bg-amber-50 space-y-3">
                <p className="text-xs font-medium text-amber-700">{t('maintenance.sparePartRequest.removedPartFields')}</p>
                <Select label={t('maintenance.sparePartRequest.removedPartCondition')} value={stockIssueRemovedCondition} onChange={e => setStockIssueRemovedCondition(e.target.value)} options={[
                  { value: '', label: t('common.select') },
                  { value: 'NEW', label: t('maintenance.sparePartRequest.conditionNew') },
                  { value: 'USED_SERVICEABLE', label: t('maintenance.sparePartRequest.conditionUsedServiceable') },
                  { value: 'USED_REPAIRABLE', label: t('maintenance.sparePartRequest.conditionUsedRepairable') },
                  { value: 'DAMAGED_REPAIRABLE', label: t('maintenance.sparePartRequest.conditionDamagedRepairable') },
                  { value: 'DAMAGED_NOT_REPAIRABLE', label: t('maintenance.sparePartRequest.conditionDamagedNotRepairable') },
                ]} />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.sparePartRequest.removedPartWarehouse')}</label>
                  <F9Lookup value={stockIssueRemovedWarehouseId} onChange={setStockIssueRemovedWarehouseId} adapter={warehouseAdapter} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.sparePartRequest.removedPartQuantity')}</label>
                  <input type="number" min="0" step="0.001" value={stockIssueRemovedQuantity || ''} onChange={e => setStockIssueRemovedQuantity(parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1 text-sm" />
                </div>
              </div>
            )}
            {stockIssueReplacementAction === 'NO_REMOVED_PART' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.sparePartRequest.noReturnReason')}</label>
                <input type="text" value={stockIssueNoReturnReason} onChange={e => setStockIssueNoReturnReason(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('maintenance.notes')}</label>
              <input type="text" value={stockIssueNotes} onChange={e => setStockIssueNotes(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={execStockIssue} disabled={stockIssueLoading} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">{t('maintenance.sparePartRequest.issueStock')}</button>
              <button onClick={() => { setStockIssueLineId(''); setStockIssueWarehouseId(''); setStockIssueQuantity(0); setStockIssueNotes(''); setStockIssueCondition('NEW'); setStockIssueReplacementAction('NEW_INSTALLATION'); setStockIssueRemovedCondition(''); setStockIssueRemovedWarehouseId(''); setStockIssueRemovedQuantity(0); setStockIssueNoReturnReason(''); }} className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">{t('common.cancel')}</button>
            </div>
          </CardContent>
        </Card>
      )}

      {showStockIssueHistory && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">{t('maintenance.sparePartRequest.stockIssueHistory')}</h3>
              <button onClick={() => setShowStockIssueHistory('')} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
          </CardHeader>
          <CardContent>
            {stockIssueMovementsLoading ? <LoadingState /> : stockIssueMovements.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
            ) : (
              <DataTable columns={[
                { key: 'movementNumber', header: t('common.number'), render: (m: any) => m.movementNumber },
                { key: 'movementType', header: t('common.type'), render: (m: any) => m.movementType === 'MAINTENANCE_ISSUE' ? t('maintenance.sparePartRequest.issueStock') : t('maintenance.sparePartRequest.returnStock') },
                { key: 'warehouse', header: t('inventory.warehouse'), render: (m: any) => m.warehouse?.name || '-' },
                { key: 'lines', header: t('maintenance.sparePartRequest.issuedQuantity'), render: (m: any) => m.lines?.map((l: any) => `${l.product?.name || l.productId} x ${l.quantity} (${l.direction})`).join(', ') || '-' },
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

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => execWorkflow(pendingAction)}
        title={t('common.confirm')}
        message={t('common.confirmDeactivateMessage')}
        variant={pendingAction === 'cancel' ? 'danger' : 'primary'} loading={actionLoading} />
    </div>
  );
}
