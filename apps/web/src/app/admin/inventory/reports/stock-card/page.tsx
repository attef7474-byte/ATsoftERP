'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { F9Lookup, productAdapter, warehouseAdapter } from '../../../../../components/f9';
import { Card, CardContent, Input, DataTable, Pagination, PageHeader, LoadingState } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { ReportSummaryCards } from '../../../../../components/reports';
import { useRouter } from 'next/navigation';

export default function StockCardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFrom, setDateFrom] = useState('');

  const fetchData = useCallback(async () => {
    if (!productId) return;
    setLoading(true); setError('');
    try {
      const params: any = { productId };
      if (warehouseId) params.warehouseId = warehouseId;
      if (dateFrom) params.dateFrom = dateFrom;
      const res = await api.get<any>('/reports/inventory/stock-card', { params });
      setData(res);
    } catch (err: any) { setError(err?.message || t('reports.loadFailed')); } finally { setLoading(false); }
  }, [productId, warehouseId, dateFrom, t]);

  useEffect(() => { if (productId) fetchData(); }, [productId]);

  const { exec } = useStableHandlers({ back: () => router.back(), refresh: () => fetchData(), print: () => window.print() });
  useRegisterAdminActions([{ id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') }, { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') }, { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print') }]);

  const columns = [
    { key: 'movementDate', header: t('common.date'), render: (r: any) => r.movementDate ? new Date(r.movementDate).toLocaleDateString() : '-' },
    { key: 'movementNumber', header: t('inventoryCounting.movementNumber') },
    { key: 'movementType', header: t('inventoryCounting.movementType') },
    { key: 'direction', header: t('reports.direction') },
    { key: 'quantity', header: t('inventoryCounting.quantity') },
    { key: 'sourceType', header: t('inventoryCounting.sourceType') },
    { key: 'runningBalance', header: t('reports.runningBalance'), render: (r: any) => <span className="font-semibold">{r.runningBalance}</span> },
  ];

  return (
    <div>
      <PageHeader title={t('reports.stockCard')} />
      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div className="w-64"><F9Lookup adapter={productAdapter} value={productId} onChange={(v) => { setProductId(v); }} placeholder={t('reports.product')} /></div>
        <div className="w-48"><F9Lookup adapter={warehouseAdapter} value={warehouseId} onChange={setWarehouseId} placeholder={t('reports.warehouse')} /></div>
        <div className="w-40"><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder={t('reports.dateFrom')} /></div>
      </div>
      {loading && <LoadingState />}
      {error && <div className="bg-red-50 text-red-700 p-4 rounded">{error}</div>}
      {!loading && !error && !productId && <div className="text-center py-12 text-gray-500">{t('reports.selectProductForStockCard')}</div>}
      {!loading && !error && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent><span className="text-sm text-gray-500">{t('reports.openingBalance')}</span><p className="text-2xl font-bold">{data.openingBalance}</p></CardContent></Card>
            <Card><CardContent><span className="text-sm text-gray-500">{t('reports.totalMovements')}</span><p className="text-2xl font-bold">{data.total}</p></CardContent></Card>
            <Card><CardContent><span className="text-sm text-gray-500">{t('reports.closingBalance')}</span><p className="text-2xl font-bold">{data.closingBalance}</p></CardContent></Card>
          </div>
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id + r.movementDate + r.quantity} />
        </div>
      )}
    </div>
  );
}
