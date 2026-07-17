'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Select, Card, CardContent } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';
import { ProductCategory } from '../../../../../lib/admin-types';

export default function CreateProductCategoryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ code: '', name: '', description: '', parentId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [parents, setParents] = useState<ProductCategory[]>([]);

  useEffect(() => {
    api.get<{ data: ProductCategory[] }>('/product-categories', { params: { limit: 50 } }).then(res => setParents(res.data || [])).catch(() => {});
  }, []);

  const setField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = t('complexForms.requiredField');
    if (!form.name.trim()) errs.name = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: any = { code: form.code.trim(), name: form.name.trim() };
      if (form.description) payload.description = form.description.trim();
      if (form.parentId) payload.parentId = form.parentId;
      const res = await api.post<{ data: { id: string } }>('/product-categories', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/inventory/product-categories/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ code: '', name: '', description: '', parentId: '' }); setErrors({}); setDirty(false); },
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
              <Input label={t('common.code')} value={form.code} onChange={(e) => setField('code', e.target.value)} error={errors.code} required />
              <Input label={t('common.name')} value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required />
            </div>
            <Textarea label={t('common.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} />
            <Select label={t('inventory.parentCategory')} value={form.parentId} onChange={(e) => setField('parentId', e.target.value)}
              options={parents.map((c) => ({ value: c.id, label: `[${c.code}] ${c.name}` }))} placeholder={t('common.none')} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
