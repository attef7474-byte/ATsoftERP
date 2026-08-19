'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, departmentAdapter, productionLineAdapter, maintenancePersonnelAdapter } from '../../../../components/f9';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';

interface MachineResp {
  id: string;
  scopeType: string;
  machineId: string | null;
  departmentId: string | null;
  productionLineId: string | null;
  maintenancePersonnelId: string;
  responsibilityRole: string;
  isPrimary: boolean;
  startDate: string;
  endDate?: string | null;
  status: string;
  notes?: string | null;
  machine?: { id: string; code: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
  productionLine?: { id: string; code: string; name: string } | null;
  maintenancePersonnel?: { id: string; code: string; name: string; role: string; specialty?: string | null; phone?: string | null; email?: string | null };
}

export default function MachineResponsibilitiesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<MachineResp[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({ scopeType: 'MACHINE', machineId: '', departmentId: '', productionLineId: '', maintenancePersonnelId: '', responsibilityRole: '', isPrimary: false, startDate: '', endDate: '', notes: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      const res = await api.get<{ data: MachineResp[]; meta: typeof meta }>(`/maintenance/machine-responsibilities?${params}`);
      setData(res.data); setMeta(res.meta);
    } catch (e: any) { setError(e.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setForm({ scopeType: 'MACHINE', machineId: '', departmentId: '', productionLineId: '', maintenancePersonnelId: '', responsibilityRole: '', isPrimary: false, startDate: new Date().toISOString().slice(0, 10), endDate: '', notes: '' });
    setValidationErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setEditingId(id);
    setValidationErrors({});
    setModalOpen(true);
    try {
      const item = await api.get<MachineResp>(`/maintenance/machine-responsibilities/${id}`);
      setForm({ scopeType: item.scopeType || 'MACHINE', machineId: item.machineId || '', departmentId: item.departmentId || '', productionLineId: item.productionLineId || '', maintenancePersonnelId: item.maintenancePersonnelId, responsibilityRole: item.responsibilityRole, isPrimary: item.isPrimary, startDate: item.startDate.slice(0, 10), endDate: item.endDate ? item.endDate.slice(0, 10) : '', notes: item.notes || '' });
    } catch (e: any) {
      handleApiError(e);
      setModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  }, [t, showToast]);

  const handleSave = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!form.scopeType) errors.scopeType = t('validation.required');
    if (form.scopeType === 'MACHINE' && !form.machineId) errors.machineId = t('validation.required');
    if (form.scopeType === 'DEPARTMENT' && !form.departmentId) errors.departmentId = t('validation.required');
    if (form.scopeType === 'PRODUCTION_LINE' && !form.productionLineId) errors.productionLineId = t('validation.required');
    if (!form.maintenancePersonnelId) errors.maintenancePersonnelId = t('validation.required');
    if (!form.responsibilityRole) errors.responsibilityRole = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        scopeType: form.scopeType,
        machineId: form.scopeType === 'MACHINE' ? form.machineId : null,
        departmentId: form.scopeType === 'DEPARTMENT' ? form.departmentId : null,
        productionLineId: form.scopeType === 'PRODUCTION_LINE' ? form.productionLineId : null,
        maintenancePersonnelId: form.maintenancePersonnelId,
        responsibilityRole: form.responsibilityRole,
        isPrimary: form.isPrimary,
        startDate: new Date(form.startDate).toISOString(),
      };
      if (form.endDate) payload.endDate = new Date(form.endDate).toISOString();
      if (form.notes) payload.notes = form.notes;
      if (editingId) {
        await api.patch(`/maintenance/machine-responsibilities/${editingId}`, payload);
        showToast(t('maintenance.responsibilityAssigned'), 'success');
      } else {
        await api.post('/maintenance/machine-responsibilities', payload);
        showToast(t('maintenance.responsibilityAssigned'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (e: any) { handleApiError(e); }
    finally { setSaving(false); }
  }, [form, editingId, meta.page, showToast, t, fetchData]);

  const handleEnd = useCallback(async (id: string) => {
    setConfirmAction(null);
    try {
      await api.delete(`/maintenance/machine-responsibilities/${id}`);
      showToast(t('maintenance.responsibilityEnded'), 'success');
      fetchData(meta.page);
    } catch (e: any) { handleApiError(e); }
  }, [meta.page, showToast, t, fetchData]);

  const handleDelete = useCallback(async () => {
    setConfirmDeleteOpen(false);
    try {
      await api.delete('/maintenance/machine-responsibilities/' + selectedId);
      showToast(t('common.successDeleted'), 'success');
      setSelectedId('');
      fetchData(meta.page);
    } catch (e: any) { handleApiError(e); }
  }, [selectedId, meta.page, showToast, t, fetchData]);

  const { exec } = useStableHandlers({ add: () => openNew(), edit: () => selectedRecord && openEdit(selectedRecord.id), refresh: () => fetchData(meta.page), delete: () => setConfirmDeleteOpen(true) });
  useRegisterAdminActions(useMemo(() => [
    { id: 'add', labelKey: 'actions.add', icon: React.createElement(ActionAddIcon), onClick: () => exec('add') },
    { id: 'edit', labelKey: 'common.edit', icon: React.createElement(ActionEditIcon), onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: React.createElement(ActionRefreshIcon), onClick: () => exec('refresh') },
    { id: 'delete', labelKey: 'common.delete', icon: React.createElement(ActionDeleteIcon), variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
  ], [exec, selectedId]));

  const columns: GridColumn<MachineResp>[] = [
    {
      key: 'scopeType',
      header: t('maintenance.scopeType'),
      render: (r) => {
        const labels: Record<string, string> = {
          MACHINE: t('maintenance.scopeTypeMachine'),
          PRODUCTION_LINE: t('maintenance.scopeTypeProductionLine'),
          DEPARTMENT: t('maintenance.scopeTypeDepartment'),
        };
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">{labels[r.scopeType] || r.scopeType}</span>;
      },
    },
    {
      key: 'target',
      header: t('common.target'),
      render: (r) => {
        if (r.scopeType === 'MACHINE' && r.machine) return `[${r.machine.code}] ${r.machine.name}`;
        if (r.scopeType === 'DEPARTMENT' && r.department) return `[${r.department.code}] ${r.department.name}`;
        if (r.scopeType === 'PRODUCTION_LINE' && r.productionLine) return `[${r.productionLine.code}] ${r.productionLine.name}`;
        return '-';
      },
    },
    { key: 'maintenancePersonnel', header: t('maintenance.personnel'), render: (r) => r.maintenancePersonnel ? `[${r.maintenancePersonnel.code}] ${r.maintenancePersonnel.name}` : '-' },
    { key: 'responsibilityRole', header: t('maintenance.responsibilityRole') },
    { key: 'isPrimary', header: t('maintenance.isPrimary'), render: (r) => r.isPrimary ? t('common.yes') : t('common.no') },
    { key: 'startDate', header: t('maintenance.startDate'), render: (r) => r.startDate ? new Date(r.startDate).toLocaleDateString() : '-' },
    { key: 'endDate', header: t('maintenance.endDate'), render: (r) => r.endDate ? new Date(r.endDate).toLocaleDateString() : '-' },
    { key: 'status', header: t('common.status') },
  ];

  const gridActions: GridAction<MachineResp>[] = [
    { label: t('actions.edit'), onClick: (s) => openEdit(s.id) },
    { label: t('common.delete'), onClick: (s) => { setSelectedId(s.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
    { label: t('actions.deactivate'), onClick: (s) => setConfirmAction({ id: s.id }), enabled: (s) => s.status === 'ACTIVE' },
  ];

  return (
    <div className="p-6">
      <PageHeader title={t('maintenance.machineResponsibilities')} />
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <AdminDataGrid<MachineResp>
        columns={columns} data={data} keyExtractor={(s) => s.id}
        selectedKey={selectedId} loading={loading} emptyMessage={t('common.noRecords')}
        error={error || undefined} onRetry={() => fetchData(meta.page)}
        actions={gridActions} globalSearch={search} onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRowClick={(s) => setSelectedId(s.id === selectedId ? '' : s.id)}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('common.edit') : t('common.new')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('maintenance.scopeType')} *</label>
            <select
              value={form.scopeType}
              onChange={(e) => {
                const newScopeType = e.target.value;
                setForm(prev => ({
                  ...prev,
                  scopeType: newScopeType,
                  machineId: newScopeType !== 'MACHINE' ? '' : prev.machineId,
                  departmentId: newScopeType !== 'DEPARTMENT' ? '' : prev.departmentId,
                  productionLineId: newScopeType !== 'PRODUCTION_LINE' ? '' : prev.productionLineId,
                }));
                setValidationErrors(prev => ({ ...prev, machineId: '', departmentId: '', productionLineId: '' }));
              }}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="MACHINE">{t('maintenance.scopeTypeMachine')}</option>
              <option value="PRODUCTION_LINE">{t('maintenance.scopeTypeProductionLine')}</option>
              <option value="DEPARTMENT">{t('maintenance.scopeTypeDepartment')}</option>
            </select>
          </div>
          {form.scopeType === 'MACHINE' && (
            <div>
              <F9Lookup label={`${t('maintenance.machine')} *`} value={form.machineId} onChange={(v) => { setForm(prev => ({ ...prev, machineId: v })); setValidationErrors(prev => ({ ...prev, machineId: '' })); }} adapter={machineAdapter} />
              {validationErrors.machineId && <p className="text-red-500 text-sm mt-1">{validationErrors.machineId}</p>}
            </div>
          )}
          {form.scopeType === 'DEPARTMENT' && (
            <div>
              <F9Lookup label={`${t('core.department')} *`} value={form.departmentId} onChange={(v) => { setForm(prev => ({ ...prev, departmentId: v })); setValidationErrors(prev => ({ ...prev, departmentId: '' })); }} adapter={departmentAdapter} />
              {validationErrors.departmentId && <p className="text-red-500 text-sm mt-1">{validationErrors.departmentId}</p>}
            </div>
          )}
          {form.scopeType === 'PRODUCTION_LINE' && (
            <div>
              <F9Lookup label={`${t('maintenance.productionLine')} *`} value={form.productionLineId} onChange={(v) => { setForm(prev => ({ ...prev, productionLineId: v })); setValidationErrors(prev => ({ ...prev, productionLineId: '' })); }} adapter={productionLineAdapter} />
              {validationErrors.productionLineId && <p className="text-red-500 text-sm mt-1">{validationErrors.productionLineId}</p>}
            </div>
          )}
          <div>
            <F9Lookup label={`${t('maintenance.personnel')} *`} value={form.maintenancePersonnelId} onChange={(v) => { setForm(prev => ({ ...prev, maintenancePersonnelId: v })); setValidationErrors(prev => ({ ...prev, maintenancePersonnelId: '' })); }} adapter={maintenancePersonnelAdapter} />
            {validationErrors.maintenancePersonnelId && <p className="text-red-500 text-sm mt-1">{validationErrors.maintenancePersonnelId}</p>}
          </div>
          <div>
            <Input label={`${t('maintenance.responsibilityRole')} *`} value={form.responsibilityRole} onChange={(e) => { setForm(prev => ({ ...prev, responsibilityRole: e.target.value })); setValidationErrors(prev => ({ ...prev, responsibilityRole: '' })); }} />
            {validationErrors.responsibilityRole && <p className="text-red-500 text-sm mt-1">{validationErrors.responsibilityRole}</p>}
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm(prev => ({ ...prev, isPrimary: e.target.checked }))} className="rounded" />
            {t('maintenance.isPrimary')}
          </label>
          <Input label={t('maintenance.startDate')} type="date" value={form.startDate} onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))} />
          <Input label={t('maintenance.endDate')} type="date" value={form.endDate} onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))} />
          <Input label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} variant="primary">{saving ? t('common.saving') : t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmAction} onClose={() => setConfirmAction(null)} onConfirm={() => handleEnd(confirmAction!.id)} title={t('maintenance.responsibilityEnded')} message={t('maintenance.confirmEndResponsibility') || 'End this responsibility?'} variant="danger" />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete} title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" />
    </div>
  );
}
