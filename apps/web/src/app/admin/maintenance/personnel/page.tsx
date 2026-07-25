'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MaintenancePersonnel } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

export default function MaintenancePersonnelPage() {
  const router = typeof window !== 'undefined' ? { push: (url: string) => window.location.href = url } : { push: () => {} };
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<MaintenancePersonnel[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'activate' | 'deactivate' } | null>(null);
  const [form, setForm] = useState({ code: '', name: '', role: '', specialty: '', phone: '', email: '', notes: '' });

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      const res = await api.get<{ data: MaintenancePersonnel[]; meta: typeof meta }>(`/maintenance/personnel?${params}`);
      setData(res.data); setMeta(res.meta);
    } catch (e: any) { setError(e.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setForm({ code: '', name: '', role: '', specialty: '', phone: '', email: '', notes: '' });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((item: MaintenancePersonnel) => {
    setEditingId(item.id);
    setForm({ code: item.code, name: item.name, role: item.role, specialty: item.specialty || '', phone: item.phone || '', email: item.email || '', notes: item.notes || '' });
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.code || !form.name || !form.role) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      if (editingId) { await api.patch(`/maintenance/personnel/${editingId}`, form); showToast(t('maintenance.personnelUpdated'), 'success'); }
      else { await api.post('/maintenance/personnel', form); showToast(t('maintenance.personnelCreated'), 'success'); }
      setModalOpen(false); fetchData(meta.page);
    } catch (e: any) { showToast(e.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  }, [form, editingId, meta.page, showToast, t, fetchData]);

  const handleStatusChange = useCallback(async (id: string, action: 'activate' | 'deactivate') => {
    setConfirmAction(null);
    try {
      await api.patch(`/maintenance/personnel/${id}/${action}`, {});
      showToast(action === 'activate' ? t('maintenance.personnelActivated') : t('maintenance.personnelDeactivated'), 'success');
      fetchData(meta.page);
    } catch (e: any) { showToast(e.message, 'error'); }
  }, [meta.page, showToast, t, fetchData]);

  const { exec } = useStableHandlers({ add: () => openNew(), refresh: () => fetchData(meta.page) });
  useRegisterAdminActions(useMemo(() => [
    { id: 'add', labelKey: 'common.add', icon: React.createElement(ActionAddIcon), onClick: () => exec('add') },
    { id: 'refresh', labelKey: 'common.refresh', icon: React.createElement(ActionRefreshIcon), onClick: () => exec('refresh') },
  ], [exec]));

  const columns: GridColumn<MaintenancePersonnel>[] = [
    { key: 'code', header: t('maintenance.personnelCode'), sortable: true },
    { key: 'name', header: t('maintenance.personnelName'), sortable: true },
    { key: 'role', header: t('maintenance.personnelRole') },
    { key: 'specialty', header: t('maintenance.specialty'), render: (p) => p.specialty || '-' },
    { key: 'phone', header: t('maintenance.phone') },
    { key: 'email', header: t('maintenance.email') },
    { key: 'isActive', header: t('maintenance.isActive'), render: (p) => p.isActive ? t('common.yes') : t('common.no') },
  ];

  const gridActions: GridAction<MaintenancePersonnel>[] = [
    { label: t('actions.edit'), onClick: (s) => openEdit(s) },
    { label: t('actions.deactivate'), onClick: (s) => setConfirmAction({ id: s.id, action: 'deactivate' }), enabled: (s) => s.isActive },
    { label: t('actions.activate'), onClick: (s) => setConfirmAction({ id: s.id, action: 'activate' }), enabled: (s) => !s.isActive },
  ];

  return (
    <div className="p-6">
      <PageHeader title={t('maintenance.maintenancePersonnel')} />
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <AdminDataGrid<MaintenancePersonnel>
        columns={columns} data={data} keyExtractor={(s) => s.id}
        selectedKey="" loading={loading} emptyMessage={t('common.noRecords')}
        error={error || undefined} onRetry={() => fetchData(meta.page)}
        actions={gridActions} globalSearch={search} onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('common.edit') : t('common.new')}>
        <div className="space-y-4">
          <Input label={`${t('maintenance.personnelCode')} *`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input label={`${t('maintenance.personnelName')} *`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={`${t('maintenance.personnelRole')} *`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <Input label={t('maintenance.specialty')} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
          <Input label={t('maintenance.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label={t('maintenance.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} variant="primary">{saving ? t('common.saving') : t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmAction?.action === 'deactivate'} onClose={() => setConfirmAction(null)} onConfirm={() => handleStatusChange(confirmAction!.id, 'deactivate')} title={t('common.deactivate')} message={t('maintenance.confirmDeactivate') || 'Deactivate this personnel?'} variant="danger" />
      <ConfirmDialog open={confirmAction?.action === 'activate'} onClose={() => setConfirmAction(null)} onConfirm={() => handleStatusChange(confirmAction!.id, 'activate')} title={t('common.activate')} message={t('maintenance.confirmActivate') || 'Activate this personnel?'} />
    </div>
  );
}