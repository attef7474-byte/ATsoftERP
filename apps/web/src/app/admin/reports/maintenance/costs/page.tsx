'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Button, DataTable, Pagination } from '../../../../../components/admin/ui';
import { F9Lookup, machineAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../../components/reports';

export default function CostsReportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });
  const [machineId, setMachineId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: any = { ...filters };
      if (machineId) params.machineId = machineId;
      const res = await api.get<any>('/reports/maintenance/costs', { params });
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('reports.loadFailed'));
    } finally { setLoading(false); }
  }, [filters, machineId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); setMachineId(''); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: () => window.print(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print') },
  ]);

  const columns = [
    { key: '_type', header: t('reports.type'), render: (r: any) => r._type === 'cost' ? t('reports.otherCost') : t('reports.partsCost') },
    { key: 'request', header: t('maintenance.requestNumber'), render: (r: any) => <button onClick={() => router.push(`/admin/maintenance/requests/${r.request?.id || r.requestId}`)} className="text-blue-600 hover:underline">{r.request?.requestNumber || '-'}</button> },
    { key: 'description', header: t('common.description'), render: (r: any) => r.description || r.product?.name || '-' },
    { key: 'quantity', header: t('inventoryCounting.quantity'), render: (r: any) => r.quantity ?? '-' },
    { key: 'amount', header: t('reports.totalCost'), render: (r: any) => r.amount ?? r.totalCost ?? '-' },
    { key: 'incurredAt', header: t('common.createdAt'), render: (r: any) => r.incurredAt ? new Date(r.incurredAt).toLocaleDateString() : '-' },
  ];

  return (
    <ReportPageShell title={t('reports.costsReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><F9Lookup adapter={machineAdapter} value={machineId} onChange={setMachineId} placeholder={t('reports.machine')} /></div>
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
              <ReportExportButton filename="maintenance-costs" headers={['Type', 'Request', 'Description', 'Qty', 'Amount', 'Date']} rows={data.rows}
                mapRow={(r) => [r._type === 'cost' ? 'Other Cost' : 'Parts', r.request?.requestNumber || '', r.description || r.product?.name || '', String(r.quantity ?? ''), String(r.amount ?? r.totalCost ?? ''), r.incurredAt ? new Date(r.incurredAt).toLocaleDateString() : '']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}
