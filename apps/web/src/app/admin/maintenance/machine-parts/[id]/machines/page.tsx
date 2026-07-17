'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { MachinePart, Machine } from '../../../../../../lib/admin-types';
import { Button, Card, CardContent, CardHeader, LoadingState, ErrorState, PageHeader } from '../../../../../../components/admin/ui';
import { F9Lookup, machineAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';

export default function MachinePartMachinesPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [part, setPart] = useState<MachinePart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linking, setLinking] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [unlinking, setUnlinking] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MachinePart }>(`/maintenance/machine-parts/${id}`);
      setPart(res.data);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLink = async () => {
    if (!selectedMachineId) { showToast(t('validation.required'), 'error'); return; }
    setLinking(true);
    try {
      await api.post(`/maintenance/machine-parts/${id}/machines`, { machineId: selectedMachineId });
      showToast(t('common.successUpdated'), 'success');
      fetchData();
      setSelectedMachineId('');
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('errors.updateFailed'), 'error');
    } finally { setLinking(false); }
  };

  const handleUnlink = async () => {
    if (!confirm(t('maintenance.confirmUnlinkMachine'))) return;
    setUnlinking(true);
    try {
      await api.delete(`/maintenance/machine-parts/${id}/machines`);
      showToast(t('common.successUpdated'), 'success');
      fetchData();
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('errors.updateFailed'), 'error');
    } finally { setUnlinking(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!part) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const currentMachine = part.machine;

  return (
    <div className="space-y-6">
      <PageHeader title={t('maintenance.machineLinking')} subtitle={`${part.name} [${part.code}]`} />

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.currentMachine')}</h3></CardHeader>
        <CardContent>
          {currentMachine ? (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">[{currentMachine.code}] {currentMachine.name}</p>
                <button onClick={() => router.push(`/admin/maintenance/machines/${currentMachine.id}`)} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                  {t('actions.view')}
                </button>
              </div>
              <Button variant="danger" size="sm" onClick={handleUnlink} loading={unlinking}>
                {t('maintenance.unlinkMachine')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4">{t('maintenance.noMachineLinked')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('maintenance.linkToMachine')}</h3></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <F9Lookup label={t('maintenance.machine')} value={selectedMachineId} onChange={setSelectedMachineId} adapter={machineAdapter} />
            <div className="flex justify-end">
              <Button onClick={handleLink} loading={linking} disabled={!selectedMachineId || !!currentMachine}>
                {t('maintenance.linkMachine')}
              </Button>
            </div>
            {currentMachine && (
              <p className="text-xs text-gray-500">{t('maintenance.unlinkBeforeLinking')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
