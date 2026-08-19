'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { Button, Input, Modal, PageHeader, Select, Textarea } from '../../../../../components/admin/ui';
import { F9Lookup, maintenanceRequestAdapter, machineAdapter, productionOrderAdapter, sparePartAdapter } from '../../../../../components/f9';
import type { LookupAdapter } from '../../../../../components/f9/types';

interface ShiftHandoverItem {
  id: string;
  handoverId: string;
  category: string;
  entityType: string;
  entityId: string;
  entityCode?: string | null;
  entitySummary?: string | null;
  priority?: string | null;
  status?: string | null;
  notes?: string | null;
}

interface ShiftHandover {
  id: string;
  companyId: string;
  branchId?: string | null;
  departmentId?: string | null;
  handoverDate: string;
  outgoingShiftId: string;
  incomingShiftId: string;
  outgoingPersonId?: string | null;
  incomingPersonId?: string | null;
  activeProductionOrders?: number | null;
  openMaintenanceRequests?: number | null;
  stoppedMachines?: number | null;
  pendingMaintenance?: number | null;
  notes?: string | null;
  status: string;
  submittedAt?: string | null;
  acknowledgedAt?: string | null;
  createdByUserId?: string | null;
  outgoingShift?: { id: string; code: string; name: string; startTime?: string; endTime?: string };
  incomingShift?: { id: string; code: string; name: string; startTime?: string; endTime?: string };
  outgoingPerson?: { id: string; code: string; name: string } | null;
  incomingPerson?: { id: string; code: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
  branch?: { id: string; code: string; name: string } | null;
  items?: ShiftHandoverItem[];
}

const ITEM_CATEGORIES = [
  'MAINTENANCE_REQUEST',
  'STOPPED_MACHINE',
  'PRODUCTION_ORDER',
  'QUALITY_ISSUE',
  'MATERIAL_SHORTAGE',
  'SAFETY_OBSERVATION',
  'GENERAL',
];

const ENTITY_TYPES = [
  'MAINTENANCE_REQUEST',
  'MACHINE',
  'PRODUCTION_ORDER',
  'PRODUCTION_NONCONFORMANCE',
  'SPARE_PART',
];

function statusColor(status: string) {
  switch (status) {
    case 'DRAFT': return 'bg-blue-100 text-blue-800';
    case 'SUBMITTED': return 'bg-amber-100 text-amber-800';
    case 'ACKNOWLEDGED': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function entityAdapterForType(entityType: string): LookupAdapter<any> | null {
  switch (entityType) {
    case 'MAINTENANCE_REQUEST': return maintenanceRequestAdapter;
    case 'MACHINE': return machineAdapter;
    case 'PRODUCTION_ORDER': return productionOrderAdapter;
    case 'SPARE_PART': return sparePartAdapter;
    default: return null;
  }
}

export default function ShiftHandoverDetailPage() {
  const { t, dir } = useTranslation();
  const params = useParams();
  const id = String(params?.id || '');
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('shift-handover:' + action)),
    [isSuperAdmin, permissions],
  );

  const [handover, setHandover] = useState<ShiftHandover | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ShiftHandoverItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState({
    category: 'MAINTENANCE_REQUEST',
    entityType: 'MAINTENANCE_REQUEST',
    entityId: '',
    entityCode: '',
    entitySummary: '',
    priority: '',
    notes: '',
  });
  const [itemSaving, setItemSaving] = useState(false);

  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmAcknowledgeOpen, setConfirmAcknowledgeOpen] = useState(false);
  const [acting, setActing] = useState(false);

  const fetchHandover = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setHandover(await api.get<ShiftHandover>('/production/shift-handovers/' + id));
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const result = await api.get<{ data: ShiftHandoverItem[] } | ShiftHandoverItem[]>('/production/shift-handovers/' + id + '/items');
      setItems(Array.isArray(result) ? result : (result.data || []));
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setItemsLoading(false);
    }
  }, [id, handleApiError]);

  useEffect(() => {
    if (id) fetchHandover();
  }, [id, fetchHandover]);

  useEffect(() => {
    if (handover) fetchItems();
  }, [handover?.id, fetchItems]);

  const openAddItem = () => {
    setItemForm({
      category: 'MAINTENANCE_REQUEST',
      entityType: 'MAINTENANCE_REQUEST',
      entityId: '',
      entityCode: '',
      entitySummary: '',
      priority: '',
      notes: '',
    });
    setAddItemOpen(true);
  };

  const handleAddItem = async () => {
    if (!itemForm.entityId) {
      showToast(t('validation.required'), 'error');
      return;
    }
    setItemSaving(true);
    try {
      await api.post('/production/shift-handovers/' + id + '/items', {
        category: itemForm.category,
        entityType: itemForm.entityType,
        entityId: itemForm.entityId,
        entityCode: itemForm.entityCode || undefined,
        entitySummary: itemForm.entitySummary || undefined,
        priority: itemForm.priority || undefined,
        notes: itemForm.notes || undefined,
      });
      showToast(t('common.successCreated'), 'success');
      setAddItemOpen(false);
      fetchItems();
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setItemSaving(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await api.delete('/production/shift-handovers/items/' + itemId);
      showToast(t('common.successDeleted'), 'success');
      fetchItems();
    } catch (err: any) {
      handleApiError(err);
    }
  };

  const handleSubmit = async () => {
    setActing(true);
    try {
      await api.post('/production/shift-handovers/' + id + '/submit');
      showToast(t('common.successUpdated'), 'success');
      setConfirmSubmitOpen(false);
      fetchHandover();
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setActing(false);
    }
  };

  const handleAcknowledge = async () => {
    setActing(true);
    try {
      await api.post('/production/shift-handovers/' + id + '/acknowledge');
      showToast(t('common.successUpdated'), 'success');
      setConfirmAcknowledgeOpen(false);
      fetchHandover();
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title={t('production.shiftHandovers.label')} />
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  if (error || !handover) {
    return (
      <div>
        <PageHeader title={t('production.shiftHandovers.label')} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">{error || t('common.notFound')}</div>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => router.push('/admin/production/shift-handovers')}>{t('common.backToList')}</Button>
        </div>
      </div>
    );
  }

  const infoCell = (label: string, value: string) => (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900" dir={dir}>{value}</div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PageHeader title={t('production.shiftHandovers.detail')} subtitle={`${handover.outgoingShift?.code || ''} ${t('production.shiftHandovers.to')} ${handover.incomingShift?.code || ''}`} />
        <div className="flex flex-wrap gap-2">
          {handover.status === 'DRAFT' && can('create') && (
            <Button onClick={openAddItem}>{t('production.shiftHandovers.addItem')}</Button>
          )}
          {handover.status === 'DRAFT' && can('submit') && (
            <Button onClick={() => setConfirmSubmitOpen(true)}>{t('production.shiftHandovers.submit')}</Button>
          )}
          {handover.status === 'SUBMITTED' && can('acknowledge') && (
            <Button onClick={() => setConfirmAcknowledgeOpen(true)}>{t('production.shiftHandovers.acknowledge')}</Button>
          )}
          <Button variant="secondary" onClick={() => router.push('/admin/production/shift-handovers')}>{t('common.backToList')}</Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusColor(handover.status)}`}>
          {t('production.shiftHandovers.status' + handover.status)}
        </span>
        <span className="text-sm text-gray-600">{new Date(handover.handoverDate).toLocaleDateString()}</span>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {infoCell(t('production.shiftHandovers.outgoingShift'), handover.outgoingShift ? `${handover.outgoingShift.code} - ${handover.outgoingShift.name}` : '-')}
        {infoCell(t('production.shiftHandovers.incomingShift'), handover.incomingShift ? `${handover.incomingShift.code} - ${handover.incomingShift.name}` : '-')}
        {infoCell(t('production.shiftHandovers.outgoingPerson'), handover.outgoingPerson?.name || '-')}
        {infoCell(t('production.shiftHandovers.incomingPerson'), handover.incomingPerson?.name || '-')}
        {infoCell(t('production.shiftHandovers.department'), handover.department?.name || '-')}
        {infoCell(t('production.shiftHandovers.handoverDate'), new Date(handover.handoverDate).toLocaleDateString())}
        {infoCell(t('common.notes'), handover.notes || '-')}
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('production.shiftHandovers.snapshot')}</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">{t('production.shiftHandovers.activeProductionOrders')}</div>
            <div className="mt-1 text-xl font-semibold text-gray-900" dir="ltr">{handover.activeProductionOrders ?? 0}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">{t('production.shiftHandovers.openMaintenanceRequests')}</div>
            <div className="mt-1 text-xl font-semibold text-gray-900" dir="ltr">{handover.openMaintenanceRequests ?? 0}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">{t('production.shiftHandovers.stoppedMachines')}</div>
            <div className="mt-1 text-xl font-semibold text-gray-900" dir="ltr">{handover.stoppedMachines ?? 0}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">{t('production.shiftHandovers.pendingMaintenance')}</div>
            <div className="mt-1 text-xl font-semibold text-gray-900" dir="ltr">{handover.pendingMaintenance ?? 0}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('production.shiftHandovers.items')}</h3>
        {itemsLoading ? (
          <div className="text-sm text-gray-500">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">{t('common.noData')}</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#1a5632] text-white">
                  <th className="px-4 py-2 text-start">{t('production.shiftHandovers.category')}</th>
                  <th className="px-4 py-2 text-start">{t('production.shiftHandovers.entityType')}</th>
                  <th className="px-4 py-2 text-start">{t('production.shiftHandovers.entityCode')}</th>
                  <th className="px-4 py-2 text-start">{t('production.shiftHandovers.entitySummary')}</th>
                  <th className="px-4 py-2 text-start">{t('production.shiftHandovers.priority')}</th>
                  <th className="px-4 py-2 text-start">{t('common.status')}</th>
                  <th className="px-4 py-2 text-start">{t('common.notes')}</th>
                  {handover.status === 'DRAFT' && can('create') && <th className="px-4 py-2 text-start">{t('grid.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-2">{t('production.shiftHandovers.cat' + item.category)}</td>
                    <td className="px-4 py-2">{t('production.shiftHandovers.entity' + item.entityType)}</td>
                    <td className="px-4 py-2">{item.entityCode || '-'}</td>
                    <td className="px-4 py-2">{item.entitySummary || '-'}</td>
                    <td className="px-4 py-2">{item.priority || '-'}</td>
                    <td className="px-4 py-2">{item.status || '-'}</td>
                    <td className="px-4 py-2">{item.notes || '-'}</td>
                    {handover.status === 'DRAFT' && can('create') && (
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          {t('common.delete')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={addItemOpen} onClose={() => setAddItemOpen(false)} title={t('production.shiftHandovers.addItem')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('production.shiftHandovers.category')}
              value={itemForm.category}
              onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
              options={ITEM_CATEGORIES.map((v) => ({ value: v, label: t('production.shiftHandovers.cat' + v) }))}
            />
            <Select
              label={t('production.shiftHandovers.entityType')}
              value={itemForm.entityType}
              onChange={(e) => setItemForm({ ...itemForm, entityType: e.target.value, entityId: '', entityCode: '', entitySummary: '' })}
              options={ENTITY_TYPES.map((v) => ({ value: v, label: t('production.shiftHandovers.entity' + v) }))}
            />
          </div>
          <div>
            {entityAdapterForType(itemForm.entityType) ? (
              <F9Lookup
                label={t('production.shiftHandovers.entityId')}
                value={itemForm.entityId}
                adapter={entityAdapterForType(itemForm.entityType)!}
                onChange={(v) => setItemForm({ ...itemForm, entityId: v })}
                onItemSelect={(item: any) => setItemForm({
                  ...itemForm,
                  entityId: item.id,
                  entityCode: item.code || item.requestNumber || item.orderNumber || '',
                  entitySummary: item.name || item.title || '',
                })}
              />
            ) : (
              <Input
                label={t('production.shiftHandovers.entityId')}
                value={itemForm.entityId}
                onChange={(e) => setItemForm({ ...itemForm, entityId: e.target.value })}
                placeholder={t('production.shiftHandovers.entityNotAvailable')}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('production.shiftHandovers.entityCode')}
              value={itemForm.entityCode}
              onChange={(e) => setItemForm({ ...itemForm, entityCode: e.target.value })}
              disabled
            />
            <Input
              label={t('production.shiftHandovers.entitySummary')}
              value={itemForm.entitySummary}
              onChange={(e) => setItemForm({ ...itemForm, entitySummary: e.target.value })}
              disabled
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('production.shiftHandovers.priority')}
              value={itemForm.priority}
              onChange={(e) => setItemForm({ ...itemForm, priority: e.target.value })}
            />
            <div />
          </div>
          <Textarea label={t('common.notes')} value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setAddItemOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleAddItem} loading={itemSaving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmSubmitOpen} onClose={() => setConfirmSubmitOpen(false)} title={t('production.shiftHandovers.submit')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('production.shiftHandovers.submitConfirm')}</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setConfirmSubmitOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSubmit} loading={acting}>{t('production.shiftHandovers.submit')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmAcknowledgeOpen} onClose={() => setConfirmAcknowledgeOpen(false)} title={t('production.shiftHandovers.acknowledge')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('production.shiftHandovers.acknowledgeConfirm')}</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setConfirmAcknowledgeOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleAcknowledge} loading={acting}>{t('production.shiftHandovers.acknowledge')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
