'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { InventoryCount, InventoryCountLine } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, Button, DataTable, LoadingState, ErrorState, EmptyState, ConfirmDialog } from '../../../../../../components/admin/ui';
import { InventoryStatusBadge, QuantityDifferenceBadge } from '../../../../../../components/inventory-counting/InventoryStatusBadge';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionCompleteIcon } from '../../../../../../components/admin/admin-action-bar';

export default function CountApprovePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;

  const [count, setCount] = useState<InventoryCount | null>(null);
  const [lines, setLines] = useState<InventoryCountLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [countRes, linesRes] = await Promise.all([
        api.get<InventoryCount>(`/inventory/counts/${id}`),
        api.get<{ data: InventoryCountLine[] }>(`/inventory/counts/${id}/lines`),
      ]);
      setCount(countRes);
      setLines(linesRes.data || []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = count?.summary || { linesCount: 0, countedLinesCount: 0, verifiedLinesCount: 0, totalDifferenceQty: 0 };
  const allCounted = summary.countedLinesCount >= summary.linesCount;
  const allVerified = summary.verifiedLinesCount >= summary.countedLinesCount;
  const canComplete = count?.status === 'IN_PROGRESS' && allCounted;

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.patch(`/inventory/counts/${id}/complete`, {});
      showToast(t('inventoryCountWorkflow.countCompleted'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setCompleting(false); }
  };

  const navigateTo = (path: string) => router.push(`/admin/inventory/counts/${id}/${path}`);

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    complete: () => setConfirmOpen(true),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'complete', labelKey: 'inventoryCountWorkflow.approve', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: canComplete },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!count) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const diffLines = lines.filter((l) => l.differenceQty != null && l.differenceQty !== 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.totalLines')}</p><p className="text-xl font-bold">{summary.linesCount}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.countedLines')}</p><p className={`text-xl font-bold ${allCounted ? 'text-green-600' : 'text-red-600'}`}>{summary.countedLinesCount}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.verifiedLines')}</p><p className={`text-xl font-bold ${allVerified ? 'text-green-600' : 'text-orange-600'}`}>{summary.verifiedLinesCount}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.differencesFound')}</p><p className={`text-xl font-bold ${diffLines.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{diffLines.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventoryCountWorkflow.approveTitle')}</h3></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {count.status === 'COMPLETED' ? (
              <div className="p-4 bg-green-50 rounded-lg text-green-700 text-sm">{t('inventoryCountWorkflow.countCompleted')}</div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs text-white ${allCounted ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {allCounted ? '✓' : ''}
                  </div>
                  <span className="text-sm">{t('inventoryCountWorkflow.approveChecklistLabel')}</span>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs text-white ${allVerified ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {allVerified ? '✓' : ''}
                  </div>
                  <span className="text-sm">{t('inventoryCountWorkflow.approveChecklistVerified')}</span>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white bg-gray-300">
                    {diffLines.length === 0 ? '✓' : <span className="text-gray-500">!</span>}
                  </div>
                  <span className="text-sm">{t('inventoryCountWorkflow.approveChecklistReviewed')}</span>
                  {diffLines.length > 0 && (
                    <span className="text-xs text-orange-600 ml-auto">{diffLines.length} {t('inventoryCountWorkflow.differencesFound')}</span>
                  )}
                </div>

                {!allCounted && (
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                    {t('inventoryCountWorkflow.unaccountedLines')}: {summary.linesCount - summary.countedLinesCount}. <button onClick={() => navigateTo('execute')} className="underline ml-1">{t('inventoryCountWorkflow.navigateToExecute')}</button>
                  </div>
                )}

                {allCounted && !allVerified && (
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                    {t('inventoryCountWorkflow.pendingLines')}: {summary.countedLinesCount - summary.verifiedLinesCount}. <button onClick={() => navigateTo('execute')} className="underline ml-1">{t('inventoryCountWorkflow.navigateToExecute')}</button>
                  </div>
                )}

                {canComplete && (
                  <div className="flex gap-3 pt-2">
                    <Button onClick={() => setConfirmOpen(true)}>{t('inventoryCountWorkflow.approve')}</Button>
                  </div>
                )}
              </>
            )}

            {count.status === 'IN_PROGRESS' && (
              <div className="flex gap-3 pt-2 border-t">
                <button onClick={() => navigateTo('execute')} className="text-sm text-blue-600 hover:underline">{t('inventoryCountWorkflow.navigateToExecute')}</button>
                <button onClick={() => navigateTo('review')} className="text-sm text-blue-600 hover:underline">{t('inventoryCountWorkflow.navigateToReview')}</button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventoryCountWorkflow.differencesFound')}</h3></CardHeader>
        <CardContent>
          {diffLines.length === 0 ? <p className="text-sm text-gray-500">{t('inventoryCountWorkflow.noDifferences')}</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b bg-gray-50">
                  <th className="text-left p-2">{t('inventoryCounting.product')}</th>
                  <th className="text-right p-2">{t('inventoryCounting.systemQty')}</th>
                  <th className="text-right p-2">{t('inventoryCounting.countedQty')}</th>
                  <th className="text-center p-2">{t('inventoryCounting.differenceQty')}</th>
                </tr></thead>
                <tbody>
                  {diffLines.map((line) => (
                    <tr key={line.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{line.product ? `${line.product.code} - ${line.product.name}` : '-'}</td>
                      <td className="p-2 text-right">{line.systemQty}</td>
                      <td className="p-2 text-right">{line.countedQty ?? '-'}</td>
                      <td className="p-2 text-center"><QuantityDifferenceBadge diff={line.differenceQty!} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleComplete}
        title={t('inventoryCountWorkflow.approveConfirmTitle')}
        message={t('inventoryCountWorkflow.approveConfirmMessage')}
        variant="primary" loading={completing} />
    </div>
  );
}
