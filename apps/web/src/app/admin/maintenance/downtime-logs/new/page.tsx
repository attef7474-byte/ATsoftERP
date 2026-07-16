'use client';
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, machineAdapter, maintenanceRequestAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateDowntimeLogPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ machineId: '', requestId: '', startTime: new Date().toISOString().slice(0, 16), reason: '', notes: '' });
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
    if (!form.reason.trim()) errs.reason = t('complexForms.requiredField');
    if (!form.startTime) errs.startTime = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { machineId: form.machineId, reason: form.reason.trim(), startTime: new Date(form.startTime).toISOString() };
      if (form.requestId) payload.requestId = form.requestId;
      if (form.notes) payload.notes = form.notes.trim();
      const res = await api.post('/maintenance/downtime-logs', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/maintenance/downtime-logs`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ machineId: '', requestId: '', startTime: new Date().toISOString().slice(0, 16), reason: '', notes: '' }); setErrors({}); setDirty(false); },
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
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.downtimeInformation')}</h2>
            <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setField('machineId', v)} adapter={machineAdapter} error={errors.machineId} />
            <F9Lookup label={t('maintenance.maintenanceRequest')} value={form.requestId} onChange={(v) => setField('requestId', v)} adapter={maintenanceRequestAdapter} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('inventoryCounting.startedAt')} type="datetime-local" value={form.startTime} onChange={(e) => setField('startTime', e.target.value)} error={errors.startTime} required />
            </div>

            <Input label={t('maintenance.reason')} value={form.reason} onChange={(e) => setField('reason', e.target.value)} error={errors.reason} required />
            <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
