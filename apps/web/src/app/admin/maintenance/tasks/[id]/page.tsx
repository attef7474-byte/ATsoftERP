'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { MaintenanceTask } from '../../../../../lib/admin-types';
import { Card, CardContent, LoadingState, ErrorState } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function MaintenanceTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<MaintenanceTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MaintenanceTask }>(`/maintenance/tasks/${id}`);
      setData(res.data || res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const execAction = async (action: string) => {
    try {
      await api.patch(`/maintenance/tasks/${id}/${action}`);
      showToast(t('common.successUpdated'), 'success');
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    edit: () => router.push(`/admin/maintenance/tasks/${id}/edit`),
    start: () => execAction('start'),
    complete: () => execAction('complete'),
    cancel: () => execAction('cancel'),
    assign: () => router.push(`/admin/maintenance/tasks/${id}/assign`),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!(data && data.status === 'PENDING') },
    { id: 'start', labelKey: 'common.start', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(data && data.status === 'PENDING') },
    { id: 'complete', labelKey: 'common.complete', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: !!(data && data.status === 'IN_PROGRESS') },
    { id: 'assign', labelKey: 'maintenance.assign', icon: <ActionEditIcon />, onClick: () => exec('assign'), enabled: !!(data && (data.status === 'PENDING' || data.status === 'IN_PROGRESS')) },
    { id: 'cancel', labelKey: 'common.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(data && (data.status === 'PENDING' || data.status === 'IN_PROGRESS')) },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('common.title')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.title}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><CmmsStatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.description')}</dt><dd className="mt-1 text-sm text-gray-900">{data.description || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.maintenanceRequest')}</dt><dd className="mt-1 text-sm text-gray-900">
              {data.request ? (
                <Link href={`/admin/maintenance/requests/${data.request.id}`} className="text-blue-600 hover:text-blue-800">
                  [{data.request.requestNumber}] {data.request.title}
                </Link>
              ) : '-'}
            </dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.assignedTo')}</dt><dd className="mt-1 text-sm text-gray-900">{data.assignedTo?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.startedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.startedAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.completedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.completedAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.notes')}</dt><dd className="mt-1 text-sm text-gray-900">{data.notes || '-'}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {data.status === 'PENDING' && (
        <div className="flex gap-3">
          <button onClick={() => router.push(`/admin/maintenance/tasks/${id}/edit`)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('common.edit')}</button>
          <button onClick={() => router.push(`/admin/maintenance/tasks/${id}/assign`)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200">{t('maintenance.assign')}</button>
          <button onClick={() => exec('start')} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">{t('common.start')}</button>
        </div>
      )}
      {data.status === 'IN_PROGRESS' && (
        <div className="flex gap-3">
          <button onClick={() => router.push(`/admin/maintenance/tasks/${id}/assign`)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200">{t('maintenance.assign')}</button>
          <button onClick={() => router.push(`/admin/maintenance/tasks/${id}/complete`)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">{t('maintenance.complete')}</button>
        </div>
      )}
      {data.status !== 'PENDING' && data.status !== 'IN_PROGRESS' && (
        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-500">{t('details.readOnlyRecord')}</div>
      )}
    </div>
  );
}
