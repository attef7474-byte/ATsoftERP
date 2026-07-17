'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { MachineDocument } from '../../../../../lib/admin-types';
import { Card, CardContent, LoadingState, ErrorState, PageHeader } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionDeleteIcon, ActionViewIcon } from '../../../../../components/admin/admin-action-bar';

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export default function MachineDocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<MachineDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MachineDocument }>(`/maintenance/machine-documents/${id}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!confirm(t('common.confirmDeleteMessage'))) return;
    try {
      await api.delete(`/maintenance/machine-documents/${id}`);
      showToast(t('common.successDeleted'), 'success');
      router.push('/admin/maintenance/machine-documents');
    } catch (err: any) {
      showToast(err?.message || t('errors.deleteFailed'), 'error');
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    edit: () => router.push(`/admin/maintenance/machine-documents/${id}/edit`),
    view: () => router.push(`/admin/maintenance/machine-documents/${id}/view`),
    delete: () => handleDelete(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'view', labelKey: 'common.view', icon: <ActionViewIcon />, onClick: () => exec('view'), enabled: !!data },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, onClick: () => exec('delete'), enabled: !!data, variant: 'danger' },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const isPreviewable = data.mimeType && (data.mimeType.startsWith('image/') || data.mimeType === 'application/pdf' || data.mimeType.startsWith('text/'));

  return (
    <div className="space-y-6">
      <PageHeader title={data.title || data.fileName || t('maintenance.machineDocument')} subtitle={data.documentType || undefined} />

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.fileInformation')}</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.fileName')}</dt><dd className="mt-1 text-sm text-gray-900 font-mono">{data.fileName || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.mimeType')}</dt><dd className="mt-1 text-sm text-gray-900">{data.mimeType || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.fileSize')}</dt><dd className="mt-1 text-sm text-gray-900">{formatFileSize(data.sizeBytes)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.documentType')}</dt><dd className="mt-1 text-sm text-gray-900">{data.documentType || '-'}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.fileActions')}</h2>
          <div className="flex flex-wrap gap-3">
            {data.fileUrl && (
              <a href={data.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {t('actions.download')}
              </a>
            )}
            {isPreviewable && (
              <button onClick={() => router.push(`/admin/maintenance/machine-documents/${id}/view`)} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                {t('actions.preview')}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.documentDetails')}</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2"><dt className="text-sm font-medium text-gray-500">{t('common.description')}</dt><dd className="mt-1 text-sm text-gray-900">{data.description || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.title')}</dt><dd className="mt-1 text-sm text-gray-900">{data.title}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.machine')}</dt><dd className="mt-1 text-sm text-gray-900">{data.machine ? <button onClick={() => router.push(`/admin/maintenance/machines/${data.machine!.id}`)} className="text-blue-600 hover:underline">{data.machine.name}</button> : '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.updatedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.updatedAt)}</dd></div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
