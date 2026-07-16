'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { InventoryCount, InventoryCountLine } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon, ActionGenerateIcon, ActionViewIcon } from '../../../../../components/admin/admin-action-bar';

export default function InventoryCountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<InventoryCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
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

  const execWorkflow = async (action: string) => {
    setActionLoading(true);
    try {
      const endpoint = action === 'generateAdjustment' ? `/inventory/adjustments/${id}/generate-adjustment` : `/inventory/counts/${id}/${action}`;
      const method = action === 'generateAdjustment' ? api.post : api.patch;
      await method(endpoint, {});
      showToast(t('common.successUpdated'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setActionLoading(false); }
  };

  const confirmAndExec = (action: string) => {
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    edit: () => router.push(`/admin/inventory/counts/${id}/edit`),
    start: () => confirmAndExec('start'),
    complete: () => confirmAndExec('complete'),
    cancel: () => confirmAndExec('cancel'),
    generateAdjustment: () => confirmAndExec('generateAdjustment'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'start', labelKey: 'inventoryCounting.start', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(data && data.status === 'DRAFT') },
    { id: 'complete', labelKey: 'inventoryCounting.completeCount', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: !!(data && data.status === 'IN_PROGRESS') },
    { id: 'cancel', labelKey: 'inventoryCounting.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(data && (data.status === 'DRAFT' || data.status === 'IN_PROGRESS')), variant: 'danger' },
    { id: 'generateAdjustment', labelKey: 'inventoryCounting.generateAdjustment', icon: <ActionGenerateIcon />, onClick: () => exec('generateAdjustment'), enabled: !!(data && data.status === 'COMPLETED') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'lines', label: t('details.inventoryCount.lines') },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const summary = data.summary || { linesCount: 0, countedLinesCount: 0, verifiedLinesCount: 0, totalDifferenceQty: 0 };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.countNumber')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.countNumber}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.warehouse')}</dt><dd className="mt-1 text-sm text-gray-900">{data.warehouse?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.countDate')}</dt><dd className="mt-1 text-sm text-gray-900">{data.countDate ? data.countDate.split('T')[0] : '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.totalLines')}</dt><dd className="mt-1 text-sm text-gray-900">{summary.linesCount}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.countedLines')}</dt><dd className="mt-1 text-sm text-gray-900">{summary.countedLinesCount}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.verifiedLines')}</dt><dd className="mt-1 text-sm text-gray-900">{summary.verifiedLinesCount}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.totalDifference')}</dt><dd className="mt-1 text-sm text-gray-900">{summary.totalDifferenceQty}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.startedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.startedAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.completedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.completedAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.cancelledAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.cancelledAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryCount.notes')}</dt><dd className="mt-1 text-sm text-gray-900">{data.notes || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.updatedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.updatedAt)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.workflowActions')}</h3></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(data.status === 'DRAFT' || data.status === 'IN_PROGRESS') && (
                <button onClick={() => router.push(`/admin/inventory/counts/${id}/execute`)}
                  className="p-4 border rounded-lg text-left hover:border-blue-300 hover:bg-blue-50 transition-colors">
                  <p className="text-sm font-semibold text-blue-700">{t('inventoryCountWorkflow.execute')}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('inventoryCountWorkflow.executeNote')}</p>
                </button>
              )}
              {data.status === 'IN_PROGRESS' && (
                <button onClick={() => router.push(`/admin/inventory/counts/${id}/review`)}
                  className="p-4 border rounded-lg text-left hover:border-purple-300 hover:bg-purple-50 transition-colors">
                  <p className="text-sm font-semibold text-purple-700">{t('inventoryCountWorkflow.review')}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('inventoryCountWorkflow.reviewNote')}</p>
                </button>
              )}
              {data.status === 'IN_PROGRESS' && (
                <button onClick={() => router.push(`/admin/inventory/counts/${id}/approve`)}
                  className="p-4 border rounded-lg text-left hover:border-green-300 hover:bg-green-50 transition-colors">
                  <p className="text-sm font-semibold text-green-700">{t('inventoryCountWorkflow.approve')}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('inventoryCountWorkflow.approveConfirmTitle')}</p>
                </button>
              )}
              {data.status === 'COMPLETED' && (
                <button onClick={() => router.push(`/admin/inventory/counts/${id}/adjust`)}
                  className="p-4 border rounded-lg text-left hover:border-orange-300 hover:bg-orange-50 transition-colors">
                  <p className="text-sm font-semibold text-orange-700">{t('inventoryCountWorkflow.adjust')}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('inventoryCountWorkflow.adjustNote')}</p>
                </button>
              )}
              {data.status === 'COMPLETED' && (
                <button onClick={() => router.push(`/admin/inventory/counts/${id}/review`)}
                  className="p-4 border rounded-lg text-left hover:border-purple-300 hover:bg-purple-50 transition-colors">
                  <p className="text-sm font-semibold text-purple-700">{t('inventoryCountWorkflow.review')}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('inventoryCountWorkflow.reviewNote')}</p>
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'lines' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.inventoryCount.lines')}</h3></CardHeader>
          <CardContent>
            {!data.lines || data.lines.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'product', header: t('inventoryCounting.product'), render: (l: InventoryCountLine) => l.product?.code + ' - ' + (l.product?.name || '') || '-' },
                { key: 'location', header: t('inventoryCounting.warehouseLocation'), render: (l: InventoryCountLine) => l.warehouseLocation?.name || '-' },
                { key: 'systemQty', header: t('inventoryCounting.systemQty'), render: (l: InventoryCountLine) => l.systemQty },
                { key: 'countedQty', header: t('inventoryCounting.countedQty'), render: (l: InventoryCountLine) => l.countedQty ?? '-' },
                { key: 'differenceQty', header: t('inventoryCounting.differenceQty'), render: (l: InventoryCountLine) => l.differenceQty ?? '-' },
                { key: 'status', header: t('common.status'), render: (l: InventoryCountLine) => <StatusBadge status={l.status} /> },
              ]} data={data.lines} keyExtractor={(l: InventoryCountLine) => l.id} />
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => execWorkflow(pendingAction)}
        title={t('common.confirm')} message={t('common.confirmDeactivateMessage')}
        variant={pendingAction === 'cancel' ? 'danger' : 'primary'} loading={actionLoading} />
    </div>
  );
}
