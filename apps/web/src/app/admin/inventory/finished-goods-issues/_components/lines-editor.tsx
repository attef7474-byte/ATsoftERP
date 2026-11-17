'use client';

import React from 'react';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Button, Input } from '../../../../../components/admin/ui';
import { F9Lookup } from '../../../../../components/f9/F9Lookup';
import { F9MultiLookup } from '../../../../../components/f9/F9MultiLookup';
import { productAdapter, warehouseLocationAdapter } from '../../../../../components/f9/lookup-adapters';
import { ProductUomSelect } from '../../../../../components/factory/ProductUomSelect';

export interface IssueLineDraft {
  key: string;
  productId: string;
  quantity: string;
  unit: string;
  productUomId: string;
  warehouseLocationId: string;
  batchNumber: string;
  serialNumber: string;
  expiryDate: string;
  notes: string;
}

export function createEmptyIssueLine(): IssueLineDraft {
  return {
    key: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    productId: '',
    quantity: '',
    unit: '',
    productUomId: '',
    warehouseLocationId: '',
    batchNumber: '',
    serialNumber: '',
    expiryDate: '',
    notes: '',
  };
}

interface IssueLinesEditorProps {
  lines: IssueLineDraft[];
  onChange: (lines: IssueLineDraft[]) => void;
  disabled?: boolean;
  error?: string;
}

export function IssueLinesEditor({ lines, onChange, disabled = false, error }: IssueLinesEditorProps) {
  const { t } = useTranslation();

  const updateLine = (key: string, patch: Partial<IssueLineDraft>) => {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    if (lines.length <= 1) return;
    onChange(lines.filter((line) => line.key !== key));
  };

  const addLine = () => onChange([...lines, createEmptyIssueLine()]);

  // One independent row per selected product. Quantity, unit and location are
  // never copied between rows.
  const handleMultiSelect = (ids: string[]) => {
    const added = ids.filter((id) => !lines.some((line) => line.productId === id));
    if (added.length === 0) return;
    onChange([...lines, ...added.map((id) => ({ ...createEmptyIssueLine(), productId: id }))]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{t('inventory.finishedGoodsIssue.lines')}</span>
        {!disabled && (
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            {t('inventory.finishedGoodsIssue.addLine')}
          </Button>
        )}
      </div>
      {!disabled && (
        <F9MultiLookup
          label={t('inventory.finishedGoodsIssue.selectProduct')}
          value={[]}
          onChange={handleMultiSelect}
          adapter={productAdapter}
          placeholder={t('inventory.finishedGoodsIssue.selectProduct')}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {lines.map((line, index) => (
        <div key={line.key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">
              {t('inventory.finishedGoodsIssue.lines')} #{index + 1}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                disabled={lines.length <= 1}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('inventory.finishedGoodsIssue.removeLine')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <F9Lookup
                label={t('inventory.finishedGoodsIssue.product')}
                value={line.productId}
                adapter={productAdapter}
                onChange={(v) => updateLine(line.key, { productId: v, productUomId: '', unit: '' })}
                disabled={disabled}
              />
            </div>
            <div>
              <Input
                label={t('inventory.finishedGoodsIssue.quantity')}
                type="number"
                min="0"
                step="any"
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div>
              <ProductUomSelect
                label={t('inventory.finishedGoodsIssue.unit')}
                productId={line.productId}
                value={line.productUomId}
                onSelect={(selection) => updateLine(line.key, { productUomId: selection.productUomId, unit: selection.unitCode })}
              />
            </div>
            <div className="col-span-2">
              <F9Lookup
                label={t('inventory.finishedGoodsIssue.warehouseLocation')}
                value={line.warehouseLocationId}
                adapter={warehouseLocationAdapter}
                onChange={(v) => updateLine(line.key, { warehouseLocationId: v })}
                disabled={disabled}
              />
            </div>
            <div>
              <Input
                label={t('inventory.finishedGoodsIssue.batchNumber')}
                maxLength={100}
                value={line.batchNumber}
                onChange={(e) => updateLine(line.key, { batchNumber: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div>
              <Input
                label={t('inventory.finishedGoodsIssue.serialNumber')}
                maxLength={100}
                value={line.serialNumber}
                onChange={(e) => updateLine(line.key, { serialNumber: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="col-span-2">
              <Input
                label={t('inventory.finishedGoodsIssue.expiryDate')}
                type="date"
                value={line.expiryDate}
                onChange={(e) => updateLine(line.key, { expiryDate: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="col-span-2">
              <Input
                label={t('inventory.finishedGoodsIssue.lineNotes')}
                maxLength={2000}
                value={line.notes}
                onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
