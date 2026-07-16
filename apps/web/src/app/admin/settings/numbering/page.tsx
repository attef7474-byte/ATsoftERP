'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionEditIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

export default function NumberingPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [nextPreviews, setNextPreviews] = useState<Record<string, string>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ prefix: '', suffix: '', padding: 6 });
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      const res = await api.get<{ data: any[]; meta: any }>('/numbering', { params });
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
    setForm({ prefix: item.prefix || '', suffix: item.suffix || '', padding: item.padding || 6 });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const payload: any = {};
      if (form.prefix !== editItem.prefix) payload.prefix = form.prefix;
      if (form.suffix !== editItem.suffix) payload.suffix = form.suffix;
      if (form.padding !== editItem.padding) payload.padding = form.padding;
      if (Object.keys(payload).length === 0) { setModalOpen(false); return; }
      await api.patch(`/numbering/${editItem.id}`, payload);
      showToast(t('common.successUpdated'), 'success');
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewNext = async (item: any) => {
    try {
      const result = await api.post<{ number: string }>('/numbering/generate', { code: item.code });
      setNextPreviews((prev) => ({ ...prev, [item.id]: result.number }));
    } catch {
      setNextPreviews((prev) => ({ ...prev, [item.id]: t('common.unavailable') }));
    }
  };

  const { exec } = useStableHandlers({
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
  });

  useRegisterAdminActions([
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'code', header: t('settings.numbering.code') },
    { key: 'name', header: t('settings.numbering.name') },
    { key: 'prefix', header: t('settings.numbering.prefix') },
    { key: 'currentNumber', header: t('settings.numbering.currentNumber') },
    { key: 'padding', header: t('settings.numbering.padding') },
    { key: 'scope', header: t('settings.numbering.scope') },
    { key: 'status', header: t('common.status'), render: (item: any) => <StatusBadge status={item.status} /> },
    {
      key: 'nextPreview', header: t('settings.numbering.nextPreview'), render: (item: any) => (
        <span className="font-mono text-xs">
          {nextPreviews[item.id] || (
            <button onClick={() => handlePreviewNext(item)} className="text-blue-600 hover:underline text-xs">{t('settings.numbering.generateNext')}</button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('settings.numbering.title')} />
      <Toolbar searchValue={search} onSearchChange={setSearch} onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)} loading={loading} searchPlaceholder={t('common.search')} />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState message={t('settings.numbering.loadingSequences')} />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('settings.numbering.noSequences')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable columns={columns} data={data} keyExtractor={(item: any) => item.id} selectedKey={selectedId}
            onRowClick={(item: any) => setSelectedId(item.id)} />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('settings.numbering.editSequence')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('settings.numbering.code')} value={editItem?.code || ''} disabled />
            <Input label={t('settings.numbering.name')} value={editItem?.name || ''} disabled />
          </div>
          <Input label={t('settings.numbering.prefix')} value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
          <Input label={t('settings.numbering.suffix')} value={form.suffix} onChange={(e) => setForm({ ...form, suffix: e.target.value })} />
          <Input label={t('settings.numbering.padding')} type="number" min={1} max={20} value={form.padding} onChange={(e) => setForm({ ...form, padding: parseInt(e.target.value) || 6 })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
