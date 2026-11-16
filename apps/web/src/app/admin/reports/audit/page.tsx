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
import { systemAuditPrintModel, type AuditPrintData } from '../../../../components/print/system-audit-print';
import { collectPrintRows } from '../../../../lib/print';

export default function AuditTrailReportPage() {
  const { t, locale } = useTranslation();
  const { capture, invalidate, printSnapshot, canPrint } = useReportPrintSnapshot<AuditPrintData>();
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
      const res = await api.get<any>('/reports/audit', { params: filters });
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
      (page, pageSize) => api.get<AuditPrintData>('/reports/audit', { params: { ...snapshot.params, page, pageSize } }),
      assertScope, row => row.id,
    );
    return systemAuditPrintModel({ ...snapshot, data: { ...result.first as AuditPrintData, rows: result.rows } }, t, locale);
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
    { key: 'action', header: t('reports.auditAction'), render: (r: any) => <LocalizedValue value={r.action} kind="action" /> },
    { key: 'entity', header: t('reports.byEntity'), render: (r: any) => <LocalizedValue value={r.entity} kind="entity" /> },
    { key: 'user', header: t('reports.generatedBy'), render: (r: any) => r.user?.name || '-' },
    { key: 'details', header: t('common.description'), render: (r: any) => r.details || '-' },
    { key: 'createdAt', header: t('common.createdAt'), render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleString() : '-' },
  ];

  return (
    <ReportPageShell title={t('reports.auditTrailReport')} loading={loading} error={error} onRetry={fetchData}
      filters={
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48"><Input value={filters.search || ''} onChange={e => setFilters((f: any) => ({ ...f, search: e.target.value || undefined, page: 1 }))} placeholder={t('common.search')} /></div>
          <div className="w-36"><Input type="date" value={filters.dateFrom || ''} onChange={e => setFilters((f: any) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))} placeholder={t('reports.dateFrom')} /></div>
          <div className="w-36"><Input type="date" value={filters.dateTo || ''} onChange={e => setFilters((f: any) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))} placeholder={t('reports.dateTo')} /></div>
          <Button variant="ghost" onClick={clearFilters}>{t('reports.clearFilters')}</Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={data.cards} />
          {data.byAction && data.byAction.length > 0 && (
            <div className="flex flex-wrap gap-4 text-sm">
              {data.byAction.map((a: any, i: number) => (
                <span key={i}><strong><LocalizedValue value={a.action} kind="action" />:</strong> {a.count}</span>
              ))}
            </div>
          )}
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton onPrint={handlePrint} printDisabled={!canPrint || loading || !!error} filename="audit-trail" headers={['Action', 'Entity', 'User', 'Details', 'Date']} rows={data.rows}
                mapRow={(r) => [r.action, r.entity, r.user?.name || '', r.details || '', r.createdAt ? new Date(r.createdAt).toLocaleString() : '']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}
