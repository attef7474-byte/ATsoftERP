'use client';
import React, { useState } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Card, PageHeader } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionSaveIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showToast(t('validation.required'), 'error');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast(t('profile.passwordsDoNotMatch'), 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast(t('profile.passwordMinLength'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword, confirmNewPassword });
      showToast(t('profile.passwordChanged'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      router.push('/admin/profile');
    } catch (err: any) {
      showToast(err?.message || t('errors.generalError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const { exec } = useStableHandlers({
    save: () => handleSave(),
    back: () => router.back(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), variant: 'primary' },
  ]);

  return (
    <div>
      <PageHeader title={t('profile.changePasswordTitle')} />
      <div className="max-w-md">
        <Card>
          <div className="p-6 space-y-4">
            <Input label={t('profile.currentPassword')} type="password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)} />
            <Input label={t('profile.newPassword')} type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText={t('profile.passwordMinLength')} />
            <Input label={t('profile.confirmNewPassword')} type="password" value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => router.back()}>{t('actions.cancel')}</Button>
              <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
