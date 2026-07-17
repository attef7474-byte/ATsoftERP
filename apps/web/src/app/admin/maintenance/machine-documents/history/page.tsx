'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { PaginationMeta } from '../../../../../lib/admin-types';
import { Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionBackIcon } from '../../../../../components/admin/admin-action-bar';

interface DocumentHistoryEntry {
  id: string;
  documentId: string;
  fileName?: string | null;
  machineName?: string | null;
  action: string;
  description?: string | null;
  createdAt: string;
}

export default function MachineDocumentHistoryPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<DocumentHistoryEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: DocumentHistoryEntry[]; meta: PaginationMeta }>('/maintenance/machine-documents/history', { params: { page, limit: 20 } });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fmt = (d: string) => new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const columns = [
    { key: 'fileName', header: t('maintenance.fileName'), render: (r: DocumentHistoryEntry) => r.fileName || '-' },
    { key: 'machineName', header: t('maintenance.machine'), render: (r: DocumentHistoryEntry) => r.machineName || '-' },
    { key: 'action', header: t('common.action'), render: (r: DocumentHistoryEntry) => (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        r.action === 'CREATED' ? 'bg-green-100 text-green-800' :
        r.action === 'UPDATED' ? 'bg-blue-100 text-blue-800' :
        r.action === 'DELETED' ? 'bg-red-100 text-red-800' :
        'bg-gray-100 text-gray-800'
      }`}>{r.action}</span>
    )},
    { key: 'description', header: t('common.description'), render: (r: DocumentHistoryEntry) => r.description || '-' },
    { key: 'createdAt', header: t('common.date'), render: (r: DocumentHistoryEntry) => fmt(r.createdAt) },
    {
      key: 'actions', header: t('common.actions'), render: (r: DocumentHistoryEntry) => (
        <button onClick={() => router.push(`/admin/maintenance/machine-documents/${r.documentId}`)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.view')}</button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.documentHistory')} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(r: DocumentHistoryEntry) => r.id} onRowClick={(r: DocumentHistoryEntry) => router.push(`/admin/maintenance/machine-documents/${r.documentId}`)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
