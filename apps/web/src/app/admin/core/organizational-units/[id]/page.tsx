'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { OrganizationalUnit } from '../../../../../lib/admin-types';
import { Button, Card, CardHeader, CardContent, DataTable, LoadingState, EmptyState, ErrorState, StatusBadge, Modal, Input, ConfirmDialog, Select } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup, organizationalUnitAdapter } from '../../../../../components/f9';
import { useParams, useRouter } from 'next/navigation';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../../lib/form-validation';
import { formatDateTime } from '../../../../../lib/i18n/literals';

const UNIT_TYPES = ['DEPARTMENT', 'SECTION', 'UNIT', 'TEAM', 'PROJECT', 'OTHER'];

type Tab = 'overview' | 'children';

export default function OrganizationalUnitDetailPage() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<OrganizationalUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'DEPARTMENT', parentId: '', status: 'ACTIVE' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate'>('deactivate');

  const typeOptions = useMemo(
    () => UNIT_TYPES.map((type) => ({ value: type, label: t(`core.unitTypes.${type}`) })),
    [t],
  );

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await api.get<OrganizationalUnit>(`/organizational-units/${id}`);
      setData(res);
    } catch (err: any) {
      if (err?.status === 404) {
        setNotFound(true);
      } else {
        handleApiError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [id, handleApiError]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/core/organizational-units'),
    refresh: () => fetchData(),
    edit: () => {
      if (!data) return;
      setForm({
        code: data.code,
        name: data.name,
        type: data.type || 'DEPARTMENT',
        parentId: data.parentId || '',
        status: data.status || 'ACTIVE',
      });
      setValidationErrors({});
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
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(
        Object.entries(errors).map(([field, message]) => ({ field, code: 'validation.required', message })),
      );
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name: form.name,
        type: form.type || 'DEPARTMENT',
        status: form.status || 'ACTIVE',
      };
      if (form.code.trim()) payload.code = form.code.trim();
      if (form.parentId) payload.parentId = form.parentId;
      await api.patch(`/organizational-units/${id}`, payload);
      showToast(t('common.successUpdated'), 'success');
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      const config = handleApiError(err);
      if (config?.errors?.length) {
        setValidationErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const status = confirmAction === 'activate' ? 'ACTIVE' : 'INACTIVE';
      await api.patch(`/organizational-units/${id}`, { status });
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('details.overview') },
    { key: 'children', label: t('core.childrenUnits') },
  ];

  const childColumns = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
  ];

  if (notFound) {
    return <ErrorState message={t('errors.notFound')} onRetry={() => router.push('/admin/core/organizational-units')} />;
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
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('core.unitType')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{t(`core.unitTypes.${data.type}`)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{t('core.parentUnit')}</span>
              <p className="text-sm font-medium text-gray-900 mt-1">{data.parent?.name || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700">{t('details.overview')}</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">{t('common.createdAt')}</span>
              <p className="font-medium text-gray-900 mt-1">{formatDateTime(data.createdAt, locale)}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('common.updatedAt')}</span>
              <p className="font-medium text-gray-900 mt-1">{formatDateTime(data.updatedAt, locale)}</p>
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
            <p className="text-sm text-gray-600">{t('details.organizationalUnit.summary')}</p>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('core.editOrganizationalUnit')}>
        <div className="space-y-4">
          <F9Lookup label={t('core.parentUnit')} name="parentId" value={form.parentId} onChange={(v) => { setForm({ ...form, parentId: v }); setValidationErrors(prev => ({ ...prev, parentId: '' })); }} adapter={organizationalUnitAdapter} error={validationErrors.parentId} />
          <Input label={t('common.code')} name="code" value={form.code} onChange={(e) => { setForm({ ...form, code: e.target.value }); setValidationErrors(prev => ({ ...prev, code: '' })); }} error={validationErrors.code} />
          <Input label={t('common.name')} name="name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} error={validationErrors.name} required />
          <Select label={t('core.unitType')} name="type" value={form.type} onChange={(e) => { setForm({ ...form, type: e.target.value }); setValidationErrors(prev => ({ ...prev, type: '' })); }} options={typeOptions} error={validationErrors.type} />
          <Select label={t('common.status')} name="status" value={form.status} onChange={(e) => { setForm({ ...form, status: e.target.value }); setValidationErrors(prev => ({ ...prev, status: '' })); }} options={[
            { value: 'ACTIVE', label: t('common.active') },
            { value: 'INACTIVE', label: t('common.inactive') },
          ]} error={validationErrors.status} />
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
