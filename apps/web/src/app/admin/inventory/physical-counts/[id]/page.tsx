'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, PageHeader, ConfirmDialog, LoadingState } from '../../../../../components/admin/ui';
import { useRouter, useParams } from 'next/navigation';
import { getUserPermissions } from '../../../../../lib/auth';
import { fetchActiveValuationPolicy, hasValuationCostInputPermission } from '../../../../../lib/inventory-valuation-helper';

interface CountLine {
  id: string;
  productId: string;
  product: { id: string; code: string; name: string; unit: string };
  warehouseLocation?: { id: string; code: string; name: string } | null;
  systemQty: number;
  countedQty?: number | null;
  varianceQty?: number | null;
  notes?: string | null;
}

interface PhysicalCount {
  id: string;
  countNumber: string;
  company: { id: string; name: string };
  branch?: { id: string; name: string } | null;
  warehouse: { id: string; name: string; code: string };
  status: string;
  countDate: string;
  notes?: string | null;
  lines: CountLine[];
  frozenAt?: string | null;
  submittedAt?: string | null;
  submittedById?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  rejectedAt?: string | null;
  rejectedById?: string | null;
  rejectedReason?: string | null;
  postedAt?: string | null;
  postedById?: string | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
}

export default function PhysicalCountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [count, setCount] = useState<PhysicalCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editUnitCost, setEditUnitCost] = useState('');
  const [editValuationReason, setEditValuationReason] = useState('');
  const [canCostInput, setCanCostInput] = useState(false);
  const [activePolicyCurrency, setActivePolicyCurrency] = useState('');
  const [costInputError, setCostInputError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [rejectedReason, setRejectedReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  const fetchCount = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<PhysicalCount>(`/inventory/physical-counts/${params.id}`);
      setCount(res);
      if (res?.warehouse?.id) {
        const active = await fetchActiveValuationPolicy(res.warehouse.id);
        if (active) setActivePolicyCurrency(active.currencyCode || '');
        else setActivePolicyCurrency('');
      } else {
        setActivePolicyCurrency('');
      }
    } catch (err: any) {
      setError(err?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  useEffect(() => {
    getUserPermissions().then((p) => {
      setCanCostInput(hasValuationCostInputPermission(p.permissions, p.isSuperAdmin));
    }).catch(() => setCanCostInput(false));
  }, []);

  const startEdit = (line: CountLine) => {
    setEditingLineId(line.id);
    setEditQty(line.countedQty ?? 0);
    setEditUnitCost('');
    setEditValuationReason('');
    setCostInputError('');
  };

  const saveEdit = async (lineId: string) => {
    const line = count?.lines.find((l) => l.id === lineId);
    const isSurplus = line ? (editQty - line.systemQty) > 0 : false;
    const needsCost = isSurplus && !!activePolicyCurrency;
    if (needsCost) {
      if (!canCostInput) { setCostInputError(t('inventoryValuation.missingPermission')); return; }
      const unitCost = editUnitCost === '' ? NaN : Number(editUnitCost);
      if (Number.isNaN(unitCost)) { setCostInputError(t('inventoryValuation.unitCostRequired')); return; }
      if (unitCost < 0) { setCostInputError(t('inventoryValuation.negativeCost')); return; }
      if (unitCost === 0 && !editValuationReason) { setCostInputError(t('inventoryValuation.reasonRequiredForZero')); return; }
    }
    setCostInputError('');
    try {
      await api.patch(`/inventory/physical-counts/${count!.id}/lines/${lineId}/enter`, {
        countedQty: editQty,
        unitCost: needsCost ? Number(editUnitCost) : undefined,
        currencyCode: needsCost ? activePolicyCurrency : undefined,
        valuationReason: needsCost && editValuationReason ? editValuationReason : undefined,
      });
      showToast('Count entered', 'success');
      setEditingLineId(null);
      fetchCount();
    } catch (err: any) {
      showToast(err?.message || 'Save failed', 'error');
    }
  };

  const confirmAction = (action: string) => {
    setPendingAction(action);
    if (action === 'reject') {
      setRejectedReason('');
      setRejectOpen(true);
    } else {
      setConfirmOpen(true);
    }
  };

  const executeAction = async () => {
    setActionSaving(true);
    try {
      const id = count!.id;
      if (pendingAction === 'submit') await api.patch(`/inventory/physical-counts/${id}/submit`);
      else if (pendingAction === 'approve') await api.patch(`/inventory/physical-counts/${id}/approve`);
      else if (pendingAction === 'reject') await api.patch(`/inventory/physical-counts/${id}/reject`, { reason: rejectedReason });
      else if (pendingAction === 'post') await api.patch(`/inventory/physical-counts/${id}/post`);
      else if (pendingAction === 'cancel') await api.patch(`/inventory/physical-counts/${id}/cancel`);
      showToast(`Physical count ${pendingAction}ed`, 'success');
      setConfirmOpen(false);
      setRejectOpen(false);
      fetchCount();
    } catch (err: any) {
      showToast(err?.message || 'Action failed', 'error');
    } finally {
      setActionSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!count) return <div className="p-4">Not found</div>;

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      POSTED: 'bg-purple-100 text-purple-800',
      REJECTED: 'bg-yellow-100 text-yellow-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
  };

  const totalVariance = count.lines.reduce((s, l) => s + (l.varianceQty ?? 0), 0);
  const totalIn = count.lines.filter(l => (l.varianceQty ?? 0) > 0).reduce((s, l) => s + (l.varianceQty ?? 0), 0);
  const totalOut = count.lines.filter(l => (l.varianceQty ?? 0) < 0).reduce((s, l) => s + Math.abs(l.varianceQty ?? 0), 0);
  const allCounted = count.lines.every(l => l.countedQty !== null && l.countedQty !== undefined);
  const hasVariance = count.lines.some(l => l.varianceQty !== 0);

  return (
    <div>
      <PageHeader
        title={`${t('physicalCount.physicalCount', 'physicalCount')}: ${count.countNumber}`}
        subtitle={count.warehouse?.name}
        actions={statusBadge(count.status)}
      />

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card className="p-3">
          <div className="text-sm text-gray-500">{t('inventoryCounting.company')}</div>
          <div className="font-medium">{count.company?.name}</div>
        </Card>
        <Card className="p-3">
          <div className="text-sm text-gray-500">{t('inventoryCounting.warehouse')}</div>
          <div className="font-medium">{count.warehouse?.name} ({count.warehouse?.code})</div>
        </Card>
        <Card className="p-3">
          <div className="text-sm text-gray-500">{t('physicalCount.countDate', 'physicalCount')}</div>
          <div className="font-medium">{new Date(count.countDate).toLocaleDateString()}</div>
        </Card>
      </div>

      {count.notes && (
        <Card className="p-3 mb-4">
          <div className="text-sm text-gray-500">{t('common.notes')}</div>
          <div>{count.notes}</div>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-4 mb-4">
        <Card className="p-3 bg-blue-50">
          <div className="text-sm text-blue-600">{t('inventoryCounting.lines')}</div>
          <div className="text-xl font-bold">{count.lines.length}</div>
        </Card>
        <Card className="p-3 bg-green-50">
          <div className="text-sm text-green-600">{t('physicalCount.varianceIn', 'physicalCount')}</div>
          <div className="text-xl font-bold text-green-700">{totalIn.toFixed(2)}</div>
        </Card>
        <Card className="p-3 bg-red-50">
          <div className="text-sm text-red-600">{t('physicalCount.varianceOut', 'physicalCount')}</div>
          <div className="text-xl font-bold text-red-700">{totalOut.toFixed(2)}</div>
        </Card>
        <Card className="p-3 bg-purple-50">
          <div className="text-sm text-purple-600">{t('varianceControl.totalVariance', 'varianceControl')}</div>
          <div className="text-xl font-bold">{totalVariance.toFixed(2)}</div>
        </Card>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {count.status === 'DRAFT' && (
          <>
            <Button onClick={() => confirmAction('submit')} disabled={!allCounted}>{t('physicalCount.submit', 'physicalCount')}</Button>
            <Button onClick={() => confirmAction('cancel')} variant="danger">{t('physicalCount.cancel', 'physicalCount')}</Button>
          </>
        )}
        {count.status === 'SUBMITTED' && (
          <>
            <Button onClick={() => confirmAction('approve')}>{t('physicalCount.approve', 'physicalCount')}</Button>
            <Button onClick={() => confirmAction('reject')} variant="secondary">{t('physicalCount.reject', 'physicalCount')}</Button>
          </>
        )}
        {count.status === 'APPROVED' && (
          <>
            <Button onClick={() => confirmAction('post')} disabled={!hasVariance}>{t('physicalCount.post', 'physicalCount')}</Button>
            <Button onClick={() => confirmAction('cancel')} variant="danger">{t('physicalCount.cancel', 'physicalCount')}</Button>
          </>
        )}
      </div>

      {!allCounted && count.status === 'DRAFT' && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4 text-sm text-yellow-800">
          {t('physicalCount.allLinesMustBeCounted', 'physicalCount')}
        </div>
      )}

      <Card className="p-4">
        <h3 className="font-medium mb-2">{t('inventoryCounting.lines')}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">{t('inventoryCounting.product')}</th>
              <th className="text-left py-2">{t('inventoryCounting.warehouseLocation')}</th>
              <th className="text-right py-2">{t('physicalCount.systemQty', 'physicalCount')}</th>
              <th className="text-right py-2">{t('physicalCount.countedQty', 'physicalCount')}</th>
              <th className="text-right py-2">{t('physicalCount.varianceQty', 'physicalCount')}</th>
              <th className="text-center py-2">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {count.lines.map(line => (
              <tr key={line.id} className="border-b hover:bg-gray-50">
                <td className="py-2">{line.product?.code} - {line.product?.name}</td>
                <td className="py-2">{line.warehouseLocation?.name || '-'}</td>
                <td className="text-right py-2">{line.systemQty}</td>
                <td className="text-right py-2">
                  {editingLineId === line.id ? (
                    <div className="flex flex-col gap-1 items-end">
                      <div className="flex gap-1 justify-end">
                        <Input type="number" value={editQty} onChange={e => setEditQty(parseFloat(e.target.value) || 0)} className="w-20 text-right" />
                        <Button size="sm" onClick={() => saveEdit(line.id)}>{t('common.save')}</Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditingLineId(null)}>{t('common.cancel')}</Button>
                      </div>
                      {activePolicyCurrency && (editQty - line.systemQty) > 0 && (
                        <div className="border rounded p-2 bg-gray-50 space-y-2 w-64">
                          {!canCostInput ? (
                            <p className="text-xs text-amber-700">{t('inventoryValuation.missingPermission')}</p>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <Input label={t('inventoryValuation.unitCost')} type="number" value={editUnitCost} onChange={e => setEditUnitCost(e.target.value)} className="text-right" />
                                <Input label={t('inventoryValuation.currency')} value={activePolicyCurrency} disabled />
                              </div>
                              <Textarea label={t('inventoryValuation.reason')} value={editValuationReason} onChange={e => setEditValuationReason(e.target.value)} />
                              {editUnitCost === '0' && !editValuationReason && (
                                <p className="text-xs text-amber-700">{t('inventoryValuation.zeroCostHint')}</p>
                              )}
                            </>
                          )}
                          {costInputError && <p className="text-xs text-red-600">{costInputError}</p>}
                        </div>
                      )}
                      {activePolicyCurrency && (editQty - line.systemQty) <= 0 && (
                        <p className="text-xs text-gray-500">{t('inventoryValuation.methodWeightedAverage')}</p>
                      )}
                    </div>
                  ) : (
                    <span>{line.countedQty ?? '-'}</span>
                  )}
                </td>
                <td className={`text-right py-2 font-medium ${(line.varianceQty ?? 0) > 0 ? 'text-green-600' : (line.varianceQty ?? 0) < 0 ? 'text-red-600' : ''}`}>
                  {line.varianceQty !== null && line.varianceQty !== undefined ? (line.varianceQty > 0 ? '+' : '') + line.varianceQty : '-'}
                </td>
                <td className="text-center py-2">
                  {editingLineId !== line.id && (
                    <Button size="sm" onClick={() => startEdit(line)} disabled={count.status === 'POSTED' || count.status === 'CANCELLED'}>
                      {t('physicalCount.enterCountedQty', 'physicalCount')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {count.lines.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">{t('inventoryCounting.noLines')}</p>}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeAction}
        title={t('common.confirm')}
        message={t(`physicalCount.${pendingAction}Confirm`, 'physicalCount') || `Confirm ${pendingAction}?`}
        loading={actionSaving}
      />

      {rejectOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="font-medium mb-4">{t('physicalCount.reject', 'physicalCount')}</h3>
            <label className="block text-sm font-medium mb-1">{t('physicalCount.rejectedReason', 'physicalCount')}</label>
            <textarea
              className="w-full border rounded p-2 mb-4"
              value={rejectedReason}
              onChange={e => setRejectedReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button onClick={executeAction} disabled={actionSaving || !rejectedReason}>{t('common.confirm')}</Button>
              <Button onClick={() => setRejectOpen(false)} variant="secondary">{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
