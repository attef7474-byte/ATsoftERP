'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { Button, Input, Select, Textarea } from '../../../../../components/admin/ui';
import { F9Lookup } from '../../../../../components/f9/F9Lookup';
import {
  costCenterAdapter,
  machineAdapter,
  productionLineAdapter,
  productionProductDefinitionAdapter,
  productionUnitAdapter,
  warehouseAdapter,
} from '../../../../../components/f9/lookup-adapters';
import type {
  ProductionOrder,
  ProductionPackaging,
  ProductionProductDefinition,
  ProductionVersion,
} from '../../../../../lib/admin-types';

export interface OrderFormState {
  productionProductDefinitionId: string;
  productionVersionId: string;
  productionPackagingId: string;
  productionUnitId: string;
  productionLineId: string;
  machineId: string;
  plannedQuantity: string;
  capacityTimeBasis: string;
  plannedStartAt: string;
  plannedEndAt: string;
  priority: string;
  sourceType: string;
  sourceReference: string;
  costCenterId: string;
  issueWarehouseId: string;
  receiptWarehouseId: string;
  notes: string;
}

export interface OrderPreviewResult {
  snapshot: Record<string, string | null> | null;
  capacityStandardId: string;
  capacityStandardCode: string;
  capacityStandardRevision: number;
  matchedMachineId: string | null;
  plannedGrossQuantity: string;
  plannedRunMinutes: string;
  plannedAllowanceMinutes: string;
  plannedDurationMinutes: string;
}

export function orderErrorMessageKey(err: any): string | undefined {
  const key = err?.messageKey as string | undefined;
  if (!key || !key.startsWith('productionOrder.')) return undefined;
  return `production.orders.errors.${key.slice('productionOrder.'.length)}`;
}

const toLocalInputValue = (iso: string): string => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const addDaysLocal = (days: number, hour: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return toLocalInputValue(date.toISOString());
};

const emptyForm = (): OrderFormState => ({
  productionProductDefinitionId: '',
  productionVersionId: '',
  productionPackagingId: '',
  productionUnitId: '',
  productionLineId: '',
  machineId: '',
  plannedQuantity: '1000',
  capacityTimeBasis: 'HOUR',
  plannedStartAt: addDaysLocal(1, 8),
  plannedEndAt: addDaysLocal(1, 16),
  priority: 'NORMAL',
  sourceType: 'MANUAL',
  sourceReference: '',
  costCenterId: '',
  issueWarehouseId: '',
  receiptWarehouseId: '',
  notes: '',
});

const formFromOrder = (order: ProductionOrder): OrderFormState => ({
  productionProductDefinitionId: order.productionProductDefinitionId,
  productionVersionId: order.productionVersionId,
  productionPackagingId: order.productionPackagingId || '',
  productionUnitId: order.productionUnitId,
  productionLineId: order.productionLineId,
  machineId: order.machineId || '',
  plannedQuantity: order.plannedQuantity,
  capacityTimeBasis: order.capacityTimeBasis,
  plannedStartAt: toLocalInputValue(order.plannedStartAt),
  plannedEndAt: toLocalInputValue(order.plannedEndAt),
  priority: order.priority,
  sourceType: order.sourceType,
  sourceReference: order.sourceReference || '',
  costCenterId: order.costCenterId,
  issueWarehouseId: order.issueWarehouseId || '',
  receiptWarehouseId: order.receiptWarehouseId || '',
  notes: order.notes || '',
});

interface OrderFormProps {
  initial?: ProductionOrder | null;
  onSaved: (order: ProductionOrder) => void;
  onCancel: () => void;
}

export function OrderForm({ initial, onSaved, onCancel }: OrderFormProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [form, setForm] = useState<OrderFormState>(() => (initial ? formFromOrder(initial) : emptyForm()));
  const [versions, setVersions] = useState<ProductionVersion[]>([]);
  const [packagings, setPackagings] = useState<ProductionPackaging[]>([]);
  const [preview, setPreview] = useState<OrderPreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProductChildren = useCallback(async (id: string) => {
    if (!id) {
      setVersions([]);
      setPackagings([]);
      return;
    }
    try {
      const product = await api.get<ProductionProductDefinition>(`/production/product-definitions/${id}`);
      setVersions(product.versions || []);
      setPackagings(product.packagings || []);
    } catch (err) {
      handleApiError(err);
      setVersions([]);
      setPackagings([]);
    }
  }, [handleApiError]);

  useEffect(() => {
    if (initial?.productionProductDefinitionId) {
      loadProductChildren(initial.productionProductDefinitionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payloadFrom = useCallback(() => ({
    productionProductDefinitionId: form.productionProductDefinitionId || undefined,
    productionVersionId: form.productionVersionId || undefined,
    productionPackagingId: form.productionPackagingId || undefined,
    productionUnitId: form.productionUnitId || undefined,
    productionLineId: form.productionLineId || undefined,
    machineId: form.machineId || undefined,
    plannedQuantity: form.plannedQuantity,
    capacityTimeBasis: form.capacityTimeBasis,
    plannedStartAt: form.plannedStartAt ? new Date(form.plannedStartAt).toISOString() : undefined,
    plannedEndAt: form.plannedEndAt ? new Date(form.plannedEndAt).toISOString() : undefined,
    priority: form.priority,
    sourceType: form.sourceType,
    sourceReference: form.sourceReference || undefined,
    costCenterId: form.costCenterId || undefined,
    issueWarehouseId: form.issueWarehouseId || undefined,
    receiptWarehouseId: form.receiptWarehouseId || undefined,
    notes: form.notes || undefined,
  }), [form]);

  const requiredMissing = !form.productionProductDefinitionId
    || !form.productionVersionId
    || !form.productionUnitId
    || !form.productionLineId
    || !form.plannedQuantity
    || !form.plannedStartAt
    || !form.plannedEndAt
    || !form.costCenterId;

  const handleSaveError = (err: any) => {
    const key = orderErrorMessageKey(err);
    handleApiError(err, key ? { message: t(key) } : undefined);
  };

  const runPreview = async () => {
    if (requiredMissing) {
      showToast(t('validation.required'), 'error');
      return;
    }
    setPreviewing(true);
    try {
      setPreview(await api.post<OrderPreviewResult>('/production/orders/preview', payloadFrom()));
    } catch (err) {
      handleSaveError(err);
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    if (requiredMissing) {
      showToast(t('validation.required'), 'error');
      return;
    }
    setSaving(true);
    try {
      const saved: ProductionOrder = initial
        ? await api.patch<ProductionOrder>(`/production/orders/${initial.id}`, { ...payloadFrom(), lockVersion: initial.lockVersion })
        : await api.post<ProductionOrder>('/production/orders', { ...payloadFrom(), clientRequestId: crypto.randomUUID() });
      showToast(t(initial ? 'common.successUpdated' : 'common.successCreated'), 'success');
      onSaved(saved);
    } catch (err) {
      handleSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <F9Lookup label={t('production.product')} value={form.productionProductDefinitionId}
          adapter={productionProductDefinitionAdapter}
          onChange={(value) => {
            setForm((prev) => ({ ...prev, productionProductDefinitionId: value, productionVersionId: '', productionPackagingId: '' }));
            loadProductChildren(value);
          }} />
        <F9Lookup label={t('production.line')} value={form.productionLineId} adapter={productionLineAdapter}
          onChange={(value) => setForm((prev) => ({ ...prev, productionLineId: value, machineId: '' }))} />
        <F9Lookup label={t('production.machine')} value={form.machineId} adapter={machineAdapter}
          filters={form.productionLineId ? { productionLineId: form.productionLineId } : undefined}
          disabled={!form.productionLineId}
          onChange={(value) => setForm((prev) => ({ ...prev, machineId: value }))} />
        <Select label={t('production.versionLabel')} value={form.productionVersionId}
          onChange={(e) => setForm((prev) => ({ ...prev, productionVersionId: e.target.value }))}
          placeholder={t('production.allVersions')}
          options={versions.map((v) => ({ value: v.id, label: `${v.versionNumber} - ${v.versionLabel}` }))} />
        <Select label={t('production.packagingType')} value={form.productionPackagingId}
          onChange={(e) => setForm((prev) => ({ ...prev, productionPackagingId: e.target.value }))}
          placeholder={t('production.allPackagings')}
          options={packagings.map((p) => ({ value: p.id, label: `${p.packagingType} (${p.packQuantity})` }))} />
        <F9Lookup label={t('production.units')} value={form.productionUnitId} adapter={productionUnitAdapter}
          onChange={(value) => setForm((prev) => ({ ...prev, productionUnitId: value }))} />
        <F9Lookup label={t('production.orders.costCenter')} value={form.costCenterId} adapter={costCenterAdapter}
          onChange={(value) => setForm((prev) => ({ ...prev, costCenterId: value }))} />
        <F9Lookup label={t('production.orders.issueWarehouse')} value={form.issueWarehouseId} adapter={warehouseAdapter}
          onChange={(value) => setForm((prev) => ({ ...prev, issueWarehouseId: value }))} />
        <F9Lookup label={t('production.orders.receiptWarehouse')} value={form.receiptWarehouseId} adapter={warehouseAdapter}
          onChange={(value) => setForm((prev) => ({ ...prev, receiptWarehouseId: value }))} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input label={t('production.orders.plannedQuantity')} value={form.plannedQuantity}
          onChange={(e) => setForm((prev) => ({ ...prev, plannedQuantity: e.target.value }))} />
        <Select label={t('production.capacityTimeBasis')} value={form.capacityTimeBasis}
          onChange={(e) => setForm((prev) => ({ ...prev, capacityTimeBasis: e.target.value }))}
          options={['MINUTE', 'HOUR'].map((value) => ({ value, label: t('production.timeBasis.' + value) }))} />
        <Input type="datetime-local" label={t('production.orders.plannedStartAt')} value={form.plannedStartAt}
          onChange={(e) => setForm((prev) => ({ ...prev, plannedStartAt: e.target.value }))} />
        <Input type="datetime-local" label={t('production.orders.plannedEndAt')} value={form.plannedEndAt}
          onChange={(e) => setForm((prev) => ({ ...prev, plannedEndAt: e.target.value }))} />
        <Select label={t('production.orders.orderPriority')} value={form.priority}
          onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
          options={['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((value) => ({ value, label: t('production.orders.priority.' + value) }))} />
        <Select label={t('production.orders.orderSourceType')} value={form.sourceType}
          onChange={(e) => setForm((prev) => ({ ...prev, sourceType: e.target.value }))}
          options={['MANUAL', 'REPLENISHMENT', 'FORECAST', 'OTHER'].map((value) => ({ value, label: t('production.orders.sourceType.' + value) }))} />
      </div>
      <Input label={t('production.sourceReference')} value={form.sourceReference}
        onChange={(e) => setForm((prev) => ({ ...prev, sourceReference: e.target.value }))} />
      <Textarea label={t('common.notes')} value={form.notes}
        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={runPreview} loading={previewing}>{t('production.orders.preview')}</Button>
        <Button onClick={save} loading={saving}>{t('actions.save')}</Button>
        <Button variant="secondary" onClick={onCancel}>{t('actions.cancel')}</Button>
      </div>

      {preview && (
        <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm">
          <div className="mb-2 font-semibold">{t('production.orders.previewResult')}</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div>{t('production.orders.capacityStandard')}: {preview.capacityStandardCode} / {preview.capacityStandardRevision}</div>
            <div>{t('production.orders.plannedGrossQuantity')}: {preview.plannedGrossQuantity}</div>
            <div>{t('production.orders.plannedRunMinutes')}: {preview.plannedRunMinutes}</div>
            <div>{t('production.orders.plannedAllowanceMinutes')}: {preview.plannedAllowanceMinutes}</div>
            <div>{t('production.orders.plannedDurationMinutes')}: {preview.plannedDurationMinutes}</div>
          </div>
        </div>
      )}
    </div>
  );
}