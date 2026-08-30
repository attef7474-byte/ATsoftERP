'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Card, CardContent, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon, ActionViewIcon } from '../../../../../../components/admin/admin-action-bar';
import type { Machine } from '../../../../../../lib/admin-types';
import { useApiErrorHandler } from '../../../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../../../lib/form-validation';
import { MachineForm, MachineFormState, mapMachineToForm, createMachineForm, isMachineReadOnly, machineFormFieldErrors, machineDedicatedCcPayload } from '../../machine-form';

export default function EditMachinePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const id = params?.id as string;
  const [data, setData] = useState<Machine | null>(null);
  const [form, setForm] = useState<MachineFormState>(createMachineForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isReadOnly = data ? isMachineReadOnly(data.status) : false;

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/maintenance/machines/${id}`);
      const item = res;
      setData(item);
      setForm(mapMachineToForm(item));
    } catch (err: any) {
      handleApiError(err);
      setError(err?.message || t('complexForms.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t, handleApiError]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const validate = () => {
    const errs = machineFormFieldErrors(form, t, 'edit', data?.defaultCostCenterId);
    setErrors(errs);
    focusFirstInvalidField(Object.entries(errs).map(([field, message]) => ({ field, code: 'validation.required', message })));
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (isReadOnly || !validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (form.name.trim() !== data?.name) payload.name = form.name.trim();
      if (form.categoryId !== data?.categoryId) payload.categoryId = form.categoryId || null;
      if (form.companyId !== data?.companyId) payload.companyId = form.companyId || null;
      if (form.branchId !== data?.branchId) payload.branchId = form.branchId || null;
      if (form.departmentId !== data?.departmentId) payload.departmentId = form.departmentId || null;
      if (form.productionLineId !== data?.productionLineId) payload.productionLineId = form.productionLineId || null;
      if (form.operationTypeId !== data?.operationTypeId) payload.operationTypeId = form.operationTypeId || null;
      if (!data?.defaultCostCenterId) {
        const dedicatedCostCenter = machineDedicatedCcPayload(form);
        if (dedicatedCostCenter) payload.dedicatedCostCenter = dedicatedCostCenter;
      }
      if (form.model !== data?.model) payload.model = form.model.trim() || null;
      if (form.serialNumber !== data?.serialNumber) payload.serialNumber = form.serialNumber.trim() || null;
      if (form.manufacturer !== data?.manufacturer) payload.manufacturer = form.manufacturer.trim() || null;
      if (form.location !== data?.location) payload.location = form.location.trim() || null;
      if (form.notes !== data?.notes) payload.notes = form.notes.trim() || null;
      await api.patch(`/maintenance/machines/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/maintenance/machines/${id}`);
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
    refresh: () => fetchData(),
    save: () => handleSave(),
    saveAndView: () => handleSave(),
    cancel: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving && !isReadOnly },
    { id: 'saveAndView', labelKey: 'complexForms.saveAndView', icon: <ActionViewIcon />, onClick: () => exec('saveAndView'), enabled: !saving && !isReadOnly },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('complexForms.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('complexForms.editMachine')}</h1>
              <p className="text-sm text-gray-500">[{data.code}] {data.name}</p>
            </div>
            {data.status && <StatusBadge status={data.status} />}
          </div>
          <MachineForm
            form={form}
            setForm={setForm}
            errors={errors}
            mode="edit"
            isReadOnly={isReadOnly}
            status={data.status}
            createdAt={data.createdAt}
            updatedAt={data.updatedAt}
            existingCostCenterName={data.defaultCostCenter?.name}
            onFieldChange={() => setDirty(true)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
