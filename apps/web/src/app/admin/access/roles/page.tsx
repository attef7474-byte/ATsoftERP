'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Role, Permission } from '../../../../lib/admin-types';
import { Button, Input, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon, ActionViewIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

export default function RolesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Role[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

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
      const res = await api.get<{ data: Role[]; meta: any }>('/roles', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

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

  const columns = [
    { key: 'name', header: t('roles.name'), render: (r: Role) => r.name },
    { key: 'description', header: t('roles.description'), render: (r: Role) => r.description || '-' },
    { key: 'isSystem', header: t('roles.isSystem'), render: (r: Role) => r.isSystem ? t('common.yes') : t('common.no') },
    { key: 'status', header: t('common.status'), render: (r: Role) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: t('common.actions'), render: (r: Role) => (
      <div className="flex space-x-2">
        <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/access/roles/${r.id}`)}>{t('common.view')}</Button>
        {!r.isSystem && <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/access/roles/${r.id}/edit`)}>{t('common.edit')}</Button>}
        <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/access/roles/${r.id}/permissions`)}>{t('access.managePermissions')}</Button>
        {r.status !== 'ACTIVE' ? (
          <Button variant="secondary" size="sm" onClick={() => confirmActivate(r.id)}>{t('common.activate')}</Button>
        ) : (
          !r.isSystem && <Button variant="danger" size="sm" onClick={() => confirmDeactivate(r.id)}>{t('common.deactivate')}</Button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title={t('roles.title')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }} onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('roles.newRole')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(r: Role) => r.id} onRowClick={(item: Role) => setSelectedId(item.id)} selectedKey={selectedId} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
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
