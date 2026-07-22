'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { DowntimeLog } from '../../../../../../lib/admin-types';
import { Button, Input, Textarea, Card, CardContent, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { F9Lookup, machineAdapter, maintenanceRequestAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon, ActionViewIcon } from '../../../../../../components/admin/admin-action-bar';

export default function EditDowntimeLogPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const id = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ machineId: '', requestId: '', startTime: '', endTime: '', reason: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const hasEndTime = !!data?.endTime;
  const isCancelled = !!data?.cancelledAt;
  const isReadOnly = hasEndTime || isCancelled;

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/maintenance/downtime-logs/${id}`);
      const item = res;
      setData(item);
      setForm({
        machineId: item.machineId || '',
        requestId: item.requestId || '',
        startTime: item.startTime ? new Date(item.startTime).toISOString().slice(0, 16) : '',
        endTime: item.endTime ? new Date(item.endTime).toISOString().slice(0, 16) : '',
        reason: item.reason || '',
        notes: item.notes || '',
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('complexForms.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (field: string, value: any) => {
    if (isReadOnly) return;
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.machineId) errs.machineId = t('complexForms.requiredField');
    if (!form.reason.trim()) errs.reason = t('complexForms.requiredField');
    if (!form.startTime) errs.startTime = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (isReadOnly || !validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (form.machineId !== data?.machineId) payload.machineId = form.machineId;
      if (form.requestId !== data?.requestId) payload.requestId = form.requestId || null;
      if (form.startTime !== (data?.startTime ? new Date(data.startTime).toISOString().slice(0, 16) : '')) {
        payload.startTime = new Date(form.startTime).toISOString();
      }
      if (form.reason.trim() !== data?.reason) payload.reason = form.reason.trim();
      if (form.notes !== data?.notes) payload.notes = form.notes.trim() || null;
      await api.patch(`/maintenance/downtime-logs/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/maintenance/downtime-logs`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => fetchData(),
    save: () => handleSave(),
    saveAndView: () => handleSave(),
    cancel: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving && !isReadOnly },
    { id: 'saveAndView', labelKey: 'complexForms.saveAndView', icon: <ActionViewIcon />, onClick: () => exec('saveAndView'), enabled: !saving && !isReadOnly },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('complexForms.notFound')} onRetry={() => router.back()} />;

  const computedStatus = isCancelled ? 'CANCELLED' : hasEndTime ? 'CLOSED' : 'ACTIVE';
  const durationDisplay = data.durationMinutes ? `${data.durationMinutes} min` : data.durationHours ? `${data.durationHours} hrs` : '-';

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          {isCancelled ? t('complexForms.cancelledRecordReadOnly') : t('complexForms.completedRecordReadOnly')}
        </div>
      )}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('complexForms.editDowntimeLog')}</h1>
              <p className="text-sm text-gray-500">{data.machine?.name || data.machineId}</p>
            </div>
            <StatusBadge status={computedStatus} />
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.downtimeInformation')}</h2>
            <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setField('machineId', v)} adapter={machineAdapter} error={errors.machineId} />
            <F9Lookup label={t('maintenance.maintenanceRequest')} value={form.requestId} onChange={(v) => setField('requestId', v)} adapter={maintenanceRequestAdapter} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('inventoryCounting.startedAt')} type="datetime-local" value={form.startTime} onChange={(e) => setField('startTime', e.target.value)} error={errors.startTime} required disabled={isReadOnly} />
              <Input label={t('maintenance.endTime')} type="datetime-local" value={form.endTime} onChange={(e) => setField('endTime', e.target.value)} disabled />
            </div>

            <div className="text-sm text-gray-600">
              <span className="font-medium">{t('maintenance.duration')}:</span> {durationDisplay}
            </div>

            <Input label={t('maintenance.reason')} value={form.reason} onChange={(e) => setField('reason', e.target.value)} error={errors.reason} required disabled={isReadOnly} />
            <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} disabled={isReadOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('complexForms.metadata')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div><span className="font-medium">{t('common.createdAt')}:</span> {new Date(data.createdAt).toLocaleString()}</div>
            <div><span className="font-medium">{t('common.updatedAt')}:</span> {new Date(data.updatedAt).toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
