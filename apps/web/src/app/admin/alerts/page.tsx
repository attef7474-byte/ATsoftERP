'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { Select, Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState, StatusBadge } from '../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionBackIcon } from '../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

const SEVERITY_OPTIONS = [
  { value: '', labelKey: 'common.all' },
  { value: 'CRITICAL', labelKey: 'status.CRITICAL' },
  { value: 'HIGH', labelKey: 'status.HIGH' },
  { value: 'WARNING', labelKey: 'status.MEDIUM' },
  { value: 'INFO', labelKey: 'notifications.INFO' },
];

export default function AlertsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, pageSize: 20 };
      if (severityFilter) params.severity = severityFilter;
      const res = await api.get<{ data: any[]; total: number; page: number }>('/alerts', { params });
      setData(res.data || []);
      setMeta({ page: res.page || page, limit: 20, total: res.total || 0, totalPages: Math.ceil((res.total || 0) / 20) });
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [severityFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
    back: () => router.back(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'severity', header: t('alerts.severity'), render: (item: any) => <StatusBadge status={item.severity} /> },
    { key: 'type', header: t('alerts.type'), render: (item: any) => t(`alerts.${item.type}` as any) || item.type },
    { key: 'title', header: t('common.name') },
    { key: 'description', header: t('alerts.description'), render: (item: any) => <span className="text-xs text-gray-500">{item.description?.substring(0, 80)}</span> },
    { key: 'status', header: t('alerts.status'), render: (item: any) => <StatusBadge status={item.status} /> },
    { key: 'createdAt', header: t('common.createdAt'), render: (item: any) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '-' },
  ];

  return (
    <div>
      <PageHeader title={t('alerts.title')} />
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
          options={SEVERITY_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey as any) }))} className="w-32" />
      </div>
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState message={t('alerts.loadingAlerts')} />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('alerts.noAlerts')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(item: any) => item.id} selectedKey={selectedId}
            onRowClick={(item: any) => setSelectedId(item.id)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
