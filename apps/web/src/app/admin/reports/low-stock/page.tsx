'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Button, DataTable, Pagination } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../components/reports';

import { useReportPrintSnapshot } from '../../../../components/print/use-report-print-snapshot';
import { maintenanceLowStockPrintModel, type MachinePartsPrintData } from '../../../../components/print/maintenance-machine-parts-print';
import { collectPrintRows } from '../../../../lib/print';

export default function LowStockReportPage() {
  const { t, locale } = useTranslation();
  const { capture, invalidate, printSnapshot, canPrint } = useReportPrintSnapshot<MachinePartsPrintData>();
  const fetchSequence = useRef(0);
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    const sequence = ++fetchSequence.current;
    setLoading(true); setError('');
    try {
      const res = await api.get<any>('/reports/low-stock', { params: filters });
      if (sequence !== fetchSequence.current) return;
      setData(res); capture(res, filters);
    } catch (err: any) {
      if (sequence !== fetchSequence.current) return;
      invalidate(); setError(err?.message || t('reports.loadFailed'));
    } finally { if (sequence === fetchSequence.current) setLoading(false); }
  }, [filters, t, capture, invalidate]);

  useEffect(() => { fetchData(); return () => { fetchSequence.current++; }; }, [fetchData]);

  const handlePrint = () => printSnapshot(!loading && !error && !!data, async (snapshot, assertScope) => {
    const result = await collectPrintRows(
      (page, pageSize) => api.get<MachinePartsPrintData>('/reports/low-stock', { params: { ...snapshot.params, page, pageSize } }),
      assertScope, row => row.id,
    );
    return maintenanceLowStockPrintModel({ ...snapshot, data: { ...result.first as MachinePartsPrintData, rows: result.rows } }, t, locale);
  });

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: handlePrint,
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print'), readOnly: true, enabled: canPrint && !loading && !error },
  ]);

  const columns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'partNumber', header: t('maintenance.partNumber') },
    { key: 'quantity', header: t('inventoryCounting.quantity'), render: (r: any) => <span className="text-red-600 font-medium">{r.quantity ?? 0}</span> },
    { key: 'unit', header: t('maintenance.unit') },
  ];

  return (
    <ReportPageShell title={t('reports.lowStockReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><Input value={filters.search || ''} onChange={e => setFilters((f: any) => ({ ...f, search: e.target.value || undefined, page: 1 }))} placeholder={t('common.search')} /></div>
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={data.cards} />
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton onPrint={handlePrint} printDisabled={!canPrint || loading || !!error} filename="low-stock" reportEndpoint="low-stock" headers={[t('reports.exportHeaders.code'), t('reports.exportHeaders.name'), t('reports.exportHeaders.partNumber'), t('reports.exportHeaders.qty'), t('reports.exportHeaders.unit')]} rows={data.rows}
                mapRow={(r) => [r.code, r.name, r.partNumber || '', String(r.quantity ?? 0), r.unit || '']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}