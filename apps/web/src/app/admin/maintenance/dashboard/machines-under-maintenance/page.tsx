'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import { Machine } from '../../../../../lib/admin-types';
import { useRegisterAdminActions, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

interface MachineWithRequests extends Machine {
  activeRequests?: number;
}

export default function MachinesUnderMaintenancePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [data, setData] = useState<MachineWithRequests[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: MachineWithRequests[]; meta: any }>('/maintenance/dashboard/machines-under-maintenance', { params: { page, limit: 10 } });
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
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'category', header: t('maintenance.machineCategory'), render: (m: MachineWithRequests) => m.category?.name || '-' },
    { key: 'status', header: t('common.status'), render: (m: MachineWithRequests) => <StatusBadge status={m.status} /> },
    { key: 'activeRequests', header: t('maintenanceDashboard.activeRequests'), render: (m: MachineWithRequests) => m.activeRequests ?? '-' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenanceDashboard.machinesUnderMaintenance')} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('common.noData')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(m: MachineWithRequests) => m.id} onRowClick={(item) => router.push(`/admin/maintenance/machines/${item.id}`)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
    </div>
  );
}
