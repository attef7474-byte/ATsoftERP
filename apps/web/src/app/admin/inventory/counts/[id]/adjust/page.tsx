'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { InventoryCount, InventoryCountLine, InventoryAdjustment } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, Button, DataTable, LoadingState, ErrorState, EmptyState, ConfirmDialog } from '../../../../../../components/admin/ui';
import { QuantityDifferenceBadge } from '../../../../../../components/inventory-counting/InventoryStatusBadge';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionGenerateIcon, ActionPostIcon } from '../../../../../../components/admin/admin-action-bar';

export default function CountAdjustPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;

  const [count, setCount] = useState<InventoryCount | null>(null);
  const [lines, setLines] = useState<InventoryCountLine[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [postingId, setPostingId] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [countRes, linesRes, adjRes] = await Promise.all([
        api.get<InventoryCount>(`/inventory/counts/${id}`),
        api.get<{ data: InventoryCountLine[] }>(`/inventory/counts/${id}/lines`),
        api.get<{ data: InventoryAdjustment[] }>('/inventory/adjustments', { params: { inventoryCountId: id, limit: 50 } }),
      ]);
      setCount(countRes);
      setLines(linesRes.data || []);
      setAdjustments(adjRes.data || []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const diffLines = lines.filter((l) => l.differenceQty != null && l.differenceQty !== 0);
  const existingAdjustments = adjustments.filter((a) => a.status !== 'CANCELLED');
  const hasAdjustment = existingAdjustments.length > 0;
  const draftAdjustment = existingAdjustments.find((a) => a.status === 'DRAFT');
  const postedAdjustment = existingAdjustments.find((a) => a.status === 'POSTED');
  const canGenerate = count?.status === 'COMPLETED' && diffLines.length > 0 && !hasAdjustment;

  const totalPositive = diffLines.filter((l) => l.differenceQty! > 0).reduce((sum, l) => sum + l.differenceQty!, 0);
  const totalNegative = diffLines.filter((l) => l.differenceQty! < 0).reduce((sum, l) => sum + Math.abs(l.differenceQty!), 0);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await api.post<any>(`/inventory/counts/${id}/generate-adjustment`);
      showToast(t('inventoryCountWorkflow.adjustGenerateSuccess'), 'success');
      setGenerateConfirmOpen(false);
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setGenerating(false); }
  };

  const handlePost = async () => {
    if (!postingId) return;
    setPosting(true);
    try {
      await api.patch(`/inventory/adjustments/${postingId}/post`, {});
      showToast(t('inventoryCountWorkflow.adjustPostSuccess'), 'success');
      setPostConfirmOpen(false);
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setPosting(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    generate: () => setGenerateConfirmOpen(true),
    post: () => { if (draftAdjustment) { setPostingId(draftAdjustment.id); setPostConfirmOpen(true); } },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'generate', labelKey: 'inventoryCounting.generateAdjustment', icon: <ActionGenerateIcon />, onClick: () => exec('generate'), enabled: canGenerate },
    { id: 'post', labelKey: 'inventoryCounting.postAdjustment', icon: <ActionPostIcon />, onClick: () => exec('post'), enabled: !!draftAdjustment },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!count) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.adjustLinesCount')}</p><p className="text-xl font-bold">{diffLines.length}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.adjustTotalPositive')}</p><p className="text-xl font-bold text-green-600">+{totalPositive}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.adjustTotalNegative')}</p><p className="text-xl font-bold text-red-600">-{totalNegative}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventoryCountWorkflow.adjustTitle')}</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">{t('inventoryCountWorkflow.adjustNote')}</p>

          {count.status !== 'COMPLETED' && (
            <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700 mb-4">
              {t('inventoryCountWorkflow.navigateToExecute')}: {t('inventoryCountWorkflow.adjustNote')}
            </div>
          )}

          {postedAdjustment && (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700 mb-4">
              {t('inventoryCountWorkflow.adjustAlreadyGenerated')}. <button onClick={() => router.push(`/admin/inventory/adjustments/${postedAdjustment.id}`)} className="underline">{t('details.viewDetails')}</button>
            </div>
          )}

          {draftAdjustment && !postedAdjustment && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700 mb-4">
              {t('inventoryCountWorkflow.adjustPreview')}. <button onClick={() => { setPostingId(draftAdjustment.id); setPostConfirmOpen(true); }} className="underline font-medium ml-2">{t('inventoryCounting.postAdjustment')}</button>
            </div>
          )}

          {canGenerate && (
            <Button onClick={() => setGenerateConfirmOpen(true)}>{t('inventoryCounting.generateAdjustment')}</Button>
          )}

          {diffLines.length === 0 && count.status === 'COMPLETED' && (
            <p className="text-sm text-gray-500">{t('inventoryCountWorkflow.noLinesToAdjust')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventoryCountWorkflow.adjustPreview')}</h3></CardHeader>
        <CardContent className="p-0">
          {diffLines.length === 0 ? <EmptyState message={t('inventoryCountWorkflow.noLinesToAdjust')} /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b bg-gray-50">
                  <th className="text-left p-2">{t('inventoryCounting.product')}</th>
                  <th className="text-right p-2">{t('inventoryCounting.systemQty')}</th>
                  <th className="text-right p-2">{t('inventoryCounting.countedQty')}</th>
                  <th className="text-center p-2">{t('inventoryCounting.differenceQty')}</th>
                  <th className="text-center p-2">{t('inventoryCounting.adjustment')}</th>
                </tr></thead>
                <tbody>
                  {diffLines.map((line) => (
                    <tr key={line.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{line.product ? `${line.product.code} - ${line.product.name}` : '-'}</td>
                      <td className="p-2 text-right">{line.systemQty}</td>
                      <td className="p-2 text-right">{line.countedQty ?? '-'}</td>
                      <td className="p-2 text-center"><QuantityDifferenceBadge diff={line.differenceQty!} /></td>
                      <td className="p-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${line.differenceQty! > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {line.differenceQty! > 0 ? t('status.ADJUSTMENT_IN') : t('status.ADJUSTMENT_OUT')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog open={generateConfirmOpen} onClose={() => setGenerateConfirmOpen(false)} onConfirm={handleGenerate}
        title={t('inventoryCountWorkflow.adjustConfirmTitle')}
        message={t('inventoryCountWorkflow.adjustConfirmMessage')}
        variant="primary" loading={generating} />

      <ConfirmDialog open={postConfirmOpen} onClose={() => setPostConfirmOpen(false)} onConfirm={handlePost}
        title={t('common.confirm')}
        message={t('inventoryCounting.confirmPostAdjustment')}
        variant="primary" loading={posting} />
    </div>
  );
}
