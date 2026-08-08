'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { useAuth } from '../../../../lib/auth-context';
import { CostCenter, OperationalCostCenterAssignment } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, companyAdapter, branchAdapter, administrationAdapter, departmentAdapter, costCenterAdapter, machineAdapter, productionLineAdapter, productionUnitAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon, ActionViewIcon } from '../../../../components/admin/admin-action-bar';

const COST_CENTER_TYPES = ['PRODUCTION', 'MAINTENANCE', 'PROJECT', 'DEVELOPMENT', 'QUALITY', 'UTILITIES', 'ADMIN', 'OTHER'] as const;
const RESOURCE_TYPES = ['MACHINE', 'LINE', 'UNIT'] as const;

function toInputDate(value?: string | null): string {
  return value ? value.slice(0, 10) : '';
}

interface CostCenterForm {
  code: string;
  name: string;
  description: string;
  type: string;
  parentId: string;
  effectiveFrom: string;
  effectiveTo: string;
  isPrimary: boolean;
  reason: string;
  companyId: string;
  branchId: string;
  administrationId: string;
  departmentId: string;
}

interface AssignmentForm {
  resourceType: string;
  costCenterId: string;
  machineId: string;
  productionLineId: string;
  productionUnitId: string;
  effectiveFrom: string;
  effectiveTo: string;
  priority: number;
  reason: string;
}

export default function CostCentersPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();

  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('operational-cost-center:' + action)),
    [isSuperAdmin, permissions],
  );

  const [data, setData] = useState<CostCenter[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<CostCenter | null>(null);
  const [form, setForm] = useState<CostCenterForm>({ code: '', name: '', description: '', type: 'PRODUCTION', parentId: '', effectiveFrom: '', effectiveTo: '', isPrimary: false, reason: '', companyId: '', branchId: '', administrationId: '', departmentId: '' });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  // ── Operational assignments modal ──────────────────────────────────────────
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'list' | 'form'>('list');
  const [assignments, setAssignments] = useState<OperationalCostCenterAssignment[]>([]);
  const [assignMeta, setAssignMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [editingAssignment, setEditingAssignment] = useState<OperationalCostCenterAssignment | null>(null);
  const [assignForm, setAssignForm] = useState<AssignmentForm>({ resourceType: 'MACHINE', costCenterId: '', machineId: '', productionLineId: '', productionUnitId: '', effectiveFrom: '', effectiveTo: '', priority: 0, reason: '' });
  const [assignValidation, setAssignValidation] = useState<Record<string, string>>({});

  const [transitionOpen, setTransitionOpen] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<{ id: string; toStatus: 'ACTIVE' | 'ENDED' } | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [transitionSaving, setTransitionSaving] = useState(false);

  // ── Resolve modal ──────────────────────────────────────────────────────────
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveForm, setResolveForm] = useState<{ resourceType: string; machineId: string; productionLineId: string; productionUnitId: string; referenceDate: string }>({ resourceType: 'MACHINE', machineId: '', productionLineId: '', productionUnitId: '', referenceDate: new Date().toISOString().slice(0, 10) });
  const [resolveResult, setResolveResult] = useState<any>(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
    delete: () => selectedId && setConfirmDeleteOpen(true),
    assign: () => openAssignments(),
    resolve: () => openResolve(),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new'), enabled: can('create') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!(selectedId && can('update')) },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'assign', labelKey: 'maintenance.assignments', icon: <ActionActivateIcon />, onClick: () => exec('assign'), enabled: can('assign') },
    { id: 'resolve', labelKey: 'maintenance.resolveCostCenter', icon: <ActionViewIcon />, onClick: () => exec('resolve'), enabled: can('read') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE' && can('activate')) },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE' && can('deactivate')) },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!(selectedId && can('delete')) },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: CostCenter[]; meta: any }>('/maintenance/cost-centers', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', description: '', type: 'PRODUCTION', parentId: '', effectiveFrom: '', effectiveTo: '', isPrimary: false, reason: '', companyId: '', branchId: '', administrationId: '', departmentId: '' });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<CostCenter>(`/maintenance/cost-centers/${id}`);
      setEditItem(item);
      setForm({
        code: item.code, name: item.name, description: item.description || '',
        type: item.type, parentId: item.parentId || '', effectiveFrom: toInputDate(item.effectiveFrom), effectiveTo: toInputDate(item.effectiveTo),
        isPrimary: item.isPrimary || false, reason: '',
        companyId: item.companyId || '', branchId: item.branchId || '',
        administrationId: item.administrationId || '', departmentId: item.departmentId || '',
      });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.name) errors.name = t('validation.required');
    if (form.effectiveFrom && form.effectiveTo && form.effectiveTo < form.effectiveFrom) errors.effectiveTo = t('maintenance.effectiveRange');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = { name: form.name, type: form.type };
      if (form.description) payload.description = form.description;
      if (form.parentId) payload.parentId = form.parentId;
      if (form.effectiveFrom) payload.effectiveFrom = form.effectiveFrom;
      if (form.effectiveTo) payload.effectiveTo = form.effectiveTo;
      if (form.isPrimary) payload.isPrimary = true;
      if (form.companyId) payload.companyId = form.companyId;
      if (form.branchId) payload.branchId = form.branchId;
      if (form.administrationId) payload.administrationId = form.administrationId;
      if (form.departmentId) payload.departmentId = form.departmentId;
      if (editItem) {
        const sensitiveChanged =
          (form.parentId !== (editItem.parentId || '')) ||
          (toInputDate(editItem.effectiveFrom) !== form.effectiveFrom) ||
          (toInputDate(editItem.effectiveTo) !== form.effectiveTo) ||
          ((form.isPrimary || false) !== (editItem.isPrimary || false));
        if (sensitiveChanged && form.reason) payload.reason = form.reason;
        await api.patch(`/maintenance/cost-centers/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/cost-centers', { ...payload, code: form.code || undefined });
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const confirmStatus = (id: string) => { setSelectedId(id); setConfirmStatusOpen(true); };
  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((p) => p.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (status === 'ACTIVE') {
        await api.patch(`/maintenance/cost-centers/${selectedId}/activate`);
      } else {
        await api.patch(`/maintenance/cost-centers/${selectedId}/deactivate`);
      }
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/cost-centers/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  // ── Assignments ────────────────────────────────────────────────────────────

  const fetchAssignments = useCallback(async (page = 1) => {
    setAssignLoading(true); setAssignError('');
    try {
      const res = await api.get<{ data: OperationalCostCenterAssignment[]; meta: any }>('/maintenance/cost-centers/assignments', { params: { page, limit: 10 } });
      setAssignments(res.data || []); setAssignMeta(res.meta);
    } catch (err: any) { setAssignError(err?.message || t('errors.loadFailed')); }
    finally { setAssignLoading(false); }
  }, [t]);

  const openAssignments = () => {
    setAssignMode('list');
    setAssignOpen(true);
    fetchAssignments(1);
  };

  const resetAssignmentForm = () => {
    setAssignForm({ resourceType: 'MACHINE', costCenterId: '', machineId: '', productionLineId: '', productionUnitId: '', effectiveFrom: '', effectiveTo: '', priority: 0, reason: '' });
    setAssignValidation({});
    setEditingAssignment(null);
  };

  const openAssignmentCreate = () => {
    resetAssignmentForm();
    setAssignMode('form');
  };

  const openAssignmentEdit = (a: OperationalCostCenterAssignment) => {
    setEditingAssignment(a);
    setAssignForm({
      resourceType: a.resourceType,
      costCenterId: a.costCenterId,
      machineId: a.machineId || '',
      productionLineId: a.productionLineId || '',
      productionUnitId: a.productionUnitId || '',
      effectiveFrom: toInputDate(a.effectiveFrom),
      effectiveTo: toInputDate(a.effectiveTo),
      priority: a.priority ?? 0,
      reason: '',
    });
    setAssignValidation({});
    setAssignMode('form');
  };

  const saveAssignment = async () => {
    const errors: Record<string, string> = {};
    if (!assignForm.costCenterId) errors.costCenterId = t('validation.required');
    if (!assignForm.effectiveFrom) errors.effectiveFrom = t('validation.required');
    if (assignForm.resourceType === 'MACHINE' && !assignForm.machineId) errors.machineId = t('validation.required');
    if (assignForm.resourceType === 'LINE' && !assignForm.productionLineId) errors.productionLineId = t('validation.required');
    if (assignForm.resourceType === 'UNIT' && !assignForm.productionUnitId) errors.productionUnitId = t('validation.required');
    setAssignValidation(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        resourceType: assignForm.resourceType,
        costCenterId: assignForm.costCenterId,
        effectiveFrom: assignForm.effectiveFrom,
      };
      if (assignForm.resourceType === 'MACHINE') payload.machineId = assignForm.machineId;
      if (assignForm.resourceType === 'LINE') payload.productionLineId = assignForm.productionLineId;
      if (assignForm.resourceType === 'UNIT') payload.productionUnitId = assignForm.productionUnitId;
      if (assignForm.effectiveTo) payload.effectiveTo = assignForm.effectiveTo;
      if (assignForm.priority !== undefined && assignForm.priority !== null && String(assignForm.priority) !== '') payload.priority = assignForm.priority;
      if (assignForm.reason) payload.reason = assignForm.reason;
      if (editingAssignment) {
        await api.patch(`/maintenance/cost-centers/assignments/${editingAssignment.id}`, payload);
      } else {
        await api.post('/maintenance/cost-centers/assignments', payload);
      }
      showToast(t('maintenance.assignmentSaved'), 'success');
      setAssignMode('list');
      fetchAssignments(assignMeta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const openTransition = (id: string, toStatus: 'ACTIVE' | 'ENDED') => {
    setTransitionTarget({ id, toStatus });
    setTransitionReason('');
    setTransitionOpen(true);
  };

  const confirmTransition = async () => {
    if (!transitionTarget) return;
    if (!transitionReason.trim()) {
      showToast(t('maintenance.assignmentReasonRequired'), 'error');
      return;
    }
    setTransitionSaving(true);
    try {
      await api.post(`/maintenance/cost-centers/assignments/${transitionTarget.id}/transition`, { toStatus: transitionTarget.toStatus, reason: transitionReason });
      showToast(transitionTarget.toStatus === 'ACTIVE' ? t('maintenance.assignmentActivated') : t('maintenance.assignmentEnded'), 'success');
      setTransitionOpen(false);
      setAssignMode('list');
      fetchAssignments(assignMeta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setTransitionSaving(false); }
  };

  const deleteAssignment = async (a: OperationalCostCenterAssignment) => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/cost-centers/assignments/${a.id}`);
      showToast(t('maintenance.assignmentDeleted'), 'success');
      fetchAssignments(assignMeta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  // ── Resolve ────────────────────────────────────────────────────────────────

  const openResolve = () => {
    setResolveResult(null);
    setResolveError('');
    setResolveForm({ resourceType: 'MACHINE', machineId: '', productionLineId: '', productionUnitId: '', referenceDate: new Date().toISOString().slice(0, 10) });
    setResolveOpen(true);
  };

  const doResolve = async () => {
    setResolveLoading(true); setResolveError('');
    setResolveResult(null);
    try {
      const payload: any = { resourceType: resolveForm.resourceType, referenceDate: resolveForm.referenceDate };
      if (resolveForm.resourceType === 'MACHINE') payload.machineId = resolveForm.machineId;
      if (resolveForm.resourceType === 'LINE') payload.productionLineId = resolveForm.productionLineId;
      if (resolveForm.resourceType === 'UNIT') payload.productionUnitId = resolveForm.productionUnitId;
      const result = await api.post<any>('/maintenance/cost-centers/resolve', payload);
      setResolveResult(result);
    } catch (err: any) {
      setResolveError(err?.message || t('errors.loadFailed'));
    }
    finally { setResolveLoading(false); }
  };

  // ── Grids ──────────────────────────────────────────────────────────────────

  const columns: GridColumn<CostCenter>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'type', header: t('maintenance.type'), render: (c: CostCenter) => c.type },
    { key: 'parent', header: t('maintenance.parent'), render: (c: CostCenter) => c.parent ? `[${c.parent.code}] ${c.parent.name}` : '-' },
    { key: 'company', header: t('core.company'), render: (c: CostCenter) => c.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), render: (c: CostCenter) => c.branch?.name || '-' },
    { key: 'effectiveFrom', header: t('maintenance.effectiveFrom'), render: (c: CostCenter) => toInputDate(c.effectiveFrom) || '-' },
    { key: 'effectiveTo', header: t('maintenance.effectiveTo'), render: (c: CostCenter) => toInputDate(c.effectiveTo) || '-' },
    { key: 'primary', header: t('maintenance.isPrimary'), render: (c: CostCenter) => c.isPrimary ? t('common.yes') : t('common.no') },
    { key: 'status', header: t('common.status'), render: (c: CostCenter) => <CmmsStatusBadge status={c.status} /> },
  ];

  const gridActions: GridAction<CostCenter>[] = [
    { label: t('actions.edit'), onClick: (p: CostCenter) => openEdit(p.id), enabled: (p: CostCenter) => can('update') },
    { label: t('common.delete'), onClick: (p: CostCenter) => { setSelectedId(p.id); setConfirmDeleteOpen(true); }, variant: 'danger', enabled: (p: CostCenter) => can('delete') },
    { label: t('actions.deactivate'), onClick: (p: CostCenter) => confirmStatus(p.id), enabled: (p: CostCenter) => p.status === 'ACTIVE' && can('deactivate'), variant: 'danger' },
    { label: t('actions.activate'), onClick: (p: CostCenter) => confirmStatus(p.id), enabled: (p: CostCenter) => p.status !== 'ACTIVE' && can('activate') },
  ];

  const assignColumns: GridColumn<OperationalCostCenterAssignment>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'costCenter', header: t('maintenance.costCenter'), render: (a: OperationalCostCenterAssignment) => a.costCenter ? `[${a.costCenter.code}] ${a.costCenter.name}` : '-' },
    { key: 'resourceType', header: t('maintenance.resourceType'), render: (a: OperationalCostCenterAssignment) => a.resourceType },
    { key: 'resource', header: t('common.name'), render: (a: OperationalCostCenterAssignment) => a.machine?.name || a.productionLine?.name || a.productionUnit?.name || '-' },
    { key: 'effectiveFrom', header: t('maintenance.effectiveFrom'), render: (a: OperationalCostCenterAssignment) => toInputDate(a.effectiveFrom) || '-' },
    { key: 'effectiveTo', header: t('maintenance.effectiveTo'), render: (a: OperationalCostCenterAssignment) => toInputDate(a.effectiveTo) || '-' },
    { key: 'priority', header: t('maintenance.priority'), render: (a: OperationalCostCenterAssignment) => a.priority },
    { key: 'status', header: t('common.status'), render: (a: OperationalCostCenterAssignment) => <CmmsStatusBadge status={a.status} /> },
  ];

  const assignActions: GridAction<OperationalCostCenterAssignment>[] = [
    { label: t('actions.edit'), onClick: (a: OperationalCostCenterAssignment) => openAssignmentEdit(a), enabled: (a: OperationalCostCenterAssignment) => a.status !== 'ENDED' && can('assign') },
    { label: t('maintenance.activateAssignment'), onClick: (a: OperationalCostCenterAssignment) => openTransition(a.id, 'ACTIVE'), enabled: (a: OperationalCostCenterAssignment) => a.status === 'DRAFT' && can('assign') },
    { label: t('maintenance.endAssignment'), onClick: (a: OperationalCostCenterAssignment) => openTransition(a.id, 'ENDED'), enabled: (a: OperationalCostCenterAssignment) => a.status === 'ACTIVE' && can('assign'), variant: 'danger' },
    { label: t('common.delete'), onClick: (a: OperationalCostCenterAssignment) => deleteAssignment(a), enabled: (a: OperationalCostCenterAssignment) => a.status === 'DRAFT' && can('assign'), variant: 'danger' },
  ];

  if (!can('read')) {
    return <div><PageHeader title={t('maintenance.costCenters')} /><div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{t('validation.forbidden')}</div></div>;
  }

  return (
    <div>
      <PageHeader title={t('maintenance.costCenters')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(p: CostCenter) => p.id}
        onRowClick={(p: CostCenter) => setSelectedId(p.id)}
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

      {/* Cost center create / edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editCostCenter') : t('maintenance.newCostCenter')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {editItem ? (
              <div>
                <Input label={t('common.code')} value={form.code} disabled />
                <p className="text-xs text-gray-500 mt-1">{t('common.codeImmutableHint')}</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.code')}</label>
                <p className="text-sm text-gray-500 italic">{t('common.codeAutoGenerated')}</p>
              </div>
            )}
            <div>
              <Input label={t('common.name')} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} required />
              {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('maintenance.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Select
              label={t('maintenance.type')}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={COST_CENTER_TYPES.map((type) => ({ value: type, label: type }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('maintenance.parentCostCenter')} value={form.parentId} onChange={(v) => setForm({ ...form, parentId: v })} adapter={costCenterAdapter} />
            <label className="flex items-center gap-2 text-sm pt-6">
              <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
              {t('maintenance.isPrimary')}
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input type="date" label={t('maintenance.effectiveFrom')} value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
            <Input type="date" label={t('maintenance.effectiveTo')} value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
            {validationErrors.effectiveTo && <p className="text-red-500 text-sm">{validationErrors.effectiveTo}</p>}
          </div>
          <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
          <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} />
          <F9Lookup label={t('core.administration')} value={form.administrationId} onChange={(v) => setForm({ ...form, administrationId: v })} adapter={administrationAdapter} />
          <F9Lookup label={t('core.department')} value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} adapter={departmentAdapter} />
          {editItem && (
            <div>
              <Textarea label={t('maintenance.reason')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} />
              <p className="text-xs text-gray-500 mt-1">{t('maintenance.reasonRequiredHint')}</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
        )}
      </Modal>

      {/* Assignments */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title={t('maintenance.assignments')} size="lg">
        {assignMode === 'form' ? (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t('maintenance.resourceType')}
                value={assignForm.resourceType}
                onChange={(e) => setAssignForm({ ...assignForm, resourceType: e.target.value, machineId: '', productionLineId: '', productionUnitId: '' })}
                options={RESOURCE_TYPES.map((type) => ({ value: type, label: type }))}
              />
              <F9Lookup label={t('maintenance.costCenter')} value={assignForm.costCenterId} onChange={(v) => setAssignForm({ ...assignForm, costCenterId: v })} adapter={costCenterAdapter} />
            </div>
            {assignForm.resourceType === 'MACHINE' && (
              <F9Lookup label={t('maintenance.selectMachine')} value={assignForm.machineId} onChange={(v) => setAssignForm({ ...assignForm, machineId: v })} adapter={machineAdapter} />
            )}
            {assignForm.resourceType === 'LINE' && (
              <F9Lookup label={t('maintenance.selectLine')} value={assignForm.productionLineId} onChange={(v) => setAssignForm({ ...assignForm, productionLineId: v })} adapter={productionLineAdapter} />
            )}
            {assignForm.resourceType === 'UNIT' && (
              <F9Lookup label={t('maintenance.selectUnit')} value={assignForm.productionUnitId} onChange={(v) => setAssignForm({ ...assignForm, productionUnitId: v })} adapter={productionUnitAdapter} />
            )}
            <div className="grid grid-cols-3 gap-4">
              <Input type="date" label={t('maintenance.effectiveFrom')} value={assignForm.effectiveFrom} onChange={(e) => setAssignForm({ ...assignForm, effectiveFrom: e.target.value })} />
              <Input type="date" label={t('maintenance.effectiveTo')} value={assignForm.effectiveTo} onChange={(e) => setAssignForm({ ...assignForm, effectiveTo: e.target.value })} />
              <Input type="number" min={0} label={t('maintenance.priority')} value={String(assignForm.priority)} onChange={(e) => setAssignForm({ ...assignForm, priority: Number(e.target.value) })} />
            </div>
            <p className="text-xs text-gray-500">{t('maintenance.priorityHint')}</p>
            <Textarea label={t('maintenance.reason')} value={assignForm.reason} onChange={(e) => setAssignForm({ ...assignForm, reason: e.target.value })} rows={2} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => { setAssignMode('list'); }}>{t('common.back')}</Button>
              <Button onClick={saveAssignment} loading={saving}>{t('actions.save')}</Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-end mb-3">
              {can('assign') && <Button onClick={openAssignmentCreate}>{t('maintenance.newAssignment')}</Button>}
            </div>
            <AdminDataGrid
              columns={assignColumns}
              data={assignments}
              keyExtractor={(a: OperationalCostCenterAssignment) => a.id}
              loading={assignLoading}
              emptyMessage={t('common.noData')}
              error={assignError || undefined}
              onRetry={() => fetchAssignments(assignMeta.page)}
              actions={assignActions}
              dir={dir}
              onRefresh={() => fetchAssignments(assignMeta.page)}
              refreshLoading={assignLoading}
            />
            {assignments.length > 0 && (
              <Pagination page={assignMeta.page} totalPages={assignMeta.totalPages} total={assignMeta.total} onPageChange={fetchAssignments} />
            )}
          </div>
        )}
      </Modal>

      {/* Assignment transition */}
      <Modal open={transitionOpen} onClose={() => setTransitionOpen(false)} title={transitionTarget?.toStatus === 'ACTIVE' ? t('maintenance.activateAssignment') : t('maintenance.endAssignment')}>
        <div className="space-y-4">
          <Textarea label={t('maintenance.reason')} value={transitionReason} onChange={(e) => setTransitionReason(e.target.value)} rows={2} required />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setTransitionOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={confirmTransition} loading={transitionSaving}>{t('actions.confirm')}</Button>
          </div>
        </div>
      </Modal>

      {/* Resolve */}
      <Modal open={resolveOpen} onClose={() => setResolveOpen(false)} title={t('maintenance.resolveCostCenter')}>
        <div className="space-y-4">
          <Select
            label={t('maintenance.resourceType')}
            value={resolveForm.resourceType}
            onChange={(e) => setResolveForm({ ...resolveForm, resourceType: e.target.value, machineId: '', productionLineId: '', productionUnitId: '' })}
            options={RESOURCE_TYPES.map((type) => ({ value: type, label: type }))}
          />
          {resolveForm.resourceType === 'MACHINE' && (
            <F9Lookup label={t('maintenance.selectMachine')} value={resolveForm.machineId} onChange={(v) => setResolveForm({ ...resolveForm, machineId: v })} adapter={machineAdapter} />
          )}
          {resolveForm.resourceType === 'LINE' && (
            <F9Lookup label={t('maintenance.selectLine')} value={resolveForm.productionLineId} onChange={(v) => setResolveForm({ ...resolveForm, productionLineId: v })} adapter={productionLineAdapter} />
          )}
          {resolveForm.resourceType === 'UNIT' && (
            <F9Lookup label={t('maintenance.selectUnit')} value={resolveForm.productionUnitId} onChange={(v) => setResolveForm({ ...resolveForm, productionUnitId: v })} adapter={productionUnitAdapter} />
          )}
          <Input type="date" label={t('maintenance.referenceDate')} value={resolveForm.referenceDate} onChange={(e) => setResolveForm({ ...resolveForm, referenceDate: e.target.value })} />
          {resolveError && <p className="text-red-600 text-sm">{resolveError}</p>}
          {resolveResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-1">
              <p className="font-medium">{t('maintenance.resolutionResult')}</p>
              <p>{t('maintenance.resolvedCostCenter')}: <strong>[{resolveResult.costCenter?.code}] {resolveResult.costCenter?.name}</strong></p>
              <p>{t('maintenance.matchedAssignment')}: {resolveResult.matchedAssignment?.code} ({t('maintenance.priority')}: {resolveResult.matchedAssignment?.priority})</p>
              <p className="text-xs text-gray-600">
                {resolveResult.hierarchyChain?.map((node: any) => `[${node.code}] ${node.name}`).join(' → ') || ''}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setResolveOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={doResolve} loading={resolveLoading} disabled={!resolveForm.machineId && !resolveForm.productionLineId && !resolveForm.productionUnitId}>{t('maintenance.resolveCostCenter')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmStatusOpen} onClose={() => setConfirmStatusOpen(false)} onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" loading={saving} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
