'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon, ActionViewIcon } from '../../../../../../components/admin/admin-action-bar';
import type { InventoryCount } from '../../../../../../lib/admin-types';

export default function EditInventoryCountPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const id = params?.id as string;
  const [data, setData] = useState<InventoryCount | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', warehouseId: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isReadOnly = data?.status === 'COMPLETED' || data?.status === 'CANCELLED' || !!data?.cancelledAt;
  const isInProgress = data?.status === 'IN_PROGRESS';

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/inventory/counts/${id}`);
      const item = res;
      setData(item);
      setForm({ companyId: item.companyId || '', branchId: item.branchId || '', warehouseId: item.warehouseId || '', notes: item.notes || '' });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('complexForms.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (field: string, value: any) => {
    if (isReadOnly) return;
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'companyId') { setForm(prev => ({ ...prev, branchId: '' })); }
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.companyId) errs.companyId = t('complexForms.requiredField');
    if (!form.warehouseId) errs.warehouseId = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (isReadOnly || !validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (!isInProgress && form.companyId !== data?.companyId) payload.companyId = form.companyId;
      if (!isInProgress && form.branchId !== data?.branchId) payload.branchId = form.branchId || null;
      if (!isInProgress && form.warehouseId !== data?.warehouseId) payload.warehouseId = form.warehouseId;
      if (form.notes !== data?.notes) payload.notes = form.notes.trim() || null;
      await api.patch(`/inventory/counts/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/inventory/counts/${id}`);
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
    goToExecute: () => router.push(`/admin/inventory/counts/${id}/execute`),
    goToReview: () => router.push(`/admin/inventory/counts/${id}/review`),
    goToApprove: () => router.push(`/admin/inventory/counts/${id}/approve`),
    goToAdjustment: () => router.push(`/admin/inventory/counts/${id}/adjust`),
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
              <h1 className="text-lg font-semibold text-gray-900">{t('complexForms.editInventoryCount')}</h1>
              <p className="text-sm text-gray-500">[{data.countNumber}]</p>
            </div>
            {data.status && <StatusBadge status={data.status} />}
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.countHeader')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setField('companyId', v)} adapter={companyAdapter} error={errors.companyId} />
              <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setField('branchId', v)} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
            </div>
            <F9Lookup label={t('inventory.warehouse')} value={form.warehouseId} onChange={(v) => setField('warehouseId', v)} adapter={warehouseAdapter} error={errors.warehouseId} />
            <Textarea label={t('inventoryCounting.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} disabled={isReadOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('complexForms.linkedWorkflows')}</h2>
          <div className="flex flex-wrap gap-2">
            {(data.status === 'DRAFT' || data.status === 'IN_PROGRESS') && (
              <Button variant="secondary" size="sm" onClick={() => exec('goToExecute')}>{t('complexForms.goToExecute')}</Button>
            )}
            {data.status === 'IN_PROGRESS' && (
              <Button variant="secondary" size="sm" onClick={() => exec('goToReview')}>{t('complexForms.goToReview')}</Button>
            )}
            {data.status === 'IN_PROGRESS' && (
              <Button variant="secondary" size="sm" onClick={() => exec('goToApprove')}>{t('complexForms.goToApprove')}</Button>
            )}
            {data.status === 'COMPLETED' && (
              <Button variant="secondary" size="sm" onClick={() => exec('goToAdjustment')}>{t('complexForms.goToAdjustment')}</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('complexForms.metadata')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div><span className="font-medium">{t('common.createdAt')}:</span> {new Date(data.createdAt).toLocaleString()}</div>
            <div><span className="font-medium">{t('common.updatedAt')}:</span> {new Date(data.updatedAt).toLocaleString()}</div>
            {data.startedAt && <div><span className="font-medium">{t('inventoryCounting.startedAt')}:</span> {new Date(data.startedAt).toLocaleString()}</div>}
            {data.completedAt && <div><span className="font-medium">{t('inventoryCounting.completedAt')}:</span> {new Date(data.completedAt).toLocaleString()}</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
