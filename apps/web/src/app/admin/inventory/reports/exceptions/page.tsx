'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Card, CardContent, DataTable, PageHeader, LoadingState } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function ExceptionsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>('/reports/inventory/exceptions', { params: { page: 1, pageSize: 100 } });
      setData(res);
    } catch (err: any) { setError(err?.message || t('reports.loadFailed')); } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({ back: () => router.back(), refresh: () => fetchData(), print: () => window.print() });
  useRegisterAdminActions([{ id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') }, { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') }, { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print') }]);

  const exceptionCols = [
    { key: 'movementNumber', header: t('inventoryCounting.movementNumber') },
    { key: 'sourceType', header: t('inventoryCounting.sourceType'), render: (r: any) => r.sourceType || '-' },
    { key: 'sourceId', header: t('inventoryCounting.sourceId'), render: (r: any) => r.sourceId || '-' },
    { key: 'warehouse', header: t('reports.warehouse'), render: (r: any) => r.warehouse?.name || '-' },
  ];

  return (
    <div>
      <PageHeader title={t('reports.exceptions')} />
      {loading && <LoadingState />}
      {error && <div className="bg-red-50 text-red-700 p-4 rounded">{error}</div>}
      {!loading && !error && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardContent><span className="text-sm text-gray-500">{t('reports.movementsWithoutSource')}</span><p className="text-2xl font-bold">{data.exceptions?.noSourceMovements || 0}</p></CardContent></Card>
            <Card><CardContent><span className="text-sm text-gray-500">{t('reports.negativeBalances')}</span><p className="text-2xl font-bold">{data.exceptions?.negativeBalances || 0}</p></CardContent></Card>
            <Card><CardContent><span className="text-sm text-gray-500">{t('reports.orphanMovements')}</span><p className="text-2xl font-bold">{data.exceptions?.orphanMovements || 0}</p></CardContent></Card>
            <Card><CardContent><span className="text-sm text-gray-500">{t('reports.reconciliationDifferences')}</span><p className="text-2xl font-bold">{data.exceptions?.reconciliationDifferences || 0}</p></CardContent></Card>
          </div>
          {data.noSourceMovements?.length > 0 && (
            <Card><CardContent>
              <h3 className="font-semibold mb-2">{t('reports.movementsWithoutSource')}</h3>
              <DataTable columns={exceptionCols} data={data.noSourceMovements} keyExtractor={(r: any) => r.id} />
            </CardContent></Card>
          )}
          {(!data.noSourceMovements || data.noSourceMovements.length === 0) && (
            <div className="bg-green-50 text-green-700 p-4 rounded">{t('reports.noExceptions')}</div>
          )}
        </div>
      )}
    </div>
  );
}
