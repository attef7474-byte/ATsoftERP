'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Input, Textarea, Pagination, PageHeader, Modal, ConfirmDialog, StatusBadge } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

interface BomItem {
  id: string; code: string; name: string; description?: string;
  machineId?: string; componentId?: string; status: string;
  machine?: { id: string; name: string }; component?: { id: string; name: string };
  createdAt: string; updatedAt: string;
}

export default function BomPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<BomItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    refresh: () => fetchData(meta.page),
    delete: () => selectedId && setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      const res = await api.get<{ data: BomItem[]; meta: any }>('/maintenance/bom', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/bom/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { showToast(err?.message || t('errors.deleteFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<BomItem>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'machine', header: t('maintenance.machine'), render: (b: BomItem) => b.machine?.name || '-' },
    { key: 'component', header: t('maintenance.machineComponent'), render: (b: BomItem) => b.component?.name || '-' },
    { key: 'status', header: t('common.status'), render: (b: BomItem) => <StatusBadge status={b.status} /> },
  ];

  const gridActions: GridAction<BomItem>[] = [
    { label: t('common.delete'), onClick: (b: BomItem) => { setSelectedId(b.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.bom')} />
      <AdminDataGrid
        columns={columns} data={data}
        keyExtractor={(b: BomItem) => b.id}
        onRowClick={(b: BomItem) => setSelectedId(b.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions} dir={dir}
        globalSearch={search} onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(meta.page)} refreshLoading={loading}
      />
      {data.length > 0 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      )}
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}