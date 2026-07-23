'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import type { MachineComponent } from '../../../../../lib/admin-types';
import { Card, CardContent, Input, Select, PageHeader, Button, LoadingState, ErrorState } from '../../../../../components/admin/ui';
import { F9Lookup, machineComponentAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionSaveIcon, ActionCancelIcon, ActionBackIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateMachineComponentPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
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
    if (!form.code.trim()) errs.code = t('complexForms.requiredField');
    if (!form.name.trim()) errs.name = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { code: form.code.trim(), name: form.name.trim() };
      if (form.description) payload.description = form.description.trim();
      if (form.componentType) payload.componentType = form.componentType;
      if (form.criticality) payload.criticality = form.criticality;
      if (form.locationInMachine) payload.locationInMachine = form.locationInMachine.trim();
      if (form.manufacturer) payload.manufacturer = form.manufacturer.trim();
      if (form.model) payload.model = form.model.trim();
      if (form.serialNumber) payload.serialNumber = form.serialNumber.trim();
      if (form.parentComponentId) payload.parentComponentId = form.parentComponentId;
      const res = await api.post<MachineComponent>('/maintenance/machine-components', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/maintenance/machine-components/${res.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    save: () => handleSave(),
    cancel: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.push('/admin/maintenance/machine-components'); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  const componentTypeOptions = [
    { value: 'MECHANICAL', label: 'Mechanical' },
    { value: 'ELECTRICAL', label: 'Electrical' },
    { value: 'CONTROL', label: 'Control' },
    { value: 'PNEUMATIC', label: 'Pneumatic' },
    { value: 'HYDRAULIC', label: 'Hydraulic' },
    { value: 'HEATING', label: 'Heating' },
    { value: 'COOLING', label: 'Cooling' },
    { value: 'SENSOR', label: 'Sensor' },
    { value: 'SAFETY', label: 'Safety' },
    { value: 'CONVEYOR', label: 'Conveyor' },
    { value: 'FRAME', label: 'Frame' },
    { value: 'UTILITY', label: 'Utility' },
    { value: 'OTHER', label: 'Other' },
  ];

  const criticalityOptions = [
    { value: 'LOW', label: t('common.LOW') },
    { value: 'MEDIUM', label: t('common.MEDIUM') },
    { value: 'HIGH', label: t('common.HIGH') },
    { value: 'CRITICAL', label: t('common.CRITICAL') },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.basicInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.components.form.code')} value={form.code} onChange={(e) => setField('code', e.target.value)} error={errors.code} required />
              <Input label={t('maintenance.components.form.name')} value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required />
              <Select label={t('maintenance.components.form.componentType')} value={form.componentType} onChange={(e) => setField('componentType', e.target.value)} options={componentTypeOptions} placeholder={t('common.selectPlaceholder')} />
              <Select label={t('maintenance.components.form.criticality')} value={form.criticality} onChange={(e) => setField('criticality', e.target.value)} options={criticalityOptions} placeholder={t('common.selectPlaceholder')} />
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
