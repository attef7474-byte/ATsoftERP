'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { Card, PageHeader, LoadingState, StatusBadge } from '../../../components/admin/ui';
import { getProfile, UserProfile } from '../../../lib/auth';
import { useRegisterAdminActions, ActionRefreshIcon, ActionBackIcon } from '../../../components/admin/admin-action-bar';
import { useStableHandlers } from '../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const p = await getProfile();
      setProfile(p);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const { exec } = useStableHandlers({
    refresh: () => fetchProfile(),
    changePassword: () => router.push('/admin/profile/password'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => router.back() },
    {
      id: 'changePassword', labelKey: 'profile.changePassword', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
      onClick: () => exec('changePassword'),
    },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState message={t('common.loading')} />;

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('errors.loadFailed')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('profile.title')} />

      <div className="space-y-6 max-w-2xl">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t('profile.accountInfo')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block">{t('profile.name')}</span>
                <span className="font-medium">{profile.name}</span>
              </div>
              <div>
                <span className="text-gray-500 block">{t('profile.email')}</span>
                <span className="font-medium">{profile.email}</span>
              </div>
              <div>
                <span className="text-gray-500 block">{t('profile.phone')}</span>
                <span className="font-medium">{profile.phone || t('common.unavailable')}</span>
              </div>
              <div>
                <span className="text-gray-500 block">{t('profile.status')}</span>
                <StatusBadge status={profile.status} />
              </div>
              <div>
                <span className="text-gray-500 block">{t('profile.lastLogin')}</span>
                <span className="font-medium">{profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : t('common.unavailable')}</span>
              </div>
              <div>
                <span className="text-gray-500 block">{t('profile.createdAt')}</span>
                <span className="font-medium">{new Date(profile.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t('profile.roles')}</h3>
            <div className="flex flex-wrap gap-2">
              {profile.roles?.map((ur) => (
                <span key={ur.role.id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {ur.role.name}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
