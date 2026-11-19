'use client';

import React, { useState } from 'react';
import { useTranslation } from '../../lib/i18n/use-translation';
import { Button, ConfirmDialog, Input, Modal, Select, Textarea } from '../admin/ui';
import { F9Lookup } from '../f9/F9Lookup';
import {
  productionOrderAdapter,
  productionRunAdapter,
  productAdapter,
  warehouseAdapter,
  warehouseLocationAdapter,
} from '../f9/lookup-adapters';
import { ReceiptLinesEditor } from '../../app/admin/production/finished-goods-receipts/_components/lines-editor';
import {
  changeProductionOrder,
  changeProductionRun,
  changeReceiptLocation,
  changeReceiptSource,
  changeReceiptType,
  changeReceiptWarehouse,
  createEmptyReceiptLine,
  itemTypeForReceiptType,
  ReceiptSource,
  RECEIPT_SOURCES,
  receiptSourceLabelKey,
  receiptTypeLabelKey,
  ReceiptType,
  ReceiptVoucherForm,
} from './receipt-voucher-form';

interface Props {
  form: ReceiptVoucherForm;
  onChange: (form: ReceiptVoucherForm) => void;
  types: ReceiptType[];
  onSave: () => Promise<void>;
  onClose: () => void;
  saving: boolean;
  edit: boolean;
}

type PendingReset = { label: string; next: ReceiptVoucherForm };

export function ReceiptVoucherDialog({ form, onChange, types, onSave, onClose, saving, edit }: Props) {
  const { t } = useTranslation();
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState<PendingReset | null>(null);

  const isFinishedGood = form.receiptType === 'FINISHED_GOOD';
  const anyLineEntered = form.lines.some((line) =>
    line.productId || line.quantity || line.notes || line.unit || line.productUomId ||
    line.warehouseLocationId || line.batchNumber || line.serialNumber || line.expiryDate);
  const typeHasDownstream = Boolean(
    form.warehouseId || form.locationId || form.productionOrderId || form.productionRunId ||
    form.receiptSource || form.reason || form.notes || anyLineEntered,
  );

  const dependentChange = (label: string, next: ReceiptVoucherForm) => {
    onChange(next);
    setInvalid(false);
    if (label) setPending({ label, next });
  };

  const applyPending = () => {
    if (!pending) return;
    onChange(pending.next);
    setPending(null);
  };

  const updateLine = (key: string, patch: Partial<ReceiptVoucherForm['lines'][number]>) => {
    onChange({
      ...form,
      lines: form.lines.map((line) => line.key === key ? { ...line, ...patch } : line),
    });
    setInvalid(false);
  };

  const valid = Boolean(
    form.receiptType &&
    (isFinishedGood
      ? form.productionOrderId && form.productionRunId && form.warehouseId
      : form.warehouseId && form.reason.trim()) &&
    form.lines.length > 0 &&
    form.lines.every((line) =>
      line.productId &&
      Number.isFinite(Number(line.quantity)) &&
      Number(line.quantity) > 0 &&
      (!isFinishedGood || Boolean(line.unit.trim() && line.productUomId))),
  );

  const save = async () => {
    setInvalid(!valid);
    if (valid) await onSave();
  };

  return <>
    <Modal open onClose={() => { if (!saving) onClose(); }}
      title={t(edit ? 'inventory.receiptVoucher.edit' : 'inventory.receiptVoucher.new')}
      size="lg">
      <div className="space-y-4">
        <Select
          label={t('inventory.receiptVoucher.type')}
          required
          value={form.receiptType}
          disabled={saving || edit}
          placeholder={t('common.select')}
          options={types.map((value) => ({ value, label: t(receiptTypeLabelKey(value)) }))}
          onChange={(event) => dependentChange(
            typeHasDownstream ? 'type' : '',
            changeReceiptType(form, event.target.value as ReceiptType | ''),
          )}
        />

        {form.receiptType && <>
          {isFinishedGood ? <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <F9Lookup
                label={t('inventory.receiptVoucher.productionOrder')}
                required
                adapter={productionOrderAdapter}
                value={form.productionOrderId}
                disabled={saving || edit}
                onChange={(id) => dependentChange(
                  form.productionRunId || anyLineEntered ? 'order' : '',
                  changeProductionOrder(form, id),
                )}
              />
              <F9Lookup
                label={t('inventory.receiptVoucher.productionRun')}
                required
                adapter={productionRunAdapter}
                filters={form.productionOrderId ? { productionOrderId: form.productionOrderId } : {}}
                value={form.productionRunId}
                disabled={saving || edit || !form.productionOrderId}
                onChange={(id) => dependentChange(anyLineEntered ? 'run' : '', changeProductionRun(form, id))}
              />
              <F9Lookup
                label={t('inventory.receiptVoucher.warehouse')}
                required
                adapter={warehouseAdapter}
                value={form.warehouseId}
                disabled={saving || edit}
                onChange={(id) => dependentChange(anyLineEntered ? 'warehouse' : '', changeReceiptWarehouse(form, id))}
              />
              <Input
                label={t('inventory.receiptVoucher.date')}
                type="date"
                value={form.documentDate}
                disabled={saving}
                onChange={(event) => onChange({ ...form, documentDate: event.target.value })}
              />
            </div>
            <ReceiptLinesEditor
              lines={form.lines}
              onChange={(lines) => { onChange({ ...form, lines }); setInvalid(false); }}
              error={invalid ? t('inventory.receiptVoucher.required') : undefined}
            />
          </> : <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <F9Lookup
                label={t('inventory.receiptVoucher.warehouse')}
                required
                adapter={warehouseAdapter}
                value={form.warehouseId}
                disabled={saving}
                onChange={(id) => dependentChange(
                  form.locationId || anyLineEntered ? 'warehouse' : '',
                  changeReceiptWarehouse(form, id),
                )}
              />
              <F9Lookup
                label={t('inventory.receiptVoucher.location')}
                adapter={warehouseLocationAdapter}
                filters={form.warehouseId ? { warehouseId: form.warehouseId } : {}}
                value={form.locationId}
                disabled={saving || !form.warehouseId}
                onChange={(id) => dependentChange(anyLineEntered ? 'location' : '', changeReceiptLocation(form, id))}
              />
              <Select
                label={t('inventory.receiptVoucher.source')}
                value={form.receiptSource}
                disabled={saving}
                placeholder={t('common.select')}
                options={RECEIPT_SOURCES.map((source) => ({
                  value: source,
                  label: t(receiptSourceLabelKey(source)),
                }))}
                onChange={(event) => dependentChange(
                  'source',
                  changeReceiptSource(form, event.target.value as ReceiptSource | ''),
                )}
              />
              {form.receiptSource === 'SUPPLIER' && <>
                <Input
                  label={t('inventory.receiptVoucher.supplierName')}
                  value={form.supplierName}
                  maxLength={500}
                  disabled={saving}
                  onChange={(event) => onChange({ ...form, supplierName: event.target.value })}
                />
                <Input
                  label={t('inventory.receiptVoucher.supplierDoc')}
                  value={form.supplierDoc}
                  maxLength={500}
                  disabled={saving}
                  onChange={(event) => onChange({ ...form, supplierDoc: event.target.value })}
                />
              </>}
            </div>

            <Textarea
              label={t('inventory.receiptVoucher.reason')}
              required
              value={form.reason}
              maxLength={2000}
              disabled={saving}
              onChange={(event) => { onChange({ ...form, reason: event.target.value }); setInvalid(false); }}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('inventory.receiptVoucher.lines')}</span>
                {!saving && <Button type="button" variant="secondary" size="sm"
                  onClick={() => onChange({ ...form, lines: [...form.lines, createEmptyReceiptLine()] })}>
                  {t('inventory.receiptVoucher.addLine')}
                </Button>}
              </div>
              {form.lines.map((line, index) => <div key={line.key} className="space-y-3 rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">#{index + 1}</span>
                  {form.lines.length > 1 && !saving && <button type="button"
                    className="text-xs text-red-600"
                    onClick={() => onChange({ ...form, lines: form.lines.filter((current) => current.key !== line.key) })}>
                    {t('inventory.receiptVoucher.removeLine')}
                  </button>}
                </div>
                <F9Lookup
                  label={t(itemTypeForReceiptType(form.receiptType as ReceiptType) === 'SPARE_PART'
                    ? 'inventory.receiptVoucher.sparePart'
                    : 'inventory.receiptVoucher.product')}
                  required
                  adapter={productAdapter}
                  filters={{ itemType: itemTypeForReceiptType(form.receiptType as ReceiptType) }}
                  value={line.productId}
                  disabled={saving || !form.warehouseId}
                  onChange={(id) => updateLine(line.key, {
                    productId: id,
                    unit: '',
                    productUomId: '',
                    warehouseLocationId: '',
                    batchNumber: '',
                    serialNumber: '',
                    expiryDate: '',
                  })}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    label={t('inventory.receiptVoucher.quantity')}
                    type="number"
                    min="0.001"
                    step="0.0001"
                    value={line.quantity}
                    disabled={saving || !line.productId}
                    onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                  />
                  <Input
                    label={t('inventory.receiptVoucher.lineNotes')}
                    value={line.notes}
                    maxLength={2000}
                    disabled={saving}
                    onChange={(event) => updateLine(line.key, { notes: event.target.value })}
                  />
                </div>
              </div>)}
              {invalid && <p role="alert" className="text-sm text-red-600">{t('inventory.receiptVoucher.required')}</p>}
            </div>
          </>}

          <Textarea
            label={t('inventory.receiptVoucher.notes')}
            value={form.notes}
            maxLength={2000}
            disabled={saving}
            onChange={(event) => onChange({ ...form, notes: event.target.value })}
          />
        </>}

        {invalid && <p role="alert" className="text-sm text-red-600">{t('inventory.receiptVoucher.required')}</p>}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" disabled={saving} onClick={onClose}>{t('actions.cancel')}</Button>
          <Button disabled={!form.receiptType || !types.includes(form.receiptType as ReceiptType)}
            loading={saving} onClick={() => void save()}>{t('actions.save')}</Button>
        </div>
      </div>
    </Modal>

    <ConfirmDialog
      open={Boolean(pending)}
      title={t('inventory.receiptVoucher.resetTitle')}
      message={t('inventory.receiptVoucher.resetMessage')}
      loading={saving}
      onClose={() => setPending(null)}
      onConfirm={applyPending}
    />
  </>;
}
