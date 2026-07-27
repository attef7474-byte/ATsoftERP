'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { InventoryMovement, LedgerMovementFilter } from '../../../../lib/admin-types/inventory-movement';
import { Card, Pagination, PageHeader, LoadingState } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

export default function InventoryLedgerPage() {
  const { t, dir } = useTranslation();
  const [data, setData] = useState<InventoryMovement[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<LedgerMovementFilter>({ page: 1, limit: 20 });

  const { exec } = useStableHandlers({ refresh: () => fetchData(meta.page) });
  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 20, ...filter };
      delete params.page; delete params.limit;
      const res = await api.get<{ data: InventoryMovement[]; meta: any }>('/inventory/ledger/movements', { params: { ...params, page, limit: 20 } });
      setData(res.data || []); setMeta(res.meta || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err: any) { setError(err?.response?.data?.message?.[0] || err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchData(filter.page); }, [fetchData, filter.page]);

  const columns: GridColumn<InventoryMovement>[] = [
    { key: 'movementNumber', header: t('inventoryLedger.movementNumber'), sortable: true },
    { key: 'movementType', header: t('inventoryLedger.movementType'), render: (row: any) => t(`inventoryLedger.movementType`) },
    { key: 'warehouse', header: t('inventoryLedger.warehouse'), render: (row: any) => row.warehouse?.name || '-' },
    { key: 'status', header: t('inventoryLedger.status'), render: (row: any) => row.status },
    { key: 'movementDate', header: t('inventoryLedger.date'), render: (row: any) => new Date(row.movementDate).toLocaleDateString() },
    { key: 'lines', header: t('inventoryLedger.quantity'), render: (row: any) => row.lines?.reduce((s: number, l: any) => s + l.quantity, 0) || 0 },
  ];

  if (loading) return <LoadingState />;

  return (
    <div dir={dir}>
      <PageHeader title={t('inventoryLedger.title')} />
      <Card>
        {error && <div className="p-2 mb-2 bg-red-100 text-red-700 rounded">{error}</div>}
        {!error && data.length === 0 && <div className="text-center py-8 text-gray-500">{t('inventoryLedger.noMovements')}</div>}
        {data.length > 0 && (
          <AdminDataGrid
            columns={columns}
            data={data}
            keyExtractor={(m: InventoryMovement) => m.id}
            dir={dir}
          />
        )}
        {meta.totalPages > 1 && (
          <div className="mt-3">
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={(p) => setFilter(f => ({ ...f, page: p }))} />
          </div>
        )}
      </Card>
    </div>
  );
}
