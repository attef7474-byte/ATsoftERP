'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Select, Button, DataTable, Pagination, LocalizedValue } from '../../../../../components/admin/ui';
import { F9Lookup, warehouseAdapter, productAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../../components/reports';

import { useReportPrintSnapshot } from '../../../../../components/print/use-report-print-snapshot';
import { inventoryCountVariancePrintModel, type CountVariancePrintData } from '../../../../../components/print/inventory-count-variance-print';
import { collectPrintRows } from '../../../../../lib/print';

export default function CountVarianceReportPage() {
  const { t, locale } = useTranslation();
  const { capture, invalidate, rememberLookup, printSnapshot, canPrint } = useReportPrintSnapshot<CountVariancePrintData>();
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
      const res = await api.get<any>('/reports/inventory/count-variance', { params });
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
      (page, pageSize) => api.get<CountVariancePrintData>('/reports/inventory/count-variance', { params: { ...snapshot.params, page, pageSize } }),
      assertScope, row => row.id,
    );
    return inventoryCountVariancePrintModel({ ...snapshot, data: { ...result.first as CountVariancePrintData, rows: result.rows } }, t, locale);
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
    { key: 'count', header: t('reports.count'), render: (r: any) => <button onClick={() => router.push(`/admin/inventory/counts/${r.count?.id}`)} className="text-blue-600 hover:underline">{r.count?.countNumber || '-'}</button> },
    { key: 'product', header: t('reports.product'), render: (r: any) => r.product?.name || '-' },
    { key: 'location', header: t('reports.warehouseLocation'), render: (r: any) => r.warehouseLocation?.name || '-' },
    { key: 'systemQty', header: t('inventoryCounting.systemQty') },
    { key: 'countedQty', header: t('inventoryCounting.countedQty') },
    { key: 'differenceQty', header: t('reports.varianceQty'), render: (r: any) => <span className={r.differenceQty > 0 ? 'text-green-600' : r.differenceQty < 0 ? 'text-red-600' : ''}>{r.differenceQty ?? 0}</span> },
    { key: 'status', header: t('reports.status'), render: (r: any) => <LocalizedValue value={r.status} kind="status" /> },
  ];

  return (
    <ReportPageShell title={t('reports.countVarianceReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><F9Lookup adapter={warehouseAdapter} value={warehouseId} onChange={setWarehouseId} onItemSelect={item => rememberLookup('warehouseId', item)} placeholder={t('reports.warehouse')} /></div>
          <div className="w-48"><F9Lookup adapter={productAdapter} value={productId} onChange={setProductId} onItemSelect={item => rememberLookup('productId', item)} placeholder={t('reports.product')} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!filters.varianceOnly} onChange={e => setFilters((f: any) => ({ ...f, varianceOnly: e.target.checked || undefined, page: 1 }))} />
            {t('reports.varianceOnly') || 'Variance Only'}
          </label>
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={data.cards} />
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton onPrint={handlePrint} printDisabled={!canPrint || loading || !!error} filename="count-variance" reportEndpoint="inventory/count-variance" headers={[t('reports.exportHeaders.count'), t('reports.exportHeaders.product'), t('reports.exportHeaders.location'), t('reports.exportHeaders.systemQty'), t('reports.exportHeaders.countedQty'), t('reports.exportHeaders.variance'), t('reports.exportHeaders.status')]} rows={data.rows}
                mapRow={(r) => [r.count?.countNumber || '', r.product?.name || '', r.warehouseLocation?.name || '', String(r.systemQty ?? ''), String(r.countedQty ?? ''), String(r.differenceQty ?? 0), r.status]} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}
