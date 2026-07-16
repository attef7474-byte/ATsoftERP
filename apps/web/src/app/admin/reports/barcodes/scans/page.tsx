'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Select, Button, DataTable, Pagination } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../../components/reports';

export default function BarcodeScansReportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: any = { ...filters };
      const res = await api.get<any>('/reports/barcodes/scans', { params });
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('reports.loadFailed'));
    } finally { setLoading(false); }
  }, [filters, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: () => window.print(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print') },
  ]);

  const columns = [
    { key: 'scannedValue', header: t('barcodes.scannedValue') },
    { key: 'purpose', header: t('reports.byPurpose'), render: (r: any) => <span className="capitalize">{r.purpose?.toLowerCase()}</span> },
    { key: 'result', header: t('reports.status'), render: (r: any) => <span className="capitalize">{r.result?.toLowerCase()}</span> },
    { key: 'entityType', header: t('reports.byEntity'), render: (r: any) => r.entityType || '-' },
    { key: 'source', header: t('barcodes.source') },
    { key: 'scannedAt', header: t('common.date'), render: (r: any) => r.scannedAt ? new Date(r.scannedAt).toLocaleString() : '-' },
  ];

  return (
    <ReportPageShell title={t('reports.barcodeScansReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-40">
            <Select value={filters.result || ''} onChange={e => setFilters((f: any) => ({ ...f, result: e.target.value || undefined, page: 1 }))} placeholder={t('reports.status')} options={[
              { value: 'SUCCESS', label: t('reports.successful') },
              { value: 'FAIL', label: t('reports.failed') },
              { value: 'NOT_FOUND', label: t('reports.notFound') },
            ]} />
          </div>
          <div className="w-36"><Input type="date" value={filters.dateFrom || ''} onChange={e => setFilters((f: any) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))} placeholder={t('reports.dateFrom')} /></div>
          <div className="w-36"><Input type="date" value={filters.dateTo || ''} onChange={e => setFilters((f: any) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))} placeholder={t('reports.dateTo')} /></div>
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={data.cards} />
          {data.byPurpose && data.byPurpose.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">{t('reports.byPurpose')}</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {data.byPurpose.map((p: any, i: number) => (
                      <tr key={i} className="border-b"><td className="py-1 capitalize">{p.purpose?.toLowerCase()}</td><td className="py-1 text-right font-medium">{p.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">{t('reports.byEntity')}</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {data.byEntity.map((e: any, i: number) => (
                      <tr key={i} className="border-b"><td className="py-1">{e.entityType || '-'}</td><td className="py-1 text-right font-medium">{e.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton filename="barcode-scans" headers={['Value', 'Purpose', 'Result', 'Entity', 'Source', 'Date']} rows={data.rows}
                mapRow={(r) => [r.scannedValue, r.purpose, r.result, r.entityType || '', r.source, r.scannedAt ? new Date(r.scannedAt).toLocaleString() : '']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}
