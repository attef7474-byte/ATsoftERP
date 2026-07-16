'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../../components/admin/toast-provider';
import { Button, Select, Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState, StatusBadge, Modal } from '../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionBackIcon } from '../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

const TYPE_OPTIONS = [
  { value: '', labelKey: 'common.all' },
  { value: 'INFO', labelKey: 'notifications.INFO' },
  { value: 'WARNING', labelKey: 'notifications.WARNING' },
  { value: 'ERROR', labelKey: 'notifications.ERROR' },
  { value: 'SUCCESS', labelKey: 'notifications.SUCCESS' },
];

const READ_OPTIONS = [
  { value: '', labelKey: 'common.all' },
  { value: 'false', labelKey: 'notifications.unread' },
  { value: 'true', labelKey: 'notifications.read' },
];

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const [detailModal, setDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (typeFilter) params.type = typeFilter;
      if (readFilter) params.read = readFilter;
      const res = await api.get<{ data: any[]; meta: any }>('/notifications/inbox', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, readFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const handleMarkRead = async () => {
    if (!selectedId) return;
    try {
      await api.patch(`/notifications/${selectedId}/read`);
      showToast(t('common.successUpdated'), 'success');
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      showToast(t('common.successUpdated'), 'success');
      fetchData(1);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await api.delete(`/notifications/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.deleteFailed'), 'error');
    }
  };

  const openDetail = (item: any) => {
    setDetailItem(item);
    setDetailModal(true);
  };

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
    back: () => router.back(),
    markRead: () => handleMarkRead(),
    markAllRead: () => handleMarkAllRead(),
    delete: () => handleDelete(),
    view: () => selectedRecord && openDetail(selectedRecord),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    {
      id: 'view', labelKey: 'details.viewDetails', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
      onClick: () => exec('view'), enabled: !!selectedId,
    },
    {
      id: 'markRead', labelKey: 'notifications.markRead', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
      onClick: () => exec('markRead'), enabled: !!(selectedId && selectedRecord && !selectedRecord.read),
    },
    {
      id: 'markAllRead', labelKey: 'notifications.markAllRead', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
      onClick: () => exec('markAllRead'),
    },
    {
      id: 'delete', labelKey: 'notifications.delete', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
      onClick: () => exec('delete'), enabled: !!selectedId,
    },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    {
      key: 'read', header: '', render: (item: any) => (
        <span className={`inline-block w-2 h-2 rounded-full ${item.read ? 'bg-transparent' : 'bg-blue-600'}`} title={item.read ? t('notifications.read') : t('notifications.unread')} />
      ),
    },
    { key: 'title', header: t('common.name'), render: (item: any) => <span className={item.read ? '' : 'font-semibold'}>{item.title}</span> },
    { key: 'message', header: t('notifications.message'), render: (item: any) => <span className="text-xs text-gray-500">{item.message?.substring(0, 80)}{item.message?.length > 80 ? '...' : ''}</span> },
    { key: 'type', header: t('notifications.type'), render: (item: any) => <StatusBadge status={item.type} /> },
    {
      key: 'readStatus', header: t('notifications.read'), render: (item: any) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.read ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {item.read ? t('notifications.read') : t('notifications.unread')}
        </span>
      ),
    },
    { key: 'createdAt', header: t('notifications.createdAt'), render: (item: any) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '-' },
  ];

  return (
    <div>
      <PageHeader title={t('notifications.title')} />
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))} className="w-32" />
        <Select value={readFilter} onChange={(e) => setReadFilter(e.target.value)}
          options={READ_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))} className="w-32" />
        <Button variant="secondary" onClick={() => { setTypeFilter(''); setReadFilter(''); fetchData(1); }}>{t('common.clearSearch')}</Button>
      </div>
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState message={t('notifications.loadingNotifications')} />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('notifications.noNotifications')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(item: any) => item.id} selectedKey={selectedId}
            onRowClick={(item: any) => setSelectedId(item.id)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={t('notifications.title')} size="md">
        {detailItem && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">{t('notifications.type')}:</span> <StatusBadge status={detailItem.type} /></div>
              <div><span className="text-gray-500">{t('common.status')}:</span> <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detailItem.read ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{detailItem.read ? t('notifications.read') : t('notifications.unread')}</span></div>
              <div className="col-span-2"><span className="text-gray-500">{t('common.name')}:</span> <span className="font-medium">{detailItem.title}</span></div>
            </div>
            {detailItem.message && (
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('notifications.message')}:</p>
                <p className="text-sm bg-gray-50 rounded-lg p-3">{detailItem.message}</p>
              </div>
            )}
            {detailItem.link && (
              <div className="text-sm">
                <span className="text-gray-500">{t('notifications.link')}:</span>{' '}
                <a href={detailItem.link} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{detailItem.link}</a>
              </div>
            )}
            <div className="text-sm"><span className="text-gray-500">{t('notifications.createdAt')}:</span> {new Date(detailItem.createdAt).toLocaleString()}</div>
            {detailItem.readAt && <div className="text-sm"><span className="text-gray-500">{t('common.updatedAt')}:</span> {new Date(detailItem.readAt).toLocaleString()}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
