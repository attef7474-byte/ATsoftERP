'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Select, Button, DataTable, Pagination } from '../../../../../components/admin/ui';
import { F9Lookup, machineAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../../components/reports';

export default function SchedulesReportPage() {
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
      const res = await api.get<any>('/reports/maintenance/schedules', { params });
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
    { key: 'title', header: t('common.name') },
    { key: 'machine', header: t('reports.machine'), render: (r: any) => r.machine?.name || '-' },
    { key: 'type', header: t('reports.type'), render: (r: any) => <span className="capitalize">{r.type?.toLowerCase()}</span> },
    { key: 'frequency', header: t('maintenance.frequency') },
    { key: 'startDate', header: t('maintenance.startDate'), render: (r: any) => r.startDate ? new Date(r.startDate).toLocaleDateString() : '-' },
    { key: 'endDate', header: t('maintenance.endDate'), render: (r: any) => r.endDate ? new Date(r.endDate).toLocaleDateString() : '-' },
    { key: 'status', header: t('reports.status'), render: (r: any) => <span className="capitalize">{r.status?.toLowerCase()}</span> },
  ];

  return (
    <ReportPageShell title={t('reports.schedulesReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><F9Lookup adapter={machineAdapter} value={machineId} onChange={setMachineId} placeholder={t('reports.machine')} /></div>
          <div className="w-40">
            <Select value={filters.dueStatus || ''} onChange={e => setFilters((f: any) => ({ ...f, dueStatus: e.target.value || undefined, page: 1 }))} placeholder={t('reports.status')} options={[
              { value: 'overdue', label: t('reports.overdue') },
              { value: 'dueSoon', label: t('reports.dueSoon') },
              { value: 'notDue', label: t('reports.notDue') },
            ]} />
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
              <ReportExportButton filename="preventive-schedules" headers={['Title', 'Machine', 'Type', 'Frequency', 'Start', 'End', 'Status']} rows={data.rows}
                mapRow={(r) => [r.title, r.machine?.name || '', r.type, r.frequency, r.startDate ? new Date(r.startDate).toLocaleDateString() : '', r.endDate ? new Date(r.endDate).toLocaleDateString() : '', r.status]} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} onRowClick={(r: any) => router.push(`/admin/maintenance/schedules/${r.id}/checklist`)} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}
