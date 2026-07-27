'use client';
import React, { useState } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, PageHeader } from '../../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter, productAdapter } from '../../../../../components/f9';
import { useRouter } from 'next/navigation';

interface LineEntry {
  _id: string;
  productId: string;
  product?: { id: string; name: string; code: string };
  warehouseLocationId?: string;
}

export default function NewPhysicalCountPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ companyId: '', branchId: '', warehouseId: '', notes: '' });
  const [lines, setLines] = useState<LineEntry[]>([]);

  const addLine = () => {
    setLines(l => [...l, { _id: Date.now().toString(), productId: '' }]);
  };

  const removeLine = (id: string) => {
    setLines(l => l.filter(x => x._id !== id));
  };

  const updateLine = (id: string, field: string, value: any) => {
    setLines(l => l.map(x => x._id === id ? { ...x, [field]: value } : x));
  };

  const handleSave = async () => {
    if (!form.companyId || !form.warehouseId) {
      showToast('Company and Warehouse are required', 'error');
      return;
    }
    if (lines.length === 0) {
      showToast('Add at least one product to count', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ id: string }>('/inventory/physical-counts', {
        companyId: form.companyId,
        branchId: form.branchId || undefined,
        warehouseId: form.warehouseId,
        notes: form.notes,
        lines: lines.map(l => ({ productId: l.productId, warehouseLocationId: l.warehouseLocationId || undefined })),
      });
      showToast('Physical count created', 'success');
      router.push(`/admin/inventory/physical-counts/${res.id}`);
    } catch (err: any) {
      showToast(err?.message || 'Create failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title={t('physicalCount.newPhysicalCount', 'physicalCount')} />
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('inventoryCounting.company')} *</label>
            <F9Lookup adapter={companyAdapter} value={form.companyId} onChange={v => setForm(f => ({ ...f, companyId: v || '' }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('inventoryCounting.branch')}</label>
            <F9Lookup adapter={branchAdapter} value={form.branchId} onChange={v => setForm(f => ({ ...f, branchId: v || '' }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('inventoryCounting.warehouse')} *</label>
            <F9Lookup adapter={warehouseAdapter} value={form.warehouseId} onChange={v => setForm(f => ({ ...f, warehouseId: v || '' }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.notes')}</label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">{t('physicalCount.productsToCount', 'physicalCount')}</h3>
          <Button onClick={addLine} variant="secondary" size="sm">{t('physicalCount.addProduct', 'physicalCount')}</Button>
        </div>
        {lines.length === 0 && <p className="text-gray-500 text-sm">{t('inventoryCounting.noLines')}</p>}
        {lines.map(line => (
          <div key={line._id} className="flex gap-2 items-center mb-2">
            <div className="flex-1">
              <F9Lookup adapter={productAdapter} value={line.productId} onChange={v => updateLine(line._id, 'productId', v || '')} placeholder={t('inventoryCounting.product')} />
            </div>
            <Button onClick={() => removeLine(line._id)} variant="danger" size="sm">{t('common.delete')}</Button>
          </div>
        ))}
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('common.create')}</Button>
        <Button onClick={() => router.back()} variant="secondary">{t('common.cancel')}</Button>
      </div>
    </div>
  );
}
