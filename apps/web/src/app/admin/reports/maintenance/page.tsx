'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, Button, DataTable, LocalizedValue } from '../../../../components/admin/ui';
import { F9Lookup, productionLineAdapter, machineAdapter, machineComponentAdapter, operationTypeAdapter, costCenterAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportExportButton, ReportPageShell, ReportSummaryCards } from '../../../../components/reports';
import { useReportPrintSnapshot } from '../../../../components/print/use-report-print-snapshot';
import { maintenanceOverviewPrintModel, type MaintenanceOverviewPrintData } from '../../../../components/print/maintenance-overview-print';
import { PRINT_ROW_LIMIT, PrintPreparationError } from '../../../../lib/print';

export default function MaintenanceOverviewReportPage() {
  const { t, locale } = useTranslation();
  const { capture, invalidate, rememberLookup, printSnapshot, canPrint } = useReportPrintSnapshot<MaintenanceOverviewPrintData>();
  const sequence = useRef(0);
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [productionLineId, setProductionLineId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [machineComponentId, setMachineComponentId] = useState('');
  const [operationTypeId, setOperationTypeId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');

  const fetchData = useCallback(async () => {
    const generation = ++sequence.current;
    setLoading(true); setError('');
    try {
      const params: any = {};
      if (productionLineId) params.productionLineId = productionLineId;
      if (machineId) params.machineId = machineId;
      if (machineComponentId) params.machineComponentId = machineComponentId;
      if (operationTypeId) params.operationTypeId = operationTypeId;
      if (costCenterId) params.costCenterId = costCenterId;
      const res = await api.get<any>('/reports/maintenance/overview', { params });
      if (generation !== sequence.current) return;
      setData(res);
      capture(res, params);
    } catch (err: any) {
      if (generation !== sequence.current) return;
      setError(err?.message || t('reports.loadFailed'));
      invalidate();
    } finally { if (generation === sequence.current) setLoading(false); }
  }, [productionLineId, machineId, machineComponentId, operationTypeId, costCenterId, t, capture, invalidate]);

  useEffect(() => { fetchData(); return () => { sequence.current++; }; }, [fetchData]);

  const handlePrint = () => printSnapshot(!loading && !error, async snapshot => {
    const document = maintenanceOverviewPrintModel(snapshot, t, locale);
    if (document.sections.reduce((total, section) => total + section.rows.length, 0) > PRINT_ROW_LIMIT) throw new PrintPreparationError('limitExceeded');
    return document;
  });

  const clearFilters = () => {
    setProductionLineId('');
    setMachineId('');
    setMachineComponentId('');
    setOperationTypeId('');
    setCostCenterId('');
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    print: handlePrint,
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print'), readOnly: true, enabled: canPrint && !loading && !error },
  ]);

  const statusColumns = [
    { key: 'status', header: t('reports.status'), render: (r: any) => <LocalizedValue value={r.status} kind="status" /> },
    { key: 'count', header: t('reports.total') },
  ];

  const machineColumns = [
    { key: 'machineId', header: t('reports.machine') },
    { key: 'count', header: t('reports.total') },
    { key: 'totalMinutes', header: t('reports.totalDowntimeMinutes') },
  ];

  const scheduleColumns = [
    { key: 'title', header: t('common.name') },
    { key: 'machine', header: t('reports.machine'), render: (r: any) => r.machine?.name || '-' },
    { key: 'endDate', header: t('reports.dateTo'), render: (r: any) => r.endDate ? new Date(r.endDate).toLocaleDateString() : '-' },
  ];

  const requestColumns = [
    { key: 'requestNumber', header: t('maintenance.requestNumber') },
    { key: 'title', header: t('common.name') },
    { key: 'machine', header: t('reports.machine'), render: (r: any) => r.machine?.name || '-' },
    { key: 'status', header: t('reports.status'), render: (r: any) => <LocalizedValue value={r.status} kind="status" /> },
    { key: 'createdAt', header: t('common.createdAt'), render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <ReportPageShell
      title={t('reports.maintenanceOverview')}
      description={t('reports.maintenanceReports')}
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
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
          <ReportExportButton xlsxOnly filename="maintenance-overview" headers={[]} rows={[]} mapRow={() => []} reportEndpoint="maintenance/overview" />
        </div>
      }
    >
      {data && (
        <div className="space-y-6">
          <ReportSummaryCards cards={data.cards} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.total')} {t('reports.status')}</h3></CardHeader>
              <CardContent><DataTable columns={statusColumns} data={data.requestsByStatus || []} keyExtractor={(r: any) => r.status} /></CardContent>
            </Card>
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.total')} {t('reports.priority')}</h3></CardHeader>
              <CardContent><DataTable columns={statusColumns.map(c => c.key === 'status' ? { ...c, header: t('reports.priority'), render: (r: any) => <LocalizedValue value={r.priority} kind="priority" /> } : c)} data={data.requestsByPriority || []} keyExtractor={(r: any) => r.priority} /></CardContent>
            </Card>
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.total')} {t('reports.type')}</h3></CardHeader>
              <CardContent><DataTable columns={statusColumns.map(c => c.key === 'status' ? { ...c, header: t('reports.type'), render: (r: any) => <LocalizedValue value={r.type} kind="maintenanceType" /> } : c)} data={data.requestsByType || []} keyExtractor={(r: any) => r.type} /></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.topMachinesByRequests')}</h3></CardHeader>
              <CardContent><DataTable columns={machineColumns.filter(c => c.key !== 'totalMinutes')} data={data.topMachinesByRequestCount || []} keyExtractor={(r: any) => r.machineId} /></CardContent>
            </Card>
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.topMachinesByDowntime')}</h3></CardHeader>
              <CardContent><DataTable columns={machineColumns.filter(c => c.key !== 'count')} data={data.topMachinesByDowntime || []} keyExtractor={(r: any) => r.machineId} /></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.dueOverdueSchedules')}</h3></CardHeader>
              <CardContent><DataTable columns={scheduleColumns} data={data.dueSchedules || []} keyExtractor={(r: any) => r.id} /></CardContent>
            </Card>
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.recentRequests')}</h3></CardHeader>
              <CardContent><DataTable columns={requestColumns} data={data.recentRequests || []} keyExtractor={(r: any) => r.id} onRowClick={(r: any) => router.push(`/admin/maintenance/requests/${r.id}`)} /></CardContent>
            </Card>
          </div>
        </div>
      )}
    </ReportPageShell>
  );
}
