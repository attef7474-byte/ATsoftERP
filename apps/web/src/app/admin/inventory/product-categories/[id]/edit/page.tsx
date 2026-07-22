'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Select, Card, CardContent, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon, ActionViewIcon } from '../../../../../../components/admin/admin-action-bar';
import type { ProductCategory } from '../../../../../../lib/admin-types';

export default function EditProductCategoryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const id = params?.id as string;
  const [data, setData] = useState<ProductCategory | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', parentId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [parents, setParents] = useState<ProductCategory[]>([]);

  const isReadOnly = data?.status === 'INACTIVE';

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [catRes, parentsRes] = await Promise.all([
        api.get<any>(`/product-categories/${id}`),
        api.get<{ data: ProductCategory[] }>('/product-categories', { params: { limit: 50 } }),
      ]);
      const item = catRes.data as ProductCategory;
      setData(item);
      setForm({ code: item.code ?? '', name: item.name ?? '', description: item.description ?? '', parentId: item.parentId ?? '' });
      setParents(parentsRes.data || []);
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
    if (!form.code.trim()) errs.code = t('complexForms.requiredField');
    if (!form.name.trim()) errs.name = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (isReadOnly || !validate()) return;
    setSaving(true);
    try {
      const payload: any = { code: form.code.trim(), name: form.name.trim() };
      if (form.description !== data?.description) payload.description = form.description.trim() || null;
      if (form.parentId !== data?.parentId) payload.parentId = form.parentId || null;
      await api.patch(`/product-categories/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/inventory/product-categories/${id}`);
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
          {t('complexForms.readOnlyRecord')}
        </div>
      )}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('inventory.editProductCategory')}</h1>
              <p className="text-sm text-gray-500">[{data.code}] {data.name}</p>
            </div>
            {data.status && <StatusBadge status={data.status} />}
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('common.code')} value={form.code} onChange={(e) => setField('code', e.target.value)} error={errors.code} required disabled={isReadOnly} />
              <Input label={t('common.name')} value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required disabled={isReadOnly} />
            </div>
            <Textarea label={t('common.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} disabled={isReadOnly} />
            <Select label={t('inventory.parentCategory')} value={form.parentId} onChange={(e) => setField('parentId', e.target.value)}
              options={parents.filter((p) => p.id !== id).map((c) => ({ value: c.id, label: `[${c.code}] ${c.name}` }))} placeholder={t('common.none')} />
          </div>
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
