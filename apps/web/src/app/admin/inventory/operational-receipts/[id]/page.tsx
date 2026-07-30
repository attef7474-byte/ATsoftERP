'use client';
import React, { useState, useEffect } from 'react';
import { use } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Card, PageHeader, LoadingState, Modal, ConfirmDialog } from '../../../../../components/admin/ui';
import { InventoryStatusBadge } from '../../../../../components/inventory-counting/InventoryStatusBadge';
import { useRouter } from 'next/navigation';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionPostIcon, ActionCancelIcon, ActionBackIcon } from '../../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';

interface ReceiptDetail {
  id: string;
  code: string;
  companyId: string;
  company?: { id: string; name: string };
  branchId?: string;
  branch?: { id: string; name: string };
  warehouseId: string;
  warehouse?: { id: string; name: string; code: string };
  locationId?: string;
  location?: { id: string; name: string; code: string };
  status: string;
  documentDate: string;
  reason: string;
  notes?: string;
  supplierName?: string;
  supplierDoc?: string;
  submittedAt?: string;
  submittedById?: string;
  approvedAt?: string;
  approvedById?: string;
  rejectedAt?: string;
  rejectedById?: string;
  postedAt?: string;
  postedById?: string;
  cancelledAt?: string;
  cancelledById?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines?: {
    id: string;
    productId: string;
    product?: { id: string; name: string; code: string; unit: string };
    quantity: number;
    notes?: string;
  }[];
}

export default function OperationalReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<ReceiptDetail>(`/inventory/operational-receipts/${id}`);
      setData(res);
    } catch (err: any) { setError(err?.message || 'Load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id]);

  const confirmAction = (action: string) => { setPendingAction(action); setActionConfirmOpen(true); };

  const handleAction = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await api.post(`/inventory/operational-receipts/${data.id}/${pendingAction}`);
      showToast('Action completed', 'success');
      setActionConfirmOpen(false); fetchData();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const canAction = (status: string, action: string) => {
    if (action === 'submit') return status === 'DRAFT';
    if (action === 'approve' || action === 'reject') return status === 'SUBMITTED';
    if (action === 'post') return status === 'APPROVED';
    if (action === 'cancel') return status === 'DRAFT' || status === 'SUBMITTED';
    return false;
  };

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/inventory/operational-receipts'),
    refresh: () => fetchData(),
    submit: () => data && data.status === 'DRAFT' && confirmAction('submit'),
    approve: () => data && data.status === 'SUBMITTED' && confirmAction('approve'),
    reject: () => data && data.status === 'SUBMITTED' && confirmAction('reject'),
    post: () => data && data.status === 'APPROVED' && confirmAction('post'),
    cancel: () => data && (data.status === 'DRAFT' || data.status === 'SUBMITTED') && confirmAction('cancel'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'submit', labelKey: 'inventoryCounting.adjSubmit', icon: <ActionPostIcon />, onClick: () => exec('submit'), enabled: !!data && data.status === 'DRAFT' },
    { id: 'approve', labelKey: 'inventoryCounting.adjApprove', icon: <ActionPostIcon />, onClick: () => exec('approve'), enabled: !!data && data.status === 'SUBMITTED' },
    { id: 'reject', labelKey: 'inventoryCounting.adjReject', icon: <ActionPostIcon />, onClick: () => exec('reject'), enabled: !!data && data.status === 'SUBMITTED' },
    { id: 'post', labelKey: 'inventoryCounting.adjPost', icon: <ActionPostIcon />, onClick: () => exec('post'), enabled: !!data && data.status === 'APPROVED' },
    { id: 'cancel', labelKey: 'inventoryCounting.adjCancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!data && (data.status === 'DRAFT' || data.status === 'SUBMITTED'), variant: 'danger' },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!data) return <div className="p-8">Not found</div>;

  const actionLabels: Record<string, string> = {
    submit: 'Submit this operational receipt?',
    approve: 'Approve this operational receipt?',
    reject: 'Reject this operational receipt?',
    post: 'Post this operational receipt? This will update inventory balances.',
    cancel: 'Cancel this operational receipt?',
  };

  return (
    <div>
      <PageHeader title={`Receipt ${data.code}`} />
      <div className="mb-4">
        <Button variant="secondary" onClick={() => router.push('/admin/inventory/operational-receipts')}>
          &larr; Back to List
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="font-semibold mb-3">Document Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Code</span><span className="font-medium">{data.code}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><InventoryStatusBadge status={data.status} /></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{data.documentDate ? new Date(data.documentDate).toLocaleDateString() : '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Company</span><span>{data.company?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Branch</span><span>{data.branch?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Reason</span><span>{data.reason}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Notes</span><span>{data.notes || '-'}</span></div>
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold mb-3">Warehouse & Supplier</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Warehouse</span><span>{data.warehouse?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Location</span><span>{data.location?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Supplier</span><span>{data.supplierName || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Supplier Doc</span><span>{data.supplierDoc || '-'}</span></div>
          </div>
        </Card>
      </div>
      <Card>
        <h3 className="font-semibold mb-3">Receipt Lines ({data.lines?.length || 0})</h3>
        {data.lines && data.lines.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-2">Product</th>
                <th className="text-right p-2">Quantity</th>
                <th className="text-left p-2">Unit</th>
                <th className="text-left p-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{line.product?.name || line.productId}</td>
                  <td className="p-2 text-right font-medium">{line.quantity}</td>
                  <td className="p-2">{line.product?.unit || '-'}</td>
                  <td className="p-2">{line.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-sm">No lines</p>
        )}
      </Card>
      <div className="mt-6 text-sm text-gray-400 space-y-1">
        {data.createdAt && <div>Created: {new Date(data.createdAt).toLocaleString()}</div>}
        {data.submittedAt && <div>Submitted: {new Date(data.submittedAt).toLocaleString()}</div>}
        {data.approvedAt && <div>Approved: {new Date(data.approvedAt).toLocaleString()}</div>}
        {data.rejectedAt && <div>Rejected: {new Date(data.rejectedAt).toLocaleString()}</div>}
        {data.postedAt && <div>Posted: {new Date(data.postedAt).toLocaleString()}</div>}
        {data.cancelledAt && <div>Cancelled: {new Date(data.cancelledAt).toLocaleString()}</div>}
      </div>
      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title="Confirm" message={actionLabels[pendingAction] || 'Confirm action?'}
        variant={pendingAction === 'cancel' || pendingAction === 'reject' ? 'danger' : 'primary'} loading={saving} />
    </div>
  );
}
