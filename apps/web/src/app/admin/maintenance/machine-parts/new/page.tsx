'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, machineAdapter, productAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateMachinePartPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: '', description: '',
    unit: '', unitPrice: '', stockQuantity: 0, minimumStock: 0,
    machineId: '', productId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const setField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
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
      const payload: Record<string, any> = {
        name: form.name.trim(),
        stockQuantity: form.stockQuantity,
        minimumStock: form.minimumStock,
      };
      if (form.description) payload.description = form.description.trim();
      if (form.unit) payload.unit = form.unit;
      if (form.unitPrice) payload.unitPrice = parseFloat(form.unitPrice);
      if (form.machineId) payload.machineId = form.machineId;
      if (form.productId) payload.productId = form.productId;
      const res = await api.post<{ data: { id: string } }>('/maintenance/machine-parts', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/maintenance/machine-parts/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ name: '', description: '', unit: '', unitPrice: '', stockQuantity: 0, minimumStock: 0, machineId: '', productId: '' }); setErrors({}); setDirty(false); },
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
            <Textarea label={t('common.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.stockInformation')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('maintenance.unit')} value={form.unit} onChange={(e) => setField('unit', e.target.value)} />
            <Input label={t('maintenance.unitPrice')} type="number" value={form.unitPrice} onChange={(e) => setField('unitPrice', e.target.value)} />
            <Input label={t('maintenance.stockQuantity')} type="number" value={String(form.stockQuantity)} onChange={(e) => setField('stockQuantity', parseInt(e.target.value) || 0)} />
            <Input label={t('maintenance.minimumStock')} type="number" value={String(form.minimumStock)} onChange={(e) => setField('minimumStock', parseInt(e.target.value) || 0)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.linkedEntities')}</h2>
          <div className="space-y-4">
            <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setField('machineId', v)} adapter={machineAdapter} />
            <F9Lookup label={t('inventory.product')} value={form.productId} onChange={(v) => setField('productId', v)} adapter={productAdapter} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
