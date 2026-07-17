'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

interface MachineAttachment {
  id: string;
  fileName: string;
  fileType?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  fileUrl?: string | null;
  createdAt: string;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIdx = 0;
  while (size >= 1024 && unitIdx < units.length - 1) { size /= 1024; unitIdx++; }
  return `${size.toFixed(1)} ${units[unitIdx]}`;
}

export default function MachineAttachmentsPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const id = params.id as string;
  const [data, setData] = useState<MachineAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MachineAttachment[] }>(`/maintenance/machines/${id}/attachments`);
      setData(res.data || []);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">{t('maintenance.attachments')}</h3>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <DataTable columns={[
              { key: 'fileName', header: t('maintenance.fileName'), render: (a: MachineAttachment) => a.fileName || '-' },
              { key: 'type', header: t('maintenance.fileType'), render: (a: MachineAttachment) => a.fileType || a.mimeType || '-' },
              { key: 'size', header: t('maintenance.fileSize'), render: (a: MachineAttachment) => formatFileSize(a.sizeBytes) },
              { key: 'date', header: t('common.createdAt'), render: (a: MachineAttachment) => fmt(a.createdAt) },
              { key: 'actions', header: t('common.actions'), render: (a: MachineAttachment) => (
                <div className="flex gap-2">
                  {a.fileUrl ? (
                    <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      {t('common.view')}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              )},
            ]} data={data} keyExtractor={(a: MachineAttachment) => a.id} />
          )}
        </CardContent>
      </Card>
      <div className="text-center">
        <button onClick={() => router.push(`/admin/maintenance/machines/${id}`)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          &larr; {t('common.back')}
        </button>
      </div>
    </div>
  );
}
