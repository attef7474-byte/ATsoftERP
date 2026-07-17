'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { MaintenanceSchedule } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, LoadingState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';

export default function MaintenanceScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/maintenance/schedules/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleActivate = async () => {
    try {
      await api.patch(`/maintenance/schedules/${id}/activate`, {});
      showToast(t('common.successActivated'), 'success');
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  const handleDeactivate = async () => {
    try {
      await api.patch(`/maintenance/schedules/${id}/deactivate`, {});
      showToast(t('common.successDeactivated'), 'success');
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    edit: () => router.push(`/admin/maintenance/schedules/${id}/edit`),
    activate: () => handleActivate(),
    deactivate: () => handleDeactivate(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(data && data.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(data && data.status === 'ACTIVE') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{data.title}</h2>
            <CmmsStatusBadge status={data.dueStatus || data.status} />
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.machine')}</dt><dd className="mt-1 text-sm text-gray-900">{data.machine?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.maintenanceType')}</dt><dd className="mt-1 text-sm text-gray-900">{t(`status.${data.maintenanceType}` as any) || data.maintenanceType}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.frequency')}</dt><dd className="mt-1 text-sm text-gray-900">{t(`status.${data.frequency}` as any) || data.frequency}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.intervalDays')}</dt><dd className="mt-1 text-sm text-gray-900">{data.intervalDays ?? '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.startDate')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.startDate)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.endDate')}</dt><dd className="mt-1 text-sm text-gray-900">{data.endDate ? fmt(data.endDate) : '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.description')}</dt><dd className="mt-1 text-sm text-gray-900">{data.description || '-'}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="cursor-pointer hover:shadow-md" onClick={() => router.push(`/admin/maintenance/schedules/${id}/execute`)}>
          <Card><CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-blue-600">{t('maintenance.execute')}</p>
          </CardContent></Card>
        </div>
        <div className="cursor-pointer hover:shadow-md" onClick={() => router.push(`/admin/maintenance/schedules/${id}/history`)}>
          <Card><CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-indigo-600">{t('maintenance.history')}</p>
          </CardContent></Card>
        </div>
        <div className="cursor-pointer hover:shadow-md" onClick={() => data.requestId ? router.push(`/admin/maintenance/requests/${data.requestId}`) : null}>
          <Card><CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-green-600">{t('maintenance.relatedRequest')}</p>
            {data.request && <p className="text-xs text-gray-500 mt-1">{data.request.requestNumber}</p>}
          </CardContent></Card>
        </div>
      </div>

      {data.checklistItems && data.checklistItems.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold">{t('maintenance.checklistItems')}</h3></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.checklistItems.map((item: any) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}