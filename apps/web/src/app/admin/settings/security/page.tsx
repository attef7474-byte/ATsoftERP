'use client';
import React, { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, PageHeader, LoadingState, ErrorState } from '../../../../components/admin/ui';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionSaveIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function SecuritySettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const router = useRouter();
  const [settings, setSettings] = useState({
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumber: true,
    passwordRequireSymbol: true,
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    lockoutMinutes: 15,
    twoFactorEnabledDefault: false,
    auditSensitiveActions: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<typeof settings>('/settings/security');
        setSettings(res);
      } catch (loadError) {
        const config = handleApiError(loadError);
        setError(config.message);
      } finally { setLoading(false); }
    })();
  }, [handleApiError]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/settings/security', settings);
      showToast(t('settings.security.saveSuccess'), 'success');
    } catch (err: any) {
      handleApiError(err);
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({ save: () => handleSave(), back: () => router.back() });
  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'common.save', icon: <ActionSaveIcon />, onClick: () => exec('save') },
  ]);

  if (loading) return <LoadingState message={t('settings.security.loading')} />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div>
      <PageHeader title={t('settings.security.title')} />
      <Card className="max-w-lg">
        <div className="space-y-4 p-4">
          <h3 className="text-sm font-semibold text-gray-700">{t('settings.security.passwordPolicy')}</h3>
          <Input label={t('settings.security.minLength')} min={8} max={64} type="number" value={settings.passwordMinLength} onChange={(e) => setSettings({ ...settings, passwordMinLength: parseInt(e.target.value, 10) || 8 })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.passwordRequireUppercase} onChange={(e) => setSettings({ ...settings, passwordRequireUppercase: e.target.checked })} />
            {t('settings.security.requireUppercase')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.passwordRequireLowercase} onChange={(e) => setSettings({ ...settings, passwordRequireLowercase: e.target.checked })} />
            {t('settings.security.requireLowercase')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.passwordRequireNumber} onChange={(e) => setSettings({ ...settings, passwordRequireNumber: e.target.checked })} />
            {t('settings.security.requireNumbers')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.passwordRequireSymbol} onChange={(e) => setSettings({ ...settings, passwordRequireSymbol: e.target.checked })} />
            {t('settings.security.requireSpecialChars')}
          </label>
          <hr />
          <h3 className="text-sm font-semibold text-gray-700">{t('settings.security.twoFactorAuth')}</h3>
          <Select label={t('common.status')} value={settings.twoFactorEnabledDefault ? 'enabled' : 'disabled'} onChange={(e) => setSettings({ ...settings, twoFactorEnabledDefault: e.target.value === 'enabled' })}
            options={[{ value: 'enabled', label: t('settings.security.enabled') }, { value: 'disabled', label: t('settings.security.disabled') }]} />
          <Input label={t('settings.security.sessionTimeout')} min={5} max={1440} type="number" value={settings.sessionTimeoutMinutes} onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value, 10) || 60 })} />
          <Input label={t('settings.security.maxLoginAttempts')} min={3} max={20} type="number" value={settings.maxLoginAttempts} onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value, 10) || 5 })} />
          <Input label={t('settings.security.lockoutDuration')} min={1} max={1440} type="number" value={settings.lockoutMinutes} onChange={(e) => setSettings({ ...settings, lockoutMinutes: parseInt(e.target.value, 10) || 15 })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => router.back()}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
