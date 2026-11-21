'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Button, DataTable, Pagination, LocalizedValue } from '../../../../components/admin/ui';
import { F9Lookup, machineAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../components/reports';

import { useReportPrintSnapshot } from '../../../../components/print/use-report-print-snapshot';
import { maintenanceOverduePrintModel, type PreventivePrintData } from '../../../../components/print/maintenance-preventive-print';
import { collectPrintRows } from '../../../../lib/print';

export default function OverduePreventiveReportPage() {
  const { t, locale } = useTranslation();
  const { capture, invalidate, rememberLookup, printSnapshot, canPrint } = useReportPrintSnapshot<PreventivePrintData>();
  const fetchSequence = useRef(0);
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });
  const [machineId, setMachineId] = useState('');

  const fetchData = useCallback(async () => {
    const sequence = ++fetchSequence.current;
    setLoading(true); setError('');
    try {
      const params: any = { ...filters };
      if (machineId) params.machineId = machineId;
      const res = await api.get<any>('/reports/overdue-preventive', { params });
      if (sequence !== fetchSequence.current) return;
      setData(res); capture(res, params);
    } catch (err: any) {
      if (sequence !== fetchSequence.current) return;
      invalidate(); setError(err?.message || t('reports.loadFailed'));
    } finally { if (sequence === fetchSequence.current) setLoading(false); }
  }, [filters, machineId, t, capture, invalidate]);

  useEffect(() => { fetchData(); return () => { fetchSequence.current++; }; }, [fetchData]);

  const handlePrint = () => printSnapshot(!loading && !error && !!data, async (snapshot, assertScope) => {
    const result = await collectPrintRows(
      (page, pageSize) => api.get<PreventivePrintData>('/reports/overdue-preventive', { params: { ...snapshot.params, page, pageSize } }),
      assertScope, row => row.id,
    );
    return maintenanceOverduePrintModel({ ...snapshot, data: { ...result.first as PreventivePrintData, rows: result.rows } }, t, locale);
  });

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); setMachineId(''); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: handlePrint,
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print'), readOnly: true, enabled: canPrint && !loading && !error },
  ]);

  const columns = [
    { key: 'title', header: t('common.name') },
    { key: 'machine', header: t('reports.machine'), render: (r: any) => r.machine?.name || '-' },
    { key: 'type', header: t('reports.type'), render: (r: any) => <LocalizedValue value={r.type} kind="maintenanceType" /> },
    { key: 'frequency', header: t('maintenance.frequency') },
    { key: 'endDate', header: t('reports.dateTo'), render: (r: any) => r.endDate ? new Date(r.endDate).toLocaleDateString() : '-' },
    { key: 'status', header: t('reports.status'), render: (r: any) => <LocalizedValue value={r.status} kind="status" /> },
  ];

  return (
    <ReportPageShell title={t('reports.overduePreventiveReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><F9Lookup adapter={machineAdapter} value={machineId} onChange={setMachineId} onItemSelect={item => rememberLookup('machineId', item)} placeholder={t('reports.machine')} /></div>
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={data.cards} />
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton onPrint={handlePrint} printDisabled={!canPrint || loading || !!error} filename="overdue-preventive" reportEndpoint="overdue-preventive" headers={[t('reports.exportHeaders.title'), t('reports.exportHeaders.machine'), t('reports.exportHeaders.type'), t('reports.exportHeaders.frequency'), t('reports.exportHeaders.due'), t('reports.exportHeaders.status')]} rows={data.rows}
                mapRow={(r) => [r.title, r.machine?.name || '', r.type, r.frequency, r.endDate ? new Date(r.endDate).toLocaleDateString() : '', r.status]} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}
