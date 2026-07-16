'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useRouter, useParams } from 'next/navigation';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon } from '../../../../../components/admin/admin-action-bar';

export default function RoleDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRole = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/roles/${params.id}`);
      setRole(res);
    } catch (err: any) {
      setError(err?.message || t('access.loadFailed'));
    } finally { setLoading(false); }
  }, [params.id, t]);

  useEffect(() => { fetchRole(); }, [fetchRole]);

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/access/roles'),
    refresh: () => fetchRole(),
    edit: () => router.push(`/admin/access/roles/${params.id}/edit`),
    permissions: () => router.push(`/admin/access/roles/${params.id}/permissions`),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'actions.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'actions.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'actions.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !role?.isSystem },
    { id: 'permissions', labelKey: 'access.managePermissions', icon: <ActionEditIcon />, onClick: () => exec('permissions') },
  ]);

  if (loading) return <div className="p-6"><p>{t('common.loading')}</p></div>;
  if (error) return <div className="p-6"><p className="text-red-600">{error}</p><button onClick={fetchRole} className="text-blue-600 mt-2">{t('common.retry')}</button></div>;
  if (!role) return <div className="p-6"><p>{t('common.notFound')}</p></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{role.name}</h1>
            <p className="text-sm text-gray-500">{role.code}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${role.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{t(`status.${role.status}`)}</span>
        </div>

        {role.description && <p className="text-gray-600 mb-6">{role.description}</p>}

        {role.isSystem && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"><p className="text-yellow-800 text-sm">{t('access.superAdminProtected')}</p></div>}

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold">{role._count?.users ?? 0}</p>
            <p className="text-sm text-gray-500">{t('access.usersCount')}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold">{role.permissions?.length ?? 0}</p>
            <p className="text-sm text-gray-500">{t('access.permissionsCount')}</p>
          </div>
        </div>

        {role.permissions && role.permissions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">{t('access.assignedPermissions')}</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {role.permissions.map((rp: any) => (
                <div key={rp.permission.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                  <span>{rp.permission.key}</span>
                  <span className="text-gray-500 text-xs">{rp.permission.module} / {rp.permission.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
