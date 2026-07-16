'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { Permission } from '../../../../lib/admin-types';
import { Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, StatusBadge } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionViewIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';
import { Button } from '../../../../components/admin/ui';

export default function PermissionsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Permission[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const router = useRouter();

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
    matrix: () => router.push('/admin/access/permissions/matrix'),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'matrix', labelKey: 'access.matrixOverview', icon: <ActionViewIcon />, onClick: () => exec('matrix') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: Permission[]; meta: any }>('/permissions', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const columns = [
    { key: 'key', header: t('permissions.key'), render: (r: Permission) => r.key || '-' },
    { key: 'module', header: t('permissions.module'), render: (r: Permission) => r.module || '-' },
    { key: 'action', header: t('permissions.action'), render: (r: Permission) => r.action || '-' },
    { key: 'description', header: t('permissions.description'), render: (r: Permission) => r.description || '-' },
    { key: 'status', header: t('common.status'), render: (r: Permission) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader title={t('permissions.title')} />
        <Button variant="secondary" onClick={() => router.push('/admin/access/permissions/matrix')}>{t('access.matrixOverview')}</Button>
      </div>
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }} onRefresh={() => fetchData(meta.page)} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(r: Permission) => r.id} onRowClick={(item: Permission) => setSelectedId(item.id)} selectedKey={selectedId} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
