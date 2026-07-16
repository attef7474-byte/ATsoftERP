'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { MachineMaintenanceLog, MaintenanceRequest, MaintenanceTask, DowntimeLog } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function MachineMaintenanceLogPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const id = params.id as string;
  const [data, setData] = useState<MachineMaintenanceLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('requests');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<MachineMaintenanceLog>(`/maintenance/machines/${id}/maintenance-log`);
      setData(res);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const tabs = [
    { id: 'requests', label: t('maintenanceWorkflow.completedRequests') },
    { id: 'tasks', label: t('maintenanceWorkflow.completedTasks') },
    { id: 'downtime', label: t('maintenanceWorkflow.downtimeRecords') },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceWorkflow.maintenanceLog')}</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">{t('maintenanceWorkflow.maintenanceLogDescription')}</p>

          <div className="flex gap-1 border-b overflow-x-auto mb-4">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
            ))}
          </div>

          {activeTab === 'requests' && (
            data?.requests && data.requests.length > 0 ? (
              <DataTable columns={[
                { key: 'requestNumber', header: t('maintenance.requestNumber'), render: (r: MaintenanceRequest) => r.requestNumber },
                { key: 'title', header: t('common.title'), render: (r: MaintenanceRequest) => r.title },
                { key: 'type', header: t('maintenance.maintenanceType'), render: (r: MaintenanceRequest) => t('status.' + r.type) },
                { key: 'assignedTo', header: t('maintenance.assignedTo'), render: (r: MaintenanceRequest) => r.assignedTo?.name || '-' },
                { key: 'endDate', header: t('maintenance.completedAt'), render: (r: MaintenanceRequest) => fmt(r.endDate) },
              ]} data={data.requests} keyExtractor={(r: MaintenanceRequest) => r.id} />
            ) : <p className="text-sm text-gray-500 py-4">{t('maintenanceWorkflow.noCompletedRequests')}</p>
          )}

          {activeTab === 'tasks' && (
            data?.tasks && data.tasks.length > 0 ? (
              <DataTable columns={[
                { key: 'title', header: t('common.title'), render: (t: MaintenanceTask) => t.title },
                { key: 'request', header: t('maintenance.maintenanceRequest'), render: (t: MaintenanceTask) => t.request?.title || '-' },
                { key: 'assignedTo', header: t('maintenance.assignedTo'), render: (t: MaintenanceTask) => t.assignedTo?.name || '-' },
                { key: 'completedAt', header: t('maintenance.completedAt'), render: (t: MaintenanceTask) => fmt(t.completedAt) },
              ]} data={data.tasks} keyExtractor={(t: MaintenanceTask) => t.id} />
            ) : <p className="text-sm text-gray-500 py-4">{t('maintenanceWorkflow.noCompletedTasks')}</p>
          )}

          {activeTab === 'downtime' && (
            data?.downtimeLogs && data.downtimeLogs.length > 0 ? (
              <DataTable columns={[
                { key: 'reason', header: t('maintenance.reason'), render: (d: DowntimeLog) => d.reason },
                { key: 'startTime', header: t('maintenance.startTime'), render: (d: DowntimeLog) => fmt(d.startTime) },
                { key: 'endTime', header: t('maintenance.endTime'), render: (d: DowntimeLog) => d.endTime ? fmt(d.endTime) : '-' },
                { key: 'duration', header: t('maintenance.durationHours'), render: (d: DowntimeLog) => d.durationHours != null ? d.durationHours.toFixed(2) : '-' },
              ]} data={data.downtimeLogs} keyExtractor={(d: DowntimeLog) => d.id} />
            ) : <p className="text-sm text-gray-500 py-4">{t('maintenanceWorkflow.noDowntimeRecords')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
