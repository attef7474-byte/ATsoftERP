'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Select, Card, Pagination, PageHeader, LoadingState, Modal } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionEditIcon, ActionRefreshIcon, ActionBackIcon } from '../../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

function computePreview(item: any): string {
  const next = (item.currentNumber || 0) + (item.increment || 1);
  const padded = String(next).padStart(item.padding || 6, '0');
  return `${item.prefix || ''}${padded}${item.suffix || ''}`;
}

export default function NumberingPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showRejected, setShowRejected] = useState(false);
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

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
      if (sortColumn) {
        params.sortBy = sortColumn;
        params.sortOrder = sortDirection;
      }
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const res = await api.get<{ data: any[]; meta: any }>('/numbering', { params });
      setData(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t, showRejected, sortColumn, sortDirection, filters]);

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

  const baseColumns: GridColumn<any>[] = [
    { key: 'code', header: t('settings.numbering.code'), sortable: true, filterable: true },
    { key: 'operationName', header: t('settings.numbering.operationName'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'COMPANY', label: t('settings.numbering.operationNameMap.COMPANY') },
      { value: 'BRANCH', label: t('settings.numbering.operationNameMap.BRANCH') },
      { value: 'DEPARTMENT', label: t('settings.numbering.operationNameMap.DEPARTMENT') },
      { value: 'WAREHOUSE', label: t('settings.numbering.operationNameMap.WAREHOUSE') },
      { value: 'WAREHOUSE_LOCATION', label: t('settings.numbering.operationNameMap.WAREHOUSE_LOCATION') },
      { value: 'PRODUCT', label: t('settings.numbering.operationNameMap.PRODUCT') },
      { value: 'INVENTORY_MOVEMENT', label: t('settings.numbering.operationNameMap.INVENTORY_MOVEMENT') },
      { value: 'INVENTORY_COUNT', label: t('settings.numbering.operationNameMap.INVENTORY_COUNT') },
      { value: 'INVENTORY_ADJUSTMENT', label: t('settings.numbering.operationNameMap.INVENTORY_ADJUSTMENT') },
      { value: 'MACHINE', label: t('settings.numbering.operationNameMap.MACHINE') },
      { value: 'MACHINE_ASSET', label: t('settings.numbering.operationNameMap.MACHINE_ASSET') },
      { value: 'MACHINE_PART', label: t('settings.numbering.operationNameMap.MACHINE_PART') },
      { value: 'MACHINE_DOCUMENT', label: t('settings.numbering.operationNameMap.MACHINE_DOCUMENT') },
      { value: 'MAINTENANCE_REQUEST', label: t('settings.numbering.operationNameMap.MAINTENANCE_REQUEST') },
      { value: 'MAINTENANCE_TASK', label: t('settings.numbering.operationNameMap.MAINTENANCE_TASK') },
      { value: 'PREVENTIVE_MAINTENANCE', label: t('settings.numbering.operationNameMap.PREVENTIVE_MAINTENANCE') },
      { value: 'DOWNTIME', label: t('settings.numbering.operationNameMap.DOWNTIME') },
      { value: 'ATTACHMENT', label: t('settings.numbering.operationNameMap.ATTACHMENT') },
    ], render: (item: any) => t(`settings.numbering.operationNameMap.${item.code}`) || item.operationName },
    { key: 'modelName', header: t('settings.numbering.modelName'), sortable: true, render: (item: any) => t(`settings.numbering.modelNameMap.${item.code}`) || item.modelName },
    { key: 'prefix', header: t('settings.numbering.prefix'), sortable: true, filterable: true, width: '90px' },
    { key: 'suffix', header: t('settings.numbering.suffix'), sortable: true, filterable: true, width: '90px' },
    { key: 'currentNumber', header: t('settings.numbering.currentNumber'), sortable: true, align: 'center', width: '110px' },
    { key: 'nextNumber', header: t('settings.numbering.nextNumber'), sortable: true, align: 'center', width: '100px', render: (item: any) => (item.currentNumber || 0) + (item.increment || 1) },
    { key: 'increment', header: t('settings.numbering.increment'), sortable: true, align: 'center', width: '80px' },
    { key: 'padding', header: t('settings.numbering.padding'), sortable: true, align: 'center', width: '80px' },
    { key: 'resetPolicy', header: t('settings.numbering.resetPolicy'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'NEVER', label: t('settings.numbering.resetPolicies.NEVER') },
      { value: 'DAILY', label: t('settings.numbering.resetPolicies.DAILY') },
      { value: 'MONTHLY', label: t('settings.numbering.resetPolicies.MONTHLY') },
      { value: 'YEARLY', label: t('settings.numbering.resetPolicies.YEARLY') },
    ], render: (item: any) => t(`settings.numbering.resetPolicies.${item.resetPolicy}`) || item.resetPolicy },
    { key: 'scope', header: t('settings.numbering.scope'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'GLOBAL', label: t('settings.numbering.scopeOptions.GLOBAL') },
      { value: 'COMPANY', label: t('settings.numbering.scopeOptions.COMPANY') },
      { value: 'BRANCH', label: t('settings.numbering.scopeOptions.BRANCH') },
      { value: 'USER', label: t('settings.numbering.scopeOptions.USER') },
    ], render: (item: any) => t(`settings.numbering.scopeOptions.${item.scope}`) || item.scope },
    { key: 'status', header: t('settings.numbering.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('settings.numbering.statusOptions.ACTIVE') },
      { value: 'INACTIVE', label: t('settings.numbering.statusOptions.INACTIVE') },
    ], render: (item: any) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        item.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
      }`}>
        {t(`settings.numbering.statusOptions.${item.status}`) || item.status}
      </span>
    )},
    { key: 'nextPreview', header: t('settings.numbering.nextPreview'), sortable: false, width: '130px', render: (item: any) => (
      <span className="font-mono text-xs" key={item.id}>
        {previewCache[item.id] || <span className="text-gray-400">...</span>}
      </span>
    )},
    { key: 'lastGeneratedCode', header: t('settings.numbering.lastGeneratedCode'), sortable: false, width: '110px', render: (item: any) => (
      item.lastGeneratedCode ? <span className="font-mono text-xs">{item.lastGeneratedCode}</span> : <span className="text-gray-400">—</span>
    )},
  ];



  const gridActions: GridAction<any>[] = [
    {
      label: t('common.edit'),
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
      onClick: (item: any) => openEdit(item),
    },
    {
      label: t('common.view'),
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
      onClick: (item: any) => openEdit(item),
    },
  ];

  useEffect(() => {
    data.forEach(item => fetchPreview(item));
  }, [data, fetchPreview]);

  const handleSort = useCallback((col: string, dir: 'asc' | 'desc') => {
    setSortColumn(col);
    setSortDirection(dir);
  }, []);

  const handleFilter = useCallback((col: string, value: string) => {
    setFilters(prev => ({ ...prev, [col]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearch('');
  }, []);

  const handleGlobalSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  return (
    <div>
      <PageHeader title={t('settings.numbering.title')} />
      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showRejected} onChange={e => { setShowRejected(e.target.checked); fetchData(1); }} className="rounded border-gray-300" />
          {t('settings.numbering.showRejected')}
        </label>
      </div>
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
        </div>
      )}
      {!error && loading && data.length === 0 && (
        <LoadingState message={t('settings.numbering.loadingSequences')} />
      )}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('settings.numbering.noSequences')}</p>
        </div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <AdminDataGrid
          columns={baseColumns}
          data={data}
          keyExtractor={(item: any) => item.id}
          onRowClick={(item: any) => setSelectedId(item.id)}
          selectedKey={selectedId}
          loading={loading}
          emptyMessage={t('settings.numbering.noSequences')}
          loadingMessage={t('settings.numbering.loadingSequences')}
          error={error || undefined}
          actions={gridActions}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          filters={filters}
          onFilter={handleFilter}
          onClearFilters={handleClearFilters}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          dir={dir}
          globalSearch={search}
          onGlobalSearch={handleGlobalSearch}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('settings.numbering.editSequence')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('settings.numbering.code')} value={editItem?.code || ''} disabled />
            <Input label={t('settings.numbering.name')} value={t(`settings.numbering.operationNameMap.${editItem?.code}`) || editItem?.name || ''} disabled />
            <Input label={t('settings.numbering.operationName')} value={t(`settings.numbering.operationNameMap.${editItem?.code}`) || editItem?.operationName || ''} disabled />
            <Input label={t('settings.numbering.modelName')} value={t(`settings.numbering.modelNameMap.${editItem?.code}`) || editItem?.modelName || ''} disabled />
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
