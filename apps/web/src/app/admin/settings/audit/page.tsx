'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { Button, Input, Select, Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState, Modal } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionBackIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

const SECRET_FIELDS = ['password', 'secret', 'token', 'jwt', 'authorization', 'credential', 'apiKey', 'apiSecret'];

function sanitizeDetails(detailsStr: string | null): string {
  if (!detailsStr) return '-';
  try {
    const obj = JSON.parse(detailsStr);
    const sanitized = JSON.stringify(obj, (key, value) => {
      if (SECRET_FIELDS.some((sf) => key.toLowerCase().includes(sf.toLowerCase()))) return '***';
      return value;
    }, 2);
    return sanitized;
  } catch {
    return detailsStr.length > 500 ? detailsStr.substring(0, 500) + '...' : detailsStr;
  }
}

export default function AuditLogPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [search, setSearch] = useState('');

  const [detailModal, setDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity = entityFilter;
      if (userFilter) params.userId = userFilter;
      if (search) params.search = search;
      const res = await api.get<{ data: any[]; meta: any }>('/audit-logs', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, userFilter, search, t]);

  useEffect(() => { fetchData(); }, []);

  const openDetail = async (item: any) => {
    setDetailLoading(true);
    setDetailModal(true);
    try {
      const result = await api.get<any>(`/audit-logs/${item.id}`);
      setDetailItem(result);
    } catch {
      setDetailItem(item);
    } finally {
      setDetailLoading(false);
    }
  };

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
    back: () => router.back(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'createdAt', header: t('settings.audit.timestamp'), render: (item: any) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '-' },
    { key: 'user', header: t('settings.audit.user'), render: (item: any) => item.user?.name || item.user?.email || '-' },
    { key: 'action', header: t('settings.audit.action') },
    { key: 'entity', header: t('settings.audit.entity') },
    { key: 'entityId', header: t('settings.audit.entityId'), render: (item: any) => <span className="font-mono text-xs">{item.entityId || '-'}</span> },
    {
      key: 'details', header: t('settings.audit.details'), render: (item: any) => (
        <button onClick={() => openDetail(item)} className="text-blue-600 hover:underline text-xs">
          {item.details ? t('common.view') : '-'}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('settings.audit.title')} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          options={[{ value: '', label: t('common.all') }, { value: 'CREATE', label: 'CREATE' }, { value: 'UPDATE', label: 'UPDATE' }, { value: 'DELETE', label: 'DELETE' }, { value: 'LOGIN', label: 'LOGIN' }]}
          className="w-32" placeholder={t('settings.audit.action')} />
        <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
          options={[{ value: '', label: t('common.all') }, { value: 'User', label: 'User' }, { value: 'Role', label: 'Role' }, { value: 'Warehouse', label: 'Warehouse' }, { value: 'Product', label: 'Product' }, { value: 'Machine', label: 'Machine' }]}
          className="w-32" placeholder={t('settings.audit.entity')} />
        <Input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder={t('settings.audit.user')} className="w-32" />
        <Button variant="secondary" onClick={() => { setSearch(''); setActionFilter(''); setEntityFilter(''); setUserFilter(''); fetchData(1); }}>{t('common.clearSearch')}</Button>
      </div>
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState message={t('settings.audit.loadingLogs')} />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('settings.audit.noLogs')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(item: any) => item.id} selectedKey={selectedId}
            onRowClick={(item: any) => setSelectedId(item.id)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={t('settings.audit.details')} size="lg">
        {detailLoading && <LoadingState message={t('common.loading')} />}
        {!detailLoading && detailItem && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">{t('settings.audit.timestamp')}:</span> <span className="font-medium">{new Date(detailItem.createdAt).toLocaleString()}</span></div>
              <div><span className="text-gray-500">{t('settings.audit.user')}:</span> <span className="font-medium">{detailItem.user?.name || detailItem.user?.email || '-'}</span></div>
              <div><span className="text-gray-500">{t('settings.audit.action')}:</span> <span className="font-medium">{detailItem.action}</span></div>
              <div><span className="text-gray-500">{t('settings.audit.entity')}:</span> <span className="font-medium">{detailItem.entity}{detailItem.entityId ? ` (${detailItem.entityId})` : ''}</span></div>
            </div>
            {detailItem.details && (
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('settings.audit.details')}:</p>
                <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-96">{sanitizeDetails(detailItem.details)}</pre>
              </div>
            )}
            {detailItem.ip && <div className="text-sm"><span className="text-gray-500">{t('settings.audit.ip')}:</span> <span className="font-mono text-xs">{detailItem.ip}</span></div>}
            {detailItem.userAgent && <div className="text-sm"><span className="text-gray-500">{t('settings.audit.userAgent')}:</span> <span className="text-xs break-all">{detailItem.userAgent}</span></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
