'use client';
import React, { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Card, PageHeader, LoadingState, ErrorState } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionSaveIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function CompanyProfilePage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<any>('/settings/company-profile');
        setProfile(res);
        setForm(res);
      } catch (err: any) {
        setError(err?.message || t('errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id, defaultLanguage, timezone, currencyCode, ...payload } = form;
      const updated = await api.patch<any>('/settings/company-profile', payload);
      setProfile(updated);
      showToast(t('settings.company.saveSuccess'), 'success');
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const { exec } = useStableHandlers({ save: () => handleSave(), back: () => router.back() });
  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'common.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !!profile },
  ]);

  if (loading) return <LoadingState message={t('settings.company.loading')} />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const fields = [
    { key: 'companyNameAr', label: t('settings.company.nameAr') },
    { key: 'companyNameEn', label: t('settings.company.nameEn') },
    { key: 'taxNumber', label: t('settings.company.taxNumber') },
    { key: 'commercialRegister', label: t('settings.company.commercialRegister') },
    { key: 'phone', label: t('settings.company.phone') },
    { key: 'email', label: t('settings.company.email') },
    { key: 'address', label: t('settings.company.address') },
    { key: 'city', label: t('settings.company.city') },
    { key: 'country', label: t('settings.company.country') },
    { key: 'defaultLanguage', label: t('settings.company.defaultLanguage') },
    { key: 'timezone', label: t('settings.company.timezone') },
    { key: 'currencyCode', label: t('settings.company.currencyCode') },
  ];

  return (
    <div>
      <PageHeader title={t('settings.company.title')} />
      <Card className="max-w-2xl">
        <div className="space-y-4 p-4">
          {fields.map((f) => (
            <Input key={f.key} label={f.label} value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          ))}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => router.back()}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
