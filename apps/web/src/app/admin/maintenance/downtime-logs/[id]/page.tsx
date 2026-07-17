'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { DowntimeLog } from '../../../../../lib/admin-types';
import { Card, CardContent, LoadingState, ErrorState, ConfirmDialog } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionCancelIcon, ActionStartIcon, ActionCompleteIcon } from '../../../../../components/admin/admin-action-bar';

export default function DowntimeLogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<DowntimeLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<DowntimeLog>(`/maintenance/downtime-logs/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const execAction = async (action: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/maintenance/downtime-logs/${id}/${action}`, {});
      showToast(t('common.successUpdated'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setActionLoading(false); }
  };

  const confirmAndExec = (action: string) => {
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    edit: () => router.push(`/admin/maintenance/downtime-logs/${id}/edit`),
    end: () => confirmAndExec('end'),
    close: () => confirmAndExec('close'),
    cancel: () => confirmAndExec('cancel'),
    classify: () => confirmAndExec('classify'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'end', labelKey: 'maintenance.endDowntime', icon: <ActionCompleteIcon />, onClick: () => exec('end'), enabled: !!(data && !data.endTime && data.status !== 'CANCELLED') },
    { id: 'close', labelKey: 'maintenance.close', icon: <ActionStartIcon />, onClick: () => exec('close'), enabled: !!(data && data.endTime && data.status !== 'CLOSED' && data.status !== 'CANCELLED') },
    { id: 'cancel', labelKey: 'common.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(data && !data.endTime && data.status !== 'CANCELLED'), variant: 'danger' },
    { id: 'classify', labelKey: 'maintenance.classify', icon: <ActionEditIcon />, onClick: () => exec('classify'), enabled: !!(data && data.endTime && data.status !== 'CLASSIFIED' && data.status !== 'CANCELLED') },
  ]);

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const calcDuration = () => {
    if (!data) return '-';
    if (data.durationHours != null) return `${data.durationHours} h`;
    if (data.durationMinutes != null) return `${data.durationMinutes} min`;
    if (data.startTime && data.endTime) {
      const ms = new Date(data.endTime).getTime() - new Date(data.startTime).getTime();
      const hours = ms / 3600000;
      return `${hours.toFixed(2)} h`;
    }
    return '-';
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('maintenance.machine')}</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {data.machine ? (
                  <a href={`/admin/maintenance/machines/${data.machine.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                    {data.machine.name}
                  </a>
                ) : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('maintenance.maintenanceRequest')}</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {data.request ? (
                  <a href={`/admin/maintenance/requests/${data.request.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                    {data.request.requestNumber} - {data.request.title}
                  </a>
                ) : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt>
              <dd className="mt-1"><CmmsStatusBadge status={data.status} /></dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('maintenance.reason')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.reason || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('maintenance.startTime')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{fmt(data.startTime)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('maintenance.endTime')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.endTime ? fmt(data.endTime) : '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('maintenance.duration')}</dt>
              <dd className="mt-1 text-sm text-gray-900 font-semibold">{calcDuration()}</dd>
            </div>
            {data.notes && (
              <div className="md:col-span-3">
                <dt className="text-sm font-medium text-gray-500">{t('maintenance.notes')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => execAction(pendingAction)}
        title={t('common.confirm')} message={`${t('maintenance.confirmAction')}: ${pendingAction}`} 
        variant={pendingAction === 'cancel' ? 'danger' : 'primary'} loading={actionLoading} />
    </div>
  );
}
