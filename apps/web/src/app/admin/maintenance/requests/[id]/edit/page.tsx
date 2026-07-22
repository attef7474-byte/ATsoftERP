'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Select, Textarea, Card, CardContent, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { F9Lookup, machineAdapter, userAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon, ActionViewIcon } from '../../../../../../components/admin/admin-action-bar';
import type { MaintenanceRequest } from '../../../../../../lib/admin-types';

const REQUEST_TYPES = [
  { value: 'CORRECTIVE', label: 'Corrective' },
  { value: 'PREVENTIVE', label: 'Preventive' },
  { value: 'PREDICTIVE', label: 'Predictive' },
  { value: 'EMERGENCY', label: 'Emergency' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function EditMaintenanceRequestPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const id = params?.id as string;
  const [data, setData] = useState<MaintenanceRequest | null>(null);
  const [form, setForm] = useState({ machineId: '', type: 'CORRECTIVE', priority: 'MEDIUM', title: '', description: '', assignedToId: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isReadOnly = data?.status === 'COMPLETED' || data?.status === 'CANCELLED';

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/maintenance/requests/${id}`);
      const item = res;
      setData(item);
      setForm({ machineId: item.machineId || '', type: item.type || 'CORRECTIVE', priority: item.priority || 'MEDIUM', title: item.title || '', description: item.description || '', assignedToId: item.assignedToId || '', notes: item.notes || '' });
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
    if (!form.title.trim()) errs.title = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (isReadOnly || !validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (form.machineId !== data?.machineId) payload.machineId = form.machineId;
      if (form.type !== data?.type) payload.type = form.type;
      if (form.priority !== data?.priority) payload.priority = form.priority;
      if (form.title.trim() !== data?.title) payload.title = form.title.trim();
      if (form.description !== data?.description) payload.description = form.description.trim() || null;
      if (form.assignedToId !== data?.assignedToId) payload.assignedToId = form.assignedToId || null;
      if (form.notes !== data?.notes) payload.notes = form.notes.trim() || null;
      await api.patch(`/maintenance/requests/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/maintenance/requests/${id}`);
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

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          {data?.status === 'COMPLETED' ? t('complexForms.completedRecordReadOnly') : data?.status === 'CANCELLED' ? t('complexForms.cancelledRecordReadOnly') : t('complexForms.readOnlyRecord')}
        </div>
      )}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('complexForms.editMaintenanceRequest')}</h1>
              <p className="text-sm text-gray-500">[{data.requestNumber}] {data.title}</p>
            </div>
            {data.status && <StatusBadge status={data.status} />}
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.requestInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.title')} value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} required disabled={isReadOnly} />
              <Select label={t('maintenance.type')} value={form.type} onChange={(e) => setField('type', e.target.value)} options={REQUEST_TYPES} disabled={isReadOnly} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('maintenance.priority')} value={form.priority} onChange={(e) => setField('priority', e.target.value)} options={PRIORITY_OPTIONS} disabled={isReadOnly} />
              <Input label={t('maintenance.status')} value={data.status} disabled />
            </div>
            <Textarea label={t('maintenance.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} disabled={isReadOnly} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('maintenance.machine')}</h2>
            <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setField('machineId', v)} adapter={machineAdapter} error={errors.machineId} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.assignment')}</h2>
            <F9Lookup label={t('maintenance.assignedTo')} value={form.assignedToId} onChange={(v) => setField('assignedToId', v)} adapter={userAdapter} />
            <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} disabled={isReadOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('complexForms.linkedWorkflows')}</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/maintenance/requests/${id}/assign`)}>{t('complexForms.goToAssign')}</Button>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/maintenance/requests/${id}/parts`)}>{t('complexForms.goToParts')}</Button>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/maintenance/requests/${id}/cost`)}>{t('complexForms.goToCost')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
