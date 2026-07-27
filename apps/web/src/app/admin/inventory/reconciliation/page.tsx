'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { ReconciliationSummary, ReconciliationLine } from '../../../../lib/admin-types/inventory-movement';
import { Card, Pagination, PageHeader, LoadingState } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

export default function InventoryReconciliationPage() {
  const { t, dir } = useTranslation();
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [details, setDetails] = useState<ReconciliationLine[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { exec } = useStableHandlers({ refresh: () => fetchData() });
  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const summaryData = await api.get<{ summary: ReconciliationSummary; detail: any[] }>('/inventory/reconciliation/summary');
      const detailsData = await api.get<{ data: ReconciliationLine[]; meta: any }>('/inventory/reconciliation/details', { params: { page: 1, limit: 20 } });
      setSummary(summaryData.summary || null);
      setDetails(detailsData.data || []);
      setMeta(detailsData.meta || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err: any) { setError(err?.response?.data?.message?.[0] || err.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      MATCHED: 'bg-green-100 text-green-800',
      DIFFERENCE: 'bg-yellow-100 text-yellow-800',
      NEGATIVE_BALANCE: 'bg-red-100 text-red-800',
      ORPHAN_BALANCE: 'bg-orange-100 text-orange-800',
      ORPHAN_MOVEMENT: 'bg-purple-100 text-purple-800',
      INVALID_MOVEMENT: 'bg-gray-100 text-gray-800',
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
  };

  const columns: GridColumn<ReconciliationLine>[] = [
    { key: 'productName', header: t('inventoryReconciliation.product'), render: (row: any) => row.productName || row.productId },
    { key: 'warehouseName', header: t('inventoryReconciliation.warehouse'), render: (row: any) => row.warehouseName || row.warehouseId },
    { key: 'currentBalance', header: t('inventoryReconciliation.currentBalance') },
    { key: 'expectedBalance', header: t('inventoryReconciliation.expectedBalance') },
    { key: 'difference', header: t('inventoryReconciliation.difference') },
    { key: 'status', header: t('inventoryReconciliation.status'), render: (row: any) => statusBadge(row.status) },
  ];

  if (loading) return <LoadingState />;

  return (
    <div dir={dir}>
      <PageHeader title={t('inventoryReconciliation.title')} />

      <div className="p-3 mb-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
        <p>{t('inventoryReconciliation.readOnlyWarning')}</p>
        <p className="mt-1">{t('inventoryReconciliation.correctionDeferred')}</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card><div className="text-center"><div className="text-2xl font-bold">{summary.matched}</div><div className="text-sm text-gray-500">{t('inventoryReconciliation.matchedCount')}</div></div></Card>
          <Card><div className="text-center"><div className="text-2xl font-bold text-yellow-600">{summary.differences}</div><div className="text-sm text-gray-500">{t('inventoryReconciliation.differenceCount')}</div></div></Card>
          <Card><div className="text-center"><div className="text-2xl font-bold text-red-600">{summary.negativeBalances}</div><div className="text-sm text-gray-500">{t('inventoryReconciliation.negativeCount')}</div></div></Card>
          <Card><div className="text-center"><div className="text-2xl font-bold">{summary.totalBalances}</div><div className="text-sm text-gray-500">{t('inventoryReconciliation.totalBalances')}</div></div></Card>
        </div>
      )}

      <Card>
        {error && <div className="p-2 mb-2 bg-red-100 text-red-700 rounded">{error}</div>}
        {details.length === 0 && !error && (
          <div className="p-4 text-center text-gray-500">{t('inventoryReconciliation.noDifferences')}</div>
        )}
        {details.length > 0 && (
          <>
            <AdminDataGrid columns={columns} data={details} keyExtractor={(r: ReconciliationLine) => `${r.productId}-${r.warehouseId}`} />
            {meta.totalPages > 1 && (
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={() => {}} />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
