'use client';

import React from 'react';
import { useTranslation } from '../../lib/i18n/use-translation';
import { canInstallExecutionPart, type ExecutionPartInput, type ExecutionScopeType } from '../../lib/maintenance-execution';
import { Button, Input, Select, Textarea } from '../admin/ui';
import { F9Lookup, machineInstalledPartAdapter, productAdapter, sparePartAdapter, warehouseAdapter } from '../f9';

export { validateExecutionParts } from '../../lib/maintenance-execution';

export function ExecutionPartsEditor({ parts, onChange, scopeType, machineId, disabled = false }: { parts: ExecutionPartInput[]; onChange: (parts: ExecutionPartInput[]) => void; scopeType: ExecutionScopeType; machineId?: string | null; disabled?: boolean }) {
  const { t } = useTranslation();
  const update = (index: number, patch: Partial<ExecutionPartInput>) => onChange(parts.map((part, position) => position === index ? { ...part, ...patch } : part));
  const installed = canInstallExecutionPart(scopeType, machineId);
  const conditions = [
    { value: 'NEW', label: t('sparePartRequest.conditionNew') },
    { value: 'USED_SERVICEABLE', label: t('sparePartRequest.conditionUsedServiceable') },
    { value: 'USED_REPAIRABLE', label: t('sparePartRequest.conditionUsedRepairable') },
    { value: 'DAMAGED_REPAIRABLE', label: t('sparePartRequest.conditionDamagedRepairable') },
    { value: 'DAMAGED_NOT_REPAIRABLE', label: t('sparePartRequest.conditionDamagedNotRepairable') },
  ];
  return <div className="space-y-4">
    <p className="text-sm text-gray-500">{t('maintenance.actualPartsTeamHint')}</p>
    {parts.map((part, index) => <fieldset key={part.clientRequestId} disabled={disabled} className="space-y-3 border rounded-lg p-4">
      <legend className="px-1 text-sm font-medium">{t('maintenance.actualPart')} {index + 1}</legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <F9Lookup label={t('sparePartIssue.sparePart')} value={part.sparePartId || ''} adapter={sparePartAdapter} disabled={disabled} filters={{ status: 'ACTIVE' }} onChange={(sparePartId) => update(index, { sparePartId: sparePartId || undefined, productId: undefined })} onItemSelect={(item) => update(index, { sparePartId: item.id, productId: item.productId || undefined })} />
        {(!part.sparePartId || !part.productId) && <F9Lookup label={t('maintenance.inventoryProduct')} value={part.productId || ''} adapter={productAdapter} disabled={disabled} filters={{ status: 'ACTIVE' }} onChange={(productId) => update(index, { productId: productId || undefined })} />}
        <F9Lookup label={t('maintenance.workOrderWarehouse')} value={part.warehouseId} adapter={warehouseAdapter} disabled={disabled} onChange={(warehouseId) => update(index, { warehouseId })} />
        <Input label={t('maintenance.quantity')} type="number" min="0.0001" step="0.0001" value={part.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} required />
        <Select label={t('maintenance.partUsageType')} value={part.usageType} onChange={(event) => update(index, { usageType: event.target.value as ExecutionPartInput['usageType'], oldInstalledPartId: undefined, replacementAction: event.target.value === 'REPLACED' ? 'RETURNED_REMOVED_PART' : undefined })} options={(installed ? ['CONSUMED', 'INSTALLED', 'REPLACED'] : ['CONSUMED']).map((value) => ({ value, label: t(`maintenance.usage${value}`) }))} />
        {part.sparePartId && <Select label={t('sparePartRequest.issuedStockCondition')} value={part.issuedStockCondition || 'NEW'} options={conditions} onChange={(event) => update(index, { issuedStockCondition: event.target.value })} />}
      </div>
      {part.usageType === 'REPLACED' && <div className="space-y-3 rounded-lg bg-gray-50 p-3">
        <F9Lookup label={t('sparePartRequest.oldInstalledPart')} value={part.oldInstalledPartId || ''} adapter={machineInstalledPartAdapter} filters={{ machineId: machineId || '', status: 'ACTIVE' }} disabled={disabled || !machineId} onChange={(oldInstalledPartId) => update(index, { oldInstalledPartId: oldInstalledPartId || undefined })} />
        <Select label={t('sparePartRequest.replacementAction')} value={part.replacementAction || 'RETURNED_REMOVED_PART'} onChange={(event) => update(index, { replacementAction: event.target.value, removedPartCondition: undefined, removedPartWarehouseId: undefined, removedPartQuantity: undefined, noReturnReason: undefined })} options={[{ value: 'RETURNED_REMOVED_PART', label: t('sparePartRequest.replacementReturnedRemoved') }, { value: 'NO_REMOVED_PART', label: t('sparePartRequest.replacementNoRemoved') }]} />
        {part.replacementAction === 'NO_REMOVED_PART' ? <Textarea label={t('sparePartRequest.noReturnReason')} value={part.noReturnReason || ''} required onChange={(event) => update(index, { noReturnReason: event.target.value })} /> : <>
          <Select label={t('sparePartRequest.removedPartCondition')} value={part.removedPartCondition || ''} options={[{ value: '', label: t('common.select') }, ...conditions]} onChange={(event) => update(index, { removedPartCondition: event.target.value })} />
          <F9Lookup label={t('sparePartRequest.removedPartWarehouse')} value={part.removedPartWarehouseId || ''} adapter={warehouseAdapter} disabled={disabled} onChange={(removedPartWarehouseId) => update(index, { removedPartWarehouseId: removedPartWarehouseId || undefined })} />
          <Input label={t('maintenance.removedQuantity')} type="number" min="0.0001" step="0.0001" value={part.removedPartQuantity || ''} required onChange={(event) => update(index, { removedPartQuantity: Number(event.target.value) })} />
        </>}
      </div>}
      <Textarea label={t('maintenance.notes')} value={part.notes || ''} onChange={(event) => update(index, { notes: event.target.value })} />
      <Button variant="danger" disabled={disabled} onClick={() => onChange(parts.filter((_, position) => index !== position))}>{t('actions.remove')}</Button>
    </fieldset>)}
    <Button variant="secondary" disabled={disabled} onClick={() => onChange([...parts, { clientRequestId: crypto.randomUUID(), warehouseId: '', quantity: 1, usageType: 'CONSUMED', issuedStockCondition: 'NEW' }])}>{t('maintenance.addActualPart')}</Button>
  </div>;
}
