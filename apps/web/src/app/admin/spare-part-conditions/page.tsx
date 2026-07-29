'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { PageHeader, StatusBadge } from '../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../components/admin/admin-action-bar';

interface ConditionBalance {
  id: string; condition: string; quantity: number; availableQuantity: number;
  sparePart?: { id: string; code: string; name: string };
  warehouse?: { id: string; code: string; name: string };
  lastMovementAt?: string;
}

export default function SparePartConditionsPage() {
  const { t, dir } = useTranslation();
  const [data, setData] = useState<ConditionBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { exec } = useStableHandlers({ refresh: () => fetchData() });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<ConditionBalance[]>('/spare-part-conditions/balances');
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, []);

  const columns: GridColumn<ConditionBalance>[] = [
    { key: 'sparePart', header: t('maintenance.sparePart'), render: (c: ConditionBalance) => c.sparePart?.name || '-' },
    { key: 'warehouse', header: t('maintenance.warehouse'), render: (c: ConditionBalance) => c.warehouse?.name || '-' },
    { key: 'condition', header: t('maintenance.condition'), render: (c: ConditionBalance) => <StatusBadge status={c.condition} /> },
    { key: 'quantity', header: t('common.quantity'), render: (c: ConditionBalance) => c.quantity },
    { key: 'availableQuantity', header: t('maintenance.availableQty'), render: (c: ConditionBalance) => c.availableQuantity },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.sparePartConditions')} />
      <AdminDataGrid
        columns={columns} data={data}
        keyExtractor={(c: ConditionBalance) => c.id}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData()}
        dir={dir}
        onRefresh={() => fetchData()} refreshLoading={loading}
      />
    </div>
  );
}