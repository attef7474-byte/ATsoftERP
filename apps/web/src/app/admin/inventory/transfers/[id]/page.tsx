'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { StockTransfer, StockTransferLine } from '../../../../../lib/admin-types';
import { Card, CardContent, DataTable, LoadingState, ErrorState, StatusBadge, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionPostIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function StockTransferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<StockTransfer>(`/inventory/stock-transfers/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const execWorkflow = async (action: string) => {
    setActionLoading(true);
    try {
      await api.post(`/inventory/stock-transfers/${id}/${action}`);
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

  const canAction = (status: string, action: string) => {
    if (action === 'submit') return status === 'DRAFT';
    if (action === 'approve' || action === 'reject') return status === 'SUBMITTED';
    if (action === 'post') return status === 'APPROVED';
    if (action === 'cancel') return status === 'DRAFT' || status === 'SUBMITTED';
    return false;
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    edit: () => router.push('/admin/inventory/transfers'),
    submit: () => data && data.status === 'DRAFT' && confirmAndExec('submit'),
    approve: () => data && data.status === 'SUBMITTED' && confirmAndExec('approve'),
    reject: () => data && data.status === 'SUBMITTED' && confirmAndExec('reject'),
    post: () => data && data.status === 'APPROVED' && confirmAndExec('post'),
    cancel: () => data && (data.status === 'DRAFT' || data.status === 'SUBMITTED') && confirmAndExec('cancel'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!(data && data.status === 'DRAFT') },
    { id: 'submit', labelKey: 'inventoryCounting.adjSubmit', icon: <ActionPostIcon />, onClick: () => exec('submit'), enabled: !!(data && data.status === 'DRAFT') },
    { id: 'approve', labelKey: 'inventoryCounting.adjApprove', icon: <ActionPostIcon />, onClick: () => exec('approve'), enabled: !!(data && data.status === 'SUBMITTED') },
    { id: 'reject', labelKey: 'inventoryCounting.adjReject', icon: <ActionCancelIcon />, onClick: () => exec('reject'), enabled: !!(data && data.status === 'SUBMITTED'), variant: 'danger' },
    { id: 'post', labelKey: 'inventoryCounting.adjPost', icon: <ActionPostIcon />, onClick: () => exec('post'), enabled: !!(data && data.status === 'APPROVED') },
    { id: 'cancel', labelKey: 'inventoryCounting.adjCancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(data && (data.status === 'DRAFT' || data.status === 'SUBMITTED')), variant: 'danger' },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'lines', label: 'Transfer Lines' },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">Transfer #</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">Date</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.documentDate)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">From Warehouse</dt><dd className="mt-1 text-sm text-gray-900">{data.sourceWarehouse?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">From Location</dt><dd className="mt-1 text-sm text-gray-900">{data.sourceLocation?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">To Warehouse</dt><dd className="mt-1 text-sm text-gray-900">{data.destinationWarehouse?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">To Location</dt><dd className="mt-1 text-sm text-gray-900">{data.destinationLocation?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventoryCounting.company')}</dt><dd className="mt-1 text-sm text-gray-900">{data.company?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('inventoryCounting.branch')}</dt><dd className="mt-1 text-sm text-gray-900">{data.branch?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">Reason</dt><dd className="mt-1 text-sm text-gray-900">{data.reason || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">Notes</dt><dd className="mt-1 text-sm text-gray-900">{data.notes || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">Submitted</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.submittedAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">Approved</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.approvedAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">Posted</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.postedAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">Cancelled</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.cancelledAt)}</dd></div>
          </dl>
          {(data.status === 'POSTED' || data.status === 'CANCELLED') && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">{t('details.readOnlyRecord')}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <DataTable
            columns={[
              { key: 'product', header: 'Product', render: (r: StockTransferLine) => r.product?.name || r.productId },
              { key: 'quantity', header: 'Qty', render: (r: StockTransferLine) => r.quantity },
              { key: 'notes', header: 'Notes', render: (r: StockTransferLine) => r.notes || '-' },
            ]}
            data={data.lines || []}
            keyExtractor={(r) => r.id}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => execWorkflow(pendingAction)}
        title={t('common.confirm')}
        message={
          pendingAction === 'submit' ? 'Submit this transfer?' :
          pendingAction === 'approve' ? 'Approve this transfer?' :
          pendingAction === 'reject' ? 'Reject this transfer?' :
          pendingAction === 'post' ? 'Post this transfer? This will move stock from source to destination.' :
          'Cancel this transfer?'
        }
        variant={pendingAction === 'cancel' || pendingAction === 'reject' ? 'danger' : 'primary'}
        loading={actionLoading}
      />
    </div>
  );
}
