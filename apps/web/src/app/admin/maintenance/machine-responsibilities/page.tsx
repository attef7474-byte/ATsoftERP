'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, maintenancePersonnelAdapter } from '../../../../components/f9';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';

interface MachineResp {
  id: string;
  code: string;
  machineId: string;
  maintenancePersonnelId: string;
  responsibilityRole: string;
  isPrimary: boolean;
  startDate: string;
  endDate?: string | null;
  status: string;
  notes?: string | null;
  machine?: { id: string; code: string; name: string };
  maintenancePersonnel?: { id: string; code: string; name: string; role: string };
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
  const [form, setForm] = useState({ code: '', machineId: '', maintenancePersonnelId: '', responsibilityRole: '', isPrimary: false, startDate: '', notes: '' });

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
    setForm({ code: '', machineId: '', maintenancePersonnelId: '', responsibilityRole: '', isPrimary: false, startDate: new Date().toISOString().slice(0, 10), notes: '' });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setEditingId(id);
    setModalOpen(true);
    try {
      const item = await api.get<MachineResp>(`/maintenance/machine-responsibilities/${id}`);
      setForm({ code: item.code || '', machineId: item.machineId, maintenancePersonnelId: item.maintenancePersonnelId, responsibilityRole: item.responsibilityRole, isPrimary: item.isPrimary, startDate: item.startDate.slice(0, 10), notes: item.notes || '' });
    } catch (e: any) {
      handleApiError(e);
      setModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  }, [t, showToast]);

  const handleSave = useCallback(async () => {
    if (!form.machineId || !form.maintenancePersonnelId || !form.responsibilityRole) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { ...form, startDate: new Date(form.startDate).toISOString() };
      if (editingId) {
        delete payload.code;
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
    { key: 'code', header: t('common.code') },
    { key: 'machine', header: t('maintenance.machine'), render: (r) => r.machine ? `[${r.machine.code}] ${r.machine.name}` : '-' },
    { key: 'maintenancePersonnel', header: t('maintenance.personnel'), render: (r) => r.maintenancePersonnel ? `[${r.maintenancePersonnel.code}] ${r.maintenancePersonnel.name}` : '-' },
    { key: 'responsibilityRole', header: t('maintenance.responsibilityRole') },
    { key: 'isPrimary', header: t('maintenance.isPrimary'), render: (r) => r.isPrimary ? t('common.yes') : t('common.no') },
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
          {editingId ? (
            <Input label={t('common.code')} value={form.code} disabled />
          ) : (
            <div className="text-sm text-gray-500 self-end pb-2">{t('common.code')}: {t('common.autoGenerated')}</div>
          )}
          <F9Lookup label={`${t('maintenance.machine')} *`} value={form.machineId} onChange={(v) => setForm({ ...form, machineId: v })} adapter={machineAdapter} />
          <F9Lookup label={`${t('maintenance.personnel')} *`} value={form.maintenancePersonnelId} onChange={(v) => setForm({ ...form, maintenancePersonnelId: v })} adapter={maintenancePersonnelAdapter} />
          <Input label={`${t('maintenance.responsibilityRole')} *`} value={form.responsibilityRole} onChange={(e) => setForm({ ...form, responsibilityRole: e.target.value })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} className="rounded" />
            {t('maintenance.isPrimary')}
          </label>
          <Input label={t('maintenance.startDate')} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <Input label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
