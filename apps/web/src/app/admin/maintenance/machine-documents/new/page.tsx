'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, machineAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateMachineDocumentPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    fileName: '', fileUrl: '', fileSize: 0, mimeType: '',
    description: '', machineId: '',
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
    if (!form.fileName.trim()) errs.fileName = t('complexForms.requiredField');
    if (!form.fileUrl.trim()) errs.fileUrl = t('complexForms.requiredField');
    if (!form.machineId) errs.machineId = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        fileName: form.fileName.trim(),
        fileUrl: form.fileUrl.trim(),
        fileSize: form.fileSize,
        mimeType: form.mimeType.trim() || undefined,
        machineId: form.machineId,
      };
      if (form.description) payload.description = form.description.trim();
      const res = await api.post<{ data: { id: string } }>('/maintenance/machine-documents', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/maintenance/machine-documents/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ fileName: '', fileUrl: '', fileSize: 0, mimeType: '', description: '', machineId: '' }); setErrors({}); setDirty(false); },
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
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.basicInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.fileName')} value={form.fileName} onChange={(e) => setField('fileName', e.target.value)} error={errors.fileName} required />
              <Input label={t('maintenance.fileUrl')} value={form.fileUrl} onChange={(e) => setField('fileUrl', e.target.value)} error={errors.fileUrl} required />
              <Input label={t('maintenance.fileSize')} type="number" value={String(form.fileSize)} onChange={(e) => setField('fileSize', parseInt(e.target.value) || 0)} />
              <Input label={t('maintenance.mimeType')} value={form.mimeType} onChange={(e) => setField('mimeType', e.target.value)} />
            </div>
            <Textarea label={t('common.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.linkedEntities')}</h2>
          <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setField('machineId', v)} adapter={machineAdapter} error={errors.machineId} />
        </CardContent>
      </Card>
    </div>
  );
}
