'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { safeBoolean, safeString, unwrapApiData, unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, Pagination, PageHeader, LoadingState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionEditIcon, ActionRefreshIcon, ActionBackIcon, ActionActivateIcon, ActionDeactivateIcon, ActionAddIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

const EVENT_TYPES = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'LOW_STOCK', 'MAINTENANCE_DUE', 'DOWNTIME', 'SYSTEM_ERROR'];
const CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'PUSH'];

export default function NotificationRulesPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({ code: '', nameAr: '', nameEn: '', description: '', eventType: 'LOGIN', channel: 'IN_APP', severity: 'INFO', enabled: true, targetRoleId: '', targetPermission: '' });
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, pageSize: 20 };
      if (search) params.search = search;
      if (eventFilter) params.eventType = eventFilter;
      const res = await api.get<{ data: any[]; total: number }>('/notifications/rules', { params });
      const listResult = unwrapApiList<any>(res);
      const total = listResult.total ?? 0;
      setData(listResult.data);
      setMeta({ page, limit: 20, total, totalPages: Math.ceil(total / 20) });
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, eventFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openEdit = async (item: any) => {
    setEditItem(item);
    setDetailLoading(true);
    setModalOpen(true);
    try {
      const res = await api.get<any>(`/notifications/rules/${item.id}`);
      const detail = unwrapApiData<Record<string, unknown>>(res);
      setForm({ code: safeString(detail.code), nameAr: safeString(detail.nameAr), nameEn: safeString(detail.nameEn), description: safeString(detail.description), eventType: safeString(detail.eventType, 'LOGIN'), channel: safeString(detail.channel, 'IN_APP'), severity: safeString(detail.severity, 'INFO'), enabled: safeBoolean(detail.enabled, true), targetRoleId: safeString(detail.targetRoleId), targetPermission: safeString(detail.targetPermission) });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const openNew = () => {
    setEditItem(null);
    setForm({ code: '', nameAr: '', nameEn: '', description: '', eventType: 'LOGIN', channel: 'IN_APP', severity: 'INFO', enabled: true, targetRoleId: '', targetPermission: '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editItem) {
        await api.patch(`/notifications/rules/${editItem.id}`, form);
        showToast(t('settings.notificationRules.updateSuccess'), 'success');
      } else {
        await api.post('/notifications/rules', form);
        showToast(t('settings.notificationRules.createSuccess'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/notifications/rules/${confirmDelete.id}`);
      showToast(t('settings.notificationRules.deleteSuccess'), 'success');
      setConfirmDelete(null);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.deleteFailed'), 'error'); }
  };

  const handleActivate = async (id = selectedId) => {
    if (!id) return;
    try {
      await api.patch(`/notifications/rules/${id}/activate`);
      showToast(t('settings.notificationRules.activated'), 'success');
      fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  const handleDeactivate = async (id = selectedId) => {
    if (!id) return;
    try {
      await api.patch(`/notifications/rules/${id}/deactivate`);
      showToast(t('settings.notificationRules.deactivated'), 'success');
      fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  const { exec } = useStableHandlers({
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    back: () => router.back(),
    add: () => openNew(),
    activate: () => handleActivate(),
    deactivate: () => handleDeactivate(),
    delete: () => selectedRecord && setConfirmDelete(selectedRecord),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'add', labelKey: 'common.newItem', icon: <ActionAddIcon />, onClick: () => exec('add') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.enabled === false) },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.enabled === true) },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns: GridColumn<any>[] = [
    { key: 'code', header: t('settings.notificationRules.code'), sortable: true, filterable: true },
    { key: 'nameEn', header: t('settings.notificationRules.nameEn'), sortable: true, filterable: true },
    { key: 'eventType', header: t('settings.notificationRules.eventType'), sortable: true, filterable: true, filterType: 'select', filterOptions: EVENT_TYPES.map((et) => ({ value: et, label: t(`settings.notificationRules.eventTypes.${et}` as any) || et })), render: (item: any) => t(`settings.notificationRules.eventTypes.${item.eventType}` as any) || item.eventType },
    { key: 'channel', header: t('settings.notificationRules.channel'), sortable: true, filterable: true, filterType: 'select', filterOptions: CHANNELS.map((c) => ({ value: c, label: c })) },
    { key: 'severity', header: t('settings.notificationRules.severity'), sortable: true, filterable: true, filterType: 'select', filterOptions: [{ value: 'INFO', label: 'INFO' }, { value: 'WARNING', label: 'WARNING' }, { value: 'ERROR', label: 'ERROR' }], render: (item: any) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        item.severity === 'ERROR' ? 'bg-red-100 text-red-700' : item.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
      }`}>{item.severity}</span>
    )},
    { key: 'enabled', header: t('settings.notificationRules.enabled'), sortable: true, filterable: true, filterType: 'select', filterOptions: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }], render: (item: any) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
        {item.enabled ? 'Active' : 'Inactive'}
      </span>
    )},
  ];

  const gridActions: GridAction<any>[] = [
    { label: t('common.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (item: any) => openEdit(item) },
    { label: t('common.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, onClick: (item: any) => { setSelectedId(item.id); void handleActivate(item.id); }, enabled: (item: any) => item.enabled === false },
    { label: t('common.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, onClick: (item: any) => { setSelectedId(item.id); void handleDeactivate(item.id); }, enabled: (item: any) => item.enabled === true },
    { label: t('common.delete'), variant: 'danger', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, onClick: (item: any) => setConfirmDelete(item) },
  ];

  return (
    <div>
      <PageHeader title={t('settings.notificationRules.title')} />
      <div className="flex gap-2 mb-4">
        <Select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}
          options={[{ value: '', label: t('common.all') }, ...EVENT_TYPES.map((et) => ({ value: et, label: t(`settings.notificationRules.eventTypes.${et}` as any) || et }))]} className="w-40" />
      </div>
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
        </div>
      )}
      {!error && loading && data.length === 0 && (
        <LoadingState message={t('settings.notificationRules.loadingRules')} />
      )}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('settings.notificationRules.noRules')}</p>
        </div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <AdminDataGrid
          columns={columns}
          data={data}
          keyExtractor={(item: any) => item.id}
          selectedKey={selectedId}
          onRowClick={(item: any) => setSelectedId(item.id)}
          loading={loading}
          emptyMessage={t('settings.notificationRules.noRules')}
          loadingMessage={t('settings.notificationRules.loadingRules')}
          error={error || undefined}
          actions={gridActions}
          dir={dir}
          globalSearch={search}
          onGlobalSearch={setSearch}
          searchPlaceholder={t('common.search')}
          onRefresh={() => fetchData(meta.page)}
          refreshLoading={loading}
        />
      )}
      {data.length > 0 && (
        <div className="mt-3">
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </div>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('settings.notificationRules.editRule') : t('settings.notificationRules.newRule')} size="lg">
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('settings.notificationRules.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editItem} />
            <Select label={t('settings.notificationRules.eventType')} value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}
              options={EVENT_TYPES.map((et) => ({ value: et, label: t(`settings.notificationRules.eventTypes.${et}` as any) || et }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('settings.notificationRules.nameAr')} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
            <Input label={t('settings.notificationRules.nameEn')} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          </div>
          <Input label={t('settings.notificationRules.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('settings.notificationRules.channel')} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} options={CHANNELS.map((c) => ({ value: c, label: c }))} />
            <Select label={t('settings.notificationRules.severity')} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} options={[{ value: 'INFO', label: 'INFO' }, { value: 'WARNING', label: 'WARNING' }, { value: 'ERROR', label: 'ERROR' }]} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />{t('settings.notificationRules.enabled')}</label>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} title={t('common.confirmDeleteTitle')} message={t('settings.notificationRules.confirmDelete')} variant="danger" />
    </div>
  );
}
