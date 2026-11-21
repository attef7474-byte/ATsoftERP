'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Button, DataTable, Pagination } from '../../../../components/admin/ui';
import { F9Lookup, machineAdapter, productAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../components/reports';

import { useReportPrintSnapshot } from '../../../../components/print/use-report-print-snapshot';
import { maintenancePartsUsagePrintModel, type PartsUsagePrintData } from '../../../../components/print/maintenance-parts-usage-print';
import { collectPrintRows } from '../../../../lib/print';

export default function PartsUsageReportPage() {
  const { t, locale } = useTranslation();
  const { capture, invalidate, rememberLookup, printSnapshot, canPrint } = useReportPrintSnapshot<PartsUsagePrintData>();
  const fetchSequence = useRef(0);
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });
  const [machineId, setMachineId] = useState('');
  const [productId, setProductId] = useState('');

  const fetchData = useCallback(async () => {
    const sequence = ++fetchSequence.current;
    setLoading(true); setError('');
    try {
      const params: any = { ...filters };
      if (machineId) params.machineId = machineId;
      if (productId) params.productId = productId;
      const res = await api.get<any>('/reports/parts-usage', { params });
      if (sequence !== fetchSequence.current) return;
      setData(res); capture(res, params);
    } catch (err: any) {
      if (sequence !== fetchSequence.current) return;
      invalidate(); setError(err?.message || t('reports.loadFailed'));
    } finally { if (sequence === fetchSequence.current) setLoading(false); }
  }, [filters, machineId, productId, t, capture, invalidate]);

  useEffect(() => { fetchData(); return () => { fetchSequence.current++; }; }, [fetchData]);

  const handlePrint = () => printSnapshot(!loading && !error && !!data, async (snapshot, assertScope) => {
    const result = await collectPrintRows(
      (page, pageSize) => api.get<PartsUsagePrintData>('/reports/parts-usage', { params: { ...snapshot.params, page, pageSize } }),
      assertScope, row => row.id,
    );
    return maintenancePartsUsagePrintModel({ ...snapshot, data: { ...result.first as PartsUsagePrintData, rows: result.rows } }, t, locale);
  });

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); setMachineId(''); setProductId(''); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: handlePrint,
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print'), readOnly: true, enabled: canPrint && !loading && !error },
  ]);

  const columns = [
    { key: 'request', header: t('maintenance.requestNumber'), render: (r: any) => <button onClick={() => router.push(`/admin/maintenance/requests/${r.request?.id}`)} className="text-blue-600 hover:underline">{r.request?.requestNumber || '-'}</button> },
    { key: 'product', header: t('reports.product'), render: (r: any) => r.product?.name || '-' },
    { key: 'quantity', header: t('inventoryCounting.quantity') },
    { key: 'totalCost', header: t('reports.totalCost'), render: (r: any) => r.totalCost ?? '-' },
    { key: 'createdAt', header: t('common.createdAt'), render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-' },
  ];

  return (
    <ReportPageShell title={t('reports.partsUsageReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><F9Lookup adapter={machineAdapter} value={machineId} onChange={setMachineId} onItemSelect={item => rememberLookup('machineId', item)} placeholder={t('reports.machine')} /></div>
          <div className="w-48"><F9Lookup adapter={productAdapter} value={productId} onChange={setProductId} onItemSelect={item => rememberLookup('productId', item)} placeholder={t('reports.product')} /></div>
          <div className="w-36"><Input type="date" value={filters.dateFrom || ''} onChange={e => setFilters((f: any) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))} placeholder={t('reports.dateFrom')} /></div>
          <div className="w-36"><Input type="date" value={filters.dateTo || ''} onChange={e => setFilters((f: any) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))} placeholder={t('reports.dateTo')} /></div>
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={data.cards} />
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton onPrint={handlePrint} printDisabled={!canPrint || loading || !!error} filename="parts-usage" reportEndpoint="parts-usage" headers={[t('reports.exportHeaders.request'), t('reports.exportHeaders.product'), t('reports.exportHeaders.qty'), t('reports.exportHeaders.cost'), t('reports.exportHeaders.date')]} rows={data.rows}
                mapRow={(r) => [r.request?.requestNumber || '', r.product?.name || '', String(r.quantity ?? 0), String(r.totalCost ?? 0), r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}