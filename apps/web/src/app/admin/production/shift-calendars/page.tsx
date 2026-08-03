'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { ProductionShiftCalendar } from '../../../../lib/admin-types';
import { Button, Input, Pagination, PageHeader, Modal, ConfirmDialog, Select, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionActivateIcon, ActionDeactivateIcon, ActionViewIcon } from '../../../../components/admin/admin-action-bar';
import { F9Lookup, productionShiftAdapter, productionShiftTemplateAdapter } from '../../../../components/f9';

interface EntryRow {
  id?: string;
  date: string;
  shiftId: string;
  isWorkDay: boolean;
  notes: string;
  isNew: boolean;
}

export default function ProductionShiftCalendarsPage() {
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<ProductionShiftCalendar[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductionShiftCalendar | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', templateId: '', effectiveFrom: '', effectiveTo: '' });
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveDate, setResolveDate] = useState(new Date().toISOString().slice(0, 10));
  const [resolveResult, setResolveResult] = useState<any>(null);
  const [resolving, setResolving] = useState(false);

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    activate: () => confirmStatus(selectedId),
    deactivate: () => confirmStatus(selectedId),
    delete: () => selectedId && setConfirmDeleteOpen(true),
    view: () => selectedId && openResolve(selectedId),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'view', labelKey: 'production.resolve', icon: <ActionViewIcon />, onClick: () => exec('view'), enabled: !!selectedId },
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
      const res = await api.get<{ data: ProductionShiftCalendar[]; meta: any }>('/production/shift-calendars', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', description: '', templateId: '', effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '' });
    setEntries([]);
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const item = await api.get<ProductionShiftCalendar>(`/production/shift-calendars/${id}`);
      setEditItem(item);
      setForm({
        code: item.code, name: item.name, description: item.description || '',
        templateId: item.templateId || '',
        effectiveFrom: item.effectiveFrom.slice(0, 10),
        effectiveTo: item.effectiveTo ? item.effectiveTo.slice(0, 10) : '',
      });
      setEntries((item.entries || []).map(e => ({
        id: e.id, date: e.date.slice(0, 10), shiftId: e.shiftId || '',
        isWorkDay: e.isWorkDay, notes: e.notes || '', isNew: false,
      })));
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  };

  const addEntry = () => {
    setEntries(prev => [...prev, { date: '', shiftId: '', isWorkDay: true, notes: '', isNew: true }]);
  };

  const removeEntry = (idx: number) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx: number, patch: Partial<EntryRow>) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.name) errors.name = t('validation.required');
    if (!form.effectiveFrom) errors.effectiveFrom = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description || undefined,
        templateId: form.templateId || undefined,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
      };
      if (editItem) {
        await api.patch(`/production/shift-calendars/${editItem.id}`, payload);
        for (const entry of entries) {
          if (entry.isNew) {
            await api.post(`/production/shift-calendars/${editItem.id}/entries`, {
              date: entry.date, shiftId: entry.shiftId || undefined, isWorkDay: entry.isWorkDay, notes: entry.notes || undefined,
            });
          } else if (entry.id) {
            await api.patch(`/production/shift-calendars/${editItem.id}/entries/${entry.id}`, {
              shiftId: entry.shiftId || undefined, isWorkDay: entry.isWorkDay, notes: entry.notes || undefined,
            });
          }
        }
        const removedIds = (await api.get<ProductionShiftCalendar>(`/production/shift-calendars/${editItem.id}`)).entries
          ?.filter(e => !entries.some(ne => ne.id === e.id))
          .map(e => e.id) || [];
        for (const rid of removedIds) {
          await api.delete(`/production/shift-calendars/${editItem.id}/entries/${rid}`);
        }
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/production/shift-calendars', { ...payload, code: form.code || undefined, entries: entries.filter(e => e.date).map(e => ({ date: e.date, shiftId: e.shiftId || undefined, isWorkDay: e.isWorkDay, notes: e.notes || undefined })) });
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
      await api.patch(`/production/shift-calendars/${selectedId}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`);
      showToast(status === 'ACTIVE' ? t('common.successActivated') : t('common.successDeactivated'), 'success');
      setConfirmStatusOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/production/shift-calendars/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const openResolve = (id: string) => {
    setSelectedId(id);
    setResolveDate(new Date().toISOString().slice(0, 10));
    setResolveResult(null);
    setResolveOpen(true);
  };

  const handleResolve = async () => {
    setResolving(true); setResolveResult(null);
    try {
      setResolveResult(await api.get(`/production/shift-calendars/${selectedId}/resolve`, { params: { date: resolveDate } }));
    } catch (err: any) { handleApiError(err); }
    finally { setResolving(false); }
  };

  const columns: GridColumn<ProductionShiftCalendar>[] = [
    { key: 'code', header: t('common.code') },
    { key: 'name', header: t('common.name') },
    { key: 'template', header: t('production.template'), render: (c: ProductionShiftCalendar) => c.template?.name || '-' },
    { key: 'effectiveFrom', header: t('production.effectiveFrom'), render: (c: ProductionShiftCalendar) => new Date(c.effectiveFrom).toLocaleDateString() },
    { key: 'effectiveTo', header: t('production.effectiveTo'), render: (c: ProductionShiftCalendar) => c.effectiveTo ? new Date(c.effectiveTo).toLocaleDateString() : '-' },
    { key: 'company', header: t('core.company'), render: (c: ProductionShiftCalendar) => c.company?.name || '-' },
    { key: 'branch', header: t('core.branch'), render: (c: ProductionShiftCalendar) => c.branch?.name || '-' },
    { key: 'status', header: t('common.status'), render: (c: ProductionShiftCalendar) => <CmmsStatusBadge status={c.status} /> },
  ];

  const gridActions: GridAction<ProductionShiftCalendar>[] = [
    { label: t('actions.edit'), onClick: (c: ProductionShiftCalendar) => openEdit(c.id) },
    { label: t('production.resolve'), onClick: (c: ProductionShiftCalendar) => openResolve(c.id) },
    { label: t('common.delete'), onClick: (c: ProductionShiftCalendar) => { setSelectedId(c.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
    { label: t('actions.deactivate'), onClick: (c: ProductionShiftCalendar) => confirmStatus(c.id), enabled: (c: ProductionShiftCalendar) => c.status === 'ACTIVE', variant: 'danger' },
    { label: t('actions.activate'), onClick: (c: ProductionShiftCalendar) => confirmStatus(c.id), enabled: (c: ProductionShiftCalendar) => c.status !== 'ACTIVE' },
  ];

  return (
    <div>
      <PageHeader title={t('production.shiftCalendars')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(c: ProductionShiftCalendar) => c.id}
        onRowClick={(c: ProductionShiftCalendar) => setSelectedId(c.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('production.editShiftCalendar') : t('production.newShiftCalendar')} size="lg">
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
          <Textarea label={t('production.calendarDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <F9Lookup label={t('production.template')} value={form.templateId} onChange={(v) => setForm({ ...form, templateId: v })} adapter={productionShiftTemplateAdapter} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label={t('production.effectiveFrom')} type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
                {validationErrors.effectiveFrom && <p className="text-red-500 text-sm mt-1">{validationErrors.effectiveFrom}</p>}
              </div>
              <Input label={t('production.effectiveTo')} type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">{t('production.entries')}</h3>
            <Button variant="secondary" onClick={addEntry}>{t('production.addEntry')}</Button>
          </div>
          {entries.length === 0 && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-center border border-gray-200 rounded-lg p-3">
                <Input label={t('production.date')} type="date" value={entry.date} onChange={(e) => updateEntry(idx, { date: e.target.value })} />
                <div>
                  <F9Lookup label={t('production.shift')} value={entry.shiftId} onChange={(v) => updateEntry(idx, { shiftId: v })} adapter={productionShiftAdapter} />
                </div>
                <Select label={t('production.isWorkDay')} value={entry.isWorkDay ? 'true' : 'false'} onChange={(e) => updateEntry(idx, { isWorkDay: e.target.value === 'true' })} options={[{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }]} />
                <Input label={t('production.entryNotes')} value={entry.notes} onChange={(e) => updateEntry(idx, { notes: e.target.value })} />
                <div className="flex items-end">
                  <Button variant="danger" onClick={() => removeEntry(idx)}>{t('actions.remove')}</Button>
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
      <Modal open={resolveOpen} onClose={() => setResolveOpen(false)} title={t('production.resolve')} size="md">
        <div className="space-y-4">
          <Input label={t('production.date')} type="date" value={resolveDate} onChange={(e) => setResolveDate(e.target.value)} />
          <Button onClick={handleResolve} loading={resolving}>{t('actions.submit')}</Button>
          {resolveResult && (
            <div className="border border-gray-200 rounded-lg p-4 text-sm space-y-1">
              <p><span className="font-medium">{t('production.resolvedSource')}:</span> {resolveResult.source}</p>
              <p><span className="font-medium">{t('production.isWorkDay')}:</span> {resolveResult.isWorkDay ? t('common.yes') : t('common.no')}</p>
              <p><span className="font-medium">{t('production.shift')}:</span> {resolveResult.shift ? `[${resolveResult.shift.code}] ${resolveResult.shift.name} (${resolveResult.shift.startTime} - ${resolveResult.shift.endTime})` : '-'}</p>
            </div>
          )}
        </div>
      </Modal>
      <ConfirmDialog open={confirmStatusOpen} onClose={() => setConfirmStatusOpen(false)} onConfirm={handleStatusChange}
        title={t('common.confirmDeactivateTitle')} message={t('common.confirmDeactivateMessage')} variant="danger" loading={saving} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}