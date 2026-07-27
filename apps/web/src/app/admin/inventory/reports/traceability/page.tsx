'use client';
import React, { useState, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Input, Card, CardContent, DataTable, PageHeader, LoadingState } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function TraceabilityPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [movementId, setMovementId] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTrace = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/reports/inventory/traceability/${id}`);
      setData(res);
    } catch (err: any) { setError(err?.message || t('reports.loadFailed')); } finally { setLoading(false); }
  }, [t]);

  const fetchByMovementNumber = useCallback(async () => {
    if (!movementId) return;
    const searchRes = await api.get<any>('/reports/inventory/movements', { params: { search: movementId, limit: 1 } });
    if (searchRes.rows?.[0]?.id) fetchTrace(searchRes.rows[0].id);
    else { setError(t('reports.movementNotFound')); setLoading(false); }
  }, [movementId, fetchTrace, t]);

  const { exec: execNav } = useStableHandlers({ back: () => router.back(), refresh: () => fetchTrace(movementId), print: () => window.print() });
  useRegisterAdminActions([{ id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => execNav('back') }, { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => execNav('refresh') }, { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => execNav('print') }]);

  const detailCols = [
    { key: 'field', header: t('reports.field') },
    { key: 'value', header: t('reports.value'), render: (r: any) => r.value ?? '-' },
  ];

  const traceDetail = data ? [
    { field: t('reports.movementNumber'), value: data.movementNumber },
    { field: t('reports.movementType'), value: data.movementType },
    { field: t('reports.direction'), value: data.direction || '-' },
    { field: t('reports.status'), value: data.status },
    { field: t('reports.warehouse'), value: data.warehouse?.name || '-' },
    { field: t('reports.sourceType'), value: data.sourceType || '-' },
    { field: t('reports.sourceId'), value: data.sourceId || '-' },
    { field: t('reports.movementDate'), value: data.movementDate ? new Date(data.movementDate).toLocaleDateString() : '-' },
    { field: t('reports.traceResolved'), value: data.traceResolved ? t('common.yes') : t('common.no') },
  ] : [];

  return (
    <div>
      <PageHeader title={t('reports.traceability')} />
      <div className="flex gap-4 items-end mb-4">
        <div className="w-72"><Input value={movementId} onChange={e => setMovementId(e.target.value)} placeholder={t('reports.enterMovementId')} /></div>
        <button onClick={fetchByMovementNumber} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{t('reports.trace')}</button>
      </div>
      {loading && <LoadingState />}
      {error && <div className="bg-red-50 text-red-700 p-4 rounded">{error}</div>}
      {!loading && !error && data && (
        <div className="space-y-4">
          <Card><CardContent>
            <h3 className="font-semibold mb-2">{t('reports.movementDetail')}</h3>
            <DataTable columns={detailCols} data={traceDetail} keyExtractor={(r: any) => r.field} />
          </CardContent></Card>
          {data.sourceDocument && (
            <Card><CardContent>
              <h3 className="font-semibold mb-2">{t('reports.sourceDocument')}</h3>
              <DataTable columns={detailCols} data={[
                { field: t('reports.documentType'), value: data.sourceDocument.documentType },
                { field: t('reports.documentCode'), value: data.sourceDocument.code || data.sourceDocument.countNumber || data.sourceDocument.requestNumber || '-' },
                { field: t('reports.documentStatus'), value: data.sourceDocument.status },
                { field: t('reports.documentRoute'), value: data.sourceDocument.route ? <a href={data.sourceDocument.route} className="text-blue-600 underline">{data.sourceDocument.route}</a> : '-' },
              ]} keyExtractor={(r: any) => r.field} />
            </CardContent></Card>
          )}
          {!data.sourceDocument && data.sourceType && <div className="bg-yellow-50 text-yellow-800 p-4 rounded">{t('reports.sourceNotFound')}</div>}
          {data.lines?.length > 0 && (
            <Card><CardContent>
              <h3 className="font-semibold mb-2">{t('inventoryCounting.lines')}</h3>
              <DataTable columns={[{ key: 'product', header: t('reports.product'), render: (r: any) => r.product?.name || '-' }, { key: 'quantity', header: t('inventoryCounting.quantity') }, { key: 'direction', header: t('reports.direction') }]} data={data.lines} keyExtractor={(r: any) => r.id} />
            </CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}
