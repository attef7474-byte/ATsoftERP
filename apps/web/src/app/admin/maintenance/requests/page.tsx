'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { unwrapApiList, unwrapApiData } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { MaintenanceRequest, Machine } from '../../../../lib/admin-types';
import { useAuth } from '../../../../lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Textarea, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge, CmmsPriorityBadge } from '../../../../components/maintenance';
import { F9Lookup, machineAdapter, productionLineAdapter, machineComponentAdapter, operationTypeAdapter, costCenterAdapter, sparePartAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';

export default function MaintenanceRequestsPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { user, isSuperAdmin, permissions } = useAuth();
  const can = (key: string) => isSuperAdmin || !!permissions?.permissions.includes(key);
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
  const [form, setForm] = useState({ machineId: '', title: '', description: '', type: '', priority: 'MEDIUM', requestNumber: '', notes: '', productionLineId: '', machineComponentId: '', operationTypeId: '', costCenterId: '', machineStopped: false });
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
    complete: () => router.push(`/admin/maintenance/tasks?sourceType=MAINTENANCE_REQUEST&requestId=${selectedId}`),
    cancel: () => confirmAction(selectedId, 'cancel'),
    delete: () => confirmDelete(selectedId),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new'), visible: can('maintenance-request:create') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'start', labelKey: 'common.start', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(selectedId && selectedRecord?.status === 'OPEN') },
    { id: 'complete', labelKey: 'maintenance.executeCompleteWork', icon: <ActionCompleteIcon />, onClick: () => exec('complete'),  enabled: !!(selectedId && selectedRecord?.status === 'IN_PROGRESS') },
    { id: 'cancel', labelKey: 'common.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(selectedId && (selectedRecord?.status === 'OPEN' || selectedRecord?.status === 'IN_PROGRESS')) },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger' as const, onClick: () => exec('delete'), enabled: !!selectedId },
  ].filter(item => item.id === 'new' ? can('maintenance-request:create') : item.id === 'complete' ? can('maintenance-task:create') : true));

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
    setForm({ machineId: '', title: '', description: '', type: 'CORRECTIVE', priority: 'MEDIUM', requestNumber: '', notes: '', productionLineId: '', machineComponentId: '', operationTypeId: '', costCenterId: '', machineStopped: false });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get<{ data: MaintenanceRequest }>(`/maintenance/requests/${id}`);
      const detail = unwrapApiData<MaintenanceRequest>(res);
      setEditItem(detail);
      setForm({
        machineId: detail.machineId || '',
        title: detail.title || '',
        description: detail.description || '',
        type: detail.type || '',
        priority: detail.priority || 'MEDIUM',
        requestNumber: detail.requestNumber || '',
        notes: detail.notes || '',
        productionLineId: detail.productionLineId || '',
        machineComponentId: detail.machineComponentId || '',
        operationTypeId: detail.operationTypeId || '',
        costCenterId: detail.costCenterId || '',
        machineStopped: false,
      });
      setModalOpen(true);
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.productionLineId) errors.productionLineId = t('validation.required');
    if (!form.machineId) errors.machineId = t('validation.required');
    if (form.machineStopped && !form.description.trim()) errors.description = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = { machineId: form.machineId, priority: form.priority };
      if (editItem) payload.title = form.title;
      else payload.machineStopped = form.machineStopped;
      if (form.description) payload.description = form.description;
      if (form.notes) payload.notes = form.notes;
      if (form.productionLineId) payload.productionLineId = form.productionLineId;
      if (form.machineComponentId) payload.machineComponentId = form.machineComponentId;
      if (form.operationTypeId) payload.operationTypeId = form.operationTypeId;
      if (form.costCenterId) payload.costCenterId = form.costCenterId;
      if (editItem) {
        await api.patch(`/maintenance/requests/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        payload.type = form.type;
        await api.post(form.type === 'EMERGENCY' ? '/maintenance/requests/emergency' : '/maintenance/requests', payload);
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

  const handleMachineChange = (value: string) => {
    setForm(prev => ({
      ...prev,
      machineId: value,
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
      productionLineId: prev.productionLineId,
      machineComponentId: '',
      operationTypeId: machine.operationTypeId || '',
      costCenterId: machine.defaultCostCenterId || '',
    }));
    setValidationErrors(prev => ({ ...prev, machineId: '' }));
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
    { label: t('maintenance.executeCompleteWork'), onClick: (r: MaintenanceRequest) => router.push(`/admin/maintenance/tasks?sourceType=MAINTENANCE_REQUEST&requestId=${r.id}`), enabled: (r: MaintenanceRequest) => r.status === 'IN_PROGRESS' },
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('common.code')} value={editItem ? form.requestNumber : t('common.codeAutoGenerated')} disabled />
              <Input label={t('maintenance.createdBy')} value={editItem?.requestedBy?.name || user?.name || ''} disabled />
            </div>
            {editItem && <Input label={t('common.title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('maintenance.productionLine')} value={form.productionLineId} onChange={(v) => setForm({ ...form, productionLineId: v, machineId: '', machineComponentId: '', operationTypeId: '', costCenterId: '' })} adapter={productionLineAdapter} error={validationErrors.productionLineId} />
              <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={handleMachineChange} onItemSelect={handleMachineSelect} adapter={machineAdapter} filters={{ productionLineId: form.productionLineId }} disabled={!form.productionLineId} error={validationErrors.machineId} />
            </div>
            {!form.productionLineId && <p className="text-sm text-gray-500">{t('maintenance.selectLineFirst')}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F9Lookup label={t('maintenance.machineComponent')} value={form.machineComponentId} onChange={(v) => setForm({ ...form, machineComponentId: v })} adapter={machineComponentAdapter} filters={{ machineId: form.machineId }} disabled={!form.machineId} />
              {!editItem && <Select label={t('maintenance.machineStoppedQuestion')} value={form.machineStopped ? 'YES' : 'NO'} onChange={(e) => setForm({ ...form, machineStopped: e.target.value === 'YES' })} options={[{ value: 'NO', label: t('common.no') }, { value: 'YES', label: t('common.yes') }]} />}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <F9Lookup label={t('maintenance.operationType')} value={form.operationTypeId} onChange={(v) => setForm({ ...form, operationTypeId: v })} adapter={operationTypeAdapter} disabled={Boolean(form.machineId)} />
              <F9Lookup label={t('maintenance.costCenter')} value={form.costCenterId} onChange={(v) => setForm({ ...form, costCenterId: v })} adapter={costCenterAdapter} disabled={Boolean(form.machineId)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('maintenance.maintenanceType')} value={form.type} disabled={Boolean(editItem)} onChange={(e) => setForm({ ...form, type: e.target.value })} options={typeOptions} />
              <Select label={t('maintenance.priority')} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} options={priorityOptions} />
            </div>
            <Textarea label={t('common.description')} required={form.machineStopped} error={validationErrors.description} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
