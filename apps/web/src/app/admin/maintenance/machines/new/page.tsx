'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Card, CardContent } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../../lib/form-validation';
import { MachineForm, MachineFormState, createMachineForm } from '../machine-form';

export default function CreateMachinePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [form, setForm] = useState<MachineFormState>(createMachineForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('validation.required');
    setErrors(errs);
    focusFirstInvalidField(Object.entries(errs).map(([field, message]) => ({ field, code: 'validation.required', message })));
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { name: form.name.trim() };
      if (form.categoryId) payload.categoryId = form.categoryId;
      if (form.companyId) payload.companyId = form.companyId;
      if (form.branchId) payload.branchId = form.branchId;
      if (form.departmentId) payload.departmentId = form.departmentId;
      if (form.productionLineId) payload.productionLineId = form.productionLineId;
      if (form.operationTypeId) payload.operationTypeId = form.operationTypeId;
      if (form.defaultCostCenterId) payload.defaultCostCenterId = form.defaultCostCenterId;
      if (form.technicalAdministrationId) payload.technicalAdministrationId = form.technicalAdministrationId;
      if (form.technicalDepartmentId) payload.technicalDepartmentId = form.technicalDepartmentId;
      if (form.model.trim()) payload.model = form.model.trim();
      if (form.serialNumber.trim()) payload.serialNumber = form.serialNumber.trim();
      if (form.manufacturer.trim()) payload.manufacturer = form.manufacturer.trim();
      if (form.location.trim()) payload.location = form.location.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();
      const res = await api.post<{ id: string }>('/maintenance/machines', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/maintenance/machines/${res.id}`);
    } catch (err: any) {
      const config = handleApiError(err);
      if (config.errors?.length) {
        setErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      }
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm(createMachineForm()); setErrors({}); setDirty(false); },
    save: () => handleSave(),
    cancel: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <MachineForm form={form} setForm={setForm} errors={errors} mode="create" onFieldChange={() => setDirty(true)} />
        </CardContent>
      </Card>
    </div>
  );
}
