'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { MaintenanceChecklistExecution, MaintenanceChecklistExecutionItem } from '../../../../../../lib/admin-types';
import { Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState } from '../../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function ScheduleExecutionHistoryPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<MaintenanceChecklistExecution[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MaintenanceChecklistExecution[]; meta: any }>(`/maintenance/schedules/${id}/history`, { params: { page, limit: 10 } });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => window.history.back(),
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'startedAt', header: t('maintenance.executionDate'), render: (e: MaintenanceChecklistExecution) => e.startedAt ? new Date(e.startedAt).toLocaleString() : '-' },
    { key: 'status', header: t('common.status'), render: (e: MaintenanceChecklistExecution) => <CmmsStatusBadge status={e.status} /> },
    { key: 'completedBy', header: t('maintenance.completedBy'), render: (e: MaintenanceChecklistExecution) => e.completedBy?.name || '-' },
    { key: 'itemCount', header: t('maintenance.itemCount'), render: (e: MaintenanceChecklistExecution) => e._count?.items ?? '-' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.executionHistory')} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(e: MaintenanceChecklistExecution) => e.id}
            onRowClick={(item: MaintenanceChecklistExecution) => setExpandedId(expandedId === item.id ? null : item.id)} />
          {data.map((execution) => (
            expandedId === execution.id && (
              <div key={`exp-${execution.id}`} className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                <h4 className="text-sm font-semibold mb-2">{t('maintenance.executionItems')}</h4>
                {execution.items && execution.items.length > 0 ? (
                  <ul className="space-y-1">
                    {execution.items.map((item: MaintenanceChecklistExecutionItem) => (
                      <li key={item.id} className="text-sm flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${item.passed ? 'bg-green-500' : item.status === 'COMPLETED' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                        {item.checklistItem?.title || '-'}
                        <span className="text-gray-400 text-xs">{item.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">{t('common.noData')}</p>
                )}
              </div>
            )
          ))}
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
