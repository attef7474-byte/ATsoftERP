'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { CostCenter } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, companyAdapter, branchAdapter, administrationAdapter, departmentAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function CostCentersPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<CostCenter[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<CostCenter | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', type: 'GENERAL', companyId: '', branchId: '', administrationId: '', departmentId: '' });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

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
      const res = await api.get<{ data: CostCenter[]; meta: any }>('/maintenance/cost-centers', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', description: '', type: 'GENERAL', companyId: '', branchId: '', administrationId: '', departmentId: '' });
    setModalOpen(true);
  };
  const openEdit = (item: CostCenter) => {
    setEditItem(item);
    setForm({
      code: item.code, name: item.name, description: item.description || '',
      type: item.type, companyId: item.companyId || '', branchId: item.branchId || '',
      administrationId: item.administrationId || '', departmentId: item.departmentId || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { code: form.code, name: form.name, type: form.type };
      if (form.description) payload.description = form.description;
      if (form.companyId) payload.companyId = form.companyId;
      if (form.branchId) payload.branchId = form.branchId;
      if (form.administrationId) payload.administrationId = form.administrationId;
      if (form.departmentId) payload.departmentId = form.departmentId;
      if (editItem) {
        await api.patch(`/maintenance/cost-centers/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/cost-centers', payload);
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
        await api.patch(`/maintenance/cost-centers/${selectedId}/activate`);
      } else {
        await api.patch(`/maintenance/cost-centers/${selectedId}/deactivate`);
      }
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<CostCenter>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'type', header: t('maintenance.type'), render: (c: CostCenter) => c.type },
    { key: 'company', header: t('core.company'), render: (c: CostCenter) => c.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), render: (c: CostCenter) => c.branch?.name || '-' },
    { key: 'status', header: t('common.status'), render: (c: CostCenter) => <CmmsStatusBadge status={c.status} /> },
  ];

  const gridActions: GridAction<CostCenter>[] = [
    { label: t('actions.edit'), onClick: (p: CostCenter) => openEdit(p) },
    { label: t('actions.deactivate'), onClick: (p: CostCenter) => confirmStatus(p.id), enabled: (p: CostCenter) => p.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (p: CostCenter) => confirmStatus(p.id), enabled: (p: CostCenter) => p.status !== 'ACTIVE' },
  ];

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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editCostCenter') : t('maintenance.newCostCenter')} size="lg">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('maintenance.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label={t('maintenance.type')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          </div>
          <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
          <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} />
          <F9Lookup label={t('core.administration')} value={form.administrationId} onChange={(v) => setForm({ ...form, administrationId: v })} adapter={administrationAdapter} />
          <F9Lookup label={t('core.department')} value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} adapter={departmentAdapter} />
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
