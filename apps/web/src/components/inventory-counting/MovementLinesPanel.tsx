'use client';
import React, { useState } from 'react';
import { useTranslation } from '../../lib/i18n/use-translation';
import { InventoryMovementDirection, InventoryMovementLine } from '../../lib/admin-types';
import { Button, Input, Select, Card, EmptyState } from '../admin/ui';
import { F9Lookup, productAdapter, warehouseLocationAdapter } from '../f9';

export interface LineFormData {
  _id: string;
  productId: string;
  warehouseLocationId?: string | null;
  quantity: number;
  direction: InventoryMovementDirection;
  notes?: string | null;
  product?: { id: string; name: string; code: string; unit: string } | null;
  warehouseLocation?: { id: string; name: string; code: string } | null;
}

interface MovementLinesPanelProps {
  lines: LineFormData[];
  onAddLine: (line: LineFormData) => void;
  onRemoveLine: (id: string) => void;
  onUpdateLine: (id: string, line: Partial<LineFormData>) => void;
  readOnly?: boolean;
  warehouseId?: string;
  status?: string;
}

const directionOptions = [
  { value: 'IN', label: 'IN' },
  { value: 'OUT', label: 'OUT' },
];

let tempIdCounter = 0;
function generateTempId(): string {
  tempIdCounter += 1;
  return `new_${tempIdCounter}_${Date.now()}`;
}

function createEmptyLine(): LineFormData {
  return {
    _id: generateTempId(),
    productId: '',
    quantity: 0,
    direction: 'IN',
    notes: '',
  };
}

export function MovementLinesPanel({ lines, onAddLine, onRemoveLine, onUpdateLine, readOnly, warehouseId, status }: MovementLinesPanelProps) {
  const { t } = useTranslation();
  const [newLine, setNewLine] = useState<LineFormData>(createEmptyLine());

  const isDraft = status === 'DRAFT' || !status;

  const handleAdd = () => {
    if (!newLine.productId || newLine.quantity <= 0) return;
    onAddLine({ ...newLine, _id: generateTempId() });
    setNewLine(createEmptyLine());
  };

  const handleFieldChange = (field: string, value: any) => {
    setNewLine((prev) => ({ ...prev, [field]: value }));
  };

  const locationsFilters = warehouseId ? { warehouseId } : undefined;

  const canDelete = (line: LineFormData) => {
    if (readOnly) return false;
    if (isDraft) return true;
    return line._id.startsWith('new_');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">{t('inventory.movementLines')}</h4>
        {lines.length > 0 && (
          <span className="text-xs text-gray-500">
            {lines.length} {t('common.items')}
          </span>
        )}
      </div>

      {lines.length === 0 && (
        <Card>
          <EmptyState message={t('inventory.noMovementLines')} />
        </Card>
      )}

      {lines.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.product')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.quantity')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('inventory.direction')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.notes')}</th>
                  {!readOnly && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lines.map((line) => (
                  <tr key={line._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {line.product
                        ? `[${line.product.code}] ${line.product.name}`
                        : line.productId || '-'}
                      {line.warehouseLocation && (
                        <span className="ml-2 text-xs text-gray-400">
                          @ {line.warehouseLocation.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">{line.quantity}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${line.direction === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {line.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 max-w-[200px] truncate">{line.notes || '-'}</td>
                    {!readOnly && (
                      <td className="px-4 py-2 text-sm text-right">
                        {canDelete(line) && (
                          <button
                            onClick={() => onRemoveLine(line._id)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                          >
                            {t('actions.remove')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!readOnly && isDraft && (
        <Card>
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-gray-600">{t('inventory.addLine')}</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <F9Lookup
                label={t('common.product')}
                value={newLine.productId}
                onChange={(v) => handleFieldChange('productId', v)}
                adapter={productAdapter}
              />
              <F9Lookup
                label={t('inventory.warehouseLocation')}
                value={newLine.warehouseLocationId || ''}
                onChange={(v) => handleFieldChange('warehouseLocationId', v)}
                adapter={warehouseLocationAdapter}
                filters={locationsFilters}
              />
              <Input
                label={t('common.quantity')}
                type="number"
                min={0}
                value={newLine.quantity || ''}
                onChange={(e) => handleFieldChange('quantity', parseFloat(e.target.value) || 0)}
              />
              <Select
                label={t('inventory.direction')}
                value={newLine.direction}
                onChange={(e) => handleFieldChange('direction', e.target.value)}
                options={directionOptions}
              />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <Input
                label={t('common.notes')}
                value={newLine.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleAdd}
                disabled={!newLine.productId || newLine.quantity <= 0}
              >
                {t('inventory.addLine')}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
