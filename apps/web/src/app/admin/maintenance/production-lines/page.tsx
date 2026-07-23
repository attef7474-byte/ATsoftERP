'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { ProductionLine } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog, Select } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function ProductionLinesPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<ProductionLine[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionLine | null>(null);
  const [form, setForm] = useState({
    code: '', name: '', description: '', location: '',
    companyId: '', branchId: '', administrationId: '', departmentId: '',
    operationTypeId: '', costCenterId: '', status: 'ACTIVE',
  });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const [companies, setCompanies] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [administrations, setAdministrations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [operationTypes, setOperationTypes] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: ProductionLine[]; meta: any }>('/maintenance/production-lines', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const fetchLookups = async () => {
    try {
      const [coRes, otRes, ccRes] = await Promise.all([
        api.get<any>('/companies'),
        api.get<any>('/maintenance/operation-types', { params: { limit: 100 } }),
        api.get<any>('/maintenance/cost-centers', { params: { limit: 100 } }),
      ]);
      setCompanies(coRes.data || []);
      setOperationTypes(otRes.data || []);
      setCostCenters(ccRes.data || []);
    } catch { /* ignore */ }
  };

  const fetchBranches = async (companyId: string) => {
    if (!companyId) { setBranches([]); return; }
    try {
      const res = await api.get<any>('/branches', { params: { companyId } });
      setBranches(res.data || []);
    } catch { setBranches([]); }
  };

  const fetchAdministrations = async (branchId: string) => {
    if (!branchId) { setAdministrations([]); return; }
    try {
      const res = await api.get<any>('/administrations', { params: { branchId } });
      setAdministrations(res.data || []);
    } catch { setAdministrations([]); }
  };

  const fetchDepartments = async (administrationId: string) => {
    if (!administrationId) { setDepartments([]); return; }
    try {
      const res = await api.get<any>('/departments', { params: { administrationId } });
      setDepartments(res.data || []);
    } catch { setDepartments([]); }
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', description: '', location: '', companyId: '', branchId: '', administrationId: '', departmentId: '', operationTypeId: '', costCenterId: '', status: 'ACTIVE' });
    setBranches([]); setAdministrations([]); setDepartments([]);
    fetchLookups();
    setModalOpen(true);
  };

  const openEdit = (item: ProductionLine) => {
    setEditItem(item);
    setForm({
      code: item.code, name: item.name, description: item.description || '', location: item.location || '',
      companyId: item.companyId, branchId: item.branchId, administrationId: item.administrationId || '',
      departmentId: item.departmentId, operationTypeId: item.operationTypeId,
      costCenterId: item.costCenterId || '', status: item.status,
    });
    fetchLookups();
    fetchBranches(item.companyId);
    if (item.branchId) fetchAdministrations(item.branchId);
    if (item.administrationId) fetchDepartments(item.administrationId);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.companyId || !form.branchId || !form.departmentId || !form.operationTypeId) {
      showToast(t('validation.required'), 'error'); return;
    }
    setSaving(true);
    try {
      const payload: any = {
        code: form.code || undefined, name: form.name, description: form.description || undefined,
        location: form.location || undefined, companyId: form.companyId, branchId: form.branchId,
        administrationId: form.administrationId || undefined, departmentId: form.departmentId,
        operationTypeId: form.operationTypeId, costCenterId: form.costCenterId || undefined,
        status: form.status,
      };
      if (editItem) {
        await api.patch(`/maintenance/production-lines/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/production-lines', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const confirmStatus = (id: string) => { setSelectedId(id); setConfirmOpen(true); };
  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((p) => p.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (status === 'ACTIVE') {
        await api.patch(`/maintenance/production-lines/${selectedId}/activate`);
      } else {
        await api.patch(`/maintenance/production-lines/${selectedId}/deactivate`);
      }
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionLine>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'company', header: t('core.company'), render: (p: ProductionLine) => p.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), render: (p: ProductionLine) => p.branch?.name || '-' },
    { key: 'administration', header: t('core.administration'), render: (p: ProductionLine) => p.administration?.name || '-' },
    { key: 'department', header: t('core.department'), render: (p: ProductionLine) => p.department?.name || '-' },
    { key: 'operationType', header: t('maintenance.operationType'), render: (p: ProductionLine) => p.operationType?.name || '-' },
    { key: 'costCenter', header: t('maintenance.costCenter'), render: (p: ProductionLine) => p.costCenter?.name || '-' },
    { key: 'location', header: t('maintenance.location'), render: (p: ProductionLine) => p.location || '-' },
    { key: 'status', header: t('common.status'), render: (p: ProductionLine) => <CmmsStatusBadge status={p.status} /> },
  ];

  const gridActions: GridAction<ProductionLine>[] = [
    { label: t('actions.edit'), onClick: (p: ProductionLine) => openEdit(p) },
    { label: t('actions.deactivate'), onClick: (p: ProductionLine) => confirmStatus(p.id), enabled: (p: ProductionLine) => p.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (p: ProductionLine) => confirmStatus(p.id), enabled: (p: ProductionLine) => p.status !== 'ACTIVE' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.productionLines')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(p: ProductionLine) => p.id}
        onRowClick={(p: ProductionLine) => setSelectedId(p.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editProductionLine') : t('maintenance.newProductionLine')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('maintenance.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label={t('maintenance.location')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('core.company')} value={form.companyId} placeholder={t('common.select')} options={companies.map((c: any) => ({ value: c.id, label: c.name }))} onChange={(e) => {
              const val = e.target.value;
              setForm({ ...form, companyId: val, branchId: '', administrationId: '', departmentId: '' });
              fetchBranches(val);
              setAdministrations([]); setDepartments([]);
            }} />
            <Select label={t('core.branch')} value={form.branchId} placeholder={t('common.select')} options={branches.map((b: any) => ({ value: b.id, label: b.name }))} onChange={(e) => {
              const val = e.target.value;
              setForm({ ...form, branchId: val, administrationId: '', departmentId: '' });
              fetchAdministrations(val);
              setDepartments([]);
            }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('core.administration')} value={form.administrationId} placeholder={t('common.select')} options={administrations.map((a: any) => ({ value: a.id, label: a.name }))} onChange={(e) => {
              const val = e.target.value;
              setForm({ ...form, administrationId: val, departmentId: '' });
              fetchDepartments(val);
            }} />
            <Select label={t('core.department')} value={form.departmentId} placeholder={t('common.select')} options={departments.map((d: any) => ({ value: d.id, label: d.name }))} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('maintenance.operationType')} value={form.operationTypeId} placeholder={t('common.select')} options={operationTypes.map((o: any) => ({ value: o.id, label: o.name }))} onChange={(e) => setForm({ ...form, operationTypeId: e.target.value })} />
            <Select label={t('maintenance.costCenter')} value={form.costCenterId} placeholder={t('common.select')} options={costCenters.map((c: any) => ({ value: c.id, label: c.name }))} onChange={(e) => setForm({ ...form, costCenterId: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" loading={saving} />
    </div>
  );
}
