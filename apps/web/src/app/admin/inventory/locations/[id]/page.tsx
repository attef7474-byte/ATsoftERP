'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { WarehouseLocation, InventoryBalance } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';

export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<WarehouseLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<WarehouseLocation>(`/inventory/locations/${id}`);
      setData(res as any);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  const fetchBalances = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await api.get<{ data: InventoryBalance[] }>(`/inventory/locations/${id}/balances`);
      setBalances(res.data || []);
    } catch (_) { setBalances([]); }
    finally { setSubLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); fetchBalances(); }, [fetchData, fetchBalances]);

  const handleStatusChange = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      if (data.status === 'ACTIVE') {
        await api.delete(`/inventory/locations/${id}`);
        showToast(t('inventory.locations.deactivateSuccess'), 'success');
      } else {
        await api.patch(`/inventory/locations/${id}/activate`, {});
        showToast(t('inventory.locations.activateSuccess'), 'success');
      }
      setConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setActionLoading(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => { fetchData(); fetchBalances(); },
    edit: () => router.push(`/admin/inventory/locations/${id}/edit`),
    activate: () => setConfirmOpen(true),
    deactivate: () => setConfirmOpen(true),
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

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'balances', label: t('details.balances') },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.locations.code')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.locations.name')}</dt><dd className="mt-1 text-sm text-gray-900">{data.name}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.barcode')}</dt><dd className="mt-1 text-sm text-gray-900 font-mono">{data.barcode || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.warehouse')}</dt><dd className="mt-1 text-sm text-gray-900">{data.warehouse?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card><CardContent><p className="text-sm text-gray-500">{t('details.overview')}</p></CardContent></Card>
      )}

      {activeTab === 'balances' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.balances')}</h3></CardHeader>
          <CardContent>
            {subLoading ? <LoadingState /> : balances.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('inventoryCounting.noBalances')}</p> : (
              <DataTable columns={[
                { key: 'product', header: t('inventoryCounting.product'), render: (b: InventoryBalance) => b.product?.code + ' - ' + (b.product?.name || '') || '-' },
                { key: 'quantity', header: t('inventoryCounting.quantity'), render: (b: InventoryBalance) => b.quantity },
                { key: 'updatedAt', header: t('common.updatedAt'), render: (b: InventoryBalance) => fmt(b.updatedAt) },
              ]} data={balances} keyExtractor={(b: InventoryBalance) => b.id} />
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleStatusChange}
        title={data?.status === 'ACTIVE' ? t('common.confirmDeactivateTitle') : t('common.confirmActivateTitle')}
        message={data?.status === 'ACTIVE' ? t('inventory.locations.deactivateSuccess') : t('inventory.locations.activateSuccess')}
        variant={data?.status === 'ACTIVE' ? 'danger' : 'primary'} loading={actionLoading} />
    </div>
  );
}
