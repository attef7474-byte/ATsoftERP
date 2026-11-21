'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Button, DataTable, Pagination } from '../../../../../components/admin/ui';
import { F9Lookup, productionLineAdapter, machineAdapter, operationTypeAdapter, costCenterAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../../components/reports';

import { useReportPrintSnapshot } from '../../../../../components/print/use-report-print-snapshot';
import { maintenanceDowntimePrintModel, type DowntimePrintData } from '../../../../../components/print/maintenance-downtime-print';
import { collectPrintRows } from '../../../../../lib/print';

export default function DowntimeReportPage() {
  const { t, locale } = useTranslation();
  const { capture, invalidate, rememberLookup, printSnapshot, canPrint } = useReportPrintSnapshot<DowntimePrintData>();
  const fetchSequence = useRef(0);
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });
  const [productionLineId, setProductionLineId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [operationTypeId, setOperationTypeId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');

  const fetchData = useCallback(async () => {
    const sequence = ++fetchSequence.current;
    setLoading(true); setError('');
    try {
      const params: any = { ...filters };
      if (productionLineId) params.productionLineId = productionLineId;
      if (machineId) params.machineId = machineId;
      if (operationTypeId) params.operationTypeId = operationTypeId;
      if (costCenterId) params.costCenterId = costCenterId;
      const res = await api.get<any>('/reports/maintenance/downtime', { params });
      if (sequence !== fetchSequence.current) return;
      setData(res); capture(res, params);
    } catch (err: any) {
      if (sequence !== fetchSequence.current) return;
      invalidate(); setError(err?.message || t('reports.loadFailed'));
    } finally { if (sequence === fetchSequence.current) setLoading(false); }
  }, [filters, productionLineId, machineId, operationTypeId, costCenterId, t, capture, invalidate]);

  useEffect(() => { fetchData(); return () => { fetchSequence.current++; }; }, [fetchData]);

  const handlePrint = () => printSnapshot(!loading && !error && !!data, async (snapshot, assertScope) => {
    const result = await collectPrintRows(
      (page, pageSize) => api.get<DowntimePrintData>('/reports/maintenance/downtime', { params: { ...snapshot.params, page, pageSize } }),
      assertScope, row => row.id,
    );
    return maintenanceDowntimePrintModel({ ...snapshot, data: { ...result.first as DowntimePrintData, rows: result.rows } }, t, locale);
  });

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); setProductionLineId(''); setMachineId(''); setOperationTypeId(''); setCostCenterId(''); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: handlePrint,
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print'), readOnly: true, enabled: canPrint && !loading && !error },
  ]);

  const columns = [
    { key: 'machine', header: t('reports.machine'), render: (r: any) => r.machine?.name || '-' },
    { key: 'reason', header: t('maintenance.reason') },
    { key: 'startTime', header: t('maintenance.startTime'), render: (r: any) => r.startTime ? new Date(r.startTime).toLocaleString() : '-' },
    { key: 'endTime', header: t('maintenance.endTime'), render: (r: any) => r.endTime ? new Date(r.endTime).toLocaleString() : '-' },
    { key: 'durationMinutes', header: t('reports.totalDowntimeMinutes'), render: (r: any) => r.durationMinutes ?? '-' },
    { key: 'cancelledAt', header: t('reports.status'), render: (r: any) => r.cancelledAt ? t('reports.cancelled') : r.endTime ? t('reports.completed') : t('reports.active') },
  ];

  return (
    <ReportPageShell title={t('reports.downtimeReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><F9Lookup adapter={productionLineAdapter} value={productionLineId} onChange={setProductionLineId} onItemSelect={item => rememberLookup('productionLineId', item)} placeholder={t('maintenance.productionLine')} /></div>
          <div className="w-48"><F9Lookup adapter={machineAdapter} value={machineId} onChange={setMachineId} onItemSelect={item => rememberLookup('machineId', item)} placeholder={t('reports.machine')} /></div>
          <div className="w-48"><F9Lookup adapter={operationTypeAdapter} value={operationTypeId} onChange={setOperationTypeId} onItemSelect={item => rememberLookup('operationTypeId', item)} placeholder={t('maintenance.operationType')} /></div>
          <div className="w-48"><F9Lookup adapter={costCenterAdapter} value={costCenterId} onChange={setCostCenterId} onItemSelect={item => rememberLookup('costCenterId', item)} placeholder={t('maintenance.costCenter')} /></div>
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
              <ReportExportButton onPrint={handlePrint} printDisabled={!canPrint || loading || !!error} filename="machine-downtime" reportEndpoint="maintenance/downtime" headers={[t('reports.exportHeaders.machine'), t('reports.exportHeaders.reason'), t('reports.exportHeaders.start'), t('reports.exportHeaders.end'), t('reports.exportHeaders.duration'), t('reports.exportHeaders.status')]} rows={data.rows}
                mapRow={(r) => [r.machine?.name || '', r.reason, r.startTime ? new Date(r.startTime).toLocaleString() : '', r.endTime ? new Date(r.endTime).toLocaleString() : '', String(r.durationMinutes ?? ''), r.cancelledAt ? 'Cancelled' : r.endTime ? 'Completed' : 'Active']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}
