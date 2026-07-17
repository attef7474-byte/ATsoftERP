'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { AuditLog, PaginationMeta } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, LoadingState, ErrorState, EmptyState, Pagination } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function RequestActivityPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: AuditLog[]; meta: PaginationMeta }>(`/maintenance/requests/${id}/activity`, { params: { page, limit: 20 } });
      setLogs(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => fetchData(meta.page)} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.activityHistory')}</h3></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <EmptyState message={t('common.noData')} />
          ) : (
            <>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-0">
                  {logs.map((log) => (
                    <div key={log.id} className="relative flex gap-4 py-3 pl-10">
                      <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full bg-blue-100 border-2 border-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{log.user?.name || '-'}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{log.action}</span>
                          <span className="text-xs text-gray-400">{fmt(log.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {log.details || `${log.action} ${log.entity}${log.entityId ? ` #${log.entityId}` : ''}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
