'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Pagination, PageHeader, StatusBadge } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

interface PlanItem {
  id: string; planNumber: string; title: string; description?: string;
  scheduleId: string; machineId: string; status: string;
  machine?: { id: string; name: string; code: string };
  schedule?: { id: string; title: string };
  createdAt: string;
}

export default function SparePartPlansPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<PlanItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const { exec } = useStableHandlers({ refresh: () => fetchData(meta.page) });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      const res = await api.get<{ data: PlanItem[]; meta: any }>('/maintenance/spare-part-plans', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const columns: GridColumn<PlanItem>[] = [
    { key: 'planNumber', header: t('common.code') },
    { key: 'title', header: t('common.name') },
    { key: 'machine', header: t('maintenance.machine'), render: (p: PlanItem) => p.machine?.name || '-' },
    { key: 'status', header: t('common.status'), render: (p: PlanItem) => <StatusBadge status={p.status} /> },
    { key: 'createdAt', header: t('common.createdAt'), render: (p: PlanItem) => new Date(p.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.sparePartPlans')} />
      <AdminDataGrid
        columns={columns} data={data}
        keyExtractor={(p: PlanItem) => p.id}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        dir={dir}
        globalSearch={search} onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(meta.page)} refreshLoading={loading}
      />
      {data.length > 0 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      )}
    </div>
  );
}