'use client';
import React, { useState } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Card, PageHeader } from '../../../../components/admin/ui';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionSaveIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = t('validation.required');
    if (!newPassword) errors.newPassword = t('validation.required');
    if (!confirmNewPassword) errors.confirmNewPassword = t('validation.required');
    if (newPassword && confirmNewPassword && newPassword !== confirmNewPassword) errors.confirmNewPassword = t('profile.passwordsDoNotMatch');
    if (newPassword && newPassword.length < 6) errors.newPassword = t('profile.passwordMinLength');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword, confirmNewPassword });
      showToast(t('profile.passwordChanged'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      router.push('/admin/profile');
    } catch (err: any) {
      handleApiError(err);
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
            <div>
              <Input label={t('profile.currentPassword')} type="password" value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setValidationErrors(prev => ({ ...prev, currentPassword: '' })); }} />
              {validationErrors.currentPassword && <p className="text-red-500 text-sm mt-1">{validationErrors.currentPassword}</p>}
            </div>
            <div>
              <Input label={t('profile.newPassword')} type="password" value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setValidationErrors(prev => ({ ...prev, newPassword: '' })); }} />
              {validationErrors.newPassword && <p className="text-red-500 text-sm mt-1">{validationErrors.newPassword}</p>}
            </div>
            <div>
              <Input label={t('profile.confirmNewPassword')} type="password" value={confirmNewPassword}
                onChange={(e) => { setConfirmNewPassword(e.target.value); setValidationErrors(prev => ({ ...prev, confirmNewPassword: '' })); }} />
              {validationErrors.confirmNewPassword && <p className="text-red-500 text-sm mt-1">{validationErrors.confirmNewPassword}</p>}
            </div>
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
