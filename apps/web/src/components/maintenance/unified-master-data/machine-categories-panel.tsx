'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../admin/toast-provider';
import { useApiErrorHandler } from '../../admin/error-handler';
import { MachineCategory } from '../../../lib/admin-types';
import { Button, Input, Pagination, Modal, ConfirmDialog } from '../../admin/ui';
import { CmmsStatusBadge } from '../index';
import { F9Lookup, machineCategoryAdapter } from '../../f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../admin/admin-data-grid';
import {
  useRegisterAdminActions,
  useStableHandlers,
  ActionAddIcon,
  ActionEditIcon,
  ActionDeleteIcon,
  ActionRefreshIcon,
  ActionActivateIcon,
  ActionDeactivateIcon,
} from '../../admin/admin-action-bar';
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../lib/form-validation';
import { useAuth } from '../../../lib/auth-context';

/**
 * R4R — machine categories panel of the unified Machine Categories & Operation Types page.
 *
 * This is the single implementation of category maintenance. The unified page renders it
 * as a tab, and it is no longer reachable as a competing standalone screen.
 */
export function MachineCategoriesPanel() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();
  // MachineCategory is a GLOBAL catalog (no companyId/branchId). A maintenance operator
  // may read it to classify machines; mutating it requires the approved catalog-admin role.
  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(`machine-category:${action}`)),
    [isSuperAdmin, permissions],
  );
  const canCreate = can('create');
  const canUpdate = can('update');
  const canDelete = can('delete');
  const canActivate = can('activate');
  const canDeactivate = can('deactivate');
  const [data, setData] = useState<MachineCategory[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MachineCategory | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', parentId: '' });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find((d) => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
    delete: () => setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new'), enabled: canCreate },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId && canUpdate },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    {
      id: 'activate',
      labelKey: 'common.activate',
      icon: <ActionActivateIcon />,
      onClick: () => exec('activate'),
      enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') && canActivate,
    },
    {
      id: 'deactivate',
      labelKey: 'common.deactivate',
      icon: <ActionDeactivateIcon />,
      onClick: () => exec('deactivate'),
      enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') && canDeactivate,
    },
    {
      id: 'delete',
      labelKey: 'common.delete',
      icon: <ActionDeleteIcon />,
      onClick: () => exec('delete'),
      enabled: !!selectedId && canDelete,
      variant: 'danger',
    },
  ]);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError('');
      try {
        const params: Record<string, any> = { page, limit: 10 };
        if (search) params.search = search;
        const res = await api.get<{ data: MachineCategory[]; meta: any }>('/maintenance/machine-categories', { params });
        setData(res.data || []);
        setMeta(res.meta);
      } catch (err: any) {
        setError(err?.message || t('errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [search, t],
  );

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', description: '', parentId: '' });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoading(true);
    setValidationErrors({});
    try {
      const item = await api.get<MachineCategory>(`/maintenance/machine-categories/${id}`);
      setEditItem(item);
      setForm({ code: item.code, name: item.name, description: item.description || '', parentId: item.parentId || '' });
      setModalOpen(true);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(
        Object.entries(errors).map(([field, message]) => ({ field, code: 'validation.required', message })),
      );
      return;
    }
    setSaving(true);
    try {
      const payload: any = { name: form.name.trim() };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.parentId) payload.parentId = form.parentId;
      if (editItem) {
        await api.patch(`/maintenance/machine-categories/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/machine-categories', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      const config = handleApiError(err);
      if (config.errors?.length) {
        setValidationErrors(adaptFieldErrorsToMap(config.errors));
        focusFirstInvalidField(config.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmStatus = (id: string) => {
    setSelectedId(id);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/machine-categories/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((m) => m.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (status === 'ACTIVE') {
        await api.patch(`/maintenance/machine-categories/${selectedId}/activate`);
      } else {
        await api.patch(`/maintenance/machine-categories/${selectedId}/deactivate`);
      }
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColumn<MachineCategory>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'description', header: t('common.description'), render: (c: MachineCategory) => c.description || '-' },
    { key: 'parent', header: t('maintenance.parentCategory'), render: (c: MachineCategory) => c.parent?.name || '-' },
    { key: 'status', header: t('common.status'), render: (c: MachineCategory) => <CmmsStatusBadge status={c.status} /> },
    { key: 'machines', header: t('maintenance.machines'), render: (c: MachineCategory) => c._count?.machines ?? 0 },
  ];

  const gridActions: GridAction<MachineCategory>[] = [
    { label: t('actions.edit'), onClick: (c: MachineCategory) => openEdit(c.id), enabled: () => canUpdate },
    {
      label: t('actions.deactivate'),
      onClick: (c: MachineCategory) => confirmStatus(c.id),
      enabled: (c: MachineCategory) => c.status === 'ACTIVE' && canDeactivate,
      variant: 'danger',
    },
    { label: t('actions.activate'), onClick: (c: MachineCategory) => confirmStatus(c.id), enabled: (c: MachineCategory) => c.status !== 'ACTIVE' && canActivate },
    {
      label: t('actions.delete'),
      onClick: (c: MachineCategory) => {
        setSelectedId(c.id);
        setConfirmDeleteOpen(true);
      },
      variant: 'danger',
      enabled: () => canDelete,
    },
  ];

  return (
    <>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(c: MachineCategory) => c.id}
        onRowClick={(c: MachineCategory) => setSelectedId(c.id)}
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
      {data.length > 0 && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? t('maintenance.editMachineCategory') : t('maintenance.newMachineCategory')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {editItem ? (
              <Input label={t('common.code')} value={form.code} disabled />
            ) : (
              <div className="text-sm text-gray-500 self-end pb-2">
                {t('common.code')}: {t('common.autoGenerated')}
              </div>
            )}
            <div>
              <Input
                label={t('common.name')}
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setValidationErrors((prev) => ({ ...prev, name: '' }));
                }}
                required
              />
              {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
            </div>
          </div>
          <Input
            label={t('common.description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div>
            <F9Lookup
              label={t('maintenance.parentCategory')}
              value={form.parentId}
              onChange={(v) => setForm({ ...form, parentId: v })}
              adapter={machineCategoryAdapter}
            />
            {validationErrors.parentId && <p className="text-red-500 text-sm mt-1">{validationErrors.parentId}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={editItem ? !canUpdate : !canCreate}>
              {t('actions.save')}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')}
        message={t('common.confirmDeactivateMessage')}
        variant="danger"
        loading={saving}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')}
        message={t('common.confirmDeleteMessage')}
        variant="danger"
        loading={saving}
      />
    </>
  );
}