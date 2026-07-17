'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { DowntimeLog, PaginatedResponse } from '../../../../../../lib/admin-types';
import { Card, CardContent, DataTable, Pagination, PageHeader, LoadingState, ErrorState, EmptyState } from '../../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

interface MachineInfo {
  id: string;
  name: string;
  code: string;
}

export default function DowntimeByMachinePage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const machineId = params.machineId as string;
  const [data, setData] = useState<DowntimeLog[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const res = await api.get<PaginatedResponse<DowntimeLog>>(`/maintenance/downtime-logs/by-machine/${machineId}`, { params: { page, limit: 10 } });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [machineId, t]);

  const fetchMachine = useCallback(async () => {
    try {
      const res = await api.get<MachineInfo>(`/maintenance/machines/${machineId}`);
      setMachine(res);
    } catch { /* ignore */ }
  }, [machineId]);

  useEffect(() => { fetchData(); fetchMachine(); }, []);

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const columns = [
    { key: 'reason', header: t('maintenance.reason') },
    { key: 'startTime', header: t('maintenance.startTime'), render: (d: DowntimeLog) => fmt(d.startTime) },
    { key: 'endTime', header: t('maintenance.endTime'), render: (d: DowntimeLog) => d.endTime ? fmt(d.endTime) : '-' },
    { key: 'duration', header: t('maintenance.duration'), render: (d: DowntimeLog) => d.durationHours != null ? `${d.durationHours.toFixed(2)} h` : (d.durationMinutes != null ? `${d.durationMinutes} min` : '-') },
    { key: 'status', header: t('common.status'), render: (d: DowntimeLog) => <CmmsStatusBadge status={d.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (d: DowntimeLog) => (
        <button onClick={() => router.push(`/admin/maintenance/downtime-logs/${d.id}`)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          {t('actions.view')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('maintenance.downtimeByMachine')} subtitle={machine ? `${machine.name} (${machine.code})` : undefined} />

      {machine && (
        <Card>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('maintenance.machine')}</dt>
                <dd className="mt-1 text-sm text-gray-900 font-semibold">{machine.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('details.machine.code')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{machine.code}</dd>
              </div>
              <div className="flex items-end">
                <a href={`/admin/maintenance/machines/${machine.id}`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  {t('actions.viewDetails')}
                </a>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(d: DowntimeLog) => d.id} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
