'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { ProductionShiftAssignment } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog, Select, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, productionShiftAdapter, productionShiftCalendarAdapter, operationalPersonAdapter } from '../../../../components/f9';

export default function ProductionShiftAssignmentsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionShiftAssignment[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionShiftAssignment | null>(null);
  const [form, setForm] = useState({
    code: '', shiftId: '', calendarId: '', operationalPersonId: '',
    effectiveFrom: '', effectiveTo: '', isPrimary: 'false', notes: '',
  });
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
      const res = await api.get<{ data: ProductionShiftAssignment[]; meta: any }>('/production/shift-assignments', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', shiftId: '', calendarId: '', operationalPersonId: '', effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '', isPrimary: 'false', notes: '' });
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<ProductionShiftAssignment>(`/production/shift-assignments/${id}`);
      setEditItem(item);
      setForm({
        code: item.code, shiftId: item.shiftId, calendarId: item.calendarId || '',
        operationalPersonId: item.operationalPersonId,
        effectiveFrom: item.effectiveFrom.slice(0, 10),
        effectiveTo: item.effectiveTo ? item.effectiveTo.slice(0, 10) : '',
        isPrimary: item.isPrimary ? 'true' : 'false',
        notes: item.notes || '',
      });
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.shiftId) errors.shiftId = t('validation.required');
    if (!form.operationalPersonId) errors.operationalPersonId = t('validation.required');
    if (!form.effectiveFrom) errors.effectiveFrom = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        shiftId: form.shiftId,
        calendarId: form.calendarId || undefined,
        operationalPersonId: form.operationalPersonId,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
        isPrimary: form.isPrimary === 'true',
        notes: form.notes || undefined,
      };
      if (editItem) {
        await api.patch(`/production/shift-assignments/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/production/shift-assignments', { ...payload, code: form.code || undefined });
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
      await api.patch(`/production/shift-assignments/${selectedId}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`);
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/production/shift-assignments/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionShiftAssignment>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'person', header: t('production.operationalPerson'), render: (a: ProductionShiftAssignment) => a.operationalPerson ? `[${a.operationalPerson.code}] ${a.operationalPerson.name}` : '-' },
    { key: 'shift', header: t('production.shift'), render: (a: ProductionShiftAssignment) => a.shift?.name || '-' },
    { key: 'calendar', header: t('production.calendar'), render: (a: ProductionShiftAssignment) => a.calendar?.name || '-' },
    { key: 'effectiveFrom', header: t('production.effectiveFrom'), render: (a: ProductionShiftAssignment) => new Date(a.effectiveFrom).toLocaleDateString() },
    { key: 'effectiveTo', header: t('production.effectiveTo'), render: (a: ProductionShiftAssignment) => a.effectiveTo ? new Date(a.effectiveTo).toLocaleDateString() : '-' },
    { key: 'isPrimary', header: t('production.isPrimary'), render: (a: ProductionShiftAssignment) => a.isPrimary ? t('common.yes') : t('common.no') },
    { key: 'status', header: t('common.status'), render: (a: ProductionShiftAssignment) => <CmmsStatusBadge status={a.status} /> },
  ];

  const gridActions: GridAction<ProductionShiftAssignment>[] = [
    { label: t('actions.edit'), onClick: (a: ProductionShiftAssignment) => openEdit(a.id) },
    { label: t('common.delete'), onClick: (a: ProductionShiftAssignment) => { setSelectedId(a.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
    { label: t('actions.deactivate'), onClick: (a: ProductionShiftAssignment) => confirmStatus(a.id), enabled: (a: ProductionShiftAssignment) => a.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (a: ProductionShiftAssignment) => confirmStatus(a.id), enabled: (a: ProductionShiftAssignment) => a.status !== 'ACTIVE' },
  ];

  return (
    <div>
      <PageHeader title={t('production.shiftAssignments')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(a: ProductionShiftAssignment) => a.id}
        onRowClick={(a: ProductionShiftAssignment) => setSelectedId(a.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.editShiftAssignment') : t('production.newShiftAssignment')} size="lg">
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
              <F9Lookup label={t('production.operationalPerson')} value={form.operationalPersonId} onChange={(v) => { setForm({ ...form, operationalPersonId: v }); setValidationErrors(prev => ({ ...prev, operationalPersonId: '' })); }} adapter={operationalPersonAdapter} />
              {validationErrors.operationalPersonId && <p className="text-red-500 text-sm mt-1">{validationErrors.operationalPersonId}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <F9Lookup label={t('production.shift')} value={form.shiftId} onChange={(v) => { setForm({ ...form, shiftId: v }); setValidationErrors(prev => ({ ...prev, shiftId: '' })); }} adapter={productionShiftAdapter} />
              {validationErrors.shiftId && <p className="text-red-500 text-sm mt-1">{validationErrors.shiftId}</p>}
            </div>
            <F9Lookup label={t('production.calendar')} value={form.calendarId} onChange={(v) => setForm({ ...form, calendarId: v })} adapter={productionShiftCalendarAdapter} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label={t('production.effectiveFrom')} type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
              {validationErrors.effectiveFrom && <p className="text-red-500 text-sm mt-1">{validationErrors.effectiveFrom}</p>}
            </div>
            <Input label={t('production.effectiveTo')} type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('production.isPrimary')} value={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.value })} options={[{ value: 'false', label: t('common.no') }, { value: 'true', label: t('common.yes') }]} />
          </div>
          <Textarea label={t('production.assignmentNotes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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