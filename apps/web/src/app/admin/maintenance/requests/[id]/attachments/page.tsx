'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Card, CardContent, CardHeader, LoadingState, ErrorState, EmptyState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

interface Attachment {
  id: string;
  requestId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedBy?: { id: string; name: string };
  description?: string | null;
  createdAt: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function RequestAttachmentsPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<Attachment[]>(`/maintenance/requests/${id}/attachments`);
      setAttachments(res || []);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
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

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return '📦';
    return '📎';
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.attachments')}</h3></CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <EmptyState message={t('common.noData')} />
          ) : (
            <div className="divide-y divide-gray-200">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-4 py-3">
                  <div className="text-2xl flex-shrink-0">{getFileIcon(att.mimeType)}</div>
                  <div className="flex-1 min-w-0">
                    <a href={`${BASE_URL}/files/${att.fileUrl}`} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate block">
                      {att.fileName}
                    </a>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>{att.mimeType}</span>
                      <span>{formatSize(att.sizeBytes)}</span>
                      <span>{fmt(att.createdAt)}</span>
                      {att.uploadedBy && <span>{t('maintenance.uploadedBy')}: {att.uploadedBy.name}</span>}
                    </div>
                    {att.description && <p className="text-xs text-gray-400 mt-1">{att.description}</p>}
                  </div>
                  <a href={`${BASE_URL}/files/${att.fileUrl}`} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50">
                    {t('common.download')}
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
