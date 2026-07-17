'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { MachinePart } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge, PageHeader } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';

export default function MachinePartDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<MachinePart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MachinePart }>(`/maintenance/machine-parts/${id}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  const fetchUsageHistory = useCallback(async () => {
    setUsageLoading(true);
    try {
      const res = await api.get<{ data: any[] }>('/maintenance/requests', { params: { partId: id, limit: 20 } });
      setUsageHistory(res.data || []);
    } catch (_) { setUsageHistory([]); }
    finally { setUsageLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); fetchUsageHistory(); }, [fetchData, fetchUsageHistory]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      if (newStatus === 'ACTIVE') {
        await api.patch(`/maintenance/machine-parts/${id}/activate`);
      } else {
        await api.patch(`/maintenance/machine-parts/${id}/deactivate`);
      }
      fetchData();
      showToast(t('common.successUpdated'), 'success');
    } catch (err: any) {
      showToast(err?.message, 'error');
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => { fetchData(); fetchUsageHistory(); },
    edit: () => router.push(`/admin/maintenance/machine-parts/${id}/edit`),
    activate: () => handleStatusChange('ACTIVE'),
    deactivate: () => handleStatusChange('INACTIVE'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(data && data.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(data && data.status === 'ACTIVE') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const extra = data as any;
  const stockQty = extra.stockQuantity ?? 0;
  const minStock = extra.minimumStock ?? 0;
  const unitPrice = extra.unitPrice;

  const getStockStatus = () => {
    if (stockQty <= 0) return { color: 'bg-red-100 text-red-800 border-red-300', label: t('maintenance.outOfStock') };
    if (stockQty <= minStock) return { color: 'bg-red-100 text-red-800 border-red-300', label: t('maintenance.lowStock') };
    if (stockQty <= minStock * 2) return { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: t('maintenance.adequateStock') };
    return { color: 'bg-green-100 text-green-800 border-green-300', label: t('maintenance.inStock') };
  };

  const stockStatus = getStockStatus();

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'usage', label: `${t('maintenance.usageHistory')} (${usageHistory.length})` },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <PageHeader title={data.name} subtitle={`[${data.code}]`} />
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.code')}</dt><dd className="mt-1 text-sm text-gray-900">{data.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.name')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.name}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.description')}</dt><dd className="mt-1 text-sm text-gray-900">{data.description || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.unit')}</dt><dd className="mt-1 text-sm text-gray-900">{data.unit || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.unitPrice')}</dt><dd className="mt-1 text-sm text-gray-900">{unitPrice != null ? Number(unitPrice).toFixed(2) : '-'}</dd></div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('maintenance.stockQuantity')}</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${stockStatus.color}`}>
                  <span className={`w-2 h-2 rounded-full ${stockQty <= 0 ? 'bg-red-500' : stockQty <= minStock ? 'bg-red-500' : stockQty <= minStock * 2 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  {stockQty} ({stockStatus.label})
                </span>
              </dd>
            </div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.minimumStock')}</dt><dd className="mt-1 text-sm text-gray-900">{minStock}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.machine')}</dt><dd className="mt-1 text-sm text-gray-900">{data.machine ? <button onClick={() => router.push(`/admin/maintenance/machines/${data.machine!.id}`)} className="text-blue-600 hover:underline">{data.machine.name}</button> : '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.product')}</dt><dd className="mt-1 text-sm text-gray-900">{data.product?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.updatedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.updatedAt)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card><CardContent><p className="text-sm text-gray-500">{data.description || t('details.overview')}</p></CardContent></Card>
      )}

      {activeTab === 'usage' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.usageHistory')}</h3></CardHeader>
          <CardContent>
            {usageLoading ? <LoadingState /> : usageHistory.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'requestNumber', header: t('maintenance.requestNumber'), render: (r: any) => <span className="font-mono">{r.requestNumber}</span> },
                { key: 'title', header: t('maintenance.title'), render: (r: any) => r.title },
                { key: 'status', header: t('common.status'), render: (r: any) => <StatusBadge status={r.status} /> },
                { key: 'createdAt', header: t('common.date'), render: (r: any) => fmt(r.createdAt) },
                { key: 'actions', header: t('common.actions'), render: (r: any) => (
                  <button onClick={() => router.push(`/admin/maintenance/requests/${r.id}`)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.view')}</button>
                )},
              ]} data={usageHistory} keyExtractor={(r: any) => r.id} onRowClick={(r: any) => router.push(`/admin/maintenance/requests/${r.id}`)} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
