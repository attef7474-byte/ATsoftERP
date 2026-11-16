'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Select, Button, DataTable, Pagination, LocalizedValue } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../components/reports';
import { useReportPrintSnapshot } from '../../../../components/print/use-report-print-snapshot';
import { systemPartnersPrintModel, type PartnersPrintData } from '../../../../components/print/system-partners-print';
import { collectPrintRows } from '../../../../lib/print';

export default function PartnersReportPage() {
  const { t, locale } = useTranslation();
  const { capture, invalidate, printSnapshot, canPrint } = useReportPrintSnapshot<PartnersPrintData>();
  const fetchSequence = useRef(0);
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 20 });

  const fetchData = useCallback(async () => {
    const generation = ++fetchSequence.current;
    setLoading(true); setError('');
    try {
      const res = await api.get<any>('/reports/partners', { params: filters });
      if (generation !== fetchSequence.current) return;
      setData(res);
      capture(res, filters);
    } catch (err: any) {
      if (generation !== fetchSequence.current) return;
      setError(err?.message || t('reports.loadFailed'));
      invalidate();
    } finally { if (generation === fetchSequence.current) setLoading(false); }
  }, [filters, t, capture, invalidate]);

  useEffect(() => { fetchData(); return () => { fetchSequence.current++; }; }, [fetchData]);

  const handlePrint = () => printSnapshot(!loading && !error && !!data, async (snapshot, assertScope) => {
    const result = await collectPrintRows(
      (page, pageSize) => api.get<PartnersPrintData>('/reports/partners', { params: { ...snapshot.params, page, pageSize } }),
      assertScope, row => row.id,
    );
    return systemPartnersPrintModel({ ...snapshot, data: { ...result.first as PartnersPrintData, rows: result.rows } }, t, locale);
  });

  const clearFilters = () => { setFilters({ page: 1, pageSize: 20 }); };

  const { exec } = useStableHandlers({
    back: () => router.back(), refresh: () => fetchData(), print: handlePrint,
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print'), readOnly: true, enabled: canPrint && !loading && !error },
  ]);

  const columns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'type', header: t('maintenance.type'), render: (r: any) => <LocalizedValue value={r.type} kind="enum" /> },
    { key: 'email', header: t('common.email') },
    { key: 'phone', header: t('common.phone') },
    { key: 'isBlocked', header: t('reports.status'), render: (r: any) => r.isBlocked ? t('reports.inactive') : t('reports.active') },
  ];

  return (
    <ReportPageShell title={t('reports.partnersReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><Input value={filters.search || ''} onChange={e => setFilters((f: any) => ({ ...f, search: e.target.value || undefined, page: 1 }))} placeholder={t('common.search')} /></div>
          <div className="w-40">
            <Select value={filters.type || ''} onChange={e => setFilters((f: any) => ({ ...f, type: e.target.value || undefined, page: 1 }))} placeholder={t('maintenance.type')} options={[
              { value: 'SUPPLIER', label: t('common.supplier') },
              { value: 'CUSTOMER', label: t('common.customer') },
              { value: 'BOTH', label: t('common.both') },
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
                <span key={i}><strong><LocalizedValue value={t.type} kind="enum" />:</strong> {t.count}</span>
              ))}
            </div>
          )}
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton onPrint={handlePrint} printDisabled={!canPrint || loading || !!error} filename="business-partners" headers={['Code', 'Name', 'Type', 'Email', 'Phone', 'Status']} rows={data.rows}
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
