'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { MaintenanceTask } from '../../../../../lib/admin-types';
import { Card, DataTable, PageHeader, LoadingState, EmptyState, ErrorState } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

export default function MyMaintenanceTasksPage() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<{ data: MaintenanceTask[] }>('/maintenance/tasks/my-tasks', { params });
      setData(res.data || []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [statusFilter, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const statusOptions = ['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  const columns = [
    { key: 'title', header: t('common.title') },
    { key: 'request', header: t('maintenance.maintenanceRequest'), render: (tk: MaintenanceTask) => tk.request?.requestNumber || '-' },
    { key: 'status', header: t('common.status'), render: (tk: MaintenanceTask) => <CmmsStatusBadge status={tk.status} /> },
    { key: 'createdAt', header: t('common.createdAt'), render: (tk: MaintenanceTask) => fmt(tk.createdAt) },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.myTasks')} />
      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="block rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('common.allStatuses')}</option>
          {statusOptions.filter(Boolean).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {error && <ErrorState message={error} onRetry={fetchData} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(tk: MaintenanceTask) => tk.id} />
        </Card>
      )}
    </div>
  );
}
