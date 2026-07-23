'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Administration, Department } from '../../../../../lib/admin-types';
import { Button, Card, DataTable, LoadingState, EmptyState, ErrorState, StatusBadge, Modal, ConfirmDialog, Input, CardContent } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';
import { useParams, useRouter } from 'next/navigation';

type TabId = 'overview' | 'departments';

export default function AdministrationDetailPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [administration, setAdministration] = useState<Administration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate'>('deactivate');

  const fetchAdministration = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Administration>(`/administrations/${id}`);
      setAdministration(res);
    } catch (err: any) {
      if (err?.status === 404) {
        setAdministration(null);
      } else {
        setError(err?.message || t('errors.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { fetchAdministration(); }, [fetchAdministration]);

  const fetchDepartments = useCallback(async () => {
    setDepartmentsLoading(true);
    try {
      const res = await api.get<{ data: Department[] }>('/departments', { params: { administrationId: id, limit: 50 } });
      setDepartments(res.data || []);
    } catch { /* ignore */ }
    finally { setDepartmentsLoading(false); }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'departments') fetchDepartments();
  }, [activeTab, fetchDepartments]);

  const openEdit = useCallback(() => {
    if (!administration) return;
    setForm({
      code: administration.code,
      name: administration.name,
      description: administration.description || '',
    });
    setModalOpen(true);
  }, [administration]);

  const handleSave = async () => {
    if (!form.code || !form.name) { showToast(t('validation.required'), 'error'); return; }
    setSaving(true);
    try {
      await api.patch(`/administrations/${id}`, form);
      showToast(t('common.successUpdated'), 'success');
      setModalOpen(false);
      fetchAdministration();
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
      await api.patch(`/administrations/${id}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchAdministration();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/core/administrations'),
    refresh: () => fetchAdministration(),
    edit: () => openEdit(),
    activate: () => confirmStatusChange('activate'),
    deactivate: () => confirmStatusChange('deactivate'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!administration },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(administration && administration.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(administration && administration.status === 'ACTIVE') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchAdministration} />;
  if (!administration) return <ErrorState message={t('common.notFound')} />;

  const tabs: { id: TabId; labelKey: string }[] = [
    { id: 'overview', labelKey: 'core.administration.title' },
    { id: 'departments', labelKey: 'core.departments' },
  ];

  const departmentColumns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'company', header: t('core.company'), render: (d: Department) => d.company?.name || '-' },
    { key: 'parent', header: t('core.parentDepartment'), render: (d: Department) => d.parent?.name || '-' },
    { key: 'status', header: t('common.status'), render: (d: Department) => <StatusBadge status={d.status} /> },
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
                    <label className="block text-sm font-medium text-gray-500">{t('core.administrationCode')}</label>
                    <p className="mt-1 text-sm text-gray-900">{administration.code}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('core.administrationName')}</label>
                    <p className="mt-1 text-sm text-gray-900">{administration.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('core.branch')}</label>
                    <p className="mt-1 text-sm text-gray-900">{administration.branch?.name || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('core.company')}</label>
                    <p className="mt-1 text-sm text-gray-900">{administration.branch?.company?.name || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.status')}</label>
                    <div className="mt-1"><StatusBadge status={administration.status} /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.description')}</label>
                    <p className="mt-1 text-sm text-gray-900">{administration.description || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.createdAt')}</label>
                    <p className="mt-1 text-sm text-gray-900">{new Date(administration.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">{t('common.updatedAt')}</label>
                    <p className="mt-1 text-sm text-gray-900">{new Date(administration.updatedAt).toLocaleString()}</p>
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
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('core.administration.title')}: {administration.name}</h1>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('core.editAdministration')}>
        <div className="space-y-4">
          <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
