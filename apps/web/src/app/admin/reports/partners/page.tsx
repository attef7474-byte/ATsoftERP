'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Select, Button, DataTable, Pagination } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../components/reports';

export default function PartnersReportPage() {
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
      const res = await api.get<any>('/reports/partners', { params: filters });
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
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'type', header: t('maintenance.type'), render: (r: any) => <span className="capitalize">{r.type?.toLowerCase()}</span> },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'isBlocked', header: t('reports.status'), render: (r: any) => r.isBlocked ? t('reports.inactive') : t('reports.active') },
  ];

  return (
    <ReportPageShell title={t('reports.partnersReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><Input value={filters.search || ''} onChange={e => setFilters((f: any) => ({ ...f, search: e.target.value || undefined, page: 1 }))} placeholder={t('common.search')} /></div>
          <div className="w-40">
            <Select value={filters.type || ''} onChange={e => setFilters((f: any) => ({ ...f, type: e.target.value || undefined, page: 1 }))} placeholder={t('maintenance.type')} options={[
              { value: 'SUPPLIER', label: 'Supplier' },
              { value: 'CUSTOMER', label: 'Customer' },
              { value: 'BOTH', label: 'Both' },
            ]} />
          </div>
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={data.cards} />
          {data.byType && data.byType.length > 0 && (
            <div className="flex gap-4 text-sm">
              {data.byType.map((t: any, i: number) => (
                <span key={i} className="capitalize"><strong>{t.type?.toLowerCase()}:</strong> {t.count}</span>
              ))}
            </div>
          )}
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton filename="business-partners" headers={['Code', 'Name', 'Type', 'Email', 'Phone', 'Status']} rows={data.rows}
                mapRow={(r) => [r.code, r.name, r.type, r.email || '', r.phone || '', r.isBlocked ? 'Inactive' : 'Active']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}