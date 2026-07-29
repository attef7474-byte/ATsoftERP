'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { LocalizedValue, PageHeader, StatusBadge } from '../../../../components/admin/ui';
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
  const [data, setData] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const { exec } = useStableHandlers({ refresh: () => fetchData() });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<RepairOrder[]>('/maintenance/repair-orders', { params: { limit: 50 } });
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleData = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return data;
    return data.filter((order) => [
      order.repairOrderNumber,
      order.sparePart?.name,
      order.sparePart?.code,
      order.warehouse?.name,
      order.maintenanceRequest?.requestNumber,
      order.sourceCondition,
      order.status,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [data, search]);

  const columns: GridColumn<RepairOrder>[] = [
    { key: 'repairOrderNumber', header: t('common.code'), render: (r: RepairOrder) => r.repairOrderNumber || '-' },
    { key: 'sparePart', header: t('maintenance.sparePartLabel'), render: (r: RepairOrder) => r.sparePart?.name || '-' },
    { key: 'sourceCondition', header: t('maintenance.condition'), render: (r: RepairOrder) => <LocalizedValue value={r.sourceCondition} /> },
    { key: 'sourceQuantity', header: t('common.quantity'), render: (r: RepairOrder) => r.sourceQuantity },
    { key: 'repairedQuantity', header: 'تم الإصلاح', render: (r: RepairOrder) => r.repairedQuantity || 0 },
    { key: 'status', header: t('common.status'), render: (r: RepairOrder) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.repairOrders')} />
      <AdminDataGrid
        columns={columns} data={visibleData}
        keyExtractor={(r: RepairOrder) => r.id}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={fetchData}
        dir={dir}
        globalSearch={search} onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={fetchData} refreshLoading={loading}
      />
    </div>
  );
}
