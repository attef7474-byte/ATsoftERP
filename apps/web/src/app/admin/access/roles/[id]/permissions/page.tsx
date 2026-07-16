'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { useRouter, useParams } from 'next/navigation';
import { Input, Button } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon } from '../../../../../../components/admin/admin-action-bar';

function ModuleCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-gray-300" />;
}

export default function RolePermissionsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const [groups, setGroups] = useState<any[]>([]);
  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [changed, setChanged] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [roleRes, groupsRes] = await Promise.all([
        api.get<any>(`/roles/${params.id}`),
        api.get<any[]>(`/permissions/grouped?roleId=${params.id}`),
      ]);
      setRole(roleRes);
      setGroups(groupsRes);
      const assigned = new Set<string>();
      groupsRes.forEach((g: any) => g.permissions.forEach((p: any) => { if (p.assigned) assigned.add(p.id); }));
      setSelectedIds(assigned);
      setChanged(false);
    } catch (err: any) {
      showToast(err?.message || t('access.loadFailed'), 'error');
    } finally { setLoading(false); }
  }, [params.id, t, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePermission = (permId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId); else next.add(permId);
      setChanged(true);
      return next;
    });
  };

  const toggleModule = (module: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      groups.find((g) => g.module === module)?.permissions.forEach((p: any) => {
        if (checked) next.add(p.id); else next.delete(p.id);
      });
      setChanged(true);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/roles/${params.id}/permissions`, { permissionIds: Array.from(selectedIds) });
      showToast(t('access.assignPermissionsSuccess'), 'success');
      setChanged(false);
    } catch (err: any) {
      showToast(err?.message || t('access.assignmentFailed'), 'error');
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    const assigned = new Set<string>();
    groups.forEach((g: any) => g.permissions.forEach((p: any) => { if (p.assigned) assigned.add(p.id); }));
    setSelectedIds(assigned);
    setChanged(false);
  };

  const { exec } = useStableHandlers({
    back: () => router.push(`/admin/access/roles/${params.id}`),
    save: () => handleSave(),
    reset: () => handleReset(),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'actions.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'actions.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'save', labelKey: 'access.saveChanges', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving && changed },
  ]);

  const filteredGroups = groups
    .map((g) => ({ ...g, permissions: g.permissions.filter((p: any) => !search || p.key.toLowerCase().includes(search.toLowerCase()) || p.module.toLowerCase().includes(search.toLowerCase()) || p.action.toLowerCase().includes(search.toLowerCase())) }))
    .filter((g) => g.permissions.length > 0);

  if (loading) return <div className="p-6"><p>{t('access.loadingPermissions')}</p></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('access.managePermissions')}</h1>
          {role && <p className="text-sm text-gray-500">{role.name} ({role.code})</p>}
        </div>
        <div className="flex items-center gap-3">
          <Input placeholder={t('access.searchPermissions')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          {changed && <p className="text-sm text-orange-600">{t('access.unsavedChanges')}</p>}
          {changed && <Button variant="ghost" onClick={handleReset}>{t('access.resetChanges')}</Button>}
          <Button onClick={handleSave} disabled={saving || !changed}>{saving ? t('common.saving') : t('access.saveChanges')}</Button>
        </div>
      </div>

      {role?.isSystem && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"><p className="text-yellow-800 text-sm">{t('access.superAdminProtected')}</p></div>}

      <div className="space-y-4">
        {filteredGroups.map((group) => {
          const modulePerms = group.permissions;
          const allChecked = modulePerms.every((p: any) => selectedIds.has(p.id));
          const someChecked = modulePerms.some((p: any) => selectedIds.has(p.id));
          return (
            <div key={group.module} className="bg-white rounded-lg border">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-lg">
                <div className="flex items-center gap-3">
                  <ModuleCheckbox checked={allChecked} indeterminate={!allChecked && someChecked} onChange={(checked) => toggleModule(group.module, checked)} />
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-700">{group.module}</h3>
                </div>
                <span className="text-xs text-gray-500">{modulePerms.filter((p: any) => selectedIds.has(p.id)).length}/{modulePerms.length}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4">
                {modulePerms.map((perm: any) => (
                  <label key={perm.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded p-1">
                    <input type="checkbox" checked={selectedIds.has(perm.id)} onChange={() => togglePermission(perm.id)} className="rounded border-gray-300" />
                    <span className="text-xs font-medium">{perm.action}</span>
                    <span className="text-xs text-gray-400 truncate">{perm.key}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        {filteredGroups.length === 0 && <p className="text-gray-500 text-center py-8">{t('access.noPermissionsFound')}</p>}
      </div>
    </div>
  );
}
