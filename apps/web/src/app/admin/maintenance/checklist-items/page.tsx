'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { MaintenanceChecklistItem } from '../../../../lib/admin-types';
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { F9Lookup, maintenanceScheduleAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';

const RESULT_TYPES = ['PASS_FAIL', 'TEXT', 'NUMBER', 'BOOLEAN', 'READING'];

export default function MaintenanceChecklistItemsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<MaintenanceChecklistItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceChecklistItem | null>(null);
  const [form, setForm] = useState({
    scheduleId: '',
    title: '',
    description: '',
    sortOrder: 0,
    isMandatory: false,
    resultType: 'PASS_FAIL',
    minValue: '',
    maxValue: '',
    unit: '',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const resultTypeLabelKey = (rt: string) =>
    ({ PASS_FAIL: 'maintenance.resultTypePassFail', TEXT: 'maintenance.resultTypeText', NUMBER: 'maintenance.resultTypeNumber', BOOLEAN: 'maintenance.resultTypeBoolean', READING: 'maintenance.resultTypeReading' }[rt] || 'maintenance.resultType');

  const resultTypeOptions = useMemo(
    () => RESULT_TYPES.map((rt) => ({ value: rt, label: t(resultTypeLabelKey(rt)) })),
    [t],
  );

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedId && openEdit(selectedId),
    refresh: () => fetchData(meta.page),
    delete: () => setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, onClick: () => exec('delete'), enabled: !!selectedId, variant: 'danger' },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: MaintenanceChecklistItem[]; meta: any }>('/maintenance/checklist-items', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ scheduleId: '', title: '', description: '', sortOrder: 0, isMandatory: false, resultType: 'PASS_FAIL', minValue: '', maxValue: '', unit: '' });
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    try {
      const item = await api.get<MaintenanceChecklistItem>('/maintenance/checklist-items/' + id);
      setEditItem(item);
      setForm({
        scheduleId: item.scheduleId || '',
        title: item.title,
        description: item.description || '',
        sortOrder: item.sortOrder,
        isMandatory: item.isMandatory,
        resultType: item.resultType || 'PASS_FAIL',
        minValue: item.minValue !== null && item.minValue !== undefined ? String(item.minValue) : '',
        maxValue: item.maxValue !== null && item.maxValue !== undefined ? String(item.maxValue) : '',
        unit: item.unit || '',
      });
      setModalOpen(true);
    } catch (err: any) { handleApiError(err); }
    finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.title) errors.title = t('validation.required');
    if (!form.scheduleId) errors.scheduleId = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        scheduleId: form.scheduleId,
        title: form.title,
        sortOrder: form.sortOrder,
        isMandatory: form.isMandatory,
        resultType: form.resultType,
      };
      if (form.description) payload.description = form.description;
      if (form.minValue !== '') payload.minValue = Number(form.minValue);
      if (form.maxValue !== '') payload.maxValue = Number(form.maxValue);
      if (form.unit) payload.unit = form.unit;
      if (editItem) {
        await api.patch(`/maintenance/checklist-items/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/checklist-items', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.delete('/maintenance/checklist-items/' + selectedId);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false);
      setSelectedId('');
      fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<MaintenanceChecklistItem>[] = [
    { key: 'title', header: t('common.title') },
    { key: 'schedule', header: t('maintenance.maintenanceSchedule'), render: (c: MaintenanceChecklistItem) => c.schedule?.title || '-' },
    { key: 'sortOrder', header: t('maintenance.sortOrder') },
    { key: 'isMandatory', header: t('maintenance.mandatory'), render: (c: MaintenanceChecklistItem) => c.isMandatory ? t('status.true') : t('status.false') },
    { key: 'resultType', header: t('maintenance.resultType'), render: (c: MaintenanceChecklistItem) => t(resultTypeLabelKey(c.resultType)) },
  ];

  const gridActions: GridAction<MaintenanceChecklistItem>[] = [
    { label: t('actions.edit'), onClick: (c: MaintenanceChecklistItem) => openEdit(c.id) },
    { label: t('common.delete'), onClick: (c: MaintenanceChecklistItem) => { setSelectedId(c.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.checklistItems')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(c: MaintenanceChecklistItem) => c.id}
        onRowClick={(c: MaintenanceChecklistItem) => setSelectedId(c.id)}
        selectedKey={selectedId}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={() => fetchData(meta.page)}
        actions={gridActions}
        globalSearch={search}
        onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(meta.page)}
        refreshLoading={loading}
      />
      {data.length > 0 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editChecklistItem') : t('maintenance.newChecklistItem')} size="lg">
        <div className="space-y-4">
          <F9Lookup label={t('maintenance.maintenanceSchedule')} value={form.scheduleId} onChange={(v) => { setForm({ ...form, scheduleId: v }); setValidationErrors(prev => ({ ...prev, scheduleId: '' })); }} adapter={maintenanceScheduleAdapter} />
          {validationErrors.scheduleId && <p className="text-red-500 text-sm mt-1">{validationErrors.scheduleId}</p>}
          <Input label={t('common.title')} value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setValidationErrors(prev => ({ ...prev, title: '' })); }} required />
          {validationErrors.title && <p className="text-red-500 text-sm mt-1">{validationErrors.title}</p>}
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('maintenance.sortOrder')} type="number" value={String(form.sortOrder)} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
            <Select label={t('maintenance.mandatory')} value={String(form.isMandatory)} onChange={(e) => setForm({ ...form, isMandatory: e.target.value === 'true' })} options={[{ value: 'true', label: t('status.true') }, { value: 'false', label: t('status.false') }]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('maintenance.resultType')} value={form.resultType} onChange={(e) => setForm({ ...form, resultType: e.target.value })} options={resultTypeOptions} />
            <Input label={t('maintenance.unit')} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={t('maintenance.unit')} />
          </div>
          {(form.resultType === 'NUMBER' || form.resultType === 'READING') && (
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('maintenance.minValue')} type="number" value={form.minValue} onChange={(e) => setForm({ ...form, minValue: e.target.value })} />
              <Input label={t('maintenance.maxValue')} type="number" value={form.maxValue} onChange={(e) => setForm({ ...form, maxValue: e.target.value })} />
            </div>
          )}
          <Input label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving || loadingDetail}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
