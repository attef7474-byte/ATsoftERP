'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { DowntimeLog, PaginationMeta } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, PageHeader, Input, LoadingState, ErrorState, EmptyState, Button } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

interface AnalysisResponse {
  summary: {
    totalLogs: number;
    totalDurationHours: number;
  };
  byMachine: { machineId: string; machineName: string; count: number; totalDurationHours: number }[];
  byReason: { reason: string; count: number; totalDurationHours: number }[];
  recentLogs: DowntimeLog[];
  meta?: PaginationMeta;
}

export default function DowntimeAnalysisPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = useCallback(async (sd?: string, ed?: string) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = {};
      if (sd) params.startDate = sd;
      if (ed) params.endDate = ed;
      const res = await api.get<AnalysisResponse>('/maintenance/downtime-logs/analysis', { params });
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, []);

  const handleFilter = () => { fetchData(startDate || undefined, endDate || undefined); };
  const handleClear = () => { setStartDate(''); setEndDate(''); fetchData(); };

  const { exec } = useStableHandlers({
    refresh: () => fetchData(startDate || undefined, endDate || undefined),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const machineColumns = [
    { key: 'machineName', header: t('common.machine') },
    { key: 'count', header: t('common.count'), render: (d: any) => d.count },
    { key: 'totalDurationHours', header: t('common.totalHours'), render: (d: any) => `${Number(d.totalDurationHours).toFixed(2)} h` },
  ];

  const reasonColumns = [
    { key: 'reason', header: t('common.reason') },
    { key: 'count', header: t('common.count'), render: (d: any) => d.count },
    { key: 'totalDurationHours', header: t('common.totalHours'), render: (d: any) => `${Number(d.totalDurationHours).toFixed(2)} h` },
  ];

  const recentColumns = [
    { key: 'machine', header: t('common.machine'), render: (d: DowntimeLog) => d.machine?.name || '-' },
    { key: 'reason', header: t('common.reason') },
    { key: 'startTime', header: t('common.startTime'), render: (d: DowntimeLog) => new Date(d.startTime).toLocaleString() },
    { key: 'endTime', header: t('common.endTime'), render: (d: DowntimeLog) => d.endTime ? new Date(d.endTime).toLocaleString() : '-' },
    { key: 'duration', header: t('common.duration'), render: (d: DowntimeLog) => d.durationHours != null ? `${d.durationHours.toFixed(2)} h` : (d.durationMinutes != null ? `${d.durationMinutes} min` : '-') },
  ];

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={() => fetchData(startDate || undefined, endDate || undefined)} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t('downtimeAnalysis.title')} />

      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <Input label={t('common.startDate')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label={t('common.endDate')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <Button onClick={handleFilter} disabled={loading}>{t('actions.filter')}</Button>
            {(startDate || endDate) && <Button variant="secondary" onClick={handleClear}>{t('actions.clear')}</Button>}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorState message={error} onRetry={() => fetchData(startDate || undefined, endDate || undefined)} />}
      {loading && <LoadingState />}

      {!error && !loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="text-center">
                <p className="text-sm text-gray-500">{t('common.totalLogs')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{data.summary.totalLogs}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center">
                <p className="text-sm text-gray-500">{t('common.totalHours')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{Number(data.summary.totalDurationHours).toFixed(2)} h</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center">
                <p className="text-sm text-gray-500">{t('common.average')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {data.summary.totalLogs > 0 ? `${(data.summary.totalDurationHours / data.summary.totalLogs).toFixed(2)} h` : '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          {data.byMachine && data.byMachine.length > 0 && (
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('downtimeAnalysis.byMachine')}</h3></CardHeader>
              <DataTable columns={machineColumns} data={data.byMachine} keyExtractor={(d: any) => d.machineId} />
            </Card>
          )}

          {data.byReason && data.byReason.length > 0 && (
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('downtimeAnalysis.byCategory')}</h3></CardHeader>
              <DataTable columns={reasonColumns} data={data.byReason} keyExtractor={(d: any) => d.reason} />
            </Card>
          )}

          {data.recentLogs && data.recentLogs.length > 0 && (
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('common.recent')}</h3></CardHeader>
              <DataTable columns={recentColumns} data={data.recentLogs} keyExtractor={(d: DowntimeLog) => d.id} />
            </Card>
          )}
        </>
      )}

      {!error && !loading && data && data.byMachine?.length === 0 && data.byReason?.length === 0 && data.recentLogs?.length === 0 && (
        <EmptyState message={t('common.noData')} />
      )}
    </div>
  );
}