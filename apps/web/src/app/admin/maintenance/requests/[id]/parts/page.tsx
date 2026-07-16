'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { MaintenanceRequestPartUsage, MaintenanceRequest } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, Modal, Button, Input, Textarea } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionAddIcon } from '../../../../../../components/admin/admin-action-bar';
import { F9Lookup, productAdapter } from '../../../../../../components/f9';

export default function UsedPartsPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [parts, setParts] = useState<MaintenanceRequestPartUsage[]>([]);
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceRequestPartUsage | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ productId: '', quantity: 0, unitCost: 0, notes: '' });

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [reqRes, partsRes] = await Promise.all([
        api.get<MaintenanceRequest>(`/maintenance/requests/${id}`),
        api.get<MaintenanceRequestPartUsage[]>(`/maintenance/request-parts`, { params: { requestId: id } }),
      ]);
      setRequest(reqRes);
      setParts(Array.isArray(partsRes) ? partsRes : []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ productId: '', quantity: 1, unitCost: 0, notes: '' });
    setModalOpen(true);
  };

  const openEdit = (item: MaintenanceRequestPartUsage) => {
    setEditItem(item);
    setForm({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost ?? 0, notes: item.notes || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.productId || !form.quantity) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload = { requestId: id, ...form, totalCost: form.unitCost * form.quantity };
      if (editItem) {
        await api.patch(`/maintenance/request-parts/${editItem.id}`, payload);
        showToast(t('maintenanceWorkflow.partUpdated'), 'success');
      } else {
        await api.post('/maintenance/request-parts', payload);
        showToast(t('maintenanceWorkflow.partAdded'), 'success');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.saveFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await api.delete(`/maintenance/request-parts/${itemId}`);
      showToast(t('maintenanceWorkflow.partDeleted'), 'success');
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.deleteFailed'), 'error'); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    add: () => openCreate(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'add', labelKey: 'maintenanceWorkflow.addPart', icon: <ActionAddIcon />, onClick: () => exec('add') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const totalCost = parts.reduce((sum, p) => sum + (p.totalCost ?? p.unitCost ?? 0 * p.quantity), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceWorkflow.usedParts')}</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">{t('maintenanceWorkflow.usedPartsDescription')}</p>
          {parts.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <DataTable columns={[
              { key: 'product', header: t('maintenanceWorkflow.partProduct'), render: (p: MaintenanceRequestPartUsage) => p.product?.name || p.productId },
              { key: 'quantity', header: t('maintenanceWorkflow.partQuantity'), render: (p: MaintenanceRequestPartUsage) => p.quantity },
              { key: 'unitCost', header: t('maintenanceWorkflow.partUnitCost'), render: (p: MaintenanceRequestPartUsage) => p.unitCost ?? '-' },
              { key: 'totalCost', header: t('maintenanceWorkflow.partTotalCost'), render: (p: MaintenanceRequestPartUsage) => (p.totalCost ?? (p.unitCost ?? 0) * p.quantity).toLocaleString() },
              { key: 'notes', header: t('maintenanceWorkflow.partNotes'), render: (p: MaintenanceRequestPartUsage) => p.notes || '-' },
              {
                key: 'actions', header: t('common.actions'), render: (p: MaintenanceRequestPartUsage) => (
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 text-sm">{t('actions.delete')}</button>
                  </div>
                ),
              },
            ]} data={parts} keyExtractor={(p: MaintenanceRequestPartUsage) => p.id} />
          )}
          <div className="mt-4 text-right font-semibold">{t('maintenanceWorkflow.totalCost')}: {totalCost.toLocaleString()}</div>
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenanceWorkflow.editPart') : t('maintenanceWorkflow.addPart')} size="md">
        <div className="space-y-4">
          <F9Lookup label={t('maintenanceWorkflow.partProduct')} value={form.productId} onChange={(v) => setForm({ ...form, productId: v })} adapter={productAdapter} />
          <Input label={t('maintenanceWorkflow.partQuantity')} type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} />
          <Input label={t('maintenanceWorkflow.partUnitCost')} type="number" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: parseFloat(e.target.value) || 0 })} />
          <Textarea label={t('maintenanceWorkflow.partNotes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
