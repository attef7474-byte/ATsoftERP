'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { MaintenanceRequestCostEntry } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, Modal, Button, Input, Textarea, Select } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionAddIcon } from '../../../../../../components/admin/admin-action-bar';

export default function CostEntriesPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [entries, setEntries] = useState<MaintenanceRequestCostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceRequestCostEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'LABOR', description: '', amount: 0, incurredAt: new Date().toISOString().slice(0, 10) });

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<MaintenanceRequestCostEntry[]>(`/maintenance/request-costs`, { params: { requestId: id } });
      setEntries(Array.isArray(res) ? res : []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ type: 'LABOR', description: '', amount: 0, incurredAt: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const openEdit = (item: MaintenanceRequestCostEntry) => {
    setEditItem(item);
    setForm({ type: item.type, description: item.description || '', amount: item.amount, incurredAt: item.incurredAt.slice(0, 10) });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.amount) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload = { requestId: id, ...form };
      if (editItem) {
        await api.patch(`/maintenance/request-costs/${editItem.id}`, payload);
        showToast(t('maintenanceWorkflow.costUpdated'), 'success');
      } else {
        await api.post('/maintenance/request-costs', payload);
        showToast(t('maintenanceWorkflow.costAdded'), 'success');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.saveFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await api.delete(`/maintenance/request-costs/${entryId}`);
      showToast(t('maintenanceWorkflow.costDeleted'), 'success');
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
    { id: 'add', labelKey: 'maintenanceWorkflow.addCost', icon: <ActionAddIcon />, onClick: () => exec('add') },
  ]);

  const typeOptions = [
    { value: 'LABOR', label: t('maintenanceWorkflow.costLabor') },
    { value: 'MATERIAL', label: t('maintenanceWorkflow.costMaterial') },
    { value: 'SERVICE', label: t('maintenanceWorkflow.costService') },
    { value: 'OTHER', label: t('maintenanceWorkflow.costOther') },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceWorkflow.costEntries')}</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">{t('maintenanceWorkflow.costEntriesDescription')}</p>
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <DataTable columns={[
              { key: 'type', header: t('maintenanceWorkflow.costType'), render: (e: MaintenanceRequestCostEntry) => t(`maintenanceWorkflow.cost${e.type.charAt(0) + e.type.slice(1).toLowerCase()}` as any) },
              { key: 'description', header: t('maintenanceWorkflow.costDescription'), render: (e: MaintenanceRequestCostEntry) => e.description || '-' },
              { key: 'amount', header: t('maintenanceWorkflow.costAmount'), render: (e: MaintenanceRequestCostEntry) => e.amount.toLocaleString() },
              { key: 'incurredAt', header: t('maintenanceWorkflow.costDate'), render: (e: MaintenanceRequestCostEntry) => new Date(e.incurredAt).toLocaleDateString() },
              {
                key: 'actions', header: t('common.actions'), render: (e: MaintenanceRequestCostEntry) => (
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(e)} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
                    <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-800 text-sm">{t('actions.delete')}</button>
                  </div>
                ),
              },
            ]} data={entries} keyExtractor={(e: MaintenanceRequestCostEntry) => e.id} />
          )}
          <div className="mt-4 text-right font-semibold">{t('maintenanceWorkflow.totalCost')}: {totalAmount.toLocaleString()}</div>
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenanceWorkflow.editCost') : t('maintenanceWorkflow.addCost')} size="md">
        <div className="space-y-4">
          <Select label={t('maintenanceWorkflow.costType')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={typeOptions} />
          <Input label={t('maintenanceWorkflow.costAmount')} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
          <Input label={t('maintenanceWorkflow.costDate')} type="date" value={form.incurredAt} onChange={(e) => setForm({ ...form, incurredAt: e.target.value })} />
          <Textarea label={t('maintenanceWorkflow.costDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
