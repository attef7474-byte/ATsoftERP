'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Button, DataTable, Pagination } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../components/admin/admin-action-bar';
import { ReportPageShell, ReportSummaryCards, ReportExportButton } from '../../../../components/reports';
import { useReportPrintSnapshot } from '../../../../components/print/use-report-print-snapshot';
import { systemAttachmentsPrintModel, type AttachmentsPrintData } from '../../../../components/print/system-attachments-print';
import { collectPrintRows } from '../../../../lib/print';

export default function AttachmentsReportPage() {
  const { t, locale } = useTranslation();
  const { capture, invalidate, printSnapshot, canPrint } = useReportPrintSnapshot<AttachmentsPrintData>();
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
      const res = await api.get<any>('/reports/attachments', { params: filters });
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
      (page, pageSize) => api.get<AttachmentsPrintData>('/reports/attachments', { params: { ...snapshot.params, page, pageSize } }),
      assertScope, row => row.id,
    );
    return systemAttachmentsPrintModel({ ...snapshot, data: { ...result.first as AttachmentsPrintData, rows: result.rows } }, t, locale);
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
    { key: 'originalName', header: t('common.name') },
    { key: 'entityName', header: t('reports.byEntity'), render: (r: any) => r.entityName || '-' },
    { key: 'mimeType', header: t('common.type') },
    { key: 'size', header: t('reports.totalAttachmentsSize'), render: (r: any) => r.size ? `${(r.size / 1024).toFixed(1)} KB` : '-' },
    { key: 'uploadedBy', header: t('reports.generatedBy'), render: (r: any) => r.uploadedBy?.name || '-' },
    { key: 'createdAt', header: t('common.createdAt'), render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-' },
  ];

  return (
    <ReportPageShell title={t('reports.attachmentsReport')} loading={loading} error={error} onRetry={fetchData}
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
          {data.rows?.length > 0 && (
            <div className="flex justify-end">
              <ReportExportButton onPrint={handlePrint} printDisabled={!canPrint || loading || !!error} filename="attachments" reportEndpoint="attachments" headers={[t('reports.exportHeaders.name'), t('reports.exportHeaders.entity'), t('reports.exportHeaders.type'), t('reports.exportHeaders.size'), t('reports.exportHeaders.uploadedBy'), t('reports.exportHeaders.date')]} rows={data.rows}
                mapRow={(r) => [r.originalName, r.entityName || '', r.mimeType || '', String(r.size || 0), r.uploadedBy?.name || '', r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '']} />
            </div>
          )}
          <DataTable columns={columns} data={data.rows || []} keyExtractor={(r: any) => r.id} />
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={p => setFilters((f: any) => ({ ...f, page: p }))} />}
        </div>
      )}
    </ReportPageShell>
  );
}