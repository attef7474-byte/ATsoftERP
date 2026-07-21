'use client';
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, machineCategoryAdapter, companyAdapter, branchAdapter, departmentAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateMachinePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', categoryId: '', companyId: '', branchId: '', departmentId: '', model: '', serialNumber: '', manufacturer: '', location: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const setField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'companyId') { setForm(prev => ({ ...prev, branchId: '', departmentId: '' })); }
    if (field === 'branchId') { setForm(prev => ({ ...prev, departmentId: '' })); }
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { name: form.name.trim() };
      if (form.categoryId) payload.categoryId = form.categoryId;
      if (form.companyId) payload.companyId = form.companyId;
      if (form.branchId) payload.branchId = form.branchId;
      if (form.departmentId) payload.departmentId = form.departmentId;
      if (form.model) payload.model = form.model.trim();
      if (form.serialNumber) payload.serialNumber = form.serialNumber.trim();
      if (form.manufacturer) payload.manufacturer = form.manufacturer.trim();
      if (form.location) payload.location = form.location.trim();
      if (form.notes) payload.notes = form.notes.trim();
      const res = await api.post<{ data: { id: string } }>('/maintenance/machines', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/maintenance/machines/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ name: '', categoryId: '', companyId: '', branchId: '', departmentId: '', model: '', serialNumber: '', manufacturer: '', location: '', notes: '' }); setErrors({}); setDirty(false); },
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
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.basicInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.name')} value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required />
            </div>

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.classification')}</h2>
            <F9Lookup label={t('maintenance.machineCategory')} value={form.categoryId} onChange={(v) => setField('categoryId', v)} adapter={machineCategoryAdapter} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.organization')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setField('companyId', v)} adapter={companyAdapter} />
              <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setField('branchId', v)} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
              <F9Lookup label={t('core.department')} value={form.departmentId} onChange={(v) => setField('departmentId', v)} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} />
            </div>

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.technicalInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label={t('maintenance.model')} value={form.model} onChange={(e) => setField('model', e.target.value)} />
              <Input label={t('maintenance.serialNumber')} value={form.serialNumber} onChange={(e) => setField('serialNumber', e.target.value)} />
              <Input label={t('maintenance.manufacturer')} value={form.manufacturer} onChange={(e) => setField('manufacturer', e.target.value)} />
            </div>
            <Input label={t('maintenance.location')} value={form.location} onChange={(e) => setField('location', e.target.value)} />
            <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
