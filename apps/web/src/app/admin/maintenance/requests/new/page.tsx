'use client';
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Select, Textarea, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, machineAdapter, userAdapter, productionLineAdapter, machineComponentAdapter, operationTypeAdapter, costCenterAdapter, sparePartAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

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

export default function CreateMaintenanceRequestPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ machineId: '', type: 'CORRECTIVE', priority: 'MEDIUM', title: '', description: '', assignedToId: '', notes: '', productionLineId: '', machineComponentId: '', operationTypeId: '', costCenterId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [requiredParts, setRequiredParts] = useState<Array<{sparePartId: string; quantity: string; unit: string; usageNote: string; isPrimary: boolean}>>([]);

  const addRequiredPart = () => {
    setRequiredParts(prev => [...prev, { sparePartId: '', quantity: '1', unit: '', usageNote: '', isPrimary: false }]);
  };

  const updateRequiredPart = (index: number, field: string, value: any) => {
    setRequiredParts(prev => prev.map((part, i) => i === index ? { ...part, [field]: value } : part));
    setDirty(true);
  };

  const removeRequiredPart = (index: number) => {
    setRequiredParts(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const setField = (field: string, value: any) => {
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
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { machineId: form.machineId, type: form.type, title: form.title.trim() };
      if (form.priority) payload.priority = form.priority;
      if (form.description) payload.description = form.description.trim();
      if (form.assignedToId) payload.assignedToId = form.assignedToId;
      if (form.notes) payload.notes = form.notes.trim();
      if (form.productionLineId) payload.productionLineId = form.productionLineId;
      if (form.machineComponentId) payload.machineComponentId = form.machineComponentId;
      if (form.operationTypeId) payload.operationTypeId = form.operationTypeId;
      if (form.costCenterId) payload.costCenterId = form.costCenterId;
      if (requiredParts.length > 0) {
        payload.requiredParts = requiredParts.map(p => ({
          sparePartId: p.sparePartId,
          quantity: Number(p.quantity) || 1,
          ...(p.unit ? { unit: p.unit } : {}),
          ...(p.usageNote ? { usageNote: p.usageNote } : {}),
          isPrimary: p.isPrimary,
        }));
      }
      const res = await api.post<{ data: { id: string } }>('/maintenance/requests', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/maintenance/requests/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ machineId: '', type: 'CORRECTIVE', priority: 'MEDIUM', title: '', description: '', assignedToId: '', notes: '', productionLineId: '', machineComponentId: '', operationTypeId: '', costCenterId: '' }); setErrors({}); setDirty(false); setRequiredParts([]); },
    save: () => handleSave(),
    cancel: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.requestInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.title')} value={form.title} onChange={(e) => setField('title', e.target.value)} error={errors.title} required />
              <Select label={t('maintenance.type')} value={form.type} onChange={(e) => setField('type', e.target.value)} options={REQUEST_TYPES} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('maintenance.priority')} value={form.priority} onChange={(e) => setField('priority', e.target.value)} options={PRIORITY_OPTIONS} />
            </div>
            <Textarea label={t('maintenance.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} />

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
                      <Input label={t('maintenance.partRequiredQuantity')} type="number" min="1" value={part.quantity} onChange={(e) => updateRequiredPart(index, 'quantity', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label={t('maintenance.unit')} value={part.unit} onChange={(e) => updateRequiredPart(index, 'unit', e.target.value)} />
                      <div className="flex items-center gap-2 pt-6">
                        <input type="checkbox" id={`isPrimary-${index}`} checked={part.isPrimary} onChange={(e) => updateRequiredPart(index, 'isPrimary', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor={`isPrimary-${index}`} className="text-sm text-gray-700">{t('maintenance.isPrimary') || 'Primary'}</label>
                      </div>
                    </div>
                    <Textarea label={t('maintenance.partUsageNote')} value={part.usageNote} onChange={(e) => updateRequiredPart(index, 'usageNote', e.target.value)} />
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
            <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
