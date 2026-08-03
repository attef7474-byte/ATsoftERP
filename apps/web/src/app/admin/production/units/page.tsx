'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { ProductionUnit } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

export default function ProductionUnitsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionUnit[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionUnit | null>(null);
  const [form, setForm] = useState({ code: '', name: '', abbreviation: '', description: '', decimals: '2' });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
    delete: () => selectedId && setConfirmDeleteOpen(true),
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
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: ProductionUnit[]; meta: any }>('/production/units', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', abbreviation: '', description: '', decimals: '2' });
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<ProductionUnit>(`/production/units/${id}`);
      setEditItem(item);
      setForm({
        code: item.code, name: item.name, abbreviation: item.abbreviation || '',
        description: item.description || '', decimals: String(item.decimals),
      });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.name) errors.name = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        abbreviation: form.abbreviation || undefined,
        description: form.description || undefined,
        decimals: Number(form.decimals) || 2,
      };
      if (editItem) {
        await api.patch(`/production/units/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/production/units', { ...payload, code: form.code || undefined });
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const confirmStatus = (id: string) => { setSelectedId(id); setConfirmStatusOpen(true); };
  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((p) => p.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/production/units/${selectedId}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`);
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/production/units/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionUnit>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'abbreviation', header: t('production.abbreviation'), render: (p: ProductionUnit) => p.abbreviation || '-' },
    { key: 'decimals', header: t('production.decimals'), render: (p: ProductionUnit) => p.decimals },
    { key: 'company', header: t('core.company'), render: (p: ProductionUnit) => p.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), render: (p: ProductionUnit) => p.branch?.name || '-' },
    { key: 'status', header: t('common.status'), render: (p: ProductionUnit) => <CmmsStatusBadge status={p.status} /> },
  ];

  const gridActions: GridAction<ProductionUnit>[] = [
    { label: t('actions.edit'), onClick: (p: ProductionUnit) => openEdit(p.id) },
    { label: t('common.delete'), onClick: (p: ProductionUnit) => { setSelectedId(p.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
    { label: t('actions.deactivate'), onClick: (p: ProductionUnit) => confirmStatus(p.id), enabled: (p: ProductionUnit) => p.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (p: ProductionUnit) => confirmStatus(p.id), enabled: (p: ProductionUnit) => p.status !== 'ACTIVE' },
  ];

  return (
    <div>
      <PageHeader title={t('production.units')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(p: ProductionUnit) => p.id}
        onRowClick={(p: ProductionUnit) => setSelectedId(p.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.editUnit') : t('production.newUnit')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {editItem ? (
              <div>
                <Input label={t('common.code')} value={form.code} disabled />
                <p className="text-xs text-gray-500 mt-1">{t('production.codeImmutableHint')}</p>
              </div>
            ) : (
              <div>
                <Input label={t('common.code')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                <p className="text-xs text-gray-500 mt-1">{t('production.codeHint')}</p>
              </div>
            )}
            <div>
              <Input label={t('common.name')} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setValidationErrors(prev => ({ ...prev, name: '' })); }} required />
              {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('production.abbreviation')} value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} />
            <Input label={t('production.decimals')} value={form.decimals} onChange={(e) => setForm({ ...form, decimals: e.target.value })} />
          </div>
          <Textarea label={t('production.unitDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
        )}
      </Modal>
      <ConfirmDialog open={confirmStatusOpen} onClose={() => setConfirmStatusOpen(false)} onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" loading={saving} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
