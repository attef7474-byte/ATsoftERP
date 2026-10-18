'use client';

import React, { useState } from 'react';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Button, Input, Select } from '../../../../../components/admin/ui';
import { F9Lookup } from '../../../../../components/f9/F9Lookup';
import { F9MultiLookup } from '../../../../../components/f9/F9MultiLookup';
import { productAdapter, warehouseLocationAdapter } from '../../../../../components/f9/lookup-adapters';
import { ProductUomSelect } from '../../../../../components/factory/ProductUomSelect';
import { COST_PURPOSE_VALUES, PRODUCTION_COST_PURPOSE } from '../../../../../lib/cost-purpose';

export interface MaterialLineDraft {
  key: string;
  productId: string;
  quantity: string;
  unit: string;
  productUomId: string;
  warehouseLocationId: string;
  batchNumber: string;
  serialNumber: string;
  expiryDate: string;
  substitutedProductId: string;
  substitutionReason: string;
  notes: string;
  costPurpose: string;
  costPurposeOverrideReason: string;
}

export function createEmptyMaterialLine(): MaterialLineDraft {
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
    substitutedProductId: '',
    substitutionReason: '',
    notes: '',
    costPurpose: PRODUCTION_COST_PURPOSE,
    costPurposeOverrideReason: '',
  };
}

interface LinesEditorProps {
  lines: MaterialLineDraft[];
  onChange: (lines: MaterialLineDraft[]) => void;
  showSubstitution: boolean;
  allowOverride: boolean;
  error?: string;
}

export function MaterialLinesEditor({ lines, onChange, showSubstitution, allowOverride, error }: LinesEditorProps) {
  const { t } = useTranslation();
  const [multiSelection, setMultiSelection] = useState<string[]>([]);

  const updateLine = (key: string, patch: Partial<MaterialLineDraft>) => {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    if (lines.length <= 1) return;
    onChange(lines.filter((line) => line.key !== key));
  };

  const addLine = () => {
    onChange([...lines, createEmptyMaterialLine()]);
  };

  // Multi-select: one independent row per selected product. Quantity, unit and
  // warehouse/location are never copied between rows — each selection starts as
  // an empty, independent line.
  const handleMultiSelect = (ids: string[]) => {
    const added = ids.filter((id) => !lines.some((line) => line.productId === id));
    if (added.length > 0) {
      onChange([...lines, ...added.map((id) => ({ ...createEmptyMaterialLine(), productId: id }))]);
      setMultiSelection([]);
      return;
    }
    setMultiSelection(ids);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{t('production.materialDocuments.lines')}</span>
        <Button type="button" variant="secondary" size="sm" onClick={addLine}>
          {t('production.materialDocuments.addLine')}
        </Button>
      </div>
      <F9MultiLookup
        label={t('production.materialDocuments.addMultiple')}
        description={t('production.materialDocuments.addMultipleHint')}
        value={multiSelection}
        onChange={handleMultiSelect}
        adapter={productAdapter}
        placeholder={t('production.materialDocuments.selectMaterials')}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {lines.map((line, index) => (
        <div key={line.key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">
              {t('production.materialDocuments.lines')} #{index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeLine(line.key)}
              disabled={lines.length <= 1}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('production.materialDocuments.removeLine')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <F9Lookup
                label={t('production.materialDocuments.product')}
                value={line.productId}
                adapter={productAdapter}
                onChange={(v) => updateLine(line.key, { productId: v, productUomId: '', unit: '' })}
              />
            </div>
            <div>
              <Input
                label={t('production.materialDocuments.quantity')}
                type="number"
                min="0"
                step="any"
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
              />
            </div>
            <div>
              <ProductUomSelect
                label={t('production.materialDocuments.unit')}
                productId={line.productId}
                value={line.productUomId}
                onSelect={(selection) => updateLine(line.key, { productUomId: selection.productUomId, unit: selection.unitCode })}
              />
            </div>
            <div className="col-span-2">
              <F9Lookup
                label={t('production.materialDocuments.warehouseLocation')}
                value={line.warehouseLocationId}
                adapter={warehouseLocationAdapter}
                onChange={(v) => updateLine(line.key, { warehouseLocationId: v })}
              />
            </div>
            <div>
              <Input
                label={t('production.materialDocuments.batchNumber')}
                maxLength={100}
                value={line.batchNumber}
                onChange={(e) => updateLine(line.key, { batchNumber: e.target.value })}
              />
            </div>
            <div>
              <Input
                label={t('production.materialDocuments.serialNumber')}
                maxLength={100}
                value={line.serialNumber}
                onChange={(e) => updateLine(line.key, { serialNumber: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Input
                label={t('production.materialDocuments.expiryDate')}
                type="date"
                value={line.expiryDate}
                onChange={(e) => updateLine(line.key, { expiryDate: e.target.value })}
              />
            </div>
            {showSubstitution && (
              <>
                <div className="col-span-2">
                  <F9Lookup
                    label={t('production.materialDocuments.substitutedProduct')}
                    value={line.substitutedProductId}
                    adapter={productAdapter}
                    onChange={(v) => updateLine(line.key, { substitutedProductId: v })}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={t('production.materialDocuments.substitutionReason')}
                    maxLength={1000}
                    value={line.substitutionReason}
                    onChange={(e) => updateLine(line.key, { substitutionReason: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="col-span-2">
              <Select
                label={t('common.costPurpose.label')}
                value={line.costPurpose}
                onChange={(e) => updateLine(line.key, { costPurpose: e.target.value })}
                options={COST_PURPOSE_VALUES.map((v) => ({ value: v, label: t('common.costPurpose.' + v) }))}
              />
            </div>
            {allowOverride && line.costPurpose !== PRODUCTION_COST_PURPOSE && (
              <div className="col-span-2">
                <Input
                  label={t('common.costPurpose.overrideReason')}
                  maxLength={1000}
                  placeholder={t('common.costPurpose.overrideReasonHint')}
                  value={line.costPurposeOverrideReason}
                  onChange={(e) => updateLine(line.key, { costPurposeOverrideReason: e.target.value })}
                />
              </div>
            )}
            <div className="col-span-2">
              <Input
                label={t('production.materialDocuments.lineNotes')}
                maxLength={2000}
                value={line.notes}
                onChange={(e) => updateLine(line.key, { notes: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
