'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MaintenancePersonnel } from '../../../../lib/admin-types';
import { User } from '../../../../lib/admin-types/access';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionRefreshIcon, ActionDeleteIcon } from '../../../../components/admin/admin-action-bar';

export default function MaintenancePersonnelPage() {
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
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'activate' | 'deactivate' } | null>(null);
  const [form, setForm] = useState({ code: '', name: '', role: '', specialty: '', phone: '', email: '', notes: '', userId: '' });
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<User[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [showUserResults, setShowUserResults] = useState(false);

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

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) { setUserResults([]); return; }
    setUserSearching(true);
    try {
      const res = await api.get<{ data: User[] }>('/users', { params: { search: query, limit: 20 } });
      setUserResults(res.data || []);
    } catch { setUserResults([]); }
    finally { setUserSearching(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(userSearch), 300);
    return () => clearTimeout(timer);
  }, [userSearch, searchUsers]);

  const openNew = useCallback(() => {
    setEditingId(null);
    setForm({ code: '', name: '', role: '', specialty: '', phone: '', email: '', notes: '', userId: '' });
    setSelectedUser(null);
    setUserSearch('');
    setUserResults([]);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback(async (id: string) => {
    setEditingId(id);
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<MaintenancePersonnel>(`/maintenance/personnel/${id}`);
      setForm({ code: item.code, name: item.name, role: item.role, specialty: item.specialty || '', phone: item.phone || '', email: item.email || '', notes: item.notes || '', userId: item.userId || '' });
      setSelectedUser(item.user ? { id: item.user.id, name: item.user.name, email: item.user.email } : null);
      setUserSearch(item.user ? item.user.name : '');
      setUserResults([]);
    } catch (e: any) {
      showToast(e.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  }, [showToast, t]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    try {
      await api.delete(`/maintenance/personnel/${selectedId}`);
      showToast(t('maintenance.personnelDeleted'), 'success');
      setConfirmDeleteOpen(false);
      setSelectedId(null);
      fetchData(meta.page);
    } catch (e: any) {
      showToast(e.message || 'Delete failed', 'error');
    }
  }, [selectedId, meta.page, showToast, t, fetchData]);

  const handleSave = useCallback(async () => {
    if (!form.name || !form.role) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (editingId) delete payload.code;
      if (!payload.userId) delete payload.userId;
      if (editingId) { await api.patch(`/maintenance/personnel/${editingId}`, payload); showToast(t('maintenance.personnelUpdated'), 'success'); }
      else { await api.post('/maintenance/personnel', payload); showToast(t('maintenance.personnelCreated'), 'success'); }
      setModalOpen(false); fetchData(meta.page);
    } catch (e: any) { showToast(e.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  }, [form, editingId, meta.page, showToast, t, fetchData]);

  const selectUser = (user: User) => {
    setSelectedUser({ id: user.id, name: user.name, email: user.email });
    setForm(prev => ({ ...prev, userId: user.id }));
    setUserSearch(user.name);
    setShowUserResults(false);
    setUserResults([]);
  };

  const clearUser = () => {
    setSelectedUser(null);
    setForm(prev => ({ ...prev, userId: '' }));
    setUserSearch('');
    setUserResults([]);
  };

  const handleStatusChange = useCallback(async (id: string, action: 'activate' | 'deactivate') => {
    setConfirmAction(null);
    try {
      await api.patch(`/maintenance/personnel/${id}/${action}`, {});
      showToast(action === 'activate' ? t('maintenance.personnelActivated') : t('maintenance.personnelDeactivated'), 'success');
      fetchData(meta.page);
    } catch (e: any) { showToast(e.message, 'error'); }
  }, [meta.page, showToast, t, fetchData]);

  const { exec } = useStableHandlers({ add: () => openNew(), refresh: () => fetchData(meta.page), delete: () => setConfirmDeleteOpen(true) });
  useRegisterAdminActions(useMemo(() => [
    { id: 'add', labelKey: 'actions.add', icon: React.createElement(ActionAddIcon), onClick: () => exec('add') },
    { id: 'refresh', labelKey: 'common.refresh', icon: React.createElement(ActionRefreshIcon), onClick: () => exec('refresh') },
    { id: 'delete', labelKey: 'common.delete', icon: React.createElement(ActionDeleteIcon), variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
  ], [exec, selectedId]));

  const handleRowClick = useCallback((item: MaintenancePersonnel) => {
    setSelectedId(prev => prev === item.id ? null : item.id);
  }, []);

  const columns: GridColumn<MaintenancePersonnel>[] = [
    { key: 'code', header: t('maintenance.personnelCode'), sortable: true },
    { key: 'name', header: t('maintenance.personnelName'), sortable: true },
    { key: 'role', header: t('maintenance.personnelRole') },
    { key: 'specialty', header: t('maintenance.specialty'), render: (p) => p.specialty || '-' },
    { key: 'phone', header: t('maintenance.phone') },
    { key: 'email', header: t('maintenance.email') },
    { key: 'userAccount', header: t('maintenance.userAccount'), render: (p) => p.user ? `${p.user.name} (${p.user.email})` : <span className="text-gray-400 italic">{t('common.unlinked')}</span> },
    { key: 'isActive', header: t('maintenance.isActive'), render: (p) => p.isActive ? t('common.yes') : t('common.no') },
  ];

  const gridActions: GridAction<MaintenancePersonnel>[] = [
    { label: t('actions.edit'), onClick: (s) => openEdit(s.id) },
    { label: t('actions.delete'), onClick: (s) => { setSelectedId(s.id); setConfirmDeleteOpen(true); } },
    { label: t('actions.deactivate'), onClick: (s) => setConfirmAction({ id: s.id, action: 'deactivate' }), enabled: (s) => s.isActive },
    { label: t('actions.activate'), onClick: (s) => setConfirmAction({ id: s.id, action: 'activate' }), enabled: (s) => !s.isActive },
  ];

  return (
    <div className="p-6">
      <PageHeader title={t('maintenance.maintenancePersonnel')} />
      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}
      <AdminDataGrid<MaintenancePersonnel>
        columns={columns} data={data} keyExtractor={(s) => s.id}
        selectedKey={selectedId || ''} onRowClick={handleRowClick} loading={loading} emptyMessage={t('common.noRecords')}
        error={error || undefined} onRetry={() => fetchData(meta.page)}
        actions={gridActions} globalSearch={search} onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('common.edit') : t('common.new')}>
        {loadingDetail ? (
          <div className="py-8 text-center text-gray-500">{t('common.loading')}</div>
        ) : (
          <div className="space-y-4">
            {editingId ? (
              <>
                <Input label={t('maintenance.personnelCode')} value={form.code} disabled />
                <p className="text-xs text-gray-400 -mt-3">{t('common.codeImmutableHint')}</p>
              </>
            ) : (
              <div className="text-sm text-gray-500">{t('maintenance.personnelCode')}: {t('common.autoGenerated')}</div>
            )}
            <Input label={`${t('maintenance.personnelName')} *`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label={`${t('maintenance.personnelRole')} *`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            <Input label={t('maintenance.specialty')} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
            <Input label={t('maintenance.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label={t('maintenance.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <div>
              <label className="block text-sm font-medium mb-1">{t('maintenance.userAccount')}</label>
              <div className="relative">
                <Input value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setShowUserResults(true); }} placeholder={t('common.search')} />
                {selectedUser && (
                  <button type="button" onClick={clearUser} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">&times;</button>
                )}
                {showUserResults && userSearch && (
                  <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {userSearching ? (
                      <div className="p-2 text-sm text-gray-500">{t('common.loading')}</div>
                    ) : userResults.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">{t('common.noData')}</div>
                    ) : (
                      userResults.map((u) => (
                        <button key={u.id} type="button" className="w-full text-left p-2 hover:bg-gray-100 text-sm" onClick={() => selectUser(u)}>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedUser && (
                <div className="mt-1 text-xs text-green-600">
                  {t('common.linked')}: {selectedUser.name} ({selectedUser.email})
                </div>
              )}
            </div>
            <Input label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving} variant="primary">{saving ? t('common.saving') : t('actions.save')}</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete} title={t('common.delete')} message={t('maintenance.confirmDelete') || 'Delete this personnel?'} variant="danger" />
      <ConfirmDialog open={confirmAction?.action === 'deactivate'} onClose={() => setConfirmAction(null)} onConfirm={() => handleStatusChange(confirmAction!.id, 'deactivate')} title={t('common.deactivate')} message={t('maintenance.confirmDeactivate') || 'Deactivate this personnel?'} variant="danger" />
      <ConfirmDialog open={confirmAction?.action === 'activate'} onClose={() => setConfirmAction(null)} onConfirm={() => handleStatusChange(confirmAction!.id, 'activate')} title={t('common.activate')} message={t('maintenance.confirmActivate') || 'Activate this personnel?'} />
    </div>
  );
}
