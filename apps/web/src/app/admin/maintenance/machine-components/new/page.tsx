'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Card, CardContent, Input, Select } from '../../../../../components/admin/ui';
import { F9Lookup, machineComponentAdapter, machineAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionSaveIcon, ActionCancelIcon, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../../lib/form-validation';

const COMPONENT_TYPE_KEYS: { value: string; labelKey: string }[] = [
  { value: 'MECHANICAL', labelKey: 'maintenance.componentTypeOptions.MECHANICAL' },
  { value: 'ELECTRICAL', labelKey: 'maintenance.componentTypeOptions.ELECTRICAL' },
  { value: 'CONTROL', labelKey: 'maintenance.componentTypeOptions.CONTROL' },
  { value: 'PNEUMATIC', labelKey: 'maintenance.componentTypeOptions.PNEUMATIC' },
  { value: 'HYDRAULIC', labelKey: 'maintenance.componentTypeOptions.HYDRAULIC' },
  { value: 'HEATING', labelKey: 'maintenance.componentTypeOptions.HEATING' },
  { value: 'COOLING', labelKey: 'maintenance.componentTypeOptions.COOLING' },
  { value: 'SENSOR', labelKey: 'maintenance.componentTypeOptions.SENSOR' },
  { value: 'SAFETY', labelKey: 'maintenance.componentTypeOptions.SAFETY' },
  { value: 'CONVEYOR', labelKey: 'maintenance.componentTypeOptions.CONVEYOR' },
  { value: 'FRAME', labelKey: 'maintenance.componentTypeOptions.FRAME' },
  { value: 'UTILITY', labelKey: 'maintenance.componentTypeOptions.UTILITY' },
  { value: 'OTHER', labelKey: 'maintenance.componentTypeOptions.OTHER' },
];

const CRITICALITY_KEYS: { value: string; labelKey: string }[] = [
  { value: 'LOW', labelKey: 'maintenance.criticalityOptions.LOW' },
  { value: 'MEDIUM', labelKey: 'maintenance.criticalityOptions.MEDIUM' },
  { value: 'HIGH', labelKey: 'maintenance.criticalityOptions.HIGH' },
  { value: 'CRITICAL', labelKey: 'maintenance.criticalityOptions.CRITICAL' },
];

export default function CreateMachineComponentPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    componentType: '',
    criticality: '',
    locationInMachine: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    parentComponentId: '',
    machineId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const setField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = t('validation.required');
    if (!form.name.trim()) errs.name = t('validation.required');
    if (!form.componentType) errs.componentType = t('validation.required');
    if (!form.machineId) errs.machineId = t('validation.required');
    setErrors(errs);
    focusFirstInvalidField(Object.entries(errs).map(([field, message]) => ({ field, code: 'validation.required', message })));
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { code: form.code.trim(), name: form.name.trim(), componentType: form.componentType, machineId: form.machineId };
      if (form.criticality) payload.criticality = form.criticality;
      if (form.description) payload.description = form.description.trim();
      if (form.locationInMachine) payload.locationInMachine = form.locationInMachine.trim();
      if (form.manufacturer) payload.manufacturer = form.manufacturer.trim();
      if (form.model) payload.model = form.model.trim();
      if (form.serialNumber) payload.serialNumber = form.serialNumber.trim();
      if (form.parentComponentId) payload.parentComponentId = form.parentComponentId;
      const res = await api.post<{ id: string }>('/maintenance/machine-components', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/maintenance/machine-components/${res.id}`);
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
    refresh: () => { setForm({ code: '', name: '', description: '', componentType: '', criticality: '', locationInMachine: '', manufacturer: '', model: '', serialNumber: '', parentComponentId: '', machineId: '' }); setErrors({}); setDirty(false); },
    save: () => handleSave(),
    cancel: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.push('/admin/maintenance/machine-components'); },
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
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.basicInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.components.form.code')} name="code" value={form.code} onChange={(e) => setField('code', e.target.value)} error={errors.code} required />
              <Input label={t('maintenance.components.form.name')} name="name" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required />
              <div>
                <Select label={t('maintenance.components.form.componentType')} value={form.componentType} onChange={(e) => setField('componentType', e.target.value)} options={COMPONENT_TYPE_KEYS.map(o => ({ value: o.value, label: t(o.labelKey) }))} placeholder={t('common.selectPlaceholder')} required />
                {errors.componentType && <p className="text-red-500 text-sm mt-1">{errors.componentType}</p>}
              </div>
              <div>
                <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setField('machineId', v)} adapter={machineAdapter} />
                {errors.machineId && <p className="text-red-500 text-sm mt-1">{errors.machineId}</p>}
              </div>
              <Select label={t('maintenance.components.form.criticality')} value={form.criticality} onChange={(e) => setField('criticality', e.target.value)} options={CRITICALITY_KEYS.map(o => ({ value: o.value, label: t(o.labelKey) }))} placeholder={t('common.selectPlaceholder')} />
              <Input label={t('maintenance.components.form.locationInMachine')} value={form.locationInMachine} onChange={(e) => setField('locationInMachine', e.target.value)} />
              <Input label={t('maintenance.components.form.manufacturer')} value={form.manufacturer} onChange={(e) => setField('manufacturer', e.target.value)} />
              <Input label={t('maintenance.components.form.model')} value={form.model} onChange={(e) => setField('model', e.target.value)} />
              <Input label={t('maintenance.components.form.serialNumber')} value={form.serialNumber} onChange={(e) => setField('serialNumber', e.target.value)} />
            </div>
            <Input label={t('maintenance.components.form.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} />
            <F9Lookup label={t('maintenance.parentComponent')} value={form.parentComponentId} onChange={(v) => setField('parentComponentId', v)} adapter={machineComponentAdapter} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
