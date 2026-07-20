'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionEditIcon, ActionRefreshIcon, ActionBackIcon, ActionActivateIcon, ActionDeactivateIcon, ActionAddIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

const EVENT_TYPES = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'LOW_STOCK', 'MAINTENANCE_DUE', 'DOWNTIME', 'SYSTEM_ERROR'];
const CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'PUSH'];

export default function NotificationRulesPage() {
  const { t } = useTranslation();
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
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, pageSize: 20 };
      if (search) params.search = search;
      if (eventFilter) params.eventType = eventFilter;
      const res = await api.get<{ data: any[]; total: number }>('/notifications/rules', { params });
      setData(res.data || []);
      setMeta({ page, limit: 20, total: res.total || 0, totalPages: Math.ceil((res.total || 0) / 20) });
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, eventFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ code: item.code, nameAr: item.nameAr, nameEn: item.nameEn, description: item.description || '', eventType: item.eventType, channel: item.channel, severity: item.severity, enabled: item.enabled, targetRoleId: item.targetRoleId || '', targetPermission: item.targetPermission || '' });
    setModalOpen(true);
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

  const handleActivate = async () => {
    if (!selectedId) return;
    try {
      await api.patch(`/notifications/rules/${selectedId}/activate`);
      showToast(t('settings.notificationRules.activated'), 'success');
      fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
  };

  const handleDeactivate = async () => {
    if (!selectedId) return;
    try {
      await api.patch(`/notifications/rules/${selectedId}/deactivate`);
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

  const columns = [
    { key: 'code', header: t('settings.notificationRules.code') },
    { key: 'nameEn', header: t('settings.notificationRules.nameEn') },
    { key: 'eventType', header: t('settings.notificationRules.eventType'), render: (item: any) => t(`settings.notificationRules.eventTypes.${item.eventType}` as any) || item.eventType },
    { key: 'channel', header: t('settings.notificationRules.channel') },
    { key: 'severity', header: t('settings.notificationRules.severity'), render: (item: any) => <StatusBadge status={item.severity} /> },
    { key: 'enabled', header: t('settings.notificationRules.enabled'), render: (item: any) => <StatusBadge status={item.enabled ? 'ACTIVE' : 'INACTIVE'} /> },
  ];

  return (
    <div>
      <PageHeader title={t('settings.notificationRules.title')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }} onRefresh={() => fetchData(meta.page)} loading={loading} searchPlaceholder={t('common.search')} />
      <div className="flex gap-2 mb-4">
        <Select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}
          options={[{ value: '', label: t('common.all') }, ...EVENT_TYPES.map((et) => ({ value: et, label: t(`settings.notificationRules.eventTypes.${et}` as any) || et }))]} className="w-40" />
      </div>
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState message={t('settings.notificationRules.loadingRules')} />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('settings.notificationRules.noRules')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(item: any) => item.id} selectedKey={selectedId} onRowClick={(item: any) => setSelectedId(item.id)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('settings.notificationRules.editRule') : t('settings.notificationRules.newRule')} size="lg">
        <div className="space-y-4">
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
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} title={t('common.confirmDeleteTitle')} message={t('settings.notificationRules.confirmDelete')} variant="danger" />
    </div>
  );
}
