'use client';
import React, { useState } from 'react';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { Input, Textarea, StatusBadge, Modal, Select, Button } from '../../../../components/admin/ui';
import { F9Lookup, machineCategoryAdapter, companyAdapter, branchAdapter, departmentAdapter, productionLineAdapter, operationTypeAdapter } from '../../../../components/f9';
import type { Machine } from '../../../../lib/admin-types';

const MACHINE_CC_TYPES = ['PRODUCTION', 'MAINTENANCE', 'PROJECT', 'DEVELOPMENT', 'QUALITY', 'UTILITIES', 'ADMIN', 'OTHER'];

// R2: CostCenter.type is a REQUIRED master-data classification for the Machine's
// dedicated cost center. It is NEVER assigned as a universal default (no blanket
// PRODUCTION). It may only be SUGGESTED from a clear canonical OperationType
// mapping (rule 2); when there is no mapping the user MUST confirm explicitly
// (rule 3). MachineCategory / Department.classification / ProductionLine presence
// never determine the cost center type (rules 5-7).
// UTILITIES/MAINTENANCE/QUALITY/PROJECT -> themselves; production ops -> PRODUCTION.
const OP_TYPE_TO_CC_TYPE: Record<string, string> = {
  UTILITIES: 'UTILITIES',
  MAINTENANCE: 'MAINTENANCE',
  QUALITY: 'QUALITY',
  PROJECT: 'PROJECT',
  MANUFACTURING: 'PRODUCTION',
  PREPARATION: 'PRODUCTION',
  MIXING: 'PRODUCTION',
  FILLING: 'PRODUCTION',
  PACKAGING: 'PRODUCTION',
};

export function suggestCostCenterType(operationTypeCode?: string | null): string {
  if (!operationTypeCode) return '';
  return OP_TYPE_TO_CC_TYPE[operationTypeCode] || '';
}

export interface MachineFormState {
  code: string;
  name: string;
  categoryId: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  productionLineId: string;
  operationTypeId: string;
  defaultCostCenterId: string;
  dedicatedCostCenterType: string;
  dedicatedCostCenterDescription: string;
  dedicatedCostCenterReady: boolean;
  model: string;
  serialNumber: string;
  manufacturer: string;
  location: string;
  notes: string;
}

export const EMPTY_MACHINE_FORM: MachineFormState = {
  code: '',
  name: '',
  categoryId: '',
  companyId: '',
  branchId: '',
  departmentId: '',
  productionLineId: '',
  operationTypeId: '',
  defaultCostCenterId: '',
  dedicatedCostCenterType: '',
  dedicatedCostCenterDescription: '',
  dedicatedCostCenterReady: false,
  model: '',
  serialNumber: '',
  manufacturer: '',
  location: '',
  notes: '',
};

export function createMachineForm(): MachineFormState {
  return { ...EMPTY_MACHINE_FORM };
}

export function mapMachineToForm(machine: Machine): MachineFormState {
  return {
    code: machine.code || '',
    name: machine.name || '',
    categoryId: machine.categoryId || '',
    companyId: machine.companyId || '',
    branchId: machine.branchId || '',
    departmentId: machine.departmentId || '',
    productionLineId: machine.productionLineId || '',
    operationTypeId: machine.operationTypeId || '',
    defaultCostCenterId: machine.defaultCostCenterId || '',
    dedicatedCostCenterType: machine.defaultCostCenter?.type || '',
    dedicatedCostCenterDescription: '',
    dedicatedCostCenterReady: Boolean(machine.defaultCostCenterId),
    model: machine.model || '',
    serialNumber: machine.serialNumber || '',
    manufacturer: machine.manufacturer || '',
    location: machine.location || '',
    notes: machine.notes || '',
  };
}

export function isMachineReadOnly(status?: string): boolean {
  return status === 'INACTIVE' || status === 'SCRAPPED' || status === 'OUT_OF_SERVICE';
}

// R5 save gate: a machine may be saved only when a dedicated cost center exists
// (staged for a new/legacy machine, or already linked on an edited machine).
export function machineCostCenterSatisfied(form: MachineFormState, existingCcId?: string | null): boolean {
  if (form.defaultCostCenterId) return true;
  if (existingCcId) return true;
  return form.dedicatedCostCenterReady;
}

// Localized validation shared by the list modal + direct create/edit routes
// (single source of the R5 machine-name + dedicated-cost-center business rules).
export function machineFormFieldErrors(
  form: MachineFormState,
  t: (key: string) => string,
  mode: 'create' | 'edit',
  existingCcId?: string | null,
): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!form.name.trim()) errs.name = t('validation.required');
  if (mode === 'create' ? !machineCostCenterSatisfied(form) : !machineCostCenterSatisfied(form, existingCcId)) {
    errs.dedicatedCostCenter = t('maintenance.machineNeedCostCenter');
  } else if (!form.defaultCostCenterId && form.dedicatedCostCenterReady && !form.dedicatedCostCenterType) {
    // R2 rules 1 & 3: a staged dedicated cost center must have an explicit
    // classification. Only enforced on the dedicated-CC flow (not for an
    // existing linked cost center that merely lacks a type).
    errs.dedicatedCostCenter = t('maintenance.machineCostCenterTypeRequired');
  }
  return errs;
}

// Builds the nested dedicatedCostCenter payload that the backend creates
// atomically together with the machine (name always = machine name).
export function machineDedicatedCcPayload(form: MachineFormState): { name: string; type: string; description?: string } | null {
  if (!form.dedicatedCostCenterReady) return null;
  // R2 rule 1: the cost center type is a required classification. It must be
  // resolved (empty never sent - the backend rejects an unclassified center).
  if (!form.dedicatedCostCenterType) return null;
  const cc: { name: string; type: string; description?: string } = {
    name: form.name.trim(),
    type: form.dedicatedCostCenterType,
  };
  if (form.dedicatedCostCenterDescription.trim()) cc.description = form.dedicatedCostCenterDescription.trim();
  return cc;
}

interface MachineFormProps {
  form: MachineFormState;
  setForm: React.Dispatch<React.SetStateAction<MachineFormState>>;
  errors: Record<string, string>;
  mode?: 'create' | 'edit';
  isReadOnly?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  existingCostCenterName?: string;
  onFieldChange?: () => void;
}

export function MachineForm({ form, setForm, errors, mode = 'create', isReadOnly = false, status, createdAt, updatedAt, existingCostCenterName, onFieldChange }: MachineFormProps) {
  const { t, dir } = useTranslation();
  const readOnly = Boolean(isReadOnly);
  const [ccModalOpen, setCcModalOpen] = useState(false);
  const [ccTypeSuggested, setCcTypeSuggested] = useState(false);

  const setField = (field: keyof MachineFormState, value: any) => {
    if (readOnly) return;
    setForm((prev) => {
      const next: MachineFormState = { ...prev, [field]: value };
      if (field === 'companyId') {
        next.branchId = '';
        next.departmentId = '';
        next.productionLineId = '';
      }
      if (field === 'branchId') next.departmentId = '';
      return next;
    });
    onFieldChange?.();
  };

  const ccTypeLabel = (type: string) => {
    const key = `maintenance.costCenterTypes.${type}`;
    const localized = t(key);
    const fallback = dir === 'rtl' ? 'تعذر عرض النص المطلوب.' : 'The requested text could not be displayed.';
    return localized && localized !== key && localized !== fallback ? localized : type;
  };

  const hasLinkedCostCenter = Boolean(form.defaultCostCenterId);
  // R2 rule 1: a dedicated cost center is only confirmable when a classification
  // is resolved (explicit choice or a canonical OperationType suggestion).
  const ccTypeResolved =
    Boolean(form.dedicatedCostCenterType) && MACHINE_CC_TYPES.includes(form.dedicatedCostCenterType);

  // R2 rule 2 + 4: when the user picks an OperationType before staging the cost
  // center, prefill the type from the canonical map (still editable in the modal).
  const handleOperationTypeSelect = (ot: { id: string; name: string; code: string }) => {
    if (form.dedicatedCostCenterReady) return;
    const suggested = suggestCostCenterType(ot.code);
    if (suggested && !form.dedicatedCostCenterType) {
      setForm((prev) => ({ ...prev, dedicatedCostCenterType: suggested }));
      setCcTypeSuggested(true);
    }
  };

  const confirmDedicatedCostCenter = () => {
    if (!ccTypeResolved) return;
    setForm((prev) => ({ ...prev, dedicatedCostCenterReady: true }));
    setCcModalOpen(false);
    setCcTypeSuggested(false);
    onFieldChange?.();
  };

  return (
    <div className="space-y-6">
      {readOnly && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          {t('complexForms.readOnlyRecord')}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.basicInformation')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mode === 'edit' && (
            <div>
              <Input label={t('maintenance.code')} value={form.code} disabled />
              <p className="text-xs text-gray-500 mt-1">{t('common.codeImmutableHint')}</p>
            </div>
          )}
          <Input label={t('maintenance.name')} value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required disabled={readOnly} />
        </div>
        {mode === 'edit' && status && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{t('common.status')}:</span>
            <StatusBadge status={status} />
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.classification')}</h2>
      <F9Lookup label={t('maintenance.machineCategory')} value={form.categoryId} onChange={(v) => setField('categoryId', v)} adapter={machineCategoryAdapter} error={errors.categoryId} disabled={readOnly} />

      <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.organization')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setField('companyId', v)} adapter={companyAdapter} error={errors.companyId} disabled={readOnly} />
        <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setField('branchId', v)} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} error={errors.branchId} disabled={readOnly} />
        <F9Lookup label={t('core.department')} value={form.departmentId} onChange={(v) => setField('departmentId', v)} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} error={errors.departmentId} disabled={readOnly} />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('maintenance.productionLine')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <F9Lookup label={t('maintenance.productionLine')} value={form.productionLineId} onChange={(v) => setField('productionLineId', v)} adapter={productionLineAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} error={errors.productionLineId} disabled={readOnly} />
        <F9Lookup label={t('maintenance.operationType')} value={form.operationTypeId} onChange={(v) => setField('operationTypeId', v)} onItemSelect={handleOperationTypeSelect} adapter={operationTypeAdapter} error={errors.operationTypeId} disabled={readOnly} />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('maintenance.costCenters')}</h2>
      {hasLinkedCostCenter ? (
        <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
          <span className="font-medium">{t('maintenance.machineCostCenterLinked')}:</span>{' '}
          <strong>{existingCostCenterName || form.defaultCostCenterId}</strong>
        </div>
      ) : !readOnly ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-4 space-y-3">
          <p className="text-xs text-gray-500">{t('maintenance.machineCostCenterNameAuto')}</p>
          {!form.name.trim() && <p className="text-sm text-amber-600">{t('maintenance.enterMachineNameFirst')}</p>}
          {form.dedicatedCostCenterReady ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-green-600 font-medium">{t('maintenance.machineCostCenterReady')}</span>
                <span className="text-gray-500"> — {ccTypeLabel(form.dedicatedCostCenterType)}</span>
              </div>
              <Button variant="secondary" onClick={() => setCcModalOpen(true)}>{t('maintenance.editCostCenter')}</Button>
              <Button variant="secondary" onClick={() => setForm((prev) => ({ ...prev, dedicatedCostCenterReady: false }))}>{t('maintenance.removeMachineCostCenter')}</Button>
            </div>
          ) : (
            <Button disabled={!form.name.trim()} onClick={() => setCcModalOpen(true)}>{t('maintenance.createMachineCostCenter')}</Button>
          )}
          {errors.dedicatedCostCenter && <p className="text-red-500 text-sm">{errors.dedicatedCostCenter}</p>}
        </div>
      ) : null}

      <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.technicalInformation')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label={t('maintenance.model')} value={form.model} onChange={(e) => setField('model', e.target.value)} disabled={readOnly} />
        <Input label={t('maintenance.serialNumber')} value={form.serialNumber} onChange={(e) => setField('serialNumber', e.target.value)} disabled={readOnly} />
        <Input label={t('maintenance.manufacturer')} value={form.manufacturer} onChange={(e) => setField('manufacturer', e.target.value)} disabled={readOnly} />
      </div>
      <Input label={t('maintenance.location')} value={form.location} onChange={(e) => setField('location', e.target.value)} disabled={readOnly} />
      <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} disabled={readOnly} />

      {mode === 'edit' && (createdAt || updatedAt) && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.metadata')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            {createdAt && <div><span className="font-medium">{t('common.createdAt')}:</span> {new Date(createdAt).toLocaleString()}</div>}
            {updatedAt && <div><span className="font-medium">{t('common.updatedAt')}:</span> {new Date(updatedAt).toLocaleString()}</div>}
          </div>
        </div>
      )}

      <Modal open={ccModalOpen} onClose={() => setCcModalOpen(false)} title={t('maintenance.createMachineCostCenter')} size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">{t('maintenance.machineCostCenterNameAuto')}</p>
          <Input label={t('maintenance.name')} value={form.name} disabled />
          {ccTypeSuggested && <p className="text-xs text-blue-600">{t('maintenance.machineCostCenterTypeSuggested')}</p>}
          <Select
            label={t('maintenance.type')}
            value={form.dedicatedCostCenterType}
            placeholder={t('maintenance.selectMachineCostCenterType')}
            onChange={(e) => { setForm((prev) => ({ ...prev, dedicatedCostCenterType: e.target.value })); setCcTypeSuggested(false); }}
            options={MACHINE_CC_TYPES.map((type) => ({ value: type, label: ccTypeLabel(type) }))}
          />
          <Input label={t('maintenance.description')} value={form.dedicatedCostCenterDescription} onChange={(e) => setForm((prev) => ({ ...prev, dedicatedCostCenterDescription: e.target.value }))} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setCcModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={confirmDedicatedCostCenter} disabled={!ccTypeResolved}>{t('actions.confirm')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
