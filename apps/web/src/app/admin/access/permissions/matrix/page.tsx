'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useRouter } from 'next/navigation';
import { Input, Select, Button } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

export default function PermissionsMatrixPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [matrix, setMatrix] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchMatrix = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>('/permissions/matrix');
      setMatrix(res);
    } catch (err: any) {
      setError(err?.message || t('access.loadFailed'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchMatrix(); }, [fetchMatrix]);

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/access/permissions'),
    refresh: () => fetchMatrix(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'actions.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'actions.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const modules: string[] = matrix ? [...new Set<string>(matrix.permissions?.map((p: any) => p.module) || [])] : [];
  const actions: string[] = matrix ? [...new Set<string>(matrix.permissions?.map((p: any) => p.action) || [])] : [];

  const filteredPermissions = matrix?.permissions?.filter((p: any) => {
    if (moduleFilter && p.module !== moduleFilter) return false;
    if (actionFilter && p.action !== actionFilter) return false;
    if (search && !p.key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  if (loading) return <div className="p-6"><p>{t('common.loading')}</p></div>;
  if (error) return <div className="p-6"><p className="text-red-600">{error}</p><button onClick={fetchMatrix} className="text-blue-600 mt-2">{t('common.retry')}</button></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t('access.matrixOverview')}</h1>

      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div className="w-48">
          <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} placeholder={t('access.filterByModule')} options={[{ value: '', label: t('common.all') }, ...modules.map((m: string) => ({ value: m, label: m }))]} />
        </div>
        <div className="w-48">
          <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder={t('access.filterByAction')} options={[{ value: '', label: t('common.all') }, ...actions.map((a: string) => ({ value: a, label: a }))]} />
        </div>
        <div className="w-64">
          <Input placeholder={t('access.searchPermissions')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-700 sticky left-0 bg-gray-50">{t('access.key')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">{t('access.module')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">{t('access.action')}</th>
              {matrix?.roles?.map((role: any) => (
                <th key={role.id} className="text-center px-3 py-3 font-medium text-gray-700 text-xs uppercase tracking-wide min-w-[100px]">
                  <button onClick={() => router.push(`/admin/access/roles/${role.id}`)} className="hover:text-blue-600">{role.name}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPermissions.map((perm: any) => (
              <tr key={perm.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 text-xs font-mono text-gray-600 sticky left-0 bg-white">{perm.key}</td>
                <td className="px-4 py-2">{perm.module}</td>
                <td className="px-4 py-2">{perm.action}</td>
                {matrix.roles.map((role: any) => {
                  const assigned = perm.roles?.find((r: any) => r.roleId === role.id)?.assigned;
                  return (
                    <td key={role.id} className="text-center px-3 py-2">
                      {assigned ? <span className="text-green-600 text-lg">&#10003;</span> : <span className="text-gray-300">&mdash;</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredPermissions.length === 0 && (
              <tr><td colSpan={3 + (matrix?.roles?.length || 0)} className="text-center py-8 text-gray-500">{t('access.noPermissionsFound')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
