'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { Pagination, PageHeader } from '../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../components/admin/admin-action-bar';

interface InstalledPart {
  id: string; installedQuantity: number; installedCondition: string;
  installedAt: string;
  machine?: { id: string; name: string; code: string };
  machineComponent?: { id: string; name: string };
  sparePart?: { id: string; code: string; name: string };
  maintenanceRequest?: { id: string; requestNumber: string };
}

export default function InstalledPartsPage() {
  const { t, dir } = useTranslation();
  const [data, setData] = useState<InstalledPart[]>([]);
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
      const res = await api.get<{ data: InstalledPart[]; meta: any }>('/installed-parts', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const columns: GridColumn<InstalledPart>[] = [
    { key: 'machine', header: t('maintenance.machine'), render: (p: InstalledPart) => p.machine?.name || '-' },
    { key: 'sparePart', header: t('maintenance.sparePart'), render: (p: InstalledPart) => p.sparePart?.name || '-' },
    { key: 'installedQuantity', header: t('common.quantity'), render: (p: InstalledPart) => p.installedQuantity },
    { key: 'installedCondition', header: t('maintenance.condition') },
    { key: 'component', header: t('maintenance.machineComponent'), render: (p: InstalledPart) => p.machineComponent?.name || '-' },
    { key: 'installedAt', header: t('common.date'), render: (p: InstalledPart) => new Date(p.installedAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.installedParts')} />
      <AdminDataGrid
        columns={columns} data={data}
        keyExtractor={(p: InstalledPart) => p.id}
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