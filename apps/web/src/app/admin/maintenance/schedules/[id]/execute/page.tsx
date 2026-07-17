'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { MaintenanceSchedule } from '../../../../../../lib/admin-types';
import { Button, Card, CardContent, PageHeader, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionStartIcon } from '../../../../../../components/admin/admin-action-bar';

export default function ExecuteSchedulePage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const id = params?.id as string;

  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ id: string } | null>(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MaintenanceSchedule }>(`/maintenance/schedules/${id}`);
      setSchedule(res.data);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const res = await api.post<{ data: { id: string } }>(`/maintenance/schedules/${id}/execute`);
      setExecutionResult(res.data);
      showToast(t('maintenance.executionCreated'), 'success');
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setExecuting(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchSchedule(),
    execute: () => handleExecute(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'execute', labelKey: 'maintenance.execute', icon: <ActionStartIcon />, onClick: () => exec('execute'), enabled: !executing && !executionResult },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchSchedule} />;
  if (!schedule) return <ErrorState message={t('errors.notFound')} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t('maintenance.executeSchedule')} subtitle={schedule.title} />
      <Card>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-sm text-gray-500">{t('common.title')}</span><p className="font-medium">{schedule.title}</p></div>
              <div><span className="text-sm text-gray-500">{t('maintenance.machine')}</span><p className="font-medium">{schedule.machine?.name || '-'}</p></div>
              <div><span className="text-sm text-gray-500">{t('maintenance.maintenanceType')}</span><p className="font-medium">{t(`status.${schedule.maintenanceType}` as any) || schedule.maintenanceType}</p></div>
              <div><span className="text-sm text-gray-500">{t('maintenance.frequency')}</span><p className="font-medium">{t(`status.${schedule.frequency}` as any) || schedule.frequency}</p></div>
              <div><span className="text-sm text-gray-500">{t('common.status')}</span><p><CmmsStatusBadge status={schedule.status} /></p></div>
              <div><span className="text-sm text-gray-500">{t('maintenance.nextDue')}</span><p className="font-medium">{schedule.nextDueAt ? new Date(schedule.nextDueAt).toLocaleDateString() : '-'}</p></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {executionResult ? (
        <Card>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-green-600 text-lg font-semibold mb-2">{t('maintenance.executionSuccess')}</div>
              <p className="text-gray-500 mb-4">{t('maintenance.executionCreatedMessage')}</p>
              <a href={`/admin/maintenance/checklist-executions/${executionResult.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                {t('maintenance.viewExecution')}
              </a>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-center">
          <Button onClick={handleExecute} loading={executing} size="lg">{t('maintenance.confirmExecute')}</Button>
        </div>
      )}
    </div>
  );
}
