'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { InventoryCount } from '../../../../../lib/admin-types';
import { Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

export default function CountsHistoryPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<InventoryCount[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: InventoryCount[]; meta: any }>('/inventory/counts', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

  const columns = [
    { key: 'countNumber', header: t('inventoryCounting.countNumber'), render: (r: InventoryCount) => (
      <button onClick={() => router.push(`/admin/inventory/counts/${r.id}`)} className="text-indigo-600 hover:text-indigo-800 underline font-medium">{r.countNumber}</button>
    )},
    { key: 'warehouse', header: t('inventoryCounting.warehouse'), render: (r: InventoryCount) => r.warehouse?.name || '-' },
    { key: 'company', header: t('inventoryCounting.company'), render: (r: InventoryCount) => r.company?.name || '-' },
    { key: 'branch', header: t('inventoryCounting.branch'), render: (r: InventoryCount) => r.branch?.name || '-' },
    { key: 'status', header: t('common.status'), render: (r: InventoryCount) => <StatusBadge status={r.status} /> },
    { key: 'countDate', header: t('inventoryCounting.countDate'), render: (r: InventoryCount) => r.countDate ? r.countDate.split('T')[0] : '-' },
    { key: 'startedAt', header: t('inventoryCounting.startedAt'), render: (r: InventoryCount) => fmt(r.startedAt) },
    { key: 'completedAt', header: t('inventoryCounting.completedAt'), render: (r: InventoryCount) => fmt(r.completedAt) },
    {
      key: 'actions', header: t('common.actions'), render: (r: InventoryCount) => (
        <div className="flex gap-2">
          <button onClick={() => router.push(`/admin/inventory/counts/${r.id}`)} className="text-indigo-600 hover:text-indigo-800 text-sm">{t('details.viewDetails')}</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('inventoryCounting.counts')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('inventoryCounting.noCounts')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(r: InventoryCount) => r.id} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
