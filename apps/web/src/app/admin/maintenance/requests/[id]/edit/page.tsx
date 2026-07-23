'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Select, Textarea, Card, CardContent, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { F9Lookup, machineAdapter, userAdapter, productionLineAdapter, machineComponentAdapter, operationTypeAdapter, costCenterAdapter, sparePartAdapter } from '../../../../../../components/f9';
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
  const [form, setForm] = useState({ machineId: '', type: 'CORRECTIVE', priority: 'MEDIUM', title: '', description: '', assignedToId: '', notes: '', productionLineId: '', machineComponentId: '', operationTypeId: '', costCenterId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [requiredParts, setRequiredParts] = useState<Array<{id?: string; sparePartId: string; quantity: string; unit: string; usageNote: string; isPrimary: boolean}>>([]);

  const isReadOnly = data?.status === 'COMPLETED' || data?.status === 'CANCELLED';

  const addRequiredPart = () => {
    setRequiredParts(prev => [...prev, { sparePartId: '', quantity: '1', unit: '', usageNote: '', isPrimary: false }]);
  };

  const updateRequiredPart = (index: number, field: string, value: any) => {
    if (isReadOnly) return;
    setRequiredParts(prev => prev.map((part, i) => i === index ? { ...part, [field]: value } : part));
    setDirty(true);
  };

  const removeRequiredPart = (index: number) => {
    if (isReadOnly) return;
    setRequiredParts(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/maintenance/requests/${id}`);
      const item = res;
      setData(item);
      setForm({ machineId: item.machineId || '', type: item.type || 'CORRECTIVE', priority: item.priority || 'MEDIUM', title: item.title || '', description: item.description || '', assignedToId: item.assignedToId || '', notes: item.notes || '', productionLineId: (item as any).productionLineId || '', machineComponentId: (item as any).machineComponentId || '', operationTypeId: (item as any).operationTypeId || '', costCenterId: (item as any).costCenterId || '' });
      setRequiredParts((item as any).requiredParts?.map((p: any) => ({
        id: p.id,
        sparePartId: p.sparePartId || '',
        quantity: p.quantity?.toString() || '1',
        unit: p.unit || '',
        usageNote: p.usageNote || '',
        isPrimary: p.isPrimary || false,
      })) || []);
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
      if (form.productionLineId !== (data as any)?.productionLineId) payload.productionLineId = form.productionLineId || null;
      if (form.machineComponentId !== (data as any)?.machineComponentId) payload.machineComponentId = form.machineComponentId || null;
      if (form.operationTypeId !== (data as any)?.operationTypeId) payload.operationTypeId = form.operationTypeId || null;
      if (form.costCenterId !== (data as any)?.costCenterId) payload.costCenterId = form.costCenterId || null;
      if (requiredParts.length > 0) {
        payload.requiredParts = requiredParts.map(p => ({
          ...(p.id ? { id: p.id } : {}),
          sparePartId: p.sparePartId,
          quantity: Number(p.quantity) || 1,
          ...(p.unit ? { unit: p.unit } : {}),
          ...(p.usageNote ? { usageNote: p.usageNote } : {}),
          isPrimary: p.isPrimary,
        }));
      }
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

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('maintenance.operationalContext')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('maintenance.productionLine')} value={form.productionLineId} onChange={(v) => setField('productionLineId', v)} adapter={productionLineAdapter} />
              <F9Lookup label={t('maintenance.machineComponent')} value={form.machineComponentId} onChange={(v) => setField('machineComponentId', v)} adapter={machineComponentAdapter} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('maintenance.operationType')} value={form.operationTypeId} onChange={(v) => setField('operationTypeId', v)} adapter={operationTypeAdapter} />
              <F9Lookup label={t('maintenance.costCenter')} value={form.costCenterId} onChange={(v) => setField('costCenterId', v)} adapter={costCenterAdapter} />
            </div>

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('maintenance.requiredSpareParts')}</h2>
            {requiredParts.length > 0 ? (
              <div className="space-y-4">
                {requiredParts.map((part, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{t('maintenance.requiredPart')} #{index + 1}</span>
                      <Button variant="danger" size="sm" onClick={() => removeRequiredPart(index)}>{t('actions.remove')}</Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <F9Lookup label={t('maintenance.selectSparePart')} value={part.sparePartId} onChange={(v) => updateRequiredPart(index, 'sparePartId', v)} adapter={sparePartAdapter} />
                      <Input label={t('maintenance.partRequiredQuantity')} type="number" min="1" value={part.quantity} onChange={(e) => updateRequiredPart(index, 'quantity', e.target.value)} disabled={isReadOnly} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label={t('maintenance.unit')} value={part.unit} onChange={(e) => updateRequiredPart(index, 'unit', e.target.value)} disabled={isReadOnly} />
                      <div className="flex items-center gap-2 pt-6">
                        <input type="checkbox" id={`isPrimary-${index}`} checked={part.isPrimary} onChange={(e) => updateRequiredPart(index, 'isPrimary', e.target.checked)} disabled={isReadOnly} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor={`isPrimary-${index}`} className="text-sm text-gray-700">{t('maintenance.isPrimary') || 'Primary'}</label>
                      </div>
                    </div>
                    <Textarea label={t('maintenance.partUsageNote')} value={part.usageNote} onChange={(e) => updateRequiredPart(index, 'usageNote', e.target.value)} disabled={isReadOnly} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('maintenance.noRequiredSpareParts')}</p>
            )}
            <div className="mt-4">
              <Button variant="secondary" onClick={addRequiredPart}>{t('maintenance.addRequiredPart')}</Button>
            </div>

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
