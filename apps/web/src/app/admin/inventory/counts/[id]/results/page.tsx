'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { InventoryCount, InventoryCountLine } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function CountResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<InventoryCount | null>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [countRes, resultsRes] = await Promise.all([
        api.get<InventoryCount>(`/inventory/counts/${id}`),
        api.get<any>(`/inventory/counts/${id}/results`).catch(() => null),
      ]);
      setData(countRes);
      setResults(resultsRes);
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

  const summary = data.summary || { linesCount: 0, countedLinesCount: 0, verifiedLinesCount: 0, totalDifferenceQty: 0 };
  const resultLines = results?.lines || data.lines || [];
  const withDiff = resultLines.filter((l: any) => l.differenceQty !== 0 && l.differenceQty !== null && l.differenceQty !== undefined);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.countNumber')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.countNumber}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.warehouse')}</dt><dd className="mt-1 text-sm text-gray-900">{data.warehouse?.name || '-'}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventoryCountWorkflow.countSummary')}</h3></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900">{summary.linesCount}</p>
              <p className="text-xs text-gray-500">{t('inventoryCountWorkflow.totalLines')}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-700">{summary.countedLinesCount}</p>
              <p className="text-xs text-blue-500">{t('inventoryCountWorkflow.countedLines')}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-700">{summary.verifiedLinesCount}</p>
              <p className="text-xs text-green-500">{t('inventoryCountWorkflow.verifiedLines')}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-orange-700">{summary.totalDifferenceQty}</p>
              <p className="text-xs text-orange-500">{t('inventoryCountWorkflow.totalDifference')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700">{t('inventoryCountWorkflow.differencesFound')} ({withDiff.length})</h3>
          </div>
        </CardHeader>
        <CardContent>
          {resultLines.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">{t('inventoryCounting.product')}</th>
                  <th className="text-left p-2">{t('inventoryCounting.warehouseLocation')}</th>
                  <th className="text-right p-2">{t('inventoryCounting.systemQty')}</th>
                  <th className="text-right p-2">{t('inventoryCounting.countedQty')}</th>
                  <th className="text-center p-2">{t('inventoryCounting.differenceQty')}</th>
                  <th className="text-center p-2">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {resultLines.map((line: any) => {
                  const hasDiff = line.differenceQty !== 0 && line.differenceQty !== null && line.differenceQty !== undefined;
                  return (
                    <tr key={line.id} className={`border-b hover:bg-gray-50 ${hasDiff ? 'bg-yellow-50' : ''}`}>
                      <td className="p-2">{line.product?.code + ' - ' + (line.product?.name || '') || line.productId}</td>
                      <td className="p-2">{line.warehouseLocation?.name || '-'}</td>
                      <td className="p-2 text-right">{line.systemQty}</td>
                      <td className="p-2 text-right">{line.countedQty ?? '-'}</td>
                      <td className="p-2 text-center">
                        {line.differenceQty !== null && line.differenceQty !== undefined ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${line.differenceQty === 0 ? 'bg-gray-100 text-gray-700' : line.differenceQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {line.differenceQty > 0 ? '+' : ''}{line.differenceQty}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-2 text-center"><StatusBadge status={line.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
