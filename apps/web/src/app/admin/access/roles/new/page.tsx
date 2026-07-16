'use client';
import React, { useState } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter } from 'next/navigation';
import { Input, Button } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateRolePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const next: Record<string, string> = {};
    if (!code.trim()) next.code = t('validation.required');
    if (!name.trim()) next.name = t('validation.required');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/roles', { code: code.trim(), name: name.trim(), description: description.trim() || undefined });
      showToast(t('access.createRoleSuccess'), 'success');
      router.push('/admin/access/roles');
    } catch (err: any) {
      showToast(err?.message || t('access.createFailed'), 'error');
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
        <Input label={t('access.roleCode')} value={code} onChange={(e) => setCode(e.target.value)} error={errors.code} placeholder="e.g. MANAGER" required />
        <Input label={t('access.roleName')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Manager" required />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
          <textarea
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('common.description') || ''}
          />
        </div>
        <div className="flex gap-3 pt-4">
          <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('access.createRole')}</Button>
          <Button variant="ghost" onClick={() => router.push('/admin/access/roles')}>{t('actions.cancel')}</Button>
        </div>
      </div>
    </div>
  );
}
