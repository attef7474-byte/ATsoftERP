'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { AdminDataGrid, GridAction, GridColumn } from '../../../../components/admin/datagrid';
import { PageHeader, Pagination, Select } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import type { ProductionRun } from '../../../../lib/admin-types';

const RUN_STATUSES = ['READY', 'RUNNING', 'PAUSED', 'COMPLETED', 'ABORTED'];

function statusLabelKey(value: string): string {
  switch (value) {
    case 'READY': return 'production.runs.runStatus.READY';
    case 'RUNNING': return 'production.runs.runStatus.RUNNING';
    case 'PAUSED': return 'production.runs.runStatus.PAUSED';
    case 'COMPLETED': return 'production.runs.runStatus.COMPLETED';
    case 'ABORTED': return 'production.runs.runStatus.ABORTED';
    default: return 'production.runs.runStatus.' + value;
  }
}

export default function ProductionRunsPage() {
  const { t, dir } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('production-run:' + action)),
    [isSuperAdmin, permissions],
  );
  const [data, setData] = useState<ProductionRun[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const fetchData = useCallback(
    async (page = 1) => {
      if (!can('read')) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const params: Record<string, any> = { page, limit: 10 };
        if (search) params.search = search;
        if (status) params.status = status;
        const result = await api.get<{ data: ProductionRun[]; meta: any }>('/production/runs', { params });
        setData(result.data || []);
        setMeta(result.meta);
      } catch (err: any) {
        setError(err?.message || t('errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [can, search, status, t],
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const columns: GridColumn<ProductionRun>[] = [
    { key: 'runNumber', header: t('production.runs.runNumber'), render: (item) => item.runNumber },
    { key: 'orderNumber', header: t('production.runs.orderNumber'), render: (item) => item.productionOrder?.orderNumber || item.orderNumberSnapshot || '-' },
    { key: 'line', header: t('production.line'), render: (item) => item.productionLine?.name || '-' },
    { key: 'machine', header: t('production.machine'), render: (item) => item.machine?.name || '-' },
    { key: 'status', header: t('common.status'), render: (item) => <CmmsStatusBadge status={item.status} /> },
    { key: 'startedAt', header: t('production.runs.startedAt'), render: (item) => item.startedAt ? new Date(item.startedAt).toLocaleString() : '-' },
  ];

  const canRecordOutput = isSuperAdmin || Boolean(permissions?.permissions.includes('production-output:record'));

  const actions: GridAction<ProductionRun>[] = [
    {
      label: t('actions.view'),
      onClick: (item) => router.push('/admin/production/runs/' + item.id),
      enabled: () => can('read'),
    },
    {
      label: t('production.runs.recordOutput'),
      onClick: (item) => router.push('/admin/production/runs/' + item.id + '?tab=output'),
      enabled: (item) => canRecordOutput && item.status === 'RUNNING',
    },
  ];

  if (!can('read')) {
    return (
      <div>
        <PageHeader title={t('production.runs.title')} />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{t('errors.forbidden')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PageHeader title={t('production.runs.title')} />
      </div>
      <div className="mb-4 flex max-w-lg gap-3">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder={t('production.runs.allStatuses')}
          options={RUN_STATUSES.map((value) => ({ value, label: t(statusLabelKey(value)) }))}
        />
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => router.push('/admin/production/runs/' + item.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={actions}
        dir={dir}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(meta.page)}
        refreshLoading={loading}
      />
      {data.length > 0 && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />}
    </div>
  );
}
