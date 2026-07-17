'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { InventoryBalance, Product } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function ProductBalancesPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [prodRes, balRes] = await Promise.all([
        api.get<Product>(`/products/${id}`),
        api.get<{ data: InventoryBalance[] }>(`/products/${id}/balances`),
      ]);
      setProduct(prodRes);
      setBalances(balRes.data || []);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const totalQty = balances.reduce((sum, b) => sum + b.quantity, 0);

  return (
    <div className="space-y-6">
      {product && (
        <Card>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><dt className="text-sm font-medium text-gray-500">{t('inventory.product')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">[{product.code}] {product.name}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">{t('inventory.unit')}</dt><dd className="mt-1 text-sm text-gray-900">{product.unit}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">{t('inventoryCounting.quantity')}</dt><dd className="mt-1 text-lg text-gray-900 font-bold">{totalQty}</dd></div>
            </dl>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.product.balances')}</h3></CardHeader>
        <CardContent>
          {balances.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('inventoryCounting.noBalances')}</p> : (
            <DataTable columns={[
              { key: 'warehouse', header: t('inventory.warehouse'), render: (b: InventoryBalance) => b.warehouse?.name || '-' },
              { key: 'location', header: t('inventory.location'), render: (b: InventoryBalance) => b.warehouseLocation?.name || '-' },
              { key: 'quantity', header: t('inventoryCounting.quantity'), render: (b: InventoryBalance) => b.quantity },
              { key: 'updatedAt', header: t('common.updatedAt'), render: (b: InventoryBalance) => fmt(b.updatedAt) },
            ]} data={balances} keyExtractor={(b: InventoryBalance) => b.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
