'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useRouter } from 'next/navigation';
import { Input, Button, Card, CardHeader, CardContent, DataTable, LoadingState, ErrorState, PageHeader } from '../../../../../components/admin/ui';
import { F9Lookup, productionLineAdapter, machineAdapter, operationTypeAdapter, costCenterAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

export default function MaintenanceKpisPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [kpiData, setKpiData] = useState<any>(null);
  const [reliabilityData, setReliabilityData] = useState<any>(null);
  const [complianceData, setComplianceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [productionLineId, setProductionLineId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [operationTypeId, setOperationTypeId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: any = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (productionLineId) params.productionLineId = productionLineId;
      if (machineId) params.machineId = machineId;
      if (operationTypeId) params.operationTypeId = operationTypeId;
      if (costCenterId) params.costCenterId = costCenterId;

      const [kpi, reliability, compliance] = await Promise.all([
        api.get<any>('/reports/maintenance/kpi-overview', { params }),
        api.get<any>('/maintenance/reliability/repeat-failure-rate', { params }),
        api.get<any>('/reports/maintenance/schedule-compliance', { params }),
      ]);
      setKpiData(kpi);
      setReliabilityData(reliability);
      setComplianceData(compliance);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [dateFrom, dateTo, productionLineId, machineId, operationTypeId, costCenterId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setProductionLineId(''); setMachineId(''); setOperationTypeId(''); setCostCenterId(''); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const currency = t('common.currency');
  const cards = kpiData?.cards || [];
  const reliabilityCards = [
    { label: t('maintenance.totalDowntime'), value: cards.find((c: any) => c.label === 'totalDowntime')?.value ? `${cards.find((c: any) => c.label === 'totalDowntime').value} ${t('common.minutes')}` : '0' },
    { label: t('maintenance.totalDowntime') + ' (h)', value: cards.find((c: any) => c.label === 'totalDowntimeHours')?.value ? `${cards.find((c: any) => c.label === 'totalDowntimeHours').value} h` : '0 h' },
    { label: t('maintenanceDashboard.kpiOpenRequests'), value: cards.find((c: any) => c.label === 'openBacklog')?.value ?? cards.find((c: any) => c.label === 'openRequests')?.value ?? 0 },
    { label: t('maintenance.totalCost'), value: cards.find((c: any) => c.label === 'totalCost')?.value ? `${cards.find((c: any) => c.label === 'totalCost').value.toLocaleString()} ${currency}` : `0 ${currency}` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('maintenance.kpiOverview') || 'Maintenance KPIs Overview'} />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="w-44"><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder={t('reports.dateFrom')} /></div>
        <div className="w-44"><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder={t('reports.dateTo')} /></div>
        <div className="w-48"><F9Lookup adapter={productionLineAdapter} value={productionLineId} onChange={setProductionLineId} placeholder={t('maintenance.productionLine')} /></div>
        <div className="w-48"><F9Lookup adapter={machineAdapter} value={machineId} onChange={setMachineId} placeholder={t('reports.machine')} /></div>
        <div className="w-48"><F9Lookup adapter={operationTypeAdapter} value={operationTypeId} onChange={setOperationTypeId} placeholder={t('maintenance.operationType')} /></div>
        <div className="w-48"><F9Lookup adapter={costCenterAdapter} value={costCenterId} onChange={setCostCenterId} placeholder={t('maintenance.costCenter')} /></div>
        <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.filter((c: any) => ['totalRequests', 'openRequests', 'inProgressRequests', 'completedRequests'].includes(c.label)).map((c: any, i: number) => (
          <Card key={i}><CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t(`maintenance.${c.label}` as any) || c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value ?? '-'}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Cost KPIs */}
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenance.totalCost')}</h3></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.filter((c: any) => ['totalCost', 'partsCost', 'otherCost', 'openBacklog', 'pmCmRatio', 'emergencyPercentage', 'slaOverduePercentage', 'avgCompletionTime'].includes(c.label)).map((c: any, i: number) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t(`maintenance.${c.label}` as any) || c.label}</p>
                <p className="text-xl font-semibold mt-1">
                  {c.value != null ? c.label === 'totalCost' || c.label === 'partsCost' || c.label === 'otherCost' ? `${c.value.toLocaleString()} ${currency}` : c.unit === '%' ? `${c.value}%` : c.unit === 'hours' ? `${c.value} h` : c.value : '-'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reliability KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('maintenance.reliabilityKpis')}</h3></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {reliabilityCards.map((item, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                  <p className="text-xl font-semibold mt-1">{item.value}</p>
                </div>
              ))}
              {reliabilityData && (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('maintenance.repeatFailureRate') || 'Repeat Failure Rate'}</p>
                    <p className="text-xl font-semibold mt-1">{reliabilityData.repeatFailureRate != null ? `${reliabilityData.repeatFailureRate}%` : '-'}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('maintenance.totalDowntimeEvents') || 'Events'}</p>
                    <p className="text-xl font-semibold mt-1">{reliabilityData.totalEvents ?? '-'}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Schedule Compliance */}
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">{t('maintenance.scheduleCompliance') || 'Schedule Compliance'}</h3></CardHeader>
          <CardContent>
            {complianceData ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('maintenanceDashboard.completionRate') || 'Compliance Rate'}</p>
                  <p className="text-xl font-semibold mt-1">{complianceData.cards?.find((c: any) => c.label === 'complianceRate')?.value != null ? `${complianceData.cards.find((c: any) => c.label === 'complianceRate').value}%` : '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('maintenanceDashboard.completedRequests') || 'Completed Preventive'}</p>
                  <p className="text-xl font-semibold mt-1">{complianceData.cards?.find((c: any) => c.label === 'completedPreventive')?.value ?? '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('maintenanceDashboard.overdueSchedules')}</p>
                  <p className="text-xl font-semibold mt-1">{complianceData.cards?.find((c: any) => c.label === 'overdueSchedules')?.value ?? '-'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('maintenanceDashboard.activeSchedules') || 'Active Schedules'}</p>
                  <p className="text-xl font-semibold mt-1">{complianceData.cards?.find((c: any) => c.label === 'activeSchedules')?.value ?? '-'}</p>
                </div>
              </div>
            ) : <p className="text-sm text-gray-500">{t('common.noData')}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Card summary from KPI overview */}
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceDashboard.title')} — {t('reports.summary')}</h3></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {cards.filter((c: any) => !['totalRequests', 'openRequests', 'inProgressRequests', 'completedRequests', 'totalCost', 'partsCost', 'otherCost', 'openBacklog', 'pmCmRatio', 'emergencyPercentage', 'slaOverduePercentage', 'avgCompletionTime', 'totalDowntime', 'totalDowntimeHours', 'totalDowntimeEvents', 'activeDowntime', 'overdueSchedules'].includes(c.label)).map((c: any, i: number) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t(`maintenance.${c.label}` as any) || c.label}</p>
                <p className="text-lg font-semibold mt-1">{c.unit === '%' ? `${c.value ?? '-'}%` : c.unit === 'hours' ? `${c.value ?? '-'} h` : c.unit === 'minutes' ? `${c.value ?? '-'} ${t('common.minutes')}` : c.value ?? '-'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
