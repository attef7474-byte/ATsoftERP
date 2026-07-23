'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../../lib/api';
import { unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { InventoryCount } from '../../../../lib/admin-types';
import { checkCrudPermissions, CrudPermissions } from '../../../../lib/crud-permissions';
import { getUserPermissions } from '../../../../lib/auth';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, companyAdapter, branchAdapter, warehouseAdapter } from '../../../../components/f9';
import { InventoryStatusBadge } from '../../../../components/inventory-counting/InventoryStatusBadge';
import CountLinesPanel from '../../../../components/inventory-counting/CountLinesPanel';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionStartIcon, ActionCompleteIcon, ActionCancelIcon, ActionViewIcon, ActionGenerateIcon } from '../../../../components/admin/admin-action-bar';

export default function InventoryCountsPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();

  const [perms, setPerms] = useState<CrudPermissions>({ canCreate: false, canRead: false, canUpdate: false, canDelete: false, canActivate: false, isSuperAdmin: false });
  const [userPerms, setUserPerms] = useState<string[]>([]);

  const [data, setData] = useState<InventoryCount[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryCount | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', warehouseId: '', countDate: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    start: () => confirmAction(selectedId, 'start'),
    complete: () => confirmAction(selectedId, 'complete'),
    cancel: () => confirmAction(selectedId, 'cancel'),
    viewLines: () => selectedRecord && openLinesPanel(selectedRecord.id),
    generateAdjustment: () => confirmGenerateAdjustment(selectedId),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'start', labelKey: 'inventoryCounting.start', icon: <ActionStartIcon />, onClick: () => exec('start'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
    { id: 'complete', labelKey: 'inventoryCounting.complete', icon: <ActionCompleteIcon />, onClick: () => exec('complete'), enabled: !!(selectedId && selectedRecord?.status === 'IN_PROGRESS') },
    { id: 'cancel', labelKey: 'inventoryCounting.cancel', icon: <ActionCancelIcon />, onClick: () => exec('cancel'), enabled: !!(selectedId && (selectedRecord?.status === 'DRAFT' || selectedRecord?.status === 'IN_PROGRESS')), variant: 'danger' },
    { id: 'viewLines', labelKey: 'inventoryCounting.viewLines', icon: <ActionViewIcon />, onClick: () => exec('viewLines'), enabled: !!selectedId },
    { id: 'generateAdjustment', labelKey: 'inventoryCounting.generateAdjustment', icon: <ActionGenerateIcon />, onClick: () => exec('generateAdjustment'), enabled: !!(selectedId && selectedRecord?.status === 'COMPLETED') },
  ]);

  const [pendingAction, setPendingAction] = useState('');

  const [linesPanelOpen, setLinesPanelOpen] = useState(false);
  const [selectedCountId, setSelectedCountId] = useState('');

  const [filters, setFilters] = useState({ companyId: '', branchId: '', warehouseId: '', status: '' });

  const [adjustConfirmOpen, setAdjustConfirmOpen] = useState(false);
  const [adjustCountId, setAdjustCountId] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  const initialMount = useRef(true);

  useEffect(() => {
    getUserPermissions().then((res) => {
      setUserPerms(res.permissions);
      setPerms(checkCrudPermissions(res.permissions, res.isSuperAdmin, 'inventory-count'));
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (filters.companyId) params.companyId = filters.companyId;
      if (filters.branchId) params.branchId = filters.branchId;
      if (filters.warehouseId) params.warehouseId = filters.warehouseId;
      if (filters.status) params.status = filters.status;
      const res = await api.get<{ data: InventoryCount[]; meta: any }>('/inventory/counts', { params });
      const listResult = unwrapApiList<InventoryCount, typeof meta>(res);
      setData(listResult.data);
      if (listResult.meta) setMeta(listResult.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, filters, t]);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    fetchData(1);
  }, [filters.companyId, filters.branchId, filters.warehouseId, filters.status]);

  const hasPerm = (key: string) => userPerms.includes(key);

  const openCreate = () => { router.push('/admin/inventory/counts/new'); };
  const openEdit = (item: InventoryCount) => { router.push(`/admin/inventory/counts/${item.id}/edit`); };

  const handleSave = async () => {
    if (!form.companyId || !form.branchId || !form.warehouseId || !form.countDate) {
      showToast(t('validation.required'), 'error'); return;
    }
    setSaving(true);
    try {
      const payload: any = { companyId: form.companyId, branchId: form.branchId, warehouseId: form.warehouseId, countDate: form.countDate };
      if (form.notes) payload.notes = form.notes;
      if (editItem) {
        await api.patch(`/inventory/counts/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/inventory/counts', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const confirmAction = (id: string, action: string) => { setSelectedId(id); setPendingAction(action); setActionConfirmOpen(true); };

  const handleAction = async () => {
    setSaving(true);
    try {
      await api.patch(`/inventory/counts/${selectedId}/${pendingAction}`);
      showToast(t('common.successUpdated'), 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.updateFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const confirmGenerateAdjustment = (id: string) => { setAdjustCountId(id); setAdjustConfirmOpen(true); };

  const handleGenerateAdjustment = async () => {
    setAdjustSaving(true);
    try {
      await api.post(`/inventory/counts/${adjustCountId}/generate-adjustment`);
      showToast(t('common.successCreated'), 'success');
      setAdjustConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
    finally { setAdjustSaving(false); }
  };

  const openLinesPanel = (id: string) => { setSelectedCountId(id); setLinesPanelOpen(true); };

  const statusOptions = [
    { value: '', label: t('common.all') },
    { value: 'DRAFT', label: t('status.DRAFT') },
    { value: 'IN_PROGRESS', label: t('status.IN_PROGRESS') },
    { value: 'COMPLETED', label: t('status.COMPLETED') },
    { value: 'CANCELLED', label: t('status.CANCELLED') },
  ];

  const actionConfirmMessages: Record<string, string> = {
    start: t('inventoryCounting.confirmStartMessage'),
    complete: t('inventoryCounting.confirmCompleteMessage'),
    cancel: t('inventoryCounting.confirmCancelMessage'),
  };

  const columns: GridColumn<InventoryCount>[] = [
    { key: 'countNumber', header: t('inventoryCounting.countNumber') },
    { key: 'company', header: t('inventoryCounting.company'), render: (r: InventoryCount) => r.company?.name || '-' },
    { key: 'branch', header: t('inventoryCounting.branch'), render: (r: InventoryCount) => r.branch?.name || '-' },
    { key: 'warehouse', header: t('inventoryCounting.warehouse'), render: (r: InventoryCount) => r.warehouse?.name || '-' },
    { key: 'status', header: t('common.status'), render: (r: InventoryCount) => <InventoryStatusBadge status={r.status} /> },
    { key: 'countDate', header: t('inventoryCounting.countDate'), render: (r: InventoryCount) => r.countDate ? r.countDate.split('T')[0] : '-' },
    { key: 'linesCount', header: t('inventoryCounting.linesCount'), render: (r: InventoryCount) => r.summary?.linesCount ?? r._count?.lines ?? '-' },
    { key: 'countedLinesCount', header: t('inventoryCounting.countedLinesCount'), render: (r: InventoryCount) => r.summary?.countedLinesCount ?? '-' },
    { key: 'verifiedLinesCount', header: t('inventoryCounting.verifiedLinesCount'), render: (r: InventoryCount) => r.summary?.verifiedLinesCount ?? '-' },
    { key: 'totalDifferenceQty', header: t('inventoryCounting.totalDifferenceQty'), render: (r: InventoryCount) => r.summary?.totalDifferenceQty != null ? r.summary.totalDifferenceQty : '-' },
  ];

  const gridActions: GridAction<InventoryCount>[] = [
    { label: t('details.viewDetails'), onClick: (r: InventoryCount) => router.push(`/admin/inventory/counts/${r.id}`) },
    { label: t('inventoryCounting.start'), onClick: (r: InventoryCount) => confirmAction(r.id, 'start'), enabled: (r: InventoryCount) => r.status === 'DRAFT' },
    { label: t('inventoryCountWorkflow.execute'), onClick: (r: InventoryCount) => router.push(`/admin/inventory/counts/${r.id}/execute`), enabled: (r: InventoryCount) => r.status === 'IN_PROGRESS' },
    { label: t('inventoryCountWorkflow.approve'), onClick: (r: InventoryCount) => router.push(`/admin/inventory/counts/${r.id}/approve`), enabled: (r: InventoryCount) => r.status === 'IN_PROGRESS' },
    { label: t('inventoryCounting.cancel'), onClick: (r: InventoryCount) => confirmAction(r.id, 'cancel'), enabled: (r: InventoryCount) => r.status === 'DRAFT' || r.status === 'IN_PROGRESS', variant: 'danger' },
    { label: t('inventoryCountWorkflow.adjust'), onClick: (r: InventoryCount) => router.push(`/admin/inventory/counts/${r.id}/adjust`), enabled: (r: InventoryCount) => r.status === 'COMPLETED' },
    { label: t('inventoryCountWorkflow.review'), onClick: (r: InventoryCount) => router.push(`/admin/inventory/counts/${r.id}/review`), enabled: (r: InventoryCount) => r.status === 'COMPLETED' },
    { label: t('actions.edit'), onClick: (r: InventoryCount) => openEdit(r), enabled: (r: InventoryCount) => r.status === 'DRAFT' },
    { label: t('inventoryCounting.viewLines'), onClick: (r: InventoryCount) => openLinesPanel(r.id) },
  ];

  const selectedCount = data.find(d => d.id === selectedCountId);

  return (
    <div>
      <PageHeader title={t('inventoryCounting.counts')} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <F9Lookup label={t('inventoryCounting.company')} value={filters.companyId} onChange={(v) => setFilters({ ...filters, companyId: v })} adapter={companyAdapter} />
        <F9Lookup label={t('inventoryCounting.branch')} value={filters.branchId} onChange={(v) => setFilters({ ...filters, branchId: v })} adapter={branchAdapter} />
        <F9Lookup label={t('inventoryCounting.warehouse')} value={filters.warehouseId} onChange={(v) => setFilters({ ...filters, warehouseId: v })} adapter={warehouseAdapter} />
        <Select label={t('common.status')} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={statusOptions} />
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(r: InventoryCount) => r.id}
        onRowClick={(r: InventoryCount) => setSelectedId(r.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventoryCounting.editCount') : t('inventoryCounting.newCount')} size="lg">
        <div className="space-y-4">
          <F9Lookup label={t('inventoryCounting.company')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} adapter={companyAdapter} />
          <F9Lookup label={t('inventoryCounting.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} />
          <F9Lookup label={t('inventoryCounting.warehouse')} value={form.warehouseId} onChange={(v) => setForm({ ...form, warehouseId: v })} adapter={warehouseAdapter} />
          <Input label={t('inventoryCounting.countDate')} type="date" value={form.countDate} onChange={(e) => setForm({ ...form, countDate: e.target.value })} required />
          <Input label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title={t('common.confirm')} message={actionConfirmMessages[pendingAction] || t('common.confirmActionMessage')}
        variant={pendingAction === 'cancel' ? 'danger' : 'primary'} loading={saving} />
      <ConfirmDialog open={adjustConfirmOpen} onClose={() => setAdjustConfirmOpen(false)} onConfirm={handleGenerateAdjustment}
        title={t('common.confirm')} message={t('inventoryCounting.confirmGenerateAdjustmentMessage')}
        variant="primary" loading={adjustSaving} />
      {linesPanelOpen && selectedCount && (
        <CountLinesPanel countId={selectedCountId} status={selectedCount.status}
          warehouseId={selectedCount.warehouseId} open={linesPanelOpen} onClose={() => setLinesPanelOpen(false)} />
      )}
    </div>
  );
}
