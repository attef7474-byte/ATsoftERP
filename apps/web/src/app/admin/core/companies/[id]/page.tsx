'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Company, Branch, Department, User, Warehouse } from '../../../../../lib/admin-types';
import { Button, Card, DataTable, LoadingState, EmptyState, ErrorState, StatusBadge, Modal, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';
import { useParams, useRouter } from 'next/navigation';
import { formatDateTime } from '../../../../../lib/format';

const TABS = ['overview', 'branches', 'departments', 'users', 'warehouses'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL_KEYS: Record<Tab, string> = {
  overview: 'details.overview',
  branches: 'navigation.branches',
  departments: 'navigation.departments',
  users: 'navigation.users',
  warehouses: 'navigation.warehouses',
};

export default function CompanyDetailPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', legalName: '', taxNumber: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate'>('deactivate');

  const fetchCompany = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await api.get<Company>(`/companies/${companyId}`);
      setCompany(res);
    } catch (err: any) {
      if (err.status === 404) {
        setNotFound(true);
      } else {
        setError(err?.message || t('errors.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  const fetchBranches = useCallback(async () => {
    setBranchesLoading(true);
    try {
      const res = await api.get<{ data: Branch[] }>('/branches', { params: { companyId } });
      setBranches(res.data || []);
    } catch { /* ignore */ } finally { setBranchesLoading(false); }
  }, [companyId]);

  const fetchDepartments = useCallback(async () => {
    setDepartmentsLoading(true);
    try {
      const res = await api.get<{ data: Department[] }>('/departments', { params: { companyId } });
      setDepartments(res.data || []);
    } catch { /* ignore */ } finally { setDepartmentsLoading(false); }
  }, [companyId]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.get<{ data: User[] }>('/users', { params: { companyId } });
      setUsers(res.data || []);
    } catch { /* ignore */ } finally { setUsersLoading(false); }
  }, [companyId]);

  const fetchWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    try {
      const res = await api.get<{ data: Warehouse[] }>('/inventory/warehouses', { params: { companyId } });
      setWarehouses(res.data || []);
    } catch { /* ignore */ } finally { setWarehousesLoading(false); }
  }, [companyId]);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'branches') fetchBranches();
    else if (tab === 'departments') fetchDepartments();
    else if (tab === 'users') fetchUsers();
    else if (tab === 'warehouses') fetchWarehouses();
  }, [fetchBranches, fetchDepartments, fetchUsers, fetchWarehouses]);

  const openEdit = useCallback(() => {
    if (!company) return;
    setForm({
      code: company.code,
      name: company.name,
      legalName: company.legalName || '',
      taxNumber: company.taxNumber || '',
      phone: company.phone || '',
      email: company.email || '',
      address: company.address || '',
    });
    setEditOpen(true);
  }, [company]);

  const handleSave = async () => {
    if (!form.code || !form.name) {
      showToast(t('validation.required'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/companies/${companyId}`, form);
      showToast(t('common.successUpdated'), 'success');
      setEditOpen(false);
      fetchCompany();
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
      await api.patch(`/companies/${companyId}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchCompany();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = useCallback(() => {
    fetchCompany();
    if (activeTab === 'branches') fetchBranches();
    else if (activeTab === 'departments') fetchDepartments();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'warehouses') fetchWarehouses();
  }, [activeTab, fetchCompany, fetchBranches, fetchDepartments, fetchUsers, fetchWarehouses]);

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => handleRefresh(),
    edit: () => openEdit(),
    activate: () => { setConfirmAction('activate'); setConfirmOpen(true); },
    deactivate: () => { setConfirmAction('deactivate'); setConfirmOpen(true); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!company },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(company && company.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(company && company.status === 'ACTIVE') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchCompany} />;
  if (notFound || !company) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">{t('errors.notFound')}</p>
        <Button variant="secondary" onClick={() => router.back()}>{t('common.back')}</Button>
      </div>
    );
  }

  const branchColumns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'phone', header: t('common.phone'), render: (item: Branch) => item.phone || '-' },
    { key: 'address', header: t('common.address'), render: (item: Branch) => item.address || '-' },
    { key: 'status', header: t('common.status'), render: (item: Branch) => <StatusBadge status={item.status} /> },
  ];

  const departmentColumns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'status', header: t('common.status'), render: (item: Department) => <StatusBadge status={item.status} /> },
  ];

  const userColumns = [
    { key: 'name', header: t('common.name') },
    { key: 'email', header: t('common.email') },
    { key: 'phone', header: t('common.phone'), render: (item: User) => item.phone || '-' },
    { key: 'status', header: t('common.status'), render: (item: User) => <StatusBadge status={item.status} /> },
  ];

  const warehouseColumns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'location', header: t('inventory.location'), render: (item: Warehouse) => item.location || '-' },
    { key: 'status', header: t('common.status'), render: (item: Warehouse) => <StatusBadge status={item.status} /> },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('details.company.title')}</h1>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t(TAB_LABEL_KEYS[tab])}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('details.overview')}</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t('details.company.code')}</p>
                  <p className="font-medium text-gray-900">{company.code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('details.company.name')}</p>
                  <p className="font-medium text-gray-900">{company.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('core.legalName')}</p>
                  <p className="font-medium text-gray-900">{company.legalName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('core.taxNumber')}</p>
                  <p className="font-medium text-gray-900">{company.taxNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('common.phone')}</p>
                  <p className="font-medium text-gray-900">{company.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('common.email')}</p>
                  <p className="font-medium text-gray-900">{company.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('common.address')}</p>
                  <p className="font-medium text-gray-900">{company.address || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('common.status')}</p>
                  <StatusBadge status={company.status} />
                </div>
              </div>
            </div>
          </Card>

          {company._count && (
            <Card>
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{t('details.relatedRecords')}</h2>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{company._count.branches}</div>
                    <p className="text-sm text-gray-500">{t('details.company.branches')}</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{company._count.departments}</div>
                    <p className="text-sm text-gray-500">{t('details.company.departments')}</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{company._count.users}</div>
                    <p className="text-sm text-gray-500">{t('details.company.users')}</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{company._count.warehouses}</div>
                    <p className="text-sm text-gray-500">{t('details.company.warehouses')}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('details.metadata')}</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t('common.createdAt')}</p>
                  <p className="font-medium text-gray-900">{formatDateTime(company.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('common.updatedAt')}</p>
                  <p className="font-medium text-gray-900">{formatDateTime(company.updatedAt)}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'branches' && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('navigation.branches')}</h2>
          </div>
          {branchesLoading ? (
            <LoadingState message={t('common.loading')} />
          ) : branches.length === 0 ? (
            <EmptyState message={t('common.noData')} />
          ) : (
            <DataTable columns={branchColumns} data={branches} keyExtractor={(b: Branch) => b.id} />
          )}
        </Card>
      )}

      {activeTab === 'departments' && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('navigation.departments')}</h2>
          </div>
          {departmentsLoading ? (
            <LoadingState message={t('common.loading')} />
          ) : departments.length === 0 ? (
            <EmptyState message={t('common.noData')} />
          ) : (
            <DataTable columns={departmentColumns} data={departments} keyExtractor={(d: Department) => d.id} />
          )}
        </Card>
      )}

      {activeTab === 'users' && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('navigation.users')}</h2>
          </div>
          {usersLoading ? (
            <LoadingState message={t('common.loading')} />
          ) : users.length === 0 ? (
            <EmptyState message={t('common.noData')} />
          ) : (
            <DataTable columns={userColumns} data={users} keyExtractor={(u: User) => u.id} />
          )}
        </Card>
      )}

      {activeTab === 'warehouses' && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('navigation.warehouses')}</h2>
          </div>
          {warehousesLoading ? (
            <LoadingState message={t('common.loading')} />
          ) : warehouses.length === 0 ? (
            <EmptyState message={t('common.noData')} />
          ) : (
            <DataTable columns={warehouseColumns} data={warehouses} keyExtractor={(w: Warehouse) => w.id} />
          )}
        </Card>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('core.editCompany')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.code')}</label>
            <input
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')}</label>
            <input
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('core.legalName')}</label>
            <input
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('core.taxNumber')}</label>
            <input
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone')}</label>
            <input
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email')}</label>
            <input
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.address')}</label>
            <input
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>{t('actions.cancel')}</Button>
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
