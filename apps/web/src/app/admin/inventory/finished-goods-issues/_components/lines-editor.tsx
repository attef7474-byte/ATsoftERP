'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Button, Input } from '../../../../../components/admin/ui';
import { F9Lookup } from '../../../../../components/f9/F9Lookup';
import { productAdapter, sparePartAdapter, warehouseLocationAdapter } from '../../../../../components/f9/lookup-adapters';
import type { ProductUom } from '../../../../../lib/admin-types';
import type { LookupAdapter } from '../../../../../components/f9/types';
import { ProductUomSelect } from '../../../../../components/factory/ProductUomSelect';
import type { IssueType } from '../../../../../components/inventory/issue-voucher-form';
export interface IssueLineDraft {
  key: string;
  productId: string;
  sparePartId?: string;
  uoms?: ProductUom[];
  quantity: string;
  unit: string;
  productUomId: string;
  warehouseLocationId: string;
  batchNumber: string;
  serialNumber: string;
  expiryDate: string;
  stockId?: string;
  notes: string;
}
export function newIssueClientId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
export function createEmptyIssueLine(): IssueLineDraft {
  return {
    key: newIssueClientId(),
    productId: '',
    quantity: '',
    unit: '',
    productUomId: '',
    warehouseLocationId: '',
    batchNumber: '',
    serialNumber: '',
    expiryDate: '',
    notes: ''
  };
}
/**
 * Two lines are the same physical stock line only when they share the item,
 * warehouse stock identity, transaction UOM and expiry. Selecting a genuinely
 * identical item again merges the quantities instead of creating a silent
 * duplicate; differing UOM or expiry lines remain separate and are never
 * silently collapsed into one payload.
 */
export function issueLineIdentity(line: IssueLineDraft): string {
  return [
    line.sparePartId || line.productId || '',
    line.warehouseLocationId || '',
    line.batchNumber || '',
    line.serialNumber || '',
    line.productUomId || '',
    line.unit || '',
    line.expiryDate ? line.expiryDate.slice(0, 10) : '',
  ].join('|');
}
export function mergeDuplicateIssueLines(lines: IssueLineDraft[]): { lines: IssueLineDraft[]; mergedCount: number } {
  const seen = new Map<string, IssueLineDraft>();
  const result: IssueLineDraft[] = [];
  let mergedCount = 0;
  for (const line of lines) {
    if (!line.productId && !line.sparePartId) {
      result.push(line);
      continue;
    }
    const identity = issueLineIdentity(line);
    const existing = seen.get(identity);
    if (existing) {
      // Round to the API's four-decimal contract so floating-point artifacts
      // (0.1 + 0.2) cannot make the merged draft fail its own save validation.
      const merged = Number(existing.quantity || 0) + Number(line.quantity || 0);
      existing.quantity = Number.isFinite(merged) ? String(Number(merged.toFixed(4))) : String(merged);
      mergedCount += 1;
    } else {
      const kept = { ...line };
      seen.set(identity, kept);
      result.push(kept);
    }
  }
  return { lines: result, mergedCount };
}
interface IssueLinesEditorProps {
  lines: IssueLineDraft[];
  onChange: (lines: IssueLineDraft[]) => void;
  warehouseId: string;
  issueType?: IssueType;
  productionOrderId?: string;
  productionRunId?: string;
  disabled?: boolean;
  lockItem?: boolean;
  error?: string;
}
function IssueLineRow({
  line,
  update,
  warehouseId,
  issueType = 'FINISHED_GOODS',
  productionOrderId,
  productionRunId,
  disabled,
  lockItem
}: Omit<IssueLinesEditorProps, 'lines' | 'onChange'> & {
  line: IssueLineDraft;
  update: (patch: Partial<IssueLineDraft>) => void;
}) {
  const {
    t
  } = useTranslation();
  const [balance, setBalance] = useState<{
    available: string;
    unit: string;
  } | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const filters = useMemo(() => ({
    type: issueType,
    warehouseId,
    ...(productionOrderId ? {
      productionOrderId
    } : {}),
    ...(productionRunId ? {
      productionRunId
    } : {})
  }), [issueType, warehouseId, productionOrderId, productionRunId]);
  const stockFilters = useMemo(() => ({
    ...filters,
    productId: line.productId,
    ...(line.warehouseLocationId ? {
      locationId: line.warehouseLocationId
    } : {})
  }), [filters, line.productId, line.warehouseLocationId]);
  const itemAdapter = useMemo<LookupAdapter<any>>(() => ({
    ...(issueType === 'SPARE_PART' ? sparePartAdapter : productAdapter),
    endpoint: '/inventory/issues/candidates',
    detailEndpoint: '/inventory/issues/candidates',
    detailFilters: true
  }), [issueType]);
  const locationAdapter = useMemo(() => ({
    ...warehouseLocationAdapter,
    endpoint: '/inventory/issues/locations',
    detailFilters: true
  }), []);
  const stockAdapter = useMemo<LookupAdapter<any>>(() => ({
    endpoint: '/inventory/issues/stock',
    detailEndpoint: '/inventory/issues/stock',
    detailFilters: true,
    searchFields: ['batchNumber', 'serialNumber'],
    displayLabel: stock => [stock.location?.name, stock.batchNumber, stock.serialNumber, stock.expiryDate?.slice(0, 10), String(stock.quantityBase ?? stock.quantity)].filter(Boolean).join(' · '),
    columns: [{
      key: 'batchNumber',
      header: t('inventory.finishedGoodsIssue.batchNumber')
    }, {
      key: 'serialNumber',
      header: t('inventory.finishedGoodsIssue.serialNumber')
    }, {
      key: 'location',
      header: t('inventory.finishedGoodsIssue.warehouseLocation'),
      render: stock => stock.location?.name || '-'
    }, {
      key: 'quantity',
      header: t('inventory.issueVoucher.available'),
      render: stock => String(stock.quantityBase ?? stock.quantity)
    }]
  }), [t]);
  const ready = Boolean(warehouseId && (issueType !== 'RAW_MATERIAL' || productionOrderId && productionRunId));
  useEffect(() => {
    let cancelled = false;
    setBalance(null);
    setBalanceError(false);
    if (ready && line.productId) {
      api.get<{
        available: string;
        unit: string;
      }>('/inventory/issues/stock', {
        params: {
          ...stockFilters,
          ...(line.batchNumber ? {
            batchNumber: line.batchNumber
          } : {}),
          ...(line.serialNumber ? {
            serialNumber: line.serialNumber
          } : {})
        }
      }).then(result => {
        if (!cancelled) setBalance(result);
      }).catch(() => {
        if (!cancelled) setBalanceError(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [ready, stockFilters, line.batchNumber, line.serialNumber]);
  const itemLabelKey = issueType === 'SPARE_PART'
    ? 'inventory.issueVoucher.itemSparePart'
    : issueType === 'RAW_MATERIAL'
      ? 'inventory.issueVoucher.itemRawMaterial'
      : 'inventory.issueVoucher.itemFinishedProduct';
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    <div className="md:col-span-2"><F9Lookup label={t(itemLabelKey)} value={issueType === 'SPARE_PART' ? line.sparePartId || '' : line.productId} adapter={itemAdapter} filters={filters} disabled={disabled || !ready || lockItem} onChange={id => {
      if (!id) update({
        ...createEmptyIssueLine(),
        key: line.key
      });
    }} onItemSelect={item => update({
      ...createEmptyIssueLine(),
      key: line.key,
      productId: issueType === 'SPARE_PART' ? item.productId : item.id,
      sparePartId: issueType === 'SPARE_PART' ? item.id : undefined,
      unit: item.unit || item.product?.unit || '',
      uoms: item.uoms || []
    })} /></div>
    {issueType === 'SPARE_PART' ? <Input label={t('inventory.finishedGoodsIssue.unit')} value={line.unit} disabled /> : <ProductUomSelect label={t('inventory.finishedGoodsIssue.unit')} productId={line.productId} value={line.productUomId} providedUoms={line.uoms} disabled={disabled || !ready} onSelect={uom => update({
      productUomId: uom.productUomId,
      unit: uom.unitCode
    })} />}
    <F9Lookup label={t('inventory.finishedGoodsIssue.warehouseLocation')} value={line.warehouseLocationId} adapter={locationAdapter} filters={filters} disabled={disabled || !ready || !line.productId} onChange={id => update({
      warehouseLocationId: id,
      stockId: '',
      batchNumber: '',
      serialNumber: '',
      expiryDate: ''
    })} />
    <div className="md:col-span-2"><F9Lookup label={t('inventory.issueVoucher.stockIdentity')} value={line.stockId || ''} adapter={stockAdapter} filters={stockFilters} clearOnFilterChange={false} disabled={disabled || !ready || !line.productId} onChange={id => {
      if (!id) update({
        stockId: '',
        batchNumber: '',
        serialNumber: '',
        expiryDate: ''
      });
    }} onItemSelect={stock => update({
      stockId: stock.id,
      warehouseLocationId: stock.locationId || '',
      batchNumber: stock.batchNumber || '',
      serialNumber: stock.serialNumber || '',
      expiryDate: stock.expiryDate?.slice(0, 10) || ''
    })} /></div>
    {(line.batchNumber || line.serialNumber || line.expiryDate) && <p className="text-sm md:col-span-2">{[line.batchNumber, line.serialNumber, line.expiryDate].filter(Boolean).join(' · ')}</p>}
    {line.productId && <p className="text-sm md:col-span-2" role="status">{balanceError ? t('inventory.issueVoucher.balanceError') : balance ? `${t('inventory.issueVoucher.available')} ${balance.available} ${balance.unit}` : t('common.loading')}</p>}
    <Input label={t('inventory.finishedGoodsIssue.quantity')} type="number" min={issueType === 'SPARE_PART' ? '0.01' : '0.0001'} step="0.0001" value={line.quantity} disabled={disabled || !ready || !line.productId} onChange={event => update({
      quantity: event.target.value
    })} />
    <Input label={t('inventory.finishedGoodsIssue.lineNotes')} value={line.notes} maxLength={2000} disabled={disabled} onChange={event => update({
      notes: event.target.value
    })} />
  </div>;
}
export function IssueLinesEditor({
  lines,
  onChange,
  disabled = false,
  error,
  issueType = 'FINISHED_GOODS',
  ...context
}: IssueLinesEditorProps) {
  const {
    t
  } = useTranslation();
  const [merged, setMerged] = useState(false);
  const apply = (next: IssueLineDraft[]) => {
    const result = mergeDuplicateIssueLines(next);
    setMerged(result.mergedCount > 0);
    onChange(result.lines);
  };
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><span className="text-sm font-medium">{t('inventory.finishedGoodsIssue.lines')}</span>
      {!disabled && <Button type="button" variant="secondary" size="sm" onClick={() => apply([...lines, createEmptyIssueLine()])}>{t('inventory.finishedGoodsIssue.addLine')}</Button>}
    </div>
    {merged && <p role="status" className="text-sm text-blue-700">{t('inventory.issueVoucher.duplicateMerged')}</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {lines.map(line => <div key={line.key} className="space-y-3 rounded-lg border bg-gray-50 p-3">
      <IssueLineRow {...context} issueType={issueType} line={line} disabled={disabled} update={patch => apply(lines.map(current => current.key === line.key ? {
        ...current,
        ...patch
      } : current))} />
      {!disabled && lines.length > 1 && <Button type="button" variant="secondary" size="sm" onClick={() => apply(lines.filter(current => current.key !== line.key))}>{t('inventory.finishedGoodsIssue.removeLine')}</Button>}
    </div>)}
  </div>;
}
