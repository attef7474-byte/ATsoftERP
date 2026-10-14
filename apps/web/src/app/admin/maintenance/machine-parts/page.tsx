'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { MachinePart } from '../../../../lib/admin-types';
import { Pagination, PageHeader } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

/**
 * LEGACY surface. MachinePart is the pre-canonical, tenant-scoped applicability record.
 * Its history is preserved and remains readable here, but it is no longer a competing
 * create/manage experience: all catalog and machine-applicability management now happens
 * on the unified Spare Parts page. No create/edit/delete controls are offered here.
 */
export default function MachinePartsPage() {
  const { t, dir } = useTranslation();
  const [data, setData] = useState<MachinePart[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: MachinePart[]; meta: any }>('/maintenance/machine-parts', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns: GridColumn<MachinePart>[] = useMemo(() => [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'partNumber', header: t('maintenance.partNumber'), render: (p: MachinePart) => p.partNumber || '-' },
    { key: 'machine', header: t('maintenance.machine'), render: (p: MachinePart) => p.machine?.name || '-' },
    { key: 'sparePart', header: t('maintenance.canonicalSparePart'), render: (p: MachinePart) => p.sparePart?.code || '-' },
    { key: 'quantity', header: t('maintenance.quantity'), render: (p: MachinePart) => p.quantity },
    { key: 'unit', header: t('maintenance.unit'), render: (p: MachinePart) => p.unit || '-' },
  ], [t]);

  return (
    <div>
      <PageHeader title={t('maintenance.machinePartsLegacyTitle')} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span>{t('maintenance.machinePartsLegacyNotice')}</span>
        <Link href="/admin/maintenance/spare-parts" className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700">
          {t('maintenance.goToSpareParts')}
        </Link>
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(p: MachinePart) => p.id}
        onRowClick={(p: MachinePart) => setSelectedId(p.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        dir={dir}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(meta.page)}
        refreshLoading={loading}
      />
      {data.length > 0 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      )}
    </div>
  );
}
