'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { MaintenanceSchedule } from '../../../../../lib/admin-types';
import { useRegisterAdminActions, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

export default function UpcomingPreventivePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [data, setData] = useState<MaintenanceSchedule[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: MaintenanceSchedule[]; meta: any }>('/maintenance/dashboard/upcoming-preventive', { params: { page, limit: 10 } });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => router.push('/admin/maintenance/dashboard') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => fetchData(meta.page) },
  ]);

  const columns = [
    { key: 'title', header: t('common.title') },
    { key: 'machine', header: t('maintenance.machine'), render: (s: MaintenanceSchedule) => s.machine?.name || '-' },
    { key: 'maintenanceType', header: t('maintenance.maintenanceType') },
    { key: 'startDate', header: t('maintenance.startDate'), render: (s: MaintenanceSchedule) => new Date(s.startDate).toLocaleDateString() },
    { key: 'status', header: t('common.status'), render: (s: MaintenanceSchedule) => <CmmsStatusBadge status={s.status} /> },
  ];

  return (
    <div>
      <PageHeader title={t('maintenanceDashboard.upcomingPreventive')} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(s: MaintenanceSchedule) => s.id} onRowClick={(item) => router.push(`/admin/maintenance/schedules/${item.id}`)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
