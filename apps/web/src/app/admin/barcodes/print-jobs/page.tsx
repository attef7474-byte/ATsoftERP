'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Select, Card, CardContent, PageHeader, LoadingState, EmptyState, ErrorState, StatusBadge, Pagination } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { BarcodePrintJob, PaginatedResponse } from '../../../../lib/admin-types';

const JOB_TYPES = ['', 'DIRECT_PRINT', 'BATCH_PRINT', 'REPRINT'];
const STATUSES = ['', 'PENDING', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED'];

export default function PrintJobsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<BarcodePrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const fetchJobs = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (jobTypeFilter) params.jobType = jobTypeFilter;
      const res = await api.get<PaginatedResponse<BarcodePrintJob>>('/barcodes/print-jobs', { params });
      setJobs(res.data || []);
      setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); setJobs([]); }
    finally { setLoading(false); }
  }, [page, statusFilter, jobTypeFilter, t]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleClear = () => { setStatusFilter(''); setJobTypeFilter(''); setPage(1); };

  const statusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'PRINTING': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      default: return '';
    }
  };

  const { exec } = useStableHandlers({ refresh: () => fetchJobs() });
  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.printJobs.title')} />

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-3 items-end">
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                options={STATUSES.map((s) => ({ value: s, label: s || t('common.all') }))} placeholder={t('common.status')} />
              <Select value={jobTypeFilter} onChange={(e) => { setJobTypeFilter(e.target.value); setPage(1); }}
                options={JOB_TYPES.map((j) => ({ value: j, label: j || t('common.all') }))} placeholder={t('barcodes.jobType')} />
              <Button variant="secondary" onClick={handleClear}>{t('common.clearSearch')}</Button>
            </div>
          </div>

          {loading && <LoadingState />}
          {error && !loading && <ErrorState message={error} onRetry={fetchJobs} />}
          {!loading && !error && jobs.length === 0 && <EmptyState message={t('barcodes.printJobs.noJobs')} />}

          {!loading && !error && jobs.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.jobType')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.entityType')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.copies')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.printer')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.requestedAt')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('barcodes.completedAt')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {jobs.map((j) => (
                      <tr key={j.id} onClick={() => router.push(`/admin/barcodes/print-jobs/${j.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm">{j.jobType}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(j.status)}`}>{j.status}</span></td>
                        <td className="px-4 py-3 text-sm">{j.entityType || '-'}</td>
                        <td className="px-4 py-3 text-sm">{j.copies}</td>
                        <td className="px-4 py-3 text-sm">{j.printerName || '-'}</td>
                        <td className="px-4 py-3 text-sm">{j.requestedAt ? new Date(j.requestedAt).toLocaleString() : '-'}</td>
                        <td className="px-4 py-3 text-sm">{j.completedAt ? new Date(j.completedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
