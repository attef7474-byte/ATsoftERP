'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { useRouter, useParams } from 'next/navigation';
import { Input, Button } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../../components/admin/admin-action-bar';

export default function EditRolePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSystem, setIsSystem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchRole = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/roles/${params.id}`);
      const role = res.data;
      setCode(role.code);
      setName(role.name);
      setDescription(role.description ?? '');
      setIsSystem(role.isSystem);
    } catch (err: any) {
      showToast(err?.message || t('access.loadFailed'), 'error');
    } finally { setLoading(false); }
  }, [params.id, t, showToast]);

  useEffect(() => { fetchRole(); }, [fetchRole]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!code.trim()) next.code = t('validation.required');
    if (!name.trim()) next.name = t('validation.required');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || isSystem) return;
    setSaving(true);
    try {
      await api.patch(`/roles/${params.id}`, { code: code.trim(), name: name.trim(), description: description.trim() || undefined });
      showToast(t('access.updateRoleSuccess'), 'success');
      router.push(`/admin/access/roles/${params.id}`);
    } catch (err: any) {
      showToast(err?.message || t('access.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.push(`/admin/access/roles/${params.id}`),
    save: () => handleSave(),
    cancel: () => router.push(`/admin/access/roles/${params.id}`),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'actions.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !(saving || isSystem) },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  if (loading) return <div className="p-6"><p>{t('common.loading')}</p></div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('access.editRole')}</h1>

      {isSystem && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"><p className="text-yellow-800 text-sm">{t('access.superAdminProtected')}</p></div>}

      <div className="space-y-4 bg-white rounded-lg border p-6">
        <Input label={t('access.roleCode')} value={code} onChange={(e) => setCode(e.target.value)} error={errors.code} disabled={isSystem} />
        <Input label={t('access.roleName')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} disabled={isSystem} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
          <textarea className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSystem} />
        </div>
        <div className="flex gap-3 pt-4">
          <Button onClick={handleSave} disabled={saving || isSystem}>{saving ? t('common.saving') : t('actions.save')}</Button>
          <Button variant="ghost" onClick={() => router.push(`/admin/access/roles/${params.id}`)}>{t('actions.cancel')}</Button>
        </div>
      </div>
    </div>
  );
}
