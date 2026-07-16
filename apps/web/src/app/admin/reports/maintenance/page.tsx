'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, Button, DataTable, LoadingState, ErrorState } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards } from '../../../../components/reports';

export default function MaintenanceOverviewReportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>('/reports/maintenance/overview');
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('reports.loadFailed'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    print: () => window.print(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print') },
  ]);

  const statusColumns = [
    { key: 'status', header: t('reports.status'), render: (r: any) => <span className="capitalize">{r.status?.toLowerCase()}</span> },
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
    { key: 'status', header: t('reports.status'), render: (r: any) => <span className="capitalize">{r.status?.toLowerCase()}</span> },
    { key: 'createdAt', header: t('common.createdAt'), render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <ReportPageShell
      title={t('reports.maintenanceOverview')}
      description={t('reports.maintenanceReports')}
      loading={loading}
      error={error}
      onRetry={fetchData}
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
              <CardContent><DataTable columns={statusColumns.map(c => c.key === 'status' ? { ...c, header: t('reports.priority'), render: (r: any) => <span className="capitalize">{r.priority?.toLowerCase()}</span> } : c)} data={data.requestsByPriority || []} keyExtractor={(r: any) => r.priority} /></CardContent>
            </Card>
            <Card>
              <CardHeader><h3 className="font-semibold">{t('reports.total')} {t('reports.type')}</h3></CardHeader>
              <CardContent><DataTable columns={statusColumns.map(c => c.key === 'status' ? { ...c, header: t('reports.type'), render: (r: any) => <span className="capitalize">{r.type?.toLowerCase()}</span> } : c)} data={data.requestsByType || []} keyExtractor={(r: any) => r.type} /></CardContent>
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
