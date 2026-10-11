'use client';
import React, { useRef, useState } from 'react';
import { api } from '../../../../lib/api';
import { Button, Input, Modal } from '../../../../components/admin/ui';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap } from '../../../../lib/form-validation';

interface Props {
  person: { id: string; code: string; name: string; email: string | null; phone: string | null };
  onClose: () => void;
  onEnabled: () => void;
}

/** Credentials live only in the mounted dialog; confirmation never reaches the API. */
export default function EnableLoginDialog({ person, onClose, onEnabled }: Props) {
  const { t, dir } = useTranslation();
  const handleApiError = useApiErrorHandler();
  const [email, setEmail] = useState(person.email ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const password = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  const clearCredentials = () => {
    if (password.current) password.current.value = '';
    if (confirmation.current) confirmation.current.value = '';
  };
  const close = () => {
    if (inFlight.current) return;
    clearCredentials();
    onClose();
  };
  const submit = async () => {
    if (inFlight.current) return;
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = t('validation.requiredField');
    if (!password.current?.value) next.password = t('validation.requiredField');
    if (password.current?.value !== confirmation.current?.value) {
      next.confirmPassword = t('validation.passwordMismatch');
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await api.post(`/person-registrations/${person.id}/enable-login`, {
        email: email.trim(), password: password.current?.value,
      });
      clearCredentials();
      onEnabled();
    } catch (error) {
      const config = handleApiError(error);
      if (config.errors?.length) setErrors(adaptFieldErrorsToMap(config.errors));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={close} title={t('core.enableSystemAccess')}>
      <div dir={dir} className="space-y-4" data-testid="enable-login-dialog">
        <p>{person.code} — {person.name}</p>
        {person.phone && <p dir="ltr">{person.phone}</p>}
        <Input id="enable-login-email" label={t('common.email')} type="email" required
          autoComplete="off" value={email} disabled={saving}
          onChange={(event) => setEmail(event.target.value)} error={errors.email} />
        <Input id="enable-login-password" label={t('access.password')} type="password" required
          autoComplete="new-password" ref={password} disabled={saving} error={errors.password} />
        <Input id="enable-login-confirm" label={t('access.confirmPassword')} type="password" required
          autoComplete="new-password" ref={confirmation} disabled={saving} error={errors.confirmPassword} />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={close} disabled={saving}>{t('actions.cancel')}</Button>
          <Button onClick={submit} loading={saving} disabled={saving}>{t('core.enableSystemAccess')}</Button>
        </div>
      </div>
    </Modal>
  );
}
