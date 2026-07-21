'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, DataTable, Pagination, PageHeader, Toolbar, LoadingState, EmptyState, ErrorState, Modal, StatusBadge } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionEditIcon, ActionRefreshIcon, ActionBackIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

function computePreview(item: any): string {
  const next = (item.currentNumber || 0) + (item.increment || 1);
  const padded = String(next).padStart(item.padding || 6, '0');
  return `${item.prefix || ''}${padded}${item.suffix || ''}`;
}

export default function NumberingPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showRejected, setShowRejected] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({
    prefix: '',
    suffix: '',
    padding: 6,
    increment: 1,
    currentNumber: 0,
    resetPolicy: 'NEVER',
    status: 'ACTIVE',
  });
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [previewCache, setPreviewCache] = useState<Record<string, string>>({});

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      if (!showRejected) params.status = 'ACTIVE';
      const res = await api.get<{ data: any[]; meta: any }>('/numbering', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t, showRejected]);

  useEffect(() => { fetchData(); }, []);

  const fetchPreview = useCallback(async (item: any) => {
    const cacheKey = item.id;
    if (previewCache[cacheKey]) return previewCache[cacheKey];
    try {
      const res = await api.get<{ number: string }>(`/numbering/${item.id}/preview`);
      setPreviewCache(prev => ({ ...prev, [cacheKey]: res.number }));
      return res.number;
    } catch {
      return computePreview(item);
    }
  }, [previewCache]);

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      prefix: item.prefix || '',
      suffix: item.suffix || '',
      padding: item.padding || 6,
      increment: item.increment || 1,
      currentNumber: item.currentNumber || 0,
      resetPolicy: item.resetPolicy || 'NEVER',
      status: item.status || 'ACTIVE',
    });
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
      if (form.increment !== editItem.increment) payload.increment = form.increment;
      if (form.currentNumber !== editItem.currentNumber) payload.currentNumber = form.currentNumber;
      if (form.resetPolicy !== editItem.resetPolicy) payload.resetPolicy = form.resetPolicy;
      if (form.status !== editItem.status) payload.status = form.status;
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

  const { exec } = useStableHandlers({
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    back: () => router.back(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'code', header: t('settings.numbering.code') },
    { key: 'operationName', header: t('settings.numbering.operationName') },
    { key: 'modelName', header: t('settings.numbering.modelName') },
    { key: 'prefix', header: t('settings.numbering.prefix') },
    { key: 'suffix', header: t('settings.numbering.suffix') },
    { key: 'currentNumber', header: t('settings.numbering.currentNumber'), align: 'center' },
    { key: 'nextNumber', header: t('settings.numbering.nextNumber'), align: 'center', render: (item: any) => (item.currentNumber || 0) + (item.increment || 1) },
    { key: 'increment', header: t('settings.numbering.increment'), align: 'center' },
    { key: 'padding', header: t('settings.numbering.padding'), align: 'center' },
    { key: 'resetPolicy', header: t('settings.numbering.resetPolicy'), render: (item: any) => t(`settings.numbering.resetPolicies.${item.resetPolicy}`) || item.resetPolicy },
    { key: 'scope', header: t('settings.numbering.scope') },
    { key: 'status', header: t('settings.numbering.status'), render: (item: any) => <StatusBadge status={item.status} /> },
    {
      key: 'nextPreview', header: t('settings.numbering.nextPreview'), render: (item: any) => (
        <span className="font-mono text-xs" key={item.id}>
          {previewCache[item.id] || <span className="text-gray-400">...</span>}
        </span>
      ),
    },
    {
      key: 'lastGeneratedCode', header: t('settings.numbering.lastGeneratedCode'),
      render: (item: any) => item.lastGeneratedCode ? <span className="font-mono text-xs">{item.lastGeneratedCode}</span> : <span className="text-gray-400">—</span>
    },
    {
      key: 'actions', header: t('settings.numbering.actions'),
      render: (item: any) => (
        <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
          {t('common.edit')}
        </Button>
      ),
    },
  ];

  // Preload previews for visible rows
  useEffect(() => {
    data.forEach(item => fetchPreview(item));
  }, [data, fetchPreview]);

  return (
    <div>
      <PageHeader title={t('settings.numbering.title')} />
      <Toolbar
        searchValue={search}
        onSearchChange={setSearch}
        onClear={() => { setSearch(''); fetchData(1); }}
        onRefresh={() => fetchData(meta.page)}
        loading={loading}
        searchPlaceholder={t('common.search')}
        extraActions={
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showRejected} onChange={e => { setShowRejected(e.target.checked); fetchData(1); }} />
            {t('settings.numbering.showRejected')}
          </label>
        }
      />
      {error && <ErrorState message={error} onRetry={() => fetchData(meta.page)} />}
      {!error && loading && <LoadingState message={t('settings.numbering.loadingSequences')} />}
      {!error && !loading && data.length === 0 && <EmptyState message={t('settings.numbering.noSequences')} />}
      {!error && !loading && data.length > 0 && (
        <Card>
          <DataTable
            columns={columns}
            data={data}
            keyExtractor={(item: any) => item.id}
            onRowClick={(item: any) => setSelectedId(item.id)}
            selectedKey={selectedId}
          />
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </Card>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('settings.numbering.editSequence')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('settings.numbering.code')} value={editItem?.code || ''} disabled />
            <Input label={t('settings.numbering.name')} value={editItem?.name || ''} disabled />
            <Input label={t('settings.numbering.operationName')} value={editItem?.operationName || ''} disabled />
            <Input label={t('settings.numbering.modelName')} value={editItem?.modelName || ''} disabled />
            <Input label={t('settings.numbering.domain')} value={t(`settings.numbering.domains.${editItem?.domain}`) || editItem?.domain || ''} disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('settings.numbering.prefix')} value={form.prefix} onChange={e => setForm({ ...form, prefix: e.target.value })} />
            <Input label={t('settings.numbering.suffix')} value={form.suffix} onChange={e => setForm({ ...form, suffix: e.target.value })} />
            <Input label={t('settings.numbering.padding')} type="number" min={1} max={20} value={form.padding} onChange={e => setForm({ ...form, padding: parseInt(e.target.value) || 6 })} />
            <Input label={t('settings.numbering.increment')} type="number" min={1} max={100} value={form.increment} onChange={e => setForm({ ...form, increment: parseInt(e.target.value) || 1 })} />
            <Input label={t('settings.numbering.currentNumber')} type="number" min={0} value={form.currentNumber} onChange={e => setForm({ ...form, currentNumber: parseInt(e.target.value) || 0 })} />
            <Select
              label={t('settings.numbering.resetPolicy')}
              value={form.resetPolicy}
              onChange={e => setForm({ ...form, resetPolicy: e.target.value })}
              options={[
                { value: 'NEVER', label: t('settings.numbering.resetPolicies.NEVER') },
                { value: 'DAILY', label: t('settings.numbering.resetPolicies.DAILY') },
                { value: 'MONTHLY', label: t('settings.numbering.resetPolicies.MONTHLY') },
                { value: 'YEARLY', label: t('settings.numbering.resetPolicies.YEARLY') },
              ]}
            />
            <Select
              label={t('settings.numbering.status')}
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
              options={[
                { value: 'ACTIVE', label: t('settings.numbering.statuses.ACTIVE') },
                { value: 'INACTIVE', label: t('settings.numbering.statuses.INACTIVE') },
                { value: 'USER_REJECTED_FOR_CURRENT_RELEASE', label: t('settings.numbering.statuses.USER_REJECTED_FOR_CURRENT_RELEASE') },
              ]}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
