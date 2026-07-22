'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, CardContent, Pagination, PageHeader, LoadingState, Modal } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../../components/admin/admin-data-grid';
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
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [detailModal, setDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<any>('/audit-logs/summary');
      setSummary(res);
    } catch { /* ignore */ }
    finally { setSummaryLoading(false); }
  }, []);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity = entityFilter;
      if (userFilter) params.userId = userFilter;
      if (search) params.search = search;
      const res = await api.get<{ data: any[]; meta: any }>('/audit-logs', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [actionFilter, entityFilter, userFilter, search, t]);

  useEffect(() => { fetchData(); fetchSummary(); }, []);

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entity', entityFilter);
      if (userFilter) params.set('userId', userFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const qs = params.toString();
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/audit-logs/export/csv${qs ? '?' + qs : ''}`;
      const token = localStorage.getItem('accessToken');
      const res = await fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl; a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`; a.click();
      window.URL.revokeObjectURL(downloadUrl);
      showToast(t('settings.audit.exportSuccess'), 'success');
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  const openDetail = async (item: any) => {
    setDetailLoading(true); setDetailModal(true);
    try {
      const result = await api.get<any>(`/audit-logs/${item.id}`);
      setDetailItem(result);
    } catch { setDetailItem(item); }
    finally { setDetailLoading(false); }
  };

  const { exec } = useStableHandlers({
    refresh: () => { fetchData(meta.page); fetchSummary(); },
    back: () => router.back(),
    exportCsv: () => handleExportCsv(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'export', labelKey: 'common.export', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, onClick: () => exec('exportCsv') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns: GridColumn<any>[] = [
    { key: 'createdAt', header: t('settings.audit.timestamp'), sortable: true, render: (item: any) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '-' },
    { key: 'user', header: t('settings.audit.user'), sortable: true, render: (item: any) => item.user?.name || item.user?.email || '-' },
    { key: 'action', header: t('settings.audit.action'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'CREATE', label: 'CREATE' }, { value: 'UPDATE', label: 'UPDATE' }, { value: 'DELETE', label: 'DELETE' },
      { value: 'LOGIN_SUCCESS', label: 'LOGIN_SUCCESS' }, { value: 'LOGIN_FAILED', label: 'LOGIN_FAILED' },
    ]},
    { key: 'entity', header: t('settings.audit.entity'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'User', label: 'User' }, { value: 'Role', label: 'Role' }, { value: 'Warehouse', label: 'Warehouse' },
      { value: 'Product', label: 'Product' }, { value: 'Machine', label: 'Machine' },
    ]},
    { key: 'entityId', header: t('settings.audit.entityId'), render: (item: any) => <span className="font-mono text-xs">{item.entityId || '-'}</span> },
    { key: 'details', header: t('settings.audit.details'), render: (item: any) => (
      <button onClick={(e) => { e.stopPropagation(); openDetail(item); }} className="text-blue-600 hover:underline text-xs">{item.details ? t('common.view') : '-'}</button>
    )},
  ];

  return (
    <div>
      <PageHeader title={t('settings.audit.title')} />
      {!summaryLoading && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Card><CardContent><p className="text-xs text-gray-500">{t('settings.audit.totalLogs')}</p><p className="text-lg font-bold">{summary.totalLogs || 0}</p></CardContent></Card>
          <Card><CardContent><p className="text-xs text-gray-500">{t('settings.audit.uniqueUsers')}</p><p className="text-lg font-bold">{summary.uniqueUsers || 0}</p></CardContent></Card>
          <Card><CardContent><p className="text-xs text-gray-500">{t('settings.audit.actionsCount')}</p><p className="text-lg font-bold">{summary.actionsCount || 0}</p></CardContent></Card>
          <Card><CardContent><p className="text-xs text-gray-500">{t('settings.audit.entitiesCount')}</p><p className="text-lg font-bold">{summary.entitiesCount || 0}</p></CardContent></Card>
        </div>
      )}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          options={[{ value: '', label: t('common.all') }, { value: 'CREATE', label: 'CREATE' }, { value: 'UPDATE', label: 'UPDATE' }, { value: 'DELETE', label: 'DELETE' }, { value: 'LOGIN_SUCCESS', label: 'LOGIN_SUCCESS' }, { value: 'LOGIN_FAILED', label: 'LOGIN_FAILED' }]} className="w-32" />
        <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
          options={[{ value: '', label: t('common.all') }, { value: 'User', label: 'User' }, { value: 'Role', label: 'Role' }, { value: 'Warehouse', label: 'Warehouse' }, { value: 'Product', label: 'Product' }, { value: 'Machine', label: 'Machine' }]} className="w-32" />
        <Input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder={t('settings.audit.user')} className="w-32" />
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
        <Button variant="secondary" onClick={() => { setSearch(''); setActionFilter(''); setEntityFilter(''); setUserFilter(''); setDateFrom(''); setDateTo(''); fetchData(1); }}>{t('common.clearSearch')}</Button>
      </div>
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
        </div>
      )}
      {!error && loading && data.length === 0 && <LoadingState message={t('settings.audit.loadingLogs')} />}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('settings.audit.noLogs')}</p>
        </div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <AdminDataGrid
          columns={columns}
          data={data}
          keyExtractor={(item: any) => item.id}
          selectedKey={selectedId}
          onRowClick={(item: any) => setSelectedId(item.id)}
          loading={loading}
          emptyMessage={t('settings.audit.noLogs')}
          loadingMessage={t('settings.audit.loadingLogs')}
          error={error || undefined}
          dir={dir}
          globalSearch={search}
          onGlobalSearch={setSearch}
          searchPlaceholder={t('common.search')}
          onRefresh={() => { fetchData(meta.page); fetchSummary(); }}
          refreshLoading={loading}
        />
      )}
      {data.length > 0 && (
        <div className="mt-3">
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </div>
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
