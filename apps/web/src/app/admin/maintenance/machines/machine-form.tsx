'use client';
import React, { Dispatch, SetStateAction } from 'react';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { Input, Textarea, StatusBadge } from '../../../../components/admin/ui';
import { F9Lookup, machineCategoryAdapter, companyAdapter, branchAdapter, departmentAdapter, productionLineAdapter, operationTypeAdapter, costCenterAdapter, administrationAdapter } from '../../../../components/f9';
import type { Machine } from '../../../../lib/admin-types';

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
  technicalAdministrationId: string;
  technicalDepartmentId: string;
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
  technicalAdministrationId: '',
  technicalDepartmentId: '',
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
    technicalAdministrationId: machine.technicalAdministrationId || '',
    technicalDepartmentId: machine.technicalDepartmentId || '',
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

interface MachineFormProps {
  form: MachineFormState;
  setForm: Dispatch<SetStateAction<MachineFormState>>;
  errors: Record<string, string>;
  mode?: 'create' | 'edit';
  isReadOnly?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  onFieldChange?: () => void;
}

export function MachineForm({ form, setForm, errors, mode = 'create', isReadOnly = false, status, createdAt, updatedAt, onFieldChange }: MachineFormProps) {
  const { t } = useTranslation();
  const readOnly = Boolean(isReadOnly);

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
      if (field === 'technicalAdministrationId') next.technicalDepartmentId = '';
      return next;
    });
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
        <F9Lookup label={t('maintenance.operationType')} value={form.operationTypeId} onChange={(v) => setField('operationTypeId', v)} adapter={operationTypeAdapter} error={errors.operationTypeId} disabled={readOnly} />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('maintenance.technicalAdministration')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <F9Lookup label={t('maintenance.technicalAdministration')} value={form.technicalAdministrationId} onChange={(v) => setField('technicalAdministrationId', v)} adapter={administrationAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} error={errors.technicalAdministrationId} disabled={readOnly} />
        <F9Lookup label={t('maintenance.technicalDepartment')} value={form.technicalDepartmentId} onChange={(v) => setField('technicalDepartmentId', v)} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}), ...(form.technicalAdministrationId ? { administrationId: form.technicalAdministrationId } : {}) }} error={errors.technicalDepartmentId} disabled={readOnly} />
      </div>
      <F9Lookup label={t('maintenance.defaultCostCenter')} value={form.defaultCostCenterId} onChange={(v) => setField('defaultCostCenterId', v)} adapter={costCenterAdapter} filters={{ ...(form.technicalAdministrationId ? { administrationId: form.technicalAdministrationId } : {}) }} error={errors.defaultCostCenterId} disabled={readOnly} />

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
    </div>
  );
}
