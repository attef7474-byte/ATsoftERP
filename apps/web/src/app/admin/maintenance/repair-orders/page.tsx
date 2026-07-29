'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Pagination, PageHeader, StatusBadge } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

interface RepairOrder {
  id: string; repairOrderNumber?: string; status: string;
  sparePartId: string; sourceCondition: string; sourceQuantity: number;
  repairedQuantity: number; scrappedQuantity: number;
  sparePart?: { id: string; code: string; name: string };
  warehouse?: { id: string; code: string; name: string };
  maintenanceRequest?: { id: string; requestNumber: string };
  createdAt: string;
}

export default function RepairOrdersPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<RepairOrder[]>([]);
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
      const res = await api.get<{ data: RepairOrder[]; meta: any }>('/maintenance/repair-orders', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const columns: GridColumn<RepairOrder>[] = [
    { key: 'repairOrderNumber', header: t('common.code'), render: (r: RepairOrder) => r.repairOrderNumber || '-' },
    { key: 'sparePart', header: t('maintenance.sparePart'), render: (r: RepairOrder) => r.sparePart?.name || '-' },
    { key: 'sourceCondition', header: t('maintenance.condition') },
    { key: 'sourceQuantity', header: t('common.quantity'), render: (r: RepairOrder) => r.sourceQuantity },
    { key: 'repairedQuantity', header: 'تم الإصلاح', render: (r: RepairOrder) => r.repairedQuantity || 0 },
    { key: 'status', header: t('common.status'), render: (r: RepairOrder) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.repairOrders')} />
      <AdminDataGrid
        columns={columns} data={data}
        keyExtractor={(r: RepairOrder) => r.id}
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