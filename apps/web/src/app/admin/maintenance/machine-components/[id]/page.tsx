'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { MachineComponent } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, PageHeader, Button, DataTable, LoadingState, ErrorState, ConfirmDialog } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon, ActionBackIcon } from '../../../../../components/admin/admin-action-bar';

export default function MachineComponentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<MachineComponent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate' | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<MachineComponent>(`/maintenance/machine-components/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setConfirmAction(null);
    try {
      if (newStatus === 'ACTIVE') {
        await api.patch(`/maintenance/machine-components/${id}/activate`);
      } else {
        await api.patch(`/maintenance/machine-components/${id}/deactivate`);
      }
      fetchData();
      showToast(t('common.successUpdated'), 'success');
    } catch (err: any) {
      showToast(err?.message, 'error');
    }
  }, [id, fetchData, showToast, t]);

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/maintenance/machine-components'),
    refresh: () => fetchData(),
    edit: () => router.push(`/admin/maintenance/machine-components/${id}/edit`),
    activate: () => setConfirmAction('activate'),
    deactivate: () => setConfirmAction('deactivate'),
  });

  useRegisterAdminActions(useMemo(() => [
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(data && data.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(data && data.status === 'ACTIVE') },
  ], [exec, data]));

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      <PageHeader title={data.name} subtitle={`[${data.code}]`} />
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.code')}</dt><dd className="mt-1 text-sm text-gray-900">{data.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.name')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.name}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.description')}</dt><dd className="mt-1 text-sm text-gray-900">{data.description || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><CmmsStatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.componentType')}</dt><dd className="mt-1 text-sm text-gray-900">{data.componentType}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.criticality')}</dt><dd className="mt-1 text-sm text-gray-900">{data.criticality}</dd></div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.details')}</h3></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.locationInMachine')}</dt><dd className="mt-1 text-sm text-gray-900">{data.locationInMachine || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.manufacturer')}</dt><dd className="mt-1 text-sm text-gray-900">{data.manufacturer || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.model')}</dt><dd className="mt-1 text-sm text-gray-900">{data.model || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.serialNumber')}</dt><dd className="mt-1 text-sm text-gray-900">{data.serialNumber || '-'}</dd></div>
          </dl>
        </CardContent>
      </Card>
      {data.parentComponent && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.parentComponent')}</h3></CardHeader>
          <CardContent>
            <button onClick={() => router.push(`/admin/maintenance/machine-components/${data.parentComponent!.id}`)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              {data.parentComponent.name} [{data.parentComponent.code}]
            </button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.children')} ({data.children?.length ?? 0})</h3></CardHeader>
        <CardContent>
          {!data.children || data.children.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <DataTable columns={[
              { key: 'name', header: t('maintenance.name'), render: (c: any) => c.name },
              { key: 'code', header: t('maintenance.code'), render: (c: any) => <span className="font-mono">{c.code}</span> },
              { key: 'componentType', header: t('maintenance.componentType'), render: (c: any) => c.componentType },
              { key: 'criticality', header: t('maintenance.criticality'), render: (c: any) => c.criticality },
            ]} data={data.children} keyExtractor={(c: any) => c.id} onRowClick={(c: any) => router.push(`/admin/maintenance/machine-components/${c.id}`)} />
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmAction === 'activate'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleStatusChange('ACTIVE')}
        title={t('common.activate')}
        message={t('common.confirmActivate')}
      />
      <ConfirmDialog
        open={confirmAction === 'deactivate'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleStatusChange('INACTIVE')}
        title={t('common.deactivate')}
        message={t('common.confirmDeactivate')}
      />
    </div>
  );
}
