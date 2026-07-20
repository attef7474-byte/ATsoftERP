'use client';
import React, { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Select, Input, Card, PageHeader, LoadingState } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionSaveIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function AppearanceSettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [settings, setSettings] = useState<any>({ theme: 'light', primaryColor: '#3b82f6', fontSize: 'medium', compactMode: false, sidebarCollapsed: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<any>('/settings/appearance');
        setSettings(res);
      } catch { /* use defaults */ } finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { theme, primaryColor, fontSize, sidebarCollapsed, ...rest } = settings;
      const payload = {
        themeMode: theme,
        accentColor: primaryColor,
        compactMode: rest.compactMode,
      };
      await api.patch('/settings/appearance', payload);
      showToast(t('settings.appearance.saveSuccess'), 'success');
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({ save: () => handleSave(), back: () => router.back() });
  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'common.save', icon: <ActionSaveIcon />, onClick: () => exec('save') },
  ]);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title={t('settings.appearance.title')} />
      <Card className="max-w-lg">
        <div className="space-y-4 p-4">
          <Select label={t('settings.appearance.theme')} value={settings.theme} onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
            options={[{ value: 'light', label: t('settings.appearance.light') }, { value: 'dark', label: t('settings.appearance.dark') }, { value: 'auto', label: t('settings.appearance.auto') }]} />
          <Input label={t('settings.appearance.primaryColor')} type="color" value={settings.primaryColor || '#3b82f6'} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} />
          <Select label={t('settings.appearance.fontSize')} value={settings.fontSize} onChange={(e) => setSettings({ ...settings, fontSize: e.target.value })}
            options={[{ value: 'small', label: t('settings.appearance.small') }, { value: 'medium', label: t('settings.appearance.medium') }, { value: 'large', label: t('settings.appearance.large') }]} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!settings.compactMode} onChange={(e) => setSettings({ ...settings, compactMode: e.target.checked })} />
            {t('settings.appearance.compactMode')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!settings.sidebarCollapsed} onChange={(e) => setSettings({ ...settings, sidebarCollapsed: e.target.checked })} />
            {t('settings.appearance.sidebarCollapsed')}
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => router.back()}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
