'use client';
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateInventoryCountPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ companyId: '', branchId: '', warehouseId: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const setField = (field: string, value: any) => {
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
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { companyId: form.companyId, warehouseId: form.warehouseId };
      if (form.branchId) payload.branchId = form.branchId;
      if (form.notes) payload.notes = form.notes.trim();
      const res = await api.post<{ data: { id: string } }>('/inventory/counts', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/inventory/counts/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ companyId: '', branchId: '', warehouseId: '', notes: '' }); setErrors({}); setDirty(false); },
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
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.countHeader')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => { setField('companyId', v); }} adapter={companyAdapter} error={errors.companyId} />
              <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setField('branchId', v)} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
            </div>
            <F9Lookup label={t('inventory.warehouse')} value={form.warehouseId} onChange={(v) => setField('warehouseId', v)} adapter={warehouseAdapter} error={errors.warehouseId} />
            <Textarea label={t('inventoryCounting.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
