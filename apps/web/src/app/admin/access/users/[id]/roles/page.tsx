'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { useRouter, useParams } from 'next/navigation';
import { Input, Button } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../../components/admin/admin-action-bar';

export default function UserRolesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [userRes, rolesRes] = await Promise.all([
        api.get<any>(`/users/${params.id}`),
        api.get<any>('/roles?limit=100'),
      ]);
      setUser(userRes);
      setAllRoles(rolesRes.data || []);
      const assigned = new Set<string>((userRes.roles || []).map((ur: any) => ur.role?.id || ur.roleId));
      setSelectedRoleIds(assigned);
      setChanged(false);
    } catch (err: any) {
      setError(err?.message || t('access.loadFailed'));
    } finally { setLoading(false); }
  }, [params.id, t, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId); else next.add(roleId);
      setChanged(true);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/users/${params.id}/roles`, { roleIds: Array.from(selectedRoleIds) });
      showToast(t('access.assignRolesSuccess'), 'success');
      setChanged(false);
    } catch (err: any) {
      showToast(err?.message || t('access.assignRolesFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.push(`/admin/access/users/${params.id}`),
    save: () => handleSave(),
    cancel: () => router.push(`/admin/access/users/${params.id}`),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'actions.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'actions.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'save', labelKey: 'access.saveChanges', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving && changed },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  const filteredRoles = allRoles.filter((r: any) => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="p-6"><p>{t('access.loadingRoles')}</p></div>;
  if (error) return <div className="p-6"><p className="text-red-600">{error}</p><button onClick={fetchData} className="text-blue-600 mt-2">{t('common.retry')}</button></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('access.manageUserRoles')}</h1>
          {user && <p className="text-sm text-gray-500">{user.name} ({user.email})</p>}
        </div>
        <Input placeholder={t('access.searchRoles')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
      </div>

      {changed && <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm text-orange-700">{t('access.unsavedChanges')}</div>}

      <div className="space-y-2">
        {filteredRoles.map((role: any) => {
          const checked = selectedRoleIds.has(role.id);
          return (
            <label key={role.id} className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
              <input type="checkbox" checked={checked} onChange={() => toggleRole(role.id)} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">{role.name}</p>
                <p className="text-xs text-gray-500">{role.code}{role.isSystem ? ` - ${t('access.systemRole')}` : ''}</p>
              </div>
              {role.description && <p className="text-xs text-gray-400 max-w-xs truncate">{role.description}</p>}
              {role.isSystem && <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">{t('access.systemRole')}</span>}
            </label>
          );
        })}
        {filteredRoles.length === 0 && <p className="text-center py-8 text-gray-500">{t('access.noRolesFound')}</p>}
      </div>

      {changed && (
        <div className="flex gap-3 mt-6">
          <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('access.saveChanges')}</Button>
          <Button variant="ghost" onClick={() => { fetchData(); setChanged(false); }}>{t('actions.cancel')}</Button>
        </div>
      )}
    </div>
  );
}
