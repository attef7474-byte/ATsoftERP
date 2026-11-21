'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Button, DataTable, Pagination } from '../../../../../components/admin/ui';
import { F9Lookup, warehouseAdapter, productAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../../components/reports';

import { useReportPrintSnapshot } from '../../../../../components/print/use-report-print-snapshot';
import { inventoryBalancesPrintModel, type BalancesPrintData } from '../../../../../components/print/inventory-balances-print';
import { collectPrintRows } from '../../../../../lib/print';

export default function BalancesReportPage() {
  const { t, locale } = useTranslation();
  const { capture, invalidate, rememberLookup, printSnapshot, canPrint } = useReportPrintSnapshot<BalancesPrintData>();
  const fetchSequence = useRef(0);
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');

  const fetchData = useCallback(async () => {
    const generation = ++fetchSequence.current;
    setLoading(true); setError('');
    try {
      const params: any = { ...filters };
      if (warehouseId) params.warehouseId = warehouseId;
      if (productId) params.productId = productId;
      const res = await api.get<any>('/reports/inventory/balances', { params });
      if (generation !== fetchSequence.current) return;
      setData(res);
      capture(res, params);
    } catch (err: any) {
      if (generation !== fetchSequence.current) return;
      setError(err?.message || t('reports.loadFailed'));
      invalidate();
    } finally { if (generation === fetchSequence.current) setLoading(false); }
  }, [filters, warehouseId, productId, t, capture, invalidate]);

  useEffect(() => { fetchData(); return () => { fetchSequence.current++; }; }, [fetchData]);

  const handlePrint = () => printSnapshot(!loading && !error && !!data, async (snapshot, assertScope) => {
    const result = await collectPrintRows(
      (page, pageSize) => api.get<BalancesPrintData>('/reports/inventory/balances', { params: { ...snapshot.params, page, pageSize } }),
      assertScope, row => row.id,
    );
    return inventoryBalancesPrintModel({ ...snapshot, data: { ...result.first as BalancesPrintData, rows: result.rows } }, t, locale);
  });

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); setWarehouseId(''); setProductId(''); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: handlePrint,
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print'), readOnly: true, enabled: canPrint && !loading && !error },
  ]);

  const columns = [
    { key: 'product', header: t('reports.product'), render: (r: any) => r.product?.name || '-' },
    { key: 'productCode', header: t('common.code'), render: (r: any) => r.product?.code || '-' },
    { key: 'warehouse', header: t('reports.warehouse'), render: (r: any) => r.warehouse?.name || '-' },
    { key: 'location', header: t('reports.warehouseLocation'), render: (r: any) => r.location?.name || '-' },
    { key: 'quantity', header: t('inventoryCounting.quantity'), render: (r: any) => r.quantity ?? 0 },
    { key: 'updatedAt', header: t('common.updatedAt'), render: (r: any) => r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '-' },
  ];

  return (
    <ReportPageShell title={t('reports.balancesReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><F9Lookup adapter={warehouseAdapter} value={warehouseId} onChange={setWarehouseId} onItemSelect={item => rememberLookup('warehouseId', item)} placeholder={t('reports.warehouse')} /></div>
          <div className="w-48"><F9Lookup adapter={productAdapter} value={productId} onChange={setProductId} onItemSelect={item => rememberLookup('productId', item)} placeholder={t('reports.product')} /></div>
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={data.cards} />
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton onPrint={handlePrint} printDisabled={!canPrint || loading || !!error} filename="inventory-balances" reportEndpoint="inventory/balances" headers={[t('reports.exportHeaders.product'), t('reports.exportHeaders.code'), t('reports.exportHeaders.warehouse'), t('reports.exportHeaders.location'), t('reports.exportHeaders.qty'), t('reports.exportHeaders.updated')]} rows={data.rows}
                mapRow={(r) => [r.product?.name || '', r.product?.code || '', r.warehouse?.name || '', r.location?.name || '', String(r.quantity ?? 0), r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}
