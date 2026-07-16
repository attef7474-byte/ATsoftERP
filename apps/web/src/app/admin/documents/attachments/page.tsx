'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Select, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, ConfirmDialog } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionBackIcon, ActionAddIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

function formatSize(bytes: number): string {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

export default function AttachmentsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, pageSize: 20 };
      if (entityFilter) params.entityType = entityFilter;
      const res = await api.get<{ data: any[]; total: number }>('/attachments', { params });
      setData(res.data || []);
      setMeta({ page, limit: 20, total: res.total || 0, totalPages: Math.ceil((res.total || 0) / 20) });
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [entityFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/attachments/${confirmDelete.id}`);
      showToast(t('attachments.deleteSuccess'), 'success');
      setConfirmDelete(null);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.deleteFailed'), 'error'); }
  };

  const handleDownload = async () => {
    if (!selectedId) return;
    try {
      const res = await api.get<any>(`/attachments/${selectedId}/download`);
      window.open(`/api/v1/attachments/${selectedId}/download`, '_blank');
    } catch { /* handled by response */ }
  };

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
    back: () => router.back(),
    add: () => router.push('/admin/documents/attachments/upload'),
    download: () => handleDownload(),
    delete: () => selectedRecord && setConfirmDelete(selectedRecord),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'add', labelKey: 'attachments.upload', icon: <ActionAddIcon />, onClick: () => exec('add') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'originalName', header: t('attachments.originalName'), render: (item: any) => <span className="text-sm">{item.originalName}</span> },
    { key: 'mimeType', header: t('attachments.mimeType'), render: (item: any) => <span className="text-xs font-mono">{item.mimeType}</span> },
    { key: 'size', header: t('attachments.size'), render: (item: any) => formatSize(item.size) },
    { key: 'entityName', header: t('attachments.entityName') },
    { key: 'uploadedBy', header: t('attachments.uploadedBy'), render: (item: any) => item.uploadedBy?.name || '-' },
    { key: 'createdAt', header: t('attachments.uploadedAt'), render: (item: any) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '-' },
  ];

  return (
    <div>
      <PageHeader title={t('attachments.title')} />
      <div className="flex gap-2 mb-4">
        <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
          options={[{ value: '', label: t('common.all') }]} className="w-40" />
        <Button variant="secondary" onClick={() => router.push('/admin/documents/attachments/upload')}>{t('attachments.upload')}</Button>
      </div>
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState message={t('attachments.loadingAttachments')} />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('attachments.noAttachments')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(item: any) => item.id} selectedKey={selectedId} onRowClick={(item: any) => setSelectedId(item.id)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" />
    </div>
  );
}
