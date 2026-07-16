'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { User, Company, Branch, Department, Role } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter, departmentAdapter, roleAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function UsersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<User[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', companyId: '', branchId: '', departmentId: '', roleId: '' });
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate'>('deactivate');
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    activate: () => confirmActivate(selectedId),
    deactivate: () => confirmDeactivate(selectedId),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: User[]; meta: any }>('/users', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  const fetchLookups = useCallback(async () => {
    try {
      const [cRes, bRes, dRes, rRes] = await Promise.allSettled([
        api.get<{ data: Company[] }>('/companies', { params: { page: 1, limit: 1000 } }),
        api.get<{ data: Branch[] }>('/branches', { params: { page: 1, limit: 1000 } }),
        api.get<{ data: Department[] }>('/departments', { params: { page: 1, limit: 1000 } }),
        api.get<{ data: Role[] }>('/roles', { params: { page: 1, limit: 1000 } }),
      ]);
      if (cRes.status === 'fulfilled') setCompanies(cRes.value.data || []);
      if (bRes.status === 'fulfilled') setBranches(bRes.value.data || []);
      if (dRes.status === 'fulfilled') setDepartments(dRes.value.data || []);
      if (rRes.status === 'fulfilled') setRoles(rRes.value.data || []);
    } catch (_) { }
  }, []);

  useEffect(() => { fetchData(); fetchLookups(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ email: '', password: '', name: '', phone: '', companyId: '', branchId: '', departmentId: '', roleId: '' });
    setModalOpen(true);
  };

  const openEdit = (item: User) => {
    setEditItem(item);
    setForm({ email: item.email || '', password: '', name: item.name || '', phone: item.phone || '', companyId: item.companyId || '', branchId: item.branchId || '', departmentId: item.departmentId || '', roleId: (item.roles && item.roles.length > 0) ? item.roles[0].role.id : '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.email || !form.name) { showToast(t('validation.required'), 'error'); return; }
    if (!editItem && !form.password) { showToast(t('users.passwordRequired'), 'error'); return; }
    setSaving(true);
    try {
      const body: any = { email: form.email, name: form.name, phone: form.phone || undefined, companyId: form.companyId || undefined, branchId: form.branchId || undefined, departmentId: form.departmentId || undefined, roleId: form.roleId || undefined };
      if (!editItem) body.password = form.password;
      if (editItem) {
        await api.patch(`/users/${editItem.id}`, body);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/users', body);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.createFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeactivate = (id: string) => { setSelectedId(id); setConfirmAction('deactivate'); setConfirmOpen(true); };
  const confirmActivate = (id: string) => { setSelectedId(id); setConfirmAction('activate'); setConfirmOpen(true); };

  const handleConfirm = async () => {
    try {
      const status = confirmAction === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await api.patch(`/users/${selectedId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    }
  };

  const getCompanyName = (id?: string | null) => id ? companies.find((c) => c.id === id)?.name || '-' : '-';
  const getBranchName = (id?: string | null) => id ? branches.find((b) => b.id === id)?.name || '-' : '-';

  const columns = [
    { key: 'email', header: t('users.email'), render: (r: User) => r.email },
    { key: 'name', header: t('users.name'), render: (r: User) => r.name },
    { key: 'phone', header: t('users.phone'), render: (r: User) => r.phone || '-' },
    { key: 'company', header: t('users.company'), render: (r: User) => getCompanyName(r.companyId) },
    { key: 'branch', header: t('users.branch'), render: (r: User) => getBranchName(r.branchId) },
    { key: 'role', header: t('users.role'), render: (r: User) => (r.roles && r.roles.length > 0) ? r.roles[0].role.name : '-' },
    { key: 'status', header: t('common.status'), render: (r: User) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: t('common.actions'), render: (r: User) => (
      <div className="flex space-x-2">
        <button onClick={() => router.push(`/admin/access/users/${r.id}`)} className="text-indigo-600 hover:text-indigo-800 text-sm">{t('details.viewDetails')}</button>
        <Button variant="secondary" size="sm" onClick={() => openEdit(r)}>{t('common.edit')}</Button>
        {r.status !== 'ACTIVE' ? (
          <Button variant="secondary" size="sm" onClick={() => confirmActivate(r.id)}>{t('common.activate')}</Button>
        ) : (
          <Button variant="danger" size="sm" onClick={() => confirmDeactivate(r.id)}>{t('common.deactivate')}</Button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title={t('users.title')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }} onRefresh={() => fetchData(meta.page)} onCreate={openCreate} createLabel={t('users.newUser')} loading={loading} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState />}
      {!error && !loading && data.length === 0 && <EmptyState />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(r: User) => r.id} onRowClick={(item: User) => setSelectedId(item.id)} selectedKey={selectedId} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('users.edit') : t('users.create')}>
        <div className="space-y-4">
          <Input label={t('users.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label={t('users.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('users.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {!editItem && <Input label={t('users.password')} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />}
          <F9Lookup label={t('users.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
          <F9Lookup label={t('users.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
          <F9Lookup label={t('users.department')} value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} adapter={departmentAdapter} filters={{ ...(form.companyId ? { companyId: form.companyId } : {}), ...(form.branchId ? { branchId: form.branchId } : {}) }} />
          <F9Lookup label={t('users.role')} value={form.roleId} onChange={(v) => setForm({ ...form, roleId: v })} adapter={roleAdapter} />
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleConfirm} title={confirmAction === 'activate' ? t('users.activateTitle') : t('users.deactivateTitle')} message={confirmAction === 'activate' ? t('users.activateConfirm') : t('users.deactivateConfirm')} />
    </div>
  );
}
