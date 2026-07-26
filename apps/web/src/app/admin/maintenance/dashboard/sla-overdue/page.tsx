'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Card, CardHeader, CardContent, DataTable, PageHeader, LoadingState, ErrorState, EmptyState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { MaintenanceRequest } from '../../../../../lib/admin-types';

export default function SlaOverduePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [data, setData] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MaintenanceRequest[] }>('/maintenance/dashboard/sla-overdue');
      setData(res.data || []);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => router.push('/admin/maintenance/dashboard') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: fetchData },
  ]);

  const columns = [
    { key: 'requestNumber', header: t('maintenance.requestNumber') },
    { key: 'title', header: t('common.title') },
    { key: 'machine', header: t('maintenance.machine'), render: (r: MaintenanceRequest) => (r as any).machine?.name || '-' },
    { key: 'slaStatus', header: t('maintenance.slaStatus'), render: (r: MaintenanceRequest) => <StatusBadge status={(r as any).slaStatus} /> },
    { key: 'escalationLevel', header: t('maintenance.escalated'), render: (r: MaintenanceRequest) => (r as any).escalationLevel !== 'NONE' ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{(r as any).escalationLevel}</span> : '-' },
    { key: 'status', header: t('common.status'), render: (r: MaintenanceRequest) => <StatusBadge status={r.status} /> },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t('maintenanceDashboard.slaOverdue') || 'SLA Overdue'} />
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">{t('maintenanceDashboard.slaOverdue') || 'SLA Overdue Requests'}</h2></CardHeader>
        <CardContent>
          {data.length === 0 ? <EmptyState message={t('common.noData')} /> : (
            <DataTable columns={columns} data={data} keyExtractor={(r: MaintenanceRequest) => r.id} onRowClick={(item) => router.push(`/admin/maintenance/requests/${item.id}`)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
