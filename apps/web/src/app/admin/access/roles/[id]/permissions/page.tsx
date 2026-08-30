'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { useRouter, useParams } from 'next/navigation';
import { Input, Button } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon } from '../../../../../../components/admin/admin-action-bar';
import { translateRoleName, translatePermissionKey } from '../../../../../../lib/i18n/literals';
import { useApiErrorHandler } from '../../../../../../components/admin/error-handler';
import { buildPermissionTree, TreeDomain, TreeResource, TreePermission } from '../../../../../../lib/permissions/permission-catalogue';

function TriCheckbox({ checked, indeterminate, onChange, disabled }: { checked: boolean; indeterminate: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="rounded border-gray-300" />;
}

export default function RolePermissionsPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [groups, setGroups] = useState<any[]>([]);
  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [changed, setChanged] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

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
    } catch (err) {
      handleApiError(err);
    } finally { setLoading(false); }
  }, [params.id, handleApiError]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePermission = (permId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId); else next.add(permId);
      setChanged(true);
      return next;
    });
  };

  const toggleIds = (ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => { if (checked) next.add(id); else next.delete(id); });
      setChanged(true);
      return next;
    });
  };

  const toggleDomain = (domain: TreeDomain, checked: boolean) => {
    const ids: string[] = [];
    domain.resources.forEach((r) => r.permissions.forEach((p) => ids.push(p.id)));
    toggleIds(ids, checked);
  };

  const toggleResource = (resource: TreeResource, checked: boolean) => {
    toggleIds(resource.permissions.map((p) => p.id), checked);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/roles/${params.id}/permissions`, { permissionIds: Array.from(selectedIds) });
      showToast(t('access.assignPermissionsSuccess'), 'success');
      setChanged(false);
    } catch (err) {
      handleApiError(err);
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

  const unitList = useMemo(() => {
    const units: { id: string; key: string; checked: boolean }[] = [];
    groups.forEach((g: any) => g.permissions.forEach((p: any) => units.push({ id: p.id, key: p.key, checked: !!p.assigned })));
    return units;
  }, [groups]);

  const tree = useMemo<TreeDomain[]>(() => (unitList.length ? buildPermissionTree(unitList) : []), [unitList]);

  const isDomainChecked = (d: TreeDomain): boolean => {
    let total = 0, selected = 0;
    d.resources.forEach((r) => r.permissions.forEach((p) => { total++; if (selectedIds.has(p.id)) selected++; }));
    return total > 0 && selected === total;
  };
  const isDomainSome = (d: TreeDomain): boolean => {
    let selected = 0;
    d.resources.forEach((r) => r.permissions.forEach((p) => { if (selectedIds.has(p.id)) selected++; }));
    return selected > 0;
  };
  const isResourceChecked = (r: TreeResource): boolean => r.permissions.every((p) => selectedIds.has(p.id));
  const isResourceSome = (r: TreeResource): boolean => r.permissions.some((p) => selectedIds.has(p.id));
  const countSelectedInDomain = (d: TreeDomain): number => {
    let n = 0;
    d.resources.forEach((r) => r.permissions.forEach((p) => { if (selectedIds.has(p.id)) n++; }));
    return n;
  };

  const matching = useMemo(() => {
    if (!search) return null;
    const q = search.trim().toLowerCase();
    return (label: string, key: string, action: string) =>
      label.toLowerCase().includes(q) || key.toLowerCase().includes(q) || action.toLowerCase().includes(q);
  }, [search]);

  const filteredTree = useMemo<TreeDomain[]>(() => {
    if (!matching) return tree;
    return tree
      .map((d) => {
        const resources = d.resources
          .map((r) => {
            const perms = r.permissions.filter((p) => matching(r.ar, p.key, p.action) || matching(r.en, p.key, p.action));
            return { ...r, permissions: perms };
          })
          .filter((r) => r.permissions.length > 0);
        return { ...d, resources };
      })
      .filter((d) => d.resources.length > 0);
  }, [tree, matching]);

  const expandAll = () => {
    setExpandedDomains(new Set(tree.map((d) => d.id)));
    setExpandedResources(new Set(tree.flatMap((d) => d.resources.map((r) => r.key))));
  };
  const collapseAll = () => {
    setExpandedDomains(new Set());
    setExpandedResources(new Set());
  };

  const toggleDomainOpen = (id: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleResourceOpen = (key: string) => {
    setExpandedResources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const domainOpenForSearch = (d: TreeDomain) => matching ? true : expandedDomains.has(d.id);
  const resourceOpenForSearch = (r: TreeResource) => matching ? true : expandedResources.has(r.key);

  if (loading) return <div className="p-6"><p>{t('access.loadingPermissions')}</p></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('access.managePermissions')}</h1>
          {role && <p className="text-sm text-gray-500">{translateRoleName(role.code, role.name, !!role.isSystem, locale)} ({role.code})</p>}
        </div>
        <div className="flex items-center gap-3">
          <Input placeholder={t('access.searchByKeyword')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
          {changed && <p className="text-sm text-orange-600">{t('access.unsavedChanges')}</p>}
          {changed && <Button variant="ghost" onClick={handleReset}>{t('access.resetChanges')}</Button>}
          <Button onClick={handleSave} disabled={saving || !changed}>{saving ? t('common.saving') : t('access.saveChanges')}</Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={expandAll} disabled={tree.length === 0}>{t('access.expandAll')}</Button>
          <Button variant="ghost" onClick={collapseAll} disabled={tree.length === 0}>{t('access.collapseAll')}</Button>
        </div>
        <span className="text-xs text-gray-500">{selectedIds.size} / {unitList.length}</span>
      </div>

      {role?.isSystem && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"><p className="text-yellow-800 text-sm">{t('access.superAdminProtected')}</p></div>}

      <div className="space-y-3">
        {filteredTree.map((domain) => {
          const domainOpen = domainOpenForSearch(domain);
          const domainSelected = countSelectedInDomain(domain);
          const domainTotal = domain.resources.reduce((n, r) => n + r.permissions.length, 0);
          return (
            <div key={domain.id} className="bg-white rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <TriCheckbox checked={isDomainChecked(domain)} indeterminate={!isDomainChecked(domain) && isDomainSome(domain)} onChange={(checked) => toggleDomain(domain, checked)} disabled={domain.resources.length === 0} />
                  <button type="button" onClick={() => toggleDomainOpen(domain.id)} className="flex items-center gap-2 text-left min-w-0">
                    {domainOpen ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                    <span className="font-semibold text-sm text-gray-800 truncate">{locale === 'ar' ? domain.ar : domain.en}</span>
                    <span className="text-xs text-gray-400 font-normal shrink-0">({domain.resources.length})</span>
                  </button>
                </div>
                <span className="text-xs text-gray-500 shrink-0">{domainSelected}/{domainTotal}</span>
              </div>
              {domainOpen && (
                <div className="divide-y divide-gray-100">
                  {domain.resources.map((resource) => {
                    const resourceOpen = resourceOpenForSearch(resource);
                    return (
                      <div key={resource.key} className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className="w-6 shrink-0" />
                          <TriCheckbox checked={isResourceChecked(resource)} indeterminate={isResourceSome(resource) && !isResourceChecked(resource)} onChange={(checked) => toggleResource(resource, checked)} />
                          <button type="button" onClick={() => toggleResourceOpen(resource.key)} className="flex items-center gap-2 text-left min-w-0">
                            {resourceOpen ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                            <span className="text-sm font-medium text-gray-700 truncate">{locale === 'ar' ? resource.ar : resource.en}</span>
                            <span className="text-xs text-gray-400 font-normal shrink-0">({resource.permissions.length})</span>
                          </button>
                          <span className="text-xs text-gray-500 ml-auto shrink-0">{resource.permissions.filter((p) => selectedIds.has(p.id)).length}/{resource.permissions.length}</span>
                        </div>
                        {resourceOpen && (
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pl-12">
                            {resource.permissions.map((perm: TreePermission) => (
                              <label key={perm.id} title={translatePermissionKey(perm.key, locale)} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded p-1">
                                <input type="checkbox" checked={selectedIds.has(perm.id)} onChange={() => togglePermission(perm.id)} className="rounded border-gray-300" />
                                <span className="text-xs font-medium">{locale === 'ar' ? perm.actionAr : perm.actionEn}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filteredTree.length === 0 && <div className="text-center py-10 text-gray-500">{search ? t('access.filterNoResults') : t('access.noPermissionsFound')}</div>}
      </div>
    </div>
  );
}
