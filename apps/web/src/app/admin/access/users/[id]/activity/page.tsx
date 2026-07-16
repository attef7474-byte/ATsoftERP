'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionBackIcon } from '../../../../../../components/admin/admin-action-bar';

export default function UserActivityDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    if (!userId) return;
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: any[]; meta: any }>(`/users/${userId}/activity`, { params: { page, limit: 20 } });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [userId, t]);

  useEffect(() => { fetchData(); }, []);

  const { exec } = useStableHandlers({ refresh: () => fetchData(meta.page), back: () => router.back() });
  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'createdAt', header: t('settings.audit.timestamp'), render: (item: any) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '-' },
    { key: 'action', header: t('settings.audit.action') },
    { key: 'entity', header: t('settings.audit.entity') },
    { key: 'entityId', header: t('settings.audit.entityId'), render: (item: any) => <span className="font-mono text-xs">{item.entityId || '-'}</span> },
    { key: 'ip', header: t('settings.audit.ip'), render: (item: any) => <span className="font-mono text-xs">{item.ip || '-'}</span> },
  ];

  return (
    <div>
      <PageHeader title={t('userActivity.title')} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('userActivity.noActivity')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(item: any) => item.id} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
