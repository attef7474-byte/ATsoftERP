'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../../components/admin/toast-provider';
import { Button, Input, Textarea, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge } from '../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionEditIcon, ActionRefreshIcon } from '../../../components/admin/admin-action-bar';

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
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ value: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      const res = await api.get<{ data: any[]; meta: any }>('/settings', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

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

  const { exec } = useStableHandlers({
    edit: () => selectedRecord && !isSecret(selectedRecord.key) && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!(selectedId && selectedRecord && !isSecret(selectedRecord.key)) },
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
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} loading={loading} searchPlaceholder={t('common.search')} />
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
    </div>
  );
}
