'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { MaintenanceRequest, Machine, SparePart } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Textarea, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge, CmmsPriorityBadge } from '../../../../components/maintenance';
import { F9Lookup, machineAdapter, userAdapter, productionLineAdapter, machineComponentAdapter, operationTypeAdapter, costCenterAdapter, sparePartAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';

export default function MaintenanceRequestsPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<MaintenanceRequest[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterProductionLineId, setFilterProductionLineId] = useState('');
  const [filterMachineComponentId, setFilterMachineComponentId] = useState('');
  const [filterOperationTypeId, setFilterOperationTypeId] = useState('');
  const [filterCostCenterId, setFilterCostCenterId] = useState('');
  const [filterSparePartId, setFilterSparePartId] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceRequest | null>(null);
  const [form, setForm] = useState({ machineId: '', title: '', description: '', type: '', priority: 'MEDIUM', assignedToId: '', requestNumber: '', notes: '', productionLineId: '', machineComponentId: '', operationTypeId: '', costCenterId: '' });
  const [requiredParts, setRequiredParts] = useState<Array<{ sparePartId: string; quantity: string; unit: string; usageNote: string; isPrimary: boolean }>>([]);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    start: () => confirmAction(selectedId, 'start'),
    complete: () => confirmAction(selectedId, 'complete'),
    cancel: () => confirmAction(selectedId, 'cancel'),
    delete: () => confirmDelete(selectedId),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'start', labelKey: 'common.start', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(selectedId && selectedRecord?.status === 'OPEN') },
    { id: 'complete', labelKey: 'common.complete', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: !!(selectedId && selectedRecord?.status === 'IN_PROGRESS') },
    { id: 'cancel', labelKey: 'common.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(selectedId && (selectedRecord?.status === 'OPEN' || selectedRecord?.status === 'IN_PROGRESS')) },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (filterProductionLineId) params.productionLineId = filterProductionLineId;
      if (filterMachineComponentId) params.machineComponentId = filterMachineComponentId;
      if (filterOperationTypeId) params.operationTypeId = filterOperationTypeId;
      if (filterCostCenterId) params.costCenterId = filterCostCenterId;
      if (filterSparePartId) params.sparePartId = filterSparePartId;
      const res = await api.get<{ data: MaintenanceRequest[]; meta: any }>('/maintenance/requests', { params });
      const listResult = unwrapApiList<MaintenanceRequest, typeof meta>(res);
      setData(listResult.data);
      if (listResult.meta) setMeta(listResult.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, filterProductionLineId, filterMachineComponentId, filterOperationTypeId, filterCostCenterId, filterSparePartId, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ machineId: '', title: '', description: '', type: 'CORRECTIVE', priority: 'MEDIUM', assignedToId: '', requestNumber: '', notes: '', productionLineId: '', machineComponentId: '', operationTypeId: '', costCenterId: '' });
    setRequiredParts([]);
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get<{ data: MaintenanceRequest }>(`/maintenance/requests/${id}`);
      const detail = res.data;
      setEditItem(detail);
      setForm({
        machineId: detail.machineId || '',
        title: detail.title || '',
        description: detail.description || '',
        type: detail.type || '',
        priority: detail.priority || 'MEDIUM',
        assignedToId: detail.assignedToId || '',
        requestNumber: detail.requestNumber || '',
        notes: detail.notes || '',
        productionLineId: detail.productionLineId || '',
        machineComponentId: detail.machineComponentId || '',
        operationTypeId: detail.operationTypeId || '',
        costCenterId: detail.costCenterId || '',
      });
      setRequiredParts((detail.requiredParts || []).map((p) => ({
        sparePartId: p.sparePartId,
        quantity: String(p.quantity || '1'),
        unit: p.unit || '',
        usageNote: p.usageNote || '',
        isPrimary: !!p.isPrimary,
      })));
      setModalOpen(true);
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.title) errors.title = t('validation.required');
    if (!form.machineId) errors.machineId = t('validation.required');
    const filledParts = requiredParts.filter((p) => p.sparePartId);
    const duplicateSpareIds = filledParts.filter((p, i) => filledParts.findIndex((q) => q.sparePartId === p.sparePartId) !== i).map((p) => p.sparePartId);
    if (duplicateSpareIds.length > 0) errors.requiredParts = t('maintenance.sparePartAlreadyAddedToRequest');
    for (const p of filledParts) {
      if (!p.sparePartId) { errors.requiredParts = t('complexForms.requiredField'); break; }
      if (!p.quantity || Number(p.quantity) <= 0) { errors.requiredParts = t('maintenance.quantityMustBeGreaterThanZero'); break; }
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = { machineId: form.machineId, title: form.title, type: form.type, priority: form.priority };
      if (form.description) payload.description = form.description;
      if (form.assignedToId) payload.assignedToId = form.assignedToId;
      if (form.notes) payload.notes = form.notes;
      if (form.productionLineId) payload.productionLineId = form.productionLineId;
      if (form.machineComponentId) payload.machineComponentId = form.machineComponentId;
      if (form.operationTypeId) payload.operationTypeId = form.operationTypeId;
      if (form.costCenterId) payload.costCenterId = form.costCenterId;
      if (filledParts.length > 0) {
        payload.requiredParts = filledParts.map((p) => ({
          sparePartId: p.sparePartId,
          quantity: Number(p.quantity) || 1,
          ...(p.unit ? { unit: p.unit } : {}),
          ...(p.usageNote ? { usageNote: p.usageNote } : {}),
          isPrimary: p.isPrimary,
        }));
      }
      if (editItem) {
        await api.patch(`/maintenance/requests/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/requests', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const confirmAction = (id: string, action: string) => { setSelectedId(id); setPendingAction(action); setActionConfirmOpen(true); };
  const handleAction = async () => {
    setSaving(true);
    try {
      const actionMap: Record<string, string> = { start: 'start', complete: 'complete', cancel: 'cancel' };
      await api.patch(`/maintenance/requests/${selectedId}/${actionMap[pendingAction] || pendingAction}`);
      showToast(t(`common.successUpdated`), 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const confirmDelete = (id: string) => { setSelectedId(id); setConfirmDeleteOpen(true); };
  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/requests/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const addRequiredPart = () => {
    setRequiredParts(prev => [...prev, { sparePartId: '', quantity: '1', unit: '', usageNote: '', isPrimary: false }]);
  };

  const updateRequiredPart = (index: number, field: string, value: any) => {
    setRequiredParts(prev => prev.map((part, i) => i === index ? { ...part, [field]: value } : part));
  };

  const removeRequiredPart = (index: number) => {
    setRequiredParts(prev => prev.filter((_, i) => i !== index));
  };

  const handleMachineChange = (value: string) => {
    setForm(prev => ({
      ...prev,
      machineId: value,
      productionLineId: '',
      machineComponentId: '',
      operationTypeId: '',
      costCenterId: '',
    }));
    setValidationErrors(prev => ({ ...prev, machineId: '' }));
  };

  const handleMachineSelect = (machine: Machine) => {
    setForm(prev => ({
      ...prev,
      machineId: machine.id,
      productionLineId: machine.productionLineId || '',
      machineComponentId: '',
      operationTypeId: machine.operationTypeId || '',
      costCenterId: machine.defaultCostCenterId || '',
    }));
    setValidationErrors(prev => ({ ...prev, machineId: '' }));
  };

  const handleSparePartSelect = (index: number, sparePart: SparePart) => {
    setRequiredParts(prev => prev.map((part, i) => (
      i === index
        ? { ...part, sparePartId: sparePart.id, unit: sparePart.unit || '' }
        : part
    )));
  };

  const typeOptions = [
    { value: 'CORRECTIVE', label: t('status.CORRECTIVE') },
    { value: 'PREVENTIVE', label: t('status.PREVENTIVE') },
    { value: 'PREDICTIVE', label: t('status.PREDICTIVE') },
    { value: 'EMERGENCY', label: t('status.EMERGENCY') },
  ];
  const priorityOptions = [
    { value: 'LOW', label: t('status.LOW') },
    { value: 'MEDIUM', label: t('status.MEDIUM') },
    { value: 'HIGH', label: t('status.HIGH') },
    { value: 'URGENT', label: t('status.URGENT') },
  ];

  const columns: GridColumn<MaintenanceRequest>[] = [
    { key: 'requestNumber', header: t('maintenance.requestNumber') },
    { key: 'title', header: t('common.title') },
    { key: 'productionLine', header: t('maintenance.productionLine'), render: (r: MaintenanceRequest) => (r as any).productionLine?.name || '-' },
    { key: 'machineComponent', header: t('maintenance.machineComponent'), render: (r: MaintenanceRequest) => (r as any).machineComponent?.name || '-' },
    { key: 'operationType', header: t('maintenance.operationType'), render: (r: MaintenanceRequest) => (r as any).operationType?.name || '-' },
    { key: 'costCenter', header: t('maintenance.costCenter'), render: (r: MaintenanceRequest) => (r as any).costCenter?.name || '-' },
    { key: 'requiredPartsCount', header: t('maintenance.requiredSpareParts'), render: (r: MaintenanceRequest) => (r as any)._count?.requiredParts ?? '-' },
    { key: 'machine', header: t('maintenance.machine'), render: (r: MaintenanceRequest) => r.machine?.name || '-' },
    { key: 'type', header: t('maintenance.maintenanceType'), render: (r: MaintenanceRequest) => t(`status.${r.type}` as any) || r.type },
    { key: 'priority', header: t('maintenance.priority'), render: (r: MaintenanceRequest) => <CmmsPriorityBadge priority={r.priority} /> },
    { key: 'status', header: t('common.status'), render: (r: MaintenanceRequest) => <CmmsStatusBadge status={r.status} /> },
  ];

  const gridActions: GridAction<MaintenanceRequest>[] = [
    { label: t('details.viewDetails'), onClick: (r: MaintenanceRequest) => router.push(`/admin/maintenance/requests/${r.id}`) },
    { label: t('maintenance.start'), onClick: (r: MaintenanceRequest) => confirmAction(r.id, 'start'), enabled: (r: MaintenanceRequest) => r.status === 'OPEN' },
    { label: t('maintenance.complete'), onClick: (r: MaintenanceRequest) => confirmAction(r.id, 'complete'), enabled: (r: MaintenanceRequest) => r.status === 'IN_PROGRESS' },
    { label: t('maintenance.cancel'), onClick: (r: MaintenanceRequest) => confirmAction(r.id, 'cancel'), enabled: (r: MaintenanceRequest) => r.status === 'OPEN' || r.status === 'IN_PROGRESS', variant: 'danger' },
    { label: t('actions.edit'), onClick: (r: MaintenanceRequest) => openEdit(r.id) },
    { label: t('common.delete'), onClick: (r: MaintenanceRequest) => confirmDelete(r.id), variant: 'danger' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.maintenanceRequests')} />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <F9Lookup label={t('maintenance.filterSelectProductionLine')} value={filterProductionLineId} onChange={(v) => setFilterProductionLineId(v || '')} adapter={productionLineAdapter} />
        <F9Lookup label={t('maintenance.selectMachineComponent')} value={filterMachineComponentId} onChange={(v) => setFilterMachineComponentId(v || '')} adapter={machineComponentAdapter} />
        <F9Lookup label={t('maintenance.selectOperationType')} value={filterOperationTypeId} onChange={(v) => setFilterOperationTypeId(v || '')} adapter={operationTypeAdapter} />
        <F9Lookup label={t('maintenance.selectCostCenter')} value={filterCostCenterId} onChange={(v) => setFilterCostCenterId(v || '')} adapter={costCenterAdapter} />
        <F9Lookup label={t('maintenance.selectSparePart')} value={filterSparePartId} onChange={(v) => setFilterSparePartId(v || '')} adapter={sparePartAdapter} />
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(r: MaintenanceRequest) => r.id}
        onRowClick={(r: MaintenanceRequest) => setSelectedId(r.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
        dir={dir}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(meta.page)}
        refreshLoading={loading}
      />
      {data.length > 0 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editMaintenanceRequest') : t('maintenance.newMaintenanceRequest')} size="lg">
        {loadingDetail ? (
          <div className="p-8 text-center">{t('common.loading')}...</div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {editItem ? (
              <div>
                <Input label={t('common.code')} value={form.requestNumber} disabled />
                <p className="text-xs text-gray-500 mt-1">{t('common.codeImmutableHint')}</p>
              </div>
            ) : (
              <Input label={t('common.code')} value={t('common.codeAutoGenerated')} disabled />
            )}
            <div>
              <Input label={t('common.title')} value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setValidationErrors(prev => ({ ...prev, title: '' })); }} required />
              {validationErrors.title && <p className="text-red-500 text-sm mt-1">{validationErrors.title}</p>}
            </div>
            <div>
              <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={handleMachineChange} onItemSelect={handleMachineSelect} adapter={machineAdapter} />
              {validationErrors.machineId && <p className="text-red-500 text-sm mt-1">{validationErrors.machineId}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <F9Lookup label={t('maintenance.productionLine')} value={form.productionLineId} onChange={(v) => setForm({ ...form, productionLineId: v })} adapter={productionLineAdapter} disabled={Boolean(form.machineId)} />
              <F9Lookup label={t('maintenance.machineComponent')} value={form.machineComponentId} onChange={(v) => setForm({ ...form, machineComponentId: v })} adapter={machineComponentAdapter} filters={{ machineId: form.machineId }} disabled={!form.machineId} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <F9Lookup label={t('maintenance.operationType')} value={form.operationTypeId} onChange={(v) => setForm({ ...form, operationTypeId: v })} adapter={operationTypeAdapter} disabled={Boolean(form.machineId)} />
              <F9Lookup label={t('maintenance.costCenter')} value={form.costCenterId} onChange={(v) => setForm({ ...form, costCenterId: v })} adapter={costCenterAdapter} disabled={Boolean(form.machineId)} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{t('maintenance.requiredSpareParts')}</span>
                <Button variant="secondary" size="sm" onClick={addRequiredPart}>{t('maintenance.addRequiredPart')}</Button>
              </div>
              {requiredParts.length > 0 ? (
                <div className="space-y-4">
                  {requiredParts.map((part, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{t('maintenance.requiredPart')} #{index + 1}</span>
                        <Button variant="danger" size="sm" onClick={() => removeRequiredPart(index)}>{t('actions.remove')}</Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <F9Lookup
                          label={t('maintenance.selectSparePart')}
                          value={part.sparePartId}
                          onChange={(v) => updateRequiredPart(index, 'sparePartId', v)}
                          onItemSelect={(sparePart: SparePart) => handleSparePartSelect(index, sparePart)}
                          adapter={sparePartAdapter}
                          filters={{ machineId: form.machineId, componentId: form.machineComponentId }}
                        />
                        <Input label={t('maintenance.partRequiredQuantity')} type="number" min="1" value={part.quantity} onChange={(e) => updateRequiredPart(index, 'quantity', e.target.value)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label={t('maintenance.unit')} value={part.unit} onChange={(e) => updateRequiredPart(index, 'unit', e.target.value)} disabled />
                        <div className="flex items-center gap-2 pt-6">
                          <input type="checkbox" id={`isPrimary-${index}`} checked={part.isPrimary} onChange={(e) => updateRequiredPart(index, 'isPrimary', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <label htmlFor={`isPrimary-${index}`} className="text-sm text-gray-700">{t('maintenance.isPrimary')}</label>
                        </div>
                      </div>
                      <Textarea label={t('maintenance.partUsageNote')} value={part.usageNote} onChange={(e) => updateRequiredPart(index, 'usageNote', e.target.value)} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t('maintenance.noRequiredSpareParts')}</p>
              )}
              {validationErrors.requiredParts && <p className="text-red-500 text-sm mt-1">{validationErrors.requiredParts}</p>}
            </div>
            <F9Lookup label={t('maintenance.assignedTo')} value={form.assignedToId} onChange={(v) => setForm({ ...form, assignedToId: v })} adapter={userAdapter} />
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('maintenance.maintenanceType')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={typeOptions} />
              <Select label={t('maintenance.priority')} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} options={priorityOptions} />
            </div>
            <Textarea label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
              <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title={t('common.confirm')} message={t('common.confirmDeactivateMessage')} variant="primary" loading={saving} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
