'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Input, Card, CardContent, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { F9Lookup, machineAdapter, productAdapter } from '../../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon, ActionViewIcon } from '../../../../../../components/admin/admin-action-bar';
import type { MachinePart } from '../../../../../../lib/admin-types';
import { useApiErrorHandler } from '../../../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../../../lib/form-validation';

export default function EditMachinePartPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const id = params?.id as string;
  const [data, setData] = useState<MachinePart | null>(null);
  const [form, setForm] = useState({
    name: '', partNumber: '', unit: '',
    quantity: 0, minStock: 0,
    machineId: '', productId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const item = await api.get<MachinePart>(`/maintenance/machine-parts/${id}`);
      setData(item);
      setForm({
        name: item.name || '',
        partNumber: item.partNumber || '',
        unit: item.unit || '',
        quantity: item.quantity ?? 0,
        minStock: item.minStock ?? 0,
        machineId: item.machineId || '',
        productId: item.productId || '',
      });
    } catch (err: any) {
      handleApiError(err);
      setError(err?.message || t('complexForms.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t, handleApiError]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('validation.required');
    if (!form.unit.trim()) errs.unit = t('validation.required');
    if (Number.isNaN(Number(form.quantity)) || Number(form.quantity) < 0) errs.quantity = t('validation.invalidQuantity');
    if (Number.isNaN(Number(form.minStock)) || Number(form.minStock) < 0) errs.minStock = t('validation.invalidQuantity');
    setErrors(errs);
    focusFirstInvalidField(Object.entries(errs).map(([field, message]) => ({ field, code: 'validation.required', message })));
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (form.name.trim() !== (data?.name || '')) payload.name = form.name.trim();
      if (form.partNumber !== (data?.partNumber || '')) payload.partNumber = form.partNumber.trim() || null;
      if (form.unit.trim() !== (data?.unit || '')) payload.unit = form.unit.trim();
      if (Number(form.quantity) !== (data?.quantity ?? 0)) payload.quantity = Number(form.quantity);
      if (Number(form.minStock) !== (data?.minStock ?? 0)) payload.minStock = Number(form.minStock);
      if (form.machineId !== (data?.machineId || '')) payload.machineId = form.machineId || null;
      if (form.productId !== (data?.productId || '')) payload.productId = form.productId || null;
      await api.patch(`/maintenance/machine-parts/${id}`, payload);
      showToast(t('complexForms.recordUpdated'), 'success');
      router.push(`/admin/maintenance/machine-parts/${id}`);
    } catch (err: any) {
      const config = handleApiError(err);
      if (config.errors?.length) {
        setErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      }
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
    { id: 'save', labelKey: 'actions.save', icon: <ActionSaveIcon />, onClick: () => exec('save'), enabled: !saving },
    { id: 'saveAndView', labelKey: 'complexForms.saveAndView', icon: <ActionViewIcon />, onClick: () => exec('saveAndView'), enabled: !saving },
    { id: 'cancel', labelKey: 'actions.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('complexForms.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="mb-4">
            <h1 className="text-lg font-semibold text-gray-900">{t('maintenance.editMachinePart')}</h1>
            <p className="text-sm text-gray-500">[{data.code}] {data.name}</p>
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('complexForms.basicInformation')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('maintenance.code')} value={data.code} disabled />
              <Input label={t('maintenance.name')} value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} required />
              <Input label={t('maintenance.partNumber')} value={form.partNumber} onChange={(e) => setField('partNumber', e.target.value)} />
              <Input label={t('maintenance.unit')} value={form.unit} onChange={(e) => setField('unit', e.target.value)} error={errors.unit} required />
              <Input label={t('maintenance.quantity')} type="number" value={String(form.quantity)} onChange={(e) => setField('quantity', e.target.value)} error={errors.quantity} />
              <Input label={t('maintenance.minimumStock')} type="number" value={String(form.minStock)} onChange={(e) => setField('minStock', e.target.value)} error={errors.minStock} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('maintenance.linkedEntities')}</h2>
          <div className="space-y-4">
            <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => setField('machineId', v)} adapter={machineAdapter} />
            <F9Lookup label={t('maintenance.linkedInventoryItem')} value={form.productId} onChange={(v) => setField('productId', v)} adapter={productAdapter} />
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
