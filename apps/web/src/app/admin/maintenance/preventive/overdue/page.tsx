'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { MaintenanceSchedule } from '../../../../../lib/admin-types';
import { Card, DataTable, PageHeader, LoadingState, EmptyState, ErrorState } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

export default function OverduePreventivePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MaintenanceSchedule[] }>('/maintenance/preventive/overdue');
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

  const getDaysOverdue = (schedule: MaintenanceSchedule): number => {
    const dueDate = schedule.nextDueAt || schedule.startDate;
    if (!dueDate) return 0;
    const diff = new Date().getTime() - new Date(dueDate).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const columns = [
    { key: 'title', header: t('common.title'), render: (s: MaintenanceSchedule) => <a href={`/admin/maintenance/schedules/${s.id}`} className="text-blue-600 hover:text-blue-800">{s.title}</a> },
    { key: 'machine', header: t('maintenance.machine'), render: (s: MaintenanceSchedule) => s.machine?.name || '-' },
    { key: 'maintenanceType', header: t('maintenance.maintenanceType'), render: (s: MaintenanceSchedule) => t(`status.${s.maintenanceType}` as any) || s.maintenanceType },
    { key: 'startDate', header: t('maintenance.startDate'), render: (s: MaintenanceSchedule) => s.startDate ? new Date(s.startDate).toLocaleDateString() : '-' },
    { key: 'daysOverdue', header: t('maintenance.daysOverdue'), render: (s: MaintenanceSchedule) => <span className="text-red-600 font-semibold">{getDaysOverdue(s)}</span> },
    { key: 'status', header: t('common.status'), render: (s: MaintenanceSchedule) => <CmmsStatusBadge status={s.status} /> },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.overduePreventive')} />
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
