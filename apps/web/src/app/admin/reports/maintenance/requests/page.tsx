'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Select, Button, DataTable, Pagination } from '../../../../../components/admin/ui';
import { F9Lookup, machineAdapter, userAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../../components/reports';

export default function MaintenanceRequestsReportPage() {
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
      const res = await api.get<any>('/reports/maintenance/requests', { params });
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('reports.loadFailed'));
    } finally { setLoading(false); }
  }, [filters, machineId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); setMachineId(''); };

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

  const columns = [
    { key: 'requestNumber', header: t('maintenance.requestNumber'), render: (r: any) => <button onClick={() => router.push(`/admin/maintenance/requests/${r.id}`)} className="text-blue-600 hover:underline">{r.requestNumber}</button> },
    { key: 'title', header: t('common.name') },
    { key: 'machine', header: t('reports.machine'), render: (r: any) => r.machine?.name || '-' },
    { key: 'type', header: t('reports.type'), render: (r: any) => <span className="capitalize">{r.type?.toLowerCase()}</span> },
    { key: 'priority', header: t('reports.priority'), render: (r: any) => <span className="capitalize">{r.priority?.toLowerCase()}</span> },
    { key: 'status', header: t('reports.status'), render: (r: any) => <span className="capitalize">{r.status?.toLowerCase()}</span> },
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
          <div className="w-48"><F9Lookup adapter={machineAdapter} value={machineId} onChange={setMachineId} placeholder={t('reports.machine')} /></div>
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
