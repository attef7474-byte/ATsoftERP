'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { ProductionShiftTemplate } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog, Select, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, productionShiftAdapter } from '../../../../components/f9';

interface DayRow {
  key: string;
  dayOfWeek: number;
  shiftId: string;
  isWorkDay: boolean;
  sortOrder: number;
}

const DAY_KEYS = ['daySunday', 'dayMonday', 'dayTuesday', 'dayWednesday', 'dayThursday', 'dayFriday', 'daySaturday'];

export default function ProductionShiftTemplatesPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionShiftTemplate[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionShiftTemplate | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [days, setDays] = useState<DayRow[]>([]);
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
      const res = await api.get<{ data: ProductionShiftTemplate[]; meta: any }>('/production/shift-templates', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', description: '' });
    setDays([]);
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<ProductionShiftTemplate>(`/production/shift-templates/${id}`);
      setEditItem(item);
      setForm({ code: item.code, name: item.name, description: item.description || '' });
      setDays((item.days || []).map(d => ({
        key: d.id,
        dayOfWeek: d.dayOfWeek,
        shiftId: d.shiftId,
        isWorkDay: d.isWorkDay,
        sortOrder: d.sortOrder,
      })));
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  };

  const addDay = () => {
    setDays(prev => {
      const used = new Set(prev.map(d => d.dayOfWeek));
      let next = 0;
      while (used.has(next) && next < 7) next++;
      if (next >= 7) return prev;
      return [...prev, { key: `d-${Date.now()}`, dayOfWeek: next, shiftId: '', isWorkDay: true, sortOrder: prev.length }];
    });
  };

  const removeDay = (key: string) => setDays(prev => prev.filter(d => d.key !== key));

  const updateDay = (key: string, patch: Partial<DayRow>) => {
    setDays(prev => prev.map(d => d.key === key ? { ...d, ...patch } : d));
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.name) errors.name = t('validation.required');
    if (days.length === 0) errors.days = t('validation.required');
    if (days.some(d => !d.shiftId)) errors.days = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description || undefined,
        days: days.map(d => ({ dayOfWeek: d.dayOfWeek, shiftId: d.shiftId, isWorkDay: d.isWorkDay, sortOrder: d.sortOrder })),
      };
      if (editItem) {
        await api.patch(`/production/shift-templates/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/production/shift-templates', { ...payload, code: form.code || undefined });
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
      await api.patch(`/production/shift-templates/${selectedId}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`);
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/production/shift-templates/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<ProductionShiftTemplate>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'days', header: t('production.days'), render: (x: ProductionShiftTemplate) => (x.days || []).map(d => DAY_KEYS[d.dayOfWeek] ? t(`production.${DAY_KEYS[d.dayOfWeek]}`) : d.dayOfWeek).join(', ') || '-' },
    { key: 'calendars', header: t('production.shiftCalendars'), render: (x: ProductionShiftTemplate) => x._count?.calendars ?? 0 },
    { key: 'company', header: t('core.company'), render: (x: ProductionShiftTemplate) => x.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), render: (x: ProductionShiftTemplate) => x.branch?.name || '-' },
    { key: 'status', header: t('common.status'), render: (x: ProductionShiftTemplate) => <CmmsStatusBadge status={x.status} /> },
  ];

  const gridActions: GridAction<ProductionShiftTemplate>[] = [
    { label: t('actions.edit'), onClick: (x: ProductionShiftTemplate) => openEdit(x.id) },
    { label: t('common.delete'), onClick: (x: ProductionShiftTemplate) => { setSelectedId(x.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
    { label: t('actions.deactivate'), onClick: (x: ProductionShiftTemplate) => confirmStatus(x.id), enabled: (x: ProductionShiftTemplate) => x.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (x: ProductionShiftTemplate) => confirmStatus(x.id), enabled: (x: ProductionShiftTemplate) => x.status !== 'ACTIVE' },
  ];

  return (
    <div>
      <PageHeader title={t('production.shiftTemplates')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(x: ProductionShiftTemplate) => x.id}
        onRowClick={(x: ProductionShiftTemplate) => setSelectedId(x.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.editShiftTemplate') : t('production.newShiftTemplate')} size="lg">
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
          <Textarea label={t('production.templateDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">{t('production.days')}</h3>
            <Button variant="secondary" onClick={addDay}>{t('production.addDay')}</Button>
          </div>
          {validationErrors.days && <p className="text-red-500 text-sm">{validationErrors.days}</p>}
          {days.length === 0 && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
          <div className="space-y-2">
            {days.map((day) => (
              <div key={day.key} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center border border-gray-200 rounded-lg p-3">
                <Select label={t('production.dayOfWeek')} value={String(day.dayOfWeek)} onChange={(e) => updateDay(day.key, { dayOfWeek: Number(e.target.value) })} options={DAY_KEYS.map((k, idx) => ({ value: String(idx), label: t(`production.${k}`) }))} />
                <div>
                  <F9Lookup label={t('production.shift')} value={day.shiftId} onChange={(v) => updateDay(day.key, { shiftId: v })} adapter={productionShiftAdapter} />
                </div>
                <Select label={t('production.isWorkDay')} value={day.isWorkDay ? 'true' : 'false'} onChange={(e) => updateDay(day.key, { isWorkDay: e.target.value === 'true' })} options={[{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }]} />
                <div className="flex items-end">
                  <Button variant="danger" onClick={() => removeDay(day.key)}>{t('actions.remove')}</Button>
                </div>
              </div>
            ))}
          </div>
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