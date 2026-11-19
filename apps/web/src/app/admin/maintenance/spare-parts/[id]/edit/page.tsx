'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Card, CardContent, Select, PageHeader, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionSaveIcon, ActionCancelIcon, ActionBackIcon } from '../../../../../../components/admin/admin-action-bar';
import type { SparePart } from '../../../../../../lib/admin-types';
import { useApiErrorHandler } from '../../../../../../components/admin/error-handler';

export default function EditSparePartPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    code: '', name: '', description: '', category: '', specification: '', unit: '',
    manufacturer: '', model: '', partNumber: '', barcode: '',
    minRecommendedStock: 0, maxRecommendedStock: 0, reorderPoint: 0, isCritical: false,
    technicalClassification: '', usageType: '', nature: '', importance: '',
    defaultExpectedLifeValue: '', defaultExpectedLifeUnit: '', defaultWarningThresholdPercent: '80',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<SparePart>(`/maintenance/spare-parts/${id}`);
        setForm({
          code: res.code, name: res.name, description: res.description || '',
          category: res.category || '', specification: res.specification || '',
          unit: res.unit || '', manufacturer: res.manufacturer || '',
          model: res.model || '', partNumber: res.partNumber || '',
          barcode: res.barcode || '',
          minRecommendedStock: res.minRecommendedStock ?? 0,
          maxRecommendedStock: res.maxRecommendedStock ?? 0,
          reorderPoint: res.reorderPoint ?? 0, isCritical: res.isCritical,
          technicalClassification: res.technicalClassification || '',
          usageType: res.usageType || '', nature: res.nature || '', importance: res.importance || '',
          defaultExpectedLifeValue: res.defaultExpectedLifeValue !== null && res.defaultExpectedLifeValue !== undefined ? String(res.defaultExpectedLifeValue) : '',
          defaultExpectedLifeUnit: res.defaultExpectedLifeUnit || '',
          defaultWarningThresholdPercent: res.defaultWarningThresholdPercent !== null && res.defaultWarningThresholdPercent !== undefined ? String(res.defaultWarningThresholdPercent) : '80',
        });
      } catch (e: any) { setError(e.message || 'Failed to load'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.name) errors.name = t('validation.required');
    const hasLifeValue = form.defaultExpectedLifeValue !== '';
    const hasLifeUnit = form.defaultExpectedLifeUnit !== '';
    if (hasLifeValue !== hasLifeUnit) errors.defaultExpectedLifeUnit = t('maintenance.sparePart.form.defaultLifePairRequired');
    if (hasLifeValue && (!(Number(form.defaultExpectedLifeValue) > 0) || !Number.isFinite(Number(form.defaultExpectedLifeValue)))) {
      errors.defaultExpectedLifeValue = t('maintenance.expectedLifeValueInvalid');
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        defaultExpectedLifeValue: hasLifeValue ? Number(form.defaultExpectedLifeValue) : null,
        defaultExpectedLifeUnit: hasLifeValue ? form.defaultExpectedLifeUnit : null,
        defaultWarningThresholdPercent: hasLifeValue ? Number(form.defaultWarningThresholdPercent || 80) : null,
      };
      await api.patch(`/maintenance/spare-parts/${id}`, payload);
      showToast(t('maintenance.sparePartUpdated'), 'success');
      router.push(`/admin/maintenance/spare-parts/${id}`);
    } catch (e: any) { handleApiError(e); }
    finally { setSaving(false); }
  };

  const handlers = useStableHandlers({
    save: handleSave,
    cancel: () => router.push(`/admin/maintenance/spare-parts/${id}`),
    back: () => router.push('/admin/maintenance/spare-parts'),
  });

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="p-6">
      <PageHeader title={t('common.edit')} subtitle={`${t('maintenance.sparePart.form.code')}: ${form.code}`} />
      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={`${t('maintenance.sparePart.form.code')} *`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <div>
              <Input label={`${t('maintenance.sparePart.form.name')} *`} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} />
              {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
            </div>
            <Input label={t('maintenance.sparePart.form.category')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.unit')} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.manufacturer')} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.model')} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.partNumber')} value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.barcode')} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.specification')} value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label={t('maintenance.sparePart.form.minRecommendedStock')} type="number" value={form.minRecommendedStock} onChange={(e) => setForm({ ...form, minRecommendedStock: Number(e.target.value) })} />
            <Input label={t('maintenance.sparePart.form.maxRecommendedStock')} type="number" value={form.maxRecommendedStock} onChange={(e) => setForm({ ...form, maxRecommendedStock: Number(e.target.value) })} />
            <Input label={t('maintenance.sparePart.form.reorderPoint')} type="number" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: Number(e.target.value) })} />
            <label className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={form.isCritical} onChange={(e) => setForm({ ...form, isCritical: e.target.checked })} className="rounded" />
              {t('maintenance.sparePart.form.isCritical')}
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label={t('maintenance.sparePart.form.technicalClassification')} value={form.technicalClassification} onChange={(e) => setForm({ ...form, technicalClassification: e.target.value })} options={[
              { value: '', label: '' }, { value: 'MECHANICAL', label: t('maintenance.sparePart.classification.mechanical') },
              { value: 'ELECTRICAL', label: t('maintenance.sparePart.classification.electrical') },
              { value: 'ELECTRONIC', label: t('maintenance.sparePart.classification.electronic') },
              { value: 'HYDRAULIC', label: t('maintenance.sparePart.classification.hydraulic') },
              { value: 'PNEUMATIC', label: t('maintenance.sparePart.classification.pneumatic') },
              { value: 'LUBRICANT', label: t('maintenance.sparePart.classification.lubricant') },
              { value: 'CHEMICAL', label: t('maintenance.sparePart.classification.chemical') },
              { value: 'SAFETY', label: t('maintenance.sparePart.classification.safety') },
              { value: 'GENERAL', label: t('maintenance.sparePart.classification.general') },
            ]} />
            <Select label={t('maintenance.sparePart.form.usageType')} value={form.usageType} onChange={(e) => setForm({ ...form, usageType: e.target.value })} options={[
              { value: '', label: '' }, { value: 'CONSUMABLE', label: t('maintenance.sparePart.usageType.consumable') },
              { value: 'REPLACEABLE', label: t('maintenance.sparePart.usageType.replaceable') },
              { value: 'REPAIRABLE', label: t('maintenance.sparePart.usageType.repairable') },
              { value: 'ROTABLE', label: t('maintenance.sparePart.usageType.rotable') },
            ]} />
            <Select label={t('maintenance.sparePart.form.nature')} value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })} options={[
              { value: '', label: '' }, { value: 'ORIGINAL', label: t('maintenance.sparePart.nature.original') },
              { value: 'GENERIC', label: t('maintenance.sparePart.nature.generic') },
              { value: 'REFURBISHED', label: t('maintenance.sparePart.nature.refurbished') },
              { value: 'LOCAL', label: t('maintenance.sparePart.nature.local') },
            ]} />
            <Select label={t('maintenance.sparePart.form.importance')} value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value })} options={[
              { value: '', label: '' }, { value: 'CRITICAL', label: t('maintenance.sparePart.importance.critical') },
              { value: 'HIGH', label: t('maintenance.sparePart.importance.high') },
              { value: 'MEDIUM', label: t('maintenance.sparePart.importance.medium') },
              { value: 'LOW', label: t('maintenance.sparePart.importance.low') },
            ]} />
          </div>
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">{t('maintenance.sparePart.section.standardLife')}</h3>
            <p className="text-xs text-gray-500">{t('maintenance.sparePart.form.standardLifeHint')}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label={t('maintenance.sparePart.form.defaultExpectedLifeValue')} type="number" min={0.0001} value={form.defaultExpectedLifeValue} onChange={(e) => { setForm({ ...form, defaultExpectedLifeValue: e.target.value }); setValidationErrors((prev) => ({ ...prev, defaultExpectedLifeValue: '', defaultExpectedLifeUnit: '' })); }} />
              <Select label={t('maintenance.sparePart.form.defaultExpectedLifeUnit')} value={form.defaultExpectedLifeUnit} onChange={(e) => setForm({ ...form, defaultExpectedLifeUnit: e.target.value })} options={[
                { value: '', label: '' },
                { value: 'DAYS', label: t('maintenance.lifeUnitDays') },
                { value: 'HOURS', label: t('maintenance.lifeUnitHours') },
                { value: 'CYCLES', label: t('maintenance.lifeUnitCycles') },
              ]} />
              <Input label={t('maintenance.sparePart.form.defaultWarningThresholdPercent')} type="number" min={1} max={99} value={form.defaultWarningThresholdPercent} onChange={(e) => setForm({ ...form, defaultWarningThresholdPercent: e.target.value })} />
            </div>
            {validationErrors.defaultExpectedLifeValue && <p className="text-red-500 text-sm">{validationErrors.defaultExpectedLifeValue}</p>}
            {validationErrors.defaultExpectedLifeUnit && <p className="text-red-500 text-sm">{validationErrors.defaultExpectedLifeUnit}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
