'use client';
import React, { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Select, Card, PageHeader, LoadingState, ErrorState } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionSaveIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function LanguageSettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [settings, setSettings] = useState<any>({ defaultLanguage: 'ar' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<any>('/settings/language');
        setSettings(res);
      } catch {
        setSettings({ defaultLanguage: locale || 'ar' });
      } finally {
        setLoading(false);
      }
    })();
  }, [locale]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/settings/language', settings);
      setLocale(settings.defaultLanguage);
      showToast(t('settings.languageSettings.saveSuccess'), 'success');
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const { exec } = useStableHandlers({ save: () => handleSave(), back: () => router.back() });
  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'common.save', icon: <ActionSaveIcon />, onClick: () => exec('save') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div>
      <PageHeader title={t('settings.languageSettings.title')} />
      <Card className="max-w-lg">
        <div className="space-y-4 p-4">
          <Select label={t('settings.languageSettings.defaultLanguage')} value={settings.defaultLanguage} onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
            options={[{ value: 'ar', label: t('settings.languageSettings.ltr') === 'Left to Right' ? 'العربية' : 'Arabic' }, { value: 'en', label: 'English' }]} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => router.back()}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
