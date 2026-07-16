'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { InventoryCount, InventoryCountLine } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, EmptyState } from '../../../../../../components/admin/ui';
import { InventoryStatusBadge, QuantityDifferenceBadge } from '../../../../../../components/inventory-counting/InventoryStatusBadge';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function CountReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;

  const [count, setCount] = useState<InventoryCount | null>(null);
  const [lines, setLines] = useState<InventoryCountLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'differences' | 'uncounted'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredLines = lines.filter((line) => {
    if (filter === 'differences') return line.differenceQty != null && line.differenceQty !== 0;
    if (filter === 'uncounted') return line.countedQty == null;
    return true;
  }).filter((line) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (line.product?.code?.toLowerCase().includes(term)) ||
      (line.product?.name?.toLowerCase().includes(term));
  });

  const diffLines = lines.filter((l) => l.differenceQty != null && l.differenceQty !== 0);
  const pendingLines = lines.filter((l) => l.countedQty == null);

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
  if (!count) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const summary = count.summary || { linesCount: 0, countedLinesCount: 0, verifiedLinesCount: 0, totalDifferenceQty: 0 };

  const columns = [
    { key: 'product', header: t('inventoryCounting.product'), render: (r: InventoryCountLine) => r.product ? `${r.product.code} - ${r.product.name}` : '-' },
    { key: 'location', header: t('inventoryCounting.warehouseLocation'), render: (r: InventoryCountLine) => r.warehouseLocation?.name || '-' },
    { key: 'systemQty', header: t('inventoryCounting.systemQty'), render: (r: InventoryCountLine) => r.systemQty },
    { key: 'countedQty', header: t('inventoryCounting.countedQty'), render: (r: InventoryCountLine) => r.countedQty ?? '-' },
    { key: 'differenceQty', header: t('inventoryCounting.differenceQty'), render: (r: InventoryCountLine) => r.differenceQty != null ? <QuantityDifferenceBadge diff={r.differenceQty} /> : '-' },
    { key: 'status', header: t('common.status'), render: (r: InventoryCountLine) => <InventoryStatusBadge status={r.status} /> },
    { key: 'countedAt', header: t('inventoryCounting.countedAt'), render: (r: InventoryCountLine) => r.countedAt ? new Date(r.countedAt).toLocaleString() : '-' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.totalLines')}</p><p className="text-xl font-bold">{summary.linesCount}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.countedLines')}</p><p className="text-xl font-bold text-blue-600">{summary.countedLinesCount}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.differencesFound')}</p><p className={`text-xl font-bold ${diffLines.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{diffLines.length}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-gray-500">{t('inventoryCountWorkflow.totalDifference')}</p><p className="text-xl font-bold text-orange-600">{summary.totalDifferenceQty}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('inventoryCountWorkflow.reviewTitle')}</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">{t('inventoryCountWorkflow.reviewNote')}</p>
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <div className="flex gap-1 border rounded-lg overflow-hidden">
              {(['all', 'differences', 'uncounted'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {f === 'all' ? t('inventoryCountWorkflow.allLines') : f === 'differences' ? t('inventoryCountWorkflow.onlyDifferences') : t('inventoryCountWorkflow.onlyUncounted')}
                </button>
              ))}
            </div>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('inventoryCountWorkflow.filterByProduct')}
              className="block rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700">{t('inventoryCountWorkflow.countLines')}</h3>
            <span className="text-xs text-gray-500">{filteredLines.length} {t('common.items')}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLines.length === 0 ? <EmptyState message={t('common.noData')} /> : (
            <DataTable columns={columns} data={filteredLines} keyExtractor={(r: InventoryCountLine) => r.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
