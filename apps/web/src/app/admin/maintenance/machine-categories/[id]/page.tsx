'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { MachineCategory, Machine } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge, PageHeader } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';

export default function MachineCategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<MachineCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MachineCategory }>(`/maintenance/machine-categories/${id}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  const fetchMachines = useCallback(async () => {
    setMachinesLoading(true);
    try {
      const res = await api.get<{ data: Machine[] }>('/maintenance/machines', { params: { categoryId: id, limit: 50 } });
      setMachines(res.data || []);
    } catch (_) { setMachines([]); }
    finally { setMachinesLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); fetchMachines(); }, [fetchData, fetchMachines]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      if (newStatus === 'ACTIVE') {
        await api.patch(`/maintenance/machine-categories/${id}/activate`);
      } else {
        await api.patch(`/maintenance/machine-categories/${id}/deactivate`);
      }
      fetchData();
      showToast(t('common.successUpdated'), 'success');
    } catch (err: any) {
      showToast(err?.message, 'error');
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => { fetchData(); fetchMachines(); },
    edit: () => router.push(`/admin/maintenance/machine-categories/${id}/edit`),
    activate: () => handleStatusChange('ACTIVE'),
    deactivate: () => handleStatusChange('INACTIVE'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(data && data.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(data && data.status === 'ACTIVE') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'machines', label: `${t('maintenance.machines')} (${data._count?.machines ?? machines.length})` },
    { id: 'children', label: `${t('maintenance.childCategories')} (${data.children?.length ?? 0})` },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <PageHeader title={data.name} subtitle={`[${data.code}]`} />
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.code')}</dt><dd className="mt-1 text-sm text-gray-900">{data.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.name')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.name}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.parentCategory')}</dt><dd className="mt-1 text-sm text-gray-900">{data.parent?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.description')}</dt><dd className="mt-1 text-sm text-gray-900">{data.description || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.machinesCount')}</dt><dd className="mt-1 text-sm text-gray-900">{data._count?.machines ?? 0}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.updatedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.updatedAt)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card><CardContent><p className="text-sm text-gray-500">{data.description || t('details.overview')}</p></CardContent></Card>
      )}

      {activeTab === 'machines' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.machines')}</h3></CardHeader>
          <CardContent>
            {machinesLoading ? <LoadingState /> : machines.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'code', header: t('maintenance.code'), render: (m: Machine) => <span className="font-mono">{m.code}</span> },
                { key: 'name', header: t('maintenance.name'), render: (m: Machine) => m.name },
                { key: 'model', header: t('maintenance.model'), render: (m: Machine) => m.model || '-' },
                { key: 'serialNumber', header: t('maintenance.serialNumber'), render: (m: Machine) => m.serialNumber || '-' },
                { key: 'status', header: t('common.status'), render: (m: Machine) => <StatusBadge status={m.status} /> },
                { key: 'actions', header: t('common.actions'), render: (m: Machine) => (
                  <button onClick={() => router.push(`/admin/maintenance/machines/${m.id}`)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.view')}</button>
                )},
              ]} data={machines} keyExtractor={(m: Machine) => m.id} onRowClick={(m: Machine) => router.push(`/admin/maintenance/machines/${m.id}`)} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'children' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.childCategories')}</h3></CardHeader>
          <CardContent>
            {!data.children || data.children.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'code', header: t('maintenance.code'), render: (c: any) => <span className="font-mono">{c.code}</span> },
                { key: 'name', header: t('maintenance.name'), render: (c: any) => c.name },
                { key: 'actions', header: t('common.actions'), render: (c: any) => (
                  <button onClick={() => router.push(`/admin/maintenance/machine-categories/${c.id}`)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.view')}</button>
                )},
              ]} data={data.children} keyExtractor={(c: any) => c.id} onRowClick={(c: any) => router.push(`/admin/maintenance/machine-categories/${c.id}`)} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
