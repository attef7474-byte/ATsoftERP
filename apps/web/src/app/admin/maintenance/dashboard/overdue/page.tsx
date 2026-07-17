'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Card, CardHeader, CardContent, DataTable, PageHeader, LoadingState, ErrorState, EmptyState } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { MaintenanceRequest, MaintenanceSchedule } from '../../../../../lib/admin-types';
import { useRegisterAdminActions, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

export default function OverduePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ requests: MaintenanceRequest[]; schedules: MaintenanceSchedule[] }>('/maintenance/dashboard/overdue');
      setRequests(res.requests || []);
      setSchedules(res.schedules || []);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => router.push('/admin/maintenance/dashboard') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: fetchData },
  ]);

  const requestColumns = [
    { key: 'requestNumber', header: t('maintenance.requestNumber') },
    { key: 'title', header: t('common.title') },
    { key: 'machine', header: t('maintenance.machine'), render: (r: MaintenanceRequest) => r.machine?.name || '-' },
    { key: 'priority', header: t('maintenance.priority') },
    { key: 'status', header: t('common.status'), render: (r: MaintenanceRequest) => <CmmsStatusBadge status={r.status} /> },
    { key: 'createdAt', header: t('common.createdAt'), render: (r: MaintenanceRequest) => new Date(r.createdAt).toLocaleDateString() },
  ];

  const scheduleColumns = [
    { key: 'title', header: t('common.title') },
    { key: 'machine', header: t('maintenance.machine'), render: (s: MaintenanceSchedule) => s.machine?.name || '-' },
    { key: 'maintenanceType', header: t('maintenance.maintenanceType') },
    { key: 'startDate', header: t('maintenance.startDate'), render: (s: MaintenanceSchedule) => new Date(s.startDate).toLocaleDateString() },
    { key: 'status', header: t('common.status'), render: (s: MaintenanceSchedule) => <CmmsStatusBadge status={s.status} /> },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t('maintenanceDashboard.overdueItems')} />
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">{t('maintenanceDashboard.overdueRequests')}</h2></CardHeader>
        <CardContent>
          {requests.length === 0 ? <EmptyState message={t('common.noData')} /> : (
            <DataTable columns={requestColumns} data={requests} keyExtractor={(r: MaintenanceRequest) => r.id} onRowClick={(item) => router.push(`/admin/maintenance/requests/${item.id}`)} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">{t('maintenanceDashboard.overdueSchedules')}</h2></CardHeader>
        <CardContent>
          {schedules.length === 0 ? <EmptyState message={t('common.noData')} /> : (
            <DataTable columns={scheduleColumns} data={schedules} keyExtractor={(s: MaintenanceSchedule) => s.id} onRowClick={(item) => router.push(`/admin/maintenance/schedules/${item.id}`)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
