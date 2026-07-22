'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Card, CardContent, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../../components/maintenance';
import { F9Lookup, userAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionSaveIcon } from '../../../../../../components/admin/admin-action-bar';
import type { MaintenanceTask } from '../../../../../../lib/admin-types';

export default function AssignMaintenanceTaskPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const id = params?.id as string;
  const [data, setData] = useState<MaintenanceTask | null>(null);
  const [assignedToId, setAssignedToId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/maintenance/tasks/${id}`);
      const item = res;
      setData(item);
      setAssignedToId(item.assignedToId || '');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('complexForms.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAssign = async () => {
    if (!assignedToId) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      await api.patch(`/maintenance/tasks/${id}/assign`, { assignedToId });
      showToast(t('common.successUpdated'), 'success');
      router.push(`/admin/maintenance/tasks/${id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    save: () => handleAssign(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('complexForms.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('maintenance.assignTask')}</h1>
              <p className="text-sm text-gray-500">{data.title}</p>
            </div>
            <CmmsStatusBadge status={data.status} />
          </div>

          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('maintenance.currentAssignee')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.assignedTo?.name || t('common.notAssigned')}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('maintenance.maintenanceRequest')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.request ? `[${data.request.requestNumber}] ${data.request.title}` : '-'}</dd>
            </div>
          </dl>

          <div className="space-y-4">
            <F9Lookup label={t('maintenance.selectAssignee')} value={assignedToId} onChange={setAssignedToId} adapter={userAdapter} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => router.back()}>{t('actions.cancel')}</Button>
              <Button onClick={handleAssign} loading={saving}>{t('maintenance.assign')}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
