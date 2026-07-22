'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Role, Permission } from '../../../../lib/admin-types';
import { Button, Input, Card, Pagination, PageHeader, LoadingState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon, ActionViewIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function RolesPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Role[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate'>('deactivate');
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const router = useRouter();

  const { exec } = useStableHandlers({
    new: () => router.push('/admin/access/roles/new'),
    edit: () => selectedRecord && router.push(`/admin/access/roles/${selectedRecord.id}/edit`),
    refresh: () => fetchData(meta.page),
    activate: () => confirmActivate(selectedId),
    deactivate: () => confirmDeactivate(selectedId),
    perms: () => selectedRecord && router.push(`/admin/access/roles/${selectedRecord.id}/permissions`),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId && !selectedRecord?.isSystem },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE' && !selectedRecord?.isSystem) },
    { id: 'perms', labelKey: 'access.managePermissions', icon: <ActionViewIcon />, onClick: () => exec('perms'), enabled: !!selectedId },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (sortColumn) { params.sortBy = sortColumn; params.sortOrder = sortDirection; }
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get<{ data: Role[]; meta: any }>('/roles', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t, sortColumn, sortDirection, filters]);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await api.get<{ data: Permission[] }>('/permissions', { params: { page: 1, limit: 1000 } });
      setPermissions(res.data || []);
    } catch (_) { }
  }, []);

  useEffect(() => { fetchData(); fetchPermissions(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', description: '' });
    setSelectedPerms([]);
    setModalOpen(true);
  };

  const openEdit = (item: Role) => {
    setEditItem(item);
    setForm({ name: item.name || '', description: item.description || '' });
    setSelectedPerms(item.permissions?.map((p) => p.permission?.id).filter(Boolean) || []);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { showToast(t('errors.requiredFields'), 'error'); return; }
    setSaving(true);
    try {
      const body = { name: form.name, description: form.description || undefined };
      if (editItem) {
        await api.patch(`/roles/${editItem.id}`, body);
        showToast(t('common.updated'), 'success');
      } else {
        await api.post('/roles', body);
        showToast(t('common.created'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openPermModal = (item: Role) => {
    setEditItem(item);
    setSelectedPerms(item.permissions?.map((p) => p.permission?.id).filter(Boolean) || []);
    setPermModalOpen(true);
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      await api.put(`/roles/${editItem!.id}/permissions`, { permissionIds: selectedPerms });
      showToast(t('roles.permissionsUpdated'), 'success');
      setPermModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePerm = (permId: string) => {
    setSelectedPerms((prev) => prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]);
  };

  const confirmDeactivate = (id: string) => { setSelectedId(id); setConfirmAction('deactivate'); setConfirmOpen(true); };
  const confirmActivate = (id: string) => { setSelectedId(id); setConfirmAction('activate'); setConfirmOpen(true); };

  const handleConfirm = async () => {
    try {
      if (confirmAction === 'activate') {
        await api.patch(`/roles/${selectedId}/reactivate`, {});
        showToast(t('common.activated'), 'success');
      } else {
        await api.delete(`/roles/${selectedId}`);
        showToast(t('common.deactivated'), 'success');
      }
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.operationFailed'), 'error');
    }
  };

  const groupedPermissions: Record<string, Permission[]> = {};
  permissions.forEach((p) => {
    const key = p.module || 'general';
    if (!groupedPermissions[key]) groupedPermissions[key] = [];
    groupedPermissions[key].push(p);
  });

  const baseColumns: GridColumn<Role>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('roles.name'), sortable: true, filterable: true },
    { key: 'description', header: t('roles.description'), sortable: true, render: (r) => r.description || '-' },
    { key: 'isSystem', header: t('roles.isSystem'), sortable: true, render: (r) => r.isSystem ? t('common.yes') : t('common.no') },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('common.active') },
      { value: 'INACTIVE', label: t('common.inactive') },
    ], render: (r) => <StatusBadge status={r.status} /> },
  ];

  const gridActions: GridAction<Role>[] = [
    { label: t('grid.view'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, onClick: (r) => router.push(`/admin/access/roles/${r.id}`) },
    { label: t('grid.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (r) => router.push(`/admin/access/roles/${r.id}/edit`), enabled: (r) => !r.isSystem },
    { label: t('access.managePermissions'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>, onClick: (r) => router.push(`/admin/access/roles/${r.id}/permissions`) },
    { label: t('common.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, onClick: (r) => confirmActivate(r.id), enabled: (r) => r.status !== 'ACTIVE' },
    { label: t('common.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, variant: 'danger', onClick: (r) => confirmDeactivate(r.id), enabled: (r) => r.status === 'ACTIVE' && !r.isSystem },
  ];

  const handleSort = useCallback((col: string, dir: 'asc' | 'desc') => {
    setSortColumn(col);
    setSortDirection(dir);
  }, []);

  const handleFilter = useCallback((col: string, value: string) => {
    setFilters(prev => ({ ...prev, [col]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearch('');
  }, []);

  return (
    <div>
      <PageHeader title={t('roles.title')} />
      {error && <div className="text-center py-12"><p className="text-red-500 mb-4">{error}</p></div>}
      {!error && loading && data.length === 0 && <LoadingState />}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12"><p className="text-gray-500">{t('common.noData')}</p></div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <AdminDataGrid
          columns={baseColumns}
          data={data}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => setSelectedId(item.id)}
          selectedKey={selectedId}
          loading={loading}
          emptyMessage={t('common.noData')}
          loadingMessage={t('common.loading')}
          error={error || undefined}
          actions={gridActions}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          filters={filters}
          onFilter={handleFilter}
          onClearFilters={handleClearFilters}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          dir={dir}
          globalSearch={search}
          onGlobalSearch={(v) => setSearch(v)}
          searchPlaceholder={t('grid.searchPlaceholder')}
          onRefresh={() => fetchData(meta.page)}
          refreshLoading={loading}
        />
      )}
      {data.length > 0 && (
        <div className="mt-3">
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </div>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('roles.edit') : t('roles.create')}>
        <div className="space-y-4">
          <Input label={t('roles.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('roles.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={permModalOpen} onClose={() => setPermModalOpen(false)} title={t('roles.assignPermissions')} size="lg">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {Object.entries(groupedPermissions).map(([module, perms]) => (
            <div key={module}>
              <h4 className="text-sm font-semibold text-gray-700 uppercase mb-2">{module}</h4>
              <div className="flex flex-wrap gap-2">
                {perms.map((perm) => (
                  <label key={perm.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedPerms.includes(perm.id)} onChange={() => togglePerm(perm.id)} className="rounded border-gray-300" />
                    <span>{perm.action} {perm.key && `(${perm.key})`}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end space-x-2 pt-4 mt-4 border-t">
          <Button variant="secondary" onClick={() => setPermModalOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSavePermissions} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
        </div>
      </Modal>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleConfirm} title={confirmAction === 'activate' ? t('roles.activateTitle') : t('roles.deactivateTitle')} message={confirmAction === 'activate' ? t('roles.activateConfirm') : t('roles.deactivateConfirm')} />
    </div>
  );
}
