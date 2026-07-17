'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Warehouse, WarehouseLocation, InventoryBalance } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<Warehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<Warehouse>(`/inventory/warehouses/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  const fetchLocations = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await api.get<{ data: WarehouseLocation[] }>(`/inventory/warehouses/${id}/locations`);
      setLocations(res.data || []);
    } catch (_) { setLocations([]); }
    finally { setSubLoading(false); }
  }, [id]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get<any>(`/inventory/warehouses/${id}/summary`);
      setSummary(res);
    } catch (_) { setSummary(null); }
  }, [id]);

  useEffect(() => { fetchData(); fetchLocations(); fetchSummary(); }, [fetchData, fetchLocations, fetchSummary]);

  const handleStatusChange = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      const newStatus = data.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/inventory/warehouses/${id}`, { status: newStatus });
      showToast(newStatus === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setActionLoading(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => { fetchData(); fetchLocations(); fetchSummary(); },
    edit: () => router.push(`/admin/inventory/warehouses/${id}/edit`),
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
    { id: 'locations', label: t('inventory.locations.title') },
    { id: 'balances', label: t('inventory.balanceSummary') },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.warehouseCode')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.warehouseName')}</dt><dd className="mt-1 text-sm text-gray-900">{data.name}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('core.company')}</dt><dd className="mt-1 text-sm text-gray-900">{data.company?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('core.branch')}</dt><dd className="mt-1 text-sm text-gray-900">{data.branch?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.location')}</dt><dd className="mt-1 text-sm text-gray-900">{data.location || '-'}</dd></div>
            {summary && (
              <>
                <div><dt className="text-sm font-medium text-gray-500">{t('inventoryCounting.linesCount')}</dt><dd className="mt-1 text-sm text-gray-900">{summary.totalLocations ?? '-'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-500">{t('inventory.balanceSummary')}</dt><dd className="mt-1 text-sm text-gray-900">{summary.totalBalances ?? '-'}</dd></div>
              </>
            )}
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.updatedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.updatedAt)}</dd></div>
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

      {activeTab === 'locations' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventory.locations.title')}</h3></CardHeader>
          <CardContent>
            {subLoading ? <LoadingState /> : locations.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('inventory.locations.noLocations')}</p> : (
              <DataTable columns={[
                { key: 'code', header: t('inventory.locations.code') },
                { key: 'name', header: t('inventory.locations.name') },
                { key: 'status', header: t('common.status'), render: (l: WarehouseLocation) => <StatusBadge status={l.status} /> },
              ]} data={locations} keyExtractor={(l: WarehouseLocation) => l.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'balances' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventory.balanceSummary')}</h3></CardHeader>
          <CardContent>
            {summary ? (
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><dt className="text-gray-500">{t('reports.totalQuantity')}</dt><dd className="font-semibold">{summary.totalQuantity ?? 0}</dd></div>
                <div><dt className="text-gray-500">{t('reports.totalProducts')}</dt><dd className="font-semibold">{summary.totalProducts ?? 0}</dd></div>
                <div><dt className="text-gray-500">{t('reports.totalBalanceRows')}</dt><dd className="font-semibold">{summary.totalBalances ?? 0}</dd></div>
              </dl>
            ) : <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleStatusChange}
        title={data?.status === 'ACTIVE' ? t('common.confirmDeactivateTitle') : t('common.confirmActivateTitle')}
        message={data?.status === 'ACTIVE' ? t('common.confirmDeactivateMessage') : t('common.confirmActivateMessage')}
        variant={data?.status === 'ACTIVE' ? 'danger' : 'primary'} loading={actionLoading} />
    </div>
  );
}
