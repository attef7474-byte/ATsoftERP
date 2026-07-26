'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useRegisterAdminActions, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { Card, CardContent } from '../../../../../components/admin/ui/card';
import { DataTable } from '../../../../../components/admin/ui/data-table';
import { Pagination } from '../../../../../components/admin/ui/pagination';
import { LoadingState } from '../../../../../components/admin/ui/loading-state';
import { ErrorState } from '../../../../../components/admin/ui/error-state';
import { EmptyState } from '../../../../../components/admin/ui/empty-state';
import { StatusBadge } from '../../../../../components/admin/ui/status-badge';

export default function SlaDuePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<any>('/maintenance/calendar-workload/sla-due', { params: { page, limit: 10 } });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRegisterAdminActions([
    { id: 'back', labelKey: 'actions.back', icon: <ActionBackIcon />, onClick: () => { window.location.href = '/admin/maintenance/workload'; } },
    { id: 'refresh', labelKey: 'actions.refresh', icon: <ActionRefreshIcon />, onClick: () => fetchData(meta.page) },
  ]);

  const columns = [
    { key: 'requestNumber', header: t('maintenance.requestNumber'), render: (r: any) => <a href={`/admin/maintenance/requests/${r.id}`} className="text-blue-600 hover:underline">{r.requestNumber}</a> },
    { key: 'title', header: t('maintenance.title') },
    { key: 'machine', header: t('maintenance.machine'), render: (r: any) => r.machine?.name || '-' },
    { key: 'assignedTo', header: t('maintenance.assignedTo'), render: (r: any) => r.assignedTo?.name || '-' },
    { key: 'completeDueAt', header: t('maintenance.dueDate'), render: (r: any) => r.completeDueAt ? new Date(r.completeDueAt).toLocaleDateString() : '-' },
    { key: 'slaStatus', header: t('maintenance.slaStatus'), render: (r: any) => <StatusBadge status={(r as any).slaStatus} /> },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => fetchData(meta.page)} />;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{t('maintenance.slaDueWork')}</h1>
      <Card><CardContent>
        {data.length === 0 ? <EmptyState message={t('maintenance.noScheduledWork')} /> : <><DataTable columns={columns} data={data} keyExtractor={(r: any) => r.id} /><Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} /></>}
      </CardContent></Card>
    </div>
  );
}
