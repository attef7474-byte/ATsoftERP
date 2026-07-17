'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { InventoryAdjustment, InventoryAdjustmentLine } from '../../../../../../lib/admin-types';
import { Button, Input, Textarea, Card, CardContent, CardHeader, LoadingState, ErrorState, StatusBadge, ConfirmDialog } from '../../../../../../components/admin/ui';
import { F9Lookup, productAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionAddIcon } from '../../../../../../components/admin/admin-action-bar';

export default function AdjustmentLinesPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [adjustment, setAdjustment] = useState<InventoryAdjustment | null>(null);
  const [lines, setLines] = useState<InventoryAdjustmentLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<any>(null);
  const [lineForm, setLineForm] = useState({ productId: '', countedQty: 0, notes: '' });
  const [lineSystemQty, setLineSystemQty] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const isReadOnly = adjustment?.status !== 'DRAFT';

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<InventoryAdjustment>(`/inventory/adjustments/${id}`);
      setAdjustment(res);
      setLines(res.lines || []);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!lineForm.productId || !adjustment?.warehouseId) { setLineSystemQty(0); return; }
    api.get<any[]>(`/inventory/balances/product/${lineForm.productId}`).then((balances) => {
      const whBalance = balances.find((b: any) => b.warehouseId === adjustment?.warehouseId);
      setLineSystemQty(whBalance?.quantity ?? 0);
    }).catch(() => setLineSystemQty(0));
  }, [lineForm.productId, adjustment?.warehouseId]);

  const openAddLine = () => {
    setEditingLine(null);
    setLineForm({ productId: '', countedQty: 0, notes: '' });
    setLineSystemQty(0);
    setLineFormOpen(true);
  };

  const openEditLine = (line: any) => {
    setEditingLine(line);
    setLineForm({ productId: line.productId, countedQty: line.countedQty, notes: line.notes || '' });
    setLineSystemQty(line.systemQty);
    setLineFormOpen(true);
  };

  const handleSaveLine = async () => {
    if (!lineForm.productId || lineForm.countedQty < 0) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload = { productId: lineForm.productId, countedQty: lineForm.countedQty, notes: lineForm.notes || undefined };
      if (editingLine) {
        await api.patch(`/inventory/adjustments/${id}/lines/${editingLine.id}`, payload);
      } else {
        await api.post(`/inventory/adjustments/${id}/lines`, payload);
      }
      showToast(t('inventoryCounting.lineCreated'), 'success');
      setLineFormOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const confirmDeleteLine = (lineId: string) => { setDeletingId(lineId); setDeleteConfirmOpen(true); };

  const handleDeleteLine = async () => {
    setSaving(true);
    try {
      await api.delete(`/inventory/adjustments/${id}/lines/${deletingId}`);
      showToast(t('common.successDeleted'), 'success');
      setDeleteConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.deleteFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    addLine: () => openAddLine(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'addLine', labelKey: 'inventoryCounting.addLine', icon: <ActionAddIcon />, onClick: () => exec('addLine'), enabled: !isReadOnly },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!adjustment) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><dt className="text-gray-500">{t('inventoryCounting.adjustmentNumber')}</dt><dd className="font-semibold">{adjustment.adjustmentNumber}</dd></div>
            <div><dt className="text-gray-500">{t('common.status')}</dt><dd><StatusBadge status={adjustment.status} /></dd></div>
            <div><dt className="text-gray-500">{t('inventory.warehouse')}</dt><dd>{adjustment.warehouse?.name || '-'}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {isReadOnly && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          {t('details.readOnlyRecord')}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700">{t('inventoryCounting.lines')}</h3>
            {!isReadOnly && (
              <Button variant="secondary" size="sm" onClick={openAddLine}>{t('inventoryCounting.addLine')}</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {lineFormOpen && (
            <div className="border rounded p-3 mb-4 space-y-3 bg-gray-50">
              <h4 className="font-medium text-sm">{editingLine ? t('inventoryCounting.editLine') : t('inventoryCounting.addLine')}</h4>
              <F9Lookup label={t('inventoryCounting.product')} value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
              <div className="grid grid-cols-3 gap-3">
                <div className="text-sm"><span className="block text-gray-500">{t('inventoryCounting.systemQty')}</span><span className="font-medium">{lineSystemQty}</span></div>
                <Input label={t('inventoryCounting.countedQty')} type="number" value={String(lineForm.countedQty)} onChange={(e) => setLineForm({ ...lineForm, countedQty: Number(e.target.value) })} />
                <div className="flex items-end gap-2">
                  <Button onClick={handleSaveLine} loading={saving} disabled={!lineForm.productId}>{t('actions.save')}</Button>
                  <Button variant="secondary" onClick={() => setLineFormOpen(false)}>{t('actions.cancel')}</Button>
                </div>
              </div>
              {lineForm.productId && (
                <p className="text-xs text-gray-500">{t('inventoryCounting.differenceQty')}: {lineForm.countedQty - lineSystemQty}</p>
              )}
              <Textarea label={t('inventoryCounting.notes')} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
            </div>
          )}
          {lines.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('inventoryCounting.noLines')}</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">{t('inventoryCounting.product')}</th>
                  <th className="text-right p-2">{t('inventoryCounting.systemQty')}</th>
                  <th className="text-right p-2">{t('inventoryCounting.countedQty')}</th>
                  <th className="text-center p-2">{t('inventoryCounting.differenceQty')}</th>
                  <th className="text-left p-2">{t('inventoryCounting.notes')}</th>
                  <th className="text-center p-2">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{line.product?.code + ' - ' + (line.product?.name || '') || line.productId}</td>
                    <td className="p-2 text-right">{line.systemQty}</td>
                    <td className="p-2 text-right">{line.countedQty}</td>
                    <td className="p-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${line.differenceQty === 0 ? 'bg-gray-100 text-gray-700' : line.differenceQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {line.differenceQty > 0 ? '+' : ''}{line.differenceQty}
                      </span>
                    </td>
                    <td className="p-2">{line.notes || '-'}</td>
                    <td className="p-2 text-center">
                      {!isReadOnly && (
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => openEditLine(line)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
                          <button onClick={() => confirmDeleteLine(line.id)} className="text-red-600 hover:text-red-800 text-sm">{t('actions.delete')}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDeleteLine}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
