'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { User, Company, Branch, Department } from '../../../../../lib/admin-types';
import { Button, Card, CardContent, LoadingState, ErrorState, StatusBadge, Modal, Input, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';
import { useParams, useRouter } from 'next/navigation';
import { formatDateTime, translateRoleName } from '../../../../../lib/i18n/literals';
import { useErrorModal } from '../../../../../components/admin/error-modal';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../../lib/form-validation';
import { getPasswordPolicy, type PasswordPolicy } from '../../../../../lib/auth';
import { useAuth } from '../../../../../lib/auth-context';

export default function UserDetailPage() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const { showError } = useErrorModal();
  const handleApiError = useApiErrorHandler();
  const { user: currentUser, permissions, isSuperAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate'>('deactivate');
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetForm, setResetForm] = useState({ newPassword: '', confirmNewPassword: '' });
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
  const [resetSaving, setResetSaving] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await api.get<User>(`/users/${id}`);
      setUser(res);
    } catch (err) {
      if ((err as any)?.status === 404) {
        setNotFound(true);
      } else {
        const config = handleApiError(err);
        setError(config.message);
      }
    } finally {
      setLoading(false);
    }
  }, [id, handleApiError]);

  const fetchLookups = useCallback(async () => {
    try {
      const [cRes, bRes, dRes] = await Promise.allSettled([
        api.get<{ data: Company[] }>('/companies', { params: { page: 1, limit: 100 } }),
        api.get<{ data: Branch[] }>('/branches', { params: { page: 1, limit: 100 } }),
        api.get<{ data: Department[] }>('/departments', { params: { page: 1, limit: 100 } }),
      ]);
      if (cRes.status === 'fulfilled') setCompanies(cRes.value.data || []);
      if (bRes.status === 'fulfilled') setBranches(bRes.value.data || []);
      if (dRes.status === 'fulfilled') setDepartments(dRes.value.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchUser(); fetchLookups(); }, [fetchUser, fetchLookups]);

  const getCompanyName = (id?: string | null) => id ? companies.find(c => c.id === id)?.name || '-' : '-';
  const getBranchName = (id?: string | null) => id ? branches.find(b => b.id === id)?.name || '-' : '-';
  const getDepartmentName = (id?: string | null) => id ? departments.find(d => d.id === id)?.name || '-' : '-';

  const openEdit = () => {
    if (!user) return;
    setForm({ name: user.name, email: user.email, phone: user.phone || '' });
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.name) errors.name = t('validation.required');
    if (!form.email) errors.email = t('validation.required');
    setValidationErrors(errors);
    focusFirstInvalidField(
      Object.keys(errors).map((field) => ({ field, message: errors[field] })),
    );
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await api.patch(`/users/${id}`, { name: form.name, email: form.email, phone: form.phone || undefined });
      showToast(t('common.successUpdated'), 'success');
      setModalOpen(false);
      fetchUser();
    } catch (err) {
      const config = handleApiError(err, { dialog: false });
      if (config.errors?.length) {
        setValidationErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      } else {
        showError(config);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = () => { setConfirmAction('deactivate'); setConfirmOpen(true); };
  const handleActivate = () => { setConfirmAction('activate'); setConfirmOpen(true); };

  const handleActivateAction = async () => {
    setConfirmLoading(true);
    try {
      const status = confirmAction === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await api.patch(`/users/${id}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchUser();
    } catch (err) {
      handleApiError(err);
    } finally {
      setConfirmLoading(false);
    }
  };

  const canResetPassword = Boolean(
    user &&
    currentUser &&
    user.id !== currentUser.id &&
    (isSuperAdmin || permissions?.permissions.includes('user:reset-password')),
  );

  const openPasswordReset = async () => {
    setResetForm({ newPassword: '', confirmNewPassword: '' });
    setResetErrors({});
    setResetOpen(true);
    try {
      setPasswordPolicy(await getPasswordPolicy());
    } catch (resetPolicyError) {
      handleApiError(resetPolicyError);
    }
  };

  const handlePasswordReset = async () => {
    const errors: Record<string, string> = {};
    if (!resetForm.newPassword) errors.newPassword = t('validation.required');
    if (!resetForm.confirmNewPassword) errors.confirmNewPassword = t('validation.required');
    if (
      resetForm.newPassword &&
      resetForm.confirmNewPassword &&
      resetForm.newPassword !== resetForm.confirmNewPassword
    ) {
      errors.confirmNewPassword = t('profile.passwordsDoNotMatch');
    }
    setResetErrors(errors);
    focusFirstInvalidField(
      Object.entries(errors).map(([field, message]) => ({ field, message })),
    );
    if (Object.keys(errors).length > 0) return;

    setResetSaving(true);
    try {
      await api.post(`/users/${id}/reset-password`, resetForm);
      showToast(t('users.passwordResetSuccess'), 'success');
      setResetForm({ newPassword: '', confirmNewPassword: '' });
      setResetOpen(false);
    } catch (resetError) {
      const config = handleApiError(resetError, { dialog: false });
      if (config.errors?.length) {
        setResetErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      } else {
        showError(config);
      }
    } finally {
      setResetSaving(false);
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchUser(),
    edit: () => openEdit(),
    activate: () => handleActivate(),
    deactivate: () => handleDeactivate(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!user },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(user && user.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(user && user.status === 'ACTIVE') },
  ]);

  if (notFound) {
    return <ErrorState message={t('details.notFound')} onRetry={() => router.push('/admin/access/users')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchUser} />;
  }

  if (loading || !user) {
    return <LoadingState />;
  }

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {field(t('details.user.username'), user.name)}
            {field(t('details.user.displayName'), user.name)}
            {field(t('details.user.email'), user.email)}
            {field(t('details.user.phone'), user.phone || '-')}
            {field(t('common.status'), <StatusBadge status={user.status} />)}
            {field(t('details.user.roles'), user.roles && user.roles.length > 0 ? user.roles.map(r => translateRoleName(r.role?.code, r.role?.name, !!r.role?.isSystem, locale)).join(', ') : '-')}
            {field(t('details.user.company'), getCompanyName(user.companyId))}
            {field(t('details.user.branch'), getBranchName(user.branchId))}
            {field(t('details.user.department'), getDepartmentName(user.departmentId))}
            {field(t('details.user.lastLogin'), formatDateTime(user.lastLoginAt, locale))}
            {field(t('common.createdAt'), formatDateTime(user.createdAt, locale))}
            {field(t('common.updatedAt'), formatDateTime(user.updatedAt, locale))}
          </dl>
          {canResetPassword && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <Button variant="secondary" onClick={() => void openPasswordReset()}>
                {t('users.resetPassword')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('users.edit')}>
        <div className="space-y-4">
          <Input label={t('users.name')} name="name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} error={validationErrors.name} required />
          <Input label={t('users.email')} name="email" type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setValidationErrors(prev => ({ ...prev, email: '' })); }} error={validationErrors.email} required />
          <Input label={t('users.phone')} name="phone" value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setValidationErrors(prev => ({ ...prev, phone: '' })); }} error={validationErrors.phone} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => { if (!resetSaving) setResetOpen(false); }}
        title={t('users.resetPasswordTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('users.resetPasswordConfirm')}
          </p>
          {passwordPolicy && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              {t('profile.passwordPolicyMinLength')} {passwordPolicy.minLength}
            </div>
          )}
          <Input
            label={t('profile.newPassword')}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={resetForm.newPassword}
            onChange={(event) => {
              setResetForm((previous) => ({ ...previous, newPassword: event.target.value }));
              setResetErrors((previous) => ({ ...previous, newPassword: '' }));
            }}
            error={resetErrors.newPassword}
            required
          />
          <Input
            label={t('profile.confirmNewPassword')}
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            value={resetForm.confirmNewPassword}
            onChange={(event) => {
              setResetForm((previous) => ({ ...previous, confirmNewPassword: event.target.value }));
              setResetErrors((previous) => ({ ...previous, confirmNewPassword: '' }));
            }}
            error={resetErrors.confirmNewPassword}
            required
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setResetOpen(false)} disabled={resetSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handlePasswordReset} disabled={resetSaving}>
              {resetSaving ? t('common.saving') : t('users.resetPassword')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleActivateAction}
        title={confirmAction === 'activate' ? t('users.activateTitle') : t('users.deactivateTitle')}
        message={confirmAction === 'activate' ? t('users.activateConfirm') : t('users.deactivateConfirm')}
        loading={confirmLoading}
      />
    </div>
  );
}
