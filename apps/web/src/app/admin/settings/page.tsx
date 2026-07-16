'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge, ConfirmDialog, Select } from '../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionEditIcon, ActionRefreshIcon, ActionBackIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

const SECRET_KEYS = ['jwt', 'password', 'secret', 'token', 'key', 'credential', 'api_key', 'api.secret'];

function isSecret(key: string) {
  return SECRET_KEYS.some((sk) => key.toLowerCase().includes(sk.toLowerCase()));
}

function maskValue(key: string, value: string) {
  if (isSecret(key)) return '••••••••';
  return value;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ value: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const [confirmActivate, setConfirmActivate] = useState<any>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<any>(null);

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      if (groupFilter) params.group = groupFilter;
      const res = await api.get<{ data: any[]; meta: any }>('/settings', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, groupFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const groups = useMemo(() => {
    const gs = new Set(data.map((d: any) => d.group).filter(Boolean));
    return Array.from(gs).sort();
  }, [data]);

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ value: item.value || '', description: item.description || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const payload: any = {};
      if (form.value !== editItem.value) payload.value = form.value;
      if (form.description !== editItem.description) payload.description = form.description;
      if (Object.keys(payload).length === 0) { setModalOpen(false); return; }
      await api.patch(`/settings/${editItem.id}`, payload);
      showToast(t('common.successUpdated'), 'success');
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!confirmActivate) return;
    try {
      await api.patch(`/settings/${confirmActivate.id}/activate`);
      showToast(t('common.successActivated'), 'success');
      setConfirmActivate(null);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    }
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return;
    try {
      await api.patch(`/settings/${confirmDeactivate.id}/deactivate`);
      showToast(t('common.successDeactivated'), 'success');
      setConfirmDeactivate(null);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    }
  };

  const { exec } = useStableHandlers({
    edit: () => selectedRecord && !isSecret(selectedRecord.key) && !selectedRecord.isSystem && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    back: () => router.back(),
    activate: () => selectedRecord && selectedRecord.status !== 'ACTIVE' && setConfirmActivate(selectedRecord),
    deactivate: () => selectedRecord && selectedRecord.status === 'ACTIVE' && !selectedRecord.isSystem && setConfirmDeactivate(selectedRecord),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!(selectedId && selectedRecord && !isSecret(selectedRecord.key) && !selectedRecord.isSystem) },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord && selectedRecord.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord && selectedRecord.status === 'ACTIVE' && !selectedRecord.isSystem) },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'key', header: t('settings.key'), render: (item: any) => <span className="font-mono text-xs">{item.key}</span> },
    { key: 'group', header: t('settings.group') },
    { key: 'label', header: t('settings.label') },
    { key: 'value', header: t('settings.value'), render: (item: any) => <span className="font-mono text-xs">{maskValue(item.key, item.value)}</span> },
    { key: 'status', header: t('common.status'), render: (item: any) => <StatusBadge status={item.status} /> },
    { key: 'updatedAt', header: t('common.updatedAt'), render: (item: any) => item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-' },
  ];

  return (
    <div>
      <PageHeader title={t('settings.title')} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
          options={[{ value: '', label: t('common.all') }, ...groups.map(g => ({ value: g, label: g }))]}
          className="w-40" placeholder={t('settings.group')} />
        <Button variant="secondary" onClick={() => { setSearch(''); setGroupFilter(''); fetchData(1); }}>{t('common.clearSearch')}</Button>
      </div>
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState message={t('settings.loadingSettings')} />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('settings.noSettings')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(item: any) => item.id} selectedKey={selectedId}
            onRowClick={(item: any) => setSelectedId(item.id)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('settings.editSetting')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('settings.key')} value={editItem?.key || ''} disabled />
            <Input label={t('settings.group')} value={editItem?.group || ''} disabled />
          </div>
          <Input label={t('settings.value')} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <Textarea label={t('settings.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmActivate} onClose={() => setConfirmActivate(null)} onConfirm={handleActivate}
        title={t('common.confirmActivateTitle')} message={t('common.confirmActivateMessage')} variant="primary" />
      <ConfirmDialog open={!!confirmDeactivate} onClose={() => setConfirmDeactivate(null)} onConfirm={handleDeactivate}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" />
    </div>
  );
}
