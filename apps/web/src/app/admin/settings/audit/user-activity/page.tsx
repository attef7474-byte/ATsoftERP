'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Input, Card, Pagination, PageHeader, LoadingState } from '../../../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionBackIcon } from '../../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function UserActivityPage() {
  const { t, dir } = useTranslation();
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
      const res = await api.get<{ data: any[]; meta: any }>('/audit-logs/user-activity', { params });
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

  const columns: GridColumn<any>[] = [
    { key: 'createdAt', header: t('settings.audit.timestamp'), sortable: true, render: (item: any) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '-' },
    { key: 'user', header: t('settings.audit.user'), sortable: true, render: (item: any) => item.user?.name || item.user?.email || '-' },
    { key: 'action', header: t('settings.audit.action'), sortable: true, filterable: true },
    { key: 'entity', header: t('settings.audit.entity'), sortable: true, filterable: true },
    { key: 'entityId', header: t('settings.audit.entityId'), render: (item: any) => <span className="font-mono text-xs">{item.entityId || '-'}</span> },
  ];

  return (
    <div>
      <PageHeader title={t('settings.audit.userActivity')} />
      <div className="flex flex-wrap gap-3 mb-4">
        <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder={t('settings.audit.user')} className="w-48" />
      </div>
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
        </div>
      )}
      {!error && loading && data.length === 0 && <LoadingState />}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('userActivity.noActivity')}</p>
        </div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <AdminDataGrid
          columns={columns}
          data={data}
          keyExtractor={(item: any) => item.id}
          loading={loading}
          emptyMessage={t('userActivity.noActivity')}
          error={error || undefined}
          dir={dir}
          onRefresh={() => fetchData(meta.page)}
          refreshLoading={loading}
        />
      )}
      {data.length > 0 && (
        <div className="mt-3">
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </div>
      )}
    </div>
  );
}
