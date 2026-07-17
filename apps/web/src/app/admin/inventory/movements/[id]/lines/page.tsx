'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { InventoryMovement, InventoryMovementLine } from '../../../../../../lib/admin-types';
import { Button, Input, Textarea, Select, Card, CardContent, CardHeader, LoadingState, ErrorState, StatusBadge, ConfirmDialog } from '../../../../../../components/admin/ui';
import { F9Lookup, productAdapter, warehouseLocationAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionAddIcon } from '../../../../../../components/admin/admin-action-bar';

export default function MovementLinesPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [movement, setMovement] = useState<InventoryMovement | null>(null);
  const [lines, setLines] = useState<InventoryMovementLine[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<any>(null);
  const [lineForm, setLineForm] = useState({ productId: '', warehouseLocationId: '', quantity: 1, direction: 'IN', unit: '', notes: '' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const directionOptions = [
    { value: 'IN', label: t('status.IN') },
    { value: 'OUT', label: t('status.OUT') },
  ];

  const isReadOnly = movement?.status !== 'DRAFT';

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [movRes, summaryRes] = await Promise.all([
        api.get<InventoryMovement>(`/inventory/movements/${id}`),
        api.get<any>(`/inventory/movements/${id}/summary`).catch(() => null),
      ]);
      setMovement(movRes);
      setLines(movRes.lines || []);
      setSummary(summaryRes);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAddLine = () => {
    setEditingLine(null);
    setLineForm({ productId: '', warehouseLocationId: '', quantity: 1, direction: 'IN', unit: '', notes: '' });
    setLineFormOpen(true);
  };

  const openEditLine = (line: any) => {
    setEditingLine(line);
    setLineForm({ productId: line.productId, warehouseLocationId: line.warehouseLocationId || '', quantity: line.quantity, direction: line.direction, unit: line.unit || '', notes: line.notes || '' });
    setLineFormOpen(true);
  };

  const handleSaveLine = async () => {
    if (!lineForm.productId || !lineForm.quantity) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload = { productId: lineForm.productId, warehouseLocationId: lineForm.warehouseLocationId || undefined, quantity: lineForm.quantity, direction: lineForm.direction, unit: lineForm.unit || undefined, notes: lineForm.notes || undefined };
      if (editingLine) {
        await api.patch(`/inventory/movements/${id}/lines/${editingLine.id}`, payload);
        showToast(t('inventoryCounting.lineCreated'), 'success');
      } else {
        await api.post(`/inventory/movements/${id}/lines`, payload);
        showToast(t('inventoryCounting.lineCreated'), 'success');
      }
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
      await api.delete(`/inventory/movements/${id}/lines/${deletingId}`);
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
  if (!movement) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      {movement && (
        <Card>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><dt className="text-gray-500">{t('inventoryCounting.movementNumber')}</dt><dd className="font-semibold">{movement.movementNumber}</dd></div>
              <div><dt className="text-gray-500">{t('common.status')}</dt><dd><StatusBadge status={movement.status} /></dd></div>
              <div><dt className="text-gray-500">{t('inventory.warehouse')}</dt><dd>{movement.warehouse?.name || '-'}</dd></div>
            </dl>
            {summary && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border-t pt-3">
                <div><dt className="text-gray-500">{t('inventoryCounting.totalInQty')}</dt><dd className="font-semibold text-green-700">{summary.totalInQty ?? 0}</dd></div>
                <div><dt className="text-gray-500">{t('inventoryCounting.totalOutQty')}</dt><dd className="font-semibold text-red-700">{summary.totalOutQty ?? 0}</dd></div>
                <div><dt className="text-gray-500">{t('inventoryCounting.linesCount')}</dt><dd className="font-semibold">{lines.length}</dd></div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              <div className="grid grid-cols-2 gap-3">
                <F9Lookup label={t('inventoryCounting.product')} value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
                <F9Lookup label={t('inventoryCounting.warehouseLocation')} value={lineForm.warehouseLocationId} onChange={(v) => setLineForm({ ...lineForm, warehouseLocationId: v })} adapter={warehouseLocationAdapter} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label={t('inventoryCounting.quantity')} type="number" value={String(lineForm.quantity)} onChange={(e) => setLineForm({ ...lineForm, quantity: Number(e.target.value) })} />
                <Select label={t('inventoryCounting.direction')} value={lineForm.direction} onChange={(e) => setLineForm({ ...lineForm, direction: e.target.value })} options={directionOptions} />
                <Input label={t('inventoryCounting.unit')} value={lineForm.unit} onChange={(e) => setLineForm({ ...lineForm, unit: e.target.value })} />
              </div>
              <Textarea label={t('inventoryCounting.notes')} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setLineFormOpen(false)}>{t('actions.cancel')}</Button>
                <Button size="sm" onClick={handleSaveLine} loading={saving}>{t('actions.save')}</Button>
              </div>
            </div>
          )}
          {lines.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('inventoryCounting.noLines')}</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">{t('inventoryCounting.product')}</th>
                  <th className="text-left p-2">{t('inventoryCounting.warehouseLocation')}</th>
                  <th className="text-right p-2">{t('inventoryCounting.quantity')}</th>
                  <th className="text-center p-2">{t('inventoryCounting.direction')}</th>
                  <th className="text-left p-2">{t('inventoryCounting.unit')}</th>
                  <th className="text-left p-2">{t('inventoryCounting.notes')}</th>
                  <th className="text-center p-2">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{line.product?.code + ' - ' + (line.product?.name || '') || line.productId}</td>
                    <td className="p-2">{line.warehouseLocation?.name || '-'}</td>
                    <td className="p-2 text-right">{line.quantity}</td>
                    <td className="p-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${line.direction === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t('status.' + line.direction)}
                      </span>
                    </td>
                    <td className="p-2">{line.unit || '-'}</td>
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
