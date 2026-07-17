'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { DowntimeLog } from '../../../../../lib/admin-types';
import { Card, CardHeader, DataTable, PageHeader, LoadingState, EmptyState, ErrorState, ConfirmDialog } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionCompleteIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CurrentDowntimePage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<DowntimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<DowntimeLog[]>('/maintenance/downtime-logs/current');
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const confirmAndExec = (id: string, action: string) => {
    setSelectedId(id);
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const execAction = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/maintenance/downtime-logs/${selectedId}/${pendingAction}`, {});
      showToast(t('common.successUpdated'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setActionLoading(false); }
  };

  const { exec } = useStableHandlers({
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'machine', header: t('maintenance.machine'), render: (d: DowntimeLog) => d.machine?.name || '-' },
    { key: 'reason', header: t('maintenance.reason') },
    { key: 'startTime', header: t('maintenance.startTime'), render: (d: DowntimeLog) => new Date(d.startTime).toLocaleString() },
    {
      key: 'duration', header: t('maintenance.duration'),
      render: (d: DowntimeLog) => {
        const start = new Date(d.startTime).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - start) / 60000);
        if (elapsed < 60) return `${elapsed} min`;
        const h = Math.floor(elapsed / 60);
        const m = elapsed % 60;
        return `${h}h ${m}m`;
      },
    },
    { key: 'status', header: t('common.status'), render: (d: DowntimeLog) => <CmmsStatusBadge status={d.status} /> },
    {
      key: 'actions', header: t('common.actions'), render: (d: DowntimeLog) => (
        <div className="flex gap-2 flex-wrap">
          {!d.endTime && (
            <button onClick={() => confirmAndExec(d.id, 'end')} className="text-green-600 hover:text-green-800 text-sm font-medium">
              {t('maintenance.endDowntime')}
            </button>
          )}
          {d.endTime && d.status !== 'CLOSED' && (
            <button onClick={() => confirmAndExec(d.id, 'close')} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              {t('maintenance.close')}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.currentDowntime')} subtitle={t('maintenance.currentDowntimeDesc')} />
      {error && <ErrorState message={error} onRetry={fetchData} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('maintenance.noActiveDowntime')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.activeDowntimeLogs')} ({data.length})</h3></CardHeader>
          <DataTable columns={columns} data={data} keyExtractor={(d: DowntimeLog) => d.id} />
        </Card>
      )}
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={execAction}
        title={t('common.confirm')} message={`${t('maintenance.confirmAction')}: ${pendingAction}`}
        variant={pendingAction === 'cancel' ? 'danger' : 'primary'} loading={actionLoading} />
    </div>
  );
}
