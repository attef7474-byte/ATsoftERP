'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../lib/i18n/use-translation';
import { useToast } from '../admin/toast-provider';
import { InventoryCountLine } from '../../lib/admin-types';
import { Button, Input, Modal, ConfirmDialog, DataTable, LoadingState, EmptyState, ErrorState } from '../admin/ui';
import { F9Lookup, productAdapter, warehouseLocationAdapter } from '../f9';
import { InventoryStatusBadge, QuantityDifferenceBadge } from './InventoryStatusBadge';

interface CountLinesPanelProps {
  countId: string;
  status: string;
  warehouseId?: string;
  open: boolean;
  onClose: () => void;
}

export default function CountLinesPanel({ countId, status: countStatus, warehouseId, open, onClose }: CountLinesPanelProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [lines, setLines] = useState<InventoryCountLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [editLine, setEditLine] = useState<InventoryCountLine | null>(null);
  const [lineForm, setLineForm] = useState({ productId: '', warehouseLocationId: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [countModalOpen, setCountModalOpen] = useState(false);
  const [countLineId, setCountLineId] = useState('');
  const [countLineSystemQty, setCountLineSystemQty] = useState(0);
  const [countedQty, setCountedQty] = useState('');
  const [countSaving, setCountSaving] = useState(false);

  const [verifyConfirmOpen, setVerifyConfirmOpen] = useState(false);
  const [verifyLineId, setVerifyLineId] = useState('');
  const [verifySaving, setVerifySaving] = useState(false);

  const canAddLines = countStatus === 'DRAFT' || countStatus === 'IN_PROGRESS';

  const fetchLines = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: InventoryCountLine[] }>(`/inventory/counts/${countId}/lines`);
      setLines(res.data || []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [countId, t]);

  useEffect(() => {
    if (open) fetchLines();
  }, [open, fetchLines]);

  const openCreateLine = () => {
    setEditLine(null);
    setLineForm({ productId: '', warehouseLocationId: '', notes: '' });
    setLineModalOpen(true);
  };

  const openEditLine = (item: InventoryCountLine) => {
    setEditLine(item);
    setLineForm({ productId: item.productId, warehouseLocationId: item.warehouseLocationId || '', notes: item.notes || '' });
    setLineModalOpen(true);
  };

  const handleSaveLine = async () => {
    if (!lineForm.productId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { productId: lineForm.productId, notes: lineForm.notes || undefined };
      if (lineForm.warehouseLocationId) payload.warehouseLocationId = lineForm.warehouseLocationId;
      if (editLine) {
        await api.patch(`/inventory/count-lines/${editLine.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post(`/inventory/counts/${countId}/lines`, payload);
        showToast(t('common.successCreated'), 'success');
      }
      setLineModalOpen(false); fetchLines();
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const openCountModal = (line: InventoryCountLine) => {
    setCountLineId(line.id);
    setCountLineSystemQty(line.systemQty);
    setCountedQty(line.countedQty != null ? String(line.countedQty) : '');
    setCountModalOpen(true);
  };

  const handleCount = async () => {
    const qty = parseFloat(countedQty);
    if (isNaN(qty)) { showToast(t('validation.required'), 'error'); return; }
    setCountSaving(true);
    try {
      await api.patch(`/inventory/count-lines/${countLineId}/count`, { countedQty: qty });
      showToast(t('common.successUpdated'), 'success');
      setCountModalOpen(false); fetchLines();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setCountSaving(false); }
  };

  const openVerifyConfirm = (lineId: string) => {
    setVerifyLineId(lineId);
    setVerifyConfirmOpen(true);
  };

  const handleVerify = async () => {
    setVerifySaving(true);
    try {
      await api.patch(`/inventory/count-lines/${verifyLineId}/verify`);
      showToast(t('common.successUpdated'), 'success');
      setVerifyConfirmOpen(false); fetchLines();
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setVerifySaving(false); }
  };

  const locationFilters = warehouseId ? { warehouseId } : undefined;

  const columns = [
    {
      key: 'product', header: t('inventory.product'),
      render: (r: InventoryCountLine) => r.product ? `${r.product.code} - ${r.product.name}` : '-',
    },
    { key: 'systemQty', header: t('inventory.systemQty'), render: (r: InventoryCountLine) => r.systemQty },
    { key: 'countedQty', header: t('inventory.countedQty'), render: (r: InventoryCountLine) => r.countedQty ?? '-' },
    {
      key: 'differenceQty', header: t('inventory.difference'),
      render: (r: InventoryCountLine) => r.differenceQty != null ? <QuantityDifferenceBadge diff={r.differenceQty} /> : '-',
    },
    { key: 'status', header: t('common.status'), render: (r: InventoryCountLine) => <InventoryStatusBadge status={r.status} /> },
    { key: 'countedAt', header: t('inventory.countedAt'), render: (r: InventoryCountLine) => r.countedAt ? new Date(r.countedAt).toLocaleString() : '-' },
    { key: 'verifiedAt', header: t('inventory.verifiedAt'), render: (r: InventoryCountLine) => r.verifiedAt ? new Date(r.verifiedAt).toLocaleString() : '-' },
    { key: 'notes', header: t('common.notes'), render: (r: InventoryCountLine) => r.notes || '-' },
    {
      key: 'actions', header: t('common.actions'), render: (r: InventoryCountLine) => (
        <div className="flex gap-2 flex-wrap">
          {(r.status === 'PENDING' || r.status === 'COUNTED') && (
            <button onClick={() => openCountModal(r)} className="text-indigo-600 hover:text-indigo-800 text-sm">{t('inventory.count')}</button>
          )}
          {r.status === 'COUNTED' && (
            <button onClick={() => openVerifyConfirm(r.id)} className="text-emerald-600 hover:text-emerald-800 text-sm">{t('inventory.verify')}</button>
          )}
          {r.status === 'PENDING' && (
            <button onClick={() => openEditLine(r)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Modal open={open} onClose={onClose} title={t('inventory.countLines')} size="xl">
      <div>
        {canAddLines && (
          <div className="mb-4">
            <Button onClick={openCreateLine}>{t('inventory.addLine')}</Button>
          </div>
        )}
        {error && <ErrorState message={error} onRetry={fetchLines} />}
        {!error && loading && <LoadingState />}
        {!error && !loading && lines.length === 0 && <EmptyState message={t('common.noData')} />}
        {!error && !loading && lines.length > 0 && (
          <DataTable columns={columns} data={lines} keyExtractor={(r: InventoryCountLine) => r.id} />
        )}
      </div>

      <Modal open={lineModalOpen} onClose={() => setLineModalOpen(false)} title={editLine ? t('inventory.editLine') : t('inventory.addLine')} size="md">
        <div className="space-y-4">
          <F9Lookup label={t('inventory.product')} value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
          {warehouseId && (
            <F9Lookup label={t('inventory.warehouseLocation')} value={lineForm.warehouseLocationId} onChange={(v) => setLineForm({ ...lineForm, warehouseLocationId: v })} adapter={warehouseLocationAdapter} filters={locationFilters} />
          )}
          <Input label={t('common.notes')} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setLineModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSaveLine} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={countModalOpen} onClose={() => setCountModalOpen(false)} title={t('inventory.countLine')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('inventory.systemQty')}: <strong>{countLineSystemQty}</strong></p>
          <Input label={t('inventory.countedQty')} type="number" value={countedQty} onChange={(e) => setCountedQty(e.target.value)} required />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setCountModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleCount} loading={countSaving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={verifyConfirmOpen} onClose={() => setVerifyConfirmOpen(false)} onConfirm={handleVerify}
        title={t('common.confirm')} message={t('inventory.confirmVerifyLine')} variant="primary" loading={verifySaving} />
    </Modal>
  );
}
