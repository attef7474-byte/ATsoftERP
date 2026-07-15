'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../lib/i18n/use-translation';
import { Button, Input, Modal, EmptyState } from '../admin/ui';
import { F9Lookup, productAdapter, warehouseLocationAdapter } from '../f9';
import { QuantityDifferenceBadge } from './InventoryStatusBadge';

interface AdjustmentLinesPanelProps {
  lines: any[];
  onAddLine: (line: any) => void;
  onRemoveLine: (index: number) => void;
  onUpdateLine: (index: number, line: any) => void;
  readOnly: boolean;
  warehouseId?: string;
}

export function AdjustmentLinesPanel({
  lines,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  readOnly,
  warehouseId,
}: AdjustmentLinesPanelProps) {
  const { t } = useTranslation();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ productId: '', warehouseLocationId: '', countedQty: 0, systemQty: 0 });

  const fetchSystemQty = useCallback(async (productId: string, warehouseLocationId?: string) => {
    if (!warehouseId || !productId) return;
    try {
      const params: Record<string, any> = { productId, warehouseId };
      if (warehouseLocationId) params.warehouseLocationId = warehouseLocationId;
      const res = await api.get<{ data: any }>('/inventory/balances', { params });
      const balance = Array.isArray(res.data) ? res.data[0] : res.data;
      setAddForm((prev) => ({ ...prev, systemQty: balance?.quantity ?? 0 }));
    } catch {
      setAddForm((prev) => ({ ...prev, systemQty: 0 }));
    }
  }, [warehouseId]);

  useEffect(() => {
    if (addForm.productId) {
      fetchSystemQty(addForm.productId, addForm.warehouseLocationId || undefined);
    }
  }, [addForm.productId, addForm.warehouseLocationId, fetchSystemQty]);

  const handleAddLine = () => {
    if (!addForm.productId) return;
    onAddLine({
      productId: addForm.productId,
      warehouseLocationId: addForm.warehouseLocationId || null,
      systemQty: addForm.systemQty,
      countedQty: addForm.countedQty,
      differenceQty: addForm.countedQty - addForm.systemQty,
    });
    setAddForm({ productId: '', warehouseLocationId: '', countedQty: 0, systemQty: 0 });
    setAddModalOpen(false);
  };

  const openAddModal = () => {
    setAddForm({ productId: '', warehouseLocationId: '', countedQty: 0, systemQty: 0 });
    setAddModalOpen(true);
  };

  const getDifference = (line: any) => {
    const counted = line.countedQty ?? 0;
    const system = line.systemQty ?? 0;
    return counted - system;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{t('inventory.adjustmentLines')}</h3>
        {!readOnly && (
          <Button onClick={openAddModal} size="sm">{t('common.add')}</Button>
        )}
      </div>

      {lines.length === 0 ? (
        <EmptyState message={t('inventory.noAdjustmentLines')} />
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('inventory.product')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('inventory.location')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('inventory.systemQty')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('inventory.countedQty')}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('inventory.difference')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.notes')}</th>
                {!readOnly && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lines.map((line, index) => (
                <tr key={line.id || index} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {line.product ? `[${line.product.code}] ${line.product.name}` : line.productId}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {line.warehouseLocation ? `[${line.warehouseLocation.code}] ${line.warehouseLocation.name}` : line.warehouseLocationId || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{line.systemQty ?? 0}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{line.countedQty ?? 0}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <QuantityDifferenceBadge diff={getDifference(line)} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{line.notes || '-'}</td>
                  {!readOnly && (
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <button
                        onClick={() => onRemoveLine(index)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                      >
                        {t('common.remove')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title={t('inventory.addAdjustmentLine')} size="md">
        <div className="space-y-4">
          <F9Lookup label={t('inventory.product')} value={addForm.productId} onChange={(v) => setAddForm({ ...addForm, productId: v })} adapter={productAdapter} />
          <F9Lookup label={t('inventory.location')} value={addForm.warehouseLocationId} onChange={(v) => setAddForm({ ...addForm, warehouseLocationId: v })} adapter={warehouseLocationAdapter} filters={warehouseId ? { warehouseId } : undefined} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('inventory.systemQty')} value={addForm.systemQty} readOnly disabled />
            <Input label={t('inventory.countedQty')} type="number" value={addForm.countedQty} onChange={(e) => setAddForm({ ...addForm, countedQty: Number(e.target.value) })} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('inventory.difference')}:</span>
            <QuantityDifferenceBadge diff={addForm.countedQty - addForm.systemQty} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setAddModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleAddLine} disabled={!addForm.productId}>{t('common.add')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
