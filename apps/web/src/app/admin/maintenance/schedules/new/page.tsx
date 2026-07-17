'use client';
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Select, Textarea, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, machineAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

const TYPE_OPTIONS = [
  { value: 'PREVENTIVE', label: 'PREVENTIVE' },
  { value: 'CORRECTIVE', label: 'CORRECTIVE' },
  { value: 'PREDICTIVE', label: 'PREDICTIVE' },
  { value: 'CALIBRATION', label: 'CALIBRATION' },
];

const FREQ_OPTIONS = [
  { value: 'DAILY', label: 'DAILY' },
  { value: 'WEEKLY', label: 'WEEKLY' },
  { value: 'MONTHLY', label: 'MONTHLY' },
  { value: 'YEARLY', label: 'YEARLY' },
  { value: 'ONCE', label: 'ONCE' },
];

export default function CreateMaintenanceSchedulePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ machineId: '', title: '', maintenanceType: 'PREVENTIVE', frequency: 'MONTHLY', intervalValue: 0, startDate: '', endDate: '', description: '' });
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
    if (!form.machineId) errs.machineId = t('complexForms.requiredField');
    if (!form.title.trim()) errs.title = t('complexForms.requiredField');
    if (!form.startDate) errs.startDate = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { machineId: form.machineId, title: form.title.trim(), maintenanceType: form.maintenanceType, frequency: form.frequency, startDate: form.startDate };
      if (form.intervalValue > 0) payload.intervalValue = form.intervalValue;
      if (form.endDate) payload.endDate = form.endDate;
      if (form.description) payload.description = form.description.trim();
      const res = await api.post<{ data: { id: string } }>('/maintenance/schedules', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/maintenance/schedules/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ machineId: '', title: '', maintenanceType: 'PREVENTIVE', frequency: 'MONTHLY', intervalValue: 0, startDate: '', endDate: '', description: '' }); setErrors({}); setDirty(false); },
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
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('maintenance.scheduleInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.title')} value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} required />
              <Select label={t('maintenance.maintenanceType')} value={form.maintenanceType} onChange={(e) => setField('maintenanceType', e.target.value)} options={TYPE_OPTIONS} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('maintenance.frequency')} value={form.frequency} onChange={(e) => setField('frequency', e.target.value)} options={FREQ_OPTIONS} />
              <Input label={t('maintenance.intervalDays')} type="number" value={String(form.intervalValue)} onChange={(e) => setField('intervalValue', parseInt(e.target.value) || 0)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.startDate')} type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} error={errors.startDate} required />
              <Input label={t('maintenance.endDate')} type="date" value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} />
            </div>
            <Textarea label={t('maintenance.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('maintenance.machine')}</h2>
            <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setField('machineId', v)} adapter={machineAdapter} error={errors.machineId} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
