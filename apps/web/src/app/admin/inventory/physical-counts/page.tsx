'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Pagination, PageHeader } from '../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridAction, GridColumn } from '../../../../components/admin/admin-data-grid';
import { useRouter } from 'next/navigation';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon, ActionViewIcon } from '../../../../components/admin/admin-action-bar';

interface PhysicalCount {
  id: string;
  countNumber: string;
  companyId: string;
  company?: { id: string; code: string; name: string };
  branchId?: string;
  branch?: { id: string; code: string; name: string };
  warehouseId: string;
  warehouse?: { id: string; code: string; name: string };
  status: string;
  countDate: string;
  notes?: string;
  createdAt: string;
  _count?: { lines: number };
}

export default function PhysicalCountsPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<PhysicalCount[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ companyId: '', branchId: '', warehouseId: '', status: '' });
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get<{ data: PhysicalCount[]; meta: any }>('/inventory/physical-counts', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || 'Load failed'); }
    finally { setLoading(false); }
  }, [search, filters]);

  useEffect(() => { fetchData(); }, []);

  const { exec } = useStableHandlers({
    new: () => router.push('/admin/inventory/physical-counts/new'),
    refresh: () => fetchData(meta.page),
    view: () => selectedId && router.push(`/admin/inventory/physical-counts/${selectedId}`),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'physicalCount.newPhysicalCount', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'view', labelKey: 'common.view', icon: <ActionViewIcon />, onClick: () => exec('view'), enabled: !!selectedId },
  ]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      POSTED: 'bg-purple-100 text-purple-800',
      REJECTED: 'bg-yellow-100 text-yellow-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
  };

  const columns: GridColumn<PhysicalCount>[] = [
    { key: 'countNumber', header: t('physicalCount.countNumber', 'physicalCount') },
    { key: 'company', header: t('inventoryCounting.company'), render: (r) => r.company?.name || '-' },
    { key: 'warehouse', header: t('inventoryCounting.warehouse'), render: (r) => r.warehouse?.name || '-' },
    { key: 'status', header: t('common.status'), render: (r) => statusBadge(r.status) },
    { key: 'linesCount', header: t('physicalCount.linesCount', 'physicalCount'), render: (r) => r._count?.lines || 0 },
    { key: 'countDate', header: t('physicalCount.countDate', 'physicalCount'), render: (r) => r.countDate ? r.countDate.split('T')[0] : '-' },
  ];

  const gridActions: GridAction<PhysicalCount>[] = [
    { label: t('common.view'), onClick: (r) => router.push(`/admin/inventory/physical-counts/${r.id}`) },
  ];

  return (
    <div>
      <PageHeader title={t('physicalCount.title', 'physicalCount')} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <F9Lookup label={t('inventoryCounting.company')} value={filters.companyId} onChange={(v) => setFilters({ ...filters, companyId: v })} adapter={companyAdapter} />
        <F9Lookup label={t('inventoryCounting.branch')} value={filters.branchId} onChange={(v) => setFilters({ ...filters, branchId: v })} adapter={branchAdapter} />
        <F9Lookup label={t('inventoryCounting.warehouse')} value={filters.warehouseId} onChange={(v) => setFilters({ ...filters, warehouseId: v })} adapter={warehouseAdapter} />
        <Select label={t('common.status')} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={[
          { value: '', label: t('common.all') },
          { value: 'DRAFT', label: 'DRAFT' },
          { value: 'SUBMITTED', label: 'SUBMITTED' },
          { value: 'APPROVED', label: 'APPROVED' },
          { value: 'POSTED', label: 'POSTED' },
          { value: 'REJECTED', label: 'REJECTED' },
          { value: 'CANCELLED', label: 'CANCELLED' },
        ]} />
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(r: PhysicalCount) => r.id}
        onRowClick={(r: PhysicalCount) => setSelectedId(r.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('physicalCount.noPhysicalCounts', 'physicalCount')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
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
