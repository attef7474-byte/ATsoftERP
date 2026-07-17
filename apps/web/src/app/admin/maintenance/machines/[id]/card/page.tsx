'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Machine } from '../../../../../../lib/admin-types';
import { Card, CardContent, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function MachineCardPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: Machine }>(`/maintenance/machines/${id}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.push(`/admin/maintenance/machines/${id}`),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardContent>
          <div className="flex flex-col items-center text-center mb-6">
            {data.image ? (
              <img src={data.image} alt={data.name} className="w-32 h-32 object-cover rounded-full border-2 border-gray-200 mb-4" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <span className="text-4xl font-bold text-gray-400">{data.name?.charAt(0)?.toUpperCase()}</span>
              </div>
            )}
            <h2 className="text-xl font-bold text-gray-900">{data.name}</h2>
            <p className="text-sm text-gray-500 font-mono">{data.code}</p>
            <div className="mt-2"><StatusBadge status={data.status} /></div>
          </div>

          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="col-span-full border-t pt-4"><span className="font-medium text-gray-700">{t('details.machine.category')}</span><p className="text-gray-900 mt-1">{data.category?.name || '-'}</p></div>
            <div><span className="font-medium text-gray-700">{t('maintenance.model')}</span><p className="text-gray-900 mt-1">{data.model || '-'}</p></div>
            <div><span className="font-medium text-gray-700">{t('maintenance.serialNumber')}</span><p className="text-gray-900 mt-1 font-mono">{data.serialNumber || '-'}</p></div>
            <div><span className="font-medium text-gray-700">{t('maintenance.manufacturer')}</span><p className="text-gray-900 mt-1">{data.manufacturer || '-'}</p></div>
            <div><span className="font-medium text-gray-700">{t('maintenance.location')}</span><p className="text-gray-900 mt-1">{data.location || '-'}</p></div>
            <div><span className="font-medium text-gray-700">{t('maintenance.purchaseDate')}</span><p className="text-gray-900 mt-1">{fmt(data.purchaseDate)}</p></div>
            <div><span className="font-medium text-gray-700">{t('maintenance.warrantyEnd')}</span><p className="text-gray-900 mt-1">{fmt(data.warrantyEnd)}</p></div>
            <div><span className="font-medium text-gray-700">{t('common.createdAt')}</span><p className="text-gray-900 mt-1">{fmt(data.createdAt)}</p></div>
            <div><span className="font-medium text-gray-700">{t('common.updatedAt')}</span><p className="text-gray-900 mt-1">{fmt(data.updatedAt)}</p></div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
