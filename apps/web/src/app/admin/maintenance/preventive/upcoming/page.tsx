'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { MaintenanceSchedule } from '../../../../../lib/admin-types';
import { Card, DataTable, PageHeader, LoadingState, EmptyState, ErrorState } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

export default function UpcomingPreventivePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MaintenanceSchedule[] }>('/maintenance/preventive/upcoming');
      setData(res.data || []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'title', header: t('common.title'), render: (s: MaintenanceSchedule) => <a href={`/admin/maintenance/schedules/${s.id}`} className="text-blue-600 hover:text-blue-800">{s.title}</a> },
    { key: 'machine', header: t('maintenance.machine'), render: (s: MaintenanceSchedule) => s.machine?.name || '-' },
    { key: 'maintenanceType', header: t('maintenance.maintenanceType'), render: (s: MaintenanceSchedule) => t(`status.${s.maintenanceType}` as any) || s.maintenanceType },
    { key: 'startDate', header: t('maintenance.startDate'), render: (s: MaintenanceSchedule) => s.startDate ? new Date(s.startDate).toLocaleDateString() : '-' },
    { key: 'status', header: t('common.status'), render: (s: MaintenanceSchedule) => <CmmsStatusBadge status={s.status} /> },
    { key: 'nextDueAt', header: t('maintenance.nextDue'), render: (s: MaintenanceSchedule) => s.nextDueAt ? new Date(s.nextDueAt).toLocaleDateString() : '-' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.upcomingPreventive')} />
      {error && <ErrorState message={error} onRetry={fetchData} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(s: MaintenanceSchedule) => s.id} />
        </Card>
      )}
    </div>
  );
}
