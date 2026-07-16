'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Department, User, Machine } from '../../../../../lib/admin-types';
import { Button, Card, CardHeader, CardContent, DataTable, LoadingState, EmptyState, ErrorState, StatusBadge, Modal, Input, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';
import { useParams, useRouter } from 'next/navigation';

type Tab = 'overview' | 'users' | 'machines' | 'children';

export default function DepartmentDetailPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '' });
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate'>('deactivate');

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await api.get<Department>(`/departments/${id}`);
      setData(res);
    } catch (err: any) {
      if (err?.status === 404) {
        setNotFound(true);
      } else {
        setError(err?.message || t('errors.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  const fetchUsers = useCallback(async () => {
    if (!id) return;
    setUsersLoading(true);
    try {
      const res = await api.get<{ data: User[] }>('/users', { params: { departmentId: id, limit: 100 } });
      setUsers(res.data || []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [id]);

  const fetchMachines = useCallback(async () => {
    if (!id) return;
    setMachinesLoading(true);
    try {
      const res = await api.get<{ data: Machine[] }>('/maintenance/machines', { params: { departmentId: id, limit: 100 } });
      setMachines(res.data || []);
    } catch {
      setMachines([]);
    } finally {
      setMachinesLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (data && activeTab === 'users') fetchUsers();
  }, [data, activeTab, fetchUsers]);

  useEffect(() => {
    if (data && activeTab === 'machines') fetchMachines();
  }, [data, activeTab, fetchMachines]);

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/core/departments'),
    refresh: () => { fetchData(); if (activeTab === 'users') fetchUsers(); if (activeTab === 'machines') fetchMachines(); },
    edit: () => {
      if (!data) return;
      setForm({ code: data.code, name: data.name });
      setModalOpen(true);
    },
    activate: () => { setConfirmAction('activate'); setConfirmOpen(true); },
    deactivate: () => { setConfirmAction('deactivate'); setConfirmOpen(true); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(data && data.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(data && data.status === 'ACTIVE') },
  ]);

  const handleSave = async () => {
    if (!form.code || !form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      await api.patch(`/departments/${id}`, { code: form.code, name: form.name });
      showToast(t('common.successUpdated'), 'success');
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const status = confirmAction === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await api.patch(`/departments/${id}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('details.department.overview') || 'Overview' },
    { key: 'users', label: t('details.department.users') || 'Users' },
    { key: 'machines', label: t('details.department.machines') || 'Machines' },
    { key: 'children', label: t('details.department.childDepartments') || 'Child Departments' },
  ];

  const userColumns = [
    { key: 'name', header: t('common.name') },
    { key: 'email', header: t('common.email') },
    { key: 'status', header: t('common.status'), render: (u: User) => <StatusBadge status={u.status} /> },
  ];

  const machineColumns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'status', header: t('common.status'), render: (m: Machine) => <StatusBadge status={m.status} /> },
  ];

  const childColumns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
  ];

  if (notFound) {
    return <ErrorState message={t('errors.notFound')} onRetry={() => router.push('/admin/core/departments')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  if (loading || !data) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{t('common.code')}: {data.code}</p>
            </div>
            <StatusBadge status={data.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('core.company')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.company?.name || '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('core.branch')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.branch?.name || '-'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('core.parentDepartment')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.parent?.name || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700">{t('details.department.counts') || 'Counts'}</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{data._count?.children ?? 0}</p>
              <p className="text-xs text-blue-600 mt-1">{t('details.department.childDepartments') || 'Child Departments'}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{data._count?.users ?? 0}</p>
              <p className="text-xs text-green-600 mt-1">{t('details.department.users') || 'Users'}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">{data._count?.machines ?? 0}</p>
              <p className="text-xs text-purple-600 mt-1">{t('details.department.machines') || 'Machines'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">{t('common.createdAt')}</span>
              <p className="font-medium text-gray-900 mt-1">{new Date(data.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('common.updatedAt')}</span>
              <p className="font-medium text-gray-900 mt-1">{new Date(data.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-600">{t('details.department.summary') || 'Department summary information.'}</p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'users' && (
        <Card>
          <CardContent>
            {usersLoading ? (
              <LoadingState />
            ) : users.length === 0 ? (
              <EmptyState message={t('common.noData')} />
            ) : (
              <DataTable columns={userColumns} data={users} keyExtractor={(u: User) => u.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'machines' && (
        <Card>
          <CardContent>
            {machinesLoading ? (
              <LoadingState />
            ) : machines.length === 0 ? (
              <EmptyState message={t('common.noData')} />
            ) : (
              <DataTable columns={machineColumns} data={machines} keyExtractor={(m: Machine) => m.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'children' && (
        <Card>
          <CardContent>
            {!data.children || data.children.length === 0 ? (
              <EmptyState message={t('common.noData')} />
            ) : (
              <DataTable columns={childColumns} data={data.children} keyExtractor={(c: any) => c.id} />
            )}
          </CardContent>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('core.editDepartment')}>
        <div className="space-y-4">
          <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)}
        onConfirm={handleStatusChange}
        title={confirmAction === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={confirmAction === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
        variant={confirmAction === 'activate' ? 'primary' : 'danger'} loading={saving} />
    </div>
  );
}
