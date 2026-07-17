'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Select, Button, DataTable, Pagination } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../components/reports';

export default function UserActivityReportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>('/reports/user-activity', { params: filters });
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('reports.loadFailed'));
    } finally { setLoading(false); }
  }, [filters, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: () => window.print(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print') },
  ]);

  const columns = [
    { key: 'name', header: t('common.name') },
    { key: 'email', header: 'Email' },
    { key: 'status', header: t('reports.status'), render: (r: any) => <span className="capitalize">{r.status?.toLowerCase()}</span> },
    { key: 'lastLoginAt', header: t('reports.lastLogin'), render: (r: any) => r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : '-' },
    { key: 'createdAt', header: t('common.createdAt'), render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-' },
  ];

  return (
    <ReportPageShell title={t('reports.userActivityReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><Input value={filters.search || ''} onChange={e => setFilters((f: any) => ({ ...f, search: e.target.value || undefined, page: 1 }))} placeholder={t('common.search')} /></div>
          <div className="w-40">
            <Select value={filters.status || ''} onChange={e => setFilters((f: any) => ({ ...f, status: e.target.value || undefined, page: 1 }))} placeholder={t('reports.status')} options={[
              { value: 'ACTIVE', label: t('reports.active') },
              { value: 'INACTIVE', label: t('reports.inactive') },
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
              <ReportExportButton filename="user-activity" headers={['Name', 'Email', 'Status', 'Last Login', 'Created']} rows={data.rows}
                mapRow={(r) => [r.name, r.email, r.status, r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString() : '', r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}