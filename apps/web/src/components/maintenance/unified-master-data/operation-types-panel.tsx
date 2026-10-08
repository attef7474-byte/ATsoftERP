'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../admin/toast-provider';
import { useApiErrorHandler } from '../../admin/error-handler';
import { OperationType } from '../../../lib/admin-types';
import { Button, Input, Pagination, Modal, ConfirmDialog } from '../../admin/ui';
import { CmmsStatusBadge } from '../index';
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
 * R4R — operation types panel of the unified Machine Categories & Operation Types page.
 *
 * This is the single implementation of operation-type maintenance.
 *
 * R4R defect fixed here: the previous standalone screen validated `code` as REQUIRED on
 * create while simultaneously rendering the code field as read-only "auto generated" and
 * never exposing an input for it. `OperationTypesService.create` generates the code when
 * `dto.code` is empty, so the form could never be submitted and operation types were
 * impossible to create from the UI. Create now sends only the name and optional
 * description and lets the authority generate the immutable code.
 */
export function OperationTypesPanel() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();
  // OperationType is a GLOBAL technical catalog (no companyId/branchId). Writes are
  // reserved for an approved catalog-admin role; read/list/F9 stay open to all roles.
  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(`operation-type:${action}`)),
    [isSuperAdmin, permissions],
  );
  const canCreate = can('create');
  const canUpdate = can('update');
  const canDelete = can('delete');
  const canActivate = can('activate');
  const canDeactivate = can('deactivate');
  const [data, setData] = useState<OperationType[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<OperationType | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const selectedRecord = useMemo(() => data.find((d) => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
    delete: () => selectedId && setConfirmDeleteOpen(true),
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
      variant: 'danger',
      onClick: () => exec('delete'),
      enabled: !!selectedId && canDelete,
    },
  ]);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError('');
      try {
        const params: Record<string, any> = { page, limit: 10 };
        if (search) params.search = search;
        const res = await api.get<{ data: OperationType[]; meta: any }>('/maintenance/operation-types', { params });
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
    setForm({ name: '', description: '' });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<OperationType>(`/maintenance/operation-types/${id}`);
      setEditItem(item);
      setForm({ name: item.name, description: item.description || '' });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally {
      setLoadingDetail(false);
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
      if (editItem) {
        // The code is immutable after creation and is never sent, so the authority's
        // "code cannot be changed" rule can never be triggered by this form.
        await api.patch(`/maintenance/operation-types/${editItem.id}`, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        });
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/operation-types', {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        });
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      const config = handleApiError(err);
      if (config.errors?.length) setValidationErrors(adaptFieldErrorsToMap(config.errors));
    } finally {
      setSaving(false);
    }
  };

  const confirmStatus = (id: string) => {
    setSelectedId(id);
    setConfirmStatusOpen(true);
  };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const item = data.find((p) => p.id === selectedId);
      const status = item?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (status === 'ACTIVE') {
        await api.patch(`/maintenance/operation-types/${selectedId}/activate`);
      } else {
        await api.patch(`/maintenance/operation-types/${selectedId}/deactivate`);
      }
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false);
      fetchData(meta.page);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/operation-types/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false);
      setSelectedId('');
      fetchData(1);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColumn<OperationType>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'description', header: t('maintenance.description'), render: (p: OperationType) => p.description || '-' },
    { key: 'status', header: t('common.status'), render: (p: OperationType) => <CmmsStatusBadge status={p.status} /> },
  ];

  const gridActions: GridAction<OperationType>[] = [
    { label: t('actions.edit'), onClick: (p: OperationType) => openEdit(p.id), enabled: () => canUpdate },
    {
      label: t('common.delete'),
      onClick: (p: OperationType) => {
        setSelectedId(p.id);
        setConfirmDeleteOpen(true);
      },
      variant: 'danger',
      enabled: () => canDelete,
    },
    {
      label: t('actions.deactivate'),
      onClick: (p: OperationType) => confirmStatus(p.id),
      enabled: (p: OperationType) => p.status === 'ACTIVE' && canDeactivate,
      variant: 'danger',
    },
    {
      label: t('actions.activate'),
      onClick: (p: OperationType) => confirmStatus(p.id),
      enabled: (p: OperationType) => p.status !== 'ACTIVE' && canActivate,
    },
  ];

  return (
    <>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(p: OperationType) => p.id}
        onRowClick={(p: OperationType) => setSelectedId(p.id)}
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
        title={editItem ? t('maintenance.editOperationType') : t('maintenance.newOperationType')}
        size="lg"
      >
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {editItem ? (
                <div>
                  <Input label={t('common.code')} value={editItem.code} disabled />
                  <p className="text-xs text-gray-500 mt-1">{t('common.codeImmutableHint')}</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('common.code')}</label>
                  <p className="text-sm text-gray-500 italic">{t('common.codeAutoGenerated')}</p>
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
              label={t('maintenance.description')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                {t('actions.cancel')}
              </Button>
              <Button onClick={handleSave} loading={saving} disabled={editItem ? !canUpdate : !canCreate}>
                {t('actions.save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmStatusOpen}
        onClose={() => setConfirmStatusOpen(false)}
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