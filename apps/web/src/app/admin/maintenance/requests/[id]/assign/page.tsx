'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { MaintenanceRequest } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, LoadingState, ErrorState, Button } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon } from '../../../../../../components/admin/admin-action-bar';
import { F9Lookup, userAdapter } from '../../../../../../components/f9';
import { useApiErrorHandler } from '../../../../../../components/admin/error-handler';

export default function AssignTechnicianPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const id = params.id as string;
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<MaintenanceRequest>(`/maintenance/requests/${id}`);
      setRequest(res);
      if (res.assignedToId) setAssignedToId(res.assignedToId);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!assignedToId) errors.assignedToId = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await api.patch(`/maintenance/requests/${id}/assign`, { assignedToId });
      showToast(t('maintenanceWorkflow.assignSuccess'), 'success');
      router.back();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    save: () => handleSave(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'save', labelKey: 'common.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !!assignedToId },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceWorkflow.assignTechnician')}</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">{t('maintenanceWorkflow.assignDescription')}</p>
          {request && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm"><span className="font-medium">{t('maintenance.requestNumber')}:</span> {request.requestNumber}</p>
              <p className="text-sm"><span className="font-medium">{t('maintenance.machine')}:</span> {request.machine?.name || '-'}</p>
              {request.assignedTo && <p className="text-sm"><span className="font-medium">{t('maintenanceWorkflow.currentAssignee')}:</span> {request.assignedTo.name}</p>}
            </div>
          )}
          <div>
            <F9Lookup label={t('maintenanceWorkflow.selectTechnician')} value={assignedToId} onChange={(v) => { setAssignedToId(v); setValidationErrors(prev => ({ ...prev, assignedToId: '' })); }} adapter={userAdapter} />
            {validationErrors.assignedToId && <p className="text-red-500 text-sm mt-1">{validationErrors.assignedToId}</p>}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => router.back()}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
