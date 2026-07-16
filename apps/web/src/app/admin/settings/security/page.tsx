'use client';
import React, { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, PageHeader, LoadingState } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionSaveIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function SecuritySettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [settings, setSettings] = useState<any>({ minLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: false, maxAgeDays: 90, twoFactorEnabled: false, sessionTimeout: 30, maxLoginAttempts: 5, lockoutDuration: 15 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<any>('/settings/security');
        setSettings(res);
      } catch { /* use defaults */ } finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/settings/security', settings);
      showToast(t('settings.security.saveSuccess'), 'success');
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({ save: () => handleSave(), back: () => router.back() });
  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'common.save', icon: <ActionSaveIcon />, onClick: () => exec('save') },
  ]);

  if (loading) return <LoadingState message={t('settings.security.loading')} />;

  return (
    <div>
      <PageHeader title={t('settings.security.title')} />
      <Card className="max-w-lg">
        <div className="space-y-4 p-4">
          <h3 className="text-sm font-semibold text-gray-700">{t('settings.security.passwordPolicy')}</h3>
          <Input label={t('settings.security.minLength')} type="number" value={settings.minLength} onChange={(e) => setSettings({ ...settings, minLength: parseInt(e.target.value) || 8 })} />
          {['requireUppercase', 'requireLowercase', 'requireNumbers', 'requireSpecialChars'].map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} />
              {t(`settings.security.${key}`)}
            </label>
          ))}
          <Input label={t('settings.security.maxAgeDays')} type="number" value={settings.maxAgeDays} onChange={(e) => setSettings({ ...settings, maxAgeDays: parseInt(e.target.value) || 90 })} />
          <hr />
          <h3 className="text-sm font-semibold text-gray-700">{t('settings.security.twoFactorAuth')}</h3>
          <Select label={t('common.status')} value={settings.twoFactorEnabled ? 'enabled' : 'disabled'} onChange={(e) => setSettings({ ...settings, twoFactorEnabled: e.target.value === 'enabled' })}
            options={[{ value: 'enabled', label: t('settings.security.enabled') }, { value: 'disabled', label: t('settings.security.disabled') }]} />
          <Input label={t('settings.security.sessionTimeout')} type="number" value={settings.sessionTimeout} onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 30 })} />
          <Input label={t('settings.security.maxLoginAttempts')} type="number" value={settings.maxLoginAttempts} onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) || 5 })} />
          <Input label={t('settings.security.lockoutDuration')} type="number" value={settings.lockoutDuration} onChange={(e) => setSettings({ ...settings, lockoutDuration: parseInt(e.target.value) || 15 })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => router.back()}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
