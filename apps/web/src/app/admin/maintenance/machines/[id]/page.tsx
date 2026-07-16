'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Machine, MachinePart, MachineDocument, MaintenanceRequest } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';

interface MachineDetail extends Machine {
  parts?: MachinePart[];
  documents?: MachineDocument[];
}

export default function MachineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<MachineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [labels, setLabels] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<Machine>(`/maintenance/machines/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get<{ data: MaintenanceRequest[] }>(`/maintenance/requests`, { params: { machineId: id, limit: 20 } });
      setRequests(res.data || []);
    } catch (_) { setRequests([]); }
  }, [id]);

  const fetchLabels = useCallback(async () => {
    try {
      const res = await api.get<{ data: any[] }>(`/barcodes/entities/machines/${id}/labels`);
      setLabels(res.data || []);
    } catch (_) { setLabels([]); }
  }, [id]);

  useEffect(() => { fetchData(); fetchRequests(); fetchLabels(); }, [fetchData, fetchRequests, fetchLabels]);

  const handleStatusChange = async (newStatus: string) => {
    try { await api.patch(`/maintenance/machines/${id}`, { status: newStatus }); fetchData(); showToast(t('common.successUpdated'), 'success'); } catch (err: any) { showToast(err?.message, 'error'); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => { fetchData(); fetchRequests(); fetchLabels(); },
    edit: () => router.push(`/admin/maintenance/machines?id=${id}`),
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
    { id: 'parts', label: t('details.machine.parts') },
    { id: 'documents', label: t('details.machine.documents') },
    { id: 'requests', label: t('details.machine.requests') },
    { id: 'labels', label: t('details.machine.labels') },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.code')}</dt><dd className="mt-1 text-sm text-gray-900">{data.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.name')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.name}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.category')}</dt><dd className="mt-1 text-sm text-gray-900">{data.category?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.model')}</dt><dd className="mt-1 text-sm text-gray-900">{data.model || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.serialNumber')}</dt><dd className="mt-1 text-sm text-gray-900 font-mono">{data.serialNumber || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.manufacturer')}</dt><dd className="mt-1 text-sm text-gray-900">{data.manufacturer || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.location')}</dt><dd className="mt-1 text-sm text-gray-900">{data.location || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('core.company')}</dt><dd className="mt-1 text-sm text-gray-900">{data.company?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('core.branch')}</dt><dd className="mt-1 text-sm text-gray-900">{data.branch?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('core.department')}</dt><dd className="mt-1 text-sm text-gray-900">{data.department?.name || '-'}</dd></div>
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
        <Card><CardContent><p className="text-sm text-gray-500">{data.notes || t('details.overview')}</p></CardContent></Card>
      )}

      {activeTab === 'parts' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.machine.parts')}</h3></CardHeader>
          <CardContent>
            {!data.parts || data.parts.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'code', header: t('common.code'), render: (p: MachinePart) => p.code },
                { key: 'name', header: t('common.name'), render: (p: MachinePart) => p.name },
                { key: 'quantity', header: t('maintenance.quantity'), render: (p: MachinePart) => p.quantity },
                { key: 'unit', header: t('maintenance.unit'), render: (p: MachinePart) => p.unit || '-' },
                { key: 'status', header: t('common.status'), render: (p: MachinePart) => <StatusBadge status={p.status} /> },
              ]} data={data.parts} keyExtractor={(p: MachinePart) => p.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.machine.documents')}</h3></CardHeader>
          <CardContent>
            {!data.documents || data.documents.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'title', header: t('common.name'), render: (d: MachineDocument) => d.title },
                { key: 'type', header: t('maintenance.documentType'), render: (d: MachineDocument) => d.documentType || '-' },
                { key: 'fileName', header: t('maintenance.fileName'), render: (d: MachineDocument) => d.fileName || '-' },
                { key: 'createdAt', header: t('common.createdAt'), render: (d: MachineDocument) => fmt(d.createdAt) },
              ]} data={data.documents} keyExtractor={(d: MachineDocument) => d.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'requests' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.machine.requests')}</h3></CardHeader>
          <CardContent>
            {requests.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'requestNumber', header: t('maintenance.requestNumber'), render: (r: MaintenanceRequest) => r.requestNumber },
                { key: 'title', header: t('common.name'), render: (r: MaintenanceRequest) => r.title },
                { key: 'type', header: t('maintenance.maintenanceType'), render: (r: MaintenanceRequest) => t('status.' + r.type) },
                { key: 'priority', header: t('maintenance.priority'), render: (r: MaintenanceRequest) => r.priority },
                { key: 'status', header: t('common.status'), render: (r: MaintenanceRequest) => <StatusBadge status={r.status} /> },
              ]} data={requests} keyExtractor={(r: MaintenanceRequest) => r.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'labels' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.machine.labels')}</h3></CardHeader>
          <CardContent>
            {labels.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'code', header: t('barcodes.labelCode'), render: (l: any) => l.code },
                { key: 'value', header: t('barcodes.labelValue'), render: (l: any) => l.value },
                { key: 'symbology', header: t('barcodes.symbology'), render: (l: any) => l.symbology },
                { key: 'status', header: t('common.status'), render: (l: any) => <StatusBadge status={l.status} /> },
              ]} data={labels} keyExtractor={(l: any) => l.id} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
