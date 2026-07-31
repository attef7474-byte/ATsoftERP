'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { safeString, unwrapApiData, unwrapApiList } from '../../../../lib/form-utils';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Warehouse } from '../../../../lib/admin-types';
import { Button, Input, Select, Card, Pagination, LoadingState, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { EntityWorkspaceLayout, EntityPageHeader, EntityDataTable, EntityDetailDrawer, EntityStatusBadge, useDrawerSectionData } from '../../../../components/entity';
import type { DrawerSection } from '../../../../components/entity';
import { usePathname } from 'next/navigation';
import { F9Lookup, companyAdapter, branchAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';

export default function WarehousesPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<Warehouse[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({ companyId: '', branchId: '', name: '', location: '', warehouseType: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [drawerErrorKey, setDrawerErrorKey] = useState('');

  const drawerLocations = useDrawerSectionData<any>(selectedWarehouse?.id || null, async (id: string) => {
    const res = await api.get<any>(`/inventory/warehouses/${id}/locations`);
    return Array.isArray(res) ? res : (res as any)?.data && Array.isArray((res as any).data) ? (res as any).data : [];
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: Warehouse[]; meta: any }>('/inventory/warehouses', { params });
      const listResult = unwrapApiList<Warehouse, typeof meta>(res);
      setData(listResult.data);
      if (listResult.meta) setMeta(listResult.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ companyId: '', branchId: '', name: '', location: '', warehouseType: '' });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (item: Warehouse) => {
    setEditItem(item);
    setDetailLoading(true);
    setModalOpen(true);
    try {
      const res = await api.get<any>(`/inventory/warehouses/${item.id}`);
      const detail = unwrapApiData<Warehouse>(res);
      setForm({
        companyId: safeString(detail.companyId),
        branchId: safeString(detail.branchId),
        name: safeString(detail.name),
        location: safeString(detail.location),
        warehouseType: safeString(detail.warehouseType),
      });
    } catch (err: any) {
      handleApiError(err);
      setModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.companyId) errs.companyId = t('validation.required');
    if (!form.name) errs.name = t('validation.required');
    if (Object.keys(errs).length) { setValidationErrors(errs); return; }
    setValidationErrors({});
    setSaving(true);
    try {
      const payload: any = { companyId: form.companyId, name: form.name };
      if (form.branchId) payload.branchId = form.branchId;
      if (form.location) payload.location = form.location;
      if (form.warehouseType) payload.warehouseType = form.warehouseType;
      if (editItem) {
        await api.patch(`/inventory/warehouses/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/inventory/warehouses', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const confirmStatus = (id: string) => { setSelectedId(id); setConfirmOpen(true); };

  const handleRowClick = useCallback((item: Warehouse) => {
    setSelectedId(item.id);
    setSelectedWarehouse(item);
    setActiveSection('overview');
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setActiveSection('overview');
  }, []);

  useEffect(() => {
    if (drawerLocations.error) {
      const e = drawerLocations.error as { status?: number | string; message?: string };
      setDrawerErrorKey(`${e.status || 'ERR'}:${e.message || ''}`);
    } else {
      setDrawerErrorKey('');
    }
  }, [drawerLocations.error]);

  useEffect(() => {
    if (drawerErrorKey) handleApiError(drawerErrorKey);
  }, [drawerErrorKey, handleApiError]);

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((w) => w.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/inventory/warehouses/${selectedId}`, { status });
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally { setSaving(false); }
  };

  const pathname = usePathname();
  useEffect(() => {
    if (drawerOpen) setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen && selectedWarehouse && !data.find(d => d.id === selectedWarehouse.id)) {
      setDrawerOpen(false);
      setSelectedWarehouse(null);
    }
  }, [data, drawerOpen, selectedWarehouse]);

  const drawerNavItems = useMemo(() => [
    { id: 'overview', label: t('workspace.overview'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v11a1 1 0 001 1h16a1 1 0 001-1V7M3 7l9-4 9 4M3 7l9 4m0-4v4" /></svg> },
    { id: 'locations', label: t('workspace.locations'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  ], [t]);

  const drawerSections = useMemo((): DrawerSection[] => [
    {
      id: 'overview',
      label: t('workspace.overview'),
      content: selectedWarehouse ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">{t('common.code')}</label>
            <p className="text-sm font-medium text-gray-900">{selectedWarehouse.code}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('common.name')}</label>
            <p className="text-sm text-gray-700">{selectedWarehouse.name}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('common.status')}</label>
            <div className="mt-0.5">
              <EntityStatusBadge status={selectedWarehouse.status} activeLabel={t('common.active')} inactiveLabel={t('common.inactive')} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('core.company')}</label>
            <p className="text-sm text-gray-700">{selectedWarehouse.company?.name || '-'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('core.branch')}</label>
            <p className="text-sm text-gray-700">{selectedWarehouse.branch?.name || '-'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('inventory.location')}</label>
            <p className="text-sm text-gray-700">{selectedWarehouse.location || '-'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('inventory.warehouseType')}</label>
            <p className="text-sm text-gray-700">{selectedWarehouse.warehouseType || '-'}</p>
          </div>
        </div>
      ) : null,
    },
    {
      id: 'locations',
      label: t('workspace.locations'),
      content: (
        <div>
          {drawerLocations.loading ? <LoadingState /> : (
            <div className="space-y-2">
              {drawerLocations.data.length > 0 ? drawerLocations.data.map((loc: any) => (
                <div key={loc.id} className="flex items-center justify-between p-2 bg-[var(--ws-soft)] border border-[var(--ws-border)] rounded-lg">
                  <span className="text-sm">{loc.name}</span>
                  <EntityStatusBadge status={loc.status} activeLabel={t('common.active')} inactiveLabel={t('common.inactive')} />
                </div>
              )) : (
                <p className="text-gray-500 text-sm">{t('common.noData')}</p>
              )}
            </div>
          )}
        </div>
      ),
    },
  ], [selectedWarehouse, t, drawerLocations.loading, drawerLocations.data]);

  const warehousesIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v11a1 1 0 001 1h16a1 1 0 001-1V7M3 7l9-4 9 4M3 7l9 4m0-4v4" />
    </svg>
  );

  const columns: GridColumn<Warehouse>[] = [
    { key: 'code', header: t('common.code'), sortable: true, filterable: true },
    { key: 'name', header: t('common.name'), sortable: true, filterable: true },
    { key: 'company', header: t('core.company'), sortable: true, render: (w: Warehouse) => w.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), sortable: true, render: (w: Warehouse) => w.branch?.name || '-' },
    { key: 'location', header: t('inventory.location'), render: (w: Warehouse) => w.location || '-' },
    { key: 'warehouseType', header: t('inventory.warehouseType'), render: (w: Warehouse) => w.warehouseType || '-' },
    { key: 'status', header: t('common.status'), sortable: true, filterable: true, filterType: 'select', filterOptions: [
      { value: 'ACTIVE', label: t('common.active') }, { value: 'INACTIVE', label: t('common.inactive') },
    ], render: (w: Warehouse) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${w.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{w.status}</span>
    )},
  ];

  const gridActions: GridAction<Warehouse>[] = [
    { label: t('actions.edit'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: (w: Warehouse) => openEdit(w) },
    { label: t('actions.activate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, onClick: (w: Warehouse) => confirmStatus(w.id), enabled: (w: Warehouse) => w.status !== 'ACTIVE' },
    { label: t('actions.deactivate'), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, onClick: (w: Warehouse) => confirmStatus(w.id), enabled: (w: Warehouse) => w.status === 'ACTIVE' },
  ];

  return (
    <EntityWorkspaceLayout drawerOpen={drawerOpen} drawer={drawerOpen ? <EntityDetailDrawer open={drawerOpen} onClose={closeDrawer} title={selectedWarehouse?.name || ''} subtitle={selectedWarehouse?.code} statusBadge={<EntityStatusBadge status={selectedWarehouse?.status || ''} activeLabel={t('common.active')} inactiveLabel={t('common.inactive')} />} sections={drawerSections} activeSection={activeSection} onSectionChange={setActiveSection} navItems={drawerNavItems} dir={dir} closeLabel={t('workspace.closePanel')} /> : undefined}>
      <EntityPageHeader title={t('inventory.warehouses')} icon={warehousesIcon} />
      {error && (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
        </div>
      )}
      {!error && loading && data.length === 0 && <LoadingState />}
      {!error && !loading && data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('common.noData')}</p>
        </div>
      )}
      {(!error || !loading) && data.length > 0 && (
        <EntityDataTable
          columns={columns}
          data={data}
          keyExtractor={(w: Warehouse) => w.id}
          selectedKey={selectedId}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage={t('common.noData')}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventory.editWarehouse') : t('inventory.newWarehouse')}>
        {detailLoading ? <LoadingState /> : <div className="space-y-4">
          <div>
            <F9Lookup label={t('core.company')} value={form.companyId} onChange={(v) => { setForm({ ...form, companyId: v }); setValidationErrors(p => ({ ...p, companyId: '' })); }} adapter={companyAdapter} />
            {validationErrors.companyId && <p className="text-red-500 text-sm mt-1">{validationErrors.companyId}</p>}
          </div>
          <F9Lookup label={t('core.branch')} value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} adapter={branchAdapter} filters={form.companyId ? { companyId: form.companyId } : undefined} />
          <div>
            <Input label={t('common.name')} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(p => ({ ...p, name: '' })); }} required />
            {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
          </div>
          <Input label={t('inventory.location')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Select label={t('inventory.warehouseType')} value={form.warehouseType} onChange={(e) => setForm({ ...form, warehouseType: e.target.value })} options={[
            { value: '', label: '' },
            { value: 'SPARE_PART', label: t('inventory.warehouseTypeSparePart') },
            { value: 'PRODUCT', label: t('inventory.warehouseTypeProduct') },
            { value: 'RAW_MATERIAL', label: t('inventory.warehouseTypeRawMaterial') },
            { value: 'GENERAL', label: t('inventory.warehouseTypeGeneral') },
          ]} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" loading={saving} />
    </EntityWorkspaceLayout>
  );
}
