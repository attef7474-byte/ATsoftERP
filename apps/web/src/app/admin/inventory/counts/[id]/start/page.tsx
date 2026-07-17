'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { InventoryCount } from '../../../../../../lib/admin-types';
import { Card, CardContent, LoadingState, ErrorState, StatusBadge, ConfirmDialog } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionStartIcon } from '../../../../../../components/admin/admin-action-bar';

export default function StartCountPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<InventoryCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<InventoryCount>(`/inventory/counts/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/inventory/counts/${id}/start`, {});
      showToast(t('inventoryCounting.countStarted'), 'success');
      setConfirmOpen(false);
      router.push(`/admin/inventory/counts/${id}`);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setActionLoading(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    start: () => setConfirmOpen(true),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'start', labelKey: 'inventoryCounting.startCount', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(data && data.status === 'DRAFT') },
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
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.countNumber')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.countNumber}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.warehouse')}</dt><dd className="mt-1 text-sm text-gray-900">{data.warehouse?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventoryCounting.company')}</dt><dd className="mt-1 text-sm text-gray-900">{data.company?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventoryCounting.branch')}</dt><dd className="mt-1 text-sm text-gray-900">{data.branch?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="text-center py-8">
          <p className="text-lg font-medium text-gray-900 mb-2">{t('inventoryCounting.startCount')}</p>
          <p className="text-sm text-gray-500 mb-6">{t('inventoryCounting.confirmStartCount')}</p>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={data.status !== 'DRAFT'}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('inventoryCounting.startCount')}
          </button>
        </CardContent>
      </Card>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleStart}
        title={t('inventoryCounting.startCount')} message={t('inventoryCounting.confirmStartCount')}
        variant="primary" loading={actionLoading} />
    </div>
  );
}
