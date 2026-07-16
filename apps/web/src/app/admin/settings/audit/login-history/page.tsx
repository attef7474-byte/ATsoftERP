'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Input, Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionBackIcon } from '../../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function LoginHistoryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (userId) params.userId = userId;
      const res = await api.get<{ data: any[]; meta: any }>('/audit-logs/login-history', { params });
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
    { key: 'user', header: t('settings.audit.user'), render: (item: any) => item.user?.name || item.user?.email || '-' },
    { key: 'action', header: t('settings.audit.action') },
    { key: 'ip', header: t('settings.audit.ip'), render: (item: any) => <span className="font-mono text-xs">{item.ip || '-'}</span> },
    { key: 'userAgent', header: t('settings.audit.userAgent'), render: (item: any) => <span className="text-xs truncate max-w-[200px]">{item.userAgent || '-'}</span> },
    { key: 'status', header: t('common.status'), render: (item: any) => item.action === 'LOGIN_SUCCESS' ? <StatusBadge status="ACTIVE" /> : item.action === 'LOGIN_FAILED' ? <StatusBadge status="INACTIVE" /> : item.action },
  ];

  return (
    <div>
      <PageHeader title={t('settings.audit.loginHistory')} />
      <div className="flex flex-wrap gap-3 mb-4">
        <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder={t('settings.audit.user')} className="w-48" />
      </div>
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('loginHistory.noHistory')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(item: any) => item.id} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
