'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, maintenancePersonnelAdapter } from '../../../../components/f9';

interface MachineResp {
  id: string;
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
  const [data, setData] = useState<MachineResp[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({ machineId: '', maintenancePersonnelId: '', responsibilityRole: '', isPrimary: false, startDate: '', notes: '' });

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
    setForm({ machineId: '', maintenancePersonnelId: '', responsibilityRole: '', isPrimary: false, startDate: new Date().toISOString().slice(0, 10), notes: '' });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((item: MachineResp) => {
    setEditingId(item.id);
    setForm({ machineId: item.machineId, maintenancePersonnelId: item.maintenancePersonnelId, responsibilityRole: item.responsibilityRole, isPrimary: item.isPrimary, startDate: item.startDate.slice(0, 10), notes: item.notes || '' });
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.machineId || !form.maintenancePersonnelId || !form.responsibilityRole) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form, startDate: new Date(form.startDate).toISOString() };
      if (editingId) { await api.patch(`/maintenance/machine-responsibilities/${editingId}`, payload); showToast(t('maintenance.responsibilityAssigned'), 'success'); }
      else { await api.post('/maintenance/machine-responsibilities', payload); showToast(t('maintenance.responsibilityAssigned'), 'success'); }
      setModalOpen(false); fetchData(meta.page);
    } catch (e: any) { showToast(e.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  }, [form, editingId, meta.page, showToast, t, fetchData]);

  const handleEnd = useCallback(async (id: string) => {
    setConfirmAction(null);
    try {
      await api.delete(`/maintenance/machine-responsibilities/${id}`);
      showToast(t('maintenance.responsibilityEnded'), 'success');
      fetchData(meta.page);
    } catch (e: any) { showToast(e.message, 'error'); }
  }, [meta.page, showToast, t, fetchData]);

  const { exec } = useStableHandlers({ add: () => openNew(), refresh: () => fetchData(meta.page) });
  useRegisterAdminActions(useMemo(() => [
    { id: 'add', labelKey: 'actions.add', icon: React.createElement(ActionAddIcon), onClick: () => exec('add') },
    { id: 'refresh', labelKey: 'common.refresh', icon: React.createElement(ActionRefreshIcon), onClick: () => exec('refresh') },
  ], [exec]));

  const columns: GridColumn<MachineResp>[] = [
    { key: 'machine', header: t('maintenance.machine'), render: (r) => r.machine ? `[${r.machine.code}] ${r.machine.name}` : '-' },
    { key: 'maintenancePersonnel', header: t('maintenance.personnel'), render: (r) => r.maintenancePersonnel ? `[${r.maintenancePersonnel.code}] ${r.maintenancePersonnel.name}` : '-' },
    { key: 'responsibilityRole', header: t('maintenance.responsibilityRole') },
    { key: 'isPrimary', header: t('maintenance.isPrimary'), render: (r) => r.isPrimary ? t('common.yes') : t('common.no') },
    { key: 'status', header: t('common.status') },
  ];

  const gridActions: GridAction<MachineResp>[] = [
    { label: t('actions.edit'), onClick: (s) => openEdit(s) },
    { label: t('actions.deactivate'), onClick: (s) => setConfirmAction({ id: s.id }), enabled: (s) => s.status === 'ACTIVE' },
  ];

  return (
    <div className="p-6">
      <PageHeader title={t('maintenance.machineResponsibilities')} />
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <AdminDataGrid<MachineResp>
        columns={columns} data={data} keyExtractor={(s) => s.id}
        selectedKey="" loading={loading} emptyMessage={t('common.noRecords')}
        error={error || undefined} onRetry={() => fetchData(meta.page)}
        actions={gridActions} globalSearch={search} onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('common.edit') : t('common.new')}>
        <div className="space-y-4">
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
    </div>
  );
}