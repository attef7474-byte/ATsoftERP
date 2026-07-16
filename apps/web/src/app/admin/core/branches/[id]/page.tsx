'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Branch, Department, Warehouse, Machine, User } from '../../../../../lib/admin-types';
import { Button, Card, DataTable, LoadingState, EmptyState, ErrorState, StatusBadge, Modal, ConfirmDialog, Input, CardContent } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';
import { useParams, useRouter } from 'next/navigation';

type TabId = 'overview' | 'departments' | 'warehouses' | 'machines' | 'users';

export default function BranchDetailPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', address: '', phone: '' });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate'>('deactivate');

  const fetchBranch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Branch>(`/branches/${id}`);
      setBranch(res);
    } catch (err: any) {
      if (err?.status === 404) {
        setBranch(null);
      } else {
        setError(err?.message || t('errors.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { fetchBranch(); }, [fetchBranch]);

  const fetchDepartments = useCallback(async () => {
    setDepartmentsLoading(true);
    try {
      const res = await api.get<{ data: Department[] }>('/departments', { params: { branchId: id, limit: 50 } });
      setDepartments(res.data || []);
    } catch { /* ignore */ }
    finally { setDepartmentsLoading(false); }
  }, [id]);

  const fetchWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    try {
      const res = await api.get<{ data: Warehouse[] }>('/inventory/warehouses', { params: { branchId: id, limit: 50 } });
      setWarehouses(res.data || []);
    } catch { /* ignore */ }
    finally { setWarehousesLoading(false); }
  }, [id]);

  const fetchMachines = useCallback(async () => {
    setMachinesLoading(true);
    try {
      const res = await api.get<{ data: Machine[] }>('/maintenance/machines', { params: { branchId: id, limit: 50 } });
      setMachines(res.data || []);
    } catch { /* ignore */ }
    finally { setMachinesLoading(false); }
  }, [id]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.get<{ data: User[] }>('/users', { params: { branchId: id, limit: 50 } });
      setUsers(res.data || []);
    } catch { /* ignore */ }
    finally { setUsersLoading(false); }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'departments') fetchDepartments();
    else if (activeTab === 'warehouses') fetchWarehouses();
    else if (activeTab === 'machines') fetchMachines();
    else if (activeTab === 'users') fetchUsers();
  }, [activeTab, fetchDepartments, fetchWarehouses, fetchMachines, fetchUsers]);

  const openEdit = useCallback(() => {
    if (!branch) return;
    setForm({
      code: branch.code,
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
    });
    setModalOpen(true);
  }, [branch]);

  const handleSave = async () => {
    if (!form.code || !form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      await api.patch(`/branches/${id}`, form);
      showToast(t('common.successUpdated'), 'success');
      setModalOpen(false);
      fetchBranch();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmStatusChange = (action: 'activate' | 'deactivate') => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const status = confirmAction === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await api.patch(`/branches/${id}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchBranch();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/core/branches'),
    refresh: () => fetchBranch(),
    edit: () => openEdit(),
    activate: () => confirmStatusChange('activate'),
    deactivate: () => confirmStatusChange('deactivate'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!branch },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(branch && branch.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(branch && branch.status === 'ACTIVE') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchBranch} />;
  if (!branch) return <ErrorState message={t('common.notFound')} />;

  const tabs: { id: TabId; labelKey: string }[] = [
    { id: 'overview', labelKey: 'details.branch.overview' },
    { id: 'departments', labelKey: 'core.departments' },
    { id: 'warehouses', labelKey: 'core.warehouses' },
    { id: 'machines', labelKey: 'core.machines' },
    { id: 'users', labelKey: 'core.users' },
  ];

  const departmentColumns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'company', header: t('core.company'), render: (d: Department) => d.company?.name || '-' },
    { key: 'parent', header: t('core.parentDepartment'), render: (d: Department) => d.parent?.name || '-' },
    { key: 'status', header: t('common.status'), render: (d: Department) => <StatusBadge status={d.status} /> },
  ];

  const warehouseColumns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'location', header: t('common.location'), render: (w: Warehouse) => w.location || '-' },
    { key: 'status', header: t('common.status'), render: (w: Warehouse) => <StatusBadge status={w.status} /> },
  ];

  const machineColumns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'model', header: t('common.model'), render: (m: Machine) => m.model || '-' },
    { key: 'category', header: t('core.category'), render: (m: Machine) => m.category?.name || '-' },
    { key: 'status', header: t('common.status'), render: (m: Machine) => <StatusBadge status={m.status} /> },
  ];

  const userColumns = [
    { key: 'name', header: t('common.name') },
    { key: 'email', header: t('common.email') },
    { key: 'phone', header: t('common.phone'), render: (u: User) => u.phone || '-' },
    { key: 'status', header: t('common.status'), render: (u: User) => <StatusBadge status={u.status} /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <Card>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.code')}</label>
                    <p className="mt-1 text-sm text-gray-900">{branch.code}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.name')}</label>
                    <p className="mt-1 text-sm text-gray-900">{branch.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('core.company')}</label>
                    <p className="mt-1 text-sm text-gray-900">{branch.company?.name || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.status')}</label>
                    <div className="mt-1"><StatusBadge status={branch.status} /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.address')}</label>
                    <p className="mt-1 text-sm text-gray-900">{branch.address || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.phone')}</label>
                    <p className="mt-1 text-sm text-gray-900">{branch.phone || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.createdAt')}</label>
                    <p className="mt-1 text-sm text-gray-900">{new Date(branch.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.updatedAt')}</label>
                    <p className="mt-1 text-sm text-gray-900">{new Date(branch.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case 'departments':
        return (
          <Card>
            {departmentsLoading ? <LoadingState /> : departments.length === 0 ? <EmptyState message={t('common.noData')} /> : (
              <DataTable columns={departmentColumns} data={departments} keyExtractor={(d: Department) => d.id} />
            )}
          </Card>
        );
      case 'warehouses':
        return (
          <Card>
            {warehousesLoading ? <LoadingState /> : warehouses.length === 0 ? <EmptyState message={t('common.noData')} /> : (
              <DataTable columns={warehouseColumns} data={warehouses} keyExtractor={(w: Warehouse) => w.id} />
            )}
          </Card>
        );
      case 'machines':
        return (
          <Card>
            {machinesLoading ? <LoadingState /> : machines.length === 0 ? <EmptyState message={t('common.noData')} /> : (
              <DataTable columns={machineColumns} data={machines} keyExtractor={(m: Machine) => m.id} />
            )}
          </Card>
        );
      case 'users':
        return (
          <Card>
            {usersLoading ? <LoadingState /> : users.length === 0 ? <EmptyState message={t('common.noData')} /> : (
              <DataTable columns={userColumns} data={users} keyExtractor={(u: User) => u.id} />
            )}
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('details.branch.title')}: {branch.name}</h1>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {renderTabContent()}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('core.editBranch')}>
        <div className="space-y-4">
          <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleStatusChange}
        title={confirmAction === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={confirmAction === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
        variant={confirmAction === 'activate' ? 'primary' : 'danger'}
        loading={saving}
      />
    </div>
  );
}
