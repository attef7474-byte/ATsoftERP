'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../../components/maintenance';
import { F9Lookup, maintenanceRequestAdapter, userAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../../components/admin/admin-action-bar';
import type { MaintenanceTask } from '../../../../../../lib/admin-types';

export default function EditMaintenanceTaskPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const id = params?.id as string;
  const [data, setData] = useState<MaintenanceTask | null>(null);
  const [form, setForm] = useState({ requestId: '', title: '', description: '', assignedToId: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isReadOnly = data?.status !== 'PENDING';

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MaintenanceTask }>(`/maintenance/tasks/${id}`);
      const item = res.data;
      setData(item);
      setForm({ requestId: item.requestId || '', title: item.title || '', description: item.description || '', assignedToId: item.assignedToId || '', notes: item.notes || '' });
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
    if (!form.requestId) errs.requestId = t('complexForms.requiredField');
    if (!form.title.trim()) errs.title = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (isReadOnly || !validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (form.requestId !== data?.requestId) payload.requestId = form.requestId;
      if (form.title.trim() !== data?.title) payload.title = form.title.trim();
      if (form.description !== data?.description) payload.description = form.description.trim() || null;
      if (form.assignedToId !== data?.assignedToId) payload.assignedToId = form.assignedToId || null;
      if (form.notes !== data?.notes) payload.notes = form.notes.trim() || null;
      await api.patch(`/maintenance/tasks/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/maintenance/tasks/${id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => fetchData(),
    save: () => handleSave(),
    cancel: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving && !isReadOnly },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('complexForms.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          {t('complexForms.readOnlyRecord')}
        </div>
      )}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('maintenance.editMaintenanceTask')}</h1>
              <p className="text-sm text-gray-500">{data.title}</p>
            </div>
            <CmmsStatusBadge status={data.status} />
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('maintenance.taskInformation')}</h2>
            <div className="grid grid-cols-1 gap-4">
              <Input label={t('common.title')} value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} required disabled={isReadOnly} />
            </div>
            <Textarea label={t('common.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} disabled={isReadOnly} />
            <F9Lookup label={t('maintenance.maintenanceRequest')} value={form.requestId} onChange={(v) => setField('requestId', v)} adapter={maintenanceRequestAdapter} error={errors.requestId} />
            <F9Lookup label={t('maintenance.assignedTo')} value={form.assignedToId} onChange={(v) => setField('assignedToId', v)} adapter={userAdapter} />
            <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} disabled={isReadOnly} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
