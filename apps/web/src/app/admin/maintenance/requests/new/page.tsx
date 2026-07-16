'use client';
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Select, Textarea, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, machineAdapter, userAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

const REQUEST_TYPES = [
  { value: 'CORRECTIVE', label: 'Corrective' },
  { value: 'PREVENTIVE', label: 'Preventive' },
  { value: 'PREDICTIVE', label: 'Predictive' },
  { value: 'EMERGENCY', label: 'Emergency' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function CreateMaintenanceRequestPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ machineId: '', type: 'CORRECTIVE', priority: 'MEDIUM', title: '', description: '', assignedToId: '', notes: '' });
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
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { machineId: form.machineId, type: form.type, title: form.title.trim() };
      if (form.priority) payload.priority = form.priority;
      if (form.description) payload.description = form.description.trim();
      if (form.assignedToId) payload.assignedToId = form.assignedToId;
      if (form.notes) payload.notes = form.notes.trim();
      const res = await api.post<{ data: { id: string } }>('/maintenance/requests', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/maintenance/requests/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ machineId: '', type: 'CORRECTIVE', priority: 'MEDIUM', title: '', description: '', assignedToId: '', notes: '' }); setErrors({}); setDirty(false); },
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
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.requestInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.title')} value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} required />
              <Select label={t('maintenance.type')} value={form.type} onChange={(e) => setField('type', e.target.value)} options={REQUEST_TYPES} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('maintenance.priority')} value={form.priority} onChange={(e) => setField('priority', e.target.value)} options={PRIORITY_OPTIONS} />
            </div>
            <Textarea label={t('maintenance.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('maintenance.machine')}</h2>
            <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setField('machineId', v)} adapter={machineAdapter} error={errors.machineId} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.assignment')}</h2>
            <F9Lookup label={t('maintenance.assignedTo')} value={form.assignedToId} onChange={(v) => setField('assignedToId', v)} adapter={userAdapter} />
            <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
