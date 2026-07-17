'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Card, CardHeader, CardContent, DataTable, PageHeader, LoadingState, ErrorState } from '../../../../../components/admin/ui';
import { MaintenanceRequest } from '../../../../../lib/admin-types';
import { useRegisterAdminActions, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

interface CostBreakdown {
  totalCost: number;
  monthlyCost: number;
  byType: { type: string; total: number }[];
  topRequests: MaintenanceRequest[];
}

export default function CostKpisPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [data, setData] = useState<CostBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<CostBreakdown>('/maintenance/dashboard/cost-kpis');
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => router.push('/admin/maintenance/dashboard') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: fetchData },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const currency = t('common.currency');

  const requestColumns = [
    { key: 'requestNumber', header: t('maintenance.requestNumber') },
    { key: 'title', header: t('common.title') },
    { key: 'machine', header: t('maintenance.machine'), render: (r: MaintenanceRequest) => r.machine?.name || '-' },
    { key: 'actualCost', header: t('maintenance.actualCost'), render: (r: MaintenanceRequest) => r.actualCost != null ? `${r.actualCost.toLocaleString()} ${currency}` : '-' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('maintenanceDashboard.costKpis')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">{t('maintenanceDashboard.totalCost')}</p>
            <p className="text-2xl font-bold mt-1">{data?.totalCost?.toLocaleString() || '0'} {currency}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">{t('maintenanceDashboard.monthlyCost')}</p>
            <p className="text-2xl font-bold mt-1">{data?.monthlyCost?.toLocaleString() || '0'} {currency}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">{t('maintenanceDashboard.topCostRequests')}</p>
            <p className="text-2xl font-bold mt-1">{data?.topRequests?.length || 0}</p>
          </CardContent>
        </Card>
      </div>
      {data?.byType && data.byType.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">{t('maintenanceDashboard.costByType')}</h2></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('maintenance.maintenanceType')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('maintenance.totalCost')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.byType.map((item, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.total.toLocaleString()} {currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      {data?.topRequests && data.topRequests.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">{t('maintenanceDashboard.topCostRequests')}</h2></CardHeader>
          <CardContent>
            <DataTable columns={requestColumns} data={data.topRequests} keyExtractor={(r: MaintenanceRequest) => r.id} onRowClick={(item) => router.push(`/admin/maintenance/requests/${item.id}`)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
