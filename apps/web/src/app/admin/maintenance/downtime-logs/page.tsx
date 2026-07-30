'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { DowntimeLog } from '../../../../lib/admin-types';
import { Button, Input, Textarea, Pagination, PageHeader, Modal, ConfirmDialog } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { F9Lookup, machineAdapter, maintenanceRequestAdapter } from '../../../../components/f9';
import { AdminDataGrid, GridColumn, GridAction } from '../../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionAddIcon, ActionEditIcon, ActionDeleteIcon, ActionRefreshIcon, ActionCancelIcon } from '../../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';

export default function DowntimeLogsPage() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<DowntimeLog[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<DowntimeLog | null>(null);
  const [form, setForm] = useState({ code: '', machineId: '', requestId: '', reason: '', notes: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  const selectedRecord = useMemo(() => data.find(d => d.id === selectedId), [data, selectedId]);

  const { exec } = useStableHandlers({
    new: () => openCreate(),
    edit: () => selectedRecord && openEdit(selectedRecord.id),
    refresh: () => fetchData(meta.page),
    close: () => confirmAction(selectedId, 'close'),
    delete: () => selectedId && setConfirmDeleteOpen(true),
  });

  useRegisterAdminActions([
    { id: 'new', labelKey: 'common.create', icon: <ActionAddIcon />, onClick: () => exec('new') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'close', labelKey: 'common.close', icon: <ActionCancelIcon />, onClick: () => exec('close'), enabled: !!(selectedId && !selectedRecord?.endTime) },
    { id: 'delete', labelKey: 'common.delete', icon: <ActionDeleteIcon />, variant: 'danger', onClick: () => exec('delete'), enabled: !!selectedId },
  ]);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get<{ data: DowntimeLog[]; meta: any }>('/maintenance/downtime-logs', { params });
      setData(res.data || []); setMeta(res.meta);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, t]);

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', machineId: '', requestId: '', reason: '', notes: '' });
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setLoadingDetail(true);
    setModalOpen(true);
    try {
      const res = await api.get<DowntimeLog>(`/maintenance/downtime-logs/${id}`);
      const item = res;
      setEditItem(item);
      setForm({
        code: (item as any).code || '',
        machineId: item.machineId,
        requestId: item.requestId || '',
        reason: item.reason,
        notes: item.notes || '',
      });
    } catch (err: any) {
      handleApiError(err);
      setModalOpen(false);
    }
    finally { setLoadingDetail(false); }
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.machineId) errs.machineId = t('validation.required');
    if (!form.reason) errs.reason = t('validation.required');
    if (Object.keys(errs).length > 0) { setValidationErrors(errs); return; }
    setValidationErrors({});
    setSaving(true);
    try {
      if (editItem) {
        const { code, ...payload } = form;
        await api.patch(`/maintenance/downtime-logs/${editItem.id}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/maintenance/downtime-logs', form);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const confirmAction = (id: string, action: string) => { setSelectedId(id); setPendingAction(action); setActionConfirmOpen(true); };
  const handleAction = async () => {
    setSaving(true);
    try {
      await api.patch(`/maintenance/downtime-logs/${selectedId}/${pendingAction}`);
      showToast(t('common.successUpdated'), 'success');
      setActionConfirmOpen(false); fetchData(meta.page);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/maintenance/downtime-logs/${selectedId}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false); setSelectedId(''); fetchData(1);
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const columns: GridColumn<DowntimeLog>[] = [
    { key: 'machine', header: t('maintenance.machine'), render: (d: DowntimeLog) => d.machine?.name || '-' },
    { key: 'reason', header: t('maintenance.reason') },
    { key: 'startTime', header: t('maintenance.startTime'), render: (d: DowntimeLog) => new Date(d.startTime).toLocaleString() },
    { key: 'endTime', header: t('maintenance.endTime'), render: (d: DowntimeLog) => d.endTime ? new Date(d.endTime).toLocaleString() : '-' },
    { key: 'durationMinutes', header: t('maintenance.durationMinutes'), render: (d: DowntimeLog) => d.durationMinutes ? `${d.durationMinutes} min` : '-' },
    { key: 'status', header: t('common.status'), render: (d: DowntimeLog) => <CmmsStatusBadge status={d.status} /> },
  ];

  const gridActions: GridAction<DowntimeLog>[] = [
    { label: t('maintenance.close'), onClick: (d: DowntimeLog) => confirmAction(d.id, 'close'), enabled: (d: DowntimeLog) => !d.endTime },
    { label: t('actions.edit'), onClick: (d: DowntimeLog) => openEdit(d.id) },
    { label: t('common.delete'), onClick: (d: DowntimeLog) => { setSelectedId(d.id); setConfirmDeleteOpen(true); }, variant: 'danger' },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.downtimeLogs')} />
      <AdminDataGrid
        columns={columns}
        data={data}
        keyExtractor={(d: DowntimeLog) => d.id}
        onRowClick={(d: DowntimeLog) => setSelectedId(d.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('maintenance.editDowntimeLog') : t('maintenance.newDowntimeLog')} size="lg">
        {loadingDetail ? (
          <div className="text-center py-8">{t('common.loading')}</div>
        ) : (
        <div className="space-y-4">
          {editItem ? (
            <div>
              <Input label={t('common.code')} value={form.code} disabled />
              <p className="text-xs text-gray-500 mt-1">{t('common.codeImmutableHint')}</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.code')}</label>
              <p className="text-sm text-gray-500 italic">{t('common.codeAutoGenerated')}</p>
            </div>
          )}
          <div>
            <F9Lookup label={t('maintenance.machine')} value={form.machineId} onChange={(v) => { setForm({ ...form, machineId: v }); setValidationErrors((prev) => ({ ...prev, machineId: '' })); }} adapter={machineAdapter} />
            {validationErrors.machineId && <p className="text-red-500 text-sm mt-1">{validationErrors.machineId}</p>}
          </div>
          <F9Lookup label={t('maintenance.maintenanceRequest')} value={form.requestId} onChange={(v) => setForm({ ...form, requestId: v })} adapter={maintenanceRequestAdapter} />
          <div>
            <Input label={t('maintenance.reason')} value={form.reason} onChange={(e) => { setForm({ ...form, reason: e.target.value }); setValidationErrors((prev) => ({ ...prev, reason: '' })); }} required />
            {validationErrors.reason && <p className="text-red-500 text-sm mt-1">{validationErrors.reason}</p>}
          </div>
          <Textarea label={t('maintenance.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
        )}
      </Modal>
      <ConfirmDialog open={actionConfirmOpen} onClose={() => setActionConfirmOpen(false)} onConfirm={handleAction}
        title={t('common.confirm')} message={t('common.confirmDeactivateMessage')} variant="primary" loading={saving} />
      <ConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')} message={t('common.confirmDeleteMessage')} variant="danger" loading={saving} />
    </div>
  );
}
