'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent, LoadingState, ErrorState, StatusBadge } from '../../../../../../components/admin/ui';
import { F9Lookup, productCategoryAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon, ActionViewIcon } from '../../../../../../components/admin/admin-action-bar';
import type { Product } from '../../../../../../lib/admin-types';

export default function EditProductPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const id = params?.id as string;
  const [data, setData] = useState<Product | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', categoryId: '', unit: 'pcs', barcode: '', minStock: 0, maxStock: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isReadOnly = data?.status === 'INACTIVE';

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<any>(`/products/${id}`);
      const item = res;
      setData(item);
      setForm({ code: item.code || '', name: item.name || '', description: item.description || '', categoryId: item.categoryId || '', unit: item.unit || 'pcs', barcode: item.barcode || '', minStock: item.minStock ?? 0, maxStock: item.maxStock ?? 0 });
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
    if (!form.unit.trim()) errs.unit = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (isReadOnly || !validate()) return;
    setSaving(true);
    try {
      const payload: any = { code: form.code.trim(), name: form.name.trim(), unit: form.unit.trim() };
      if (form.description !== data?.description) payload.description = form.description.trim() || null;
      if (form.categoryId !== data?.categoryId) payload.categoryId = form.categoryId || null;
      if (form.barcode !== data?.barcode) payload.barcode = form.barcode.trim() || null;
      payload.minStock = Number(form.minStock) || 0;
      payload.maxStock = Number(form.maxStock) || 0;
      await api.patch(`/products/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/inventory/products/${id}`);
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
              <h1 className="text-lg font-semibold text-gray-900">{t('complexForms.editProduct')}</h1>
              <p className="text-sm text-gray-500">[{data.code}] {data.name}</p>
            </div>
            {data.status && <StatusBadge status={data.status} />}
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.basicInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('inventory.code')} value={form.code} onChange={(e) => setField('code', e.target.value)} error={errors.code} required disabled={isReadOnly} />
              <Input label={t('inventory.name')} value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required disabled={isReadOnly} />
            </div>
            <Textarea label={t('inventory.description')} value={form.description} onChange={(e) => setField('description', e.target.value)} disabled={isReadOnly} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('complexForms.classification')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('inventory.productCategory')} value={form.categoryId} onChange={(v) => setField('categoryId', v)} adapter={productCategoryAdapter} />
              <Input label={t('inventory.unit')} value={form.unit} onChange={(e) => setField('unit', e.target.value)} error={errors.unit} required disabled={isReadOnly} />
            </div>

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('inventory.barcode')}</h2>
            <Input label={t('inventory.barcode')} value={form.barcode} onChange={(e) => setField('barcode', e.target.value)} disabled={isReadOnly} />

            <h2 className="text-lg font-semibold text-gray-900 pt-4">{t('inventory.stock')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('inventory.minStock')} type="number" value={form.minStock} onChange={(e) => setField('minStock', e.target.value)} disabled={isReadOnly} />
              <Input label={t('inventory.maxStock')} type="number" value={form.maxStock} onChange={(e) => setField('maxStock', e.target.value)} disabled={isReadOnly} />
            </div>
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
