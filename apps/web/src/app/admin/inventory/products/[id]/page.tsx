'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Product, ProductUom, InventoryBalance } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';

function unitLabel(unit: { code: string; nameAr?: string; nameEn?: string } | null | undefined): string {
  if (!unit) return '-';
  return `[${unit.code}] ${unit.nameEn || unit.nameAr}`;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<Product | null>(null);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/products/${id}`);
      setData(res?.data ?? res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  const fetchBalances = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await api.get<any>(`/inventory/balances/product/${id}`);
      setBalances(res?.data ?? res ?? []);
    } catch (_) { setBalances([]); }
    finally { setSubLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); fetchBalances(); }, [fetchData, fetchBalances]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.patch(`/products/${id}`, { status: newStatus });
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => { fetchData(); fetchBalances(); },
    edit: () => router.push(`/admin/inventory/products?edit=${id}`),
    activate: () => handleStatusChange('ACTIVE'),
    deactivate: () => handleStatusChange('INACTIVE'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, permission: 'products:update', onClick: () => exec('edit'), enabled: !!data },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, permission: 'products:update', onClick: () => exec('activate'), enabled: !!(data && data.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, permission: 'products:update', onClick: () => exec('deactivate'), enabled: !!(data && data.status === 'ACTIVE') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'balances', label: t('details.product.balances') },
  ];

  const fmt = (d: string | null | undefined) => d
    ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    : '-';

  const uoms: ProductUom[] = data.uoms ?? [];
  const baseUom = uoms.find((u) => u.isBase);
  const packagingUoms = uoms
    .filter((u) => !u.isBase)
    .sort((a, b) => Number(a.conversionToBase) - Number(b.conversionToBase));
  const uomById = new Map(uoms.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.code')}</dt><dd className="mt-1 text-sm text-gray-900">{data.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.name')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.name}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.category')}</dt><dd className="mt-1 text-sm text-gray-900">{data.category?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.baseUnit')}</dt><dd className="mt-1 text-sm text-gray-900">{data.unitRef ? `[${data.unitRef.code}] ${data.unitRef.nameEn || data.unitRef.nameAr}` : data.unit}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.barcode')}</dt><dd className="mt-1 text-sm text-gray-900 font-mono">{data.barcode || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.minStock')}</dt><dd className="mt-1 text-sm text-gray-900">{data.minStock}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.product.maxStock')}</dt><dd className="mt-1 text-sm text-gray-900">{data.maxStock}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventory.packagingHierarchy')}</h3></CardHeader>
        <CardContent>
          {!baseUom ? (
            <p className="text-sm text-gray-500">{t('inventory.noPackagingUnits')}</p>
          ) : (
            <DataTable
              columns={[
                { key: 'level', header: t('inventory.packagingUnit'), render: (u: ProductUom) => (
                  <span className={u.isBase ? 'font-semibold text-gray-900' : 'text-gray-700'}>
                    {unitLabel(u.unit)}
                    {u.isBase && <span className="ms-2 text-xs text-blue-600">({t('inventory.baseUnit')})</span>}
                  </span>
                ) },
                { key: 'parent', header: t('inventory.parentUnit'), render: (u: ProductUom) => {
                  if (u.isBase || !u.parentProductUomId) return baseUom ? unitLabel(baseUom.unit) : '-';
                  const parent = uomById.get(u.parentProductUomId);
                  return parent ? unitLabel(parent.unit) : '-';
                } },
                { key: 'qpp', header: t('inventory.quantityPerParent'), render: (u: ProductUom) => String(u.quantityPerParent) },
                { key: 'conv', header: t('inventory.conversionToBase'), render: (u: ProductUom) => String(u.conversionToBase) },
                { key: 'barcode', header: t('inventory.barcode'), render: (u: ProductUom) => u.barcode || '-' },
              ]}
              data={[baseUom, ...packagingUoms]}
              keyExtractor={(u: ProductUom) => u.id}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card><CardContent><p className="text-sm text-gray-500">{t('details.overview')}</p></CardContent></Card>
      )}

      {activeTab === 'balances' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.product.balances')}</h3></CardHeader>
          <CardContent>
            {subLoading ? <LoadingState /> : balances.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'warehouse', header: t('inventory.warehouse'), render: (b: InventoryBalance) => b.warehouse?.name || '-' },
                { key: 'location', header: t('inventoryCounting.warehouseLocation'), render: (b: InventoryBalance) => b.warehouseLocation?.name || '-' },
                { key: 'quantity', header: t('inventoryCounting.quantity'), render: (b: InventoryBalance) => b.quantity },
              ]} data={balances} keyExtractor={(b: InventoryBalance) => b.id} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
