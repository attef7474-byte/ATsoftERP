'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { AuditLog } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function MachineActivityPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const id = params.id as string;
  const [data, setData] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: AuditLog[] }>(`/maintenance/machines/${id}/activity`);
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
          <h3 className="text-lg font-semibold text-gray-900">{t('maintenance.activityLog')}</h3>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <div className="flow-root">
              <ul className="-mb-8">
                {data.map((log, idx) => (
                  <li key={log.id}>
                    <div className="relative pb-8">
                      {idx < data.length - 1 && (
                        <span className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      )}
                      <div className="relative flex items-start gap-4">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white">
                          <span className="text-sm font-medium text-gray-600">
                            {log.user?.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm">
                            <span className="font-medium text-gray-900">{log.user?.name || t('common.system')}</span>
                            {' '}
                            <span className="text-gray-600">{log.action}</span>
                          </div>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {log.entity} {log.entityId ? `#${log.entityId}` : ''}
                          </p>
                          {log.details && (
                            <p className="mt-1 text-sm text-gray-600 bg-gray-50 rounded p-2 border border-gray-100">
                              {log.details}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-gray-400">{fmt(log.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
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
