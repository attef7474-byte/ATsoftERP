'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../lib/i18n/use-translation';
import { useApiErrorHandler } from '../admin/error-handler';
import { Button, ConfirmDialog, Input, Modal, Select, Textarea } from '../admin/ui';
import { F9Lookup } from '../f9/F9Lookup';
import { maintenanceRequestAdapter, productionOrderAdapter, productionRunAdapter, warehouseAdapter } from '../f9/lookup-adapters';
import { IssueLinesEditor } from '../../app/admin/inventory/finished-goods-issues/_components/lines-editor';
import { changeIssueType, changeIssueWarehouse, changeMaintenanceRequest, changeProductionOrder, changeProductionRun, isGeneralIssueType, IssueType, IssueVoucherForm } from './issue-voucher-form';
interface Props {
  form: IssueVoucherForm;
  onChange: (form: IssueVoucherForm) => void;
  types: IssueType[];
  onSave: () => Promise<void>;
  onClose: () => void;
  saving: boolean;
  edit: boolean;
}
export function IssueVoucherDialog({
  form,
  onChange,
  types,
  onSave,
  onClose,
  saving,
  edit
}: Props) {
  const {
    t
  } = useTranslation();
  const handleError = useApiErrorHandler();
  const issueWarehouseAdapter = useMemo(() => ({
    ...warehouseAdapter,
    endpoint: '/inventory/issues/warehouses',
    detailFilters: true
  }), []);
  const [pending, setPending] = useState<IssueVoucherForm | null>(null);
  const [invalid, setInvalid] = useState(false);
  const linesEntered = (candidate: IssueVoucherForm) => candidate.lines.some(line => line.productId || line.sparePartId || line.quantity || line.warehouseLocationId || line.batchNumber || line.serialNumber || line.expiryDate);
  const dependentChange = (next: IssueVoucherForm) => {
    if (linesEntered(form)) setPending(next);else onChange(next);
  };
  const save = async () => {
    // A maintenance request is optional for spare parts: the native endpoint is
    // chosen from its presence, never required as a validation condition.
    const valid = Boolean(form.issueType && form.warehouseId && form.lines.length && (form.issueType !== 'RAW_MATERIAL' || form.productionOrderId && form.productionRunId) && form.lines.every(line => (line.productId || line.sparePartId) && line.unit && Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0 && (form.issueType !== 'SPARE_PART' || Number(line.quantity) >= 0.01) && Number(Number(line.quantity).toFixed(4)) === Number(line.quantity)));
    setInvalid(!valid);
    if (valid) await onSave();
  };
  return <>
    <Modal open onClose={() => {
      if (!saving) onClose();
    }} title={t(edit ? 'inventory.issueVoucher.edit' : 'inventory.issueVoucher.new')} size="lg">
      <div className="space-y-4">
        <Select label={t('inventory.issueVoucher.type')} required value={form.issueType} disabled={saving || edit} placeholder={t('common.select')} options={types.map(value => ({
          value,
          label: t(`inventory.warehouseApprovals.type${value}`)
        }))} onChange={event => dependentChange(changeIssueType(form, event.target.value as IssueType | ''))} />
        {form.issueType && <>
          <F9Lookup label={t('inventory.finishedGoodsIssue.issueWarehouse')} required adapter={issueWarehouseAdapter} filters={{
            type: form.issueType
          }} value={form.warehouseId} disabled={saving || edit} onChange={id => dependentChange(changeIssueWarehouse(form, id))} />
          {form.warehouseId && <>
            {form.issueType === 'SPARE_PART' && <>
              <F9Lookup label={t('inventory.issueVoucher.maintenanceRequestOptional')} adapter={maintenanceRequestAdapter} value={form.maintenanceRequestId} disabled={saving || edit} onChange={id => dependentChange(changeMaintenanceRequest(form, id))} onItemSelect={request => dependentChange(changeMaintenanceRequest(form, request.id, request.machine?.name || ''))} />
              {form.machineName && <Input label={t('inventory.issueVoucher.machine')} value={form.machineName} disabled />}
              <p className="text-sm text-gray-500">{t('inventory.issueVoucher.spareWorkflow')}</p>
            </>}
            {form.issueType === 'RAW_MATERIAL' && <>
              <F9Lookup label={t('production.materialDocuments.order')} required adapter={productionOrderAdapter} value={form.productionOrderId} disabled={saving || edit} onChange={id => dependentChange(changeProductionOrder(form, id))} />
              <F9Lookup label={t('production.materialDocuments.run')} required adapter={productionRunAdapter} filters={{
                productionOrderId: form.productionOrderId
              }} value={form.productionRunId} disabled={saving || edit || !form.productionOrderId} onChange={id => dependentChange(changeProductionRun(form, id))} />
              <p className="text-sm text-gray-500">{t('inventory.issueVoucher.materialRequirement')}</p>
            </>}
            {isGeneralIssueType(form.issueType) && <p className="text-sm text-gray-500">{t('inventory.issueVoucher.generalWorkflow')}</p>}
            <Input label={t('inventory.finishedGoodsIssue.issueDate')} type="date" value={form.date} disabled={saving || form.issueType === 'SPARE_PART'} onChange={event => onChange({
              ...form,
              date: event.target.value
            })} />
            {form.issueType !== 'RAW_MATERIAL' && <Input label={t('inventory.finishedGoodsIssue.purpose')} maxLength={500} value={form.purpose} disabled={saving} onChange={event => onChange({
              ...form,
              purpose: event.target.value
            })} />}
            <IssueLinesEditor lines={form.lines} issueType={form.issueType} warehouseId={form.warehouseId} productionOrderId={form.productionOrderId} productionRunId={form.productionRunId} disabled={saving} lockItem={edit && form.issueType === 'SPARE_PART' && Boolean(form.maintenanceRequestId)} onChange={lines => onChange({
              ...form,
              lines
            })} />
            <Textarea label={t('inventory.finishedGoodsIssue.notes')} maxLength={2000} value={form.notes} disabled={saving} onChange={event => onChange({
              ...form,
              notes: event.target.value
            })} />
          </>}
        </>}
        {invalid && <p role="alert" className="text-sm text-red-600">{t('inventory.issueVoucher.required')}</p>}
        <div className="flex justify-end gap-3"><Button variant="secondary" disabled={saving} onClick={onClose}>{t('actions.cancel')}</Button><Button disabled={!form.issueType || !form.warehouseId} loading={saving} onClick={() => void save().catch(handleError)}>{t('actions.save')}</Button></div>
      </div>
    </Modal>
    <ConfirmDialog open={Boolean(pending)} title={t('inventory.issueVoucher.resetTitle')} message={t('inventory.issueVoucher.resetMessage')} onClose={() => setPending(null)} onConfirm={() => {
      if (pending) onChange(pending);
      setPending(null);
    }} />
  </>;
}
