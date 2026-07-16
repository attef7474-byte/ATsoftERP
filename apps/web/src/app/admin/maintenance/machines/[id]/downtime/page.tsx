'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { DowntimeLog } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function MachineDowntimePage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const id = params.id as string;
  const [data, setData] = useState<DowntimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<DowntimeLog[]>(`/maintenance/machines/${id}/downtime`);
      setData(Array.isArray(res) ? res : []);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceWorkflow.machineDowntime')}</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">{t('maintenanceWorkflow.machineDowntimeDescription')}</p>
          {data.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <DataTable columns={[
              { key: 'reason', header: t('maintenance.reason'), render: (d: DowntimeLog) => d.reason },
              { key: 'startTime', header: t('maintenance.startTime'), render: (d: DowntimeLog) => fmt(d.startTime) },
              { key: 'endTime', header: t('maintenance.endTime'), render: (d: DowntimeLog) => d.endTime ? fmt(d.endTime) : '-' },
              { key: 'durationHours', header: t('maintenance.durationHours'), render: (d: DowntimeLog) => d.durationHours != null ? d.durationHours.toFixed(2) : '-' },
              { key: 'status', header: t('common.status'), render: (d: DowntimeLog) => (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.status === 'ACTIVE' ? 'bg-yellow-100 text-yellow-800' : d.status === 'CLOSED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{d.status}</span>
              )},
              { key: 'request', header: t('maintenance.maintenanceRequest'), render: (d: DowntimeLog) => d.request?.requestNumber || '-' },
            ]} data={data} keyExtractor={(d: DowntimeLog) => d.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
