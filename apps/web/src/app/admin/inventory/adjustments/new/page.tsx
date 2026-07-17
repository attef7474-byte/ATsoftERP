'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, CardContent } from '../../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter, productAdapter } from '../../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionSaveIcon, ActionCancelIcon } from '../../../../../components/admin/admin-action-bar';

export default function CreateInventoryAdjustmentPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({ companyId: '', branchId: '', warehouseId: '', adjustmentDate: new Date().toISOString().split('T')[0], reason: '', notes: '' });
  const [lines, setLines] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [lineForm, setLineForm] = useState({ productId: '', systemQty: 0, countedQty: 0, notes: '' });

  const fetchSystemQty = async (productId: string) => {
    if (!productId || !form.warehouseId) return 0;
    try {
      const balances = await api.get<any[]>(`/inventory/balances/product/${productId}`);
      const whBalance = balances.find((b: any) => b.warehouseId === form.warehouseId);
      return whBalance?.quantity ?? 0;
    } catch { return 0; }
  };

  useEffect(() => {
    if (lineForm.productId) {
      fetchSystemQty(lineForm.productId).then((qty) => setLineForm(prev => ({ ...prev, systemQty: qty })));
    }
  }, [lineForm.productId, form.warehouseId]);

  const setField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'companyId') setForm(prev => ({ ...prev, branchId: '' }));
    setDirty(true);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.companyId) errs.companyId = t('complexForms.requiredField');
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
        companyId: form.companyId, branchId: form.branchId || undefined, warehouseId: form.warehouseId,
        adjustmentDate: form.adjustmentDate, reason: form.reason || undefined, notes: form.notes || undefined,
        lines: lines.map((l) => ({ productId: l.productId, countedQty: l.countedQty, notes: l.notes || undefined })),
      };
      const res = await api.post<{ data: { id: string } }>('/inventory/adjustments', payload);
      showToast(t('complexForms.recordCreated'), 'success');
      router.push(`/admin/inventory/adjustments/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('complexForms.createFailed'), 'error');
    } finally { setSaving(false); }
  };

  const handleAddLine = () => {
    if (!lineForm.productId || lineForm.countedQty < 0) return;
    const diff = lineForm.countedQty - lineForm.systemQty;
    setLines([...lines, { ...lineForm, differenceQty: diff, _id: Date.now().toString() }]);
    setLineForm({ productId: '', systemQty: 0, countedQty: 0, notes: '' });
    setLineFormOpen(false);
  };

  const handleRemoveLine = (id: string) => setLines(lines.filter((l) => l._id !== id));

  const { exec } = useStableHandlers({
    back: () => { if (dirty && !confirm(t('complexForms.confirmLeaveUnsaved'))) return; router.back(); },
    refresh: () => { setForm({ companyId: '', branchId: '', warehouseId: '', adjustmentDate: new Date().toISOString().split('T')[0], reason: '', notes: '' }); setLines([]); setErrors({}); setDirty(false); },
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
              <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setField('companyId', v)} adapter={companyAdapter} error={errors.companyId} />
              <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setField('branchId', v)} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('inventory.warehouse')} value={form.warehouseId} onChange={(v) => setField('warehouseId', v)} adapter={warehouseAdapter} error={errors.warehouseId} />
              <Input label={t('inventoryCounting.adjustmentDate')} type="date" value={form.adjustmentDate} onChange={(e) => setField('adjustmentDate', e.target.value)} />
            </div>
            <Input label={t('inventoryCounting.reason')} value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
            <Textarea label={t('inventoryCounting.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">{t('inventoryCounting.lines')}</h4>
                <Button variant="secondary" size="sm" onClick={() => setLineFormOpen(!lineFormOpen)}>{t('inventoryCounting.addLine')}</Button>
              </div>
              {errors.lines && <p className="text-sm text-red-600 mb-2">{errors.lines}</p>}
              {lineFormOpen && (
                <div className="border rounded p-3 mb-3 space-y-3 bg-gray-50">
                  <F9Lookup label={t('inventoryCounting.product')} value={lineForm.productId} onChange={(v) => setLineForm({ ...lineForm, productId: v })} adapter={productAdapter} />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-sm"><span className="block text-gray-500">{t('inventoryCounting.systemQty')}</span><span className="font-medium">{lineForm.systemQty}</span></div>
                    <Input label={t('inventoryCounting.countedQty')} type="number" value={String(lineForm.countedQty)} onChange={(e) => setLineForm({ ...lineForm, countedQty: Number(e.target.value) })} />
                    <div className="flex items-end">
                      <Button onClick={handleAddLine} disabled={!lineForm.productId}>{t('actions.add')}</Button>
                    </div>
                  </div>
                  {lineForm.productId && (
                    <p className="text-xs text-gray-500">
                      {t('inventoryCounting.differenceQty')}: {lineForm.countedQty - lineForm.systemQty}
                    </p>
                  )}
                  <Textarea label={t('inventoryCounting.notes')} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
                </div>
              )}
              {lines.length > 0 && (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2">{t('inventoryCounting.product')}</th>
                      <th className="text-right p-2">{t('inventoryCounting.systemQty')}</th>
                      <th className="text-right p-2">{t('inventoryCounting.countedQty')}</th>
                      <th className="text-center p-2">{t('inventoryCounting.differenceQty')}</th>
                      <th className="text-left p-2">{t('inventoryCounting.notes')}</th>
                      <th className="text-center p-2">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line._id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{line.product?.name || line.productId}</td>
                        <td className="p-2 text-right">{line.systemQty}</td>
                        <td className="p-2 text-right">{line.countedQty}</td>
                        <td className="p-2 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${line.differenceQty === 0 ? 'bg-gray-100 text-gray-700' : line.differenceQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {line.differenceQty > 0 ? '+' : ''}{line.differenceQty}
                          </span>
                        </td>
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
