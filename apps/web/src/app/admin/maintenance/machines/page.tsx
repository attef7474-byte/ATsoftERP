'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Machine } from '../../../../lib/admin-types';
import { useRouter } from 'next/navigation';
import { Pagination, PageHeader, StatusBadge, ConfirmDialog } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';

export default function MachinesPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<Machine[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [statusSaving, setStatusSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate'>('deactivate');
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

const { exec } = useStableHandlers({
  new: () => router.push('/admin/maintenance/machines/new'),
  edit: () => selectedRecord && router.push(`/admin/maintenance/machines/${selectedRecord.id}/edit`),
  delete: () => setConfirmDeleteOpen(true),
  refresh: () => fetchData(meta.page),
  activate: () => confirmStatus(selectedId, 'activate'),
  deactivate: () => confirmStatus(selectedId, 'deactivate'),
});

useRegisterAdminActions([
  { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
  { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
  { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
  { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
  { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: Machine[]; meta: any }>('/maintenance/machines', { params });
      const listResult = unwrapApiList<Machine, typeof meta>(res);
      setData(listResult.data);
      if (listResult.meta) setMeta(listResult.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const confirmStatus = (id: string, action: 'activate' | 'deactivate') => {
    setSelectedId(id);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleStatusChange = async () => {
    setStatusSaving(true);
    try {
      if (confirmAction === 'activate') {
        await api.patch(`/maintenance/machines/${selectedId}/activate`);
      } else {
        await api.patch(`/maintenance/machines/${selectedId}/deactivate`);
      }
      showToast(confirmAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally { setStatusSaving(false); }
  };

  const handleDelete = async () => {
    setStatusSaving(true);
    try {
      await api.delete(`/maintenance/machines/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally { setStatusSaving(false); }
  };

  const columns: GridColumn<Machine>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'category', header: t('maintenance.machineCategory'), render: (m: Machine) => m.category?.name || '-' },
    { key: 'productionLine', header: t('maintenance.productionLine'), render: (m: Machine) => m.productionLine?.name || '-' },
    { key: 'operationType', header: t('maintenance.operationType'), render: (m: Machine) => m.operationType?.name || '-' },
    { key: 'technicalDepartment', header: t('maintenance.technicalDepartment'), render: (m: Machine) => m.technicalDepartment?.name || '-' },
    { key: 'costCenter', header: t('maintenance.defaultCostCenter'), render: (m: Machine) => m.defaultCostCenter?.name || '-' },
    { key: 'status', header: t('common.status'), render: (m: Machine) => <StatusBadge status={m.status} /> },
  ];

  const gridActions: GridAction<Machine>[] = [
    { label: t('details.viewDetails'), onClick: (m: Machine) => router.push(`/admin/maintenance/machines/${m.id}`) },
    { label: t('actions.edit'), onClick: (m: Machine) => router.push(`/admin/maintenance/machines/${m.id}/edit`) },
    { label: t('actions.deactivate'), onClick: (m: Machine) => confirmStatus(m.id, 'deactivate'), enabled: (m: Machine) => m.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (m: Machine) => confirmStatus(m.id, 'activate'), enabled: (m: Machine) => m.status !== 'ACTIVE' },
    { label: t('common.delete'), onClick: (m: Machine) => { setSelectedId(m.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.machines')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(m: Machine) => m.id}
        onRowClick={(m: Machine) => setSelectedId(m.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
        dir={dir}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(meta.page)}
        refreshLoading={loading}
      />
      {data.length > 0 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      )}
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={statusSaving} />
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleStatusChange}
        title={confirmAction === 'deactivate' ? t('common.confirmDeactivateTitle') : t('common.confirmActivateTitle')}
        message={confirmAction === 'deactivate' ? t('common.confirmDeactivateMessage') : t('common.confirmActivateMessage')}
        variant={confirmAction === 'deactivate' ? 'danger' : 'primary'} loading={statusSaving} />
    </div>
  );
}
