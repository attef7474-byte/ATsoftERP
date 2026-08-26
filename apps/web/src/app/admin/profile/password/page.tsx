'use client';
import React, { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import {
  clearLocalSession,
  getPasswordPolicy,
  type PasswordPolicy,
} from '../../../../lib/auth';
import { useAuth } from '../../../../lib/auth-context';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Card, PageHeader } from '../../../../components/admin/ui';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionSaveIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../lib/form-validation';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const router = useRouter();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);

  useEffect(() => {
    void getPasswordPolicy()
      .then(setPolicy)
      .catch((error) => handleApiError(error));
  }, [handleApiError]);

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = t('validation.required');
    if (!newPassword) errors.newPassword = t('validation.required');
    if (!confirmNewPassword) errors.confirmNewPassword = t('validation.required');
    if (newPassword && confirmNewPassword && newPassword !== confirmNewPassword) errors.confirmNewPassword = t('profile.passwordsDoNotMatch');
    setValidationErrors(errors);
    focusFirstInvalidField(
      Object.entries(errors).map(([field, message]) => ({ field, message })),
    );
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword, confirmNewPassword });
      showToast(t('profile.passwordChanged'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      clearLocalSession(user?.id);
      router.replace('/login');
    } catch (err: any) {
      const config = handleApiError(err, { dialog: false });
      if (config.errors?.length) {
        setValidationErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      } else {
        handleApiError(err);
      }
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
            {policy && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="font-medium">{t('profile.passwordPolicyTitle')}</p>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  <li>{t('profile.passwordPolicyMinLength')} {policy.minLength}</li>
                  {policy.requireUppercase && <li>{t('profile.passwordPolicyUppercase')}</li>}
                  {policy.requireLowercase && <li>{t('profile.passwordPolicyLowercase')}</li>}
                  {policy.requireNumber && <li>{t('profile.passwordPolicyNumber')}</li>}
                  {policy.requireSymbol && <li>{t('profile.passwordPolicySymbol')}</li>}
                </ul>
              </div>
            )}
            <div>
              <Input label={t('profile.currentPassword')} name="currentPassword" autoComplete="current-password" type="password" value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setValidationErrors(prev => ({ ...prev, currentPassword: '' })); }} />
              {validationErrors.currentPassword && <p className="text-red-500 text-sm mt-1">{validationErrors.currentPassword}</p>}
            </div>
            <div>
              <Input label={t('profile.newPassword')} name="newPassword" autoComplete="new-password" type="password" value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setValidationErrors(prev => ({ ...prev, newPassword: '' })); }} />
              {validationErrors.newPassword && <p className="text-red-500 text-sm mt-1">{validationErrors.newPassword}</p>}
            </div>
            <div>
              <Input label={t('profile.confirmNewPassword')} name="confirmNewPassword" autoComplete="new-password" type="password" value={confirmNewPassword}
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
