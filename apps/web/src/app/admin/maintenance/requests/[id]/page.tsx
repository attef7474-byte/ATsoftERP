'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { MaintenanceRequest, MaintenanceTask, DowntimeLog } from '../../../../../lib/admin-types';

interface RequestDetail extends MaintenanceRequest {
  tasks?: MaintenanceTask[];
  downtimeLogs?: DowntimeLog[];
  requiredParts?: any[];
}
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon, ActionBarcodeIcon } from '../../../../../components/admin/admin-action-bar';

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
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<MaintenanceRequest>(`/maintenance/requests/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

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
    cancel: () => confirmAndExec('cancel'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'start', labelKey: 'common.start', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(data && data.status === 'OPEN') },
    { id: 'complete', labelKey: 'common.complete', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: !!(data && data.status === 'IN_PROGRESS') },
    { id: 'cancel', labelKey: 'common.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(data && (data.status === 'OPEN' || data.status === 'IN_PROGRESS')), variant: 'danger' },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'tasks', label: t('details.maintenanceRequest.tasks') },
    { id: 'downtimeLogs', label: t('details.maintenanceRequest.downtimeLogs') },
    { id: 'assign', label: t('maintenanceWorkflow.workflowAssign') },
    { id: 'parts', label: t('maintenanceWorkflow.workflowParts') },
    { id: 'costs', label: t('maintenanceWorkflow.workflowCosts') },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const statusActions: Record<string, string> = {
    OPEN: 'Start / Cancel',
    IN_PROGRESS: 'Complete / Cancel',
    COMPLETED: 'Read-only',
    CANCELLED: 'Read-only',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.requestNumber')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.requestNumber}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.title') || t('common.name')}</dt><dd className="mt-1 text-sm text-gray-900">{data.title}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.machine')}</dt><dd className="mt-1 text-sm text-gray-900">{data.machine?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.productionLine')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).productionLine?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.machineComponent')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).machineComponent?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.operationType')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).operationType?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.costCenter')}</dt><dd className="mt-1 text-sm text-gray-900">{(data as any).costCenter?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.maintenanceRequest.type')}</dt><dd className="mt-1 text-sm text-gray-900">{t('status.' + data.type)}</dd></div>
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
          {data.status === 'COMPLETED' || data.status === 'CANCELLED' ? (
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

      {activeTab === 'parts' && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">{t('maintenanceWorkflow.usedPartsDescription')}</p>
            <button onClick={() => router.push(`/admin/maintenance/requests/${id}/parts`)} className="text-blue-600 hover:text-blue-800 font-medium">{t('maintenanceWorkflow.workflowParts')}</button>
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
        title={t('common.confirm')} message={t('inventoryCounting.confirm' + pendingAction.charAt(0).toUpperCase() + pendingAction.slice(1) + 'Count') || t('common.confirmDeactivateMessage')}
        variant={pendingAction === 'cancel' ? 'danger' : 'primary'} loading={actionLoading} />
    </div>
  );
}
