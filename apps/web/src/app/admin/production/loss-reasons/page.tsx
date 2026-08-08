'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { OperationalLossReason } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';

const LOSS_CATEGORIES = ['DOWNTIME', 'WASTE', 'SCRAP', 'REWORK', 'QUALITY', 'SETUP', 'MAINTENANCE', 'OTHER'];
const SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'];
const MAINTENANCE_POLICIES = ['REQUIRED', 'OPTIONAL', 'FORBIDDEN'];

function categoryLabelKey(value: string): string {
  return 'production.lossReasons.category' + value;
}

function severityLabelKey(value: string): string {
  return 'production.lossReasons.severity' + value;
}

function policyLabelKey(value: string): string {
  return 'production.lossReasons.policy' + value;
}

export default function ProductionLossReasonsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<OperationalLossReason[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<OperationalLossReason | null>(null);
  const [form, setForm] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    description: '',
    parentId: '',
    lossCategory: 'DOWNTIME',
    plannedDefault: false,
    severityDefault: 'MINOR',
    maintenanceRequestPolicy: 'OPTIONAL',
    effectiveFrom: '',
    effectiveTo: '',
    status: 'DRAFT',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [statusAction, setStatusAction] = useState<'activate' | 'deactivate'>('activate');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const parentOptions = useMemo(
    () => data.filter((d) => d.id !== editItem?.id).map((d) => ({ value: d.id, label: `[${d.code}] ${d.nameEn}` })),
    [data, editItem],
  );

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    activate: () => { setStatusAction('activate'); setConfirmStatusOpen(true); },
    deactivate: () => { setStatusAction('deactivate'); setConfirmStatusOpen(true); },
    delete: () => selectedId && setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(selectedId && selectedRecord?.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(selectedId && selectedRecord?.status === 'ACTIVE') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!(selectedId && selectedRecord?.status === 'DRAFT') },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.lossCategory = categoryFilter;
      const res = await api.get<{ data: OperationalLossReason[]; meta: any }>('/production/loss-reasons', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, statusFilter, categoryFilter, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({
      code: '', nameAr: '', nameEn: '', description: '',
      parentId: '', lossCategory: 'DOWNTIME', plannedDefault: false,
      severityDefault: 'MINOR', maintenanceRequestPolicy: 'OPTIONAL',
      effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '', status: 'DRAFT',
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<OperationalLossReason>(`/production/loss-reasons/${id}`);
      setEditItem(item);
      setForm({
        code: item.code,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        description: item.description || '',
        parentId: item.parentId || '',
        lossCategory: item.lossCategory,
        plannedDefault: item.plannedDefault,
        severityDefault: item.severityDefault || 'MINOR',
        maintenanceRequestPolicy: item.maintenanceRequestPolicy,
        effectiveFrom: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : '',
        effectiveTo: item.effectiveTo ? item.effectiveTo.slice(0, 10) : '',
        status: item.status,
      });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    } finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.code) errors.code = t('validation.required');
    if (!form.nameAr) errors.nameAr = t('validation.required');
    if (!form.nameEn) errors.nameEn = t('validation.required');
    if (!form.effectiveFrom) errors.effectiveFrom = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        code: form.code,
        nameAr: form.nameAr,
        nameEn: form.nameEn,
        description: form.description || null,
        parentId: form.parentId || undefined,
        lossCategory: form.lossCategory,
        plannedDefault: form.plannedDefault,
        severityDefault: form.severityDefault,
        maintenanceRequestPolicy: form.maintenanceRequestPolicy,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      };
      if (editItem) {
        await api.patch(`/production/loss-reasons/${editItem.id}`, payload);
        showToast(t('production.lossReasons.updateCompleted'), 'success');
      } else {
        await api.post('/production/loss-reasons', payload);
        showToast(t('production.lossReasons.createCompleted'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async () => {
    setSaving(true);
    try {
      const action = statusAction === 'activate' ? 'activate' : 'deactivate';
      await api.patch(`/production/loss-reasons/${selectedId}/${action}`, {});
      showToast(statusAction === 'activate' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/production/loss-reasons/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<OperationalLossReason>[] = [
    { key: 'code', header: t('production.lossReasons.code') },
    { key: 'nameEn', header: t('production.lossReasons.nameEn'), render: (r) => r.nameEn },
    { key: 'nameAr', header: t('production.lossReasons.nameAr'), render: (r) => r.nameAr },
    { key: 'lossCategory', header: t('production.lossReasons.lossCategory'), render: (r) => t(categoryLabelKey(r.lossCategory)) },
    { key: 'plannedDefault', header: t('production.lossReasons.plannedDefault'), render: (r) => r.plannedDefault ? t('common.yes') : t('common.no') },
    { key: 'severityDefault', header: t('production.lossReasons.severityDefault'), render: (r) => r.severityDefault ? t(severityLabelKey(r.severityDefault)) : '-' },
    { key: 'status', header: t('production.lossReasons.status'), render: (r) => <CmmsStatusBadge status={r.status} /> },
  ];

  const gridActions: GridAction<OperationalLossReason>[] = [
    { label: t('actions.edit'), onClick: (r) => openEdit(r.id), enabled: (r) => r.status === 'DRAFT' },
    { label: t('actions.activate'), onClick: (r) => { setSelectedId(r.id); setStatusAction('activate'); setConfirmStatusOpen(true); }, enabled: (r) => r.status !== 'ACTIVE' },
    { label: t('actions.deactivate'), onClick: (r) => { setSelectedId(r.id); setStatusAction('deactivate'); setConfirmStatusOpen(true); }, enabled: (r) => r.status === 'ACTIVE', variant: 'danger' },
    { label: t('common.delete'), onClick: (r) => { setSelectedId(r.id); setConfirmDeleteOpen(true); }, enabled: (r) => r.status === 'DRAFT', variant: 'danger' },
  ];

  return (
    <div>
      <PageHeader title={t('production.lossReasons.title')} />
      <div className="mb-4 flex max-w-2xl gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder={t('production.lossReasons.allStatuses')}
          options={[
            { value: 'DRAFT', label: t('common.status.DRAFT') },
            { value: 'ACTIVE', label: t('common.status.ACTIVE') },
            { value: 'INACTIVE', label: t('common.status.INACTIVE') },
          ]}
        />
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          placeholder={t('production.lossReasons.allCategories')}
          options={LOSS_CATEGORIES.map((value) => ({ value, label: t(categoryLabelKey(value)) }))}
        />
      </div>
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id)}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.lossReasons.editReason') : t('production.lossReasons.newReason')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('production.lossReasons.code')} value={form.code} disabled={!!editItem} onChange={(e) => { setForm({ ...form, code: e.target.value }); setValidationErrors(prev => ({ ...prev, code: '' })); }} required />
                <p className="mt-1 text-xs text-gray-500">{editItem ? t('production.lossReasons.codeImmutable') : t('production.lossReasons.codeAutoGenerated')}</p>
                {validationErrors.code && <p className="text-red-500 text-sm mt-1">{validationErrors.code}</p>}
              </div>
              <div>
                <Input label={t('production.lossReasons.effectiveFrom')} type="date" value={form.effectiveFrom} onChange={(e) => { setForm({ ...form, effectiveFrom: e.target.value }); setValidationErrors(prev => ({ ...prev, effectiveFrom: '' })); }} required />
                {validationErrors.effectiveFrom && <p className="text-red-500 text-sm mt-1">{validationErrors.effectiveFrom}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('production.lossReasons.nameAr')} value={form.nameAr} onChange={(e) => { setForm({ ...form, nameAr: e.target.value }); setValidationErrors(prev => ({ ...prev, nameAr: '' })); }} required />
                {validationErrors.nameAr && <p className="text-red-500 text-sm mt-1">{validationErrors.nameAr}</p>}
              </div>
              <div>
                <Input label={t('production.lossReasons.nameEn')} value={form.nameEn} onChange={(e) => { setForm({ ...form, nameEn: e.target.value }); setValidationErrors(prev => ({ ...prev, nameEn: '' })); }} required />
                {validationErrors.nameEn && <p className="text-red-500 text-sm mt-1">{validationErrors.nameEn}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Select
                  label={t('production.lossReasons.lossCategory')}
                  value={form.lossCategory}
                  onChange={(e) => setForm({ ...form, lossCategory: e.target.value })}
                  options={LOSS_CATEGORIES.map((value) => ({ value, label: t(categoryLabelKey(value)) }))}
                />
              </div>
              <div>
                <Select
                  label={t('production.lossReasons.parentReason')}
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  placeholder={t('common.none')}
                  options={parentOptions}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Select
                  label={t('production.lossReasons.severityDefault')}
                  value={form.severityDefault}
                  onChange={(e) => setForm({ ...form, severityDefault: e.target.value })}
                  options={SEVERITIES.map((value) => ({ value, label: t(severityLabelKey(value)) }))}
                />
              </div>
              <div>
                <Select
                  label={t('production.lossReasons.maintenanceRequestPolicy')}
                  value={form.maintenanceRequestPolicy}
                  onChange={(e) => setForm({ ...form, maintenanceRequestPolicy: e.target.value })}
                  options={MAINTENANCE_POLICIES.map((value) => ({ value, label: t(policyLabelKey(value)) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('production.lossReasons.plannedDefault')}</label>
                <input type="checkbox" checked={form.plannedDefault} onChange={(e) => setForm({ ...form, plannedDefault: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
              </div>
              <div>
                <Input label={t('production.lossReasons.effectiveTo')} type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
              </div>
            </div>
            <Textarea label={t('production.lossReasons.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
              <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmStatusOpen}
        onClose={() => setConfirmStatusOpen(false)}
        onConfirm={handleStatusChange}
        title={statusAction === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={statusAction === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
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
    </div>
  );
}
