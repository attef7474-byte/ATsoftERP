'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Card, CardContent, CardHeader, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon } from '../../../../../../components/admin/admin-action-bar';
import type { Machine } from '../../../../../../lib/admin-types';

export default function MachineManufacturerPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<Machine | null>(null);
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: Machine }>(`/maintenance/machines/${id}`);
      setData(res.data);
      setManufacturer(res.data.manufacturer || '');
      setModel(res.data.model || '');
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/maintenance/machines/${id}/manufacturer`, {
        manufacturer: manufacturer.trim() || null,
        model: model.trim() || null,
      });
      showToast(t('common.successUpdated'), 'success');
      router.push(`/admin/maintenance/machines/${id}`);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.push(`/admin/maintenance/machines/${id}`),
    refresh: () => fetchData(),
    save: () => handleSave(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold text-gray-900">{t('maintenance.manufacturer')}</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">[{data.code}] {data.name}</p>
          {(data.manufacturer || data.model) && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
              {data.manufacturer && <div><span className="font-medium text-gray-700">{t('maintenance.manufacturer')}: </span><span className="text-gray-900">{data.manufacturer}</span></div>}
              {data.model && <div><span className="font-medium text-gray-700">{t('maintenance.model')}: </span><span className="text-gray-900">{data.model}</span></div>}
            </div>
          )}
          <div className="space-y-4">
            <Input label={t('maintenance.manufacturer')} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder={t('maintenance.manufacturer')} />
            <Input label={t('maintenance.model')} value={model} onChange={(e) => setModel(e.target.value)} placeholder={t('maintenance.model')} />
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
