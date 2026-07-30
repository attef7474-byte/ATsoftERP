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
  const [settings, setSettings] = useState<any>({
    theme: 'light', primaryColor: '#3b82f6', fontSize: 'medium',
    compactMode: false, sidebarCollapsed: false,
    sidebarBg: 'navy', sidebarAccent: 'teal',
    sidebarDensity: 'default', sidebarFont: 'normal',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<any>('/settings/appearance');
        setSettings((prev: any) => ({
          ...prev, ...res,
          sidebarBg: res.sidebarBg || localStorage.getItem('sidebar-background-mode') || 'navy',
          sidebarAccent: res.sidebarAccent || localStorage.getItem('sidebar-accent-color') || 'teal',
          sidebarDensity: res.sidebarDensity || localStorage.getItem('sidebar-density') || 'default',
          sidebarFont: res.sidebarFont || localStorage.getItem('sidebar-font-size') || 'normal',
        }));
      } catch {
        // load sidebar prefs from localStorage
        setSettings((prev: any) => ({
          ...prev,
          sidebarBg: localStorage.getItem('sidebar-background-mode') || 'navy',
          sidebarAccent: localStorage.getItem('sidebar-accent-color') || 'teal',
          sidebarDensity: localStorage.getItem('sidebar-density') || 'default',
          sidebarFont: localStorage.getItem('sidebar-font-size') || 'normal',
        }));
      } finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { theme, primaryColor, fontSize, sidebarCollapsed, compactMode, sidebarBg, sidebarAccent, sidebarDensity, sidebarFont } = settings;
      await api.patch('/settings/appearance', {
        themeMode: theme, accentColor: primaryColor, compactMode, sidebarCollapsed,
      });
      // Persist sidebar prefs to localStorage (used by admin-shell via data-attrs)
      localStorage.setItem('sidebar-background-mode', sidebarBg);
      localStorage.setItem('sidebar-accent-color', sidebarAccent);
      localStorage.setItem('sidebar-density', sidebarDensity);
      localStorage.setItem('sidebar-font-size', sidebarFont);
      // Update data-attrs on root element
      document.documentElement.setAttribute('data-sidebar-bg', sidebarBg);
      document.documentElement.setAttribute('data-sidebar-accent', sidebarAccent);
      document.documentElement.setAttribute('data-sidebar-density', sidebarDensity);
      document.documentElement.setAttribute('data-sidebar-font', sidebarFont);
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

  const sidebarBgOptions = [
    { value: 'navy', label: t('appearanceSettings.bgNavy') },
    { value: 'slate', label: t('appearanceSettings.bgSlate') },
    { value: 'teal', label: t('appearanceSettings.bgTeal') },
    { value: 'custom', label: t('appearanceSettings.bgCustom') },
  ];
  const accentOptions = [
    { value: 'teal', label: t('appearanceSettings.accentTeal') },
    { value: 'blue', label: t('appearanceSettings.accentBlue') },
    { value: 'emerald', label: t('appearanceSettings.accentEmerald') },
    { value: 'violet', label: t('appearanceSettings.accentViolet') },
  ];
  const densityOptions = [
    { value: 'default', label: t('appearanceSettings.densityDefault') },
    { value: 'compact', label: t('appearanceSettings.densityCompact') },
    { value: 'comfortable', label: t('appearanceSettings.densityComfortable') },
  ];
  const fontOptions = [
    { value: 'normal', label: t('settings.appearance.medium') },
    { value: 'large', label: t('settings.appearance.large') },
  ];

  return (
    <div>
      <PageHeader title={t('settings.appearance.title')} />
      <Card className="max-w-lg">
        <div className="space-y-4 p-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t('appearanceSettings.title')}</h3>
          <Select label={t('settings.appearance.theme')} value={settings.theme}
            onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
            options={[{ value: 'light', label: t('settings.appearance.light') }, { value: 'dark', label: t('settings.appearance.dark') }, { value: 'auto', label: t('settings.appearance.auto') }]} />
          <Input label={t('settings.appearance.primaryColor')} type="color" value={settings.primaryColor || '#3b82f6'}
            onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} />
          <Select label={t('settings.appearance.fontSize')} value={settings.fontSize}
            onChange={(e) => setSettings({ ...settings, fontSize: e.target.value })}
            options={[{ value: 'small', label: t('settings.appearance.small') }, { value: 'medium', label: t('settings.appearance.medium') }, { value: 'large', label: t('settings.appearance.large') }]} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!settings.compactMode}
              onChange={(e) => setSettings({ ...settings, compactMode: e.target.checked })} />
            {t('settings.appearance.compactMode')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!settings.sidebarCollapsed}
              onChange={(e) => setSettings({ ...settings, sidebarCollapsed: e.target.checked })} />
            {t('settings.appearance.sidebarCollapsed')}
          </label>

          <hr className="my-2" />
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t('appearanceSettings.sidebarBg')}</h3>
          <Select label={t('appearanceSettings.sidebarBg')} value={settings.sidebarBg}
            onChange={(e) => setSettings({ ...settings, sidebarBg: e.target.value })}
            options={sidebarBgOptions} />
          <Select label={t('appearanceSettings.sidebarAccent')} value={settings.sidebarAccent}
            onChange={(e) => setSettings({ ...settings, sidebarAccent: e.target.value })}
            options={accentOptions} />
          <Select label={t('appearanceSettings.sidebarDensity')} value={settings.sidebarDensity}
            onChange={(e) => setSettings({ ...settings, sidebarDensity: e.target.value })}
            options={densityOptions} />
          <Select label={t('appearanceSettings.sidebarFontSize')} value={settings.sidebarFont}
            onChange={(e) => setSettings({ ...settings, sidebarFont: e.target.value })}
            options={fontOptions} />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => router.back()}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
