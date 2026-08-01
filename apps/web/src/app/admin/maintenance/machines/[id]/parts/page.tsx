'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { MachinePart } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function MachinePartsPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const id = params.id as string;
  const [data, setData] = useState<MachinePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MachinePart[] }>(`/maintenance/machines/${id}/parts`);
      setData(res.data || []);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">{t('details.machine.parts')}</h3>
            <button onClick={() => router.push(`/admin/maintenance/machines/${id}/parts`)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              {t('common.viewAll')}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <DataTable columns={[
              { key: 'code', header: t('common.code'), render: (p: MachinePart) => p.code },
              { key: 'name', header: t('common.name'), render: (p: MachinePart) => p.name },
              { key: 'quantity', header: t('maintenance.quantity'), render: (p: MachinePart) => p.quantity },
              { key: 'unit', header: t('maintenance.unit'), render: (p: MachinePart) => p.unit || '-' },
              { key: 'stock', header: t('maintenance.inventoryStatus'), render: (p: MachinePart) => { const ms = p.minStock ?? 0; if (p.quantity <= 0) return <span className="text-red-600 text-sm">{t('maintenance.outOfStock')}</span>; if (p.quantity <= ms) return <span className="text-red-600 text-sm">{t('maintenance.lowStock')}</span>; if (p.quantity <= ms * 2) return <span className="text-yellow-600 text-sm">{t('maintenance.adequateStock')}</span>; return <span className="text-green-600 text-sm">{t('maintenance.inStock')}</span>; } },
            ]} data={data} keyExtractor={(p: MachinePart) => p.id} />
          )}
        </CardContent>
      </Card>
      <div className="text-center">
        <button onClick={() => router.push(`/admin/maintenance/machines/${id}`)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          &larr; {t('common.back')}
        </button>
      </div>
    </div>
  );
}
