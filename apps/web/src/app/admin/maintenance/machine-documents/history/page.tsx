'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { PaginationMeta, MachineDocument } from '../../../../../lib/admin-types';
import { Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionBackIcon } from '../../../../../components/admin/admin-action-bar';

export default function MachineDocumentHistoryPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<MachineDocument[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MachineDocument[]; meta: PaginationMeta }>('/maintenance/machine-documents/history', { params: { page, limit: 20 } });
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
    { key: 'title', header: t('maintenance.title'), render: (r: MachineDocument) => r.title || '-' },
    { key: 'type', header: t('maintenance.type'), render: (r: MachineDocument) => r.type || '-' },
    { key: 'machineName', header: t('maintenance.machine'), render: (r: MachineDocument) => r.machine?.name || '-' },
    { key: 'createdAt', header: t('common.date'), render: (r: MachineDocument) => fmt(r.createdAt) },
    {
      key: 'actions', header: t('common.actions'), render: (r: MachineDocument) => (
        <button onClick={() => router.push(`/admin/maintenance/machine-documents/${r.id}`)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.view')}</button>
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
          <DataTable columns={columns} data={data} keyExtractor={(r: MachineDocument) => r.id} onRowClick={(r: MachineDocument) => router.push(`/admin/maintenance/machine-documents/${r.id}`)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
