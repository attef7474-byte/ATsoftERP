'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { MachineDocument } from '../../../../../../lib/admin-types';
import { Card, CardContent, LoadingState, ErrorState, PageHeader } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon } from '../../../../../../components/admin/admin-action-bar';

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export default function ViewMachineDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
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

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    edit: () => router.push(`/admin/maintenance/machine-documents/${id}/edit`),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const mime = data.mimeType || '';
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  const isText = mime.startsWith('text/');

  return (
    <div className="space-y-6">
      <PageHeader title={t('maintenance.preview')} subtitle={data.fileName || data.title} />

      <Card>
        <CardContent>
          {isImage ? (
            <div className="flex justify-center">
              <img src={data.fileUrl!} alt={data.fileName || 'Preview'} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            </div>
          ) : isPdf ? (
            <iframe src={data.fileUrl!} className="w-full h-[80vh] rounded-lg border" title={data.fileName || 'PDF Preview'} />
          ) : isText ? (
            <iframe src={data.fileUrl!} className="w-full h-[60vh] rounded-lg border" title={data.fileName || 'Text Preview'} />
          ) : (
            <div className="text-center py-16">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">{t('maintenance.previewNotAvailable')}</h3>
              <p className="mt-2 text-sm text-gray-500">{t('maintenance.previewNotAvailableDesc')}</p>
              <div className="mt-4 inline-flex items-center gap-4 text-sm">
                {data.fileName && <span className="text-gray-600">{t('maintenance.fileName')}: {data.fileName}</span>}
                {data.mimeType && <span className="text-gray-600">{t('maintenance.mimeType')}: {data.mimeType}</span>}
                <span className="text-gray-600">{t('maintenance.fileSize')}: {formatFileSize(data.sizeBytes)}</span>
              </div>
              <div className="mt-6">
                {data.fileUrl && (
                  <a href={data.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    {t('actions.download')}
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
