'use client';
import React, { useState } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useErrorModal } from '../../../../../components/admin/error-modal';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../../lib/form-validation';
import { useRouter } from 'next/navigation';
import { Input, Button, Textarea } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateRolePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const { showError } = useErrorModal();
  const handleApiError = useApiErrorHandler();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => setErrors((prev) => ({ ...prev, [field]: '' }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!code.trim()) next.code = t('validation.required');
    if (!name.trim()) next.name = t('validation.required');
    setErrors(next);
    focusFirstInvalidField(
      Object.keys(next).map((field) => ({ field, message: next[field] })),
    );
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/roles', { code: code.trim(), name: name.trim(), description: description.trim() || undefined });
      showToast(t('access.createRoleSuccess'), 'success');
      router.push('/admin/access/roles');
    } catch (err) {
      const config = handleApiError(err, { dialog: false });
      if (config.errors?.length) {
        setErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      } else {
        showError(config);
      }
    } finally {
      setSaving(false);
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/access/roles'),
    save: () => handleSave(),
    cancel: () => router.push('/admin/access/roles'),
    refresh: () => {},
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'actions.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('access.createRole')}</h1>
      <div className="space-y-4 bg-white rounded-lg border p-6">
        <Input label={t('access.roleCode')} name="code" value={code} onChange={(e) => { setCode(e.target.value); clearError('code'); }} error={errors.code} placeholder="e.g. MANAGER" required />
        <Input label={t('access.roleName')} name="name" value={name} onChange={(e) => { setName(e.target.value); clearError('name'); }} error={errors.name} placeholder="e.g. Manager" required />
        <Textarea label={t('common.description')} name="description" value={description} onChange={(e) => { setDescription(e.target.value); clearError('description'); }} error={errors.description} />
        <div className="flex gap-3 pt-4">
          <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('access.createRole')}</Button>
          <Button variant="ghost" onClick={() => router.push('/admin/access/roles')}>{t('actions.cancel')}</Button>
        </div>
      </div>
    </div>
  );
}
