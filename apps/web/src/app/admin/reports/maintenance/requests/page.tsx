'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Select, Button, DataTable, Pagination, LocalizedValue } from '../../../../../components/admin/ui';
import { F9Lookup, productionLineAdapter, machineAdapter, machineComponentAdapter, operationTypeAdapter, costCenterAdapter, sparePartAdapter, userAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../../components/reports';
import { usePrintDocument } from '../../../../../components/print/use-print-document';
import { maintenanceRequestsPrintModel, type LookupPrintLabels, type RequestPrintFilters } from '../../../../../components/print/maintenance-requests-print';
import { collectPrintRows, PrintPreparationError, type PrintPage } from '../../../../../lib/print';
import type { MaintenanceRequestPrintRow } from '../../../../../components/print/maintenance-requests-print';

export default function MaintenanceRequestsReportPage() {
  const { t, locale } = useTranslation();
  const { print, printing, scopeKey } = usePrintDocument();
  const [lookupLabels, setLookupLabels] = useState<LookupPrintLabels>({});
  const [applied, setApplied] = useState<{ params: RequestPrintFilters; labels: LookupPrintLabels; scopeKey: string } | null>(null);
  const fetchSequence = useRef(0);
  const rememberLookup = (key: string, item: { code?: string; name?: string }) => setLookupLabels(previous => ({ ...previous, [key]: item.name || item.code || '' }));
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });
  const [productionLineId, setProductionLineId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [machineComponentId, setMachineComponentId] = useState('');
  const [operationTypeId, setOperationTypeId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [sparePartId, setSparePartId] = useState('');

  const fetchData = useCallback(async () => {
    const sequence = ++fetchSequence.current;
    setLoading(true); setError('');
    try {
      const params: any = { ...filters };
      if (productionLineId) params.productionLineId = productionLineId;
      if (machineId) params.machineId = machineId;
      if (machineComponentId) params.machineComponentId = machineComponentId;
      if (operationTypeId) params.operationTypeId = operationTypeId;
      if (costCenterId) params.costCenterId = costCenterId;
      if (sparePartId) params.sparePartId = sparePartId;
      const res = await api.get<any>('/reports/maintenance/requests', { params });
      if (sequence !== fetchSequence.current) return;
      setData(res);
      setApplied({ params: { ...params }, labels: { ...lookupLabels }, scopeKey });
    } catch (err: any) {
      if (sequence !== fetchSequence.current) return;
      setError(err?.message || t('reports.loadFailed'));
      setApplied(null);
    } finally { if (sequence === fetchSequence.current) setLoading(false); }
  }, [filters, productionLineId, machineId, machineComponentId, operationTypeId, costCenterId, sparePartId, lookupLabels, scopeKey, t]);

  useEffect(() => { fetchData(); return () => { fetchSequence.current++; }; }, [fetchData]);

  const handlePrint = () => print(applied?.scopeKey || '', async assertScope => {
    if (!applied || loading || error || !data) throw new PrintPreparationError('unavailable');
    const result = await collectPrintRows<MaintenanceRequestPrintRow>(
      (page, pageSize) => api.get<PrintPage<MaintenanceRequestPrintRow> & { cards: Array<{ label: string; value: number }> }>('/reports/maintenance/requests', { params: { ...applied.params, page, pageSize } }),
      assertScope, row => row.id,
    );
    return maintenanceRequestsPrintModel({ ...result.first, rows: result.rows }, applied.params, applied.labels, t, locale);
  });

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); setProductionLineId(''); setMachineId(''); setMachineComponentId(''); setOperationTypeId(''); setCostCenterId(''); setSparePartId(''); };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    print: handlePrint,
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print'), readOnly: true, enabled: !loading && !error && !!applied && applied.scopeKey === scopeKey && !printing },
  ]);

  const columns = [
    { key: 'requestNumber', header: t('maintenance.requestNumber'), render: (r: any) => <button onClick={() => router.push(`/admin/maintenance/requests/${r.id}`)} className="text-blue-600 hover:underline">{r.requestNumber}</button> },
    { key: 'title', header: t('common.name') },
    { key: 'machine', header: t('reports.machine'), render: (r: any) => r.machine?.name || '-' },
    { key: 'type', header: t('reports.type'), render: (r: any) => <LocalizedValue value={r.type} kind="maintenanceType" /> },
    { key: 'priority', header: t('reports.priority'), render: (r: any) => <LocalizedValue value={r.priority} kind="priority" /> },
    { key: 'status', header: t('reports.status'), render: (r: any) => <LocalizedValue value={r.status} kind="status" /> },
    { key: 'createdAt', header: t('common.createdAt'), render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <ReportPageShell
      title={t('reports.requestsReport')}
      loading={loading}
      error={error}
      onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><F9Lookup adapter={productionLineAdapter} value={productionLineId} onChange={setProductionLineId} onItemSelect={item => rememberLookup('productionLineId', item)} placeholder={t('maintenance.productionLine')} /></div>
          <div className="w-48"><F9Lookup adapter={machineAdapter} value={machineId} onChange={setMachineId} onItemSelect={item => rememberLookup('machineId', item)} placeholder={t('reports.machine')} /></div>
          <div className="w-48"><F9Lookup adapter={machineComponentAdapter} value={machineComponentId} onChange={setMachineComponentId} onItemSelect={item => rememberLookup('machineComponentId', item)} placeholder={t('maintenance.machineComponent')} /></div>
          <div className="w-48"><F9Lookup adapter={operationTypeAdapter} value={operationTypeId} onChange={setOperationTypeId} onItemSelect={item => rememberLookup('operationTypeId', item)} placeholder={t('maintenance.operationType')} /></div>
          <div className="w-48"><F9Lookup adapter={costCenterAdapter} value={costCenterId} onChange={setCostCenterId} onItemSelect={item => rememberLookup('costCenterId', item)} placeholder={t('maintenance.costCenter')} /></div>
          <div className="w-48"><F9Lookup adapter={sparePartAdapter} value={sparePartId} onChange={setSparePartId} onItemSelect={item => rememberLookup('sparePartId', item)} placeholder={t('maintenance.sparePartLabel')} /></div>
          <div className="w-40">
            <Select value={filters.requestStatus || ''} onChange={e => setFilters((f: any) => ({ ...f, requestStatus: e.target.value || undefined, page: 1 }))} placeholder={t('reports.status')} options={[
              { value: 'OPEN', label: t('reports.open') },
              { value: 'IN_PROGRESS', label: t('reports.inProgress') },
              { value: 'COMPLETED', label: t('reports.completed') },
              { value: 'CANCELLED', label: t('reports.cancelled') },
            ]} />
          </div>
          <div className="w-40">
            <Select value={filters.maintenanceType || ''} onChange={e => setFilters((f: any) => ({ ...f, maintenanceType: e.target.value || undefined, page: 1 }))} placeholder={t('reports.type')} options={[
              { value: 'CORRECTIVE', label: t('status.CORRECTIVE') },
              { value: 'PREVENTIVE', label: t('status.PREVENTIVE') },
              { value: 'PREDICTIVE', label: t('status.PREDICTIVE') },
            ]} />
          </div>
          <div className="w-40">
            <Select value={filters.priority || ''} onChange={e => setFilters((f: any) => ({ ...f, priority: e.target.value || undefined, page: 1 }))} placeholder={t('reports.priority')} options={[
              { value: 'CRITICAL', label: t('status.CRITICAL') },
              { value: 'HIGH', label: t('status.HIGH') },
              { value: 'MEDIUM', label: t('status.MEDIUM') },
              { value: 'LOW', label: t('status.LOW') },
            ]} />
          </div>
          <div className="w-36">
            <Input type="date" value={filters.dateFrom || ''} onChange={e => setFilters((f: any) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))} placeholder={t('reports.dateFrom')} />
          </div>
          <div className="w-36">
            <Input type="date" value={filters.dateTo || ''} onChange={e => setFilters((f: any) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))} placeholder={t('reports.dateTo')} />
          </div>
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={data.cards} />
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton
                onPrint={handlePrint}
                printDisabled={loading || !!error || !applied || applied.scopeKey !== scopeKey || printing}
                filename="maintenance-requests"
                headers={['Request', 'Title', 'Machine', 'Type', 'Priority', 'Status', 'Date']}
                rows={data.rows}
                mapRow={(r) => [r.requestNumber, r.title, r.machine?.name || '', r.type, r.priority, r.status, new Date(r.createdAt).toLocaleDateString()]}
              />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} onRowClick={(r: any) => router.push(`/admin/maintenance/requests/${r.id}`)} />
          {data.totalPages > 1 && (
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />
          )}
        </div>
      )}
    </ReportPageShell>
  );
}
