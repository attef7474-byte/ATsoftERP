'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { InventoryBalance } from '../../../../../lib/admin-types';
import { Card, CardContent, LoadingState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

export default function BalanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<InventoryBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<InventoryBalance>(`/inventory/balances/${id}`);
      setData(res);
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
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.product')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.product?.code + ' - ' + (data.product?.name || '') || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.productName')}</dt><dd className="mt-1 text-sm text-gray-900">{data.product?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.unit')}</dt><dd className="mt-1 text-sm text-gray-900">{data.product?.unit || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.warehouse')}</dt><dd className="mt-1 text-sm text-gray-900">{data.warehouse?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.location')}</dt><dd className="mt-1 text-sm text-gray-900">{data.warehouseLocation?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventoryCounting.quantity')}</dt><dd className="mt-1 text-lg text-gray-900 font-bold">{data.quantity}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.updatedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.updatedAt)}</dd></div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
