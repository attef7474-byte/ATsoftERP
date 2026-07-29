'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useRegisterAdminActions, ActionBackIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { Card, CardContent, CardHeader } from '../../../../components/admin/ui/card';
import { DataTable } from '../../../../components/admin/ui/data-table';
import { LoadingState } from '../../../../components/admin/ui/loading-state';
import { ErrorState } from '../../../../components/admin/ui/error-state';
import { EmptyState } from '../../../../components/admin/ui/empty-state';
import { StatusBadge } from '../../../../components/admin/ui/status-badge';
import { LocalizedValue } from '../../../../components/admin/ui/localized-value';

export default function MaintenanceWorkloadPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');

  const today = new Date().toISOString().slice(0, 10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/maintenance/calendar-workload/workload/summary', { params: { date: today } });
      setSummary(data);
    } catch (err: any) {
      setError(err.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [today, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRegisterAdminActions([
    { id: 'back', labelKey: 'actions.back', icon: <ActionBackIcon />, onClick: () => { window.location.href = '/admin/maintenance'; } },
    { id: 'refresh', labelKey: 'actions.refresh', icon: <ActionRefreshIcon />, onClick: fetchData },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const personnelColumns = [
    { key: 'personnelName', header: t('maintenance.name') },
    { key: 'role', header: t('maintenance.role') },
    { key: 'assignedCount', header: t('common.count') },
    { key: 'totalEstimatedMinutes', header: t('maintenance.estimatedDuration'), render: (r: any) => `${Math.round(r.totalEstimatedMinutes / 60 * 10) / 10}h` },
    { key: 'dailyCapacityMinutes', header: t('maintenance.capacity'), render: (r: any) => `${Math.round(r.dailyCapacityMinutes / 60 * 10) / 10}h` },
    { key: 'workloadPercent', header: t('maintenance.workloadPercent'), render: (r: any) => (
      <span className={`px-2 py-1 rounded text-xs font-medium ${r.workloadPercent > 100 ? 'bg-red-100 text-red-800' : r.workloadPercent > 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{r.workloadPercent}%</span>
    )},
    { key: 'status', header: t('status.status'), render: (r: any) => <StatusBadge status={r.status} /> },
  ];

  const machineColumns = [
    { key: 'machineName', header: t('maintenance.machine') },
    { key: 'machineCode', header: t('maintenance.code') },
    { key: 'activeRequestCount', header: t('common.count') },
    { key: 'totalEstimatedMinutes', header: t('maintenance.estimatedDuration'), render: (r: any) => `${Math.round(r.totalEstimatedMinutes / 60 * 10) / 10}h` },
  ];

  const lineColumns = [
    { key: 'productionLineName', header: t('maintenance.productionLine') },
    { key: 'machineCount', header: t('maintenance.machines') },
    { key: 'activeRequestCount', header: t('maintenance.requests') },
    { key: 'totalEstimatedMinutes', header: t('maintenance.estimatedDuration'), render: (r: any) => `${Math.round(r.totalEstimatedMinutes / 60 * 10) / 10}h` },
  ];

  const conflictColumns = [
    { key: 'type', header: t('maintenance.eventType'), render: (r: any) => <LocalizedValue value={r.type} /> },
    { key: 'personnelName', header: t('maintenance.name') },
    { key: 'severity', header: t('status.status'), render: (r: any) => <StatusBadge status={r.severity} /> },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('maintenance.workloadPlanning')}</h1>
      </div>
      <div className="flex gap-2 mb-4">
        {['overview', 'personnel', 'machine', 'line', 'conflicts'].map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)} className={`px-3 py-1 rounded text-sm ${tab === tabKey ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{t(`maintenance.${tabKey === 'overview' ? 'planningOverview' : tabKey === 'personnel' ? 'workByPersonnel' : tabKey === 'machine' ? 'workByMachine' : tabKey === 'line' ? 'workByLine' : 'conflictCount'}`)}</button>
        ))}
      </div>
      {tab === 'overview' && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div onClick={() => { window.location.href = '/admin/maintenance/planning/unassigned'; }} className="bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer p-6">
            <div className="text-3xl font-bold text-blue-600">{summary.unassignedCount}</div><div className="text-sm text-gray-500">{t('maintenance.unassignedWork')}</div>
          </div>
          <div onClick={() => { window.location.href = '/admin/maintenance/planning/overdue'; }} className="bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer p-6">
            <div className="text-3xl font-bold text-red-600">{summary.overdueCount}</div><div className="text-sm text-gray-500">{t('maintenance.overdueWork')}</div>
          </div>
          <div onClick={() => { window.location.href = '/admin/maintenance/planning/sla-due'; }} className="bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer p-6">
            <div className="text-3xl font-bold text-amber-600">{summary.slaDueCount}</div><div className="text-sm text-gray-500">{t('maintenance.slaDueWork')}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="text-3xl font-bold text-green-600">{summary.totalActiveRequests}</div><div className="text-sm text-gray-500">{t('maintenance.totalActiveRequests')}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="text-3xl font-bold text-purple-600">{summary.overloadedCount}</div><div className="text-sm text-gray-500">{t('maintenance.overloadedCount')}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="text-3xl font-bold text-orange-600">{summary.conflictCount}</div><div className="text-sm text-gray-500">{t('maintenance.conflictCount')}</div>
          </div>
        </div>
      )}
      {tab === 'personnel' && summary && (
        <Card><CardContent>{summary.workloadByPersonnel.length === 0 ? <EmptyState message={t('maintenance.noScheduledWork')} /> : <DataTable columns={personnelColumns} data={summary.workloadByPersonnel} keyExtractor={(r: any) => r.personnelId || r.id} />}</CardContent></Card>
      )}
      {tab === 'machine' && summary && (
        <Card><CardContent>{summary.workloadByMachine.length === 0 ? <EmptyState message={t('maintenance.noScheduledWork')} /> : <DataTable columns={machineColumns} data={summary.workloadByMachine} keyExtractor={(r: any) => r.machineId || r.id} />}</CardContent></Card>
      )}
      {tab === 'line' && summary && (
        <Card><CardContent>{summary.workloadByProductionLine.length === 0 ? <EmptyState message={t('maintenance.noScheduledWork')} /> : <DataTable columns={lineColumns} data={summary.workloadByProductionLine} keyExtractor={(r: any) => r.productionLineId || r.id} />}</CardContent></Card>
      )}
      {tab === 'conflicts' && summary && (
        <Card><CardContent>{summary.conflicts.length === 0 ? <EmptyState message={t('maintenance.noConflicts')} /> : <DataTable columns={conflictColumns} data={summary.conflicts} keyExtractor={(r: any) => r.id || Math.random().toString()} />}</CardContent></Card>
      )}
      <div className="text-xs text-gray-400 mt-4">{t('maintenance.hrNotUsed')} | {t('maintenance.capacityRule')}</div>
    </div>
  );
}
