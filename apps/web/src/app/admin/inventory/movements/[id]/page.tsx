'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { InventoryMovement, InventoryMovementLine } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionPostIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function InventoryMovementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<InventoryMovement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<InventoryMovement>(`/inventory/movements/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const execWorkflow = async (action: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/inventory/movements/${id}/${action}`, {});
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
    edit: () => router.push(`/admin/inventory/movements?id=${id}`),
    post: () => confirmAndExec('post'),
    cancel: () => confirmAndExec('cancel'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'post', labelKey: 'inventoryCounting.post', icon: <ActionPostIcon />, onClick: () => exec('post'), enabled: !!(data && data.status === 'DRAFT') },
    { id: 'cancel', labelKey: 'inventoryCounting.cancelMovement', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(data && data.status === 'DRAFT'), variant: 'danger' },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'lines', label: t('details.inventoryMovement.lines') },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryMovement.movementNumber')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.movementNumber}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryMovement.type')}</dt><dd className="mt-1 text-sm text-gray-900">{t('status.' + data.movementType)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryMovement.direction')}</dt><dd className="mt-1 text-sm text-gray-900">{t('status.' + data.direction)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventory.warehouse')}</dt><dd className="mt-1 text-sm text-gray-900">{data.warehouse?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventoryCounting.company')}</dt><dd className="mt-1 text-sm text-gray-900">{data.company?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventoryCounting.branch')}</dt><dd className="mt-1 text-sm text-gray-900">{data.branch?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryMovement.postedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.postedAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryMovement.cancelledAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.cancelledAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.inventoryMovement.notes')}</dt><dd className="mt-1 text-sm text-gray-900">{data.notes || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.updatedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.updatedAt)}</dd></div>
          </dl>
          {(data.status === 'POSTED' || data.status === 'CANCELLED') && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">{t('details.readOnlyRecord')}</div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card><CardContent><p className="text-sm text-gray-500">{t('details.overview')}</p></CardContent></Card>
      )}

      {activeTab === 'lines' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.inventoryMovement.lines')}</h3></CardHeader>
          <CardContent>
            {!data.lines || data.lines.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'product', header: t('inventoryCounting.product'), render: (l: InventoryMovementLine) => l.product?.code + ' - ' + (l.product?.name || '') || '-' },
                { key: 'location', header: t('inventoryCounting.warehouseLocation'), render: (l: InventoryMovementLine) => l.warehouseLocation?.name || '-' },
                { key: 'quantity', header: t('inventoryCounting.quantity'), render: (l: InventoryMovementLine) => l.quantity },
                { key: 'direction', header: t('inventoryCounting.direction'), render: (l: InventoryMovementLine) => t('status.' + l.direction) },
                { key: 'unit', header: t('inventoryCounting.unit'), render: (l: InventoryMovementLine) => l.unit || '-' },
                { key: 'notes', header: t('inventoryCounting.notes'), render: (l: InventoryMovementLine) => l.notes || '-' },
              ]} data={data.lines} keyExtractor={(l: InventoryMovementLine) => l.id} />
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
