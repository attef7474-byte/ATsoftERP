'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { MaintenanceChecklistExecution } from '../../../../../lib/admin-types';
import { Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

export default function PreventiveExecutionHistoryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<MaintenanceChecklistExecution[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MaintenanceChecklistExecution[]; meta: any }>('/maintenance/preventive/execution-history', { params: { page, limit: 10 } });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'schedule', header: t('common.title'), render: (e: MaintenanceChecklistExecution) =>
      e.schedule ? <a href={`/admin/maintenance/schedules/${e.scheduleId}`} className="text-blue-600 hover:text-blue-800">{e.schedule.title}</a> : '-'
    },
    { key: 'startedAt', header: t('maintenance.executionDate'), render: (e: MaintenanceChecklistExecution) => e.startedAt ? new Date(e.startedAt).toLocaleString() : '-' },
    { key: 'status', header: t('common.status'), render: (e: MaintenanceChecklistExecution) => <CmmsStatusBadge status={e.status} /> },
    { key: 'completedBy', header: t('maintenance.completedBy'), render: (e: MaintenanceChecklistExecution) => e.completedBy?.name || '-' },
    { key: 'request', header: t('maintenance.requestNumber'), render: (e: MaintenanceChecklistExecution) =>
      e.request ? <a href={`/admin/maintenance/requests/${e.requestId}`} className="text-blue-600 hover:text-blue-800">{e.request.requestNumber}</a> : '-'
    },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.executionHistory')} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(e: MaintenanceChecklistExecution) => e.id} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
