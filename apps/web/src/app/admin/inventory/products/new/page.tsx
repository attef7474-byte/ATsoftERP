'use client';
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, productCategoryAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateProductPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', description: '', categoryId: '', unit: 'pcs', barcode: '', minStock: 0, maxStock: 0 });
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
    if (!form.unit.trim()) errs.unit = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: any = { name: form.name.trim(), unit: form.unit.trim() };
      if (form.description) payload.description = form.description.trim();
      if (form.categoryId) payload.categoryId = form.categoryId;
      if (form.barcode) payload.barcode = form.barcode.trim();
      payload.minStock = Number(form.minStock) || 0;
      payload.maxStock = Number(form.maxStock) || 0;
      const res = await api.post<{ data: { id: string } }>('/products', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/inventory/products/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ name: '', description: '', categoryId: '', unit: 'pcs', barcode: '', minStock: 0, maxStock: 0 }); setErrors({}); setDirty(false); },
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
              <Input label={t('inventory.name')} value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required />
            </div>
            <Textarea label={t('inventory.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.classification')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('inventory.productCategory')} value={form.categoryId} onChange={(v) => setField('categoryId', v)} adapter={productCategoryAdapter} />
              <Input label={t('inventory.unit')} value={form.unit} onChange={(e) => setField('unit', e.target.value)} error={errors.unit} required />
            </div>

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('inventory.barcode')}</h2>
            <Input label={t('inventory.barcode')} value={form.barcode} onChange={(e) => setField('barcode', e.target.value)} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('inventory.stock')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('inventory.minStock')} type="number" value={form.minStock} onChange={(e) => setField('minStock', e.target.value)} />
              <Input label={t('inventory.maxStock')} type="number" value={form.maxStock} onChange={(e) => setField('maxStock', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
