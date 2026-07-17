'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Button, DataTable, Pagination } from '../../../../components/admin/ui';
import { F9Lookup, machineAdapter, productAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../components/reports';

export default function PartsUsageReportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });
  const [machineId, setMachineId] = useState('');
  const [productId, setProductId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: any = { ...filters };
      if (machineId) params.machineId = machineId;
      if (productId) params.productId = productId;
      const res = await api.get<any>('/reports/parts-usage', { params });
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('reports.loadFailed'));
    } finally { setLoading(false); }
  }, [filters, machineId, productId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); setMachineId(''); setProductId(''); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: () => window.print(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print') },
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
          <div className="w-48"><F9Lookup adapter={machineAdapter} value={machineId} onChange={setMachineId} placeholder={t('reports.machine')} /></div>
          <div className="w-48"><F9Lookup adapter={productAdapter} value={productId} onChange={setProductId} placeholder={t('reports.product')} /></div>
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
              <ReportExportButton filename="parts-usage" headers={['Request', 'Product', 'Qty', 'Cost', 'Date']} rows={data.rows}
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