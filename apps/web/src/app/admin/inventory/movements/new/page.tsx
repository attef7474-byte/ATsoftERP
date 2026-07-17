'use client';
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Select, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter, productAdapter, warehouseLocationAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateInventoryMovementPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ companyId: '', branchId: '', warehouseId: '', movementType: 'OPENING', direction: 'IN', movementDate: new Date().toISOString().split('T')[0], notes: '' });
  const [lines, setLines] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [lineForm, setLineForm] = useState({ productId: '', warehouseLocationId: '', quantity: 1, direction: 'IN', unit: '', notes: '' });

  const movementTypeOptions = [
    { value: 'OPENING', label: t('status.OPENING') },
    { value: 'PURCHASE_RECEIPT', label: t('status.PURCHASE_RECEIPT') },
    { value: 'SALES_ISSUE', label: t('status.SALES_ISSUE') },
    { value: 'PRODUCTION_RECEIPT', label: t('status.PRODUCTION_RECEIPT') },
    { value: 'PRODUCTION_ISSUE', label: t('status.PRODUCTION_ISSUE') },
    { value: 'TRANSFER_IN', label: t('status.TRANSFER_IN') },
    { value: 'TRANSFER_OUT', label: t('status.TRANSFER_OUT') },
    { value: 'ADJUSTMENT_IN', label: t('status.ADJUSTMENT_IN') },
    { value: 'ADJUSTMENT_OUT', label: t('status.ADJUSTMENT_OUT') },
    { value: 'COUNT_ADJUSTMENT', label: t('status.COUNT_ADJUSTMENT') },
  ];
  const directionOptions = [
    { value: 'IN', label: t('status.IN') },
    { value: 'OUT', label: t('status.OUT') },
  ];

  const setField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'companyId') setForm(prev => ({ ...prev, branchId: '' }));
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.companyId) errs.companyId = t('complexForms.requiredField');
    if (!form.branchId) errs.branchId = t('complexForms.requiredField');
    if (!form.warehouseId) errs.warehouseId = t('complexForms.requiredField');
    if (lines.length === 0) errs.lines = t('complexForms.requiredField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: any = {
        companyId: form.companyId, branchId: form.branchId, warehouseId: form.warehouseId,
        movementType: form.movementType, direction: form.direction, movementDate: form.movementDate,
        notes: form.notes || undefined,
        lines: lines.map((l) => ({ productId: l.productId, warehouseLocationId: l.warehouseLocationId || undefined, quantity: l.quantity, direction: l.direction, unit: l.unit || undefined, notes: l.notes || undefined })),
      };
      const res = await api.post<{ data: { id: string } }>('/inventory/movements', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/inventory/movements/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const handleAddLine = () => {
    if (!lineForm.productId || !lineForm.quantity) return;
    setLines([...lines, { ...lineForm, _id: Date.now().toString() }]);
    setLineForm({ productId: '', warehouseLocationId: '', quantity: 1, direction: 'IN', unit: '', notes: '' });
    setLineFormOpen(false);
  };

  const handleRemoveLine = (id: string) => setLines(lines.filter((l) => l._id !== id));

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ companyId: '', branchId: '', warehouseId: '', movementType: 'OPENING', direction: 'IN', movementDate: new Date().toISOString().split('T')[0], notes: '' }); setLines([]); setErrors({}); setDirty(false); },
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setField('companyId', v)} adapter={companyAdapter} error={errors.companyId} />
              <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setField('branchId', v)} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} error={errors.branchId} />
              <F9Lookup label={t('inventory.warehouse')} value={form.warehouseId} onChange={(v) => setField('warehouseId', v)} adapter={warehouseAdapter} error={errors.warehouseId} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label={t('inventoryCounting.movementType')} value={form.movementType} onChange={(e) => setField('movementType', e.target.value)} options={movementTypeOptions} />
              <Select label={t('inventoryCounting.direction')} value={form.direction} onChange={(e) => setField('direction', e.target.value)} options={directionOptions} />
              <Input label={t('inventoryCounting.movementDate')} type="date" value={form.movementDate} onChange={(e) => setField('movementDate', e.target.value)} />
            </div>
            <Textarea label={t('inventoryCounting.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">{t('inventoryCounting.lines')}</h4>
                <Button variant="secondary" size="sm" onClick={() => setLineFormOpen(!lineFormOpen)}>{t('inventoryCounting.addLine')}</Button>
              </div>
              {errors.lines && <p className="text-sm text-red-600 mb-2">{errors.lines}</p>}
              {lineFormOpen && (
                <div className="border rounded p-3 mb-3 space-y-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-3">
                    <F9Lookup label={t('inventoryCounting.product')} value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
                    <F9Lookup label={t('inventoryCounting.warehouseLocation')} value={lineForm.warehouseLocationId} onChange={(v) => setLineForm({ ...lineForm, warehouseLocationId: v })} adapter={warehouseLocationAdapter} />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <Input label={t('inventoryCounting.quantity')} type="number" value={String(lineForm.quantity)} onChange={(e) => setLineForm({ ...lineForm, quantity: Number(e.target.value) })} />
                    <Select label={t('inventoryCounting.direction')} value={lineForm.direction} onChange={(e) => setLineForm({ ...lineForm, direction: e.target.value })} options={directionOptions} />
                    <Input label={t('inventoryCounting.unit')} value={lineForm.unit} onChange={(e) => setLineForm({ ...lineForm, unit: e.target.value })} />
                    <div className="flex items-end">
                      <Button onClick={handleAddLine}>{t('actions.add')}</Button>
                    </div>
                  </div>
                  <Textarea label={t('inventoryCounting.notes')} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
                </div>
              )}
              {lines.length > 0 && (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2">{t('inventoryCounting.product')}</th>
                      <th className="text-left p-2">{t('inventoryCounting.warehouseLocation')}</th>
                      <th className="text-right p-2">{t('inventoryCounting.quantity')}</th>
                      <th className="text-center p-2">{t('inventoryCounting.direction')}</th>
                      <th className="text-left p-2">{t('inventoryCounting.unit')}</th>
                      <th className="text-left p-2">{t('inventoryCounting.notes')}</th>
                      <th className="text-center p-2">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line._id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{line.product?.name || line.productId}</td>
                        <td className="p-2">{line.warehouseLocation?.name || line.warehouseLocationId || '-'}</td>
                        <td className="p-2 text-right">{line.quantity}</td>
                        <td className="p-2 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${line.direction === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {t(`status.${line.direction}` as any)}
                          </span>
                        </td>
                        <td className="p-2">{line.unit || '-'}</td>
                        <td className="p-2">{line.notes || '-'}</td>
                        <td className="p-2 text-center">
                          <button onClick={() => handleRemoveLine(line._id)} className="text-red-600 hover:text-red-800 text-sm">{t('actions.remove')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
