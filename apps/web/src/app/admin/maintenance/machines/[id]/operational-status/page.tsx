'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Card, CardContent, CardHeader, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

interface OperationalStatusData {
  id: string;
  code: string;
  name: string;
  status: string;
  category: { id: string; name: string; code: string } | null;
  activeRequests: number;
  openTasks: number;
  activeDowntime: number;
  totalDowntimeHoursThisMonth: number;
  nextMaintenanceDueDate: string | null;
  nextMaintenanceTitle: string | null;
  dueStatus: string | null;
}

export default function OperationalStatusPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<OperationalStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: OperationalStatusData }>(`/maintenance/machines/${id}/operational-status`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.push(`/admin/maintenance/machines/${id}`),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold text-gray-900">{t('maintenance.machine')}: {data.name}</h3></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm font-medium text-gray-700">{t('common.status')}:</span>
            <StatusBadge status={data.status} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-700">{data.activeRequests}</p>
              <p className="text-xs text-blue-600 mt-1">{t('cmms.activeRequests')}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-700">{data.openTasks}</p>
              <p className="text-xs text-amber-600 mt-1">{t('cmms.openTasks')}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-700">{data.activeDowntime}</p>
              <p className="text-xs text-red-600 mt-1">{t('cmms.activeDowntime')}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-purple-700">{data.totalDowntimeHoursThisMonth}</p>
              <p className="text-xs text-purple-600 mt-1">{t('cmms.downtimeHours')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenanceSchedules')}</h3></CardHeader>
        <CardContent>
          {data.nextMaintenanceDueDate ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{data.nextMaintenanceTitle || '-'}</p>
                <p className="text-xs text-gray-500">{new Date(data.nextMaintenanceDueDate).toLocaleDateString()}</p>
              </div>
              {data.dueStatus && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  data.dueStatus === 'overdue' ? 'bg-red-100 text-red-700' :
                  data.dueStatus === 'dueSoon' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {t('cmms.' + data.dueStatus)}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('common.noData')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
