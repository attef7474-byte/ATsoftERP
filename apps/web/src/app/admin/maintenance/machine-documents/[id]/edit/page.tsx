'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { F9Lookup, machineAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon, ActionViewIcon } from '../../../../../../components/admin/admin-action-bar';
import type { MachineDocument } from '../../../../../../lib/admin-types';

export default function EditMachineDocumentPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const id = params?.id as string;
  const [data, setData] = useState<MachineDocument | null>(null);
  const [form, setForm] = useState({
    fileName: '', fileUrl: '', fileSize: 0, mimeType: '',
    description: '', machineId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/maintenance/machine-documents/${id}`);
      const item = res;
      setData(item);
      setForm({
        fileName: item.fileName || '',
        fileUrl: item.fileUrl || '',
        fileSize: item.sizeBytes ?? 0,
        mimeType: item.mimeType || '',
        description: item.description || '',
        machineId: item.machineId || '',
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('complexForms.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.fileName.trim()) errs.fileName = t('complexForms.requiredField');
    if (!form.fileUrl.trim()) errs.fileUrl = t('complexForms.requiredField');
    if (!form.machineId) errs.machineId = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (form.fileName.trim() !== (data?.fileName || '')) payload.fileName = form.fileName.trim();
      if (form.fileUrl.trim() !== (data?.fileUrl || '')) payload.fileUrl = form.fileUrl.trim();
      if (form.fileSize !== (data?.sizeBytes ?? 0)) payload.fileSize = form.fileSize;
      if (form.mimeType !== (data?.mimeType || '')) payload.mimeType = form.mimeType.trim() || null;
      if (form.description !== (data?.description || '')) payload.description = form.description.trim() || null;
      if (form.machineId !== (data?.machineId || '')) payload.machineId = form.machineId;
      await api.patch(`/maintenance/machine-documents/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/maintenance/machine-documents/${id}`);
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
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving },
    { id: 'saveAndView', labelKey: 'complexForms.saveAndView', icon: <ActionViewIcon />, onClick: () => exec('saveAndView'), enabled: !saving },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('complexForms.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="mb-4">
            <h1 className="text-lg font-semibold text-gray-900">{t('maintenance.editMachineDocument')}</h1>
            <p className="text-sm text-gray-500">{data.fileName || data.title}</p>
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.basicInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.fileName')} value={form.fileName} onChange={(e) => setField('fileName', e.target.value)} error={errors.fileName} required />
              <Input label={t('maintenance.fileUrl')} value={form.fileUrl} onChange={(e) => setField('fileUrl', e.target.value)} error={errors.fileUrl} required />
              <Input label={t('maintenance.fileSize')} type="number" value={String(form.fileSize)} onChange={(e) => setField('fileSize', parseInt(e.target.value) || 0)} />
              <Input label={t('maintenance.mimeType')} value={form.mimeType} onChange={(e) => setField('mimeType', e.target.value)} />
            </div>
            <Textarea label={t('common.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.linkedEntities')}</h2>
          <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setField('machineId', v)} adapter={machineAdapter} error={errors.machineId} />
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
